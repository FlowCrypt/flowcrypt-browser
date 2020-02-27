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
  }

  public checkUuidOrThrow = (acct: string, uuid: string) => {
    if (!(this.uuidsByAcctEmail[acct] || []).includes(uuid)) {
      throw new HttpAuthErr(`Wrong mock uuid ${uuid} for acct ${acct}`);
    }
  }

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
  }

  public getSubscription = (acct: string) => {
    return { level: null, expire: null, method: null, expired: null };
  }

  public getOrgRules = (acct: string) => {
    const domain = acct.split('@')[1];
    if (domain === 'org-rules-test.flowcrypt.com') {
      return {
        "flags": [
          "NO_PRV_CREATE",
          "NO_PRV_BACKUP",
          "ENFORCE_ATTESTER_SUBMIT"
        ]
      };
    }
    if (domain === 'no-submit-org-rule.flowcrypt.com') {
      return {
        "flags": [
          "NO_ATTESTER_SUBMIT"
        ]
      };
    }
    if (domain === 'no-search-domains-org-rule.flowcrypt.com') {
      return {
        "flags": [],
        "disallow_attester_search_for_domains": ["flowcrypt.com"]
      };
    }
    const keyManagerAutogenRules = {
      "flags": [
        "NO_PRV_BACKUP",
        "ENFORCE_ATTESTER_SUBMIT",
        "PRV_AUTOIMPORT_OR_AUTOGEN",
        "PASS_PHRASE_QUIET_AUTOGEN",
        "DEFAULT_REMEMBER_PASS_PHRASE"
      ],
      "private_key_manager_url": "http://localhost:8001/flowcrypt-email-key-manager",
      "enforce_keygen_algo": "rsa2048",
    };
    if (domain === 'key-manager-autogen.flowcrypt.com') {
      return keyManagerAutogenRules;
    }
    if (domain === 'key-manager-server-offline.flowcrypt.com') {
      return {
        ...keyManagerAutogenRules,
        "private_key_manager_url": "https://localhost:1230/intentionally-wrong",
      };
    }
    return {
      "flags": []
    };
  }

}
