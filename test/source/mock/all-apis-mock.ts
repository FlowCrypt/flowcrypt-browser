/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Api, Handlers } from './lib/api';
import * as http2 from 'http2';

export type HandlersRequestDefinition = { query: { [k: string]: string }; body?: unknown };
export type HandlersDefinition = Handlers<HandlersRequestDefinition, unknown>;

export const startAllApisMock = async (logger: (line: string) => void) => {
  class LoggedApi<REQ, RES> extends Api<REQ, RES> {
    protected throttleChunkMsUpload = 15;
    protected throttleChunkMsDownload = 200;
    protected log = (ms: number, req: http2.Http2ServerRequest, res: http2.Http2ServerResponse, errRes?: Buffer) => {
      if (req.url !== '/favicon.ico') {
        logger(`${ms}ms | ${res.statusCode} ${req.method} ${req.url} | ${errRes ? errRes : ''}`);
      }
    };
  }
  const api = new LoggedApi<HandlersRequestDefinition, unknown>('google-mock', {
    '/favicon.ico': async () => '',
  });
  await api.listen();
  return api;
};
