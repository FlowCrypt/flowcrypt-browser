/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Url } from '../../../core/common.js';
import { FLAVOR, OAUTH_GOOGLE_API_HOST } from '../../../core/const.js';
import { ApiErr } from '../../shared/api-error.js';
import { Ajax, Api } from '../../shared/api.js';
import { InMemoryStoreKeys } from '../../../core/const.js';
import { CatchHelper } from '../../../platform/catch-helper.js';
import { AcctStore, AcctStoreDict } from '../../../platform/store/acct-store.js';
import { InMemoryStore } from '../../../platform/store/in-memory-store.js';
import { AccountServer } from '../../account-server.js';
import { AuthorizationHeader, AuthReq, AuthRes, OAuth, OAuthTokensResponse } from '../generic/oauth.js';
import { ExternalService } from '../../account-servers/external-service.js';
import { GoogleAuthErr } from '../../shared/api-error.js';
import { Assert, AssertError } from '../../../assert.js';
import { ConfiguredIdpOAuth } from '../configured-idp-oauth.js';

// eslint-disable-next-line @typescript-eslint/naming-convention
type GoogleTokenInfo = { email: string; scope: string; expires_in: number; token_type: string };

export class GoogleOAuth extends OAuth {
  public static defaultScopes(group: 'default' | 'contacts' = 'default') {
    const { readContacts, readOtherContacts, compose, modify, openid, email, profile } = this.GOOGLE_OAUTH_CONFIG.scopes;
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
  }

  public static async getTokenInfo(accessToken: string): Promise<GoogleTokenInfo> {
    return await Api.ajax(
      {
        url: `${OAUTH_GOOGLE_API_HOST}/tokeninfo?${new URLSearchParams([['access_token', accessToken]]).toString()}`,
        method: 'GET',
        timeout: 10000,
        stack: CatchHelper.stackTrace(),
      },
      'json'
    );
  }

  public static async googleApiAuthHeader(acctEmail: string, forceRefresh = false): Promise<AuthorizationHeader> {
    if (!acctEmail) {
      throw new Error('missing account_email in api_gmail_call');
    }
    const { google_token_refresh } = await AcctStore.get(acctEmail, ['google_token_refresh']); // eslint-disable-line @typescript-eslint/naming-convention
    if (!google_token_refresh) {
      throw new GoogleAuthErr(`Account ${acctEmail} not connected to FlowCrypt Browser Extension`);
    }
    if (!forceRefresh) {
      const googleAccessToken = await InMemoryStore.get(acctEmail, InMemoryStoreKeys.GOOGLE_TOKEN_ACCESS);
      if (googleAccessToken) {
        return { authorization: `Bearer ${googleAccessToken}` };
      }
    }
    // refresh token
    const refreshTokenRes = await GoogleOAuth.authRefreshToken(google_token_refresh);
    if (refreshTokenRes.access_token) {
      await GoogleOAuth.googleAuthSaveTokens(acctEmail, refreshTokenRes);
      const googleAccessToken = await InMemoryStore.get(acctEmail, InMemoryStoreKeys.GOOGLE_TOKEN_ACCESS);
      if (googleAccessToken) {
        return { authorization: `Bearer ${googleAccessToken}` };
      }
    }
    throw new GoogleAuthErr(
      `Could not refresh google auth token - did not become valid (access:${refreshTokenRes.access_token},expires_in:${
        refreshTokenRes.expires_in
      },now:${Date.now()})`
    );
  }

  public static async apiGoogleCallRetryAuthErrorOneTime<RT>(acctEmail: string, req: Ajax): Promise<RT> {
    const performAjaxRequest = async <RT>(req: Ajax): Promise<RT> => {
      // temporary use jquery for upload requests https://github.com/FlowCrypt/flowcrypt-browser/issues/5612
      if (req.progress?.upload) {
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        return await Api.ajaxWithJquery(req, 'json');
      } else {
        return await Api.ajax(req, 'json');
      }
    };

    try {
      return await performAjaxRequest(req);
    } catch (firstAttemptErr) {
      if (ApiErr.isAuthErr(firstAttemptErr)) {
        // force refresh token
        return performAjaxRequest({
          ...req,
          headers: { ...(req.headers ?? {}), ...(await GoogleOAuth.googleApiAuthHeader(acctEmail, true)) },
          stack: CatchHelper.stackTrace(),
        });
      }
      throw firstAttemptErr;
    }
  }

  public static async newAuthPopup({ acctEmail, scopes, save }: { acctEmail?: string; scopes?: string[]; save?: boolean }): Promise<AuthRes> {
    if (acctEmail) {
      acctEmail = acctEmail.toLowerCase();
    }
    if (typeof save === 'undefined') {
      save = true;
    }
    if (save || !scopes) {
      // if tokens will be saved (meaning also scopes should be pulled from storage) or if no scopes supplied
      scopes = GoogleOAuth.apiGoogleAuthPopupPrepareAuthReqScopes(scopes || GoogleOAuth.defaultScopes());
    }
    const authRequest = GoogleOAuth.newAuthRequest(acctEmail, scopes);
    const authUrl = GoogleOAuth.apiGoogleAuthCodeUrl(authRequest);
    const authRes = await GoogleOAuth.getAuthRes({
      acctEmail,
      save,
      requestedScopes: scopes,
      expectedState: authRequest.expectedState,
      authUrl,
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
        return await ConfiguredIdpOAuth.newAuthPopupForEnterpriseServerAuthenticationIfNeeded(authRes);
      } catch (e) {
        if (GoogleOAuth.isFesUnreachableErr(e, authRes.acctEmail)) {
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
  }

  private static async authRefreshToken(refreshToken: string): Promise<OAuthTokensResponse> {
    const url =
      /* eslint-disable @typescript-eslint/naming-convention */
      Url.create(this.GOOGLE_OAUTH_CONFIG.url_tokens, {
        grant_type: 'refresh_token',
        refreshToken,
        client_id: this.GOOGLE_OAUTH_CONFIG.client_id,
        client_secret: this.GOOGLE_OAUTH_CONFIG.client_secret,
      });
    /* eslint-enable @typescript-eslint/naming-convention */
    const req: Ajax = {
      url,
      method: 'POST',
      stack: CatchHelper.stackTrace(),
    };

    return await Api.ajax(req, 'json');
  }

  private static async getAuthRes({
    acctEmail,
    save,
    requestedScopes,
    expectedState,
    authUrl,
  }: {
    acctEmail?: string;
    save: boolean;
    requestedScopes: string[];
    expectedState: string;
    authUrl: string;
  }): Promise<AuthRes> {
    /* eslint-disable @typescript-eslint/naming-convention */
    try {
      const redirectUri = await chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true });
      if (chrome.runtime.lastError || !redirectUri || redirectUri?.includes('access_denied')) {
        const errorMsg = chrome.runtime.lastError?.message || 'access_denied';
        const normalizedErrorMsg = errorMsg.toLowerCase();
        const userCancelled = ['user', 'cancel', 'deny', 'denied', 'close'].some(keyword => normalizedErrorMsg.includes(keyword));
        if (userCancelled) {
          return { acctEmail, result: 'Closed', error: errorMsg, id_token: undefined };
        }
        return { acctEmail, result: 'Denied', error: `Failed to launch web auth flow: ${errorMsg}`, id_token: undefined };
      }
      const uncheckedUrlParams = Url.parse(['scope', 'code', 'state'], redirectUri);
      const allowedScopes = Assert.urlParamRequire.string(uncheckedUrlParams, 'scope');
      const code = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'code');
      const receivedState = Assert.urlParamRequire.string(uncheckedUrlParams, 'state');
      const scopesToCheck = [
        this.GOOGLE_OAUTH_CONFIG.scopes.compose,
        this.GOOGLE_OAUTH_CONFIG.scopes.modify,
        this.GOOGLE_OAUTH_CONFIG.scopes.readContacts,
        this.GOOGLE_OAUTH_CONFIG.scopes.readOtherContacts,
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
      const { id_token } = save ? await GoogleOAuth.retrieveAndSaveAuthToken(code) : await GoogleOAuth.googleAuthGetTokens(code);
      const { email } = GoogleOAuth.parseIdToken(id_token);
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
  }

  private static apiGoogleAuthCodeUrl(authReq: AuthReq) {
    /* eslint-disable @typescript-eslint/naming-convention */
    return Url.create(this.GOOGLE_OAUTH_CONFIG.url_code, {
      client_id: this.GOOGLE_OAUTH_CONFIG.client_id,
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      state: authReq.expectedState,
      redirect_uri: this.getRedirectUri(),
      scope: (authReq.scopes || []).join(' '),
      login_hint: authReq.acctEmail,
    });
    /* eslint-enable @typescript-eslint/naming-convention */
  }

  private static async googleAuthSaveTokens(acctEmail: string, tokensObj: OAuthTokensResponse) {
    const parsedOpenId = GoogleOAuth.parseIdToken(tokensObj.id_token);
    const { full_name, picture } = await AcctStore.get(acctEmail, ['full_name', 'picture']); // eslint-disable-line @typescript-eslint/naming-convention
    const googleTokenExpires = new Date().getTime() + (tokensObj.expires_in - 120) * 1000; // let our copy expire 2 minutes beforehand
    const toSave: AcctStoreDict = {
      full_name: full_name || parsedOpenId.name, // eslint-disable-line @typescript-eslint/naming-convention
      picture: picture || parsedOpenId.picture,
    };
    if (typeof tokensObj.refresh_token !== 'undefined') {
      toSave.google_token_refresh = tokensObj.refresh_token;
    }
    await AcctStore.set(acctEmail, toSave);
    await InMemoryStore.set(acctEmail, InMemoryStoreKeys.ID_TOKEN, tokensObj.id_token);
    await InMemoryStore.set(acctEmail, InMemoryStoreKeys.GOOGLE_TOKEN_ACCESS, tokensObj.access_token, googleTokenExpires);
  }

  private static async googleAuthGetTokens(code: string): Promise<OAuthTokensResponse> {
    return await Api.ajax(
      {
        /* eslint-disable @typescript-eslint/naming-convention */
        url: Url.create(this.GOOGLE_OAUTH_CONFIG.url_tokens, {
          grant_type: 'authorization_code',
          code,
          client_id: this.GOOGLE_OAUTH_CONFIG.client_id,
          client_secret: this.GOOGLE_OAUTH_CONFIG.client_secret,
          redirect_uri: this.getRedirectUri(),
        }),
        /* eslint-enable @typescript-eslint/naming-convention */
        method: 'POST',
        stack: CatchHelper.stackTrace(),
      },
      'json'
    );
  }

  // eslint-disable-next-line @typescript-eslint/naming-convention
  private static async retrieveAndSaveAuthToken(authCode: string): Promise<{ id_token: string }> {
    const tokensObj = await GoogleOAuth.googleAuthGetTokens(authCode);
    const claims = GoogleOAuth.parseIdToken(tokensObj.id_token);
    if (!claims.email) {
      throw new Error('Missing email address in id_token');
    }
    await GoogleOAuth.googleAuthSaveTokens(claims.email, tokensObj);
    return { id_token: tokensObj.id_token }; // eslint-disable-line @typescript-eslint/naming-convention
  }

  private static apiGoogleAuthPopupPrepareAuthReqScopes(addScopes: string[]): string[] {
    if (!addScopes.includes(this.GOOGLE_OAUTH_CONFIG.scopes.email)) {
      addScopes.push(this.GOOGLE_OAUTH_CONFIG.scopes.email);
    }
    if (!addScopes.includes(this.GOOGLE_OAUTH_CONFIG.scopes.openid)) {
      addScopes.push(this.GOOGLE_OAUTH_CONFIG.scopes.openid);
    }
    if (!addScopes.includes(this.GOOGLE_OAUTH_CONFIG.scopes.profile)) {
      addScopes.push(this.GOOGLE_OAUTH_CONFIG.scopes.profile);
    }
    return addScopes;
  }
}
