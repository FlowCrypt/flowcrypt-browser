/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { IncomingMessage } from 'http';

export const isGet = (r: IncomingMessage) => r.method === 'GET' || r.method === 'HEAD';
export const isPost = (r: IncomingMessage) => r.method === 'POST';
export const isPut = (r: IncomingMessage) => r.method === 'PUT';
export const isDelete = (r: IncomingMessage) => r.method === 'DELETE';
// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
export const parsePort = (r: IncomingMessage) => r.headers.host!.split(':')[1];
// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
export const parseResourceId = (url: string) => url.match(/\/([a-zA-Z0-9\-_]+)(\?|$)/)![1];
export const messageIdRegex = (port: string) => new RegExp(`{"emailGatewayMessageId":"<(.+)@standardsubdomainfes.localhost:${port}>"}`);
