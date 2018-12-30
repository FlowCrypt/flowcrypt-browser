/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Value, Str, Dict } from './core/common.js';
import { Pgp } from './core/pgp.js';

export type DomainRule = { flags: ('NO_PRV_CREATE' | 'NO_PRV_BACKUP' | 'STRICT_GDPR')[] };

export class Rules {

  private other = 'other';
  private domainHash: string = this.other;
  private rules: Dict<DomainRule> = {
    '745126dcac9a94a1931a3a5e03f02be3820f51d1': { flags: ['NO_PRV_CREATE', 'NO_PRV_BACKUP', 'STRICT_GDPR'] }, // n
    '77754b18ecb3f2f7c59bf20cfe06afac2a6458ec': { flags: ['NO_PRV_CREATE', 'NO_PRV_BACKUP', 'STRICT_GDPR'] }, // v
    [this.other]: { flags: [] },
  };

  public static newInstance = async (email?: string) => {
    if (email && Str.isEmailValid(email)) {
      const domain = email.split('@')[1];
      return new Rules(await Pgp.hash.sha1(domain));
    }
    return new Rules();
  }

  private constructor(domainHash?: string) {
    if (domainHash && Value.is(domainHash).in(Object.keys(this.rules))) {
      this.domainHash = domainHash; // known domain, else initialized to this.other
    }
  }

  canCreateKeys = () => !Value.is('NO_PRV_CREATE').in(this.rules[this.domainHash].flags);

  canBackupKeys = () => !Value.is('NO_PRV_BACKUP').in(this.rules[this.domainHash].flags);

  hasStrictGdpr = () => Value.is('STRICT_GDPR').in(this.rules[this.domainHash].flags);

}
