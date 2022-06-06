/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { SetupOptions } from '../../chrome/settings/setup.js';
import { Buf } from './core/buf.js';
import { EmailParts } from './core/common.js';
import { Key, KeyUtil, PubkeyInfo } from './core/crypto/key.js';
import { OrgRules } from './org-rules.js';
import { AcctStore } from './platform/store/acct-store.js';
import { ContactStore } from './platform/store/contact-store.js';
import { KeyStore } from './platform/store/key-store.js';
import { PassphraseStore } from './platform/store/passphrase-store.js';

/**
 * Save fetched keys if they are newer versions of public keys we already have (compared by fingerprint)
 */
export const compareAndSavePubkeysToStorage = async ({ email, name }: EmailParts, fetchedPubkeys: string[], storedPubkeys: PubkeyInfo[]): Promise<boolean> => {
  let updated = false;
  for (const fetched of await Promise.all(fetchedPubkeys.map(KeyUtil.parse))) {
    const stored = storedPubkeys.find(p => KeyUtil.identityEquals(p.pubkey, fetched))?.pubkey;
    if (!stored || KeyUtil.isFetchedNewer({ fetched, stored })) {
      await ContactStore.update(undefined, email, { pubkey: fetched, pubkeyLastCheck: Date.now(), name });
      updated = true;
    }
  }
  if (!updated && name) {
    await ContactStore.update(undefined, email, { name });
  }
  return updated;
};

/**
 * Save fetched keys if they are newer versions of public keys we already have (compared by fingerprint)
 */
export const saveFetchedPubkeysIfNewerThanInStorage = async ({ email, pubkeys }: { email: string, pubkeys: string[] }): Promise<boolean> => {
  if (!pubkeys.length) {
    return false;
  }
  const storedContact = await ContactStore.getOneWithAllPubkeys(undefined, email);
  return await compareAndSavePubkeysToStorage({ email }, pubkeys, storedContact?.sortedPubkeys ?? []);
};

// todo: where to take acctEmail and orgRules
export const saveKeysAndPassPhrase = async (acctEmail: string, prvs: Key[], options: SetupOptions) => {
  for (const prv of prvs) {
    await KeyStore.add(acctEmail, prv);
    const orgRules = await OrgRules.newInstance(acctEmail);
    await PassphraseStore.set((options.passphrase_save && !orgRules.forbidStoringPassPhrase()) ? 'local' : 'session',
      acctEmail, { longid: KeyUtil.getPrimaryLongid(prv) }, options.passphrase);
  }
  const { sendAs } = await AcctStore.get(acctEmail, ['sendAs']);
  const myOwnEmailsAddrs: string[] = [acctEmail].concat(Object.keys(sendAs!));
  const { full_name: name } = await AcctStore.get(acctEmail, ['full_name']);
  for (const email of myOwnEmailsAddrs) {
    await ContactStore.update(undefined, email, { name, pubkey: KeyUtil.armor(await KeyUtil.asPublicKey(prvs[0])) });
  }
};

// todo: where to take acctEmail?
export const processAndStoreKeysFromEkmLocally = async (acctEmail: string, privateKeys: { decryptedPrivateKey: string }[], setupOptions: SetupOptions) => {
  const { keys } = await KeyUtil.readMany(Buf.fromUtfStr(privateKeys.map(pk => pk.decryptedPrivateKey).join('\n')));
  if (!keys.length) {
    throw new Error(`Could not parse any valid keys from Key Manager response for user ${acctEmail}`);
  }
  for (const prv of keys) {
    if (!prv.isPrivate) {
      throw new Error(`Key ${prv.id} for user ${acctEmail} is not a private key`);
    }
    if (!prv.fullyDecrypted) {
      throw new Error(`Key ${prv.id} for user ${acctEmail} from FlowCrypt Email Key Manager is not fully decrypted`);
    }
    await KeyUtil.encrypt(prv, setupOptions.passphrase);
  }
  await saveKeysAndPassPhrase(acctEmail, keys, setupOptions);
};
