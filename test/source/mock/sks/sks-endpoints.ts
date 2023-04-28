/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { KeyUtil } from '../../core/crypto/key';
import { HandlersDefinition } from '../all-apis-mock';
import { HttpClientErr, Status } from '../lib/api';
import { isGet } from '../lib/mock-util';

export type SksConfig = Record<string, { pubkey?: string; returnError?: HttpClientErr }>;

export const getMockSksEndpoints = (config: SksConfig | undefined): HandlersDefinition => {
  return {
    '/pks/lookup': async (parsedReq, req) => {
      if (!isGet(req) || !config) {
        throw new HttpClientErr(`Not implemented: ${req.method}`);
      }
      const { fingerprint, search } = parsedReq.query;
      if (fingerprint === 'on') {
        // search by email
        if (!config[search]) {
          throw new HttpClientErr('Pubkey not found', Status.NOT_FOUND);
        }
        const pubRes = config[search];
        if (pubRes.returnError) {
          throw pubRes.returnError;
        }
        const key = pubRes.pubkey!;
        const parsed = await KeyUtil.parse(key);
        return `info:1:10\npub:${parsed.allIds[0]}:1:2048:1600067427::\nuid:Test <${search}>:1600067427::`;
      } else {
        // search by fingerprint/longid
        for (const configKey of Object.keys(config)) {
          const pubRes = config[configKey];
          if (pubRes.pubkey) {
            const parsed = await KeyUtil.parse(pubRes.pubkey);
            if (parsed.allIds.some(id => id.includes(search.slice(2)))) {
              // slice(2) is used to remove 0x from search string
              return pubRes.pubkey;
            }
          }
        }
        throw new HttpClientErr('Pubkey not found', Status.NOT_FOUND);
      }
    },
  };
};
