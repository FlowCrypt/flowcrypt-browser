/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import * as http from 'http';

import { Api, Handlers } from './lib/api';

import { mockAttesterEndpoints } from './attester/attester-endpoints';
import { mockBackendEndpoints } from './backend/backend-endpoints';
import { mockGoogleEndpoints } from './google/google-endpoints';
import { mockKeyManagerEndpoints } from './key-manager/key-manager-endpoints';

export type HandlersDefinition = Handlers<{ query: { [k: string]: string; }; body?: unknown; }, unknown>;

export const startAllApisMock = async (logger: (line: string) => void) => {
  class LoggedApi<REQ, RES> extends Api<REQ, RES> {
    protected throttleChunkMs = 50;
    protected log = (req: http.IncomingMessage, res: http.ServerResponse, errRes?: Buffer) => {
      if (req.url !== '/favicon.ico') {
        logger(`${res.statusCode} ${req.method} ${req.url} | ${errRes ? errRes : ''}`);
      }
    }
  }
  const api = new LoggedApi<{ query: { [k: string]: string }, body?: unknown }, unknown>('google-mock', {
    ...mockGoogleEndpoints,
    ...mockBackendEndpoints,
    ...mockAttesterEndpoints,
    ...mockKeyManagerEndpoints,
    '/favicon.ico': async () => '',
  });
  await api.listen(8001);
  return api;
};
