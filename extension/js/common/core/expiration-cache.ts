/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

/**
 * Cache, keeping entries for limited duration
 */
export class ExpirationCache {
  private cache: { [key: string]: { value: string, expiration: number } } = {};

  constructor(public EXPIRATION_TICKS: number) {
  }

  public set = (key: string, value: string | undefined) => {
    if (value) {
      this.cache[key] = { value, expiration: Date.now() + this.EXPIRATION_TICKS };
    } else {
      delete this.cache[key];
    }
  };

  public get = (key: string): string | undefined => {
    const found = this.cache[key];
    if (found) {
      if (found.expiration > Date.now()) {
        return found.value;
      } else {
        // expired, so delete it and return as if not found
        delete this.cache[key];
      }
    }
    return undefined;
  };

  public deleteExpired = (): void => {
    for (const keyToDelete of Object.keys(this.cache).filter(key => this.cache[key].expiration <= Date.now())) {
      delete this.cache[keyToDelete];
    }
  };
}
