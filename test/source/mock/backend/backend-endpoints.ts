import { isPost } from '../lib/mock-util';
import { HttpClientErr, HttpAuthErr } from '../lib/api';
import { HandlersDefinition } from '../all-apis-mock';
import { IncomingMessage } from 'http';
import * as request from 'fc-node-requests';
import { oauth } from '../lib/oauth';
import { BackendData } from './backend-data';
import { Dict } from '../../core/common';

const backendData = new BackendData(oauth);

const fwdToRealBackend = async (parsed: any, req: IncomingMessage): Promise<string> => {
  delete req.headers.host;
  delete req.headers['content-length'];
  const forwarding: any = { headers: req.headers, url: `https://flowcrypt.com${req.url}` };
  if (req.url!.includes('message/upload')) {
    forwarding.body = parsed.body; // FORM-DATA
    const r = await request.post(forwarding);
    return r.body; // already json-stringified for this call, maybe because backend doesn't return proper content-type
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
    backendData.registerOrThrow(parsed.account, parsed.uuid, idToken);
    return JSON.stringify({
      registered: true,
      verified: true,
      subscription: backendData.getSubscription(parsed.account),
    });
  },
  '/api/account/get': async ({ body }, req) => {
    const parsed = throwIfNotPostWithAuth(body, req);
    backendData.checkUuidOrThrow(parsed.account, parsed.uuid);
    return JSON.stringify({
      account: backendData.getAcctRow(parsed.account),
      subscription: backendData.getSubscription(parsed.account),
      domain_org_rules: backendData.getOrgRules(parsed.account),
    });
  },
  '/api/account/check': async ({ body }, req) => { // todo - this backend call should eventually be deprecated
    const parsed = body as Dict<any>;
    const acct = parsed.emails.pop();
    return JSON.stringify({
      subscription: backendData.getSubscription(acct),
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
    throw new Error(`${req.url} mock not implemented`); // will have to give fake token
  },
  '/api/help/error': async ({ body }, req) => {
    console.error(`/help/error`, body); // todo - fail tests if received any error
    throw new Error(`${req.url} mock not implemented`);
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
