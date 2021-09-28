/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { AbstractStore } from './abstract-store.js';
import { BrowserMsg } from '../../browser/browser-msg.js';

/**
 * Temporrary In-Memory store for sensitive values, expiring after 4 hours
 * see background_page.ts for the other end, also ExpirationCache class
 */
export class InMemoryStore extends AbstractStore {

  public static set = async (acctEmail: string, key: string, value: string | undefined) => {
    return await BrowserMsg.send.bg.await.inMemoryStoreSet({ acctEmail, key, value });
  }

  public static get = async (acctEmail: string, key: string): Promise<string | undefined> => {
    return await BrowserMsg.send.bg.await.inMemoryStoreGet({ acctEmail, key }) ?? undefined;
  }

}
