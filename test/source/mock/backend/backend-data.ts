/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { Dict } from '../../core/common';
import { HttpClientErr } from '../lib/api';

/* eslint-disable @typescript-eslint/naming-convention */
export const keyManagerAutogenRules = (port: string) => {
  return {
    flags: ['NO_PRV_BACKUP', 'ENFORCE_ATTESTER_SUBMIT', 'PRV_AUTOIMPORT_OR_AUTOGEN', 'PASS_PHRASE_QUIET_AUTOGEN', 'DEFAULT_REMEMBER_PASS_PHRASE'],
    key_manager_url: `https://localhost:${port}/flowcrypt-email-key-manager`,
    enforce_keygen_algo: 'rsa2048',
    disallow_attester_search_for_domains: [],
  };
};

export type ClientConfiguration = {
  // todo: should we somehow import the type from `client-configuration.ts`?
  flags?: string[];
  custom_keyserver_url?: string;
  key_manager_url?: string;
  allow_attester_search_only_for_domains?: string[];
  disallow_attester_search_for_domains?: string[];
  allow_keys_openpgp_org_search_only_for_domains?: string[];
  disallow_keys_openpgp_org_search_for_domains?: string[];
  enforce_keygen_algo?: string;
  enforce_keygen_expire_months?: number;
  in_memory_pass_phrase_session_length?: number;
};
/* eslint-enable @typescript-eslint/naming-convention */

export interface ReportedError {
  name: string;
  message: string;
  url: string;
  line: number;
  col: number;
  trace: string;
  version: string;
  environmane: string;
}

export class BackendData {
  public reportedErrors: ReportedError[] = [];

  public clientConfigurationForDomain: Dict<ClientConfiguration | HttpClientErr> = {};

  /* eslint-disable no-null/no-null */

  /* eslint-disable @typescript-eslint/naming-convention */
  public getClientConfiguration = (domain: string, port: string) => {
    const foundConfiguration = this.clientConfigurationForDomain[domain];
    if (foundConfiguration) {
      if (foundConfiguration instanceof HttpClientErr) {
        throw foundConfiguration;
      }
      return foundConfiguration;
    }
    const keyManagerRules = keyManagerAutogenRules(port);
    if (domain === 'client-configuration-test.flowcrypt.test') {
      return {
        flags: ['NO_PRV_CREATE', 'NO_PRV_BACKUP', 'HIDE_ARMOR_META', 'ENFORCE_ATTESTER_SUBMIT', 'SETUP_ENSURE_IMPORTED_PRV_MATCH_LDAP_PUB'],
      };
    }
    if (domain === 'passphrase-session-length-client-configuration.flowcrypt.test') {
      return {
        flags: ['FORBID_STORING_PASS_PHRASE'],
        in_memory_pass_phrase_session_length: 10,
      };
    }
    if (domain === 'no-flags-client-configuration.flowcrypt.test') {
      return {};
    }
    if (domain === 'null-client-configuration.flowcrypt.test') {
      return null;
    }
    if (domain === 'no-submit-client-configuration.flowcrypt.test') {
      return {
        flags: ['NO_ATTESTER_SUBMIT'],
      };
    }
    if (domain === 'custom-sks.flowcrypt.test') {
      return {
        ...keyManagerRules,
        custom_keyserver_url: `https://localhost:${port}`,
      };
    }
    if (domain === 'forbid-storing-passphrase-client-configuration.flowcrypt.test') {
      return {
        flags: ['FORBID_STORING_PASS_PHRASE'],
      };
    }
    if (domain === 'default-remember-passphrase-client-configuration.flowcrypt.test') {
      return {
        flags: ['DEFAULT_REMEMBER_PASS_PHRASE'],
      };
    }
    if (domain === 'no-search-domains-client-configuration.flowcrypt.test') {
      return {
        flags: [],
        disallow_attester_search_for_domains: ['flowcrypt.com'],
      };
    }
    if (domain === 'no-search-wildcard-domains-client-configuration.flowcrypt.test') {
      return {
        flags: [],
        disallow_attester_search_for_domains: ['*'],
      };
    }
    if (domain === 'only-allow-some-domains-client-configuration.flowcrypt.test') {
      return {
        flags: [],
        allow_attester_search_only_for_domains: ['flowcrypt.com'],
        disallow_attester_search_for_domains: ['*'],
      };
    }
    if (domain === 'no-allow-domains-client-configuration.flowcrypt.test') {
      return {
        flags: [],
        allow_attester_search_only_for_domains: [],
      };
    }
    if (domain === 'only-allow-some-domains-for-keys-openpgp-org-client-configuration.flowcrypt.test') {
      return {
        flags: [],
        allow_keys_openpgp_org_search_only_for_domains: ['flowcrypt.com'],
        disallow_keys_openpgp_org_search_for_domains: ['*'],
      };
    }
    if (domain === 'no-allow-domains-for-keys-openpgp-org-client-configuration.flowcrypt.test') {
      return {
        flags: [],
        allow_keys_openpgp_org_search_only_for_domains: [],
      };
    }
    if (domain === `google.mock.localhost:${port}`) {
      return { ...keyManagerRules, flags: [...keyManagerRules.flags, 'NO_ATTESTER_SUBMIT'] };
    }
    if (domain === 'key-manager-autogen.flowcrypt.test') {
      return keyManagerRules;
    }
    if (domain === 'key-manager-autoimport-no-prv-create.flowcrypt.test') {
      return { ...keyManagerRules, flags: [...keyManagerRules.flags, 'NO_PRV_CREATE'] };
    }
    if (domain === 'key-manager-disabled-password-message.flowcrypt.test') {
      return {
        ...keyManagerRules,
        flags: [...keyManagerRules.flags, 'DISABLE_FLOWCRYPT_HOSTED_PASSWORD_MESSAGES'],
      };
    }
    if (domain === 'key-manager-autoimport-no-prv-create-no-attester-submit.flowcrypt.test') {
      return {
        ...keyManagerRules,
        flags: [...keyManagerRules.flags, 'NO_PRV_CREATE', 'NO_ATTESTER_SUBMIT'],
      };
    }
    if (domain === 'key-manager-choose-passphrase.flowcrypt.test') {
      return {
        ...keyManagerRules,
        flags: ['NO_PRV_BACKUP', 'PRV_AUTOIMPORT_OR_AUTOGEN', 'NO_ATTESTER_SUBMIT', 'DEFAULT_REMEMBER_PASS_PHRASE'],
      };
    }
    if (domain === 'key-manager-choose-passphrase-forbid-storing.flowcrypt.test') {
      return {
        ...keyManagerRules,
        flags: ['NO_PRV_BACKUP', 'PRV_AUTOIMPORT_OR_AUTOGEN', 'NO_ATTESTER_SUBMIT', 'FORBID_STORING_PASS_PHRASE'],
      };
    }
    if (domain === 'key-manager-server-offline.flowcrypt.test') {
      // EKM offline during local key autogen / upload to EKM flow
      return { ...keyManagerRules, key_manager_url: 'https://localhost:1230/intentionally-wrong' };
    }
    if (domain === 'ekm-offline-retrieve.flowcrypt.test') {
      return {
        // EKM offline during key retrieval from EKM flow
        flags: ['NO_PRV_CREATE', 'NO_PRV_BACKUP', 'NO_ATTESTER_SUBMIT', 'PRV_AUTOIMPORT_OR_AUTOGEN'],
        key_manager_url: 'https://localhost:1230/intentionally-wrong',
      };
    }
    if (domain === 'key-manager-keygen-expiration.flowcrypt.test') {
      return { ...keyManagerRules, enforce_keygen_expire_months: 1 };
    }
    if (domain === 'no-submit-client-configuration.key-manager-autogen.flowcrypt.test') {
      return { ...keyManagerRules, flags: [...keyManagerRules.flags, 'NO_ATTESTER_SUBMIT'] };
    }
    if (domain === 'prv-create-no-prv-backup.flowcrypt.test') {
      // org is allowed to create new keys in the plugin, without EKM, but no backups are allowed
      // not a sensible choice for production deployments (no backups and no key management), but useful for demos
      return { flags: ['NO_PRV_BACKUP'], enforce_keygen_algo: 'rsa2048' };
    }
    return {
      flags: [],
    };
  };
  /* eslint-enable @typescript-eslint/naming-convention */
}
