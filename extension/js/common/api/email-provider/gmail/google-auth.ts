/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Str, Url } from '../../../core/common.js';
import { FLAVOR, GMAIL_GOOGLE_API_HOST } from '../../../core/const.js';
import { ApiErr } from '../../shared/api-error.js';
import { Api } from './../../shared/api.js';

import { Assert, AssertError } from '../../../assert.js';
import { Bm, GoogleAuthWindowResult$result } from '../../../browser/browser-msg.js';
import { OAuth2 } from '../../../oauth2/oauth2.js';
import { Catch } from '../../../platform/catch.js';
import { AcctStore } from '../../../platform/store/acct-store.js';
import { AccountServer } from '../../account-server.js';
import { ExternalService } from '../../account-servers/external-service.js';
import { AuthReq, GoogleAuthHelper } from './google-auth-helper.js';

/* eslint-disable @typescript-eslint/naming-convention */
type AuthResultSuccess = { result: 'Success'; acctEmail: string; id_token: string; error?: undefined };
type AuthResultError = {
  result: GoogleAuthWindowResult$result;
  acctEmail?: string;
  error?: string;
  id_token: undefined;
};

type GoogleTokenInfo = { email: string; scope: string; expires_in: number; token_type: string };
export type AuthRes = AuthResultSuccess | AuthResultError;
/* eslint-enable @typescript-eslint/naming-convention */

export class GoogleAuth {
  public static defaultScopes = (group: 'default' | 'contacts' = 'default') => {
    const { readContacts, readOtherContacts, compose, modify, openid, email, profile } = GoogleAuthHelper.OAUTH.scopes;
    if (group === 'default') {
      if (FLAVOR === 'consumer') {
        return [openid, email, profile, compose, modify]; // consumer may freak out that extension asks for their contacts early on
      } else if (FLAVOR === 'enterprise') {
        return [openid, email, profile, compose, modify, readContacts, readOtherContacts]; // enterprise expects their contact search to work properly
      } else {
        throw new Error(`Unknown build ${FLAVOR}`);
      }
    } else if (group === 'contacts') {
      return [openid, email, profile, compose, modify, readContacts, readOtherContacts];
    } else {
      throw new Error(`Unknown scope group ${group}`);
    }
  };

  public static getTokenInfo = async (accessToken: string): Promise<GoogleTokenInfo> => {
    return (await Api.ajax(
      {
        url: `${GMAIL_GOOGLE_API_HOST}/oauth2/v1/tokeninfo?access_token=${accessToken}`,
        timeout: 10000,
      },
      Catch.stackTrace()
    )) as unknown as GoogleTokenInfo;
  };

  public static apiGoogleCallRetryAuthErrorOneTime = async (acctEmail: string, request: JQuery.AjaxSettings): Promise<unknown> => {
    try {
      return await Api.ajax(request, Catch.stackTrace());
    } catch (firstAttemptErr) {
      if (ApiErr.isAuthErr(firstAttemptErr)) {
        // force refresh token
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        request.headers!.Authorization = await GoogleAuthHelper.googleApiAuthHeader(acctEmail, true);
        return await Api.ajax(request, Catch.stackTrace());
      }
      throw firstAttemptErr;
    }
  };

  public static newAuthPopup = async ({ acctEmail, scopes, save }: { acctEmail?: string; scopes?: string[]; save?: boolean }): Promise<AuthRes> => {
    if (acctEmail) {
      acctEmail = acctEmail.toLowerCase();
    }
    if (typeof save === 'undefined') {
      save = true;
    }
    if (save || !scopes) {
      // if tokens will be saved (meaning also scopes should be pulled from storage) or if no scopes supplied
      scopes = await GoogleAuth.apiGoogleAuthPopupPrepareAuthReqScopes(scopes || GoogleAuth.defaultScopes());
    }
    const authRequest = GoogleAuth.newAuthRequest(acctEmail, scopes);
    const authUrl = GoogleAuthHelper.apiGoogleAuthCodeUrl(authRequest);
    const authWindowResult = await OAuth2.webAuthFlow(authUrl);
    const authRes = await GoogleAuth.getAuthRes({
      acctEmail,
      save,
      requestedScopes: scopes,
      expectedState: authRequest.expectedState,
      authWindowResult,
    });
    if (authRes.result === 'Success') {
      if (!authRes.id_token) {
        return {
          result: 'Error',
          error: 'Grant was successful but missing id_token',
          acctEmail: authRes.acctEmail,
          id_token: undefined, // eslint-disable-line @typescript-eslint/naming-convention
        };
      }
      if (!authRes.acctEmail) {
        return {
          result: 'Error',
          error: 'Grant was successful but missing acctEmail',
          acctEmail: authRes.acctEmail,
          id_token: undefined, // eslint-disable-line @typescript-eslint/naming-convention
        };
      }
      try {
        const potentialFes = new ExternalService(authRes.acctEmail);
        if (await potentialFes.isFesInstalledAndAvailable()) {
          await AcctStore.set(authRes.acctEmail, { fesUrl: potentialFes.url });
        }
        // fetch and store ClientConfiguration (not authenticated)
        await (await AccountServer.init(authRes.acctEmail)).fetchAndSaveClientConfiguration();
      } catch (e) {
        if (GoogleAuth.isFesUnreachableErr(e, authRes.acctEmail)) {
          const error = `Cannot reach your company's FlowCrypt External Service (FES). Contact your Help Desk when unsure. (${String(e)})`;
          return { result: 'Error', error, acctEmail: authRes.acctEmail, id_token: undefined }; // eslint-disable-line @typescript-eslint/naming-convention
        }
        return {
          result: 'Error',
          error: `Grant successful but error accessing fc account: ${String(e)}`,
          acctEmail: authRes.acctEmail,
          id_token: undefined, // eslint-disable-line @typescript-eslint/naming-convention
        };
      }
    }
    return authRes;
  };

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

  private static getAuthRes = async ({
    acctEmail,
    save,
    requestedScopes,
    expectedState,
    authWindowResult,
  }: {
    acctEmail?: string;
    save: boolean;
    requestedScopes: string[];
    expectedState: string;
    authWindowResult: Bm.AuthWindowResult;
  }): Promise<AuthRes> => {
    /* eslint-disable @typescript-eslint/naming-convention */
    try {
      if (!authWindowResult.url) {
        return { acctEmail, result: 'Denied', error: 'Invalid response url', id_token: undefined };
      }
      if (authWindowResult.error) {
        return { acctEmail, result: 'Denied', error: authWindowResult.error, id_token: undefined };
      }
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const uncheckedUrlParams = Url.parse(['scope', 'code', 'state'], authWindowResult.url!);
      const allowedScopes = Assert.urlParamRequire.string(uncheckedUrlParams, 'scope');
      const code = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'code');
      const receivedState = Assert.urlParamRequire.string(uncheckedUrlParams, 'state');
      const scopesToCheck = [
        GoogleAuthHelper.OAUTH.scopes.compose,
        GoogleAuthHelper.OAUTH.scopes.modify,
        GoogleAuthHelper.OAUTH.scopes.readContacts,
        GoogleAuthHelper.OAUTH.scopes.readOtherContacts,
      ];
      for (const scopeToCheck of scopesToCheck) {
        if (requestedScopes.includes(scopeToCheck) && !allowedScopes?.includes(scopeToCheck)) {
          return { acctEmail, result: 'Denied', error: 'Missing permissions', id_token: undefined };
        }
      }
      if (!code) {
        return {
          acctEmail,
          result: 'Denied',
          error: "Google auth result was 'Success' but no auth code",
          id_token: undefined,
        };
      }
      if (receivedState !== expectedState) {
        return { acctEmail, result: 'Error', error: `Wrong oauth CSRF token. Please try again.`, id_token: undefined };
      }
      const { id_token } = save ? await GoogleAuth.retrieveAndSaveAuthToken(code) : await GoogleAuthHelper.googleAuthGetTokens(code);
      const { email } = GoogleAuthHelper.parseIdToken(id_token);
      if (!email) {
        throw new Error('Missing email address in id_token');
      }
      return { acctEmail: email, result: 'Success', id_token };
    } catch (err) {
      if (err instanceof AssertError) {
        return { acctEmail, result: 'Error', error: 'Could not parse URL returned from Google', id_token: undefined };
      }
      return { acctEmail, result: 'Denied', error: String(err), id_token: undefined };
    }
    /* eslint-enable @typescript-eslint/naming-convention */
  };

  private static newAuthRequest = (acctEmail: string | undefined, scopes: string[]): AuthReq => {
    const authReq = {
      acctEmail,
      scopes,
      csrfToken: `csrf-${Api.randomFortyHexChars()}`,
    };
    return {
      ...authReq,
      expectedState: GoogleAuthHelper.OAUTH.state_header + JSON.stringify(authReq),
    };
  };

  // eslint-disable-next-line @typescript-eslint/naming-convention
  private static retrieveAndSaveAuthToken = async (authCode: string): Promise<{ id_token: string }> => {
    const tokensObj = await GoogleAuthHelper.googleAuthGetTokens(authCode);
    const claims = GoogleAuthHelper.parseIdToken(tokensObj.id_token);
    if (!claims.email) {
      throw new Error('Missing email address in id_token');
    }
    await GoogleAuthHelper.googleAuthSaveTokens(claims.email, tokensObj);
    return { id_token: tokensObj.id_token }; // eslint-disable-line @typescript-eslint/naming-convention
  };

  private static apiGoogleAuthPopupPrepareAuthReqScopes = async (addScopes: string[]): Promise<string[]> => {
    if (!addScopes.includes(GoogleAuthHelper.OAUTH.scopes.email)) {
      addScopes.push(GoogleAuthHelper.OAUTH.scopes.email);
    }
    if (!addScopes.includes(GoogleAuthHelper.OAUTH.scopes.openid)) {
      addScopes.push(GoogleAuthHelper.OAUTH.scopes.openid);
    }
    if (!addScopes.includes(GoogleAuthHelper.OAUTH.scopes.profile)) {
      addScopes.push(GoogleAuthHelper.OAUTH.scopes.profile);
    }
    return addScopes;
  };
}
