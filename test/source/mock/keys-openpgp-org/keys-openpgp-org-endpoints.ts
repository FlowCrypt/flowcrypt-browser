/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { HandlersDefinition } from '../all-apis-mock';
import { somePubkey } from '../attester/attester-key-constants';
import { HttpClientErr } from '../lib/api';
import { isGet } from '../lib/mock-util';

export const mockKeysOpenPGPOrgEndpoints: HandlersDefinition = {
  '/keys-openpgp-org/vks/v1/by-email/?': async ({}, req) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const email = decodeURIComponent(req.url!.split('/').pop()!.toLowerCase().trim());
    if (!isGet(req)) {
      throw new HttpClientErr(`Not implemented: ${req.method}`);
    }
    if (email === 'test.only.pubkey.keys.openpgp.org@allowed-domain.test' || email === 'test.only.pubkey.keys.openpgp.org@other.com') {
      return somePubkey;
    }
    throw new HttpClientErr('Pubkey not found', 404);
  },
};
