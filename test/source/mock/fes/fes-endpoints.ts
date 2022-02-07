/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { expect } from 'chai';
import { IncomingMessage } from 'http';
import { HandlersDefinition } from '../all-apis-mock';
import { HttpClientErr } from '../lib/api';
import { MockJwt } from '../lib/oauth';

const standardFesUrl = 'fes.standardsubdomainfes.test:8001';
const issuedAccessTokens: string[] = [];

export const mockFesEndpoints: HandlersDefinition = {
  // standard fes location at https://fes.domain.com
  '/api/': async ({ }, req) => {
    if ([standardFesUrl].includes(req.headers.host || '') && req.method === 'GET') {
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
    throw new HttpClientErr(`Not running any FES here: ${req.headers.host}`);
  },
  '/api/v1/client-configuration': async ({ }, req) => {
    // individual OrgRules are tested using FlowCrypt backend mock, see BackendData.getOrgRules
    if (req.method !== 'GET') {
      throw new HttpClientErr('Unsupported method');
    }
    if (req.headers.host === standardFesUrl && req.url === `/api/v1/client-configuration?domain=standardsubdomainfes.test:8001`) {
      return {
        clientConfiguration: { disallow_attester_search_for_domains: ['got.this@fromstandardfes.com'] },
      };
    }
    throw new HttpClientErr(`Unexpected FES domain "${req.headers.host}" and url "${req.url}"`);
  },
  '/api/v1/message/new-reply-token': async ({ }, req) => {
    if (req.headers.host === standardFesUrl && req.method === 'POST') {
      authenticate(req, 'oidc');
      return { 'replyToken': 'mock-fes-reply-token' };
    }
    throw new HttpClientErr('Not Found', 404);
  },
  '/api/v1/message': async ({ body }, req) => {
    // body is a mime-multipart string, we're doing a few smoke checks here without parsing it
    if (req.headers.host === standardFesUrl && req.method === 'POST') {
      // test: `compose - user@standardsubdomainfes.test:8001 - PWD encrypted message with FES web portal`
      authenticate(req, 'oidc');
      expect(body).to.contain('-----BEGIN PGP MESSAGE-----');
      expect(body).to.contain('"associateReplyToken":"mock-fes-reply-token"');
      expect(body).to.contain('"to":["Mr To <to@example.com>"]');
      expect(body).to.contain('"cc":[]');
      expect(body).to.contain('"bcc":["Mr Bcc <bcc@example.com>"]');
      expect(body).to.contain('"from":"user@standardsubdomainfes.test:8001"');
      return { 'url': `http://${standardFesUrl}/message/FES-MOCK-MESSAGE-ID` };
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