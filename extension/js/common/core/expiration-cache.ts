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
      console.log({ [`${key}`]: { value, expiration: expiration || Date.now() + this.expirationTicks } });
      await chrome.storage.session.set({ [`${key}`]: { value, expiration: expiration || Date.now() + this.expirationTicks } });
      // this.cache.set(key, { value, expiration: expiration || Date.now() + this.expirationTicks });
    } else {
      await chrome.storage.session.remove(`${key}`); // set({ [`${key}`]: value });
      // this.cache.delete(key);
    }
  };

  public get = async (key: K): Promise<V | undefined> => {
    // const found = this.cache.get(key);
    console.log('STORE GET ' + key);
    const found = ((await chrome.storage.session.get(`${key}`)) as { value: V; expiration: number }) ?? undefined;
    console.log(found);
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

  public getUntilAvailable = async (key: string, retryCount = 20, delay = 300): Promise<string | undefined> => {
    const alarmName = `retry_${key}`;
    let attempt = 0;

    console.log('Get until available');
    return new Promise(resolve => {
      const checkValue = async () => {
        const value = await this.get(key as K); // Assume this is a method that retrieves data.
        console.log(`getUntilAvailable, ${value}`);
        if (value) {
          resolve(value as string);
          await chrome.alarms.clear(alarmName);
        } else if (attempt < retryCount) {
          attempt++;
          await chrome.alarms.create(alarmName, { when: Date.now() + delay });
        } else {
          resolve(undefined);
          await chrome.alarms.clear(alarmName);
        }
      };

      chrome.alarms.onAlarm.addListener(alarm => {
        console.log('Alarm');
        if (alarm.name === alarmName) {
          void checkValue();
        }
      });

      console.log('initial get until available');
      void checkValue(); // Initial check without delay.
    });
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
