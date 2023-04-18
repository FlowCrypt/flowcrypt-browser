/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { HttpClientErr, Status } from '../lib/api';
import { HandlersDefinition } from '../all-apis-mock';
import { isPost, isGet } from '../lib/mock-util';
import { OauthMock } from '../lib/oauth';
import { expect } from 'chai';
import { Dict } from '../../core/common';
import { Util } from '../../util';

interface PubKeyLookUpResult {
  pubkey?: string;
  delayInSeconds?: number;
  domainToCheck?: string;
  returnError?: { code: number; message: string };
}

export interface AttesterConfig {
  pubkeyLookup?: Record<string, PubKeyLookUpResult>;
  ldapRelay?: Record<string, PubKeyLookUpResult>;
  welcomeMessageEnabled?: boolean;
}

export const getMockAttesterEndpoints = (oauth: OauthMock, attesterConfig: AttesterConfig): HandlersDefinition => {
  return {
    '/attester/pub/?': async ({ body }, req) => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const emailOrLongid = req.url!.split('/').pop()!.toLowerCase().trim();
      if (isGet(req)) {
        if (!attesterConfig?.pubkeyLookup) {
          throw new HttpClientErr('Method not allowed', 405);
        }
        const pubRes = attesterConfig.pubkeyLookup[emailOrLongid];
        if (pubRes) {
          if (pubRes.returnError) {
            throw new HttpClientErr(pubRes.returnError.message, pubRes.returnError.code);
          }
          if (pubRes.delayInSeconds) {
            await Util.sleep(pubRes.delayInSeconds);
          }
          return pubRes.pubkey;
        }
        throw new HttpClientErr('Pubkey not found', 404);
      } else if (isPost(req)) {
        oauth.checkAuthorizationForEmail(req.headers.authorization, emailOrLongid);
        expect(body).to.contain('-----BEGIN PGP PUBLIC KEY BLOCK-----');
        attesterConfig.pubkeyLookup = {
          ...(attesterConfig.pubkeyLookup ?? {}),
          [emailOrLongid]: { pubkey: body as string },
        };
        return 'Saved'; // 200 OK
      } else {
        throw new HttpClientErr(`Not implemented: ${req.method}`);
      }
    },
    '/attester/ldap-relay': async (parsedReq, req) => {
      // const server = parsedReq.query.server;
      const server = parsedReq.query.server;
      const emailOrLongid = parsedReq.query.search;
      if (isGet(req)) {
        if (!attesterConfig?.ldapRelay) {
          throw new HttpClientErr('Method not allowed', 405);
        }
        const pubRes = attesterConfig.ldapRelay[emailOrLongid];
        if (pubRes) {
          if (pubRes.returnError) {
            throw new HttpClientErr(pubRes.returnError.message, pubRes.returnError.code);
          }
          if (!pubRes.domainToCheck || pubRes.domainToCheck === server) {
            return pubRes.pubkey;
          }
        }
        throw new HttpClientErr('No OpenPGP LDAP server on this address.', Status.NOT_FOUND);
      } else {
        throw new HttpClientErr(`Not implemented: ${req.method}`);
      }
    },
    '/attester/welcome-message': async ({ body }, req) => {
      if (!isPost(req)) {
        throw new HttpClientErr(`Wrong method: ${req.method}`);
      }
      const { email, pubkey } = body as Dict<string>;
      expect(email).to.contain('@');
      expect(pubkey).to.contain('-----BEGIN PGP PUBLIC KEY BLOCK-----');
      return { sent: attesterConfig?.welcomeMessageEnabled ?? false };
    },
  };
};
