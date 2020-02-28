/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { HttpClientErr } from '../lib/api';
import { HandlersDefinition } from '../all-apis-mock';
import { isPut, isGet } from '../lib/mock-util';
import { oauth } from '../lib/oauth';
import { PgpKey } from '../../core/pgp-key';
import { Dict } from '../../core/common';
import { expect } from 'chai';

// tslint:disable:max-line-length
/* eslint-disable max-len */
// tslint:disable:no-unused-expression
/* eslint-disable no-unused-expressions */

const existingPrv = '-----BEGIN PGP PRIVATE KEY BLOCK-----\r\nVersion: FlowCrypt 7.6.2 Gmail Encryption\r\nComment: Seamlessly send and receive encrypted email\r\n\r\n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\r\n=tqvP\r\n-----END PGP PRIVATE KEY BLOCK-----\r\n';

export const MOCK_KM_LAST_INSERTED_KEY: { [acct: string]: { decryptedPrivateKey: string, publicKey: string, longid: string } } = {}; // accessed from test runners

export const mockKeyManagerEndpoints: HandlersDefinition = {
  '/flowcrypt-email-key-manager/keys/private': async ({ body }, req) => {
    const acctEmail = oauth.checkAuthorizationHeaderWithIdToken(req.headers.authorization);
    if (isGet(req)) {
      if (acctEmail === 'get.key@key-manager-autogen.flowcrypt.com') {
        return { privateKeys: [{ decryptedPrivateKey: existingPrv }] };
      }
      if (acctEmail === 'put.key@key-manager-autogen.flowcrypt.com') {
        return { privateKeys: [] };
      }
      if (acctEmail === 'put.error@key-manager-autogen.flowcrypt.com') {
        return { privateKeys: [] };
      }
      if (acctEmail === 'get.error@key-manager-autogen.flowcrypt.com') {
        throw new Error('Intentional error for get.error to test client behavior');
      }
      throw new HttpClientErr(`Unexpectedly calling mockKeyManagerEndpoints:/keys/private GET with acct ${acctEmail}`);
    }
    if (isPut(req)) {
      const { decryptedPrivateKey, publicKey, longid } = body as Dict<string>;
      if (acctEmail === 'put.key@key-manager-autogen.flowcrypt.com') {
        const prvDetails = await PgpKey.parseDetails(decryptedPrivateKey);
        expect(prvDetails.keys).to.have.length(1);
        expect(prvDetails.keys[0].algo.bits).to.equal(2048);
        expect(prvDetails.keys[0].ids[0].longid).to.equal(longid);
        expect(prvDetails.keys[0].users).to.have.length(1);
        expect(prvDetails.keys[0].users[0]).to.equal('First Last <put.key@key-manager-autogen.flowcrypt.com>');
        expect(prvDetails.keys[0].private).to.exist;
        expect(prvDetails.keys[0].isFullyDecrypted).to.be.true;
        const pubDetails = await PgpKey.parseDetails(publicKey);
        expect(pubDetails.keys).to.have.length(1);
        expect(pubDetails.keys[0].algo.bits).to.equal(2048);
        expect(pubDetails.keys[0].ids[0].longid).to.equal(longid);
        expect(pubDetails.keys[0].users).to.have.length(1);
        expect(pubDetails.keys[0].users[0]).to.equal('First Last <put.key@key-manager-autogen.flowcrypt.com>');
        expect(pubDetails.keys[0].private).to.not.exist;
        MOCK_KM_LAST_INSERTED_KEY[acctEmail] = { decryptedPrivateKey, publicKey, longid };
        return {};
      }
      if (acctEmail === 'put.error@key-manager-autogen.flowcrypt.com') {
        throw new Error('Intentional error for put.error user to test client behavior');
      }
      throw new HttpClientErr(`Unexpectedly calling mockKeyManagerEndpoints:/keys/private PUT with acct ${acctEmail}`);
    }
    throw new HttpClientErr(`Unknown method: ${req.method}`);
  },
};
