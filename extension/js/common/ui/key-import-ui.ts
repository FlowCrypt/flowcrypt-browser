/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { AttachmentUI } from './attachment-ui.js';
import { Catch } from '../platform/catch.js';
import { KeyBlockType } from '../core/msg-block.js';
import { Lang } from '../lang.js';
import { MsgBlockParser } from '../core/msg-block-parser.js';
import { PgpArmor } from '../core/crypto/pgp/pgp-armor.js';
import { Key, KeyUtil } from '../core/crypto/key.js';
import { PgpPwd } from '../core/crypto/pgp/pgp-password.js';
import { Settings } from '../settings.js';
import { Ui } from '../browser/ui.js';
import { Url, Str } from '../core/common.js';
import { opgp } from '../core/crypto/pgp/openpgpjs-custom.js';
import { OpenPGPKey } from '../core/crypto/pgp/openpgp-key.js';
import { KeyStore } from '../platform/store/key-store.js';
import { isCustomerUrlFesUsed } from '../helpers.js';
import { Xss } from '../platform/xss.js';
import { ClientConfiguration } from '../client-configuration.js';

type KeyImportUiCheckResult = {
  normalized: string;
  passphrase: string;
  fingerprint: string;
  decrypted: Key;
  encrypted: Key;
};

export class KeyCanBeFixed extends Error {
  public encrypted: Key;
  public constructor(encrypted: Key) {
    super();
    this.encrypted = encrypted;
  }
}

export class UserAlert extends Error {}

export class KeyImportUi {
  private expectedLongid?: string;
  private rejectKnown: boolean;
  private checkEncryption: boolean;
  private checkSigning: boolean;

  public constructor(o: { rejectKnown?: boolean; checkEncryption?: boolean; checkSigning?: boolean }) {
    this.rejectKnown = o.rejectKnown === true;
    this.checkEncryption = o.checkEncryption === true;
    this.checkSigning = o.checkSigning === true;
  }

  public static normalizeFingerprintOrLongId = (fingerprintOrLongid: string) => {
    let result = fingerprintOrLongid
      .trim()
      .replace(/0x|\s|:|-/g, '')
      .toUpperCase();
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
  };

  public static addAliasForSubmission = (email: string, submitKeyForAddrs: string[]) => {
    submitKeyForAddrs.push(email);
  };

  public static removeAliasFromSubmission = (email: string, submitKeyForAddrs: string[]) => {
    submitKeyForAddrs.splice(submitKeyForAddrs.indexOf(email), 1);
  };

  // by unselecting, we allow to click on "Load from a file" and trigger the fineuploader again
  public static allowReselect = () => {
    $('input[type=radio][name=source]').prop('checked', false);
  };

  public onBadPassphrase: VoidCallback = () => undefined;

  public shouldSubmitPubkey = (clientConfiguration: ClientConfiguration, checkboxSelector: string) => {
    if (clientConfiguration.mustSubmitToAttester() && !clientConfiguration.canSubmitPubToAttester()) {
      throw new Error('Organisation rules are misconfigured: ENFORCE_ATTESTER_SUBMIT not compatible with NO_ATTESTER_SUBMIT');
    }
    if (!clientConfiguration.canSubmitPubToAttester()) {
      return false;
    }
    if (clientConfiguration.mustSubmitToAttester()) {
      return true;
    }
    return Boolean($(checkboxSelector).prop('checked'));
  };

  public initPrvImportSrcForm = (acctEmail: string, parentTabId: string | undefined, submitKeyForAddrs?: string[]) => {
    $('input[type=radio][name=source]')
      .off()
      .on('change', function () {
        const selectedValue = (this as HTMLInputElement).value;
        switch (selectedValue) {
          case 'file':
            $('.input_private_key').val('').trigger('change').prop('disabled', true);
            $('.source_paste_container').css('display', 'none');
            $('.source_generate_container').hide();
            $('.source_paste_container .unprotected_key_create_pass_phrase').hide();
            $('#fineuploader_button > input').trigger('click');
            break;
          case 'paste':
            $('.input_private_key').val('').trigger('change').prop('disabled', false);
            $('.source_generate_container').hide();
            $('.source_paste_container').css('display', 'block');
            $('.source_paste_container .unprotected_key_create_pass_phrase').hide();
            break;
          case 'backup':
            window.location.href = Url.create('/chrome/settings/setup.htm', {
              acctEmail,
              parentTabId,
              action: 'add_key',
            });
            break;
          case 'generate':
            $('.source_paste_container').hide();
            $('.source_generate_container').show();
            break;
          default:
            break;
        }
      });
    $('.line.unprotected_key_create_pass_phrase .action_use_random_pass_phrase').on(
      'click',
      Ui.event.handle(() => {
        $('.source_paste_container .input_passphrase').val(PgpPwd.random()).trigger('input');
        $('.input_passphrase').attr('type', 'text');
        $('#e_rememberPassphrase').prop('checked', true);
      })
    );
    $('.input_private_key').on(
      'keyup paste change',
      Ui.event.handle(async target => {
        $('.action_add_private_key').addClass('btn_disabled').attr('disabled');
        $('.input_email_alias').prop('checked', false);
        const prv = await Catch.undefinedOnException(KeyUtil.parse(String($(target).val())));
        if (prv !== undefined) {
          $('.action_add_private_key').removeClass('btn_disabled').removeAttr('disabled');
          if (submitKeyForAddrs !== undefined) {
            for (const email of prv.emails) {
              for (const inputCheckboxesWithEmail of $('.input_email_alias')) {
                if (String($(inputCheckboxesWithEmail).data('email')) === email) {
                  KeyImportUi.addAliasForSubmission(email, submitKeyForAddrs);
                  $(inputCheckboxesWithEmail).prop('checked', true);
                }
              }
            }
          }
        }
      })
    );
    $('.input_private_key').on(
      'change',
      Ui.event.handle(async target => {
        const prv = await Catch.undefinedOnException(opgp.readKey({ armoredKey: String($(target).val()) }));
        if (!prv?.isPrivate()) {
          $('.line.unprotected_key_create_pass_phrase').hide();
          return;
        }
        if (OpenPGPKey.isFullyDecrypted(prv)) {
          $('.line.unprotected_key_create_pass_phrase').show();
          const { passwordResultElement, removeValidationElements } = this.renderPassPhraseStrengthValidationInput(
            $('.input_passphrase'),
            $('.action_add_private_key')
          );
          passwordResultElement.addClass('left');
          const removeValidationElementsWhenKeyChanged = Ui.event.handle(() => {
            removeValidationElements();
            $('.input_private_key').off('change', removeValidationElementsWhenKeyChanged);
          });
          $('.input_private_key').on('change', removeValidationElementsWhenKeyChanged);
        } else if (OpenPGPKey.isFullyEncrypted(prv)) {
          $('.line.unprotected_key_create_pass_phrase').hide();
        } else {
          await Ui.modal.error(Lang.setup.partiallyEncryptedKeyUnsupported);
          $('.line.unprotected_key_create_pass_phrase').hide();
        }
      })
    );
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const attachmentUi = new AttachmentUI(() => Promise.resolve({ count: 100, size: 1024 * 1024, size_mb: 1 }));
    attachmentUi.initAttachmentDialog('fineuploader', 'fineuploader_button', {
      attachmentAdded: async file => {
        let prv: Key | undefined;
        const utf = file.getData().toUtfStr('ignore'); // ignore utf8 errors because this may be a binary key (in which case we use the bytes directly below)
        if (utf.includes(PgpArmor.headers('privateKey').begin)) {
          const firstPrv = MsgBlockParser.detectBlocks(utf).blocks.find(b => b.type === 'privateKey');
          if (firstPrv) {
            // filter out all content except for the first encountered private key (GPGKeychain compatibility)
            prv = await KeyUtil.parse(Str.with(firstPrv.content));
          }
        } else {
          try {
            const parsed = await KeyUtil.parseBinary(file.getData(), '');
            prv = parsed[0];
          } catch {
            // ignore
          }
        }
        if (typeof prv !== 'undefined') {
          $('.input_private_key').val(KeyUtil.armor(prv)).trigger('change').prop('disabled', true);
          $('.source_paste_container').css('display', 'block');
        } else {
          $('.input_private_key').val('').trigger('change').prop('disabled', false);
          await Ui.modal.error('Not able to read this key. Make sure it is a valid PGP private key.', false, Ui.getTestCompatibilityLink(acctEmail));
          KeyImportUi.allowReselect();
        }
      },
    });
  };

  public checkPrv = async (acctEmail: string, armored: string, passphrase: string): Promise<KeyImportUiCheckResult> => {
    const { normalized } = await this.normalize('privateKey', armored);
    const decrypted = await this.read('privateKey', normalized); // for decrypting - not decrypted yet
    const encrypted = await this.read('privateKey', normalized); // original (typically encrypted)
    this.rejectIfNot('privateKey', decrypted);
    await this.rejectKnownIfSelected(acctEmail, decrypted);
    const contactSubsentence = Lang.general.contactMinimalSubsentence(await isCustomerUrlFesUsed(acctEmail));
    await this.decryptAndEncryptAsNeeded(decrypted, encrypted, passphrase, contactSubsentence);
    await this.checkEncryptionPrvIfSelected(decrypted, encrypted, contactSubsentence);
    await this.checkSigningIfSelected(decrypted, contactSubsentence);
    if (encrypted.identities.length === 0) {
      throw new KeyCanBeFixed(encrypted);
    }
    // mandatory checks have passed, now display warnings
    if (decrypted.missingPrivateKeyForDecryption || decrypted.missingPrivateKeyForSigning) {
      const missing: string[] = [];
      if (decrypted.missingPrivateKeyForSigning) {
        missing.push('signing');
      }
      if (decrypted.missingPrivateKeyForDecryption) {
        missing.push('decryption');
      }
      await Ui.modal.warning(
        'Looks like this key was exported with --export-secret-subkeys option and missing private key parameters.\n\n' +
          'Please export the key with --export-secret-key option if you plan to use it for ' +
          missing.join(' and ') +
          '.'
      );
    }
    return { normalized, passphrase, fingerprint: decrypted.id, decrypted, encrypted }; // will have fp if had longid
  };

  public checkPub = async (armored: string): Promise<string> => {
    const { normalized } = await this.normalize('publicKey', armored);
    await this.read('publicKey', normalized); // throws on err
    await this.checkEncryptionPubIfSelected(normalized);
    return normalized;
  };

  public renderKeyManualCreateView = async (selector: string) => {
    const htmlUrl = '/chrome/elements/shared/create_key.template.htm';
    const sanitized = Xss.htmlSanitize(await (await fetch(htmlUrl)).text());
    Xss.setElementContentDANGEROUSLY($(selector).get(0) as Element, sanitized); // xss-sanitized
    this.renderPassPhraseStrengthValidationInput($('#step_2a_manual_create .input_password'), $('#step_2a_manual_create .action_proceed_private'));
  };

  public renderPassPhraseStrengthValidationInput = (input: JQuery, submitButton?: JQuery, type: 'passphrase' | 'pwd' = 'passphrase') => {
    const validationElements = this.getPPValidationElements();
    const setBtnColor = (type: 'gray' | 'green') => {
      if (submitButton) {
        // submitButton may be undefined if we don't want password strength to affect color of any action button
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
    validationElements.progressBarElement.find('input').css('width', input.outerWidth() + 'px');
    input.parent().append(validationElements.progressBarElement); // xss-direct
    input.parent().append(validationElements.passwordResultElement); // xss-direct
    const validation = Ui.event.prevent('spree', validate);
    input.on('input', validation);
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
  };

  private normalize = async (type: 'publicKey' | 'privateKey', armored: string): Promise<{ normalized: string }> => {
    // non-OpenPGP keys are considered to be always normalized
    // TODO: KeyUtil.normalize depends on OpenPGP.Key objects, when this is resolved
    // this check for key family should be moved to KeyUtil.normalize function.
    if (KeyUtil.getKeyFamily(armored) !== 'openpgp') {
      return { normalized: armored };
    }
    const normalized = await KeyUtil.normalize(type, armored);
    if (!normalized) {
      const headers = PgpArmor.headers(type);
      throw new UserAlert(
        'There was an error processing this key, possibly due to bad formatting.\n' +
          `Please insert complete key, including "${headers.begin}" and "${headers.end}".`
      );
    }
    return normalized;
  };

  private read = async (type: KeyBlockType, normalized: string) => {
    const headers = PgpArmor.headers(type);
    const k = await KeyUtil.parse(normalized);
    if (typeof k === 'undefined') {
      throw new UserAlert(
        `${type === 'privateKey' ? 'Private' : 'Public'} key is not correctly formatted. Please insert complete key, including "${headers.begin}" and "${
          headers.end
        }"`
      );
    }
    return k;
  };

  private rejectIfNot = (type: KeyBlockType, k: Key) => {
    const headers = PgpArmor.headers(type);
    if (type === 'privateKey' && k.isPublic) {
      throw new UserAlert('This was a public key. Please insert a private key instead. It\'s a block of text starting with "' + headers.begin + '"');
    }
    if (type === 'publicKey' && !k.isPublic) {
      throw new UserAlert('This was a private key. Please insert a public key instead. It\'s a block of text starting with "' + headers.begin + '"');
    }
  };

  private rejectKnownIfSelected = async (acctEmail: string, k: Key) => {
    if (this.rejectKnown) {
      const keyinfos = await KeyStore.get(acctEmail);
      const privateKeysIds = keyinfos.map(ki => ki.fingerprints[0]);
      if (privateKeysIds.includes(k.id)) {
        throw new UserAlert('This is one of your current keys, try another one.');
      }
    }
  };

  private decryptAndEncryptAsNeeded = async (toDecrypt: Key, toEncrypt: Key, passphrase: string, contactSubsentence: string): Promise<void> => {
    if (!passphrase) {
      throw new UserAlert('Please enter a pass phrase to use with this key');
    }
    try {
      if (toEncrypt.fullyDecrypted) {
        await KeyUtil.encrypt(toEncrypt, passphrase);
      } else if (!toEncrypt.fullyEncrypted) {
        throw new UserAlert(Lang.setup.partiallyEncryptedKeyUnsupported);
      }
      if (toDecrypt.fullyEncrypted) {
        if (!(await KeyUtil.decrypt(toDecrypt, passphrase))) {
          this.onBadPassphrase();
          if (this.expectedLongid) {
            // todo - double check this line, should it not say `this.expectedLongid === PgpKey.longid() ? Or is that checked elsewhere beforehand?
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
      throw new UserAlert(`This key is not supported by FlowCrypt yet. Please ${contactSubsentence} to add support soon. (decrypt error: ${String(e)})`);
    }
  };

  private checkEncryptionPrvIfSelected = async (k: Key, encrypted: Key, contactSubsentence: string) => {
    if (this.checkEncryption && (!k.usableForEncryption || k.missingPrivateKeyForDecryption)) {
      if (k.missingPrivateKeyForDecryption) {
        throw new UserAlert(
          'Looks like this key was exported with --export-secret-subkeys option and missing private key parameters.\n\n' +
            'Please export the key with --export-secret-key option.'
        );
      } else if (await KeyUtil.isWithoutSelfCertifications(k)) {
        throw new KeyCanBeFixed(encrypted);
      } else if (k.usableForEncryptionButExpired) {
        // Currently have 2 options: import or skip. Would be better to give user 3 choices:
        // 1) Confirm importing expired key
        // 2) Extend validity of expired key + import
        // 3) Cancel
        const isConfirmed = await Ui.modal.confirm(
          'You are importing a key that is expired. You can still import it to read messages from the past, ' +
            'but you will not be able to send new messages using this key. You can add more keys in the settings later.\n\nProceed with expired key?'
        );
        if (!isConfirmed) {
          throw new UserAlert(
            'You chose to not import expired key.\n\nPlease import another key, or edit the expired key in another OpenPGP software to extend key validity.'
          );
        }
      } else {
        throw new UserAlert(`This looks like a valid key but it cannot be used for encryption. Please ${contactSubsentence} to see why is that.`);
      }
    }
  };

  private checkEncryptionPubIfSelected = async (normalized: string) => {
    const key = await KeyUtil.parse(normalized);
    if (this.checkEncryption && !key.usableForEncryption) {
      let msg = 'This public key is correctly formatted, but it cannot be used for encryption';
      if (key.expiration && key.expiration < Date.now()) {
        msg += ` because it expired on ${Str.fromDate(new Date(key.expiration))}.\n\nAsk the recipient to provide you with an updated Public Key.`;
        msg += '\n\nIf you need to use this particular expired key, click the "SETTINGS" button below and import it there.';
      } else {
        msg += '.';
      }
      throw new UserAlert(msg);
    }
  };

  private checkSigningIfSelected = async (k: Key, contactSubsentence: string) => {
    if (this.checkSigning && (!k.usableForSigning || k.missingPrivateKeyForSigning)) {
      if (k.missingPrivateKeyForSigning && !k.usableForSigningButExpired) {
        throw new UserAlert(
          'Looks like this key was exported with --export-secret-subkeys option and missing private key parameters.\n\n' +
            'Please export the key with --export-secret-key option.'
        );
      } else {
        throw new UserAlert(`This looks like a valid key but it cannot be used for signing. Please ${contactSubsentence} to see why is that.`);
      }
    }
  };

  private getPPValidationElements = () => {
    const passwordResultHTML = `<div class="line password_feedback" data-test="container-password-feedback">
                                  <span class="password_result"></span> (time to crack: <span class="password_time"></span>)<ul></ul>
                                </div>`;
    const progressBarHTML = `<br/><div class="password_bar">
                <div></div>
              </div>`;
    return { passwordResultElement: $(passwordResultHTML), progressBarElement: $(progressBarHTML) };
  };
}
