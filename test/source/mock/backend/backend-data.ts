/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { Dict } from '../../core/common';
import { HttpAuthErr } from '../lib/api';
import { OauthMock } from '../lib/oauth';

// tslint:disable:no-null-keyword
// tslint:disable:oneliner-object-literal

export class BackendData {
  public reportedErrors: { name: string, message: string, url: string, line: number, col: number, trace: string, version: string, environmane: string }[] = [];

  private uuidsByAcctEmail: Dict<string[]> = {};

  constructor(private oauth: OauthMock) { }

  public registerOrThrow = (acct: string, uuid: string, idToken: string) => {
    if (!this.oauth.isIdTokenValid(idToken)) {
      throw new HttpAuthErr(`Could not verify mock idToken: ${idToken}`);
    }
    if (!this.uuidsByAcctEmail[acct]) {
      this.uuidsByAcctEmail[acct] = [];
    }
    this.uuidsByAcctEmail[acct].push(uuid);
  };

  public checkUuidOrThrow = (acct: string, uuid: string) => {
    if (!(this.uuidsByAcctEmail[acct] || []).includes(uuid)) {
      throw new HttpAuthErr(`Wrong mock uuid ${uuid} for acct ${acct}`);
    }
  };

  public getAcctRow = (acct: string) => {
    return {
      'email': acct,
      'alias': null,
      'name': 'mock name',
      'photo': null,
      'photo_circle': true,
      'web': null,
      'phone': null,
      'intro': null,
      'default_message_expire': 3,
      'token': '1234-mock-acct-token',
    };
  };

  public getOrgRules = (acct: string) => {
    const domain = acct.split('@')[1];
    if (domain === 'org-rules-test.flowcrypt.test') {
      return {
        "flags": [
          "NO_PRV_CREATE",
          "NO_PRV_BACKUP",
          "HIDE_ARMOR_META",
          "ENFORCE_ATTESTER_SUBMIT",
          "USE_LEGACY_ATTESTER_SUBMIT",
        ]
      };
    }
    if (domain === 'no-submit-org-rule.flowcrypt.test') {
      return {
        "flags": [
          "NO_ATTESTER_SUBMIT"
        ]
      };
    }
    if (domain === 'forbid-storing-passphrase-org-rule.flowcrypt.test') {
      return {
        "flags": [
          "FORBID_STORING_PASS_PHRASE"
        ]
      };
    }
    if (domain === 'default-remember-passphrase-org-rule.flowcrypt.test') {
      return {
        "flags": [
          "DEFAULT_REMEMBER_PASS_PHRASE"
        ]
      };
    }
    if (domain === 'no-search-domains-org-rule.flowcrypt.test') {
      return {
        "flags": [],
        "disallow_attester_search_for_domains": ["flowcrypt.com"]
      };
    }
    if (domain === 'no-search-wildcard-domains-org-rule.flowcrypt.test') {
      return {
        "flags": [],
        "disallow_attester_search_for_domains": ["*"]
      };
    }
    const keyManagerAutogenRules = {
      "flags": [
        "NO_PRV_BACKUP",
        "ENFORCE_ATTESTER_SUBMIT",
        "PRV_AUTOIMPORT_OR_AUTOGEN",
        "PASS_PHRASE_QUIET_AUTOGEN",
        "DEFAULT_REMEMBER_PASS_PHRASE",
      ],
      "key_manager_url": "https://localhost:8001/flowcrypt-email-key-manager",
      "enforce_keygen_algo": "rsa2048",
      "disallow_attester_search_for_domains": []
    };
    if (domain === 'google.mock.flowcryptlocal.test:8001') {
      return { ...keyManagerAutogenRules, flags: [...keyManagerAutogenRules.flags, 'NO_ATTESTER_SUBMIT'] };
    }
    if (domain === 'key-manager-autogen.flowcrypt.test') {
      return keyManagerAutogenRules;
    }
    if (domain === 'key-manager-autoimport-no-prv-create.flowcrypt.test') {
      return { ...keyManagerAutogenRules, flags: [...keyManagerAutogenRules.flags, 'NO_PRV_CREATE'] };
    }
    if (domain === 'key-manager-choose-passphrase.flowcrypt.test') {
      return {
        ...keyManagerAutogenRules, flags: [
          'NO_PRV_BACKUP',
          'PRV_AUTOIMPORT_OR_AUTOGEN',
          'NO_ATTESTER_SUBMIT',
          'DEFAULT_REMEMBER_PASS_PHRASE']
      };
    }
    if (domain === 'key-manager-choose-passphrase-forbid-storing.flowcrypt.test') {
      return {
        ...keyManagerAutogenRules, flags: [
          'NO_PRV_BACKUP',
          'PRV_AUTOIMPORT_OR_AUTOGEN',
          'NO_ATTESTER_SUBMIT',
          'FORBID_STORING_PASS_PHRASE']
      };
    }
    if (domain === 'key-manager-server-offline.flowcrypt.test') {
      return { ...keyManagerAutogenRules, "key_manager_url": "https://localhost:1230/intentionally-wrong", };
    }
    if (domain === 'key-manager-keygen-expiration.flowcrypt.test') {
      return { ...keyManagerAutogenRules, "enforce_keygen_expire_months": 1 };
    }
    if (domain === 'no-submit-org-rule.key-manager-autogen.flowcrypt.test') {
      return { ...keyManagerAutogenRules, flags: [...keyManagerAutogenRules.flags, 'NO_ATTESTER_SUBMIT'] };
    }
    if (domain === 'prv-create-no-prv-backup.flowcrypt.test') {
      // org is allowed to create new keys in the plugin, without EKM, but no backups are allowed
      // not a sensible choice for production deployments (no backups and no key management), but useful for demos
      return { "flags": ["NO_PRV_BACKUP"], "enforce_keygen_algo": "rsa2048" };
    }
    return {
      "flags": []
    };
  };

}
