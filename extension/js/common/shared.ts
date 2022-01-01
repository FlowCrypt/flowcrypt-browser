/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { KeyUtil, PubkeyInfo } from './core/crypto/key.js';
import { AcctStore } from './platform/store/acct-store.js';
import { ContactStore } from './platform/store/contact-store.js';

/**
 * Save fetched keys if they are newer versions of public keys we already have (compared by fingerprint)
 */
export const compareAndSavePubkeysToStorage = async (email: string, fetchedPubkeys: string[], storedPubkeys: PubkeyInfo[]): Promise<boolean> => {
  let updated = false;
  for (const fetched of await Promise.all(fetchedPubkeys.map(KeyUtil.parse))) {
    const stored = storedPubkeys.find(p => KeyUtil.identityEquals(p.pubkey, fetched))?.pubkey;
    if (!stored || KeyUtil.isFetchedNewer({ fetched, stored })) {
      await ContactStore.update(undefined, email, { pubkey: fetched, pubkeyLastCheck: Date.now() });
      updated = true;
    }
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
  return await compareAndSavePubkeysToStorage(email, pubkeys, storedContact?.sortedPubkeys ?? []);
};

export const isFesUsed = async (acctEmail: string) => {
  const { fesUrl } = await AcctStore.get(acctEmail, ['fesUrl']);
  return Boolean(fesUrl);
};
