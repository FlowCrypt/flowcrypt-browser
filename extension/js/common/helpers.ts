/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { AcctStore } from './platform/store/acct-store.js';
import { PassphraseOptions } from '../../chrome/settings/setup.js';
import { Buf } from './core/buf.js';
import { Key, KeyUtil } from './core/crypto/key.js';
import { ClientConfiguration } from './client-configuration.js';
import { ContactStore } from './platform/store/contact-store.js';
import { KeyStore } from './platform/store/key-store.js';
import { PassphraseStore } from './platform/store/passphrase-store.js';
import { Bm } from './browser/browser-msg.js';
export const isFesUsed = async (acctEmail: string) => {
  const { fesUrl } = await AcctStore.get(acctEmail, ['fesUrl']);
  return Boolean(fesUrl);
};

// todo: where to take acctEmail and clientConfiguration
export const saveKeysAndPassPhrase = async (acctEmail: string, prvs: Key[], options?: PassphraseOptions) => {
  for (const prv of prvs) {
    await KeyStore.add(acctEmail, prv);
    if (options !== undefined) {
      const clientConfiguration = await ClientConfiguration.newInstance(acctEmail);
      await PassphraseStore.set((options.passphrase_save && !clientConfiguration.forbidStoringPassPhrase()) ? 'local' : 'session',
        acctEmail, { longid: KeyUtil.getPrimaryLongid(prv) }, options.passphrase);
    }
  }
  const { sendAs, full_name: name } = await AcctStore.get(acctEmail, ['sendAs', 'full_name']);
  const myOwnEmailsAddrs: string[] = [acctEmail].concat(Object.keys(sendAs!));
  for (const email of myOwnEmailsAddrs) {
    if (options !== undefined) {
      // first run, update name
      // todo: refactor?
      await ContactStore.update(undefined, email, { name });
    }
    for (const prv of prvs) {
      await ContactStore.update(undefined, email, { pubkey: KeyUtil.armor(await KeyUtil.asPublicKey(prv)) });
    }
  }
};

export const processAndStoreKeysFromEkmLocally = async (
  { acctEmail, decryptedPrivateKeys, options }: { acctEmail: string, decryptedPrivateKeys: string[], options?: PassphraseOptions }
): Promise<Bm.Res.ProcessKeysFromEkm> => {
  const { keys } = await KeyUtil.readMany(Buf.fromUtfStr(decryptedPrivateKeys.join('\n')));
  if (!keys.length) {
    throw new Error(`Could not parse any valid keys from Key Manager response for user ${acctEmail}`);
  }
  let unencryptedKeysToSave: Key[] = [];
  const existingKeys = await KeyStore.get(acctEmail);
  let passphrase = options?.passphrase;
  if (passphrase === undefined && !existingKeys.length) {
    return { unencryptedKeysToSave: [], updateCount: 0 }; // return success as we can't possibly validate a passphrase
    // this can only happen on misconfiguration
    // todo: or should we throw?
  }
  for (const prv of keys) {
    // todo: should we still process remaining correct keys?
    if (!prv.isPrivate) {
      throw new Error(`Key ${prv.id} for user ${acctEmail} is not a private key`);
    }
    if (!prv.fullyDecrypted) {
      throw new Error(`Key ${prv.id} for user ${acctEmail} from FlowCrypt Email Key Manager is not fully decrypted`);
    }
    if (options === undefined) {
      // updating here
      // todo: refactor?
      const longid = KeyUtil.getPrimaryLongid(prv);
      const keyToUpdate = existingKeys.filter(ki => ki.longid === longid && ki.family === prv.family);
      if (keyToUpdate.length === 1) {
        const oldKey = await KeyUtil.parse(keyToUpdate[0].private);
        if (!oldKey.lastModified || !prv.lastModified || oldKey.lastModified >= prv.lastModified) {
          continue;
        }
      } else if (keyToUpdate.length > 1) {
        throw new Error(`Unexpected error: key search by longid=${longid} yielded ${keyToUpdate.length} results`);
      }
    }
    unencryptedKeysToSave.push(prv);
  }
  let encryptedKeys: Key[] = [];
  if (unencryptedKeysToSave.length) {
    if (passphrase === undefined) {
      // trying to find a passphrase that unlocks at least one key
      const passphrases = await PassphraseStore.getMany(acctEmail, existingKeys);
      passphrase = passphrases.find(pp => pp !== undefined);
    }
    if (passphrase !== undefined) {
      const pp = passphrase;
      // todo: some more fancy conversion, preserving a passphrase for a particual longid?
      await Promise.all(unencryptedKeysToSave.map(prv => KeyUtil.encrypt(prv, pp)));
      encryptedKeys = unencryptedKeysToSave;
      unencryptedKeysToSave = [];
    }
  }
  if (encryptedKeys.length) {
    // also updates `name`, todo: refactor?
    await saveKeysAndPassPhrase(acctEmail, encryptedKeys, options);
    return { unencryptedKeysToSave: [], updateCount: encryptedKeys.length };
  } else {
    return { unencryptedKeysToSave: unencryptedKeysToSave.map(KeyUtil.armor), updateCount: 0 };
  }
};
