/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { expect } from 'chai';
import { IncomingMessage } from 'http';
import { Buf } from '../../core/buf';
import { MsgUtil } from '../../core/crypto/pgp/msg-util';
import { HandlersDefinition } from '../all-apis-mock';
import { HttpClientErr, Status } from '../lib/api';
import { MockJwt } from '../lib/oauth';

const standardFesUrl = 'fes.standardsubdomainfes.localhost:8001';
const issuedAccessTokens: string[] = [];

const processMessageFromUser = async (body: string) => {
  expect(body).to.contain('-----BEGIN PGP MESSAGE-----');
  expect(body).to.contain('"associateReplyToken":"mock-fes-reply-token"');
  expect(body).to.contain('"to":["Mr To <to@example.com>"]');
  expect(body).to.contain('"cc":[]');
  expect(body).to.contain('"bcc":["Mr Bcc <bcc@example.com>"]');
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const encryptedData = Buf.fromUtfStr(body.match(/-----BEGIN PGP MESSAGE-----.*-----END PGP MESSAGE-----/s)![0]);
  const decrypted = await MsgUtil.decryptMessage({
    kisWithPp: [],
    msgPwd: 'lousy pwdgO0d-pwd',
    encryptedData,
    verificationPubs: [],
  });
  expect(decrypted.success).to.equal(true);
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const decryptedMimeMsg = decrypted.content!.toUtfStr();
  expect(decryptedMimeMsg).to.contain(
    'Content-Type: text/plain\r\n' +
      'Content-Transfer-Encoding: quoted-printable\r\n\r\n' +
      'PWD encrypted message with FES - ID TOKEN'
  );
  // small.txt
  expect(decryptedMimeMsg).to.contain(
    'Content-Type: text/plain; name=small.txt\r\n' + 'Content-Disposition: attachment; filename=small.txt'
  );
  expect(decryptedMimeMsg).to.contain(
    'Content-Transfer-Encoding: base64\r\n\r\n' + 'c21hbGwgdGV4dCBmaWxlCm5vdCBtdWNoIGhlcmUKdGhpcyB3b3JrZWQK'
  );
  const response = {
    // this url is required for pubkey encrypted message
    url: `http://${standardFesUrl}/message/FES-MOCK-MESSAGE-ID`,
    externalId: 'FES-MOCK-EXTERNAL-ID',
    emailToExternalIdAndUrl: {} as { [email: string]: { url: string; externalId: string } },
  };
  response.emailToExternalIdAndUrl['to@example.com'] = {
    url: `http://${standardFesUrl}/message/FES-MOCK-MESSAGE-FOR-TO@EXAMPLE.COM-ID`,
    externalId: 'FES-MOCK-EXTERNAL-FOR-TO@EXAMPLE.COM-ID',
  };
  response.emailToExternalIdAndUrl['bcc@example.com'] = {
    url: `http://${standardFesUrl}/message/FES-MOCK-MESSAGE-FOR-BCC@EXAMPLE.COM-ID`,
    externalId: 'FES-MOCK-EXTERNAL-FOR-BCC@EXAMPLE.COM-ID',
  };
  return response;
};

const processMessageFromUser2 = async (body: string) => {
  expect(body).to.contain('-----BEGIN PGP MESSAGE-----');
  expect(body).to.contain('"associateReplyToken":"mock-fes-reply-token"');
  expect(body).to.contain(
    '"to":["sender@domain.com","flowcrypt.compatibility@gmail.com","to@example.com","mock.only.pubkey@flowcrypt.com"]'
  );
  expect(body).to.contain('"cc":[]');
  expect(body).to.contain('"bcc":[]');
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const encryptedData = Buf.fromUtfStr(body.match(/-----BEGIN PGP MESSAGE-----.*-----END PGP MESSAGE-----/s)![0]);
  const decrypted = await MsgUtil.decryptMessage({
    kisWithPp: [],
    msgPwd: 'gO0d-pwd',
    encryptedData,
    verificationPubs: [],
  });
  expect(decrypted.success).to.equal(true);
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const decryptedMimeMsg = decrypted.content!.toUtfStr();
  // small.txt
  expect(decryptedMimeMsg).to.contain(
    'Content-Type: text/plain; name=small.txt\r\n' + 'Content-Disposition: attachment; filename=small.txt'
  );
  expect(decryptedMimeMsg).to.contain(
    'Content-Transfer-Encoding: base64\r\n\r\n' + 'c21hbGwgdGV4dCBmaWxlCm5vdCBtdWNoIGhlcmUKdGhpcyB3b3JrZWQK'
  );
  // small.pdf
  expect(decryptedMimeMsg).to.contain(
    'Content-Type: application/pdf; name=small.pdf\r\n' + 'Content-Disposition: attachment; filename=small.pdf'
  );
  expect(decryptedMimeMsg).to.contain(
    'Content-Transfer-Encoding: base64\r\n\r\n' +
      'JVBERi0xLjQKJcOkw7zDtsOfCjIgMCBvYmoKPDwvTGVuZ3RoIDMgMCBSL0ZpbHRlci9GbGF0ZURl'
  );
  const response = {
    // this url is required for pubkey encrypted message
    url: `http://${standardFesUrl}/message/FES-MOCK-MESSAGE-ID`,
    externalId: 'FES-MOCK-EXTERNAL-ID',
    emailToExternalIdAndUrl: {} as { [email: string]: { url: string; externalId: string } },
  };
  response.emailToExternalIdAndUrl['to@example.com'] = {
    url: `http://${standardFesUrl}/message/FES-MOCK-MESSAGE-FOR-TO@EXAMPLE.COM-ID`,
    externalId: 'FES-MOCK-EXTERNAL-FOR-TO@EXAMPLE.COM-ID',
  };
  response.emailToExternalIdAndUrl['sender@domain.com'] = {
    url: `http://${standardFesUrl}/message/FES-MOCK-MESSAGE-FOR-SENDER@DOMAIN.COM-ID`,
    externalId: 'FES-MOCK-EXTERNAL-FOR-SENDER@DOMAIN.COM-ID',
  };
  response.emailToExternalIdAndUrl['flowcrypt.compatibility@gmail.com'] = {
    url: `http://${standardFesUrl}/message/FES-MOCK-MESSAGE-FOR-FLOWCRYPT.COMPATIBILITY@GMAIL.COM-ID`,
    externalId: 'FES-MOCK-EXTERNAL-FOR-FLOWCRYPT.COMPATIBILITY@GMAIL.COM-ID',
  };
  response.emailToExternalIdAndUrl['mock.only.pubkey@flowcrypt.com'] = {
    url: `http://${standardFesUrl}/message/FES-MOCK-MESSAGE-FOR-MOCK.ONLY.PUBKEY@FLOWCRYPT.COM-ID`,
    externalId: 'FES-MOCK-EXTERNAL-FOR-MOCK.ONLY.PUBKEY@FLOWCRYPT.COM-ID',
  };
  return response;
};

const processMessageFromUser3 = async (body: string) => {
  expect(body).to.contain('-----BEGIN PGP MESSAGE-----');
  expect(body).to.contain('"associateReplyToken":"mock-fes-reply-token"');
  expect(body).to.contain('"to":["to@example.com"]');
  expect(body).to.contain('"cc":[]');
  expect(body).to.contain('"bcc":["flowcrypt.compatibility@gmail.com"]');
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const encryptedData = Buf.fromUtfStr(body.match(/-----BEGIN PGP MESSAGE-----.*-----END PGP MESSAGE-----/s)![0]);
  const decrypted = await MsgUtil.decryptMessage({
    kisWithPp: [],
    msgPwd: 'gO0d-pwd',
    encryptedData,
    verificationPubs: [],
  });
  expect(decrypted.success).to.equal(true);
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const decryptedMimeMsg = decrypted.content!.toUtfStr();
  // small.txt
  expect(decryptedMimeMsg).to.contain(
    'Content-Type: text/plain\r\n' +
      'Content-Transfer-Encoding: quoted-printable\r\n\r\n' +
      'PWD encrypted message with FES - pubkey recipient in bcc'
  );
  const response = {
    // this url is required for pubkey encrypted message
    url: `http://${standardFesUrl}/message/FES-MOCK-MESSAGE-ID`,
    externalId: 'FES-MOCK-EXTERNAL-ID',
    emailToExternalIdAndUrl: {} as { [email: string]: { url: string; externalId: string } },
  };
  response.emailToExternalIdAndUrl['to@example.com'] = {
    url: `http://${standardFesUrl}/message/FES-MOCK-MESSAGE-FOR-TO@EXAMPLE.COM-ID`,
    externalId: 'FES-MOCK-EXTERNAL-FOR-TO@EXAMPLE.COM-ID',
  };
  response.emailToExternalIdAndUrl['flowcrypt.compatibility@gmail.com'] = {
    url: `http://${standardFesUrl}/message/FES-MOCK-MESSAGE-FOR-FLOWCRYPT.COMPATIBILITY@GMAIL.COM-ID`,
    externalId: 'FES-MOCK-EXTERNAL-FOR-FLOWCRYPT.COMPATIBILITY@GMAIL.COM-ID',
  };
  return response;
};

const processMessageFromUser4 = async (body: string) => {
  const response = {
    // this url is required for pubkey encrypted message
    url: `http://${standardFesUrl}/message/FES-MOCK-MESSAGE-ID`,
    externalId: 'FES-MOCK-EXTERNAL-ID',
    emailToExternalIdAndUrl: {} as { [email: string]: { url: string; externalId: string } },
  };
  if (body.includes('to@example.com')) {
    response.emailToExternalIdAndUrl['to@example.com'] = {
      url: `http://${standardFesUrl}/message/FES-MOCK-MESSAGE-FOR-TO@EXAMPLE.COM-ID`,
      externalId: 'FES-MOCK-EXTERNAL-FOR-TO@EXAMPLE.COM-ID',
    };
  }
  if (body.includes('invalid@example.com')) {
    response.emailToExternalIdAndUrl['invalid@example.com'] = {
      url: `http://${standardFesUrl}/message/FES-MOCK-MESSAGE-FOR-INVALID@EXAMPLE.COM-ID`,
      externalId: 'FES-MOCK-EXTERNAL-FOR-INVALID@EXAMPLE.COM-ID',
    };
  }
  if (body.includes('timeout@example.com')) {
    response.emailToExternalIdAndUrl['timeout@example.com'] = {
      url: `http://${standardFesUrl}/message/FES-MOCK-MESSAGE-FOR-TIMEOUT@EXAMPLE.COM-ID`,
      externalId: 'FES-MOCK-EXTERNAL-FOR-TIMEOUT@EXAMPLE.COM-ID',
    };
  }
  if (body.includes('Mr Cc <cc@example.com>')) {
    response.emailToExternalIdAndUrl['cc@example.com'] = {
      url: `http://${standardFesUrl}/message/FES-MOCK-MESSAGE-FOR-CC@EXAMPLE.COM-ID`,
      externalId: 'FES-MOCK-EXTERNAL-FOR-CC@EXAMPLE.COM-ID',
    };
  }
  if (body.includes('First Last <flowcrypt.compatibility@gmail.com>')) {
    response.emailToExternalIdAndUrl['flowcrypt.compatibility@gmail.com'] = {
      url: `http://${standardFesUrl}/message/FES-MOCK-MESSAGE-FOR-FLOWCRYPT.COMPATIBILITY@GMAIL.COM-ID`,
      externalId: 'FES-MOCK-EXTERNAL-FOR-FLOWCRYPT.COMPATIBILITY@GMAIL.COM-ID',
    };
  }
  if (body.includes('gatewayfailure@example.com')) {
    response.emailToExternalIdAndUrl['gatewayfailure@example.com'] = {
      url: `http://${standardFesUrl}/message/FES-MOCK-MESSAGE-FOR-GATEWAYFAILURE@EXAMPLE.COM-ID`,
      externalId: 'FES-MOCK-EXTERNAL-FOR-GATEWAYFAILURE@EXAMPLE.COM-ID',
    };
  }
  return response;
};

export const mockFesEndpoints: HandlersDefinition = {
  // standard fes location at https://fes.domain.com
  '/api/': async ({}, req) => {
    if ([standardFesUrl].includes(req.headers.host || '') && req.method === 'GET') {
      return {
        vendor: 'Mock',
        service: 'enterprise-server',
        orgId: 'standardsubdomainfes.test',
        version: 'MOCK',
        apiVersion: 'v1',
      };
    }
    if (req.headers.host === 'fes.localhost:8001') {
      // test `status404 does not return any fesUrl` uses this
      // this makes enterprise version tolerate missing FES - explicit 404
      throw new HttpClientErr(`Not found`, 404);
    }
    if (req.headers.host === 'fes.google.mock.localhost:8001') {
      // test `compose - auto include pubkey is inactive when our key is available on Wkd` uses this
      // this makes enterprise version tolerate missing FES - explicit 404
      throw new HttpClientErr(`Not found`, 404);
    }
    throw new HttpClientErr(`Not running any FES here: ${req.headers.host}`);
  },
  '/api/v1/client-configuration': async ({}, req) => {
    // individual ClientConfiguration is tested using FlowCrypt backend mock, see BackendData.getClientConfiguration
    if (req.method !== 'GET') {
      throw new HttpClientErr('Unsupported method');
    }
    if (
      req.headers.host === standardFesUrl &&
      req.url === `/api/v1/client-configuration?domain=standardsubdomainfes.localhost:8001`
    ) {
      return {
        clientConfiguration: { flags: [], disallow_attester_search_for_domains: ['got.this@fromstandardfes.com'] }, // eslint-disable-line @typescript-eslint/naming-convention
      };
    }
    throw new HttpClientErr(`Unexpected FES domain "${req.headers.host}" and url "${req.url}"`);
  },
  '/api/v1/message/new-reply-token': async ({}, req) => {
    if (req.headers.host === standardFesUrl && req.method === 'POST') {
      authenticate(req, 'oidc');
      return { replyToken: 'mock-fes-reply-token' };
    }
    throw new HttpClientErr('Not Found', 404);
  },
  '/api/v1/message': async ({ body }, req) => {
    // body is a mime-multipart string, we're doing a few smoke checks here without parsing it
    if (req.headers.host === standardFesUrl && req.method === 'POST' && typeof body === 'string') {
      // test: `compose - user@standardsubdomainfes.localhost:8001 - PWD encrypted message with FES web portal`
      authenticate(req, 'oidc');
      if (body.includes('"from":"user@standardsubdomainfes.localhost:8001"')) {
        return await processMessageFromUser(body);
      }
      if (body.includes('"from":"user2@standardsubdomainfes.localhost:8001"')) {
        return await processMessageFromUser2(body);
      }
      if (body.includes('"from":"user3@standardsubdomainfes.localhost:8001"')) {
        return await processMessageFromUser3(body);
      }
      if (body.includes('"from":"user4@standardsubdomainfes.localhost:8001"')) {
        return await processMessageFromUser4(body);
      }
    }
    throw new HttpClientErr('Not Found', 404);
  },
  '/api/v1/message/FES-MOCK-EXTERNAL-ID/gateway': async ({ body }, req) => {
    if (req.headers.host === standardFesUrl && req.method === 'POST') {
      // test: `compose - user@standardsubdomainfes.localhost:8001 - PWD encrypted message with FES web portal`
      authenticate(req, 'oidc');
      expect(body).to.match(/{"emailGatewayMessageId":"<(.+)@standardsubdomainfes.localhost:8001>"}/);
      return {};
    }
    throw new HttpClientErr('Not Found', 404);
  },
  '/api/v1/message/FES-MOCK-EXTERNAL-FOR-SENDER@DOMAIN.COM-ID/gateway': async ({ body }, req) => {
    if (req.headers.host === standardFesUrl && req.method === 'POST') {
      // test: `compose - user2@standardsubdomainfes.localhost:8001 - PWD encrypted message with FES - Reply rendering`
      authenticate(req, 'oidc');
      expect(body).to.match(/{"emailGatewayMessageId":"<(.+)@standardsubdomainfes.localhost:8001>"}/);
      return {};
    }
    throw new HttpClientErr('Not Found', 404);
  },
  '/api/v1/message/FES-MOCK-EXTERNAL-FOR-TO@EXAMPLE.COM-ID/gateway': async ({ body }, req) => {
    if (req.headers.host === standardFesUrl && req.method === 'POST') {
      // test: `compose - user@standardsubdomainfes.localhost:8001 - PWD encrypted message with FES web portal`
      // test: `compose - user2@standardsubdomainfes.localhost:8001 - PWD encrypted message with FES - Reply rendering`
      // test: `compose - user3@standardsubdomainfes.localhost:8001 - PWD encrypted message with FES web portal - pubkey recipient in bcc`
      // test: `compose - user4@standardsubdomainfes.localhost:8001 - PWD encrypted message with FES web portal - some sends fail with BadRequest error`
      authenticate(req, 'oidc');
      expect(body).to.match(/{"emailGatewayMessageId":"<(.+)@standardsubdomainfes.localhost:8001>"}/);
      return {};
    }
    throw new HttpClientErr('Not Found', 404);
  },
  '/api/v1/message/FES-MOCK-EXTERNAL-FOR-BCC@EXAMPLE.COM-ID/gateway': async ({ body }, req) => {
    if (req.headers.host === standardFesUrl && req.method === 'POST') {
      // test: `compose - user@standardsubdomainfes.localhost:8001 - PWD encrypted message with FES web portal`
      authenticate(req, 'oidc');
      expect(body).to.match(/{"emailGatewayMessageId":"<(.+)@standardsubdomainfes.localhost:8001>"}/);
      return {};
    }
    throw new HttpClientErr('Not Found', 404);
  },
  '/api/v1/message/FES-MOCK-EXTERNAL-FOR-GATEWAYFAILURE@EXAMPLE.COM-ID/gateway': async () => {
    // test: `user4@standardsubdomainfes.localhost:8001 - PWD encrypted message with FES web portal - a send fails with gateway update error`
    throw new HttpClientErr(`Test error`, Status.BAD_REQUEST);
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
  } else {
    // fes
    if (!issuedAccessTokens.includes(jwt)) {
      throw new HttpClientErr('FES mock received access token it didnt issue', 401);
    }
  }
  return MockJwt.parseEmail(jwt);
};
