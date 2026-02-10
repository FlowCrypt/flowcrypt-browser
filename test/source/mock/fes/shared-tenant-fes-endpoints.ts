/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { expect } from 'chai';
import { IncomingHttpHeaders } from 'http';
import { HandlersDefinition } from '../all-apis-mock';
import { HttpClientErr, Status } from '../lib/api';
import { MockJwt } from '../lib/oauth';
import { messageIdRegex, parseAuthority, parsePort } from '../lib/mock-util';
import { getStoredS3Content } from '../s3/s3-endpoints';

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
  | 'DISABLE_FES_PRESIGNED_URLS'
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
  prv_backup_to_designated_mailbox?: string;
  disallow_password_messages_for_terms?: string[];
  disallow_password_messages_error_text?: string;
};
/* eslint-enable @typescript-eslint/naming-convention */

export type FesAuthenticationConfiguration = {
  oauth: {
    clientId: string;
    clientSecret: string;
    redirectUrl: string;
    authCodeUrl: string;
    tokensUrl: string;
  };
};

export interface FesMessageReturnType {
  url: string;
  externalId: string;
  emailToExternalIdAndUrl: { [email: string]: { url: string; externalId: string } };
}
export interface MessageCreateBody {
  storageFileName: string;
  associateReplyToken: string;
  from: string;
  to: string[];
  cc: string[];
  bcc: string[];
}

/**
 * Creates a combined mock body string from S3 content and message metadata,
 * matching the format expected by messagePostValidator functions.
 */
export const createCombinedBodyForValidator = (s3Content: string, bodyObj: MessageCreateBody): string => {
  return (
    s3Content +
    '\n' +
    JSON.stringify({
      associateReplyToken: bodyObj.associateReplyToken,
      from: bodyObj.from,
      to: bodyObj.to,
      cc: bodyObj.cc,
      bcc: bodyObj.bcc,
    })
  );
};

export interface FesConfig {
  returnError?: HttpClientErr;
  apiEndpointReturnError?: HttpClientErr;
  clientConfiguration?: FesClientConfiguration;
  authenticationConfiguration?: FesAuthenticationConfiguration;
  messagePostValidator?: (body: string, fesUrl: string) => Promise<FesMessageReturnType>;
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
      if (config?.apiEndpointReturnError) {
        throw config.apiEndpointReturnError;
      }
      throw new HttpClientErr(`Not running any FES here: ${parseAuthority(req)}`);
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
    '/shared-tenant-fes/api/v1/client-configuration/authentication': async ({}, req) => {
      if (req.method !== 'GET') {
        throw new HttpClientErr('Unsupported method');
      }
      if (config?.authenticationConfiguration) {
        return config.authenticationConfiguration;
      }
      return {};
    },
    '/shared-tenant-fes/api/v1/log-collector/exception': async ({ body }) => {
      reportedErrors.push(body as ReportedError);
      return { saved: true };
    },
    '/shared-tenant-fes/api/v1/account/feedback': async ({ body }) => {
      expect((body as { email: string }).email).to.equal('flowcrypt.compatibility@gmail.com');
      return {};
    },
    '/shared-tenant-fes/api/v1/message/new-reply-token': async ({}, req) => {
      if (req.method === 'POST') {
        authenticate(req, 'oidc');
        return { replyToken: 'mock-fes-reply-token' };
      }
      throw new HttpClientErr('Not Found', 404);
    },
    // New pre-signed S3 URL flow endpoints
    '/shared-tenant-fes/api/v1/messages/allocation': async ({}, req) => {
      if (req.method === 'POST') {
        authenticate(req, 'oidc');
        const port = parsePort(req);
        const storageFileName = 'mock-storage-file-name-' + Date.now();
        return {
          storageFileName,
          replyToken: 'mock-fes-reply-token',
          uploadUrl: `https://localhost:${port}/mock-s3-upload/${storageFileName}`,
        };
      }
      throw new HttpClientErr('Not Found', 404);
    },
    '/shared-tenant-fes/api/v1/messages': async ({ body }, req) => {
      // New endpoint that receives storageFileName instead of encrypted content
      if (req.method === 'POST' && typeof body === 'object') {
        authenticate(req, 'oidc');
        const bodyObj = body as MessageCreateBody;
        // Retrieve the PGP content uploaded to S3 and combine with metadata for validation
        const s3Content = getStoredS3Content(bodyObj.storageFileName);
        const combinedBody = createCombinedBodyForValidator(s3Content, bodyObj);
        expect(combinedBody).to.contain('-----BEGIN PGP MESSAGE-----');
        expect(combinedBody).to.contain('"associateReplyToken":"mock-fes-reply-token"');
        if (combinedBody.includes('NameWithEmoji')) {
          expect(combinedBody).to.not.include('⭐');
        }
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
    // Wildcard handler for /shared-tenant-fes/api/v1/messages/* sub-paths (gateway endpoints for new flow)
    // test: `compose - user@standardsubdomainfes.localhost - PWD encrypted message with FES web portal`
    // test: `compose - user2@standardsubdomainfes.localhost - PWD encrypted message with FES - Reply rendering`
    // test: `compose - user3@standardsubdomainfes.localhost - PWD encrypted message with FES web portal - pubkey recipient in bcc`
    // test: `compose - user4@standardsubdomainfes.localhost - PWD encrypted message with FES web portal - some sends fail with BadRequest error`
    // test: `user4@standardsubdomainfes.localhost - PWD encrypted message with FES web portal - a send fails with gateway update error`
    '/shared-tenant-fes/api/v1/messages/?': async ({ body }, req) => {
      const gatewayMatch = /\/shared-tenant-fes\/api\/v1\/messages\/([^/]+)\/gateway/.exec(req.url);
      if (gatewayMatch && req.method === 'POST') {
        const externalId = gatewayMatch[1];
        if (externalId === 'FES-MOCK-EXTERNAL-FOR-GATEWAYFAILURE@EXAMPLE.COM-ID') {
          throw new HttpClientErr(`Test error`, Status.BAD_REQUEST);
        }
        authenticate(req, 'oidc');
        const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
        expect(bodyStr).to.match(messageIdRegexForRequest(req));
        return {};
      }
      throw new HttpClientErr('Not Found', 404);
    },
    // Legacy endpoint - body is a mime-multipart string
    '/shared-tenant-fes/api/v1/message': async ({ body }, req) => {
      // body is a mime-multipart string, we're doing a few smoke checks here without parsing it
      if (req.method === 'POST' && typeof body === 'string') {
        expect(body).to.contain('-----BEGIN PGP MESSAGE-----');
        expect(body).to.contain('"associateReplyToken":"mock-fes-reply-token"');
        if (body.includes('NameWithEmoji')) {
          expect(body).to.not.include('⭐');
        }
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
    // Legacy wildcard handler for /shared-tenant-fes/api/v1/message/* sub-paths (gateway endpoints)
    // test: `compose - user@standardsubdomainfes.localhost - PWD encrypted message with FES web portal`
    // test: `compose - user2@standardsubdomainfes.localhost - PWD encrypted message with FES - Reply rendering`
    // test: `compose - user3@standardsubdomainfes.localhost - PWD encrypted message with FES web portal - pubkey recipient in bcc`
    // test: `compose - user4@standardsubdomainfes.localhost - PWD encrypted message with FES web portal - some sends fail with BadRequest error`
    // test: `user4@standardsubdomainfes.localhost - PWD encrypted message with FES web portal - a send fails with gateway update error`
    '/shared-tenant-fes/api/v1/message/?': async ({ body }, req) => {
      const gatewayMatch = /\/shared-tenant-fes\/api\/v1\/message\/([^/]+)\/gateway/.exec(req.url);
      if (gatewayMatch && req.method === 'POST') {
        const externalId = gatewayMatch[1];
        if (externalId === 'FES-MOCK-EXTERNAL-FOR-GATEWAYFAILURE@EXAMPLE.COM-ID') {
          throw new HttpClientErr(`Test error`, Status.BAD_REQUEST);
        }
        authenticate(req, 'oidc');
        expect(body).to.match(messageIdRegexForRequest(req));
        return {};
      }
      throw new HttpClientErr('Not Found', 404);
    },
  };
};

const authenticate = (req: { headers: IncomingHttpHeaders }, type: 'oidc' | 'fes'): string => {
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

const messageIdRegexForRequest = (req: { headers: IncomingHttpHeaders }) => messageIdRegex(parsePort(req));
