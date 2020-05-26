
/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

export const isGet = (r: any) => r.method === 'GET' || r.method === 'HEAD';
export const isPost = (r: any) => r.method === 'POST';
export const isPut = (r: any) => r.method === 'PUT';
export const isDelete = (r: any) => r.method === 'DELETE';
export const parseResourceId = (url: string) => url.match(/\/([a-zA-Z0-9\-_]+)(\?|$)/)![1];
