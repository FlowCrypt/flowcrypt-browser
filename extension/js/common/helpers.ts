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
  { acctEmail, privateKeys, options }: { acctEmail: string, privateKeys: { decryptedPrivateKey: string }[], options?: PassphraseOptions }
) => {
  const { keys } = await KeyUtil.readMany(Buf.fromUtfStr(privateKeys.map(pk => pk.decryptedPrivateKey).join('\n')));
  if (!keys.length) {
    throw new Error(`Could not parse any valid keys from Key Manager response for user ${acctEmail}`);
  }
  const existingKeys = await KeyStore.get(acctEmail);
  const keysToSave: Key[] = [];
  for (const prv of keys) {
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
      const keyToUpdate = existingKeys.filter(ki => ki.longid === longid);
      if (keyToUpdate.length !== 1) {
        throw new Error('Not supported yet.');
      }
      const oldKey = await KeyUtil.parse(keyToUpdate[0].private);
      if (!oldKey.lastModified || !prv.lastModified || oldKey.lastModified === prv.lastModified) {
        continue;
      }
      const passphrase = await PassphraseStore.get(acctEmail, { longid });
      if (passphrase === undefined) {
        throw new Error('Not supported yet.');
      }
      console.log(`passphrase is "${passphrase}"`);
      await KeyUtil.encrypt(prv, passphrase);
    } else {
      await KeyUtil.encrypt(prv, options.passphrase);
    }
    keysToSave.push(prv);
  }
  await saveKeysAndPassPhrase(acctEmail, keysToSave, options);
};
