/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Api, HttpClientErr, Status } from './api';
import { IncomingMessage } from 'http';
import { OauthMock } from './oauth';
import { Data } from './data';
import { ParsedMail } from "mailparser";
import * as http from 'http';
import Parse, { ParseMsgResult } from '../util/parse';
import { DraftSaveModel } from './types';

const oauth = new OauthMock();

const isGet = (r: IncomingMessage) => r.method === 'GET' || r.method === 'HEAD';
const isPost = (r: IncomingMessage) => r.method === 'POST';
const isPut = (r: IncomingMessage) => r.method === 'PUT';
const isDelete = (r: IncomingMessage) => r.method === 'DELETE';
const parseResourceId = (url: string) => url.match(/\/([a-zA-Z0-9\-_]+)(\?|$)/)![1];
const allowedRecipients: Array<string> = ['flowcrypt.compatibility@gmail.com', 'human+manualcopypgp@flowcrypt.com', 'human@flowcrypt.com', 'human+nopgp@flowcrypt.com'];

export const startGoogleApiMock = async (logger: (line: string) => void) => {
  class LoggedApi<REQ, RES> extends Api<REQ, RES> {
    protected log = (req: http.IncomingMessage, res: http.ServerResponse, errRes?: Buffer) => {
      if (req.url !== '/favicon.ico') {
        logger(`${res.statusCode} ${req.method} ${req.url} | ${errRes ? errRes : ''}`);
      }
    }
  }
  const api = new LoggedApi<{ query: { [k: string]: string }, body?: unknown }, unknown>('google-mock', {
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
        const sendAs = [{ sendAsEmail: acct, displayName: 'First Last', replyToAddress: acct, signature: '', isDefault: true, treatAsAlias: false, verificationStatus: 'accepted' }];
        if (acct === 'flowcrypt.compatibility@gmail.com') {
          const alias = 'flowcryptcompatibility@gmail.com';
          sendAs.push({ sendAsEmail: alias, displayName: 'An Alias', replyToAddress: alias, signature: '', isDefault: false, treatAsAlias: false, verificationStatus: 'accepted' });
        }
        return { sendAs };
      }
      throw new HttpClientErr(`Method not implemented for ${req.url}: ${req.method}`);
    },
    '/gmail/v1/users/me/messages': async ({ query: { q } }, req) => { // search messages
      const acct = oauth.checkAuthorizationHeader(req.headers.authorization);
      if (isGet(req) && q) {
        const msgs = new Data(acct).searchMessages(q);
        return { messages: msgs.map(({ id, threadId }) => ({ id, threadId })), resultSizeEstimate: msgs.length };
      }
      throw new HttpClientErr(`Method not implemented for ${req.url}: ${req.method}`);
    },
    '/gmail/v1/users/me/messages/?': async ({ query: { format } }, req) => { // get msg or attachment
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
      if (isGet(req) && (format === 'metadata' || format === 'full')) {
        const id = parseResourceId(req.url!);
        const msgs = new Data(acct).getMessagesByThread(id);
        if (!msgs.length) {
          throw new HttpClientErr(`MOCK thread not found for ${acct}: ${id}`, 400);
        }
        return { id, historyId: msgs[0].historyId, messages: msgs.map(m => Data.fmtMsg(m, format)) };
      }
    },
    '/upload/gmail/v1/users/me/messages/send?uploadType=multipart': async (parsedReq, req) => {
      const acct = oauth.checkAuthorizationHeader(req.headers.authorization);
      if (isPost(req)) {
        if (parsedReq.body && typeof parsedReq.body === 'string') {
          const parseResult = await parseMultipartDataAsMimeMsg(parsedReq.body);
          await validateMimeMsg(acct, parseResult.mimeMsg, parseResult.threadId);
          return { id: 'mockfakesend', labelIds: ['SENT'], threadId: parseResult.threadId };
        }
      }
      throw new HttpClientErr(`Method not implemented for ${req.url}: ${req.method}`);
    },
    '/gmail/v1/users/me/drafts': async (parsedReq, req) => {
      if (isPost(req)) {
        const acct = oauth.checkAuthorizationHeader(req.headers.authorization);
        const body = parsedReq.body as DraftSaveModel;
        if (body && body.message && body.message.raw
          && typeof body.message.raw === 'string') {
          if (body.message.threadId && !new Data(acct).getThreads().find(t => t.id === body.message.threadId)) {
            throw new HttpClientErr('The thread you are replying to not found', 404);
          }
          return {
            id: 'mockfakedraftsave', message: {
              id: 'mockfakedmessageraftsave',
              labelIds: ['DRAFT'],
              threadId: body.message.threadId
            }
          };
        }
      }
      throw new HttpClientErr(`Method not implemented for ${req.url}: ${req.method}`);
    },
    '/gmail/v1/users/me/drafts/?': async (parsedReq, req) => {
      const id = parseResourceId(req.url!);
      if (isGet(req)) {
        throw new HttpClientErr(`MOCK drafts not recorded, giving fake 404`, Status.NOT_FOUND);
      } else if (isPut(req)) {
        return {};
      } else if (isDelete(req)) {
        return {};
      }
      throw new HttpClientErr(`Method not implemented for ${req.url}: ${req.method}`);
    },
    '/favicon.ico': async () => '',
  });
  await api.listen(8001);
  return api;
};

const parseMultipartDataAsMimeMsg = async (multipartData: string): Promise<ParseMsgResult> => {
  let parsed: ParseMsgResult;
  try {
    parsed = await Parse.strictParse(multipartData);
  } catch (e) {
    if (e instanceof Error) {
      throw new HttpClientErr(e.message, 400);
    }
    throw new HttpClientErr('Unknown error', 500);
  }
  return parsed;
};

const validateMimeMsg = async (acct: string, mimeMsg: ParsedMail, threadId?: string) => {
  if (threadId) {
    const messages = new Data(acct).getMessagesByThread(threadId);
    if (!messages || !messages.length) {
      throw new HttpClientErr('The thread you are replying to not found', 404);
    }
    const inReplyToMessageId = mimeMsg.headers.get('in-reply-to') ? mimeMsg.headers.get('in-reply-to')!.toString() : '';
    if (inReplyToMessageId) {
      let isMessageExists = false;
      for (const message of messages) {
        if (message.raw) {
          const parsedMimeMsg = await Parse.convertBase64ToMimeMsg(message.raw);
          if (parsedMimeMsg.messageId === inReplyToMessageId) {
            isMessageExists = true;
            break;
          }
        }
      }
      if (!isMessageExists) {
        throw new HttpClientErr(`Error: suplied In-Reply-To header (${inReplyToMessageId}) does not match any messages present in the mock data for thread ${threadId}`, 400);
      }
    } else {
      throw new HttpClientErr(`Error: 'In-Reply-To' must not be empty if there is 'threadId'(${threadId})`, 400);
    }
  }
  if (!mimeMsg.subject) {
    throw new HttpClientErr('Subject line is required', 400);
  }
  if (!mimeMsg.text) {
    throw new HttpClientErr('Message body is required', 400);
  }
  if (!mimeMsg.to.value.length || mimeMsg.to.value.find(em => !allowedRecipients.includes(em.address))) {
    throw new HttpClientErr('You can\'t send a message to unexisting email address(es)');
  }
  const aliases = [acct];
  if (acct === 'flowcrypt.compatibility@gmail.com') {
    aliases.push('flowcryptcompatibility@gmail.com');
  }
  if (!mimeMsg.from.value.length || mimeMsg.from.value.find(em => !aliases.includes(em.address))) {
    throw new HttpClientErr('You can\'t send a message from unexisting email address(es)');
  }
};
