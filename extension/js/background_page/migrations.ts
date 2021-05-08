/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { KeyInfo, KeyUtil } from '../common/core/crypto/key.js';
import { SmimeKey } from '../common/core/crypto/smime/smime-key.js';
import { ContactStore, ContactUpdate, Email, Pubkey } from '../common/platform/store/contact-store.js';
import { GlobalStore } from '../common/platform/store/global-store.js';
import { KeyStore } from '../common/platform/store/key-store.js';

// contact entity prior to version 4
type ContactV3 = {
  email: string;
  name: string | null;
  pubkey: { rawArmored: string, raw: string } | string | null;
  has_pgp: 0 | 1;
  fingerprint: string | null;
  last_use: number | null;
  pubkey_last_check: number | null;
  expiresOn: number | null;
};

type PubkeyMigrationData = {
  emailsToUpdate: { [email: string]: Email };
  pubkeysToDelete: string[];
  pubkeysToSave: Pubkey[];
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

const processSmimeKey = (pubkey: Pubkey, tx: IDBTransaction, data: PubkeyMigrationData, next: () => void) => {
  if (KeyUtil.getKeyType(pubkey.armoredKey) !== 'x509') {
    next();
    return;
  }
  const key = SmimeKey.parse(pubkey.armoredKey);
  const newPubkeyEntity = ContactStore.pubkeyObj(key, pubkey.lastCheck);
  data.pubkeysToDelete.push(pubkey.fingerprint);
  const req = tx.objectStore('emails').index('index_fingerprints').getAll(pubkey.fingerprint!);
  ContactStore.setReqPipe(req,
    (emailEntities: Email[]) => {
      if (emailEntities.length) {
        data.pubkeysToSave.push(newPubkeyEntity);
      }
      for (const emailEntity of emailEntities) {
        const cachedEmail = data.emailsToUpdate[emailEntity.email];
        if (!cachedEmail) {
          data.emailsToUpdate[emailEntity.email] = emailEntity;
        }
        const entityToUpdate = cachedEmail ?? emailEntity;
        entityToUpdate.fingerprints = entityToUpdate.fingerprints.filter(fp => fp !== pubkey.fingerprint && fp !== newPubkeyEntity.fingerprint);
        entityToUpdate.fingerprints.push(newPubkeyEntity.fingerprint);
      }
      next();
    });
};

export const updateX509FingerprintsAndLongids = async (db: IDBDatabase): Promise<void> => {
  const globalStore = await GlobalStore.get(['contact_store_x509_fingerprints_and_longids_updated']);
  if (globalStore.contact_store_x509_fingerprints_and_longids_updated) {
    return;
  }
  console.info('updating ContactStorage to correct longids and fingerprints of X.509 certificates...');
  const tx = db.transaction(['emails', 'pubkeys'], 'readwrite');
  await new Promise((resolve, reject) => {
    ContactStore.setTxHandlers(tx, resolve, reject);
    const data: PubkeyMigrationData = { emailsToUpdate: {}, pubkeysToDelete: [], pubkeysToSave: [] };
    const search = tx.objectStore('pubkeys').openCursor();
    ContactStore.setReqPipe(search,
      (cursor: IDBCursorWithValue) => {
        if (!cursor) {
          // do updates
          for (const fp of data.pubkeysToDelete.filter(fp => !data.pubkeysToSave.some(x => x.fingerprint === fp))) {
            // console.log(`Deleting pubkey ${fp}`);
            tx.objectStore('pubkeys').delete(fp);
          }
          for (const pubkey of data.pubkeysToSave) {
            // console.log(`Updating pubkey ${pubkey.fingerprint}`);
            tx.objectStore('pubkeys').put(pubkey);
          }
          for (const email of Object.values(data.emailsToUpdate)) {
            // console.log(`Updating email ${email.email}`);
            tx.objectStore('emails').put(email);
          }
        } else {
          processSmimeKey(cursor.value as Pubkey, tx, data, () => cursor.continue());
        }
      });
  });
  await GlobalStore.set({ contact_store_x509_fingerprints_and_longids_updated: true });
  console.info('done updating');
};

export const moveContactsToEmailsAndPubkeys = async (db: IDBDatabase): Promise<void> => {
  if (!db.objectStoreNames.contains('contacts')) {
    return;
  }
  console.info('migrating contacts of ContactStore to emails and pubkeys...');
  const batchSize = 50;
  try {
    while (await moveContactsBatchToEmailsAndPubkeys(db, batchSize)) {
      console.info('proceeding to the next batch');
    }
    console.info('migrating contacts of ContactStore is complete');
  } catch (e) {
    console.error(`Error happened when converting contacts: ${e instanceof Error ? e.message : String(e)}`);
  }
};

const moveContactsBatchToEmailsAndPubkeys = async (db: IDBDatabase, count?: number | undefined): Promise<number> => {
  const entries: ContactV3[] = [];
  {
    const tx = db.transaction(['contacts'], 'readonly');
    await new Promise((resolve, reject) => {
      ContactStore.setTxHandlers(tx, resolve, reject);
      const contacts = tx.objectStore('contacts');
      const search = contacts.getAll(undefined, count);
      ContactStore.setReqPipe(search, (result: ContactV3[]) => {
        entries.push(...result);
      });
    });
    if (!entries.length) {
      return 0;
    }
  }
  console.info(`Processing a batch of ${entries.length}.`);
  // transform
  const converted = await Promise.all(entries.map(async (entry) => {
    const armoredPubkey = (entry.pubkey && typeof entry.pubkey === 'object')
      ? (entry.pubkey.rawArmored ?? entry.pubkey.raw) : entry.pubkey as string;
    // parse again to re-calculate expiration-related fields etc.
    const pubkey = armoredPubkey ? await KeyUtil.parse(armoredPubkey) : undefined;
    return {
      email: entry.email,
      update: {
        name: entry.name,
        pubkey,
        lastUse: entry.last_use,
        pubkeyLastCheck: pubkey ? entry.pubkey_last_check : undefined
      } as ContactUpdate
    };
  }));
  {
    const tx = db.transaction(['contacts', 'emails', 'pubkeys'], 'readwrite');
    await new Promise((resolve, reject) => {
      ContactStore.setTxHandlers(tx, resolve, reject);
      for (const item of converted) {
        ContactStore.updateTx(tx, item.email, item.update);
        tx.objectStore('contacts').delete(item.email);
      }
    });
  }
  return converted.length;
};
