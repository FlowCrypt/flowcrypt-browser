/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Key, KeyInfo, KeyUtil } from '../common/core/crypto/key.js';
import { AbstractStore } from '../common/platform/store/abstract-store.js';
import { ContactStore } from '../common/platform/store/contact-store.js';
import { GlobalStore } from '../common/platform/store/global-store.js';
import { KeyStore } from '../common/platform/store/key-store.js';

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

export const moveContactsToEmailsAndPubkeys = async (db: IDBDatabase) => {
  if (db.objectStoreNames.contains('contacts')) {
    console.info('migrating contacts of ContactStore to emails and pubkeys...');
    await new Promise((resolve, reject) => {
      const tx = db.transaction(['contacts'], 'readwrite');
      const contacts = tx.objectStore('contacts');
      const search = contacts.openCursor();
      search.onsuccess = async () => {
        const cursor = search.result as IDBCursorWithValue | undefined;
        if (!cursor) {
          contacts.clear();
        } else {
          const entry = cursor.value as ContactV3; // tslint:disable-line:no-unsafe-any
          const armoredPubkey = (entry.pubkey && typeof entry.pubkey === 'object')
            ? KeyUtil.armor(entry.pubkey as Key) : entry.pubkey as string;
          // parse again to re-calculate expiration-related fields etc.
          const pubkey = armoredPubkey ? await KeyUtil.parse(armoredPubkey) : undefined;
          await ContactStore.update(db, entry.email, {
            email: entry.email,
            name: entry.name,
            pubkey,
            pending_lookup: entry.pending_lookup,
            last_use: entry.last_use,
            pubkey_last_check: entry.pubkey_last_check
          })
          cursor.continue();
        }
      };
      tx.oncomplete = () => resolve(undefined);
      AbstractStore.setReqOnError(tx, reject);
    });
    console.info('done migrating');
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
