/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { AttUI } from './att-ui.js';
import { Catch } from '../platform/catch.js';
import { KeyBlockType } from '../core/msg-block.js';
import { Lang } from '../lang.js';
import { MsgBlockParser } from '../core/msg-block-parser.js';
import { PgpArmor } from '../core/crypto/pgp/pgp-armor.js';
import { PgpKey, Pubkey } from '../core/crypto/pgp/pgp-key.js';
import { PgpPwd } from '../core/crypto/pgp/pgp-password.js';
import { Settings } from '../settings.js';
import { Ui } from '../browser/ui.js';
import { Url, Str } from '../core/common.js';
import { opgp } from '../core/crypto/pgp/pgp.js';
import { KeyStore } from '../platform/store/key-store.js';

type KeyImportUiCheckResult = {
  normalized: string; longid: string; passphrase: string; fingerprint: string; decrypted: Pubkey;
  encrypted: Pubkey;
};

export class KeyCanBeFixed extends Error {
  public encrypted: Pubkey;
  constructor(encrypted: Pubkey) {
    super();
    this.encrypted = encrypted;
  }
}

export class UserAlert extends Error { }

export class KeyImportUi {

  private expectedLongid?: string;
  private rejectKnown: boolean;
  private checkEncryption: boolean;
  private checkSigning: boolean;

  public static normalizeFingerprintOrLongId = (fingerprintOrLongid: string) => {
    let result = fingerprintOrLongid.trim().replace(/0x|\s|:|-/g, '').toUpperCase();
    if (result.length >= 40) {
      result = result.substring(result.length - 40);
      if (result.match(/[A-F0-9]{40}/g)) {
        return result; // fingerprint
      }
    }
    if (result.length >= 16) {
      result = result.substring(result.length - 16);
      if (result.match(/[A-F0-9]{16}/g)) {
        return result; // longid
      }
    }
    return;
  }

  constructor(o: { expectLongid?: string, rejectKnown?: boolean, checkEncryption?: boolean, checkSigning?: boolean }) {
    this.expectedLongid = o.expectLongid;
    this.rejectKnown = o.rejectKnown === true;
    this.checkEncryption = o.checkEncryption === true;
    this.checkSigning = o.checkSigning === true;
  }
  public onBadPassphrase: VoidCallback = () => undefined;

  public initPrvImportSrcForm = (acctEmail: string, parentTabId: string | undefined) => {
    $('input[type=radio][name=source]').off().change(function () {
      if ((this as HTMLInputElement).value === 'file') {
        $('.input_private_key').val('').change().prop('disabled', true);
        $('.source_paste_container').css('display', 'none');
        $('.source_paste_container .unprotected_key_create_pass_phrase').hide();
        $('#fineuploader_button > input').click();
      } else if ((this as HTMLInputElement).value === 'paste') {
        $('.input_private_key').val('').change().prop('disabled', false);
        $('.source_paste_container').css('display', 'block');
        $('.source_paste_container .unprotected_key_create_pass_phrase').hide();
      } else if ((this as HTMLInputElement).value === 'backup') {
        window.location.href = Url.create('/chrome/settings/setup.htm', { acctEmail, parentTabId, action: 'add_key' });
      }
    });
    $('.line.unprotected_key_create_pass_phrase .action_use_random_pass_phrase').click(Ui.event.handle(target => {
      $('.source_paste_container .input_passphrase').val(PgpPwd.random()).keyup();
      $('.input_passphrase').attr('type', 'text');
      $('#e_rememberPassphrase').prop('checked', true);
    }));
    $('.input_private_key').change(Ui.event.handle(async target => {
      const { keys: [prv] } = await opgp.key.readArmored(String($(target).val()));
      $('.input_passphrase').val('');
      if (!prv || !prv.isPrivate()) {
        $('.line.unprotected_key_create_pass_phrase').hide();
        return;
      }
      if (prv.isFullyDecrypted()) {
        $('.line.unprotected_key_create_pass_phrase').show();
        const { passwordResultElement, removeValidationElements } = this.renderPassPhraseStrengthValidationInput($('.input_passphrase'), $('.action_add_private_key'));
        passwordResultElement.addClass('left');
        const removeValidationElementsWhenKeyChanged = Ui.event.handle(() => {
          removeValidationElements();
          $('.input_private_key').off('change', removeValidationElementsWhenKeyChanged);
        });
        $('.input_private_key').change(removeValidationElementsWhenKeyChanged);
      } else if (prv.isFullyEncrypted()) {
        $('.line.unprotected_key_create_pass_phrase').hide();
      } else {
        await Ui.modal.error(Lang.setup.partiallyEncryptedKeyUnsupported);
        $('.line.unprotected_key_create_pass_phrase').hide();
      }
    }));
    const attach = new AttUI(() => Promise.resolve({ count: 100, size: 1024 * 1024, size_mb: 1 }));
    attach.initAttDialog('fineuploader', 'fineuploader_button', {
      attAdded: async file => {
        let prv: OpenPGP.key.Key | undefined;
        const utf = file.getData().toUtfStr();
        if (utf.includes(PgpArmor.headers('privateKey').begin)) {
          const firstPrv = MsgBlockParser.detectBlocks(utf).blocks.filter(b => b.type === 'privateKey')[0];
          if (firstPrv) { // filter out all content except for the first encountered private key (GPGKeychain compatibility)
            prv = (await opgp.key.readArmored(firstPrv.content.toString())).keys[0];
          }
        } else {
          prv = (await opgp.key.read(file.getData())).keys[0];
        }
        if (typeof prv !== 'undefined') {
          $('.input_private_key').val(prv.armor()).change().prop('disabled', true);
          $('.source_paste_container').css('display', 'block');
        } else {
          $('.input_private_key').val('').change().prop('disabled', false);
          await Ui.modal.error('Not able to read this key. Is it a valid PGP private key?', false, Ui.testCompatibilityLink);
          $('input[type=radio][name=source]').removeAttr('checked');
        }
      }
    });
  }

  public checkPrv = async (acctEmail: string, armored: string, passphrase: string): Promise<KeyImportUiCheckResult> => {
    const { normalized } = await this.normalize('privateKey', armored);
    const decrypted = await this.read('privateKey', normalized);
    const encrypted = await this.read('privateKey', normalized);
    const longid = await this.longid(decrypted);
    this.rejectIfNot('privateKey', decrypted);
    await this.rejectKnownIfSelected(acctEmail, decrypted);
    this.rejectIfDifferentFromSelectedLongid(longid);
    await this.decryptAndEncryptAsNeeded(decrypted, encrypted, passphrase);
    await this.checkEncryptionPrvIfSelected(decrypted, encrypted);
    await this.checkSigningIfSelected(decrypted);
    return { normalized, longid, passphrase, fingerprint: (await PgpKey.fingerprint(decrypted))!, decrypted, encrypted }; // will have fp if had longid
  }

  public checkPub = async (armored: string): Promise<string> => {
    const { normalized } = await this.normalize('publicKey', armored);
    const parsed = await this.read('publicKey', normalized);
    await this.longid(parsed);
    await this.checkEncryptionPubIfSelected(normalized);
    return normalized;
  }

  public renderPassPhraseStrengthValidationInput = (input: JQuery<HTMLElement>, submitButton?: JQuery<HTMLElement>, type: 'passphrase' | 'pwd' = 'passphrase') => {
    const validationElements = this.getPPValidationElements();
    const setBtnColor = (type: 'gray' | 'green') => {
      if (submitButton) { // submitButton may be undefined if we don't want password strength to affect color of any action button
        submitButton.addClass(type === 'gray' ? 'gray' : 'green');
        submitButton.removeClass(type === 'gray' ? 'green' : 'gray');
      }
    };
    const validate = () => {
      const password = input.val();
      if (typeof password !== 'string') {
        Catch.report('render_password_strength: Selected password is not a string', typeof password);
        return;
      }
      const result = Settings.evalPasswordStrength(password, type);
      validationElements.passwordResultElement.css('display', 'block');
      validationElements.passwordResultElement.css('color', result.word.color);
      validationElements.passwordResultElement.find('.password_result').text(result.word.word);
      validationElements.passwordResultElement.find('.password_time').text(result.time);
      validationElements.progressBarElement.find('div').css('width', result.word.bar + '%');
      validationElements.progressBarElement.find('div').css('background-color', result.word.color);
      setBtnColor(result.word.pass ? 'green' : 'gray');
    };
    validationElements.progressBarElement
      .find('input').css('width', input.outerWidth() + 'px');
    input.parent().append(validationElements.progressBarElement); // xss-direct
    input.parent().append(validationElements.passwordResultElement); // xss-direct
    const validation = Ui.event.prevent('spree', validate);
    input.on('keyup', validation);
    const removeValidationElements = () => {
      validationElements.passwordResultElement.remove();
      validationElements.progressBarElement.remove();
      input.off('keydown', validation);
      setBtnColor('green');
    };
    if (!input.val()) {
      setBtnColor('gray');
    } else {
      validate();
    }
    return { ...validationElements, removeValidationElements };
  }

  private normalize = async (type: KeyBlockType, armored: string): Promise<{ normalized: string }> => {
    // non-OpenPGP keys are considered to be always normalized
    // TODO: PgpKey.normalize depends on OpenPGP.key.Key objects, when this is resolved
    // this check for key type should be moved to PgpKey.normalize function.
    if (PgpKey.getKeyType(armored) !== 'openpgp') {
      return { normalized: armored };
    }
    const headers = PgpArmor.headers(type);
    const normalized = await PgpKey.normalize(armored);
    if (!normalized) {
      throw new UserAlert('There was an error processing this key, possibly due to bad formatting.\nPlease insert complete key, including "' + headers.begin + '" and "' + headers.end + '"');
    }
    return normalized;
  }

  private read = async (type: KeyBlockType, normalized: string) => {
    const headers = PgpArmor.headers(type);
    const k = await PgpKey.parse(normalized);
    if (typeof k === 'undefined') {
      throw new UserAlert(`${type === 'privateKey' ? 'Private' : 'Public'} key is not correctly formatted. Please insert complete key, including "${headers.begin}" and "${headers.end}"`);
    }
    return k;
  }

  private longid = async (k: Pubkey) => {
    const longid = await PgpKey.longid(k);
    if (!longid) {
      throw new UserAlert('This key may not be compatible. Email human@flowcrypt.com and const us know which software created this key.\n\n(error: cannot get long_id)');
    }
    return longid;
  }

  private rejectIfNot = (type: KeyBlockType, k: Pubkey) => {
    const headers = PgpArmor.headers(type);
    if (type === 'privateKey' && k.isPublic) {
      throw new UserAlert('This was a public key. Please insert a private key instead. It\'s a block of text starting with "' + headers.begin + '"');
    }
    if (type === 'publicKey' && !k.isPublic) {
      throw new UserAlert('This was a public key. Please insert a private key instead. It\'s a block of text starting with "' + headers.begin + '"');
    }
  }

  private rejectKnownIfSelected = async (acctEmail: string, k: Pubkey) => {
    if (this.rejectKnown) {
      const keyinfos = await KeyStore.get(acctEmail);
      const privateKeysLongids = keyinfos.map(ki => ki.longid);
      if (privateKeysLongids.includes(String(await PgpKey.longid(k)))) {
        throw new UserAlert('This is one of your current keys, try another one.');
      }
    }
  }

  private rejectIfDifferentFromSelectedLongid = (longid: string) => {
    if (this.expectedLongid && longid !== this.expectedLongid) {
      throw new UserAlert(`Key does not match. Looking for key with Longid ${Str.spaced(this.expectedLongid)}`);
    }
  }

  private decryptAndEncryptAsNeeded = async (toDecrypt: Pubkey, toEncrypt: Pubkey, passphrase: string): Promise<void> => {
    if (!passphrase) {
      throw new UserAlert('Please enter a pass phrase to use with this key');
    }
    try {
      if (toEncrypt.fullyDecrypted) {
        await PgpKey.encrypt(toEncrypt, passphrase);
      } else if (!toEncrypt.fullyEncrypted) {
        throw new UserAlert(Lang.setup.partiallyEncryptedKeyUnsupported);
      }
      if (toDecrypt.fullyEncrypted) {
        if (! await PgpKey.decrypt(toDecrypt, passphrase)) {
          this.onBadPassphrase();
          if (this.expectedLongid) { // todo - double check this line, should it not say `this.expectedLongid === PgpKey.longid() ? Or is that checked elsewhere beforehand?
            throw new UserAlert(`This is the right key! However, the pass phrase does not match. Please try a different pass phrase.
              Your original pass phrase might have been different then what you use now.`);
          } else {
            throw new UserAlert('The pass phrase does not match. Please try a different pass phrase.');
          }
        }
      } else if (!toDecrypt.fullyDecrypted) {
        throw new UserAlert(Lang.setup.partiallyEncryptedKeyUnsupported);
      }
    } catch (e) {
      if (e instanceof UserAlert) {
        throw e;
      }
      throw new UserAlert(`This key is not supported by FlowCrypt yet. Please write at human@flowcrypt.com to add support soon. (decrypt error: ${String(e)})`);
    }
  }

  private checkEncryptionPrvIfSelected = async (k: Pubkey, encrypted: Pubkey) => {
    if (this.checkEncryption && !k.usableForEncryption) {
      if (await PgpKey.isWithoutSelfCertifications(k)) {
        throw new KeyCanBeFixed(encrypted);
      } else if (k.usableButExpired) {
        // Currently have 2 options: import or skip. Would be better to give user 3 choices:
        // 1) Confirm importing expired key
        // 2) Extend validity of expired key + import
        // 3) Cancel
        const isConfirmed = await Ui.modal.confirm('You are importing a key that is expired. You can still import it to read messages from the past, ' +
          'but you will not be able to send new messages using this key. You can add more keys in the settings later.\n\nProceed with expired key?');
        if (!isConfirmed) {
          throw new UserAlert('You chose to not import expired key.\n\nPlease import another key, or edit the expired key in another OpenPGP software to extend key validity.');
        }
      } else {
        throw new UserAlert('This looks like a valid key but it cannot be used for encryption. Please write at human@flowcrypt.com to see why is that.');
      }
    }
  }

  private checkEncryptionPubIfSelected = async (normalized: string) => {
    const key = await PgpKey.parse(normalized);
    if (this.checkEncryption && !key.usableForEncryption) {
      throw new UserAlert('This public key looks correctly formatted, but cannot be used for encryption. Please write at human@flowcrypt.com. We\'ll see if there is a way to fix it.');
    }
  }

  private checkSigningIfSelected = async (k: Pubkey) => {
    if (this.checkSigning && !k.usableForSigning) {
      throw new UserAlert('This looks like a valid key but it cannot be used for signing. Please write at human@flowcrypt.com to see why is that.');
    }
  }

  private getPPValidationElements = () => {
    const passwordResultHTML = `<div class="line password_feedback" data-test="container-password-feedback">
                                  <span class="password_result"></span> (time to crack: <span class="password_time"></span>)<ul></ul>
                                </div>`;
    const progressBarHTML = `<br/><div class="password_bar">
                <div></div>
              </div>`;
    return { passwordResultElement: $(passwordResultHTML), progressBarElement: $(progressBarHTML) };
  }

}
