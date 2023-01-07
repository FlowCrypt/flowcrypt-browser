/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { HttpClientErr } from '../lib/api';

import { expect } from 'chai';
import { IncomingMessage } from 'http';
import { HandlersDefinition } from '../all-apis-mock';
import { isPost } from '../lib/mock-util';
import { BackendData, ReportedError } from './backend-data';
import { oauth } from '../lib/oauth';

export const mockBackendData = new BackendData();

export const mockBackendEndpoints: HandlersDefinition = {
  '/api/account/get': async ({}, req) => {
    throwIfNotPost(req);
    const email = getEmailFromIdTokenOrThrow(req);
    return JSON.stringify({
      account: mockBackendData.getAcctRow(email!), // eslint-disable-line @typescript-eslint/no-non-null-assertion
      domain_org_rules: mockBackendData.getClientConfiguration(email!), // eslint-disable-line @typescript-eslint/naming-convention, @typescript-eslint/no-non-null-assertion
    });
  },
  '/api/account/update': async ({}, req) => {
    throw new Error(`${req.url} mock not implemented`);
  },
  '/api/account/subscribe': async ({}, req) => {
    throw new Error(`${req.url} mock not implemented`);
  },
  '/api/message/token': async () => {
    return { token: 'MT_xMOCKTOKEN' };
  },
  '/api/help/error': async ({ body }) => {
    mockBackendData.reportedErrors.push(body as ReportedError);
    return { saved: true };
  },
  '/api/help/feedback': async ({ body }) => {
    expect((body as { email: string }).email).to.equal('flowcrypt.compatibility@gmail.com');
    return { sent: true, text: 'Feedback sent' };
  },
  '/api/message/upload': async ({}, req) => {
    getEmailFromIdTokenOrThrow(req);
    return { short: 'mockmsg000' };
  },
  '/api/link/me': async ({}, req) => {
    throw new Error(`${req.url} mock not implemented`);
  },
};

const throwIfNotPost = (req: IncomingMessage) => {
  if (!isPost(req)) {
    throw new HttpClientErr('Backend mock calls must use POST method');
  }
};

const getEmailFromIdTokenOrThrow = (req: IncomingMessage) => {
  const idToken = req.headers.authorization?.replace(/^Bearer /, '');
  if (!idToken) {
    throw new HttpClientErr('backend mock: Missing id_token');
  }
  const email = oauth.extractEmailFromIdToken(idToken);
  if (!email) {
    throw new HttpClientErr('Invalid Id token. Missing email.');
  }
  return email;
};
