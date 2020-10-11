/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { HttpClientErr } from '../lib/api';
import { HandlersDefinition } from '../all-apis-mock';

export const mockWellKnownHostMetaEndpoints: HandlersDefinition = {
  '/.well-known/host-meta.json?local=err500': async ({ body }, req) => {
    throw new Error(`Intentional host meta 500 - ignored on consumer but noticed by enterprise`);
  },
};
