/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Ui } from '../../browser/ui.js';
import { AuthorizationHeader, AuthRes, OAuth, OAuthTokensResponse } from './generic/oauth.js';
import { AuthenticationConfiguration } from '../../authentication-configuration.js';
import { Url } from '../../core/common.js';
import { Assert, AssertError } from '../../assert.js';
import { Api } from '../shared/api.js';
import { Catch } from '../../platform/catch.js';
import { InMemoryStoreKeys } from '../../core/const.js';
import { InMemoryStore } from '../../platform/store/in-memory-store.js';
import { AcctStore, AcctStoreDict } from '../../platform/store/acct-store.js';
import { EnterpriseServerAuthErr } from '../shared/api-error.js';
export class ConfiguredIdpOAuth extends OAuth {
  public static newAuthPopupForEnterpriseServerAuthenticationIfNeeded = async (authRes: AuthRes) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const acctEmail = authRes.acctEmail!;
    const storage = await AcctStore.get(acctEmail, ['authentication']);
    if (storage?.authentication?.oauth?.clientId && storage.authentication.oauth.clientId !== this.GOOGLE_OAUTH_CONFIG.client_id) {
      await Ui.modal.info('Google login succeeded. Now, please log in with your company credentials as well.');
      return await this.newAuthPopup(acctEmail);
    }
    return authRes;
  };

  public static authHdr = async (acctEmail: string, shouldThrowErrorForEmptyIdToken = true, forceRefresh = false): Promise<AuthorizationHeader | undefined> => {
    const { custom_idp_token_refresh } = await AcctStore.get(acctEmail, ['custom_idp_token_refresh']); // eslint-disable-line @typescript-eslint/naming-convention
    if (!forceRefresh) {
      const authHdr = await this.getAuthHeaderDependsOnType(acctEmail);
      if (authHdr) {
        return authHdr;
      }
    }
    if (!custom_idp_token_refresh) {
      if (shouldThrowErrorForEmptyIdToken) {
        throw new EnterpriseServerAuthErr(`Account ${acctEmail} not connected to FlowCrypt Browser Extension`);
      }
      return undefined;
    }
    // refresh token
    const refreshTokenRes = await this.authRefreshToken(custom_idp_token_refresh, acctEmail);
    if (refreshTokenRes.access_token) {
      await this.authSaveTokens(acctEmail, refreshTokenRes);
      const authHdr = await this.getAuthHeaderDependsOnType(acctEmail);
      if (authHdr) {
        return authHdr;
      }
    }
    if (shouldThrowErrorForEmptyIdToken) {
      // user will not actually see this message, they'll see a generic login prompt
      throw new EnterpriseServerAuthErr(
        `Could not refresh custom idp auth token - did not become valid (access:${refreshTokenRes.id_token},expires_in:${
          refreshTokenRes.expires_in
        },now:${Date.now()})`
      );
    }
    return undefined;
  };

  public static async newAuthPopup(acctEmail: string): Promise<AuthRes> {
    acctEmail = acctEmail.toLowerCase();
    const authRequest = this.newAuthRequest(acctEmail, this.OAUTH_REQUEST_SCOPES);
    const authUrl = await this.apiOAuthCodeUrl(authRequest.expectedState, acctEmail);
    const authRes = await this.getAuthRes({
      acctEmail,
      expectedState: authRequest.expectedState,
      authUrl,
    });
    if (authRes.result === 'Success') {
      if (!authRes.id_token) {
        return {
          result: 'Error',
          error: 'Grant was successful but missing id_token',
          acctEmail,
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
    }
    return authRes;
  }

  private static async authRefreshToken(refreshToken: string, acctEmail: string): Promise<OAuthTokensResponse> {
    const authConf = await this.getAuthenticationConfiguration(acctEmail);
    return await Api.ajax(
      {
        /* eslint-disable @typescript-eslint/naming-convention */
        url: authConf.oauth.tokensUrl,
        method: 'POST',
        data: {
          grant_type: 'refresh_token',
          refreshToken,
          client_id: authConf.oauth.clientId,
          redirect_uri: chrome.identity.getRedirectURL('oauth'),
        },
        dataType: 'JSON',
        /* eslint-enable @typescript-eslint/naming-convention */
        stack: Catch.stackTrace(),
      },
      'json'
    );
  }

  private static async apiOAuthCodeUrl(state: string, acctEmail: string) {
    const authConf = await this.getAuthenticationConfiguration(acctEmail);
    /* eslint-disable @typescript-eslint/naming-convention */
    return Url.create(authConf.oauth.authCodeUrl, {
      client_id: authConf.oauth.clientId,
      response_type: 'code',
      access_type: 'offline',
      prompt: 'login',
      state,
      redirect_uri: chrome.identity.getRedirectURL('oauth'),
      scope: this.OAUTH_REQUEST_SCOPES.join(' '),
      login_hint: acctEmail,
    });
    /* eslint-enable @typescript-eslint/naming-convention */
  }

  private static async getAuthRes({ acctEmail, expectedState, authUrl }: { acctEmail: string; expectedState: string; authUrl: string }): Promise<AuthRes> {
    /* eslint-disable @typescript-eslint/naming-convention */
    try {
      const redirectUri = await chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true });
      if (chrome.runtime.lastError || !redirectUri || redirectUri?.includes('access_denied')) {
        return { acctEmail, result: 'Denied', error: `Failed to launch web auth flow`, id_token: undefined };
      }

      if (!redirectUri) {
        return { acctEmail, result: 'Denied', error: 'Invalid response url', id_token: undefined };
      }
      const uncheckedUrlParams = Url.parse(['scope', 'code', 'state'], redirectUri);
      const code = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'code');
      const receivedState = Assert.urlParamRequire.string(uncheckedUrlParams, 'state');
      if (!code) {
        return {
          acctEmail,
          result: 'Denied',
          error: "OAuth result was 'Success' but no auth code",
          id_token: undefined,
        };
      }
      if (receivedState !== expectedState) {
        return { acctEmail, result: 'Error', error: `Wrong oauth CSRF token. Please try again.`, id_token: undefined };
      }
      const { id_token } = await this.retrieveAndSaveAuthToken(acctEmail, code);
      const { email } = this.parseIdToken(id_token);
      if (!email) {
        throw new Error('Missing email address in id_token');
      }
      if (acctEmail !== email) {
        return {
          acctEmail,
          result: 'Error',
          error: `Google account email and custom IDP email do not match. Please use the same email address..`,
          id_token: undefined,
        };
      }
      return { acctEmail: email, result: 'Success', id_token };
    } catch (err) {
      return { acctEmail, result: 'Error', error: err instanceof AssertError ? 'Could not parse URL returned from OAuth' : String(err), id_token: undefined };
    }
    /* eslint-enable @typescript-eslint/naming-convention */
  }

  // eslint-disable-next-line @typescript-eslint/naming-convention
  private static async retrieveAndSaveAuthToken(acctEmail: string, authCode: string): Promise<{ id_token: string }> {
    const tokensObj = await this.authGetTokens(acctEmail, authCode);
    const claims = this.parseIdToken(tokensObj.id_token);
    if (!claims.email) {
      throw new Error('Missing email address in id_token');
    }
    await this.authSaveTokens(claims.email, tokensObj);
    return { id_token: tokensObj.id_token }; // eslint-disable-line @typescript-eslint/naming-convention
  }

  private static async authSaveTokens(acctEmail: string, tokensObj: OAuthTokensResponse) {
    const tokenExpires = new Date().getTime() + (tokensObj.expires_in - 120) * 1000; // let our copy expire 2 minutes beforehand
    const toSave: AcctStoreDict = {};
    if (typeof tokensObj.refresh_token !== 'undefined') {
      toSave.custom_idp_token_refresh = tokensObj.refresh_token;
    }
    await AcctStore.set(acctEmail, toSave);
    await InMemoryStore.set(acctEmail, InMemoryStoreKeys.CUSTOM_IDP_ID_TOKEN, tokensObj.id_token, tokenExpires);
  }

  private static async authGetTokens(acctEmail: string, code: string): Promise<OAuthTokensResponse> {
    const authConf = await this.getAuthenticationConfiguration(acctEmail);
    return await Api.ajax(
      {
        /* eslint-disable @typescript-eslint/naming-convention */
        url: authConf.oauth.tokensUrl,
        method: 'POST',
        data: {
          grant_type: 'authorization_code',
          code,
          client_id: authConf.oauth.clientId,
          redirect_uri: chrome.identity.getRedirectURL('oauth'),
        },
        dataType: 'JSON',
        /* eslint-enable @typescript-eslint/naming-convention */
        stack: Catch.stackTrace(),
      },
      'json'
    );
  }

  private static async getAuthenticationConfiguration(acctEmail: string): Promise<AuthenticationConfiguration> {
    const storage = await AcctStore.get(acctEmail, ['authentication']);
    if (!storage.authentication) {
      throw new EnterpriseServerAuthErr('Could not get authentication configuration');
    }
    return storage.authentication;
  }

  private static async getAuthHeaderDependsOnType(acctEmail: string): Promise<AuthorizationHeader | undefined> {
    let idToken = await InMemoryStore.getUntilAvailable(acctEmail, InMemoryStoreKeys.ID_TOKEN);
    const storage = await AcctStore.get(acctEmail, ['authentication']);
    if (storage.authentication?.oauth) {
      // If custom authentication (IDP) is used, return the custom IDP ID token if available.
      // If the custom IDP ID token is not found, throw an EnterpriseServerAuthErr.
      // The custom IDP ID token should be used for Enterprise Server authentication instead of the Google JWT.
      // https://github.com/FlowCrypt/flowcrypt-browser/issues/5799
      idToken = await InMemoryStore.get(acctEmail, InMemoryStoreKeys.CUSTOM_IDP_ID_TOKEN);
    }
    return idToken ? { authorization: `Bearer ${idToken}` } : undefined;
  }
}
