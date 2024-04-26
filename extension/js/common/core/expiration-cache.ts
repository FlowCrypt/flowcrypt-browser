/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { BgNotReadyErr, BrowserMsg } from '../browser/browser-msg.js';
import { storageGet, storageGetAll, storageRemove, storageSet } from '../browser/chrome.js';
import { Env } from '../browser/env.js';
import { Ui } from '../browser/ui.js';

/**
 * Cache, keeping entries for limited duration
 */
type ExpirationCacheType<V> = { value: V; expiration: number };
export class ExpirationCache<V> {
  public constructor(public expirationTicks: number) {}

  public set = async (key: string, value?: V, expiration?: number) => {
    if (Env.isContentScript()) {
      // Get chrome storage data from content script not allowed
      // Need to get data from service worker
      await BrowserMsg.send.bg.await.expirationCacheSet<V>({
        key,
        value,
        expirationTicks: this.expirationTicks,
        expiration,
      });
      return;
    }
    if (value) {
      const expirationVal = { value, expiration: expiration || Date.now() + this.expirationTicks };
      await storageSet('session', { [`${key}`]: expirationVal });
    } else {
      await storageRemove('session', [key]);
    }
  };

  public get = async (key: string): Promise<V | undefined> => {
    if (Env.isContentScript()) {
      // Get chrome storage data from content script not allowed
      // Need to get data from service worker
      // Just disable eslint warning as setting expirationCacheGet interface
      // will require lots of code changes in browser-msg.ts
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return await BrowserMsg.send.bg.await.expirationCacheGet<V>({
        key,
        expirationTicks: this.expirationTicks,
      });
    }
    const result = await storageGet('session', [key]);
    const found = result[key] as ExpirationCacheType<V>;
    if (found) {
      if (found.expiration > Date.now()) {
        return found.value;
      } else {
        // expired, so delete it and return as if not found
        await storageRemove('session', [key]);
      }
    }
    return undefined;
  };

  public deleteExpired = async (additionalPredicate: (key: string, value: V) => boolean = () => false): Promise<void> => {
    if (Env.isContentScript()) {
      // Get chrome storage data from content script not allowed
      // Need to get data from service worker
      for (let i = 0; i < 10; i++) {
        // backend may not be immediately ready to respond - retry
        try {
          await BrowserMsg.send.bg.await.expirationCacheDeleteExpired({
            expirationTicks: this.expirationTicks,
          });
        } catch (e) {
          if (!(e instanceof BgNotReadyErr) || i === 9) {
            throw e;
          }
          await Ui.delay(300);
        }
      }
      throw new BgNotReadyErr('this should never happen');
    }

    const keysToDelete: string[] = [];
    const entries = (await storageGetAll('session')) as Record<string, ExpirationCacheType<V>>;
    for (const key of Object.keys(entries)) {
      const value = entries[key];
      if (value.expiration <= Date.now() || additionalPredicate(key, value.value)) {
        keysToDelete.push(key);
      }
    }
    for (const key of keysToDelete) {
      await this.set(key);
    }
  };

  // await the value if it's a promise and remove from cache in case of exception
  // the value is provided along with the key as parameter to eliminate possibility of a missing (expired) record
  public await = async (key: string, value: V): Promise<V> => {
    try {
      return await value;
    } catch (e) {
      if ((await this.get(key)) === value) await this.set(key); // remove faulty record
      return Promise.reject(e);
    }
  };
}
