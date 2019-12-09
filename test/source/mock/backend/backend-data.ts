import { OauthMock } from '../lib/oauth';
import { Dict } from '../../core/common';
import { HttpAuthErr } from '../lib/api';

export class BackendData {

  private uuidsByAcctEmail: Dict<string[]> = {};

  constructor(private oauth: OauthMock) { }

  registerOrThrow(acct: string, uuid: string, idToken: string) {
    if (!this.oauth.isIdTokenValid(idToken)) {
      throw new HttpAuthErr(`Could not verify mock idToken: ${idToken}`);
    }
    if (!this.uuidsByAcctEmail[acct]) {
      this.uuidsByAcctEmail[acct] = [];
    }
    this.uuidsByAcctEmail[acct].push(uuid);
  }

  checkUuidOrThrow(acct: string, uuid: string) {
    if (!(this.uuidsByAcctEmail[acct] || []).includes(uuid)) {
      throw new HttpAuthErr(`Wrong mock uuid ${uuid} for acct ${acct}`);
    }
  }

  getAcctRow(acct: string) {
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

  getSubscription(acct: string) {
    return { level: null, expire: null, method: null, expired: null };
  }

  getOrgRules(acct: string) {
    return { 'flags': [] };
  }

}
