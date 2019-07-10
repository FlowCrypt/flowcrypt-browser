/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Str, Dict } from './core/common.js';
import { Pgp } from './core/pgp.js';

export type DomainRule = { flags: ('NO_PRV_CREATE' | 'NO_PRV_BACKUP' | 'STRICT_GDPR' | 'ALLOW_CUSTOM_KEYSERVER')[] };

export class Rules {

  private other = 'other';
  private domainHash: string = this.other;
  private rules: Dict<DomainRule> = {
    '745126dcac9a94a1931a3a5e03f02be3820f51d1': { flags: ['NO_PRV_CREATE', 'NO_PRV_BACKUP', 'STRICT_GDPR'] }, // n
    '77754b18ecb3f2f7c59bf20cfe06afac2a6458ec': { flags: ['NO_PRV_CREATE', 'NO_PRV_BACKUP', 'STRICT_GDPR'] }, // v
    'e308e274e602f710349f5fe178cef094fa01c32b': { flags: ['NO_PRV_BACKUP', 'ALLOW_CUSTOM_KEYSERVER'] }, // h
    [this.other]: { flags: [] },
  };

  public static newInstance = async (email?: string) => {
    if (email && Str.isEmailValid(email)) {
      const domain = email.split('@')[1];
      return new Rules(await Pgp.hash.sha1UtfStr(domain));
    }
    return new Rules();
  }

  private constructor(domainHash?: string) {
    if (domainHash && Object.keys(this.rules).includes(domainHash)) {
      this.domainHash = domainHash; // known domain, else initialized to this.other
    }
  }

  canCreateKeys = () => !this.rules[this.domainHash].flags.includes('NO_PRV_CREATE');

  canBackupKeys = () => !this.rules[this.domainHash].flags.includes('NO_PRV_BACKUP');

  hasStrictGdpr = () => this.rules[this.domainHash].flags.includes('STRICT_GDPR');

  canUseCustomKeyserver = () => this.rules[this.domainHash].flags.includes('ALLOW_CUSTOM_KEYSERVER');

}
