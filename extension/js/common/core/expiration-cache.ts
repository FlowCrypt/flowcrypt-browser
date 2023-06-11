/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

/**
 * Cache, keeping entries for limited duration
 */
export class ExpirationCache<K, V> {
  private cache = new Map<K, { value: V; expiration: number }>();

  // eslint-disable-next-line @typescript-eslint/naming-convention
  public constructor(public EXPIRATION_TICKS: number) {}

  public set = (key: K, value?: V, expiration?: number) => {
    if (value) {
      this.cache.set(key, { value, expiration: expiration || Date.now() + this.EXPIRATION_TICKS });
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
