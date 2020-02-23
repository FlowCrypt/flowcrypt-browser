/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Str } from './core/common.js';
import { Store } from './platform/store/abstract-store.js';

type DomainRules$flag = 'NO_PRV_CREATE' | 'NO_PRV_BACKUP' |
  'ENFORCE_ATTESTER_SUBMIT' | 'NO_ATTESTER_SUBMIT' |
  'DEFAULT_REMEMBER_PASS_PHRASE';
export type DomainRules = {
  flags: DomainRules$flag[],
  custom_keyserver_url?: string,
  disallow_attester_search_for_domains?: string[],
};

export class Rules {

  private static readonly default = { flags: [] };

  public static newInstance = async (acctEmail: string): Promise<Rules> => {
    const email = Str.parseEmail(acctEmail).email;
    if (!email) {
      throw new Error(`Not a valid email:${acctEmail}`);
    }
    const storage = await AcctStore.getAcct(email, ['rules']);
    return new Rules(storage.rules || Rules.default);
  }

  public static isPublicEmailProviderDomain = (emailAddr: string) => {
    return ['gmail.com', 'yahoo.com', 'outlook.com', 'live.com'].includes(emailAddr.split('@')[1] || 'NONE');
  }

  protected constructor(private domainRules: DomainRules) { }

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

  public canLookupThisRecipientOnAttester = (emailAddr: string) => {
    return !(this.domainRules.disallow_attester_search_for_domains || []).includes(emailAddr.split('@')[1] || 'NONE');
  }

}
