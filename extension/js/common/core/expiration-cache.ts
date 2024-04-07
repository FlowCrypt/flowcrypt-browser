/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { BrowserMsg } from '../browser/browser-msg.js';
import { Env } from '../browser/env.js';

/**
 * Cache, keeping entries for limited duration
 */
type ExpirationCacheType<V> = { value: V; expiration: number };
export class ExpirationCache<V> {
  public constructor(public expirationTicks: number) {}

  public set = async (key: string, value?: V, expiration?: number) => {
    if (Env.isContentScript()) {
      // Get chrome storage data from content script now allowed
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
      await chrome.storage.session.set({ [`${key}`]: expirationVal });
    } else {
      await chrome.storage.session.remove(key);
    }
  };

  public get = async (key: string): Promise<V | undefined> => {
    if (Env.isContentScript()) {
      // Get chrome storage data from content script now allowed
      // Need to get data from service worker
      // Just disable eslint warning as setting expirationCacheGet interface
      // will require lots of code changes in browser-msg.ts
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return await BrowserMsg.send.bg.await.expirationCacheGet<V>({
        key,
        expirationTicks: this.expirationTicks,
      });
    }
    const result = await chrome.storage.session.get([key]);
    const found: ExpirationCacheType<V> = result[key];
    if (found) {
      if (found.expiration > Date.now()) {
        return found.value;
      } else {
        // expired, so delete it and return as if not found
        await chrome.storage.session.remove(key);
      }
    }
    return undefined;
  };

  public deleteExpired = async (additionalPredicate: (key: string, value: V) => boolean = () => false): Promise<void> => {
    if (Env.isContentScript()) {
      // Get chrome storage data from content script now allowed
      // Need to get data from service worker
      await BrowserMsg.send.bg.await.expirationCacheDeleteExpired({
        expirationTicks: this.expirationTicks,
      });
      return;
    }

    const keysToDelete: string[] = [];
    const entries = (await chrome.storage.session.get()) as Record<string, ExpirationCacheType<V>>;
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
