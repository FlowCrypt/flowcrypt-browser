/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Key, KeyInfo, KeyUtil } from '../common/core/crypto/key.js';
import { ContactStore, ContactUpdate } from '../common/platform/store/contact-store.js';
import { GlobalStore } from '../common/platform/store/global-store.js';
import { KeyStore } from '../common/platform/store/key-store.js';

// contact entity prior to version 4
type ContactV3 = {
  email: string;
  name: string | null;
  pubkey: Key | string | null;
  has_pgp: 0 | 1;
  fingerprint: string | null;
  pending_lookup: number;
  last_use: number | null;
  pubkey_last_sig: number | null;
  pubkey_last_check: number | null;
  expiresOn: number | null;
};

const addKeyInfoFingerprints = async () => {
  for (const acctEmail of await GlobalStore.acctEmailsGet()) {
    const originalKis = await KeyStore.get(acctEmail);
    const updated: KeyInfo[] = [];
    for (const originalKi of originalKis) {
      updated.push(await KeyUtil.keyInfoObj(await KeyUtil.parse(originalKi.private)));
    }
    await KeyStore.set(acctEmail, updated);
  }
};

export const migrateGlobal = async () => {
  const globalStore = await GlobalStore.get(['key_info_store_fingerprints_added']);
  if (!globalStore.key_info_store_fingerprints_added) {
    console.info('migrating KeyStorage to add fingerprints and emails of each key...');
    await addKeyInfoFingerprints();
    await GlobalStore.set({ key_info_store_fingerprints_added: true });
    console.info('done migrating');
  }
};

export const moveContactsToEmailsAndPubkeys = async (db: IDBDatabase): Promise<number> => {
  if (!db.objectStoreNames.contains('contacts')) {
    return 0;
  }
  const entries: ContactV3[] = [];
  await new Promise((resolve, reject) => {
    const tx = db.transaction(['contacts'], 'readonly');
    ContactStore.setTxHandlers(tx, resolve, reject);
    console.info('migrating contacts of ContactStore to emails and pubkeys...');
    const contacts = tx.objectStore('contacts');
    const search = contacts.openCursor(); // todo: simplify with getAll()
    search.onsuccess = () => {
      const cursor = search.result as IDBCursorWithValue | undefined;
      if (cursor) {
        entries.push(cursor.value as ContactV3); // tslint:disable-line:no-unsafe-any
        cursor.continue();
      }
    };
  });
  console.info(`${entries.length} entries found.`);
  if (!entries.length) {
    return 0;
  }
  // transform
  const updates = await Promise.all(entries.map(async (entry) => {
    const armoredPubkey = (entry.pubkey && typeof entry.pubkey === 'object')
      ? KeyUtil.armor(entry.pubkey as Key) : entry.pubkey as string;
    // parse again to re-calculate expiration-related fields etc.
    const pubkey = armoredPubkey ? await KeyUtil.parse(armoredPubkey) : undefined;
    return {
      email: entry.email,
      name: entry.name,
      pubkey,
      pending_lookup: entry.pending_lookup,
      last_use: entry.last_use,
      pubkey_last_check: pubkey ? entry.pubkey_last_check : undefined
    } as ContactUpdate;
  }));
  console.info(`transformation complete, saving...`);
  // todo: split to batches
  await new Promise((resolve, reject) => {
    const tx = db.transaction(['contacts', 'emails', 'pubkeys'], 'readwrite');
    ContactStore.setTxHandlers(tx, resolve, reject);
    for (const update of updates) {
      ContactStore.updateTx(tx, update.email!, update);
      tx.objectStore('contacts').delete(update.email!);
    }
  });
  console.info(`contacts migration finished`);
  return updates.length;
}
