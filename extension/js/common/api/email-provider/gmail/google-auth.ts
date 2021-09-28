/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

// tslint:disable:no-direct-ajax
// tslint:disable:oneliner-object-literal

import { GOOGLE_API_HOST, GOOGLE_OAUTH_SCREEN_HOST, FLAVOR } from '../../../core/const.js';
import { Str, Url, Value } from '../../../core/common.js';
import { tabsQuery, windowsCreate } from '../../../browser/chrome.js';
import { Api } from './../../shared/api.js';
import { ApiErr } from '../../shared/api-error.js';

import { Buf } from '../../../core/buf.js';
import { Catch } from '../../../platform/catch.js';
import { GmailRes } from './gmail-parser';
import { GoogleAuthErr } from '../../shared/api-error.js';
import { GoogleAuthWindowResult$result } from '../../../browser/browser-msg.js';
import { Ui } from '../../../browser/ui.js';
import { AcctStore, AcctStoreDict } from '../../../platform/store/acct-store.js';
import { AccountServer } from '../../account-server.js';
import { EnterpriseServer } from '../../account-servers/enterprise-server.js';

type GoogleAuthTokenInfo = { issued_to: string, audience: string, scope: string, expires_in: number, access_type: 'offline' };
type GoogleAuthTokensResponse = { access_token: string, expires_in: number, refresh_token?: string, id_token: string, token_type: 'Bearer' };
type AuthResultSuccess = { result: 'Success', acctEmail: string, id_token: string, error?: undefined };
type AuthResultError = { result: GoogleAuthWindowResult$result, acctEmail?: string, error?: string, id_token: undefined };

type AuthReq = { acctEmail?: string, scopes: string[], messageId?: string, csrfToken: string };
export type AuthRes = AuthResultSuccess | AuthResultError;

export class GoogleAuth {

  public static OAUTH = {
    client_id: '717284730244-ostjo2fdtr3ka4q9td69tdr9acmmru2p.apps.googleusercontent.com',
    url_code: `${GOOGLE_OAUTH_SCREEN_HOST}/o/oauth2/auth`,
    url_tokens: `${GOOGLE_API_HOST}/oauth2/v4/token`,
    url_redirect: 'urn:ietf:wg:oauth:2.0:oob:auto',
    state_header: 'CRYPTUP_STATE_',
    scopes: {
      email: 'email',
      openid: 'openid',
      profile: 'https://www.googleapis.com/auth/userinfo.profile', // needed so that `name` is present in `id_token`, which is required for key-server auth when in use
      compose: 'https://www.googleapis.com/auth/gmail.compose',
      modify: 'https://www.googleapis.com/auth/gmail.modify',
      readContacts: 'https://www.googleapis.com/auth/contacts.readonly',
    },
    legacy_scopes: {
      read: 'https://www.googleapis.com/auth/gmail.readonly', // deprecated in favor of modify, which also includes read
      gmail: 'https://mail.google.com/', // causes a freakish oauth warn: "can permannently delete all your email" ...
    }
  };

  public static defaultScopes = (group: 'default' | 'contacts' | 'openid' = 'default') => {
    const { readContacts, compose, modify, openid, email, profile } = GoogleAuth.OAUTH.scopes;
    console.info(`Not using scope ${modify} because not approved on oauth screen yet`);
    const read = GoogleAuth.OAUTH.legacy_scopes.read; // todo - remove as soon as "modify" is approved by google
    if (group === 'openid') {
      return [openid, email, profile];
    } else if (group === 'default') {
      if (FLAVOR === 'consumer') {
        // todo - replace "read" with "modify" when approved by google
        return [openid, email, profile, compose, read]; // consumer may freak out that extension asks for their contacts early on
      } else if (FLAVOR === 'enterprise') {
        // todo - replace "read" with "modify" when approved by google
        return [openid, email, profile, compose, read, readContacts]; // enterprise expects their contact search to work properly
      } else {
        throw new Error(`Unknown build ${FLAVOR}`);
      }
    } else if (group === 'contacts') {
      // todo - replace "read" with "modify" when approved by google
      return [openid, email, profile, compose, read, readContacts];
    } else {
      throw new Error(`Unknown scope group ${group}`);
    }
  }

  public static googleApiAuthHeader = async (acctEmail: string, forceRefresh = false): Promise<string> => {
    if (!acctEmail) {
      throw new Error('missing account_email in api_gmail_call');
    }
    const storage = await AcctStore.get(acctEmail, ['google_token_access', 'google_token_expires', 'google_token_scopes', 'google_token_refresh']);
    if (!storage.google_token_access || !storage.google_token_refresh) {
      throw new GoogleAuthErr(`Account ${acctEmail} not connected to FlowCrypt Browser Extension`);
    } else if (GoogleAuth.googleApiIsAuthTokenValid(storage) && !forceRefresh) {
      return `Bearer ${storage.google_token_access}`;
    } else { // refresh token
      const refreshTokenRes = await GoogleAuth.googleAuthRefreshToken(storage.google_token_refresh);
      await GoogleAuth.googleAuthCheckAccessToken(refreshTokenRes.access_token); // https://groups.google.com/forum/#!topic/oauth2-dev/QOFZ4G7Ktzg
      await GoogleAuth.googleAuthSaveTokens(acctEmail, refreshTokenRes, storage.google_token_scopes || []);
      const auth = await AcctStore.get(acctEmail, ['google_token_access', 'google_token_expires']);
      if (GoogleAuth.googleApiIsAuthTokenValid(auth)) { // have a valid gmail_api oauth token
        return `Bearer ${auth.google_token_access}`;
      } else {
        throw new GoogleAuthErr(`Could not refresh google auth token - did not become valid (access:${!!auth.google_token_access},expires:${auth.google_token_expires},now:${Date.now()})`);
      }
    }
  }

  public static apiGoogleCallRetryAuthErrorOneTime = async (acctEmail: string, request: JQuery.AjaxSettings): Promise<any> => {
    try {
      return await Api.ajax(request, Catch.stackTrace());
    } catch (firstAttemptErr) {
      if (ApiErr.isAuthErr(firstAttemptErr)) { // force refresh token
        request.headers!.Authorization = await GoogleAuth.googleApiAuthHeader(acctEmail, true);
        return await Api.ajax(request, Catch.stackTrace());
      }
      throw firstAttemptErr;
    }
  }

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
    const url = GoogleAuth.apiGoogleAuthCodeUrl(authRequest);
    const oauthWin = await windowsCreate({ url, left: 100, top: 50, height: 800, width: 550, type: 'popup' });
    if (!oauthWin || !oauthWin.tabs || !oauthWin.tabs.length || !oauthWin.id) {
      return { result: 'Error', error: 'No oauth window returned after initiating it', acctEmail, id_token: undefined };
    }
    const authRes = await Promise.race([
      GoogleAuth.waitForAndProcessOauthWindowResult(oauthWin.id, acctEmail, scopes, authRequest.csrfToken, save),
      GoogleAuth.waitForOauthWindowClosed(oauthWin.id, acctEmail),
    ]);
    if (authRes.result === 'Success') {
      await chrome.windows.remove(oauthWin.id); // The prompt windows is removed when the user is authorized.
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
          // on FES, pulling OrgRules is not authenticated, and it contains info about how to
          //   authenticate when doing other calls (use access token or OIDC directly)
          await AcctStore.set(authRes.acctEmail, { fesUrl: potentialFes.url });
          const acctServer = new AccountServer(authRes.acctEmail);
          // fetch and store OrgRules (not authenticated)
          await acctServer.accountGetAndUpdateLocalStore({ account: authRes.acctEmail, uuid });
          // will be skipped if OrgRules contain `DISABLE_FES_ACCESS_TOKEN`
          await acctServer.loginWithOpenid(authRes.acctEmail, uuid, authRes.id_token);
        } else {
          // eventually this branch will be dropped once a public FES instance is run for these customers
          // when using flowcrypt.com/api, pulling OrgRules is authenticated, therefore have
          //   to retrieve access token first (which is the only way to authenticate other calls)
          const acctServer = new AccountServer(authRes.acctEmail);
          // get access token from flowcrypt.com/api
          await acctServer.loginWithOpenid(authRes.acctEmail, uuid, authRes.id_token);
          // fetch and store OrgRules (authenticated)
          await acctServer.accountGetAndUpdateLocalStore({ account: authRes.acctEmail, uuid }); // stores OrgRules
        }
      } catch (e) {
        if (GoogleAuth.isFesUnreachableErr(e, authRes.acctEmail)) {
          const error = `Cannot reach your company's FlowCrypt Enterprise Server (FES). Contact human@flowcrypt.com when unsure. (${String(e)})`;
          return { result: 'Error', error, acctEmail: authRes.acctEmail, id_token: undefined };
        }
        return { result: 'Error', error: `Grant successful but error accessing fc account: ${String(e)}`, acctEmail: authRes.acctEmail, id_token: undefined };
      }
    }
    return authRes;
  }

  /**
   * Happens on enterprise builds
   */
  public static isFesUnreachableErr = (e: any, email: string): boolean => {
    const domain = Str.getDomainFromEmailAddress(email);
    const errString = String(e);
    if (errString.includes(`-1 when GET-ing https://fes.${domain}/api/ `)) { // the space is important to match the full url
      return true; // err trying to reach FES itself at a predictable URL
    }
    return false;
  }

  public static newOpenidAuthPopup = async ({ acctEmail }: { acctEmail?: string }): Promise<AuthRes> => {
    return await GoogleAuth.newAuthPopup({ acctEmail, scopes: GoogleAuth.defaultScopes('openid'), save: false });
  }

  private static waitForOauthWindowClosed = async (oauthWinId: number, acctEmail: string | undefined): Promise<AuthRes> => {
    return await new Promise(resolve => {
      const onOauthWinClosed = (closedWinId: number) => {
        if (closedWinId === oauthWinId) {
          chrome.windows.onRemoved.removeListener(onOauthWinClosed);
          resolve({ result: 'Closed', acctEmail, id_token: undefined });
        }
      };
      chrome.windows.onRemoved.addListener(onOauthWinClosed);
    });
  }

  private static processOauthResTitle = (title: string): { result: GoogleAuthWindowResult$result, code?: string, error?: string, csrf?: string } => {
    const parts = title.split(' ', 2);
    const result = parts[0] as GoogleAuthWindowResult$result;
    const params = Url.parse(['code', 'state', 'error'], parts[1]);
    let authReq: AuthReq;
    try {
      authReq = GoogleAuth.apiGoogleAuthStateUnpack(String(params.state));
    } catch (e) {
      return { result: 'Error', error: `Wrong oauth state response: ${e}` };
    }
    if (!['Success', 'Denied', 'Error'].includes(result)) {
      return { result: 'Error', error: `Unknown google auth result '${result}'` };
    }
    return { result, code: params.code ? String(params.code) : undefined, error: params.error ? String(params.error) : undefined, csrf: authReq.csrfToken };
  }

  /**
   * Is the title actually just url of the page? (means real title not loaded yet)
   */
  private static isUrl = (title: string) => {
    return title.match(/^(?:https?:\/\/)?accounts\.google\.com/) !== null
      || title.startsWith(GOOGLE_OAUTH_SCREEN_HOST.replace(/^https?:\/\//, ''))
      || title.startsWith(GOOGLE_OAUTH_SCREEN_HOST);
  }

  private static isForwarding = (title: string) => {
    return title.match(/^Forwarding /) !== null;
  }

  private static waitForAndProcessOauthWindowResult = async (windowId: number, acctEmail: string | undefined, scopes: string[], csrfToken: string, save: boolean): Promise<AuthRes> => {
    while (true) {
      const [oauth] = await tabsQuery({ windowId });
      if (oauth?.title && oauth.title.includes(GoogleAuth.OAUTH.state_header) && !GoogleAuth.isUrl(oauth.title) && !GoogleAuth.isForwarding(oauth.title)) {
        const { result, error, code, csrf } = GoogleAuth.processOauthResTitle(oauth.title);
        if (error === 'access_denied') {
          return { acctEmail, result: 'Denied', error, id_token: undefined }; // sometimes it was coming in as {"result":"Error","error":"access_denied"}
        }
        if (result === 'Success') {
          if (!csrf || csrf !== csrfToken) {
            return { acctEmail, result: 'Error', error: `Wrong oauth CSRF token. Please try again.`, id_token: undefined };
          }
          if (code) {
            const { id_token } = save ? await GoogleAuth.retrieveAndSaveAuthToken(code, scopes) : await GoogleAuth.googleAuthGetTokens(code);
            const { email } = GoogleAuth.parseIdToken(id_token);
            if (!email) {
              throw new Error('Missing email address in id_token');
            }
            return { acctEmail: email, result: 'Success', id_token };
          }
          return { acctEmail, result: 'Error', error: `Google auth result was 'Success' but no auth code`, id_token: undefined };
        }
        return { acctEmail, result, error: error ? error : '(no error provided)', id_token: undefined };
      }
      await Ui.time.sleep(250);
    }
  }

  private static apiGoogleAuthCodeUrl = (authReq: AuthReq) => {
    return Url.create(GoogleAuth.OAUTH.url_code, {
      client_id: GoogleAuth.OAUTH.client_id,
      response_type: 'code',
      access_type: 'offline',
      state: GoogleAuth.apiGoogleAuthStatePack(authReq),
      redirect_uri: GoogleAuth.OAUTH.url_redirect,
      scope: (authReq.scopes || []).join(' '),
      login_hint: authReq.acctEmail,
    });
  }

  private static apiGoogleAuthStatePack = (authReq: AuthReq) => {
    return GoogleAuth.OAUTH.state_header + JSON.stringify(authReq);
  }

  private static apiGoogleAuthStateUnpack = (state: string): AuthReq => {
    if (!state.startsWith(GoogleAuth.OAUTH.state_header)) {
      throw new Error(`Missing oauth state header`);
    }
    return JSON.parse(state.replace(GoogleAuth.OAUTH.state_header, '')) as AuthReq;
  }

  private static googleAuthSaveTokens = async (acctEmail: string, tokensObj: GoogleAuthTokensResponse, scopes: string[]) => {
    const openid = GoogleAuth.parseIdToken(tokensObj.id_token);
    const { full_name, picture } = await AcctStore.get(acctEmail, ['full_name', 'picture']);
    const toSave: AcctStoreDict = {
      openid,
      google_token_access: tokensObj.access_token,
      google_token_expires: new Date().getTime() + (tokensObj.expires_in as number) * 1000,
      google_token_scopes: scopes,
      full_name: full_name || openid.name,
      picture: picture || openid.picture,
    };
    if (typeof tokensObj.refresh_token !== 'undefined') {
      toSave.google_token_refresh = tokensObj.refresh_token;
    }
    await AcctStore.set(acctEmail, toSave);
  }

  private static googleAuthGetTokens = async (code: string) => {
    return await Api.ajax({
      url: Url.create(GoogleAuth.OAUTH.url_tokens, { grant_type: 'authorization_code', code, client_id: GoogleAuth.OAUTH.client_id, redirect_uri: GoogleAuth.OAUTH.url_redirect }),
      method: 'POST',
      crossDomain: true,
      async: true,
    }, Catch.stackTrace()) as any as GoogleAuthTokensResponse;
  }

  private static googleAuthRefreshToken = async (refreshToken: string) => {
    return await Api.ajax({
      url: Url.create(GoogleAuth.OAUTH.url_tokens, { grant_type: 'refresh_token', refreshToken, client_id: GoogleAuth.OAUTH.client_id }),
      method: 'POST',
      crossDomain: true,
      async: true,
    }, Catch.stackTrace()) as any as GoogleAuthTokensResponse;
  }

  private static googleAuthCheckAccessToken = async (accessToken: string) => {
    return await Api.ajax({
      url: Url.create(`${GOOGLE_API_HOST}/oauth2/v1/tokeninfo`, { access_token: accessToken }),
      crossDomain: true,
      async: true,
    }, Catch.stackTrace()) as any as GoogleAuthTokenInfo;
  }

  /**
   * oauth token will be valid for another 2 min
   */
  private static googleApiIsAuthTokenValid = (s: AcctStoreDict) => {
    return s.google_token_access && (!s.google_token_expires || s.google_token_expires > Date.now() + (120 * 1000));
  }

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
  }

  private static retrieveAndSaveAuthToken = async (authCode: string, scopes: string[]): Promise<{ id_token: string }> => {
    const tokensObj = await GoogleAuth.googleAuthGetTokens(authCode);
    await GoogleAuth.googleAuthCheckAccessToken(tokensObj.access_token); // https://groups.google.com/forum/#!topic/oauth2-dev/QOFZ4G7Ktzg
    const claims = GoogleAuth.parseIdToken(tokensObj.id_token);
    if (!claims.email) {
      throw new Error('Missing email address in id_token');
    }
    await GoogleAuth.googleAuthSaveTokens(claims.email, tokensObj, scopes);
    return { id_token: tokensObj.id_token };
  }

  private static apiGoogleAuthPopupPrepareAuthReqScopes = async (acctEmail: string | undefined, addScopes: string[]): Promise<string[]> => {
    if (acctEmail) {
      const { google_token_scopes } = await AcctStore.get(acctEmail, ['google_token_scopes']);
      addScopes.push(...(google_token_scopes || []));
    }
    addScopes = Value.arr.unique(addScopes);
    if (addScopes.includes(GoogleAuth.OAUTH.legacy_scopes.read) && addScopes.includes(GoogleAuth.OAUTH.scopes.modify)) {
      addScopes = Value.arr.withoutVal(addScopes, GoogleAuth.OAUTH.legacy_scopes.read); // modify scope is a superset of read scope
    }
    if (!addScopes.includes(GoogleAuth.OAUTH.scopes.email)) {
      addScopes.push(GoogleAuth.OAUTH.scopes.email);
    }
    if (!addScopes.includes(GoogleAuth.OAUTH.scopes.openid)) {
      addScopes.push(GoogleAuth.OAUTH.scopes.openid);
    }
    if (!addScopes.includes(GoogleAuth.OAUTH.scopes.profile)) {
      addScopes.push(GoogleAuth.OAUTH.scopes.profile);
    }
    // todo - remove these following lines once "modify" scope is verified
    if (addScopes.includes(GoogleAuth.OAUTH.scopes.modify)) {
      addScopes = Value.arr.withoutVal(addScopes, GoogleAuth.OAUTH.scopes.modify);
      addScopes.push(GoogleAuth.OAUTH.legacy_scopes.read);
    }
    return addScopes;
  }

}
