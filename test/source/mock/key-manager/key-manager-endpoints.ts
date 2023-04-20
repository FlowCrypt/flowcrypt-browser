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
  returnError?: { code: number; message: string };
  putReturnError?: { code: number; message: string };
}

export const getMockKeyManagerEndpoints = (oauth: OauthMock, config: KeyManagerConfig | undefined): HandlersDefinition => {
  return {
    '/flowcrypt-email-key-manager/v1/keys/private': async ({ body }, req) => {
      const acctEmail = oauth.checkAuthorizationHeaderWithIdToken(req.headers.authorization);
      if (isGet(req)) {
        if (config) {
          if (config.returnError) {
            throw new HttpClientErr(config.returnError.message, config.returnError.code);
          }
          return { privateKeys: config.keys?.map(key => ({ decryptedPrivateKey: key })) ?? [] };
        }
        throw new HttpClientErr(`Unexpectedly calling mockKeyManagerEndpoints:/v1/keys/private GET with acct ${acctEmail}`);
      }
      if (isPut(req)) {
        if (config) {
          if (config.putReturnError) {
            throw new HttpClientErr(config.putReturnError.message, config.putReturnError.code);
          }
          const { privateKey } = body as Dict<string>;
          if (acctEmail === 'put.key@key-manager-autogen.flowcrypt.test') {
            const prv = await KeyUtil.parseMany(privateKey);
            expect(prv).to.have.length(1);
            expect(prv[0].algo.bits).to.equal(2048);
            expect(prv[0].identities).to.have.length(1);
            expect(prv[0].identities[0]).to.equal('First Last <put.key@key-manager-autogen.flowcrypt.test>');
            expect(prv[0].isPrivate).to.be.true;
            expect(prv[0].fullyDecrypted).to.be.true;
            expect(prv[0].expiration).to.not.exist;
            config.keys = [privateKey];
            return {};
          }
          if (acctEmail === 'expire@key-manager-keygen-expiration.flowcrypt.test') {
            const prv = await KeyUtil.parseMany(privateKey);
            expect(prv).to.have.length(1);
            expect(prv[0].algo.bits).to.equal(2048);
            expect(prv[0].identities).to.have.length(1);
            expect(prv[0].identities[0]).to.equal('First Last <expire@key-manager-keygen-expiration.flowcrypt.test>');
            expect(prv[0].isPrivate).to.be.true;
            expect(prv[0].fullyDecrypted).to.be.true;
            expect(prv[0].expiration).to.exist;
            config.keys = [privateKey];
            return {};
          }
          if (acctEmail.includes('updating.key')) {
            const prv = await KeyUtil.parseMany(privateKey);
            expect(prv).to.have.length(1);
            expect(prv[0].algo.bits).to.equal(2048);
            expect(prv[0].identities).to.have.length(1);
            expect(prv[0].isPrivate).to.be.true;
            expect(prv[0].fullyDecrypted).to.be.true;
            expect(prv[0].expiration).to.not.exist;
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
