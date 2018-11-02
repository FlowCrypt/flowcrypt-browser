/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'user strict';

import {Store} from './storage.js';
import {mnemonic} from './mnemonic.js';
import {Value, Ui, Pgp, Env} from './common.js';
import {Attach} from './attach.js';
import * as t from '../../types/common';

declare let openpgp: typeof OpenPGP;

export class KeyCanBeFixed extends Error {
  encrypted: OpenPGP.key.Key;
}

export class UserAlert extends Error {}

export class KeyImportUI {

  private expected_longid: string|null;
  private reject_known: boolean;
  private check_encryption: boolean;
  private check_signing: boolean;
  public on_bad_passphrase: VoidCallback = () => undefined;

  constructor(o: {expect_longid?: string, reject_known?: boolean, check_encryption?: boolean, check_signing?: boolean}) {
    this.expected_longid = o.expect_longid || null;
    this.reject_known = o.reject_known === true;
    this.check_encryption = o.check_encryption === true;
    this.check_signing = o.check_signing === true;
  }

  public init_prv_import_source_form = (account_email: string, parent_tab_id: string|null) => {
    $('input[type=radio][name=source]').off().change(function() {
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
        window.location.href = Env.url_create('/chrome/settings/setup.htm', {account_email, parent_tab_id, action: 'add_key'});
      }
    });
    $('.line.pass_phrase_needed .action_use_random_pass_phrase').click(Ui.event.handle(target => {
      $('.source_paste_container .input_passphrase').val(Pgp.password.random());
      $('.input_passphrase').attr('type', 'text');
      $('#e_rememberPassphrase').prop('checked', true);
    }));
    $('.input_private_key').change(Ui.event.handle(target => {
      let k = openpgp.key.readArmored($(target).val() as string).keys[0];
      $('.input_passphrase').val('');
      if(k && k.isPrivate() && k.isDecrypted()) {
        $('.line.pass_phrase_needed').show();
      } else {
        $('.line.pass_phrase_needed').hide();
      }
    }));
    let attach = new Attach(() => ({count: 100, size: 1024 * 1024, size_mb: 1}));
    attach.initialize_attach_dialog('fineuploader', 'fineuploader_button');
    attach.set_attachment_added_callback(file => {
      let k;
      if (Value.is(Pgp.armor.headers('private_key').begin).in(file.as_text())) {
        let first_prv = Pgp.armor.detect_blocks(file.as_text()).blocks.filter(b => b.type === 'private_key')[0];
        if (first_prv) {
          k = openpgp.key.readArmored(first_prv.content).keys[0];  // filter out all content except for the first encountered private key (GPGKeychain compatibility)
        }
      } else {
        k = openpgp.key.read(file.as_bytes()).keys[0];
      }
      if (typeof k !== 'undefined') {
        $('.input_private_key').val(k.armor()).change().prop('disabled', true);
        $('.source_paste_container').css('display', 'block');
      } else {
        $('.input_private_key').val('').change().prop('disabled', false);
        alert('Not able to read this key. Is it a valid PGP private key?');
        $('input[type=radio][name=source]').removeAttr('checked');
      }
    });
  }

  check_prv = async (account_email: string, armored: string, passphrase: string): Promise<t.KeyImportUiCheckResult> => {
    let normalized = this.normalize('private_key', armored);
    let decrypted = this.read('private_key', normalized);
    let encrypted = this.read('private_key', normalized);
    let longid = this.longid(decrypted);
    this.reject_if_not('private_key', decrypted);
    await this.reject_known_if_selected(account_email, decrypted);
    this.reject_if_different_from_selected_longid(longid);
    await this.decrypt_and_encrypt_as_needed(decrypted, encrypted, passphrase);
    await this.check_encryption_prv_if_selected(decrypted, encrypted);
    await this.check_signing_if_selected(decrypted);
    return {normalized, longid, passphrase, fingerprint: Pgp.key.fingerprint(decrypted)!, decrypted, encrypted}; // will have fp if had longid
  }

  check_pub = async (armored: string): Promise<string> => {
    let normalized = this.normalize('public_key', armored);
    let parsed = this.read('public_key', normalized);
    let longid = this.longid(parsed);
    await this.check_encryption_pub_if_selected(normalized);
    return normalized;
  }

  private normalize = (type: t.KeyBlockType, armored: string) => {
    let headers = Pgp.armor.headers(type);
    let normalized = Pgp.key.normalize(armored);
    if (!normalized) {
      throw new UserAlert('There was an error processing this key, possibly due to bad formatting.\nPlease insert complete key, including "' + headers.begin + '" and "' + headers.end + '"');
    }
    return normalized;
  }

  private read = (type: t.KeyBlockType, normalized: string) => {
    let headers = Pgp.armor.headers(type);
    let k = openpgp.key.readArmored(normalized).keys[0];
    if (typeof k === 'undefined') {
      throw new UserAlert('Private key is not correctly formated. Please insert complete key, including "' + headers.begin + '" and "' + headers.end + '"');
    }
    return k;
  }

  private longid = (k: OpenPGP.key.Key) => {
    let longid = Pgp.key.longid(k);
    if (!longid) {
      throw new UserAlert('This key may not be compatible. Email human@flowcrypt.com and let us know which software created this key, so we can get it resolved.\n\n(error: cannot get long_id)');
    }
    return longid;
  }

  private reject_if_not = (type: t.KeyBlockType, k: OpenPGP.key.Key) => {
    let headers = Pgp.armor.headers(type);
    if (type === 'private_key' && k.isPublic()) {
      throw new UserAlert('This was a public key. Please insert a private key instead. It\'s a block of text starting with "' + headers.begin + '"');
    }
    if (type === 'public_key' && !k.isPublic()) {
      throw new UserAlert('This was a public key. Please insert a private key instead. It\'s a block of text starting with "' + headers.begin + '"');
    }
  }

  private reject_known_if_selected = async (account_email: string, k: OpenPGP.key.Key) => {
    if(this.reject_known) {
      let keyinfos = await Store.keys_get(account_email);
      let private_keys_long_ids = keyinfos.map(ki => ki.longid);
      if (Value.is(Pgp.key.longid(k)!).in(private_keys_long_ids)) {
        throw new UserAlert('This is one of your current keys, try another one.');
      }
    }
  }

  private reject_if_different_from_selected_longid = (longid: string) => {
    if(this.expected_longid && longid !== this.expected_longid) {
      throw new UserAlert(`Key does not match. Looking for key with KeyWords ${mnemonic(this.expected_longid)} (${this.expected_longid})`);
    }
  }

  private decrypt_and_encrypt_as_needed = async (to_decrypt: OpenPGP.key.Key, to_encrypt: OpenPGP.key.Key, passphrase: string): Promise<void> => {
    if(!passphrase) {
      throw new UserAlert('Please enter a pass phrase to use with this key');
    }
    let decrypt_result;
    try {
      if(to_encrypt.isDecrypted()) {
        await to_encrypt.encrypt(passphrase);
      }
      if(to_decrypt.isDecrypted()) {
        return;
      }
      decrypt_result = await Pgp.key.decrypt(to_decrypt, [passphrase]);
    } catch (e) {
      throw new UserAlert(`This key is not supported by FlowCrypt yet. Please write at human@flowcrypt.com to add support soon. (decrypt error: ${String(e)})`);
    }
    if (!decrypt_result) {
      this.on_bad_passphrase();
      if(this.expected_longid) {
        throw new UserAlert('This is the right key! However, the pass phrase does not match. Please try a different pass phrase. Your original pass phrase might have been different then what you use now.');
      } else {
        throw new UserAlert('The pass phrase does not match. Please try a different pass phrase.');
      }
    }
  }

  private check_encryption_prv_if_selected = async (k: OpenPGP.key.Key, encrypted: OpenPGP.key.Key) => {
    if(this.check_encryption && await k.getEncryptionKey() === null) {
      if (await k.verifyPrimaryKey() === openpgp.enums.keyStatus.no_self_cert || await Pgp.key.usable_but_expired(k)) { // known issues - key can be fixed
        let e = new KeyCanBeFixed('');
        e.encrypted = encrypted;
        throw e;
      } else {
        throw new UserAlert('This looks like a valid key but it cannot be used for encryption. Please write at human@flowcrypt.com to see why is that.');
      }
    }
  }

  private check_encryption_pub_if_selected = async (normalized: string) => {
    if(this.check_encryption && !await Pgp.key.usable(normalized)) {
      throw new UserAlert('This public key looks correctly formatted, but cannot be used for encryption. Please write at human@flowcrypt.com. We\'ll see if there is a way to fix it.');
    }
  }

  private check_signing_if_selected = async (k: OpenPGP.key.Key) => {
    if(this.check_signing && await k.getSigningKey() === null) {
      throw new UserAlert('This looks like a valid key but it cannot be used for signing. Please write at human@flowcrypt.com to see why is that.');
    }
  }
}
