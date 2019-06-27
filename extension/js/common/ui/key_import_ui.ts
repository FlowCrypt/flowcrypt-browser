/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store } from '../platform/store.js';
import { Ui, Env } from '../browser.js';
import { Pgp } from '../core/pgp.js';
import { KeyBlockType } from '../core/mime.js';
import { mnemonic } from '../core/mnemonic.js';
import { AttUI } from './att_ui.js';

declare const openpgp: typeof OpenPGP;

type KeyImportUiCheckResult = {
  normalized: string; longid: string; passphrase: string; fingerprint: string; decrypted: OpenPGP.key.Key;
  encrypted: OpenPGP.key.Key;
};

export class KeyCanBeFixed extends Error {
  encrypted: OpenPGP.key.Key;
  constructor(encrypted: OpenPGP.key.Key) {
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
  public onBadPassphrase: VoidCallback = () => undefined;

  constructor(o: { expectLongid?: string, rejectKnown?: boolean, checkEncryption?: boolean, checkSigning?: boolean }) {
    this.expectedLongid = o.expectLongid;
    this.rejectKnown = o.rejectKnown === true;
    this.checkEncryption = o.checkEncryption === true;
    this.checkSigning = o.checkSigning === true;
  }

  public initPrvImportSrcForm = (acctEmail: string, parentTabId: string | undefined) => {
    $('input[type=radio][name=source]').off().change(function () {
      if ((this as HTMLInputElement).value === 'file') {
        $('.input_private_key').val('').change().prop('disabled', true);
        $('.source_paste_container').css('display', 'none');
        $('.source_paste_container .pass_phrase_needed').hide();
        $('#fineuploader_button > input').click();
      } else if ((this as HTMLInputElement).value === 'paste') {
        $('.input_private_key').val('').change().prop('disabled', false);
        $('.source_paste_container').css('display', 'block');
        $('.source_paste_container .pass_phrase_needed').hide();
      } else if ((this as HTMLInputElement).value === 'backup') {
        window.location.href = Env.urlCreate('/chrome/settings/setup.htm', { acctEmail, parentTabId, action: 'add_key' });
      }
    });
    $('.line.pass_phrase_needed .action_use_random_pass_phrase').click(Ui.event.handle(target => {
      $('.source_paste_container .input_passphrase').val(Pgp.password.random());
      $('.input_passphrase').attr('type', 'text');
      $('#e_rememberPassphrase').prop('checked', true);
    }));
    $('.input_private_key').change(Ui.event.handle(async target => {
      const { keys: [prv] } = await openpgp.key.readArmored(String($(target).val()));
      $('.input_passphrase').val('');
      if (prv && prv.isPrivate() && prv.isDecrypted()) {
        $('.line.pass_phrase_needed').show();
      } else {
        $('.line.pass_phrase_needed').hide();
      }
    }));
    const attach = new AttUI(() => Promise.resolve({ count: 100, size: 1024 * 1024, size_mb: 1 }));
    attach.initAttDialog('fineuploader', 'fineuploader_button');
    attach.setAttAddedCb(async file => {
      let prv: OpenPGP.key.Key | undefined;
      const utf = file.getData().toUtfStr();
      if (utf.includes(Pgp.armor.headers('privateKey').begin)) {
        const firstPrv = Pgp.armor.detectBlocks(utf).blocks.filter(b => b.type === 'privateKey')[0];
        if (firstPrv) { // filter out all content except for the first encountered private key (GPGKeychain compatibility)
          prv = (await openpgp.key.readArmored(firstPrv.content.toString())).keys[0];
        }
      } else {
        prv = (await openpgp.key.read(file.getData())).keys[0];
      }
      if (typeof prv !== 'undefined') {
        $('.input_private_key').val(prv.armor()).change().prop('disabled', true);
        $('.source_paste_container').css('display', 'block');
      } else {
        $('.input_private_key').val('').change().prop('disabled', false);
        await Ui.modal.error('Not able to read this key. Is it a valid PGP private key?');
        $('input[type=radio][name=source]').removeAttr('checked');
      }
    });
  }

  checkPrv = async (acctEmail: string, armored: string, passphrase: string): Promise<KeyImportUiCheckResult> => {
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
    return { normalized, longid, passphrase, fingerprint: (await Pgp.key.fingerprint(decrypted))!, decrypted, encrypted }; // will have fp if had longid
  }

  checkPub = async (armored: string): Promise<string> => {
    const { normalized } = await this.normalize('publicKey', armored);
    const parsed = await this.read('publicKey', normalized);
    await this.longid(parsed);
    await this.checkEncryptionPubIfSelected(normalized);
    return normalized;
  }

  private normalize = async (type: KeyBlockType, armored: string) => {
    const headers = Pgp.armor.headers(type);
    const normalized = await Pgp.key.normalize(armored);
    if (!normalized) {
      throw new UserAlert('There was an error processing this key, possibly due to bad formatting.\nPlease insert complete key, including "' + headers.begin + '" and "' + headers.end + '"');
    }
    return normalized;
  }

  private read = async (type: KeyBlockType, normalized: string) => {
    const headers = Pgp.armor.headers(type);
    const { keys: [k] } = await openpgp.key.readArmored(normalized);
    if (typeof k === 'undefined') {
      throw new UserAlert('Private key is not correctly formated. Please insert complete key, including "' + headers.begin + '" and "' + headers.end + '"');
    }
    return k;
  }

  private longid = async (k: OpenPGP.key.Key) => {
    const longid = await Pgp.key.longid(k);
    if (!longid) {
      throw new UserAlert('This key may not be compatible. Email human@flowcrypt.com and const us know which software created this key.\n\n(error: cannot get long_id)');
    }
    return longid;
  }

  private rejectIfNot = (type: KeyBlockType, k: OpenPGP.key.Key) => {
    const headers = Pgp.armor.headers(type);
    if (type === 'privateKey' && k.isPublic()) {
      throw new UserAlert('This was a public key. Please insert a private key instead. It\'s a block of text starting with "' + headers.begin + '"');
    }
    if (type === 'publicKey' && !k.isPublic()) {
      throw new UserAlert('This was a public key. Please insert a private key instead. It\'s a block of text starting with "' + headers.begin + '"');
    }
  }

  private rejectKnownIfSelected = async (acctEmail: string, k: OpenPGP.key.Key) => {
    if (this.rejectKnown) {
      const keyinfos = await Store.keysGet(acctEmail);
      const privateKeysLongids = keyinfos.map(ki => ki.longid);
      if (privateKeysLongids.includes(String(await Pgp.key.longid(k)))) {
        throw new UserAlert('This is one of your current keys, try another one.');
      }
    }
  }

  private rejectIfDifferentFromSelectedLongid = (longid: string) => {
    if (this.expectedLongid && longid !== this.expectedLongid) {
      throw new UserAlert(`Key does not match. Looking for key with KeyWords ${mnemonic(this.expectedLongid)} (${this.expectedLongid})`);
    }
  }

  private decryptAndEncryptAsNeeded = async (toDecrypt: OpenPGP.key.Key, toEncrypt: OpenPGP.key.Key, passphrase: string): Promise<void> => {
    if (!passphrase) {
      throw new UserAlert('Please enter a pass phrase to use with this key');
    }
    let decryptResult;
    try {
      if (toEncrypt.isDecrypted()) {
        await toEncrypt.encrypt(passphrase);
      }
      if (toDecrypt.isDecrypted()) {
        return;
      }
      decryptResult = await Pgp.key.decrypt(toDecrypt, [passphrase]);
    } catch (e) {
      throw new UserAlert(`This key is not supported by FlowCrypt yet. Please write at human@flowcrypt.com to add support soon. (decrypt error: ${String(e)})`);
    }
    if (!decryptResult) {
      this.onBadPassphrase();
      if (this.expectedLongid) {
        // tslint:disable-next-line:max-line-length
        throw new UserAlert('This is the right key! However, the pass phrase does not match. Please try a different pass phrase. Your original pass phrase might have been different then what you use now.');
      } else {
        throw new UserAlert('The pass phrase does not match. Please try a different pass phrase.');
      }
    }
  }

  private checkEncryptionPrvIfSelected = async (k: OpenPGP.key.Key, encrypted: OpenPGP.key.Key) => {
    if (this.checkEncryption && ! await k.getEncryptionKey()) {
      if (await k.verifyPrimaryKey() === openpgp.enums.keyStatus.no_self_cert || await Pgp.key.usableButExpired(k)) { // known issues - key can be fixed
        throw new KeyCanBeFixed(encrypted);
      } else {
        throw new UserAlert('This looks like a valid key but it cannot be used for encryption. Please write at human@flowcrypt.com to see why is that.');
      }
    }
  }

  private checkEncryptionPubIfSelected = async (normalized: string) => {
    if (this.checkEncryption && !await Pgp.key.usable(normalized)) {
      throw new UserAlert('This public key looks correctly formatted, but cannot be used for encryption. Please write at human@flowcrypt.com. We\'ll see if there is a way to fix it.');
    }
  }

  private checkSigningIfSelected = async (k: OpenPGP.key.Key) => {
    if (this.checkSigning && ! await k.getSigningKey()) {
      throw new UserAlert('This looks like a valid key but it cannot be used for signing. Please write at human@flowcrypt.com to see why is that.');
    }
  }

  public static normalizeLongId = (longid: string) => {
    let result = longid.trim().replace(/0x|\s|:|-/g, '').toUpperCase();
    if (result.length >= 16) {
      result = result.substring(result.length - 16);
      if (result.match(/[A-F0-9]{16}/g)) {
        return result;
      }
    }
    return;
  }

}
