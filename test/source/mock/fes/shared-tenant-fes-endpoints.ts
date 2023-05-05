/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { expect } from 'chai';
import { IncomingMessage } from 'http';
import { HandlersDefinition } from '../all-apis-mock';
import { HttpClientErr, Status } from '../lib/api';
import { MockJwt } from '../lib/oauth';
import { messageIdRegex, parsePort } from '../lib/mock-util';

export interface ReportedError {
  name: string;
  message: string;
  url: string;
  line: number;
  col: number;
  trace: string;
  version: string;
  environmane: string;
  product: string;
  buildType: string;
}
export const reportedErrors: ReportedError[] = [];

type FesClientConfigurationFlag =
  | 'NO_PRV_CREATE'
  | 'NO_PRV_BACKUP'
  | 'PRV_AUTOIMPORT_OR_AUTOGEN'
  | 'PASS_PHRASE_QUIET_AUTOGEN'
  | 'ENFORCE_ATTESTER_SUBMIT'
  | 'DISABLE_FLOWCRYPT_HOSTED_PASSWORD_MESSAGES'
  | 'NO_ATTESTER_SUBMIT'
  | 'USE_LEGACY_ATTESTER_SUBMIT'
  | 'DEFAULT_REMEMBER_PASS_PHRASE'
  | 'HIDE_ARMOR_META'
  | 'FORBID_STORING_PASS_PHRASE'
  | 'DISABLE_FES_ACCESS_TOKEN'
  | 'SETUP_ENSURE_IMPORTED_PRV_MATCH_LDAP_PUB';

/* eslint-disable @typescript-eslint/naming-convention */
export type FesClientConfiguration = {
  flags?: FesClientConfigurationFlag[];
  custom_keyserver_url?: string;
  key_manager_url?: string;
  in_memory_pass_phrase_session_length?: number;
  allow_attester_search_only_for_domains?: string[];
  disallow_attester_search_for_domains?: string[];
  enforce_keygen_algo?: string;
  enforce_keygen_expire_months?: number;
  allow_keys_openpgp_org_search_only_for_domains?: string[];
  disallow_keys_openpgp_org_search_for_domains?: string[];
};
/* eslint-enable @typescript-eslint/naming-convention */

export interface FesConfig {
  returnError?: HttpClientErr;
  clientConfiguration?: FesClientConfiguration;
}

const issuedAccessTokens: string[] = [];
export const getMockSharedTenantFesEndpoints = (config: FesConfig | undefined): HandlersDefinition => {
  return {
    // shared tenant fes location at https://flowcrypt.com/shared-tenant-fes/
    '/shared-tenant-fes/api/': async ({}, req) => {
      if (req.method === 'GET') {
        return {
          vendor: 'Mock',
          service: 'external-service',
          orgId: 'standardsubdomainfes.test',
          version: 'MOCK',
          apiVersion: 'v1',
        };
      }
      const port = parsePort(req);
      if (req.headers.host === `fes.localhost:${port}`) {
        // test `status404 does not return any fesUrl` uses this
        // this makes enterprise version tolerate missing FES - explicit 404
        throw new HttpClientErr(`Not found`, 404);
      }
      if (req.headers.host === `fes.google.mock.localhost:${port}`) {
        // test `compose - auto include pubkey is inactive when our key is available on Wkd` uses this
        // this makes enterprise version tolerate missing FES - explicit 404
        throw new HttpClientErr(`Not found`, 404);
      }
      throw new HttpClientErr(`Not running any FES here: ${req.headers.host}`);
    },
    '/shared-tenant-fes/api/v1/client-configuration': async ({}, req) => {
      // individual ClientConfiguration is tested using FlowCrypt backend mock, see BackendData.getClientConfiguration
      if (req.method !== 'GET') {
        throw new HttpClientErr('Unsupported method');
      }
      if (config) {
        if (config.returnError) {
          throw config.returnError;
        }
        return {
          clientConfiguration: config.clientConfiguration,
        };
      }
      return {
        clientConfiguration: {
          flags: [],
        },
      };
    },
    '/shared-tenant-fes/api/v1/log-collector/exception': async ({ body }) => {
      reportedErrors.push(body as ReportedError);
      return { saved: true };
    },
    '/shared-tenant-fes/api/v1/account/feedback': async ({ body }) => {
      expect((body as { email: string }).email).to.equal('flowcrypt.compatibility@gmail.com');
      return { sent: true, text: 'Feedback sent' };
    },
    '/shared-tenant-fes/api/v1/message/new-reply-token': async ({}, req) => {
      if (req.method === 'POST') {
        authenticate(req, 'oidc');
        return { replyToken: 'mock-fes-reply-token' };
      }
      throw new HttpClientErr('Not Found', 404);
    },
    '/shared-tenant-fes/api/v1/message': async ({ body }, req) => {
      // body is a mime-multipart string, we're doing a few smoke checks here without parsing it
      if (req.method === 'POST' && typeof body === 'string') {
        expect(body).to.contain('-----BEGIN PGP MESSAGE-----');
        expect(body).to.contain('"associateReplyToken":"mock-fes-reply-token"');
        const response = {
          // this url is required for pubkey encrypted message
          url: `https://flowcrypt.com/shared-tenant-fes/message/6da5ea3c-d2d6-4714-b15e-f29c805e5c6a`,
          externalId: 'FES-MOCK-EXTERNAL-ID',
          emailToExternalIdAndUrl: {} as { [email: string]: { url: string; externalId: string } },
        };
        return response;
      }
      throw new HttpClientErr('Not Found', 404);
    },
    '/shared-tenant-fes/api/v1/message/FES-MOCK-EXTERNAL-ID/gateway': async ({ body }, req) => {
      if (req.method === 'POST') {
        // test: `compose - user@standardsubdomainfes.localhost:8001 - PWD encrypted message with FES web portal`
        authenticate(req, 'oidc');
        expect(body).to.match(messageIdRegexForRequest(req));
        return {};
      }
      throw new HttpClientErr('Not Found', 404);
    },
    '/shared-tenant-fes/api/v1/message/FES-MOCK-EXTERNAL-FOR-SENDER@DOMAIN.COM-ID/gateway': async ({ body }, req) => {
      if (req.method === 'POST') {
        // test: `compose - user2@standardsubdomainfes.localhost:8001 - PWD encrypted message with FES - Reply rendering`
        authenticate(req, 'oidc');
        expect(body).to.match(messageIdRegexForRequest(req));
        return {};
      }
      throw new HttpClientErr('Not Found', 404);
    },
    '/shared-tenant-fes/api/v1/message/FES-MOCK-EXTERNAL-FOR-TO@EXAMPLE.COM-ID/gateway': async ({ body }, req) => {
      if (req.method === 'POST') {
        // test: `compose - user@standardsubdomainfes.localhost:8001 - PWD encrypted message with FES web portal`
        // test: `compose - user2@standardsubdomainfes.localhost:8001 - PWD encrypted message with FES - Reply rendering`
        // test: `compose - user3@standardsubdomainfes.localhost:8001 - PWD encrypted message with FES web portal - pubkey recipient in bcc`
        // test: `compose - user4@standardsubdomainfes.localhost:8001 - PWD encrypted message with FES web portal - some sends fail with BadRequest error`
        authenticate(req, 'oidc');
        expect(body).to.match(messageIdRegexForRequest(req));
        return {};
      }
      throw new HttpClientErr('Not Found', 404);
    },
    '/shared-tenant-fes/api/v1/message/FES-MOCK-EXTERNAL-FOR-BCC@EXAMPLE.COM-ID/gateway': async ({ body }, req) => {
      if (req.method === 'POST') {
        // test: `compose - user@standardsubdomainfes.localhost:8001 - PWD encrypted message with FES web portal`
        authenticate(req, 'oidc');
        expect(body).to.match(messageIdRegexForRequest(req));
        return {};
      }
      throw new HttpClientErr('Not Found', 404);
    },
    '/shared-tenant-fes/api/v1/message/FES-MOCK-EXTERNAL-FOR-GATEWAYFAILURE@EXAMPLE.COM-ID/gateway': async () => {
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

const messageIdRegexForRequest = (req: IncomingMessage) => messageIdRegex(parsePort(req));
