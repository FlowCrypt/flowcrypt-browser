/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Buf } from '../../../core/buf.js';
import { Str } from '../../../core/common.js';
import { GmailRes } from './gmail-parser.js';

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
}
