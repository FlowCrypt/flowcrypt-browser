/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Api, HttpClientErr, Status } from './api';
import { IncomingMessage } from 'http';
import { readFileSync } from 'fs';
import { OauthMock } from './oauth';

const oauth = new OauthMock();

const isGet = (r: IncomingMessage) => r.method === 'GET' || r.method === 'HEAD';
const isPost = (r: IncomingMessage) => r.method === 'POST';

const asset = (url: string): Buffer => {
  const assetPath = `./test/source/mock/data/${url.replace(/[^a-zA-Z0-9_?=]+/g, ' ').trim().replace(/ +/g, '-')}.json`;
  try {
    return readFileSync(assetPath);
  } catch (e) {
    throw new HttpClientErr(`Asset not found for '${url}' at '${assetPath}'`, Status.NOT_FOUND);
  }
};

export const startGoogleApiMock = async () => {
  const api = new Api<{ query: { [k: string]: string }, body?: unknown }, unknown>('google-mock', {
    '/o/oauth2/auth': async ({ query: { client_id, response_type, access_type, state, redirect_uri, scope, login_hint, result } }, req) => {
      if (isGet(req) && client_id === oauth.clientId && response_type === 'code' && access_type === 'offline' && state && redirect_uri === oauth.redirectUri && scope) { // auth screen
        if (!login_hint) {
          return oauth.consentChooseAccountPage(req.url!);
        } else if (!result) {
          return oauth.consentPage(req.url!, login_hint);
        } else {
          return oauth.consentResultPage(login_hint, state, result);
        }
      }
      throw new Error(`Method not implemented for ${req.url}: ${req.method}`);
    },
    '/oauth2/v4/token': async ({ query: { grant_type, refreshToken, client_id, code, redirect_uri } }, req) => {
      if (isPost(req) && grant_type === 'authorization_code' && code && client_id === oauth.clientId) { // auth code from auth screen gets exchanged for access and refresh tokens
        return oauth.getRefreshTokenResponse(code);
      } else if (isPost(req) && grant_type === 'refresh_token' && refreshToken && client_id === oauth.clientId) { // here also later refresh token gets exchanged for access token
        return oauth.getAccessTokenResponse(refreshToken);
      }
      throw new Error(`Method not implemented for ${req.url}: ${req.method}`);
    },
    '/oauth2/v1/tokeninfo': async ({ query: { access_token } }, req) => {
      oauth.checkAuthorizationHeader(`Bearer ${access_token}`);
      if (isGet(req)) {
        return { issued_to: 'issued_to', audience: 'audience', scope: 'scope', expires_in: oauth.expiresIn, access_type: 'offline' };
      }
      throw new Error(`Method not implemented for ${req.url}: ${req.method}`);
    },
    '/gmail/v1/users/me/profile': async (parsedReqBody, req) => {
      const acct = oauth.checkAuthorizationHeader(req.headers.authorization);
      if (isGet(req)) {
        return { emailAddress: acct, historyId: 'historyId', messagesTotal: 100, threadsTotal: 20 };
      }
      throw new Error(`Method not implemented for ${req.url}: ${req.method}`);
    },
    '/gmail/v1/users/me/messages/?': async (parsedReqBody, req) => {
      const acct = oauth.checkAuthorizationHeader(req.headers.authorization);
      if (isGet(req)) {
        return asset(req.url!);
      }
      throw new Error(`Method not implemented for ${req.url}: ${req.method}`);
    },
    '/favicon.ico': async (parsedReqBody, req) => '',
  });
  await api.listen(8001);
};
