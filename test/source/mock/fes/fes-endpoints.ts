/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { IncomingMessage } from 'http';
import { HandlersDefinition } from '../all-apis-mock';
import { HttpClientErr } from '../lib/api';
import { MockJwt } from '../lib/oauth';

const standardFesUrl = 'fes.standardsubdomainfes.com:8001';
const issuedAccessTokens: string[] = [];

export const mockFesEndpoints: HandlersDefinition = {
  // standard fes location at https://fes.domain.com
  '/api/': async ({ }, req) => {
    if (req.headers.host === standardFesUrl && req.method === 'GET') {
      return {
        "vendor": "Mock",
        "service": "enterprise-server",
        "orgId": "standardsubdomainfes.com",
        "version": "MOCK",
        "apiVersion": 'v1',
      };
    }
    throw new HttpClientErr('Not Found', 404);
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
  // fes url defined using .well-known, see mockWellKnownHostMetaEndpoints
  '/custom-fes-based-on-well-known/api/': async ({ }, req) => {
    if (req.method === 'GET') {
      return {
        "vendor": "Mock",
        "service": "enterprise-server",
        "orgId": "wellknownfes.com",
        "version": "MOCK",
        "apiVersion": 'v1',
      };
    }
    throw new HttpClientErr('Not Found', 404);
  },
  '/custom-fes-based-on-well-known/api/v1/account/access-token': async ({ }, req) => {
    if (req.method === 'GET') {
      const email = authenticate(req, 'oidc'); // 3rd party token
      const fesToken = MockJwt.new(email); // fes-issued token
      issuedAccessTokens.push(fesToken);
      return { 'accessToken': fesToken };
    }
    throw new HttpClientErr('Not Found', 404);
  },
  '/custom-fes-based-on-well-known/api/v1/account/': async ({ }, req) => {
    if (req.method === 'GET') {
      authenticate(req, 'fes');
      return {
        account: {
          default_message_expire: 30
        },
        subscription: { level: 'pro', expire: null, method: 'group', expired: 'false' }, // tslint:disable-line:no-null-keyword
        domain_org_rules: { disallow_attester_search_for_domains: ['got.this@fromwellknownfes.com'] },
      };
    }
    throw new HttpClientErr('Not Found', 404);
  },
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
