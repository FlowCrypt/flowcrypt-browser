/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Ui } from '../../browser/ui.js';
import { AuthRes, OAuth, OAuthTokensResponse } from './generic/oauth.js';
import { AuthenticationConfiguration } from '../../authentication-configuration.js';
import { Url } from '../../core/common.js';
import { Assert, AssertError } from '../../assert.js';
import { Api } from '../shared/api.js';
import { Catch } from '../../platform/catch.js';
import { InMemoryStoreKeys } from '../../core/const.js';
import { InMemoryStore } from '../../platform/store/in-memory-store.js';
import { AcctStore } from '../../platform/store/acct-store.js';
export class ConfiguredIdpOAuth extends OAuth {
  public static newAuthPopupForEnterpriseServerAuthenticationIfNeeded = async (authRes: AuthRes) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const acctEmail = authRes.acctEmail!;
    const storage = await AcctStore.get(acctEmail, ['authentication']);
    if (storage?.authentication?.oauth?.clientId && storage.authentication.oauth.clientId !== this.GOOGLE_OAUTH_CONFIG.client_id) {
      await Ui.modal.info('Google login succeeded. Now, please log in with your company credentials as well.');
      return await this.newAuthPopup(acctEmail, { oauth: storage.authentication.oauth });
    }
    return authRes;
  };

  public static async newAuthPopup(acctEmail: string, authConf: AuthenticationConfiguration): Promise<AuthRes> {
    acctEmail = acctEmail.toLowerCase();
    const authRequest = this.newAuthRequest(acctEmail, this.OAUTH_REQUEST_SCOPES);
    const authUrl = this.apiOAuthCodeUrl(authConf, authRequest.expectedState, acctEmail);
    const authRes = await this.getAuthRes({
      acctEmail,
      expectedState: authRequest.expectedState,
      authUrl,
      authConf,
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

  private static apiOAuthCodeUrl(authConf: AuthenticationConfiguration, state: string, acctEmail: string) {
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

  private static async getAuthRes({
    acctEmail,
    expectedState,
    authUrl,
    authConf,
  }: {
    acctEmail: string;
    expectedState: string;
    authUrl: string;
    authConf: AuthenticationConfiguration;
  }): Promise<AuthRes> {
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
      const { id_token } = await this.authGetTokens(code, authConf);
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
      await InMemoryStore.set(acctEmail, InMemoryStoreKeys.CUSTOM_IDP_ID_TOKEN, id_token);
      return { acctEmail: email, result: 'Success', id_token };
    } catch (err) {
      return { acctEmail, result: 'Error', error: err instanceof AssertError ? 'Could not parse URL returned from OAuth' : String(err), id_token: undefined };
    }
    /* eslint-enable @typescript-eslint/naming-convention */
  }

  private static async authGetTokens(code: string, authConf: AuthenticationConfiguration): Promise<OAuthTokensResponse> {
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
}
