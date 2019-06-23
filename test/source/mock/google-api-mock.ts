/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Api, HttpClientErr, Status } from './api';
import { IncomingMessage } from 'http';
import { OauthMock } from './oauth';
import { Data } from './data';

const oauth = new OauthMock();

const isGet = (r: IncomingMessage) => r.method === 'GET' || r.method === 'HEAD';
const isPost = (r: IncomingMessage) => r.method === 'POST';
const parseResourceId = (url: string) => url.match(/\/([a-zA-Z0-9\-_]+)(\?|$)/)![1];

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
      throw new HttpClientErr(`Method not implemented for ${req.url}: ${req.method}`);
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
      throw new HttpClientErr(`Method not implemented for ${req.url}: ${req.method}`);
    },
    '/gmail/v1/users/me/profile': async (parsedReq, req) => {
      const acct = oauth.checkAuthorizationHeader(req.headers.authorization);
      if (isGet(req)) {
        return { emailAddress: acct, historyId: 'historyId', messagesTotal: 100, threadsTotal: 20 };
      }
      throw new HttpClientErr(`Method not implemented for ${req.url}: ${req.method}`);
    },
    '/gmail/v1/users/me/settings/sendAs': async (parsedReq, req) => {
      const acct = oauth.checkAuthorizationHeader(req.headers.authorization);
      if (isGet(req)) {
        return { sendAs: [{ sendAsEmail: acct, displayName: 'First Last', replyToAddress: acct, signature: '', isDefault: true, treatAsAlias: false, verificationStatus: 'accepted' }] };
      }
      throw new HttpClientErr(`Method not implemented for ${req.url}: ${req.method}`);
    },
    '/gmail/v1/users/me/messages': async ({ query: { q } }, req) => {
      const acct = oauth.checkAuthorizationHeader(req.headers.authorization);
      if (isGet(req) && q && q.includes('subject:"Your FlowCrypt Backup"')) {
        const msgs = new Data(acct).searchMessages('Your FlowCrypt Backup');
        return { messages: msgs.map(({ id, threadId }) => ({ id, threadId })), sizeEstimate: msgs.length };
      }
      throw new HttpClientErr(`Method not implemented for ${req.url}: ${req.method}`);
    },
    '/gmail/v1/users/me/messages/?': async ({ query: { format } }, req) => {
      const acct = oauth.checkAuthorizationHeader(req.headers.authorization);
      if (isGet(req)) {
        const id = parseResourceId(req.url!);
        const data = new Data(acct);
        if (req.url!.includes('/attachments/')) {
          const att = data.getAttachment(id);
          if (att) {
            return att;
          }
          throw new HttpClientErr(`MOCK attachment not found for ${acct}: ${id}`, Status.NOT_FOUND);
        }
        const msg = data.getMessage(id);
        if (msg) {
          return Data.fmtMsg(msg, format);
        }
        throw new HttpClientErr(`MOCK Message not found for ${acct}: ${id}`, Status.NOT_FOUND);
      }
      throw new HttpClientErr(`Method not implemented for ${req.url}: ${req.method}`);
    },
    '/gmail/v1/users/me/labels': async (parsedReq, req) => {
      const acct = oauth.checkAuthorizationHeader(req.headers.authorization);
      if (isGet(req)) {
        return { labels: new Data(acct).getLabels() };
      }
      throw new HttpClientErr(`Method not implemented for ${req.url}: ${req.method}`);
    },
    '/gmail/v1/users/me/threads': async ({ query: { labelIds, includeSpamTrash } }, req) => {
      const acct = oauth.checkAuthorizationHeader(req.headers.authorization);
      if (isGet(req)) {
        const threads = new Data(acct).getThreads();
        return { threads, resultSizeEstimate: threads.length };
      }
      throw new HttpClientErr(`Method not implemented for ${req.url}: ${req.method}`);
    },
    '/gmail/v1/users/me/threads/?': async ({ query: { format } }, req) => {
      const acct = oauth.checkAuthorizationHeader(req.headers.authorization);
      if (isGet(req) && format === 'metadata') {
        const id = parseResourceId(req.url!);
        const msgs = new Data(acct).getMessagesByThread(id);
        if (!msgs.length) {
          throw new HttpClientErr(`MOCK thread not found for ${acct}: ${id}`);
        }
        return { id, historyId: msgs[0].historyId, messages: msgs.map(m => Data.fmtMsg(m, format)) };
      }
      throw new HttpClientErr(`Method not implemented for ${req.url}: ${req.method}`);
    },
    '/favicon.ico': async () => '',
  });
  await api.listen(8001);
};
