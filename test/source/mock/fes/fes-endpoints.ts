/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { expect } from 'chai';
import { IncomingMessage } from 'http';
import { HandlersDefinition } from '../all-apis-mock';
import { HttpClientErr } from '../lib/api';
import { MockJwt } from '../lib/oauth';

const standardFesUrl = 'fes.standardsubdomainfes.test:8001';
const disableAccessTokenFesUrl = 'fes.disablefesaccesstoken.test:8001';
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
    throw new HttpClientErr(`Not running any FES here: ${req.headers.host}`);
  },
  '/api/v1/account/access-token': async ({ }, req) => {
    if (req.headers.host === standardFesUrl && req.method === 'GET') {
      const email = authenticate(req, 'oidc'); // 3rd party token
      const fesToken = MockJwt.new(email); // fes-issued token
      if (email.includes(disableAccessTokenFesUrl)) {
        throw new HttpClientErr('Users on domain disablefesaccesstoken.test must not fetch access token from FES');
      }
      issuedAccessTokens.push(fesToken);
      return { 'accessToken': fesToken };
    }
    throw new HttpClientErr('Not Found', 404);
  },
  '/api/v1/client-configuration': async ({ }, req) => {
    // individual OrgRules are tested using FlowCrypt backend mock, see BackendData.getOrgRules 
    //   (except for DISABLE_FES_ACCESS_TOKEN which is FES specific and returned below)
    if (req.method !== 'GET') {
      throw new HttpClientErr('Unsupported method');
    }
    if (req.headers.host === standardFesUrl && req.url === `/api/v1/client-configuration?domain=${standardFesUrl}`) {
      return {
        clientConfiguration: { disallow_attester_search_for_domains: ['got.this@fromstandardfes.com'] },
      };
    }
    if (req.headers.host === disableAccessTokenFesUrl && req.url === `/api/v1/client-configuration?domain=${disableAccessTokenFesUrl}`) {
      return {
        clientConfiguration: { flags: ['DISABLE_FES_ACCESS_TOKEN'] },
      };
    }
    throw new HttpClientErr('Unexpected FES domain');
  },
  '/api/v1/message/new-reply-token': async ({ }, req) => {
    if (req.headers.host === standardFesUrl && req.method === 'POST') {
      const email = MockJwt.parseEmail(extractJwt(req));
      if (email.includes(standardFesUrl)) {
        authenticate(req, 'fes');
      } else if (email.includes(disableAccessTokenFesUrl)) {
        authenticate(req, 'oidc');
      } else {
        throw new HttpClientErr('Dont know how to authenticate on mock FES - unknown domain');
      }
      return { 'replyToken': 'mock-fes-reply-token' };
    }
    throw new HttpClientErr('Not Found', 404);
  },
  '/api/v1/message': async ({ body }, req) => {
    if (req.headers.host === standardFesUrl && req.method === 'POST') {
      // test: `compose - user@standardsubdomainfes.test:8001 - PWD encrypted message with FES web portal`
      // body is a mime-multipart string, we're doing a few smoke checks here without parsing it
      expect(body).to.contain('-----BEGIN PGP MESSAGE-----');
      expect(body).to.contain('"associateReplyToken":"mock-fes-reply-token"');
      expect(body).to.contain('"to":["to@example.com"]');
      expect(body).to.contain('"cc":[]');
      expect(body).to.contain('"bcc":["bcc@example.com"]');
      const email = MockJwt.parseEmail(extractJwt(req));
      if (email.includes(standardFesUrl)) {
        authenticate(req, 'fes');
        expect(body).to.contain('"from":"user@disablefesaccesstoken.test:8001"');
        return { 'url': `http://${standardFesUrl}/message/FES-MOCK-MESSAGE-ID` };
      } else if (email.includes(disableAccessTokenFesUrl)) {
        authenticate(req, 'fes');
        expect(body).to.contain('"from":"user@standardsubdomainfes.test:8001"');
        return { 'url': `http://${disableAccessTokenFesUrl}/message/FES-MOCK-MESSAGE-ID` };
      } else {
        throw new HttpClientErr('Dont know how to authenticate on mock FES - unknown domain');
      }
    }
    throw new HttpClientErr('Not Found', 404);
  },
};

const authenticate = (req: IncomingMessage, type: 'oidc' | 'fes'): string => {
  const jwt = extractJwt(req);
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

const extractJwt = (req: IncomingMessage): string => {
  return (req.headers.authorization || '').replace('Bearer ', '');
};
