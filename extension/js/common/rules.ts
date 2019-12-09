/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Str, Dict } from './core/common.js';
import { Buf } from './core/buf.js';

export type DomainRule = { flags: ('NO_PRV_CREATE' | 'NO_PRV_BACKUP' | 'STRICT_GDPR' | 'ALLOW_CUSTOM_KEYSERVER' | 'ENFORCE_ATTESTER_SUBMIT')[] };

export class Rules {

  private static async digest(domain: string) {
    return Buf.fromUint8(new Uint8Array(await crypto.subtle.digest('SHA-1', Buf.fromUtfStr(domain)))).toBase64Str();
  }

  private other = 'other';
  private domainHash: string = this.other;
  private rules: Dict<DomainRule> = {
    'dFEm3KyalKGTGjpeA/Ar44IPUdE=': { flags: ['NO_PRV_CREATE', 'NO_PRV_BACKUP', 'STRICT_GDPR', 'ENFORCE_ATTESTER_SUBMIT'] }, // n
    'd3VLGOyz8vfFm/IM/gavrCpkWOw=': { flags: ['NO_PRV_CREATE', 'NO_PRV_BACKUP', 'STRICT_GDPR', 'ENFORCE_ATTESTER_SUBMIT'] }, // v
    'xKzI/nSDX4g2Wfgih9y0sYIguRU=': { flags: ['NO_PRV_BACKUP', 'ALLOW_CUSTOM_KEYSERVER'] }, // h
    [this.other]: { flags: [] },
  };

  public static async newInstance(email?: string) {
    if (email && Str.isEmailValid(email)) {
      const domain = email.split('@')[1];
      return new Rules(await Rules.digest(domain));
    }
    return new Rules();
  }

  private constructor(domainHash?: string) {
    if (domainHash && Object.keys(this.rules).includes(domainHash)) {
      this.domainHash = domainHash; // known domain, else initialized to this.other
    }
  }

  public static relaxSubscriptionRequirements(emailAddr: string) {
    return ['gmail.com', 'yahoo.com', 'outlook.com', 'live.com'].includes(emailAddr.split('@')[1] || 'NONE');
  }

  canCreateKeys = () => !this.rules[this.domainHash].flags.includes('NO_PRV_CREATE');

  canBackupKeys = () => !this.rules[this.domainHash].flags.includes('NO_PRV_BACKUP');

  hasStrictGdpr = () => this.rules[this.domainHash].flags.includes('STRICT_GDPR');

  mustSubmitToAttester = () => this.rules[this.domainHash].flags.includes('ENFORCE_ATTESTER_SUBMIT');

  canUseCustomKeyserver = () => this.rules[this.domainHash].flags.includes('ALLOW_CUSTOM_KEYSERVER');

  /**
   * temporarily hard coded for one domain until we have appropriate backend service for this
   */
  getCustomKeyserver() {
    if (this.domainHash === 'xKzI/nSDX4g2Wfgih9y0sYIguRU=') {
      return Buf.fromBase64Str('aHR0cHM6Ly9za3MucG9kMDEuZmxlZXRzdHJlZXRvcHMuY29tLw==').toUtfStr();
    }
    return undefined;
  }

}
