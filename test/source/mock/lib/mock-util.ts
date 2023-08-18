/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { IncomingHttpHeaders } from 'http2';

export const isGet = (r: { method: string }) => r.method === 'GET' || r.method === 'HEAD';
export const isPost = (r: { method: string }) => r.method === 'POST';
export const isPut = (r: { method: string }) => r.method === 'PUT';
export const isDelete = (r: { method: string }) => r.method === 'DELETE';
// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
export const parsePort = (r: { headers: IncomingHttpHeaders }) => {
  return (r.headers.host ?? r.headers[':authority'])!.split(':')[1];
};
// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
export const parseResourceId = (url: string) => url.match(/\/([a-zA-Z0-9\-_]+)(\?|$)/)![1];
export const messageIdRegex = (port: string) => new RegExp(`{"emailGatewayMessageId":"<(.+)@standardsubdomainfes.localhost:${port}>"}`);
