/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { HttpAuthErr, HttpClientErr } from '../lib/api';

import { BackendData } from './backend-data';
import { Dict } from '../../core/common';
import { HandlersDefinition } from '../all-apis-mock';
import { IncomingMessage } from 'http';
import { isPost } from '../lib/mock-util';
import { oauth } from '../lib/oauth';
import { expect } from 'chai';
import { Buf } from '../../core/buf';

export const mockBackendData = new BackendData();

export const mockBackendEndpoints: HandlersDefinition = {
  '/api/account/login': async ({ }, req) => {
    throwIfNotPost(req);
    throwIfIdTokenIsInvalid(req);
    return JSON.stringify({
      registered: true,
      verified: true
    });
  },
  '/api/account/get': async ({ }, req) => {
    throwIfNotPost(req);
    const { email } = throwIfIdTokenIsInvalid(req);
    return JSON.stringify({
      account: mockBackendData.getAcctRow(email!),
      domain_org_rules: mockBackendData.getClientConfiguration(email!),
    });
  },
  '/api/account/update': async ({ }, req) => {
    throw new Error(`${req.url} mock not implemented`);
  },
  '/api/account/subscribe': async ({ }, req) => {
    throw new Error(`${req.url} mock not implemented`);
  },
  '/api/message/token': async () => {
    return { token: 'MT_xMOCKTOKEN' };
  },
  '/api/help/error': async ({ body }) => {
    mockBackendData.reportedErrors.push(body as any);
    return { saved: true };
  },
  '/api/help/feedback': async ({ body }) => {
    expect((body as any).email).to.equal('flowcrypt.compatibility@gmail.com');
    return { sent: true, text: 'Feedback sent' };
  },
  '/api/message/upload': async ({ }) => {
    return { short: 'mockmsg000' };
  },
  '/api/link/me': async ({ }, req) => {
    throw new Error(`${req.url} mock not implemented`);
  },
};

interface OpenId {
  name: string;
  email?: string;
  email_verified?: boolean;
}

const throwIfNotPost = (req: IncomingMessage) => {
  if (!isPost(req)) {
    throw new HttpClientErr('Backend mock calls must use POST method');
  }
};

const throwIfIdTokenIsInvalid = (req: IncomingMessage) => {
  const idToken = req.headers.authorization?.replace(/^Bearer /, '');
  if (!idToken) {
    throw new HttpClientErr('backend mock: Missing id_token');
  }
  if (!oauth.isIdTokenValid(idToken)) {
    throw new HttpAuthErr(`Could not verify mock idToken: ${idToken}`);
  }
  return parseIdToken(idToken);
};

const parseIdToken = (idToken: string): OpenId => {
  const claims = JSON.parse(Buf.fromBase64UrlStr(idToken.split(/\./g)[1]).toUtfStr()) as OpenId;
  if (claims.email) {
    claims.email = claims.email.toLowerCase();
    if (!claims.email_verified) {
      throw new Error(`id_token email_verified is false for email ${claims.email}`);
    }
  }
  return claims;
};