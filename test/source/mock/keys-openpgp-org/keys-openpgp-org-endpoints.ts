/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { HandlersDefinition } from '../all-apis-mock';
import { HttpClientErr } from '../lib/api';
import { isGet } from '../lib/mock-util';

export type KeysOpenPGPOrgConfig = Record<string, string>;

export const getMockKeysOpenPGPOrgEndpoints = (keysOpenPGPOrgConfig: KeysOpenPGPOrgConfig | undefined): HandlersDefinition => {
  return {
    '/keys-openpgp-org/vks/v1/by-email/?': async ({}, req) => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const email = decodeURIComponent(req.url!.split('/').pop()!.toLowerCase().trim());
      if (!isGet(req)) {
        throw new HttpClientErr(`Not implemented: ${req.method}`);
      }
      if (keysOpenPGPOrgConfig && keysOpenPGPOrgConfig[email]) {
        return keysOpenPGPOrgConfig[email];
      }
      throw new HttpClientErr('Pubkey not found', 404);
    },
  };
};
