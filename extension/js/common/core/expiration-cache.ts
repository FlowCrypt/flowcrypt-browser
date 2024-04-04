/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

/**
 * Cache, keeping entries for limited duration
 */
type ExpirationCacheType<V> = { value: V; expiration: number };
export class ExpirationCache<V> {
  private cache = new Map<string, ExpirationCacheType<V>>();

  public constructor(public expirationTicks: number) {}

  public set = async (key: string, value?: V, expiration?: number) => {
    if (value) {
      const expirationVal = { value, expiration: expiration || Date.now() + this.expirationTicks };
      if (this.isChromeSupported()) {
        await chrome.storage.session.set({ [`${key}`]: expirationVal });
      } else {
        this.cache.set(key, expirationVal);
      }
    } else {
      if (this.isChromeSupported()) {
        await chrome.storage.session.remove(`${key}`); // set({ [`${key}`]: value });
      } else {
        this.cache.delete(key);
      }
    }
  };

  public get = async (key: string): Promise<V | undefined> => {
    let found: ExpirationCacheType<V> | undefined;
    if (this.isChromeSupported()) {
      const result = await chrome.storage.session.get([key]);
      found = result[key];
    } else {
      found = this.cache.get(key);
    }
    if (found) {
      if (found.expiration > Date.now()) {
        return found.value;
      } else {
        // expired, so delete it and return as if not found
        this.cache.delete(key);
      }
    }
    return undefined;
  };

  public deleteExpired = async (additionalPredicate: (key: string, value: V) => boolean = () => false): Promise<void> => {
    const keysToDelete = [];
    // todo: get from chrome.storage
    for (const [key, value] of this.cache.entries()) {
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

  private isChromeSupported = () => {
    return typeof chrome !== 'undefined';
  };
}
