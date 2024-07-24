/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { GoogleAuthWindowResult$result } from '../../../browser/browser-msg.js';
import { Buf } from '../../../core/buf.js';
import { Str } from '../../../core/common.js';
import { GmailRes } from '../../email-provider/gmail/gmail-parser.js';
import { Api } from '../../shared/api.js';

export type AuthReq = { acctEmail?: string; scopes: string[]; messageId?: string; expectedState: string };
// eslint-disable-next-line @typescript-eslint/naming-convention
type AuthResultSuccess = { result: 'Success'; acctEmail: string; id_token: string; error?: undefined };
type AuthResultError = {
  result: GoogleAuthWindowResult$result;
  acctEmail?: string;
  error?: string;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  id_token: undefined;
};
export type AuthRes = AuthResultSuccess | AuthResultError;

/* eslint-disable @typescript-eslint/naming-convention */
export type OAuthTokensResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  id_token: string;
  token_type: 'Bearer';
};
/* eslint-enable @typescript-eslint/naming-convention */

export class OAuth {
  /**
   * Happens on enterprise builds
   */
  public static isFesUnreachableErr = (e: unknown, email: string): boolean => {
    const domain = Str.getDomainFromEmailAddress(email);
    const errString = String(e);
    if (errString.includes(`-1 when GET-ing https://fes.${domain}/api/ `)) {
      // the space is important to match the full url
      return true; // err trying to reach FES itself at a predictable URL
    }
    return false;
  };

  // todo - would be better to use a TS type guard instead of the type cast when checking OpenId
  // check for things we actually use: photo/name/locale
  public static parseIdToken = (idToken: string): GmailRes.OpenId => {
    const claims = JSON.parse(Buf.fromBase64UrlStr(idToken.split(/\./g)[1]).toUtfStr()) as GmailRes.OpenId;
    if (claims.email) {
      claims.email = claims.email.toLowerCase();
      if (!claims.email_verified) {
        throw new Error(`id_token email_verified is false for email ${claims.email}`);
      }
    }
    return claims;
  };

  public static newAuthRequest(acctEmail: string | undefined, scopes: string[]): AuthReq {
    const authReq = {
      acctEmail,
      scopes,
      csrfToken: `csrf-${Api.randomFortyHexChars()}`,
    };
    return {
      ...authReq,
      expectedState: `CRYPTUP_STATE_${JSON.stringify(authReq)}`,
    };
  }
}
