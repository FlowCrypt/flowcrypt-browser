/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { AcctStore } from './platform/store/acct-store.js';
import { PassphraseOptions } from '../../chrome/settings/setup.js';
import { Buf } from './core/buf.js';
import { Key, KeyInfoWithIdentity, KeyUtil } from './core/crypto/key.js';
import { ClientConfiguration } from './client-configuration.js';
import { ContactStore } from './platform/store/contact-store.js';
import { KeyStore } from './platform/store/key-store.js';
import { PassphraseStore } from './platform/store/passphrase-store.js';
import { Bm } from './browser/browser-msg.js';
export const isFesUsed = async (acctEmail: string) => {
  const { fesUrl } = await AcctStore.get(acctEmail, ['fesUrl']);
  return Boolean(fesUrl);
};

export const saveKeysAndPassPhrase = async (acctEmail: string, prvs: Key[], ppOptions?: PassphraseOptions) => {
  const clientConfiguration = await ClientConfiguration.newInstance(acctEmail);
  for (const prv of prvs) {
    await KeyStore.add(acctEmail, prv);
    if (ppOptions !== undefined) {
      await PassphraseStore.set((ppOptions.passphrase_save && !clientConfiguration.forbidStoringPassPhrase()) ? 'local' : 'session',
        acctEmail, { longid: KeyUtil.getPrimaryLongid(prv) }, ppOptions.passphrase);
    }
  }
  const { sendAs, full_name: name } = await AcctStore.get(acctEmail, ['sendAs', 'full_name']);
  const myOwnEmailsAddrs: string[] = [acctEmail].concat(Object.keys(sendAs!));
  for (const email of myOwnEmailsAddrs) {
    if (ppOptions !== undefined) {
      // first run, update `name`, todo: refactor in #4545
      await ContactStore.update(undefined, email, { name });
    }
    for (const prv of prvs) {
      await ContactStore.update(undefined, email, { pubkey: KeyUtil.armor(await KeyUtil.asPublicKey(prv)) });
    }
  }
};

const parseAndCheckPrivateKeys = async (decryptedPrivateKeys: string[]) => {
  const unencryptedPrvs: Key[] = [];
  // parse and check that all the keys are valid
  for (const entry of decryptedPrivateKeys) {
    const { keys, errs } = await KeyUtil.readMany(Buf.fromUtfStr(entry));
    if (errs.length) {
      throw new Error(`Some keys could not be parsed`);
    }
    if (!keys.length) {
      throw new Error(`Could not parse any valid keys`);
    }
    for (const prv of keys) {
      if (!prv.isPrivate) {
        throw new Error(`Key ${prv.id} is not a private key`);
      }
      if (!prv.fullyDecrypted) {
        throw new Error(`Key ${prv.id} is not fully decrypted`);
      }
    }
    unencryptedPrvs.push(...keys);
  }
  return { unencryptedPrvs };
};

const filterKeysToSave = async (candidateKeys: Key[], existingKeys: KeyInfoWithIdentity[]) => {
  if (!existingKeys.length) {
    return candidateKeys;
  }
  const result: Key[] = [];
  for (const candidate of candidateKeys) {
    const longid = KeyUtil.getPrimaryLongid(candidate);
    const keyToUpdate = existingKeys.filter(ki => ki.longid === longid && ki.family === candidate.family);
    if (keyToUpdate.length === 1) {
      const oldKey = await KeyUtil.parse(keyToUpdate[0].private);
      if (!candidate.lastModified || (oldKey.lastModified && oldKey.lastModified >= candidate.lastModified)) {
        continue;
      }
    } else if (keyToUpdate.length > 1) {
      throw new Error(`Unexpected error: key search by longid=${longid} yielded ${keyToUpdate.length} results`);
    }
    result.push(candidate);
  }
  return result;
};

export const processAndStoreKeysFromEkmLocally = async (
  { acctEmail, decryptedPrivateKeys, ppOptions }: { acctEmail: string, decryptedPrivateKeys: string[], ppOptions?: PassphraseOptions }
): Promise<Bm.Res.ProcessAndStoreKeysFromEkmLocally> => {
  const { unencryptedPrvs } = await parseAndCheckPrivateKeys(decryptedPrivateKeys);
  const existingKeys = await KeyStore.get(acctEmail);
  let passphrase = ppOptions?.passphrase;
  if (passphrase === undefined && !existingKeys.length) {
    return { needPassphrase: false, updateCount: 0 }; // return success as we can't possibly validate a passphrase
    // this can only happen on misconfiguration
    // todo: or should we throw?
  }
  let unencryptedKeysToSave = await filterKeysToSave(unencryptedPrvs, existingKeys);
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
    // also updates `name`, todo: refactor in #4545
    await saveKeysAndPassPhrase(acctEmail, encryptedKeys, ppOptions);
    return { needPassphrase: false, updateCount: encryptedKeys.length };
  } else {
    return { needPassphrase: unencryptedKeysToSave.length > 0, updateCount: 0 };
  }
};
