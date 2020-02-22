/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Dict, Str } from './core/common.js';

import { Buf } from './core/buf.js';
import { Store } from './platform/store.js';

type DomainRules$flag = 'NO_PRV_CREATE' | 'NO_PRV_BACKUP' |
  'ENFORCE_ATTESTER_SUBMIT' | 'NO_ATTESTER_SUBMIT' |
  'DEFAULT_REMEMBER_PASS_PHRASE';
export type DomainRules = {
  flags: DomainRules$flag[],
  custom_keyserver_url?: string,
};

export class Rules {

  public static newInstance = async (acctEmail: string): Promise<Rules> => {
    if (!Str.parseEmail(acctEmail).email) {
      throw new Error(`Not a valid email:${acctEmail}`);
    }
    const storage = await Store.getAcct(acctEmail, ['rules']);
    if (storage.rules) {
      return new Rules(acctEmail, storage.rules);
    } else {
      const legacyHardCoded = await Rules.legacyHardCodedRules(acctEmail);
      await Store.setAcct(acctEmail, { rules: legacyHardCoded });
      return new Rules(acctEmail, legacyHardCoded);
    }
  }

  public static isPublicEmailProviderDomain = (emailAddr: string) => {
    return ['gmail.com', 'yahoo.com', 'outlook.com', 'live.com'].includes(emailAddr.split('@')[1] || 'NONE');
  }

  private static legacyHardCodedRules = async (acctEmail: string): Promise<DomainRules> => {
    const hardCodedRules: Dict<DomainRules> = {
      'dFEm3KyalKGTGjpeA/Ar44IPUdE=': { // n
        flags: ['NO_PRV_CREATE', 'NO_PRV_BACKUP', 'ENFORCE_ATTESTER_SUBMIT']
      },
      'd3VLGOyz8vfFm/IM/gavrCpkWOw=': { // v
        flags: ['NO_PRV_CREATE', 'NO_PRV_BACKUP', 'ENFORCE_ATTESTER_SUBMIT']
      },
      'xKzI/nSDX4g2Wfgih9y0sYIguRU=': { // h
        flags: ['NO_PRV_BACKUP'],
        custom_keyserver_url: Buf.fromBase64Str('aHR0cHM6Ly9za3MucG9kMDEuZmxlZXRzdHJlZXRvcHMuY29tLw==').toUtfStr()
      },
    };
    const domain = acctEmail.split('@')[1];
    const sha1 = Buf.fromUint8(new Uint8Array(await crypto.subtle.digest('SHA-1', Buf.fromUtfStr(domain)))).toBase64Str();
    const foundHardCoded = hardCodedRules[sha1];
    if (foundHardCoded) {
      return foundHardCoded;
    }
    return { flags: [] };
  }

  protected constructor(public acctEmail: string, private domainRules: DomainRules) { }

  public canCreateKeys = () => {
    return !this.domainRules.flags.includes('NO_PRV_CREATE');
  }

  public canBackupKeys = () => {
    return !this.domainRules.flags.includes('NO_PRV_BACKUP');
  }

  public mustSubmitToAttester = () => {
    return this.domainRules.flags.includes('ENFORCE_ATTESTER_SUBMIT');
  }

  public rememberPassPhraseByDefault = () => {
    return this.domainRules.flags.includes('DEFAULT_REMEMBER_PASS_PHRASE');
  }

  public getCustomKeyserver = (): string | undefined => {
    return this.domainRules.custom_keyserver_url;
  }

  public canSubmitPubToAttester = () => {
    return !this.domainRules.flags.includes('NO_ATTESTER_SUBMIT');
  }

}
