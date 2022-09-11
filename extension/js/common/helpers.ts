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
import { PgpPwd } from './core/crypto/pgp/pgp-password.js';
export const isFesUsed = async (acctEmail: string) => {
  const { fesUrl } = await AcctStore.get(acctEmail, ['fesUrl']);
  return Boolean(fesUrl);
};

export const saveKeysAndPassPhrase = async (acctEmail: string, prvs: Key[], ppOptions?: PassphraseOptions, replaceKeys: boolean = false) => {
  const clientConfiguration = await ClientConfiguration.newInstance(acctEmail);
  if (replaceKeys) {
    // track longids to remove related passhprases
    const existingKeys = await KeyStore.get(acctEmail);
    const deletedKeys = existingKeys.filter(old => !prvs.some(prvIdentity => KeyUtil.identityEquals(prvIdentity, old)));
    // set actually replaces the set of keys in storage with the new set
    await KeyStore.set(acctEmail, await Promise.all(prvs.map(KeyUtil.keyInfoObj))); // todo: duplicate identities
    await PassphraseStore.removeMany(acctEmail, deletedKeys);
  }
  for (const prv of prvs) {
    if (!replaceKeys) {
      await KeyStore.add(acctEmail, prv);
    }
    if (ppOptions !== undefined) {
      // todo: perhaps it's easier just to store a set of passphrases without specifying longids?
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
  // todo: check for uniqueness of candidateKeys identities here?
  if (!existingKeys.length) {
    return { keysToRetain: [], unencryptedKeysToSave: candidateKeys };
  }
  const keysToRetain: Key[] = [];
  const unencryptedKeysToSave: Key[] = [];
  for (const candidateKey of candidateKeys) {
    const existingKey = existingKeys.find(ki => KeyUtil.identityEquals(ki, candidateKey));
    if (existingKey) {
      const parsedExistingKey = await KeyUtil.parse(existingKey.private);
      if (!candidateKey.lastModified || (parsedExistingKey.lastModified && parsedExistingKey.lastModified >= candidateKey.lastModified)) {
        keysToRetain.push(parsedExistingKey);
        continue;
      }
    }
    unencryptedKeysToSave.push(candidateKey);
  }
  return { keysToRetain, unencryptedKeysToSave };
};

export const processAndStoreKeysFromEkmLocally = async (
  { acctEmail, decryptedPrivateKeys, ppOptions: originalOptions }: Bm.ProcessAndStoreKeysFromEkmLocally & { ppOptions?: PassphraseOptions }
): Promise<Bm.Res.ProcessAndStoreKeysFromEkmLocally> => {
  const { unencryptedPrvs } = await parseAndCheckPrivateKeys(decryptedPrivateKeys);
  const existingKeys = await KeyStore.get(acctEmail);
  let { keysToRetain, unencryptedKeysToSave } = await filterKeysToSave(unencryptedPrvs, existingKeys);
  if (!unencryptedKeysToSave.length && keysToRetain.length === existingKeys.length) {
    // nothing to update
    return { needPassphrase: false, noKeysSetup: !existingKeys.length };
  }
  let ppOptions: PassphraseOptions | undefined; // the options to pass to saveKeysAndPassPhrase
  if (!originalOptions?.passphrase && (await ClientConfiguration.newInstance(acctEmail)).mustAutogenPassPhraseQuietly()) {
    ppOptions = { passphrase: PgpPwd.random(), passphrase_save: true };
  } else {
    ppOptions = originalOptions;
  }
  let passphrase = ppOptions?.passphrase;
  if (passphrase === undefined && !existingKeys.length) {
    return { needPassphrase: true, noKeysSetup: true };
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
      await Promise.all(unencryptedKeysToSave.map(prv => KeyUtil.encrypt(prv, pp)));
      encryptedKeys = unencryptedKeysToSave;
      unencryptedKeysToSave = [];
    }
  }
  if (encryptedKeys.length || !unencryptedKeysToSave.length) {
    // also updates `name`, todo: refactor in #4545
    const newKeyset = keysToRetain.concat(encryptedKeys);
    await saveKeysAndPassPhrase(acctEmail, newKeyset, ppOptions, true);
    return { updateCount: encryptedKeys.length + (existingKeys.length - keysToRetain.length), noKeysSetup: !newKeyset.length };
  } else {
    // todo: should we delete?
    return { needPassphrase: unencryptedKeysToSave.length > 0 };
  }
};
