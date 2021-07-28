/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { IncomingMessage } from 'http';
import { HandlersDefinition } from '../all-apis-mock';
import { HttpClientErr } from '../lib/api';
import { MockJwt } from '../lib/oauth';

const standardFesUrl = 'fes.standardsubdomainfes.test:8001';
const issuedAccessTokens: string[] = [];

export const mockFesEndpoints: HandlersDefinition = {
  // standard fes location at https://fes.domain.com
  '/api/': async ({ }, req) => {
    if (req.headers.host === standardFesUrl && req.method === 'GET') {
      return {
        "vendor": "Mock",
        "service": "enterprise-server",
        "orgId": "standardsubdomainfes.test",
        "version": "MOCK",
        "apiVersion": 'v1',
      };
    }
    if (req.headers.host === 'fes.localhost:8001') {
      // test `status404 does not return any fesUrl` uses this
      // this makes enterprise version tolerate missing FES - explicit 404
      throw new HttpClientErr(`Not found`, 404);
    }
    if (req.headers.host === 'fes.google.mock.flowcryptlocal.test:8001') {
      // test `compose - auto include pubkey is inactive when our key is available on Wkd` uses this
      // this makes enterprise version tolerate missing FES - explicit 404
      throw new HttpClientErr(`Not found`, 404);
    }
    console.log('host', req.headers.host);
    throw new HttpClientErr(`Not running any FES here: ${req.headers.host}`, 400);
  },
  '/api/v1/account/access-token': async ({ }, req) => {
    if (req.headers.host === standardFesUrl && req.method === 'GET') {
      const email = authenticate(req, 'oidc'); // 3rd party token
      const fesToken = MockJwt.new(email); // fes-issued token
      issuedAccessTokens.push(fesToken);
      return { 'accessToken': fesToken };
    }
    throw new HttpClientErr('Not Found', 404);
  },
  '/api/v1/account/': async ({ }, req) => {
    if (req.headers.host === standardFesUrl && req.method === 'GET') {
      authenticate(req, 'fes');
      return {
        account: {
          default_message_expire: 30
        },
        subscription: { level: 'pro', expire: null, method: 'group', expired: 'false' }, // tslint:disable-line:no-null-keyword
        domain_org_rules: { disallow_attester_search_for_domains: ['got.this@fromstandardfes.com'] },
      };
    }
    throw new HttpClientErr('Not Found', 404);
  },
  '/api/v1/message': async ({ }, req) => {
    if (req.headers.host === standardFesUrl && req.method === 'POST') {
      authenticate(req, 'fes');
      return { 'url': `http://${standardFesUrl}/message/FES-MOCK-MESSAGE-ID` };
    }
    throw new HttpClientErr('Not Found', 404);
  },
  // '/api/v1/message/new-access-token': async ({ }, req) => { // why is this not getting called?
  //   if (req.headers.host === standardFesUrl && req.method === 'POST') {
  //     authenticate(req, 'fes');
  //     return { 'replyToken': 'mock-fes-reply-token' };
  //   }
  //   throw new HttpClientErr('Not Found', 404);
  // },
};

const authenticate = (req: IncomingMessage, type: 'oidc' | 'fes'): string => {
  const jwt = (req.headers.authorization || '').replace('Bearer ', '');
  if (!jwt) {
    throw new Error('Mock FES missing authorization header');
  }
  if (type === 'oidc') {
    if (issuedAccessTokens.includes(jwt)) {
      throw new Error('Mock FES access-token call wrongly with FES token');
    }
  } else { // fes
    if (!issuedAccessTokens.includes(jwt)) {
      throw new HttpClientErr('FES mock received access token it didnt issue', 401);
    }
  }
  return MockJwt.parseEmail(jwt);
};
