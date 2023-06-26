/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { expect } from 'chai';
import { Dict } from '../../core/common';
import { KeyUtil } from '../../core/crypto/key';
import { HandlersDefinition } from '../all-apis-mock';
import { HttpClientErr } from '../lib/api';
import { isGet, isPut } from '../lib/mock-util';
import { OauthMock } from '../lib/oauth';

export interface KeyManagerConfig {
  keys?: string[];
  putKeysExpectation?: Record<
    string,
    {
      identity?: string;
      expirationExists?: boolean;
    }
  >;
  returnError?: HttpClientErr;
  putReturnError?: HttpClientErr;
}

export const getMockKeyManagerEndpoints = (oauth: OauthMock, config: KeyManagerConfig | undefined): HandlersDefinition => {
  return {
    '/flowcrypt-email-key-manager/v1/keys/private': async ({ body }, req) => {
      const acctEmail = oauth.checkAuthorizationHeaderWithIdToken(req.headers.authorization);
      if (isGet(req)) {
        if (config) {
          if (config.returnError) {
            throw config.returnError;
          }
          return { privateKeys: config.keys?.map(key => ({ decryptedPrivateKey: key })) ?? [] };
        }
        throw new HttpClientErr(`Unexpectedly calling mockKeyManagerEndpoints:/v1/keys/private GET with acct ${acctEmail}`);
      }
      if (isPut(req)) {
        if (config) {
          if (config.putReturnError) {
            throw config.putReturnError;
          }
          if (config.putKeysExpectation && config.putKeysExpectation[acctEmail]) {
            const expectation = config.putKeysExpectation[acctEmail];
            const { privateKey } = body as Dict<string>;
            const prv = await KeyUtil.parseMany(privateKey);
            expect(prv).to.have.length(1);
            expect(prv[0].algo.bits).to.equal(2048);
            expect(prv[0].identities).to.have.length(1);
            if (expectation.identity) {
              expect(prv[0].identities[0]).to.equal(expectation.identity);
            }
            expect(prv[0].isPrivate).to.be.true;
            expect(prv[0].fullyDecrypted).to.be.true;
            if (expectation.expirationExists) {
              expect(prv[0].expiration).to.exist;
            } else {
              expect(prv[0].expiration).to.not.exist;
            }
            config.keys = [privateKey];
            return {};
          }
        }
        throw new HttpClientErr(`Unexpectedly calling mockKeyManagerEndpoints:/v1/keys/private PUT with acct ${acctEmail}`);
      }
      throw new HttpClientErr(`Unknown method: ${req.method}`);
    },
  };
};
