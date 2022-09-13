/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Str } from './core/common.js';
import { AcctStore } from './platform/store/acct-store.js';
import { KeyAlgo } from './core/crypto/key.js';

type ClientConfiguration$flag = 'NO_PRV_CREATE' | 'NO_PRV_BACKUP' | 'PRV_AUTOIMPORT_OR_AUTOGEN' | 'PASS_PHRASE_QUIET_AUTOGEN' |
  'ENFORCE_ATTESTER_SUBMIT' | 'NO_ATTESTER_SUBMIT' | 'USE_LEGACY_ATTESTER_SUBMIT' |
  'DEFAULT_REMEMBER_PASS_PHRASE' | 'HIDE_ARMOR_META' | 'FORBID_STORING_PASS_PHRASE';

export type ClientConfigurationJson = {
  flags?: ClientConfiguration$flag[],
  custom_keyserver_url?: string,
  key_manager_url?: string,
  allow_attester_search_only_for_domains?: string[],
  disallow_attester_search_for_domains?: string[],
  enforce_keygen_algo?: string,
  enforce_keygen_expire_months?: number,
  in_memory_pass_phrase_session_length?: number;
};

/**
 * Organisational rules, set domain-wide, and delivered from FlowCrypt Backend
 * These either enforce, alter or forbid various behavior to fit customer needs
 */
export class ClientConfiguration {

  private static readonly default = { flags: [] };

  public static newInstance = async (acctEmail: string): Promise<ClientConfiguration> => {
    const email = Str.parseEmail(acctEmail).email;
    if (!email) {
      throw new Error(`Not a valid email`);
    }
    const storage = await AcctStore.get(email, ['rules']);
    return new ClientConfiguration(storage.rules || ClientConfiguration.default, Str.getDomainFromEmailAddress(acctEmail));
  };

  protected constructor(
    private clientConfigurationJson: ClientConfigurationJson,
    public domainName: string
  ) { }

  // optional urls

  /**
   * Internal company SKS-like public key server to trust above Attester
   */
  public getCustomSksPubkeyServer = (): string | undefined => {
    return this.clientConfigurationJson.custom_keyserver_url;
  };

  /**
   * an internal org FlowCrypt Email Key Manager instance, can manage both public and private keys
   * use this method when using for PRV sync
   */
  public getKeyManagerUrlForPrivateKeys = (): string | undefined => {
    return this.clientConfigurationJson.key_manager_url;
  };

  /**
   * use when finding out if EKM is in use, to change functionality without actually neededing the EKM
   *
   */
  public usesKeyManager = (): boolean => {
    return !!this.clientConfigurationJson.key_manager_url;
  };

  // optional vars

  /**
   * Enforce a key algo for keygen, eg rsa2048,rsa4096,curve25519
   */
  public getEnforcedKeygenAlgo = (): KeyAlgo | undefined => {
    return this.clientConfigurationJson.enforce_keygen_algo as KeyAlgo | undefined;
  };

  /**
   * Some orgs want to have newly generated keys include self-signatures that expire some time in the future.
   */
  public getEnforcedKeygenExpirationMonths = (): number | undefined => {
    return this.clientConfigurationJson.enforce_keygen_expire_months;
  };

  /**
   * pass phrase session length to be configurable with client configuraiton
   * default 4 hours
   */
  public getInMemoryPassPhraseSessionLength = (): number | undefined => {
    // in_memory_pass_phrase_session_length min: 1, max: Int max value
    if (this.clientConfigurationJson.in_memory_pass_phrase_session_length) {
      return Math.max(1, Math.min(this.clientConfigurationJson.in_memory_pass_phrase_session_length!, Number.MAX_VALUE)) * 1000;
    }
    return undefined;
  };

  // bools

  /**
   * Some orgs expect 100% of their private keys to be imported from elsewhere (and forbid keygen in the extension)
   */
  public canCreateKeys = (): boolean => {
    return !(this.clientConfigurationJson.flags || []).includes('NO_PRV_CREATE');
  };

  /**
   * Some orgs want to forbid backing up of public keys (such as inbox or other methods)
   */
  public canBackupKeys = (): boolean => {
    return !(this.clientConfigurationJson.flags || []).includes('NO_PRV_BACKUP');
  };

  /**
   * (normally, during setup, if a public key is submitted to Attester and there is
   *    a conflicting key already submitted, the issue will be skipped)
   * Some orgs want to make sure that their public key gets submitted to attester and conflict errors are NOT ignored:
   */
  public mustSubmitToAttester = (): boolean => {
    return (this.clientConfigurationJson.flags || []).includes('ENFORCE_ATTESTER_SUBMIT');
  };

  /**
   * Normally, during setup, "remember pass phrase" is unchecked
   * This option will cause "remember pass phrase" option to be checked by default
   * This behavior is also enabled as a byproduct of PASS_PHRASE_QUIET_AUTOGEN
   */
  public rememberPassPhraseByDefault = (): boolean => {
    return (this.clientConfigurationJson.flags || []).includes('DEFAULT_REMEMBER_PASS_PHRASE') || this.mustAutogenPassPhraseQuietly();
  };

  public forbidStoringPassPhrase = (): boolean => {
    return (this.clientConfigurationJson.flags || []).includes('FORBID_STORING_PASS_PHRASE');
  };

  /**
   * This is to be used for customers who run their own FlowCrypt Email Key Manager
   * If a key can be found on FEKM, it will be auto imported
   * If not, it will be autogenerated and stored there
   */
  public mustAutoImportOrAutogenPrvWithKeyManager = (): boolean => {
    if (!(this.clientConfigurationJson.flags || []).includes('PRV_AUTOIMPORT_OR_AUTOGEN')) {
      return false;
    }
    if (!this.getKeyManagerUrlForPrivateKeys()) {
      throw new Error('Wrong org rules config: using PRV_AUTOIMPORT_OR_AUTOGEN without key_manager_url');
    }
    return true;
  };

  /**
   * When generating keys, user will not be prompted to choose a pass phrase
   * Instead a pass phrase will be automatically generated, and stored locally
   * The pass phrase will NOT be displayed to user, and it will never be asked of the user
   * This creates the smoothest user experience, for organisations that use full-disk-encryption and don't need pass phrase protection
   */
  public mustAutogenPassPhraseQuietly = (): boolean => {
    return this.usesKeyManager() && (this.clientConfigurationJson.flags || []).includes('PASS_PHRASE_QUIET_AUTOGEN');
  };

  public userMustChoosePassPhraseDuringPrvAutoimport = (): boolean => {
    return this.usesKeyManager() && !this.mustAutogenPassPhraseQuietly();
  };

  /**
   * Some orgs prefer to forbid publishing public keys publicly
   */
  public canSubmitPubToAttester = (): boolean => {
    return !(this.clientConfigurationJson.flags || []).includes('NO_ATTESTER_SUBMIT');
  };

  /**
   * Some orgs have a list of email domains where they do NOT want such emails to be looked up on public sources (such as Attester)
   * This is because they already have other means to obtain public keys for these domains, such as from their own internal keyserver
   */
  public canLookupThisRecipientOnAttester = (emailAddr: string): boolean => {
    const userDomain = Str.getDomainFromEmailAddress(emailAddr);
    if (!userDomain) {
      throw new Error(`Not a valid email ${emailAddr}`);
    }
    // When allow_attester_search_only_for_domains is set, ignore disallow_attester_search_for_domains rule
    if (this.clientConfigurationJson.allow_attester_search_only_for_domains) {
      return this.clientConfigurationJson.allow_attester_search_only_for_domains.includes(userDomain);
    }
    const disallowedDomains = this.clientConfigurationJson.disallow_attester_search_for_domains || [];
    if (disallowedDomains.includes('*')) {
      return false;
    }
    return !disallowedDomains.includes(userDomain);
  };

  /**
   * Some orgs use flows that are only implemented in POST /initial/legacy_submit and not in POST /pub/email@corp.co:
   *  -> enforcing that submitted keys match customer key server
   * Until the newer endpoint is ready, this flag will point users in those orgs to the original endpoint
   */
  public useLegacyAttesterSubmit = (): boolean => {
    return (this.clientConfigurationJson.flags || []).includes('USE_LEGACY_ATTESTER_SUBMIT');
  };

  /**
   * With this option, sent messages won't have any comment/version in armor, imported keys get imported without armor
   */
  public shouldHideArmorMeta = (): boolean => {
    return (this.clientConfigurationJson.flags || []).includes('HIDE_ARMOR_META');
  };

}
