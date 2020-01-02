
/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { IncomingMessage } from 'http';

export const isGet = (r: IncomingMessage) => r.method === 'GET' || r.method === 'HEAD';
export const isPost = (r: IncomingMessage) => r.method === 'POST';
export const isPut = (r: IncomingMessage) => r.method === 'PUT';
export const isDelete = (r: IncomingMessage) => r.method === 'DELETE';
export const parseResourceId = (url: string) => url.match(/\/([a-zA-Z0-9\-_]+)(\?|$)/)![1];
