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

export const setPassphraseForPrvs = async (
  clientConfiguration: ClientConfiguration,
  acctEmail: string,
  prvs: Key[],
  ppOptions: PassphraseOptions
) => {
  const storageType = ppOptions.passphrase_save && !clientConfiguration.forbidStoringPassPhrase() ? 'local' : 'session';
  for (const prv of prvs) {
    await PassphraseStore.set(storageType, acctEmail, { longid: KeyUtil.getPrimaryLongid(prv) }, ppOptions.passphrase);
  }
};

// note: for `replaceKeys = true` need to make sure that `prvs` don't have duplicate identities,
// they is currently guaranteed by filterKeysToSave()
// todo: perhaps split into two different functions for add or replace as part of #4545?
const addOrReplaceKeysAndPassPhrase = async (
  acctEmail: string,
  prvs: Key[],
  ppOptions?: PassphraseOptions,
  replaceKeys = false
) => {
  if (replaceKeys) {
    // track longids to remove related passhprases
    const existingKeys = await KeyStore.get(acctEmail);
    const deletedKeys = existingKeys.filter(old => !prvs.some(prvIdentity => KeyUtil.identityEquals(prvIdentity, old)));
    // set actually replaces the set of keys in storage with the new set
    await KeyStore.set(acctEmail, await Promise.all(prvs.map(KeyUtil.keyInfoObj)));
    await PassphraseStore.removeMany(acctEmail, deletedKeys);
  } else {
    for (const prv of prvs) {
      await KeyStore.add(acctEmail, prv);
    }
  }
  if (ppOptions !== undefined) {
    // todo: it would be good to check that the passphrase isn't present in the other storage type
    //    though this situation is not possible with current use cases
    await setPassphraseForPrvs(await ClientConfiguration.newInstance(acctEmail), acctEmail, prvs, ppOptions);
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

export const saveKeysAndPassPhrase: (acctEmail: string, prvs: Key[], ppOptions?: PassphraseOptions) => Promise<void> =
  addOrReplaceKeysAndPassPhrase;

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
    return { keysToRetain: [], newUnencryptedKeysToSave: candidateKeys };
  }
  const keysToRetain: Key[] = [];
  const newUnencryptedKeysToSave: Key[] = [];
  for (const candidateKey of candidateKeys) {
    const existingKey = existingKeys.find(ki => KeyUtil.identityEquals(ki, candidateKey));
    if (existingKey) {
      const parsedExistingKey = await KeyUtil.parse(existingKey.private);
      if (
        !candidateKey.lastModified ||
        (parsedExistingKey.lastModified && parsedExistingKey.lastModified >= candidateKey.lastModified)
      ) {
        keysToRetain.push(parsedExistingKey);
        continue;
      }
    }
    newUnencryptedKeysToSave.push(candidateKey);
  }
  return { keysToRetain, newUnencryptedKeysToSave };
};

export const processAndStoreKeysFromEkmLocally = async ({
  acctEmail,
  decryptedPrivateKeys,
  ppOptions: originalOptions
}: Bm.ProcessAndStoreKeysFromEkmLocally & {
  ppOptions?: PassphraseOptions;
}): Promise<Bm.Res.ProcessAndStoreKeysFromEkmLocally> => {
  const { unencryptedPrvs } = await parseAndCheckPrivateKeys(decryptedPrivateKeys);
  const existingKeys = await KeyStore.get(acctEmail);
  let { keysToRetain, newUnencryptedKeysToSave } = await filterKeysToSave(unencryptedPrvs, existingKeys);
  if (!newUnencryptedKeysToSave.length && keysToRetain.length === existingKeys.length) {
    // nothing to update
    return { needPassphrase: false, noKeysSetup: !existingKeys.length };
  }
  let ppOptions: PassphraseOptions | undefined; // the options to pass to saveKeysAndPassPhrase
  if (
    !originalOptions?.passphrase &&
    (await ClientConfiguration.newInstance(acctEmail)).mustAutogenPassPhraseQuietly()
  ) {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    ppOptions = { passphrase: PgpPwd.random(), passphrase_save: true };
  } else {
    ppOptions = originalOptions;
  }
  let passphrase = ppOptions?.passphrase;
  let passphraseInLocalStorage = !!ppOptions?.passphrase_save;
  if (passphrase === undefined && !existingKeys.length) {
    return { needPassphrase: true, noKeysSetup: true };
  }
  let encryptedKeys: { passphrase: string; keys: Key[] } | undefined;
  if (newUnencryptedKeysToSave.length) {
    if (passphrase === undefined) {
      // trying to find a passphrase that unlocks at least one key
      const passphrases = await PassphraseStore.getMany(acctEmail, existingKeys);
      const foundPassphrase = passphrases.find(pp => pp !== undefined);
      if (foundPassphrase) {
        passphrase = foundPassphrase.value;
        passphraseInLocalStorage = foundPassphrase.source === 'local';
      }
    }
    if (passphrase !== undefined) {
      const pp = passphrase; // explicitly defined constant string for the mapping function
      await Promise.all(newUnencryptedKeysToSave.map(prv => KeyUtil.encrypt(prv, pp)));
      encryptedKeys = { keys: newUnencryptedKeysToSave, passphrase };
      newUnencryptedKeysToSave = [];
    }
  }
  if (newUnencryptedKeysToSave.length > 0) {
    return { needPassphrase: true };
  }
  // stage 1. Clear all existingKeys, except for keysToRetain
  if (existingKeys.length !== keysToRetain.length) {
    await addOrReplaceKeysAndPassPhrase(acctEmail, keysToRetain, undefined, true);
  }
  // stage 2. Adding new keys
  if (encryptedKeys?.keys.length) {
    // new keys are about to be added, they must be accompanied with the passphrase setting
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const effectivePpOptions = { passphrase: encryptedKeys.passphrase, passphrase_save: passphraseInLocalStorage };
    // ppOptions have special meaning in saveKeysAndPassPhrase(), they trigger `name` updates, todo: refactor in #4545
    await saveKeysAndPassPhrase(acctEmail, encryptedKeys.keys, ppOptions ? effectivePpOptions : undefined);
    if (!ppOptions) {
      await setPassphraseForPrvs(
        await ClientConfiguration.newInstance(acctEmail),
        acctEmail,
        encryptedKeys.keys,
        effectivePpOptions
      );
    }
  }
  return {
    updateCount: encryptedKeys?.keys.length ?? 0 + (existingKeys.length - keysToRetain.length),
    noKeysSetup: !(encryptedKeys?.keys.length || keysToRetain.length)
  };
};

export const getLocalKeyExpiration = async ({
  acctEmail
}: Bm.GetLocalKeyExpiration): Promise<Bm.Res.GetLocalKeyExpiration> => {
  const kis = await KeyStore.get(acctEmail);
  const expirations = await Promise.all(
    kis.map(async ki => (await KeyUtil.parse(ki.public))?.expiration ?? Number.MAX_SAFE_INTEGER)
  );
  return Math.max(...expirations);
};
