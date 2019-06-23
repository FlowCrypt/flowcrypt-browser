/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Api, HttpClientErr, Status } from './api';
import { IncomingMessage } from 'http';
import { readFileSync } from 'fs';
import { OauthMock } from './oauth';

const oauth = new OauthMock();

const isGet = (r: IncomingMessage) => r.method === 'GET' || r.method === 'HEAD';

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
    '/gmail/v1/users/me/messages/?': async (parsedReqBody, req) => {
      if (isGet(req)) {
        return asset(req.url!);
      }
      throw new Error(`Method not implemented for ${req.url}: ${req.method}`);
    },
    '/oauth2/v4/token': async ({ query: { grant_type, refreshToken, client_id } }, req) => {
      if (isGet(req) && grant_type === 'refresh_token' && client_id === oauth.clientId) {
        return { access_token: oauth.getAccessToken(refreshToken), expires_in: oauth.expiresIn, token_type: 'Bearer' };
      }
      throw new Error(`Method not implemented for ${req.url}: ${req.method}`);
    },
    '/o/oauth2/auth': async ({ query: { client_id, response_type, access_type, state, redirect_uri, scope, login_hint } }, req) => {
      if (isGet(req) && client_id === oauth.clientId && response_type === 'code' && access_type === 'offline' && state && redirect_uri === oauth.redirectUri && scope) {
        return `<html><body>oauth consent screen: ${login_hint} <button>Approve</button></body></html>`;
      }
      throw new Error(`Method not implemented for ${req.url}: ${req.method}`);
    },
  });
  await api.listen(8001);
};
