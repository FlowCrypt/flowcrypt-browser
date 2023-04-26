/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { PgpArmor } from '../../core/crypto/pgp/pgp-armor';
import { HandlersDefinition } from '../all-apis-mock';
import { HttpClientErr, Status } from '../lib/api.js';
import { isGet } from '../lib/mock-util.js';
import { IncomingMessage } from 'http';

// todo - add a not found test with: throw new HttpClientErr('Pubkey not found', 404);

interface WkdLookUpResult {
  pubkeys?: string[];
  returnError?: HttpClientErr;
}

export interface WkdConfig {
  directLookup?: Record<string, WkdLookUpResult>;
  advancedLookup?: Record<string, WkdLookUpResult>;
}

const fetchKeyResult = async (req: IncomingMessage, keyRecord: Record<string, WkdLookUpResult> | undefined) => {
  const emailLocalPart = req.url!.split('?l=').pop()!.toLowerCase().trim();
  if (!keyRecord) {
    return '';
  }
  if (isGet(req)) {
    const pubRes = keyRecord[emailLocalPart];
    if (pubRes) {
      if (pubRes.returnError) {
        throw pubRes.returnError;
      }
      const dearmoredKeys = await Promise.all(
        (pubRes.pubkeys ?? []).map(async publicKey => {
          const result = await PgpArmor.dearmor(publicKey);
          return result.data;
        })
      );
      return Buffer.concat(dearmoredKeys);
    }
    throw new HttpClientErr('Pubkey not found', 404);
  } else {
    throw new HttpClientErr(`Not implemented: ${req.method}`, Status.BAD_REQUEST);
  }
};

export const getMockWkdEndpoints = (config: WkdConfig | undefined): HandlersDefinition => {
  return {
    '/.well-known/openpgpkey/hu/?': async (_, req) => {
      return await fetchKeyResult(req, config?.directLookup);
    },
    '/.well-known/openpgpkey/localhost/hu/?': async (_, req) => {
      return await fetchKeyResult(req, config?.advancedLookup);
    },
    '/.well-known/openpgpkey/localhost/policy': async () => {
      return ''; // allow advanced for localhost
    },
    '/.well-known/openpgpkey/policy': async () => {
      return ''; // allow direct for all
    },
  };
};
