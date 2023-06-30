/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { expect } from 'chai';
import { IncomingMessage } from 'http';
import { HandlersDefinition } from '../all-apis-mock';
import { HttpClientErr, Status } from '../lib/api';
import { messageIdRegex, parsePort } from '../lib/mock-util';
import { MockJwt } from '../lib/oauth';
import { FesConfig } from './shared-tenant-fes-endpoints';

const standardFesUrl = (port: string) => {
  return `fes.standardsubdomainfes.localhost:${port}`;
};
const issuedAccessTokens: string[] = [];

// eslint-disable-next-line @typescript-eslint/naming-convention
export const standardSubDomainFesClientConfiguration = { flags: [], disallow_attester_search_for_domains: ['got.this@fromstandardfes.com'] };
export const getMockCustomerUrlFesEndpoints = (config: FesConfig | undefined): HandlersDefinition => {
  return {
    // standard fes location at https://fes.domain.com
    '/api/': async ({}, req) => {
      const port = parsePort(req);
      if ([standardFesUrl(port)].includes(req.headers.host || '') && req.method === 'GET') {
        return {
          vendor: 'Mock',
          service: 'external-service',
          orgId: 'standardsubdomainfes.test',
          version: 'MOCK',
          apiVersion: 'v1',
        };
      }
      if (config?.apiEndpointReturnError) {
        throw config.apiEndpointReturnError;
      }
      throw new HttpClientErr(`Not running any FES here: ${req.headers.host}`);
    },
    '/api/v1/client-configuration': async ({}, req) => {
      // individual ClientConfiguration is tested using FlowCrypt backend mock, see BackendData.getClientConfiguration
      if (req.method !== 'GET') {
        throw new HttpClientErr('Unsupported method');
      }
      if (config?.clientConfiguration) {
        return {
          clientConfiguration: config.clientConfiguration,
        };
      }
      throw new HttpClientErr(`Unexpected FES domain "${req.headers.host}" and url "${req.url}"`);
    },
    '/api/v1/message/new-reply-token': async ({}, req) => {
      if (req.headers.host === standardFesUrl(parsePort(req)) && req.method === 'POST') {
        authenticate(req, 'oidc');
        return { replyToken: 'mock-fes-reply-token' };
      }
      throw new HttpClientErr('Not Found', 404);
    },
    '/api/v1/message': async ({ body }, req) => {
      const port = parsePort(req);
      const fesUrl = standardFesUrl(port);
      // body is a mime-multipart string, we're doing a few smoke checks here without parsing it
      if (req.headers.host === fesUrl && req.method === 'POST' && typeof body === 'string') {
        authenticate(req, 'oidc');
        if (config?.messagePostValidator) {
          return await config.messagePostValidator(body, fesUrl);
        }
        throw new HttpClientErr('Not Allowed', 405);
      }
      throw new HttpClientErr('Not Found', 404);
    },
    '/api/v1/message/FES-MOCK-EXTERNAL-ID/gateway': async ({ body }, req) => {
      const port = parsePort(req);
      if (req.headers.host === standardFesUrl(port) && req.method === 'POST') {
        // test: `compose - user@standardsubdomainfes.localhost:8001 - PWD encrypted message with FES web portal`
        authenticate(req, 'oidc');
        expect(body).to.match(messageIdRegex(port));
        return {};
      }
      throw new HttpClientErr('Not Found', 404);
    },
    '/api/v1/message/FES-MOCK-EXTERNAL-FOR-SENDER@DOMAIN.COM-ID/gateway': async ({ body }, req) => {
      const port = parsePort(req);
      if (req.headers.host === standardFesUrl(port) && req.method === 'POST') {
        // test: `compose - user2@standardsubdomainfes.localhost:8001 - PWD encrypted message with FES - Reply rendering`
        authenticate(req, 'oidc');
        expect(body).to.match(messageIdRegex(port));
        return {};
      }
      throw new HttpClientErr('Not Found', 404);
    },
    '/api/v1/message/FES-MOCK-EXTERNAL-FOR-TO@EXAMPLE.COM-ID/gateway': async ({ body }, req) => {
      const port = parsePort(req);
      if (req.headers.host === standardFesUrl(port) && req.method === 'POST') {
        // test: `compose - user@standardsubdomainfes.localhost:8001 - PWD encrypted message with FES web portal`
        // test: `compose - user2@standardsubdomainfes.localhost:8001 - PWD encrypted message with FES - Reply rendering`
        // test: `compose - user3@standardsubdomainfes.localhost:8001 - PWD encrypted message with FES web portal - pubkey recipient in bcc`
        // test: `compose - user4@standardsubdomainfes.localhost:8001 - PWD encrypted message with FES web portal - some sends fail with BadRequest error`
        authenticate(req, 'oidc');
        expect(body).to.match(messageIdRegex(port));
        return {};
      }
      throw new HttpClientErr('Not Found', 404);
    },
    '/api/v1/message/FES-MOCK-EXTERNAL-FOR-BCC@EXAMPLE.COM-ID/gateway': async ({ body }, req) => {
      const port = parsePort(req);
      if (req.headers.host === standardFesUrl(port) && req.method === 'POST') {
        // test: `compose - user@standardsubdomainfes.localhost:8001 - PWD encrypted message with FES web portal`
        authenticate(req, 'oidc');
        expect(body).to.match(messageIdRegex(port));
        return {};
      }
      throw new HttpClientErr('Not Found', 404);
    },
    '/api/v1/message/FES-MOCK-EXTERNAL-FOR-GATEWAYFAILURE@EXAMPLE.COM-ID/gateway': async () => {
      // test: `user4@standardsubdomainfes.localhost:8001 - PWD encrypted message with FES web portal - a send fails with gateway update error`
      throw new HttpClientErr(`Test error`, Status.BAD_REQUEST);
    },
  };
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
  } else {
    // fes
    if (!issuedAccessTokens.includes(jwt)) {
      throw new HttpClientErr('FES mock received access token it didnt issue', 401);
    }
  }
  return MockJwt.parseEmail(jwt);
};
