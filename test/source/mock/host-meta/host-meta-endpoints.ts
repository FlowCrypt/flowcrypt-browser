/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { HttpClientErr } from '../lib/api';
import { HandlersDefinition } from '../all-apis-mock';

export const mockWellKnownHostMetaEndpoints: HandlersDefinition = {
  '/.well-known/host-meta.json?local=status500': async () => {
    throw new Error(`Intentional host meta 500 - ignored on consumer but noticed by enterprise`);
  },
  '/.well-known/host-meta.json?local=status404': async () => {
    throw new HttpClientErr(`Not Found`, 404);
  },
  '/.well-known/host-meta.json?local=not.json': async () => {
    return '<body>nothing</body>';
  },
};
