/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { expect } from 'chai';
import { IncomingHttpHeaders } from 'http';
import { HandlersDefinition } from '../all-apis-mock';
import { HttpClientErr, Status } from '../lib/api';
import { messageIdRegex, parseAuthority, parsePort } from '../lib/mock-util';
import { MockJwt } from '../lib/oauth';
import { FesConfig, MessageCreateBody, createCombinedBodyForValidator } from './shared-tenant-fes-endpoints';
import { getStoredS3Content } from '../s3/s3-endpoints';

const standardFesUrl = (port: string) => {
  return `fes.standardsubdomainfes.localhost:${port}`;
};
export const issuedGoogleIDPIdTokens: string[] = [];
export const issuedCustomIDPIdTokens: string[] = [];

// eslint-disable-next-line @typescript-eslint/naming-convention
export const standardSubDomainFesClientConfiguration = { flags: [], disallow_attester_search_for_domains: ['got.this@fromstandardfes.com'] };
export const getMockCustomerUrlFesEndpoints = (config: FesConfig | undefined): HandlersDefinition => {
  const isCustomIDPUsed = !!config?.authenticationConfiguration;
  return {
    // standard fes location at https://fes.domain.com
    '/api/': async ({}, req) => {
      const port = parsePort(req);
      if ([standardFesUrl(port)].includes(parseAuthority(req)) && req.method === 'GET') {
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
      throw new HttpClientErr(`Not running any FES here: ${parseAuthority(req)}`);
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
      throw new HttpClientErr(`Unexpected FES domain "${parseAuthority(req)}" and url "${req.url}"`);
    },
    '/api/v1/client-configuration/authentication': async ({}, req) => {
      if (req.method !== 'GET') {
        throw new HttpClientErr('Unsupported method');
      }
      if (config?.authenticationConfiguration) {
        return config.authenticationConfiguration;
      }
      return {};
    },
    '/api/v1/message/new-reply-token': async ({}, req) => {
      if (parseAuthority(req) === standardFesUrl(parsePort(req)) && req.method === 'POST') {
        authenticate(req, isCustomIDPUsed);
        return { replyToken: 'mock-fes-reply-token' };
      }
      throw new HttpClientErr('Not Found', 404);
    },
    // New pre-signed S3 URL flow endpoints
    '/api/v1/messages/allocation': async ({}, req) => {
      const port = parsePort(req);
      if (parseAuthority(req) === standardFesUrl(port) && req.method === 'POST') {
        authenticate(req, isCustomIDPUsed);
        const storageFileName = 'mock-storage-file-name-' + Date.now();
        return {
          storageFileName,
          replyToken: 'mock-fes-reply-token',
          uploadUrl: `https://localhost:${port}/mock-s3-upload/${storageFileName}`,
        };
      }
      throw new HttpClientErr('Not Found', 404);
    },
    '/api/v1/messages': async ({ body }, req) => {
      const port = parsePort(req);
      const fesUrl = standardFesUrl(port);
      // New endpoint that receives storageFileName instead of encrypted content
      if (parseAuthority(req) === fesUrl && req.method === 'POST' && typeof body === 'object') {
        authenticate(req, isCustomIDPUsed);
        const bodyObj = body as MessageCreateBody;
        // Retrieve the PGP content uploaded to S3 and combine with metadata for validation
        const s3Content = getStoredS3Content(bodyObj.storageFileName);
        const combinedBody = createCombinedBodyForValidator(s3Content, bodyObj);
        if (config?.messagePostValidator) {
          return await config.messagePostValidator(combinedBody, fesUrl);
        }
        throw new HttpClientErr('Not Allowed', 405);
      }
      throw new HttpClientErr('Not Found', 404);
    },
    // Wildcard handler for /api/v1/messages/* sub-paths (gateway endpoints for new flow)
    // test: `compose - user@standardsubdomainfes.localhost - PWD encrypted message with FES web portal`
    // test: `compose - user2@standardsubdomainfes.localhost - PWD encrypted message with FES - Reply rendering`
    // test: `compose - user3@standardsubdomainfes.localhost - PWD encrypted message with FES web portal - pubkey recipient in bcc`
    // test: `compose - user4@standardsubdomainfes.localhost - PWD encrypted message with FES web portal - some sends fail with BadRequest error`
    // test: `user4@standardsubdomainfes.localhost - PWD encrypted message with FES web portal - a send fails with gateway update error`
    '/api/v1/messages/?': async ({ body }, req) => {
      const port = parsePort(req);
      const gatewayMatch = /\/api\/v1\/messages\/([^/]+)\/gateway/.exec(req.url);
      if (gatewayMatch && parseAuthority(req) === standardFesUrl(port) && req.method === 'POST') {
        const externalId = gatewayMatch[1];
        if (externalId === 'FES-MOCK-EXTERNAL-FOR-GATEWAYFAILURE@EXAMPLE.COM-ID') {
          throw new HttpClientErr(`Test error`, Status.BAD_REQUEST);
        }
        authenticate(req, isCustomIDPUsed);
        const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
        expect(bodyStr).to.match(messageIdRegex(port));
        return {};
      }
      throw new HttpClientErr('Not Found', 404);
    },
    // Legacy endpoint - body is a mime-multipart string
    '/api/v1/message': async ({ body }, req) => {
      const port = parsePort(req);
      const fesUrl = standardFesUrl(port);
      // body is a mime-multipart string, we're doing a few smoke checks here without parsing it
      if (parseAuthority(req) === fesUrl && req.method === 'POST' && typeof body === 'string') {
        authenticate(req, isCustomIDPUsed);
        if (config?.messagePostValidator) {
          return await config.messagePostValidator(body, fesUrl);
        }
        throw new HttpClientErr('Not Allowed', 405);
      }
      throw new HttpClientErr('Not Found', 404);
    },
    // Legacy wildcard handler for /api/v1/message/* sub-paths (gateway endpoints)
    // test: `compose - user@standardsubdomainfes.localhost - PWD encrypted message with FES web portal`
    // test: `compose - user2@standardsubdomainfes.localhost - PWD encrypted message with FES - Reply rendering`
    // test: `compose - user3@standardsubdomainfes.localhost - PWD encrypted message with FES web portal - pubkey recipient in bcc`
    // test: `compose - user4@standardsubdomainfes.localhost - PWD encrypted message with FES web portal - some sends fail with BadRequest error`
    // test: `user4@standardsubdomainfes.localhost - PWD encrypted message with FES web portal - a send fails with gateway update error`
    '/api/v1/message/?': async ({ body }, req) => {
      const port = parsePort(req);
      const gatewayMatch = /\/api\/v1\/message\/([^/]+)\/gateway/.exec(req.url);
      if (gatewayMatch && parseAuthority(req) === standardFesUrl(port) && req.method === 'POST') {
        const externalId = gatewayMatch[1];
        if (externalId === 'FES-MOCK-EXTERNAL-FOR-GATEWAYFAILURE@EXAMPLE.COM-ID') {
          throw new HttpClientErr(`Test error`, Status.BAD_REQUEST);
        }
        authenticate(req, isCustomIDPUsed);
        expect(body).to.match(messageIdRegex(port));
        return {};
      }
      throw new HttpClientErr('Not Found', 404);
    },
  };
};

const authenticate = (req: { headers: IncomingHttpHeaders }, isCustomIDPUsed: boolean): string => {
  const jwt = (req.headers.authorization || '').replace('Bearer ', '');
  if (!jwt) {
    throw new Error('Mock FES missing authorization header');
  }
  const issuedTokens = isCustomIDPUsed ? issuedCustomIDPIdTokens : issuedGoogleIDPIdTokens;

  if (!issuedTokens.includes(jwt)) {
    throw new HttpClientErr('FES mock received access token it didnt issue', 401);
  }
  return MockJwt.parseEmail(jwt);
};
