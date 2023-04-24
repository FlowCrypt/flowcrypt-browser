/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */
import { FesClientConfiguration, FesConfig } from './shared-tenant-fes-endpoints';

/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */
export const flowcryptTestClientConfiguration: FesConfig = {
  clientConfiguration: {
    flags: ['NO_PRV_CREATE', 'NO_PRV_BACKUP', 'HIDE_ARMOR_META', 'ENFORCE_ATTESTER_SUBMIT', 'SETUP_ENSURE_IMPORTED_PRV_MATCH_LDAP_PUB'],
  },
};

/* eslint-disable @typescript-eslint/naming-convention */
export const getKeyManagerAutogenRules = (port: number): FesClientConfiguration => {
  return {
    flags: ['NO_PRV_BACKUP', 'ENFORCE_ATTESTER_SUBMIT', 'PRV_AUTOIMPORT_OR_AUTOGEN', 'PASS_PHRASE_QUIET_AUTOGEN', 'DEFAULT_REMEMBER_PASS_PHRASE'],
    key_manager_url: `https://localhost:${port}/flowcrypt-email-key-manager`,
    enforce_keygen_algo: 'rsa2048',
    disallow_attester_search_for_domains: [],
  };
};

export const getKeyManagerAutoImportNoPrvCreateRules = (port: number): FesClientConfiguration => {
  const rules = getKeyManagerAutogenRules(port);
  return {
    ...rules,
    flags: [...(rules.flags ?? []), 'NO_PRV_CREATE'],
  };
};

export const getKeyManagerChoosePassphraseForbidStoringRules = (port: number): FesClientConfiguration => {
  const rules = getKeyManagerAutogenRules(port);
  return {
    ...rules,
    flags: ['NO_PRV_BACKUP', 'PRV_AUTOIMPORT_OR_AUTOGEN', 'NO_ATTESTER_SUBMIT', 'FORBID_STORING_PASS_PHRASE'],
  };
};
