/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Value, Str, Dict } from './common.js';
import { Pgp } from './pgp.js';

export type DomainRule = { flags: ('NO_PRV_CREATE' | 'NO_PRV_BACKUP')[] };

export class Rules {

  private other = 'other';
  private domainHash: string = this.other;
  private rules: Dict<DomainRule> = {
    '745126dcac9a94a1931a3a5e03f02be3820f51d1': { flags: ['NO_PRV_CREATE', 'NO_PRV_BACKUP'] }, // n
    '77754b18ecb3f2f7c59bf20cfe06afac2a6458ec': { flags: ['NO_PRV_CREATE', 'NO_PRV_BACKUP'] }, // v
    [this.other]: { flags: [] },
  };

  constructor(email?: string) {
    if (email && Str.isEmailValid(email)) {
      let domain = email.split('@')[1];
      this.domainHash = Pgp.hash.sha1(domain);
      if (!Value.is(this.domainHash).in(Object.keys(this.rules))) { // not a known domain
        this.domainHash = this.other;
      }
    }
  }

  canCreateKeys = () => !Value.is('NO_PRV_CREATE').in(this.rules[this.domainHash].flags);

  canBackupKeys = () => !Value.is('NO_PRV_BACKUP').in(this.rules[this.domainHash].flags);

}
