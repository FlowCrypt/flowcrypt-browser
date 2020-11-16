/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { HandlersDefinition } from '../all-apis-mock';
import { HttpClientErr } from '../lib/api';

export const mockFesEndpoints: HandlersDefinition = {
  '/api/': async ({ }) => {
    throw new HttpClientErr('Not Found', 404);
    // ensureExpectedHost(req);
    // return {
    //   "vendor": "Mock",
    //   "service": "enterprise-server",
    //   "orgId": "mock.org",
    //   "version": "MOCK",
    //   "apiVersion": "v1",
    // };
  },
};

// const ensureExpectedHost = (req: IncomingMessage) => {
//   const expectedHost = 'fes.localhost:8001';
//   if (req.headers.host !== expectedHost) {
//     throw new HttpClientErr(`Unexpected FES host: ${req.headers.host}, expecting ${expectedHost}`);
//   }
// };
