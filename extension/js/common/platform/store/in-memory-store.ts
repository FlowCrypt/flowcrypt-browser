/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { AbstractStore } from './abstract-store.js';
import { Time } from '../../browser/time.js';
import { BrowserMsg } from '../../browser/browser-msg.js';

/**
 * Temporary In-Memory store for sensitive values, expiring after clientConfiguration.in_memory_pass_phrase_session_length (or default 4 hours)
 * see background_page.ts for the other end, also ExpirationCache class
 */
export class InMemoryStore extends AbstractStore {
  public static async set(acctEmail: string, key: string, value?: string, expiration?: number) {
    return await BrowserMsg.send.bg.await.inMemoryStoreSet({ acctEmail, key, value, expiration });
  }

  public static async get(acctEmail: string, key: string): Promise<string | undefined> {
    return (await BrowserMsg.send.bg.await.inMemoryStoreGet({ acctEmail, key })) ?? undefined;
  }

  public static async getUntilAvailable(acctEmail: string, key: string, retryCount = 20): Promise<string | undefined> {
    for (let i = 0; i < retryCount; i++) {
      const value = await InMemoryStore.get(acctEmail, key);
      if (value) {
        return value;
      }
      await Time.sleep(300);
    }
    return undefined;
  }
}
