/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import * as request from 'fc-node-requests';

import { HttpAuthErr, HttpClientErr } from '../lib/api';

import { BackendData } from './backend-data';
import { Dict } from '../../core/common';
import { HandlersDefinition } from '../all-apis-mock';
import { IncomingMessage } from 'http';
import { isPost } from '../lib/mock-util';
import { oauth } from '../lib/oauth';

export const mockBackendData = new BackendData(oauth);

const fwdToRealBackend = async (parsed: any, req: IncomingMessage): Promise<string> => {
  // we are forwarding this request to backend, but we are not properly authenticated with real backend
  // better remove authentication: requests that we currently forward during tests don't actually require it
  delete req.headers.host;
  delete req.headers['content-length'];
  const forwarding: any = { headers: req.headers, url: `https://flowcrypt.com${req.url}` };
  if (req.url!.includes('message/upload')) {
    // Removing mock auth when forwarding request to real backend at ${req.url}
    // here a bit more difficult, because the request was already encoded as form-data
    parsed.body = (parsed.body as string).replace(/(-----END PGP MESSAGE-----\r\n\r\n------[A-Za-z0-9]+)(.|\r\n)*$/gm, (_, found) => `${found}--\r\n`);
    forwarding.body = parsed.body; // FORM-DATA
    const r = await request.post(forwarding);
    return r.body; // already json-stringified for this call, maybe because backend doesn't return proper content-type
  }
  if (parsed.body && typeof parsed.body === 'object' && parsed.body.account && parsed.body.uuid) {
    // Removing mock auth when forwarding request to real backend at ${req.url}
    delete parsed.body.account;
    delete parsed.body.uuid;
  }
  forwarding.json = parsed.body; // JSON
  const r = await request.post(forwarding);
  return JSON.stringify(r.body);
};

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
  '/api/account/check': async ({ body }, req) => { // todo - this backend call should eventually be deprecated
    const parsed = body as Dict<any>;
    const acct = parsed.emails.pop();
    return JSON.stringify({
      subscription: mockBackendData.getSubscription(acct),
    });
  },
  '/api/account/update': async ({ body }, req) => {
    const parsed = throwIfNotPostWithAuth(body, req);
    throw new Error(`${req.url} mock not implemented`);
  },
  '/api/account/subscribe': async ({ body }, req) => {
    const parsed = throwIfNotPostWithAuth(body, req);
    throw new Error(`${req.url} mock not implemented`);
  },
  '/api/message/token': async ({ body }, req) => {
    const parsed = throwIfNotPostWithAuth(body, req);
    return { token: 'MT_xMOCKTOKEN' };
  },
  '/api/help/error': async ({ body }, req) => {
    mockBackendData.reportedErrors.push(body as any);
    return { saved: true };
  },
  '/api/help/feedback': fwdToRealBackend,
  '/api/message/presign_files': fwdToRealBackend,
  '/api/message/confirm_files': fwdToRealBackend,
  '/api/message/upload': fwdToRealBackend,
  '/api/link/message': fwdToRealBackend,
  '/api/link/me': fwdToRealBackend,
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
