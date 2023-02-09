/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { BrowserMsg } from '../../../browser/browser-msg.js';
import { Env } from '../../../browser/env.js';
import { Buf } from '../../../core/buf.js';
import { Url } from '../../../core/common.js';
import { GOOGLE_OAUTH_SCREEN_HOST, InMemoryStoreKeys, OAUTH_GOOGLE_API_HOST } from '../../../core/const.js';
import { Catch } from '../../../platform/catch.js';
import { AcctStore, AcctStoreDict } from '../../../platform/store/acct-store.js';
import { InMemoryStore } from '../../../platform/store/in-memory-store.js';
import { AjaxErr, GoogleAuthErr } from '../../shared/api-error.js';
import { GmailRes } from './gmail-parser.js';

type RawAjaxErr = {
  // getAllResponseHeaders?: () => any,
  // getResponseHeader?: (e: string) => any,
  readyState: number;
  responseText?: string;
  status?: number;
  statusText?: string;
};
/* eslint-disable @typescript-eslint/naming-convention */
type GoogleAuthTokensResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  id_token: string;
  token_type: 'Bearer';
};
export type AuthReq = { acctEmail?: string; scopes: string[]; messageId?: string; expectedState: string };

export class GoogleAuthHelper {
  /* eslint-disable @typescript-eslint/naming-convention */
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
    },
  };
  /* eslint-enable @typescript-eslint/naming-convention */

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

  public static googleApiAuthHeader = async (acctEmail: string, forceRefresh = false): Promise<string> => {
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
        return `Bearer ${googleAccessToken}`;
      }
    }
    // refresh token
    const refreshTokenRes = await GoogleAuthHelper.googleAuthRefreshToken(google_token_refresh);
    if (refreshTokenRes.access_token) {
      await GoogleAuthHelper.googleAuthSaveTokens(acctEmail, refreshTokenRes);
      const googleAccessToken = await InMemoryStore.get(acctEmail, InMemoryStoreKeys.GOOGLE_TOKEN_ACCESS);
      if (googleAccessToken) {
        return `Bearer ${googleAccessToken}`;
      }
    }
    throw new GoogleAuthErr(
      `Could not refresh google auth token - did not become valid (access:${refreshTokenRes.access_token},expires_in:${
        refreshTokenRes.expires_in
      },now:${Date.now()})`
    );
  };

  public static googleAuthSaveTokens = async (acctEmail: string, tokensObj: GoogleAuthTokensResponse) => {
    const parsedOpenId = GoogleAuthHelper.parseIdToken(tokensObj.id_token);
    const { full_name, picture } = await AcctStore.get(acctEmail, ['full_name', 'picture']); // eslint-disable-line @typescript-eslint/naming-convention
    const googleTokenExpires = new Date().getTime() + ((tokensObj.expires_in as number) - 120) * 1000; // let our copy expire 2 minutes beforehand
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
  };

  public static apiGoogleAuthCodeUrl = (authReq: AuthReq) => {
    /* eslint-disable @typescript-eslint/naming-convention */
    return Url.create(GoogleAuthHelper.OAUTH.url_code, {
      client_id: GoogleAuthHelper.OAUTH.client_id,
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      state: authReq.expectedState,
      redirect_uri: GoogleAuthHelper.OAUTH.redirect_uri,
      scope: (authReq.scopes || []).join(' '),
      login_hint: authReq.acctEmail,
    });
    /* eslint-enable @typescript-eslint/naming-convention */
  };

  public static googleAuthRefreshToken = async (refreshToken: string) => {
    return (await GoogleAuthHelper.ajax(
      {
        /* eslint-disable @typescript-eslint/naming-convention */
        url: Url.create(GoogleAuthHelper.OAUTH.url_tokens, {
          grant_type: 'refresh_token',
          refreshToken,
          client_id: GoogleAuthHelper.OAUTH.client_id,
          client_secret: GoogleAuthHelper.OAUTH.client_secret,
        }),
        /* eslint-enable @typescript-eslint/naming-convention */
        method: 'POST',
        crossDomain: true,
        async: true,
      },
      Catch.stackTrace()
    )) as unknown as GoogleAuthTokensResponse;
  };

  public static googleAuthGetTokens = async (code: string) => {
    return (await GoogleAuthHelper.ajax(
      {
        /* eslint-disable @typescript-eslint/naming-convention */
        url: Url.create(GoogleAuthHelper.OAUTH.url_tokens, {
          grant_type: 'authorization_code',
          code,
          client_id: GoogleAuthHelper.OAUTH.client_id,
          client_secret: GoogleAuthHelper.OAUTH.client_secret,
          redirect_uri: GoogleAuthHelper.OAUTH.redirect_uri,
        }),
        /* eslint-enable @typescript-eslint/naming-convention */
        method: 'POST',
        crossDomain: true,
        async: true,
      },
      Catch.stackTrace()
    )) as unknown as GoogleAuthTokensResponse;
  };

  /// Duplicated code begin
  // This logic was duplicated (It's exactly same as Api.ajax) but added here because we can't use Api.ajax here as it will cause circular dependency warning
  private static ajax = async (req: JQueryAjaxSettings, stack: string): Promise<unknown | JQuery.jqXHR<unknown>> => {
    if (Env.isContentScript()) {
      // content script CORS not allowed anymore, have to drag it through background page
      // https://www.chromestatus.com/feature/5629709824032768
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return await BrowserMsg.send.bg.await.ajax({ req, stack });
    }
    try {
      return await new Promise((resolve, reject) => {
        GoogleAuthHelper.throwIfApiPathTraversalAttempted(req.url || '');
        $.ajax({ ...req, dataType: req.dataType === 'xhr' ? undefined : req.dataType })
          .then((data, s, xhr) => {
            if (req.dataType === 'xhr') {
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore -> prevent the xhr object from getting further "resolved" and processed by jQuery, below
              xhr.then = xhr.promise = undefined;
              resolve(xhr);
            } else {
              resolve(data as unknown);
            }
          })
          .catch(reject);
      });
    } catch (e) {
      if (e instanceof Error) {
        throw e;
      }
      if (GoogleAuthHelper.isRawAjaxErr(e)) {
        throw AjaxErr.fromXhr(e, req, stack);
      }
      throw new Error(`Unknown Ajax error (${String(e)}) type when calling ${req.url}`);
    }
  };

  private static isRawAjaxErr = (e: unknown): e is RawAjaxErr => {
    return !!e && typeof e === 'object' && typeof (e as RawAjaxErr).readyState === 'number';
  };

  /**
   * Security check, in case attacker modifies parameters which are then used in an url
   * https://github.com/FlowCrypt/flowcrypt-browser/issues/2646
   */
  private static throwIfApiPathTraversalAttempted = (requestUrl: string) => {
    if (requestUrl.includes('../') || requestUrl.includes('/..')) {
      throw new Error(`API path traversal forbidden: ${requestUrl}`);
    }
  };

  /// Duplicated code end
}
