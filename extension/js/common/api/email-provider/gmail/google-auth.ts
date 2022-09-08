/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

// tslint:disable:no-direct-ajax
// tslint:disable:oneliner-object-literal

import { Str, Url, Value } from '../../../core/common.js';
import { FLAVOR, GOOGLE_OAUTH_SCREEN_HOST, OAUTH_GOOGLE_API_HOST } from '../../../core/const.js';
import { ApiErr } from '../../shared/api-error.js';
import { Api } from './../../shared/api.js';

import { Bm, GoogleAuthWindowResult$result } from '../../../browser/browser-msg.js';
import { Buf } from '../../../core/buf.js';
import { InMemoryStoreKeys } from '../../../core/const.js';
import { OAuth2 } from '../../../oauth2/oauth2.js';
import { Catch } from '../../../platform/catch.js';
import { AcctStore, AcctStoreDict } from '../../../platform/store/acct-store.js';
import { InMemoryStore } from '../../../platform/store/in-memory-store.js';
import { AccountServer } from '../../account-server.js';
import { EnterpriseServer } from '../../account-servers/enterprise-server.js';
import { GoogleAuthErr } from '../../shared/api-error.js';
import { GmailRes } from './gmail-parser';
import { Assert } from '../../../assert.js';

type GoogleAuthTokensResponse = { access_token: string, expires_in: number, refresh_token?: string, id_token: string, token_type: 'Bearer' };
type AuthResultSuccess = { result: 'Success', acctEmail: string, id_token: string, error?: undefined };
type AuthResultError = { result: GoogleAuthWindowResult$result, acctEmail?: string, error?: string, id_token: undefined };

type AuthReq = { acctEmail?: string, scopes: string[], messageId?: string, csrfToken: string };
export type AuthRes = AuthResultSuccess | AuthResultError;

export class GoogleAuth {

  public static OAUTH = {
    client_id: '717284730244-5oejn54f10gnrektjdc4fv4rbic1bj1p.apps.googleusercontent.com',
    client_secret: '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',
    redirect_uri: 'https://www.google.com/robots.txt',
    url_code: `${GOOGLE_OAUTH_SCREEN_HOST}/o/oauth2/auth`,
    url_tokens: `${OAUTH_GOOGLE_API_HOST}/token`,
    url_redirect: 'urn:ietf:wg:oauth:2.0:oob:auto',
    state_header: 'CRYPTUP_STATE_',
    scopes: {
      email: 'email',
      openid: 'openid',
      profile: 'https://www.googleapis.com/auth/userinfo.profile', // needed so that `name` is present in `id_token`, which is required for key-server auth when in use
      compose: 'https://www.googleapis.com/auth/gmail.compose',
      modify: 'https://www.googleapis.com/auth/gmail.modify',
      readContacts: 'https://www.googleapis.com/auth/contacts.readonly',
      readOtherContacts: 'https://www.googleapis.com/auth/contacts.other.readonly',
    },
    legacy_scopes: {
      gmail: 'https://mail.google.com/', // causes a freakish oauth warn: "can permannently delete all your email" ...
    }
  };

  public static defaultScopes = (group: 'default' | 'contacts' | 'openid' = 'default') => {
    const { readContacts, readOtherContacts, compose, modify, openid, email, profile } = GoogleAuth.OAUTH.scopes;
    if (group === 'openid') {
      return [openid, email, profile];
    } else if (group === 'default') {
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

  public static googleApiAuthHeader = async (acctEmail: string, forceRefresh = false): Promise<string> => {
    if (!acctEmail) {
      throw new Error('missing account_email in api_gmail_call');
    }
    const storage = await AcctStore.get(acctEmail, ['google_token_scopes', 'google_token_refresh']);
    if (!storage.google_token_refresh) {
      throw new GoogleAuthErr(`Account ${acctEmail} not connected to FlowCrypt Browser Extension`);
    }
    if (!forceRefresh) {
      const googleAccessToken = await InMemoryStore.get(acctEmail, InMemoryStoreKeys.GOOGLE_TOKEN_ACCESS);
      if (googleAccessToken) {
        return `Bearer ${googleAccessToken}`;
      }
    }
    // refresh token
    const refreshTokenRes = await GoogleAuth.googleAuthRefreshToken(storage.google_token_refresh);
    if (refreshTokenRes.access_token) {
      await GoogleAuth.googleAuthSaveTokens(acctEmail, refreshTokenRes, storage.google_token_scopes || []);
      const googleAccessToken = await InMemoryStore.get(acctEmail, InMemoryStoreKeys.GOOGLE_TOKEN_ACCESS);
      if (googleAccessToken) {
        return `Bearer ${googleAccessToken}`;
      }
    }
    throw new GoogleAuthErr(`Could not refresh google auth token - did not become valid (access:${refreshTokenRes.access_token},expires_in:${refreshTokenRes.expires_in},now:${Date.now()})`);
  };

  public static apiGoogleCallRetryAuthErrorOneTime = async (acctEmail: string, request: JQuery.AjaxSettings): Promise<unknown> => {
    try {
      return await Api.ajax(request, Catch.stackTrace());
    } catch (firstAttemptErr) {
      if (ApiErr.isAuthErr(firstAttemptErr)) { // force refresh token
        request.headers!.Authorization = await GoogleAuth.googleApiAuthHeader(acctEmail, true);
        return await Api.ajax(request, Catch.stackTrace());
      }
      throw firstAttemptErr;
    }
  };

  public static newAuthPopup = async ({ acctEmail, scopes, save }: { acctEmail?: string, scopes?: string[], save?: boolean }): Promise<AuthRes> => {
    if (acctEmail) {
      acctEmail = acctEmail.toLowerCase();
    }
    if (typeof save === 'undefined') {
      save = true;
    }
    if (save || !scopes) { // if tokens will be saved (meaning also scopes should be pulled from storage) or if no scopes supplied
      scopes = await GoogleAuth.apiGoogleAuthPopupPrepareAuthReqScopes(acctEmail, scopes || GoogleAuth.defaultScopes());
    }
    const authRequest: AuthReq = { acctEmail, scopes, csrfToken: `csrf-${Api.randomFortyHexChars()}` };
    const authUrl = GoogleAuth.apiGoogleAuthCodeUrl(authRequest);
    const authWindowResult = await OAuth2.webAuthFlow(authUrl);
    const authRes = await GoogleAuth.getAuthRes({ acctEmail, save, authWindowResult });
    if (authRes.result === 'Success') {
      if (!authRes.id_token) {
        return { result: 'Error', error: 'Grant was successful but missing id_token', acctEmail: authRes.acctEmail, id_token: undefined };
      }
      if (!authRes.acctEmail) {
        return { result: 'Error', error: 'Grant was successful but missing acctEmail', acctEmail: authRes.acctEmail, id_token: undefined };
      }
      try {
        const uuid = Api.randomFortyHexChars(); // for flowcrypt.com, if used. When FES is used, the access token is given to client.
        const potentialFes = new EnterpriseServer(authRes.acctEmail);
        if (await potentialFes.isFesInstalledAndAvailable()) {
          // on FES, pulling ClientConfiguration is not authenticated, and it contains info about how to
          //   authenticate when doing other calls (use access token or OIDC directly)
          await AcctStore.set(authRes.acctEmail, { fesUrl: potentialFes.url });
          const acctServer = new AccountServer(authRes.acctEmail);
          // fetch and store ClientConfiguration (not authenticated)
          await acctServer.accountGetAndUpdateLocalStore({ account: authRes.acctEmail, uuid });
          // this is a no-op if FES is used. uuid is generated / stored if flowcrypt.com/api is used
          await acctServer.loginWithOpenid(authRes.acctEmail, uuid, authRes.id_token);
        } else {
          // eventually this branch will be dropped once a public FES instance is run for these customers
          // when using flowcrypt.com/api, pulling ClientConfiguration is authenticated, therefore have
          //   to retrieve access token first (which is the only way to authenticate other calls)
          const acctServer = new AccountServer(authRes.acctEmail);
          // get access token from flowcrypt.com/api
          await acctServer.loginWithOpenid(authRes.acctEmail, uuid, authRes.id_token);
          // fetch and store ClientConfiguration (authenticated)
          await acctServer.accountGetAndUpdateLocalStore({ account: authRes.acctEmail, uuid }); // stores ClientConfiguration
        }
      } catch (e) {
        if (GoogleAuth.isFesUnreachableErr(e, authRes.acctEmail)) {
          const error = `Cannot reach your company's FlowCrypt Enterprise Server (FES). Contact your Help Desk when unsure. (${String(e)})`;
          return { result: 'Error', error, acctEmail: authRes.acctEmail, id_token: undefined };
        }
        return { result: 'Error', error: `Grant successful but error accessing fc account: ${String(e)}`, acctEmail: authRes.acctEmail, id_token: undefined };
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
    if (errString.includes(`-1 when GET-ing https://fes.${domain}/api/ `)) { // the space is important to match the full url
      return true; // err trying to reach FES itself at a predictable URL
    }
    return false;
  };

  public static newOpenidAuthPopup = async ({ acctEmail }: { acctEmail?: string }): Promise<AuthRes> => {
    return await GoogleAuth.newAuthPopup({ acctEmail, scopes: GoogleAuth.defaultScopes('openid'), save: false });
  };

  private static getAuthRes = async ({ acctEmail, save, authWindowResult }:
    { acctEmail?: string, save: boolean, authWindowResult: Bm.AuthWindowResult }): Promise<AuthRes> => {
    try {
      if (!authWindowResult.url) {
        return { acctEmail, result: 'Denied', error: 'Invalid response url', id_token: undefined };
      }
      if (authWindowResult.error) {
        return { acctEmail, result: 'Denied', error: authWindowResult.error, id_token: undefined };
      }
      const uncheckedUrlParams = Url.parse(['scope', 'code'], authWindowResult.url!);
      const allowedScopes = Assert.urlParamRequire.string(uncheckedUrlParams, 'scope');
      const code = Assert.urlParamRequire.string(uncheckedUrlParams, 'code');

      if (!allowedScopes?.includes(this.OAUTH.scopes.compose) || !allowedScopes?.includes(this.OAUTH.scopes.modify)) {
        if (code !== '') {
          // Try to get auth token to let login authorization be granted
          await GoogleAuth.googleAuthGetTokens(code);
        }
      }
      if (!code) {
        return { acctEmail, result: 'Denied', error: "Google auth result was 'Success' but no auth code", id_token: undefined };
      }
      const { id_token } = save ? await GoogleAuth.retrieveAndSaveAuthToken(code, allowedScopes?.split(' ') ?? []) : await GoogleAuth.googleAuthGetTokens(code);
      const { email } = GoogleAuth.parseIdToken(id_token);
      if (!email) {
        throw new Error('Missing email address in id_token');
      }
      return { acctEmail: email, result: 'Success', id_token };
    } catch (err) {
      return { acctEmail, result: 'Denied', error: String(err), id_token: undefined };
    }
  };

  private static apiGoogleAuthCodeUrl = (authReq: AuthReq) => {
    return Url.create(GoogleAuth.OAUTH.url_code, {
      client_id: GoogleAuth.OAUTH.client_id,
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      state: GoogleAuth.apiGoogleAuthStatePack(authReq),
      redirect_uri: GoogleAuth.OAUTH.redirect_uri,
      scope: (authReq.scopes || []).join(' '),
      login_hint: authReq.acctEmail,
    });
  };

  private static apiGoogleAuthStatePack = (authReq: AuthReq) => {
    return GoogleAuth.OAUTH.state_header + JSON.stringify(authReq);
  };

  private static googleAuthSaveTokens = async (acctEmail: string, tokensObj: GoogleAuthTokensResponse, scopes: string[]) => {
    const parsedOpenId = GoogleAuth.parseIdToken(tokensObj.id_token);
    const { full_name, picture } = await AcctStore.get(acctEmail, ['full_name', 'picture']);
    const googleTokenExpires = new Date().getTime() + (tokensObj.expires_in as number - 120) * 1000; // let our copy expire 2 minutes beforehand
    const toSave: AcctStoreDict = {
      google_token_scopes: scopes,
      full_name: full_name || parsedOpenId.name,
      picture: picture || parsedOpenId.picture,
    };
    if (typeof tokensObj.refresh_token !== 'undefined') {
      toSave.google_token_refresh = tokensObj.refresh_token;
    }
    await AcctStore.set(acctEmail, toSave);
    await InMemoryStore.set(acctEmail, InMemoryStoreKeys.ID_TOKEN, tokensObj.id_token);
    await InMemoryStore.set(acctEmail, InMemoryStoreKeys.GOOGLE_TOKEN_ACCESS, tokensObj.access_token, googleTokenExpires);
  };

  private static googleAuthGetTokens = async (code: string) => {
    return await Api.ajax({
      url: Url.create(
        GoogleAuth.OAUTH.url_tokens,
        {
          grant_type: 'authorization_code',
          code,
          client_id: GoogleAuth.OAUTH.client_id,
          client_secret: GoogleAuth.OAUTH.client_secret,
          redirect_uri: GoogleAuth.OAUTH.redirect_uri
        }
      ),
      method: 'POST',
      crossDomain: true,
      async: true,
    }, Catch.stackTrace()) as unknown as GoogleAuthTokensResponse;
  };

  private static googleAuthRefreshToken = async (refreshToken: string) => {
    return await Api.ajax({
      url: Url.create(GoogleAuth.OAUTH.url_tokens, {
        grant_type: 'refresh_token',
        refreshToken,
        client_id: GoogleAuth.OAUTH.client_id,
        client_secret: GoogleAuth.OAUTH.client_secret
      }),
      method: 'POST',
      crossDomain: true,
      async: true,
    }, Catch.stackTrace()) as unknown as GoogleAuthTokensResponse;
  };

  // todo - would be better to use a TS type guard instead of the type cast when checking OpenId
  // check for things we actually use: photo/name/locale
  private static parseIdToken = (idToken: string): GmailRes.OpenId => {
    const claims = JSON.parse(Buf.fromBase64UrlStr(idToken.split(/\./g)[1]).toUtfStr()) as GmailRes.OpenId;
    if (claims.email) {
      claims.email = claims.email.toLowerCase();
      if (!claims.email_verified) {
        throw new Error(`id_token email_verified is false for email ${claims.email}`);
      }
    }
    return claims;
  };

  private static retrieveAndSaveAuthToken = async (authCode: string, scopes: string[]): Promise<{ id_token: string }> => {
    const tokensObj = await GoogleAuth.googleAuthGetTokens(authCode);
    const claims = GoogleAuth.parseIdToken(tokensObj.id_token);
    if (!claims.email) {
      throw new Error('Missing email address in id_token');
    }
    await GoogleAuth.googleAuthSaveTokens(claims.email, tokensObj, scopes);
    return { id_token: tokensObj.id_token };
  };

  private static apiGoogleAuthPopupPrepareAuthReqScopes = async (acctEmail: string | undefined, addScopes: string[]): Promise<string[]> => {
    if (acctEmail) {
      const { google_token_scopes } = await AcctStore.get(acctEmail, ['google_token_scopes']);
      addScopes.push(...(google_token_scopes || []));
    }
    addScopes = Value.arr.unique(addScopes);
    if (!addScopes.includes(GoogleAuth.OAUTH.scopes.email)) {
      addScopes.push(GoogleAuth.OAUTH.scopes.email);
    }
    if (!addScopes.includes(GoogleAuth.OAUTH.scopes.openid)) {
      addScopes.push(GoogleAuth.OAUTH.scopes.openid);
    }
    if (!addScopes.includes(GoogleAuth.OAUTH.scopes.profile)) {
      addScopes.push(GoogleAuth.OAUTH.scopes.profile);
    }
    return addScopes;
  };

}
