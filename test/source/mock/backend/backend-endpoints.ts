/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { HttpAuthErr, HttpClientErr } from '../lib/api';

import { BackendData } from './backend-data';
import { Dict } from '../../core/common';
import { HandlersDefinition } from '../all-apis-mock';
import { IncomingMessage } from 'http';
import { isPost } from '../lib/mock-util';
import { oauth } from '../lib/oauth';
import { expect } from 'chai';

export const mockBackendData = new BackendData(oauth);

export const mockBackendEndpoints: HandlersDefinition = {
  '/api/account/login': async ({ body }, req) => {
    const parsed = throwIfNotPostWithAuth(body, req);
    const idToken = req.headers.authorization?.replace(/^Bearer /, '');
    if (!idToken) {
      throw new HttpClientErr('backend mock: Missing id_token');
    }
    mockBackendData.registerOrThrow(parsed.account, parsed.uuid, idToken);
    return JSON.stringify({
      registered: true,
      verified: true,
      subscription: mockBackendData.getSubscription(parsed.account),
    });
  },
  '/api/account/get': async ({ body }, req) => {
    const parsed = throwIfNotPostWithAuth(body, req);
    mockBackendData.checkUuidOrThrow(parsed.account, parsed.uuid);
    return JSON.stringify({
      account: mockBackendData.getAcctRow(parsed.account),
      subscription: mockBackendData.getSubscription(parsed.account),
      domain_org_rules: mockBackendData.getOrgRules(parsed.account),
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

const throwIfNotPostWithAuth = (body: unknown, req: IncomingMessage) => {
  const parsed = body as Dict<any>;
  if (!isPost(req)) {
    throw new HttpClientErr('Backend mock calls must use POST method');
  }
  if (!parsed.account) {
    throw new HttpAuthErr('Backend mock call missing value: account');
  }
  if (!parsed.uuid) {
    throw new HttpAuthErr('Backend mock call missing value: uuid');
  }
  return parsed;
};
