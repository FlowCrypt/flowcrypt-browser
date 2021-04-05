/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { AbstractStore } from './store/abstract-store.js';

/**
 * This class stores debug messages in an IndexedDB
 * Db is initialized on demand in `addMessage` or `readDatabase` calls
 * Suggested usage is to log inputs and output of a method called from the browser by
 * substitution of the original method in a draft pull request with a replacement method:
 *
 * fun someMethod(input1, input2) {
 *  const output = someMethodORIGINAL(input1, input2);
 *  Debug.addMessage({ input: {input1, input2}, output }).catch(Catch.reportErr);
 *  return output;
 * }
 *
 * In async methods, the call can be arranged like this:
 * await Debug.addMessage({input, output});
 *
 * Upon test completion, the data can be extracted by the test framework with
 * await page.target.evaluate(() => (window as any).Debug.readDatabase());
 */
export class Debug {
  /**
   * Extracts all the stored messages from the `debug` database, also deleting them
   */
  public static readDatabase = async (): Promise<any[]> => {
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

  /**
  * Add an arbitrary message to `debug` database
  */
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
