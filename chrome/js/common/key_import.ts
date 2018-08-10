
class KeyCanBeFixed extends Error {
  encrypted: OpenPGP.key.Key;
}

class UserAlert extends Error {}

class KeyImportUI {

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

  check_prv = async (account_email: string, armored: string, passphrase: string): Promise<KeyImportUiCheckResult> => {
    let normalized = this.normalize('private_key', armored);
    let decryptable = this.read('private_key', normalized);
    let original = this.read('private_key', normalized);
    let longid = this.longid(decryptable);
    this.reject_if_not('private_key', decryptable);
    await this.reject_known_if_selected(account_email, decryptable);
    this.reject_if_different_from_selected_longid(longid);
    await this.decrypt(decryptable, passphrase);
    await this.check_encryption_prv_if_selected(decryptable, original);
    await this.check_signing_if_selected(decryptable);
    return {normalized, longid, passphrase, fingerprint: tool.crypto.key.fingerprint(decryptable)!, decrypted: decryptable, encrypted: original}; // will have fp if had longid
  }

  check_pub = async (armored: string): Promise<string> => {
    let normalized = this.normalize('public_key', armored);
    let parsed = this.read('public_key', normalized);
    let longid = this.longid(parsed);
    await this.check_encryption_pub_if_selected(normalized);
    return normalized;
  }

  private normalize = (type: KeyBlockType, armored: string) => {
    let headers = tool.crypto.armor.headers(type);
    let normalized = tool.crypto.key.normalize(armored);
    if (!normalized) {
      throw new UserAlert('There was an error processing this key, possibly due to bad formatting.\nPlease insert complete key, including "' + headers.begin + '" and "' + headers.end + '"');
    }
    return normalized;
  }

  private read = (type: KeyBlockType, normalized: string) => {
    let headers = tool.crypto.armor.headers(type);
    let k = openpgp.key.readArmored(normalized).keys[0];
    if (typeof k === 'undefined') {
      throw new UserAlert('Private key is not correctly formated. Please insert complete key, including "' + headers.begin + '" and "' + headers.end + '"');
    }
    return k;
  }

  private longid = (k: OpenPGP.key.Key) => {
    let longid = tool.crypto.key.longid(k);
    if (!longid) {
      throw new UserAlert('This key may not be compatible. Email human@flowcrypt.com and let us know which software created this key, so we can get it resolved.\n\n(error: cannot get long_id)');
    }
    return longid;
  }

  private reject_if_not = (type: KeyBlockType, k: OpenPGP.key.Key) => {
    let headers = tool.crypto.armor.headers(type);
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
      if (tool.value(tool.crypto.key.longid(k)!).in(private_keys_long_ids)) {
        throw new UserAlert('This is one of your current keys, try another one.');
      }
    }
  }

  private reject_if_different_from_selected_longid = (longid: string) => {
    if(this.expected_longid && longid !== this.expected_longid) {
      throw new UserAlert(`Key does not match. Looking for key with KeyWords ${mnemonic(this.expected_longid)} (${this.expected_longid})`);
    }
  }

  private decrypt = async (k: OpenPGP.key.Key, passphrase: string) => {
    let decrypt_result;
    try {
      decrypt_result = await tool.crypto.key.decrypt(k, [passphrase]);
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
      if (await k.verifyPrimaryKey() === openpgp.enums.keyStatus.no_self_cert || await tool.crypto.key.usable_but_expired(k)) { // known issues - key can be fixed
        let e = new KeyCanBeFixed('');
        e.encrypted = encrypted;
        throw e;
      } else {
        throw new UserAlert('This looks like a valid key but it cannot be used for encryption. Please write at human@flowcrypt.com to see why is that.');
      }
    }
  }

  private check_encryption_pub_if_selected = async (normalized: string) => {
    if(this.check_encryption && !await tool.crypto.key.usable(normalized)) {
      throw new UserAlert('This public key looks correctly formatted, but cannot be used for encryption. Please write at human@flowcrypt.com. We\'ll see if there is a way to fix it.');
    }
  }

  private check_signing_if_selected = async (k: OpenPGP.key.Key) => {
    if(this.check_signing && await k.getSigningKey() === null) {
      throw new UserAlert('This looks like a valid key but it cannot be used for signing. Please write at human@flowcrypt.com to see why is that.');
    }
  }
}
