/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

/**
 * Cache, keeping entries for limited duration
 */
export class ExpirationCache<K, V> {
  private cache = new Map<K, { value: V; expiration: number }>();

  public constructor(public expirationTicks: number) {}

  public set = async (key: K, value?: V, expiration?: number) => {
    console.log('STORE SET ' + key);
    if (value) {
      await chrome.storage.session.set({ [`${key}`]: { value, expiration: expiration || Date.now() + this.expirationTicks } });
      // this.cache.set(key, { value, expiration: expiration || Date.now() + this.expirationTicks });
    } else {
      await chrome.storage.session.remove(`${key}`); // set({ [`${key}`]: value });
      // this.cache.delete(key);
    }
  };

  public get = async (key: K): Promise<V | undefined> => {
    // const found = this.cache.get(key);
    const result = await chrome.storage.session.get([key]);
    const found = result[String(key)] as { value: V; expiration: number };
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

  public deleteExpired = (additionalPredicate: (key: K, value: V) => boolean = () => false): void => {
    const keysToDelete: K[] = [];
    for (const [key, value] of this.cache.entries()) {
      if (value.expiration <= Date.now() || additionalPredicate(key, value.value)) {
        keysToDelete.push(key);
      }
    }
    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
  };

  // await the value if it's a promise and remove from cache in case of exception
  // the value is provided along with the key as parameter to eliminate possibility of a missing (expired) record
  public await = async (key: K, value: V): Promise<V> => {
    try {
      return await value;
    } catch (e) {
      if ((await this.get(key)) === value) await this.set(key); // remove faulty record
      return Promise.reject(e);
    }
  };
}

export class SimpleExpirationCache<K, V> {
  private cache = new Map<K, { value: V; expiration: number }>();

  public constructor(public expirationTicks: number) {}

  public set = (key: K, value?: V, expiration?: number) => {
    if (value) {
      this.cache.set(key, { value, expiration: expiration || Date.now() + this.expirationTicks });
    } else {
      this.cache.delete(key);
    }
  };

  public get = (key: K): V | undefined => {
    const found = this.cache.get(key);
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

  public deleteExpired = (additionalPredicate: (key: K, value: V) => boolean = () => false): void => {
    const keysToDelete: K[] = [];
    for (const [key, value] of this.cache.entries()) {
      if (value.expiration <= Date.now() || additionalPredicate(key, value.value)) {
        keysToDelete.push(key);
      }
    }
    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
  };

  // await the value if it's a promise and remove from cache in case of exception
  // the value is provided along with the key as parameter to eliminate possibility of a missing (expired) record
  public await = async (key: K, value: V): Promise<V> => {
    try {
      return await value;
    } catch (e) {
      if (this.get(key) === value) this.set(key); // remove faulty record
      return Promise.reject(e);
    }
  };
}
