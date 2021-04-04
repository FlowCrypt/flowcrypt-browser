/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { AbstractStore } from './store/abstract-store.js';

export class Debug {
  public static readDatabase = async (): Promise<any[] | undefined> => {
    const db = await Debug.openDatabase();
    const records: any[] = [];
    const tx = db.transaction(['messages'], 'readwrite');
    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(undefined);
      tx.onerror = () => reject(AbstractStore.errCategorize(tx.error));
      const messages = tx.objectStore('messages');
      const search = messages.getAll(undefined);
      search.onsuccess = () => {
        records.push(...search.result);
        messages.clear();
      };
    });
    return records;
  }

  public static addMessage = async (message: any): Promise<void> => {
    const db = await Debug.openDatabase();
    const tx = db.transaction(['messages'], 'readwrite');
    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(undefined);
      tx.onerror = () => reject(AbstractStore.errCategorize(tx.error));
      const messages = tx.objectStore('messages');
      messages.add(message);
    });
  }

  private static openDatabase = async (): Promise<IDBDatabase> => {
    const db = await new Promise((resolve, reject) => {
      const openDbReq = indexedDB.open('debug', 1);
      openDbReq.onupgradeneeded = (event) => {
        const db = openDbReq.result;
        if (event.oldVersion < 1) {
          db.createObjectStore('messages', { autoIncrement: true });
        }
      };
      openDbReq.onsuccess = () => resolve(openDbReq.result as IDBDatabase);
      openDbReq.onblocked = () => reject(AbstractStore.errCategorize(openDbReq.error));
      openDbReq.onerror = () => reject(AbstractStore.errCategorize(openDbReq.error));
    });
    return db as IDBDatabase;
  }
}
