/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

// tslint:disable:no-direct-ajax

import { Dict } from '../core/common.js';
import { Env } from '../browser.js';
import { Att } from '../core/att.js';
import { Catch } from '../platform/catch.js';
import { Buf } from '../core/buf.js';
import { BrowserMsg } from '../extension.js';
import { Xss } from '../platform/xss.js';

type StandardError = { code: number | null; message: string; internal: string | null; data?: string; stack?: string; };
type StandardErrorRes = { error: StandardError };
export type ReqFmt = 'JSON' | 'FORM' | 'TEXT';
export type RecipientType = 'to' | 'cc' | 'bcc';
type ResFmt = 'json' | 'xhr';
export type ReqMethod = 'POST' | 'GET' | 'DELETE' | 'PUT';
type RawAjaxError = {
  // getAllResponseHeaders?: () => any,
  // getResponseHeader?: (e: string) => any,
  readyState: number,
  responseText?: string,
  status?: number,
  statusText?: string,
};

export type ProgressCb = (percent?: number, loaded?: number, total?: number) => void;
export type ProgressCbs = { upload?: ProgressCb | null, download?: ProgressCb | null };

abstract class ApiCallError extends Error {

  private static getPayloadStructure = (req: JQueryAjaxSettings): string => {
    if (typeof req.data === 'string') {
      try {
        return Object.keys(JSON.parse(req.data) as any).join(',');
      } catch (e) {
        return 'not-a-json';
      }
    } else if (req.data && typeof req.data === 'object') {
      return Object.keys(req.data).join(',');
    }
    return '';
  }

  protected static censoredUrl = (url: string | undefined): string => {
    if (!url) {
      return '(unknown url)';
    }
    if (url.indexOf('refreshToken=') !== -1) {
      return `${url.split('?')[0]}~censored:refreshToken`;
    }
    if (url.indexOf('token=') !== -1) {
      return `${url.split('?')[0]}~censored:token`;
    }
    if (url.indexOf('code=') !== -1) {
      return `${url.split('?')[0]}~censored:code`;
    }
    return url;
  }

  protected static describeApiAction = (req: JQueryAjaxSettings) => {
    const describeBody = typeof req.data === 'undefined' ? '(no body)' : typeof req.data;
    return `${req.method || 'GET'}-ing ${ApiCallError.censoredUrl(req.url)} ${describeBody}: ${ApiCallError.getPayloadStructure(req)}`;
  }

}

export class AjaxError extends ApiCallError {

  // todo - move these out of the class, they get weirdly serialized in err reports
  public STD_ERR_MSGS = { // tslint:disable-line:oneliner-object-literal
    GOOGLE_INVALID_TO_HEADER: 'Invalid to header',
    GOOGLE_RECIPIENT_ADDRESS_REQUIRED: 'Recipient address required',
  };

  public static fromXhr = (xhr: RawAjaxError, req: JQueryAjaxSettings, stack: string) => {
    const responseText = xhr.responseText || '';
    const status = typeof xhr.status === 'number' ? xhr.status : -1;
    stack += `\n\nprovided ajax call stack:\n${stack}`;
    if (status === 400 || status === 403 || (status === 200 && responseText && responseText[0] !== '{')) {
      // RawAjaxError with status 200 can happen when it fails to parse response - eg non-json result
      stack += `\n\nresponseText(0, 1000):\n${responseText.substr(0, 1000)}\n\npayload(0, 1000):\n${Catch.stringify(req.data).substr(0, 1000)}`;
    }
    const message = `${String(xhr.statusText || '(no status text)')}: ${String(xhr.status || -1)} when ${ApiCallError.describeApiAction(req)}`;
    return new AjaxError(message, stack, status, AjaxError.censoredUrl(req.url), responseText, xhr.statusText || '(no status text)');
  }

  constructor(message: string, public stack: string, public status: number, public url: string, public responseText: string, public statusText: string) {
    super(message);
  }

  public parseErrResMsg = (format: 'google') => {
    try {
      if (format === 'google') {
        const errMsg = ((JSON.parse(this.responseText) as any).error as any).message as string; // catching all errs below
        if (typeof errMsg === 'string') {
          return errMsg;
        }
      }
    } catch (e) {
      return undefined;
    }
    return undefined;
  }

}

export class ApiErrorResponse extends ApiCallError {

  public res: StandardErrorRes;
  public url: string;

  constructor(res: StandardErrorRes, req: JQueryAjaxSettings) {
    super(`Api error response when ${ApiCallError.describeApiAction(req)}`);
    this.res = res;
    this.url = req.url || '(unknown url)';
    this.stack += `\n\nresponse:\n${Catch.stringify(res)}`;
  }

}

export class AuthError extends Error { }

export class Api {

  public static err = {
    eli5: (e: any) => {
      if (Api.err.isMailOrAcctDisabled(e)) {
        return 'Email account is disabled';
      } else if (Api.err.isAuthPopupNeeded(e)) {
        return 'Browser needs to be re-connected to email account before proceeding.';
      } else if (Api.err.isInsufficientPermission(e)) {
        return 'Server says user has insufficient permissions for this action.';
      } else if (Api.err.isBlockedByProxy(e)) {
        return 'It seems that a company proxy or firewall is blocking internet traffic from this device.';
      } else if (Api.err.isAuthErr(e)) {
        return 'Server says this request was unauthorized, possibly caused by missing or wrong login.';
      } else if (Api.err.isReqTooLarge(e)) {
        return 'Server says this request is too large.';
      } else if (Api.err.isNotFound(e)) {
        return 'Server says this resource was not found';
      } else if (Api.err.isBadReq(e)) {
        return 'Server says this was a bad request (possibly a FlowCrypt bug)';
      } else if (Api.err.isNetErr(e)) {
        return 'Network connection issue.';
      } else if (Api.err.isServerErr(e)) {
        return 'Server responded with an unexpected error.';
      } else if (e instanceof AjaxError) {
        return 'AjaxError with unknown cause.';
      } else {
        return 'FlowCrypt encountered an error with unknown cause.';
      }
    },
    detailsAsHtmlWithNewlines: (e: any) => {
      let details = 'Below are technical details about the error. This may be useful for debugging.\n\n';
      details += `<b>Error string</b>: ${Xss.escape(String(e))}\n\n`;
      details += `<b>Error stack</b>: ${e instanceof Error ? Xss.escape((e.stack || '(empty)')) : '(no error stack)'}\n\n`;
      if (e instanceof AjaxError) {
        details += `<b>Ajax response</b>:\n${Xss.escape(e.responseText)}\n<b>End of Ajax response</b>\n`;
      }
      return details;
    },
    isNetErr: (e: any) => {
      if (e instanceof TypeError && (e.message === 'Failed to fetch' || e.message === 'NetworkError when attempting to fetch resource.')) {
        return true; // openpgp.js uses fetch()... which produces these errors
      }
      if (e instanceof AjaxError && (e.status === 0 && e.statusText === 'error' || e.statusText === 'timeout' || e.status === -1)) {
        return true;
      }
      if (e instanceof AjaxError && e.status === 400 && typeof e.responseText === 'string' && e.responseText.indexOf('RequestTimeout') !== -1) {
        return true; // AWS: Your socket connection to the server was not read from or written to within the timeout period. Idle connections will be closed.
      }
      return false;
    },
    isAuthErr: (e: any) => {
      if (e instanceof AuthError) {
        return true;
      }
      if (e && typeof e === 'object') {
        if (Api.err.isStandardErr(e, 'auth')) {
          return true; // API auth error response
        }
        if (e instanceof AjaxError && e.status === 401) {
          return true;
        }
      }
      return false;
    },
    isStandardErr: (e: any, internalType: string) => {
      if (e instanceof ApiErrorResponse && typeof e.res === 'object' && typeof e.res.error === 'object' && e.res.error.internal === 'auth') {
        return true;
      }
      if (Api.isStandardError(e) && e.internal === internalType) {
        return true;
      }
      if ((e as StandardErrorRes).error && typeof (e as StandardErrorRes).error === 'object' && (e as StandardErrorRes).error.internal === internalType) {
        return true;
      }
      return false;
    },
    isAuthPopupNeeded: (e: any) => {
      if (e instanceof AjaxError && e.status === 400 && typeof e.responseText === 'string') {
        try {
          const json = JSON.parse(e.responseText);
          if (json && (json as any).error === 'invalid_grant') {
            const jsonErrorDesc = (json as any).error_description;
            return jsonErrorDesc === 'Bad Request' || jsonErrorDesc === 'Token has been expired or revoked.';
          }
        } catch (e) {
          return false;
        }
      }
      return false;
    },
    isMailOrAcctDisabled: (e: any): boolean => {
      if (Api.err.isBadReq(e) && typeof e.responseText === 'string') {
        return e.responseText.indexOf('Mail service not enabled') !== -1 || e.responseText.indexOf('Account has been deleted') !== -1;
      }
      return false;
    },
    isInsufficientPermission: (e: any): e is AjaxError => e instanceof AjaxError && e.status === 403 && e.responseText.indexOf('insufficientPermissions') !== -1,
    isNotFound: (e: any): e is AjaxError => e instanceof AjaxError && e.status === 404,
    isBadReq: (e: any): e is AjaxError => e instanceof AjaxError && e.status === 400,
    isReqTooLarge: (e: any): e is AjaxError => e instanceof AjaxError && e.status === 413,
    isServerErr: (e: any): e is AjaxError => e instanceof AjaxError && e.status >= 500,
    isBlockedByProxy: (e: any): e is AjaxError => {
      if (!(e instanceof AjaxError)) {
        return false;
      }
      if (e.status === 200 || e.status === 403) {
        if (/(site|content|script|internet|web) (is|has been|was|access|filter) (restricted|blocked|disabled|denied|violat)/i.test(e.responseText)) {
          return true;
        }
        if (/access to the requested site|internet security by|blockedgateway/.test(e.responseText)) {
          return true;
        }
      }
      return false;
    },
    isSignificant: (e: any) => {
      return !Api.err.isNetErr(e) && !Api.err.isServerErr(e) && !Api.err.isNotFound(e) && !Api.err.isMailOrAcctDisabled(e) && !Api.err.isAuthErr(e)
        && !Api.err.isBlockedByProxy(e);
    },
    isInPrivateMode: (e: any) => {
      return e instanceof Error && e.message.startsWith('BrowserMsg() (no status text): -1 when GET-ing blob:moz-extension://');
    }
  };

  public static download = (url: string, progress?: ProgressCb): Promise<Buf> => new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('GET', url, true);
    request.responseType = 'arraybuffer';
    if (typeof progress === 'function') {
      request.onprogress = (evt) => progress(evt.lengthComputable ? Math.floor((evt.loaded / evt.total) * 100) : undefined, evt.loaded, evt.total);
    }
    request.onerror = progressEvent => {
      if (!progressEvent.target) {
        reject(new Error(`Api.download(${url}) failed with a null progressEvent.target`));
      } else {
        const { readyState, status, statusText } = progressEvent.target as XMLHttpRequest;
        reject(AjaxError.fromXhr({ readyState, status, statusText }, { url, method: 'GET' }, Catch.stackTrace()));
      }
    };
    request.onload = e => resolve(new Buf(request.response as ArrayBuffer));
    request.send();
  })

  public static ajax = async (req: JQueryAjaxSettings, stack: string): Promise<any | JQuery.jqXHR<any>> => {
    if (Env.isContentScript()) {
      // content script CORS not allowed anymore, have to drag it through background page
      // https://www.chromestatus.com/feature/5629709824032768
      return await BrowserMsg.send.bg.await.ajax({ req, stack });
    }
    try {
      return await new Promise((resolve, reject) => {
        $.ajax({ ...req, dataType: req.dataType === 'xhr' ? undefined : req.dataType }).then((data, s, xhr) => {
          if (req.dataType === 'xhr') {
            // @ts-ignore -> prevent the xhr object from getting further "resolved" and processed by jQuery, below
            xhr.then = xhr.promise = undefined;
            resolve(xhr);
          } else {
            resolve(data as any);
          }
        }).catch(reject);
      });
    } catch (e) {
      if (e instanceof Error) {
        throw e;
      }
      if (Api.isRawAjaxError(e)) {
        throw AjaxError.fromXhr(e, req, stack);
      }
      throw new Error(`Unknown Ajax error (${String(e)}) type when calling ${req.url}`);
    }
  }

  public static getAjaxProgressXhrFactory = (progressCbs?: ProgressCbs): (() => XMLHttpRequest) | undefined => {
    if (Env.isContentScript() || Env.isBackgroundPage() || !progressCbs || !Object.keys(progressCbs).length) {
      // xhr object would cause 'The object could not be cloned.' lastError during BrowserMsg passing
      // thus no progress callbacks in bg or content scripts
      // additionally no need to create this if there are no progressCbs defined
      return undefined;
    }
    return () => { // returning a factory
      let lastProgressPercent = -1;
      const progressPeportingXhr = new XMLHttpRequest();
      if (progressCbs && typeof progressCbs.upload === 'function') {
        progressPeportingXhr.upload.addEventListener('progress', (evt: ProgressEvent) => {
          const newProgressPercent = evt.lengthComputable ? Math.round((evt.loaded / evt.total) * 100) : undefined;
          if (newProgressPercent && newProgressPercent !== lastProgressPercent) {
            lastProgressPercent = newProgressPercent;
            progressCbs.upload!(newProgressPercent); // checked ===function above
          }
        }, false);
      }
      if (progressCbs && typeof progressCbs.download === 'function') {
        progressPeportingXhr.addEventListener('progress', (evt: ProgressEvent) => {
          // 100 because if the request takes less time than 1-2 seconds browsers trigger this function only once and when it's completed
          const newProgressPercent = evt.lengthComputable ? Math.floor((evt.loaded / evt.total) * 100) : 100;
          if (typeof newProgressPercent === 'undefined' || newProgressPercent !== lastProgressPercent) {
            if (newProgressPercent) {
              lastProgressPercent = newProgressPercent;
            }
            progressCbs.download!(newProgressPercent, evt.loaded, evt.total); // checked ===function above
          }
        });
      }
      return progressPeportingXhr;
    };
  }

  private static isRawAjaxError = (e: any): e is RawAjaxError => {
    return e && typeof e === 'object' && typeof (e as RawAjaxError).readyState === 'number';
  }

  private static isStandardError = (e: any): e is StandardError => {
    return e && typeof e === 'object' && (e as StandardError).hasOwnProperty('internal') && Boolean((e as StandardError).message);
  }

  protected static apiCall = async (
    url: string, path: string, fields?: Dict<any> | string, fmt?: ReqFmt, progress?: ProgressCbs, headers?: Dict<string>, resFmt: ResFmt = 'json', method: ReqMethod = 'POST'
  ) => {
    progress = progress || {} as ProgressCbs;
    let formattedData: FormData | string | undefined;
    let contentType: string | false;
    if (fmt === 'JSON' && fields) {
      formattedData = JSON.stringify(fields);
      contentType = 'application/json; charset=UTF-8';
    } else if (fmt === 'TEXT' && typeof fields === 'string') {
      formattedData = fields;
      contentType = false;
    } else if (fmt === 'FORM' && fields && typeof fields !== 'string') {
      formattedData = new FormData();
      for (const formFieldName of Object.keys(fields)) {
        const a: Att | string = fields[formFieldName]; // tslint:disable-line:no-unsafe-any
        if (a instanceof Att) {
          formattedData.append(formFieldName, new Blob([a.getData()], { type: a.type }), a.name); // xss-none
        } else {
          formattedData.append(formFieldName, a); // xss-none
        }
      }
      contentType = false;
    } else if (!fmt && !fields && method === 'GET') {
      formattedData = undefined;
      contentType = false;
    } else {
      throw new Error('unknown format:' + String(fmt));
    }
    const req: JQueryAjaxSettings = {
      xhr: Api.getAjaxProgressXhrFactory(progress),
      url: url + path,
      method,
      data: formattedData,
      dataType: resFmt,
      crossDomain: true,
      headers,
      processData: false,
      contentType,
      async: true,
      timeout: typeof progress!.upload === 'function' || typeof progress!.download === 'function' ? undefined : 20000, // substituted with {} above
    };
    const res = await Api.ajax(req, Catch.stackTrace());
    if (res && typeof res === 'object' && typeof (res as StandardErrorRes).error === 'object' && (res as StandardErrorRes).error.message) {
      throw new ApiErrorResponse(res as StandardErrorRes, req);
    }
    return res;
  }

}
