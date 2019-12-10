/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

// tslint:disable:no-direct-ajax

import { Dict } from '../core/common.js';
import { Env } from '../browser/env.js';
import { Att } from '../core/att.js';
import { Catch } from '../platform/catch.js';
import { Buf } from '../core/buf.js';
import { BrowserMsg } from '../browser/browser-msg.js';
import { Contact } from '../core/pgp.js';
import { secureRandomBytes } from '../platform/util.js';
import { StandardErrRes, ApiErrResponse } from './error/api-error-types.js';

export type ReqFmt = 'JSON' | 'FORM' | 'TEXT';
export type RecipientType = 'to' | 'cc' | 'bcc';
type ResFmt = 'json' | 'xhr';
export type ReqMethod = 'POST' | 'GET' | 'DELETE' | 'PUT';
export type ProviderContactsResults = { new: Contact[], all: Contact[] };
type RawAjaxErr = {
  // getAllResponseHeaders?: () => any,
  // getResponseHeader?: (e: string) => any,
  readyState: number,
  responseText?: string,
  status?: number,
  statusText?: string,
};

export type ChunkedCb = (r: ProviderContactsResults) => void;
export type ProgressCb = (percent?: number, loaded?: number, total?: number) => void;
export type ProgressCbs = { upload?: ProgressCb | null, download?: ProgressCb | null };

abstract class ApiCallErr extends Error {

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
    return `${req.method || 'GET'}-ing ${ApiCallErr.censoredUrl(req.url)} ${describeBody}: ${ApiCallErr.getPayloadStructure(req)}`;
  }

}

export class AjaxErr extends ApiCallErr {

  // todo - move these out of the class, they get weirdly serialized in err reports
  public STD_ERR_MSGS = { // tslint:disable-line:oneliner-object-literal
    GOOGLE_INVALID_TO_HEADER: 'Invalid to header',
    GOOGLE_RECIPIENT_ADDRESS_REQUIRED: 'Recipient address required',
  };

  public static fromXhr = (xhr: RawAjaxErr, req: JQueryAjaxSettings, stack: string) => {
    const responseText = xhr.responseText || '';
    const status = typeof xhr.status === 'number' ? xhr.status : -1;
    stack += `\n\nprovided ajax call stack:\n${stack}`;
    if (status === 400 || status === 403 || (status === 200 && responseText && responseText[0] !== '{')) {
      // RawAjaxErr with status 200 can happen when it fails to parse response - eg non-json result
      stack += `\n\nresponseText(0, 1000):\n${responseText.substr(0, 1000)}\n\npayload(0, 1000):\n${Catch.stringify(req.data).substr(0, 1000)}`;
    }
    const message = `${String(xhr.statusText || '(no status text)')}: ${String(xhr.status || -1)} when ${ApiCallErr.describeApiAction(req)}`;
    return new AjaxErr(message, stack, status, AjaxErr.censoredUrl(req.url), responseText, xhr.statusText || '(no status text)');
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

export class Api {
  public static download = (url: string, progress?: ProgressCb): Promise<Buf> => {
    return new Promise((resolve, reject) => {
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
          reject(AjaxErr.fromXhr({ readyState, status, statusText }, { url, method: 'GET' }, Catch.stackTrace()));
        }
      };
      request.onload = e => resolve(new Buf(request.response as ArrayBuffer));
      request.send();
    });
  }

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
      if (Api.isRawAjaxErr(e)) {
        throw AjaxErr.fromXhr(e, req, stack);
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

  private static isRawAjaxErr = (e: any): e is RawAjaxErr => {
    return e && typeof e === 'object' && typeof (e as RawAjaxErr).readyState === 'number';
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
    if (res && typeof res === 'object' && typeof (res as StandardErrRes).error === 'object' && (res as StandardErrRes).error.message) {
      throw new ApiErrResponse(res as StandardErrRes, req);
    }
    return res;
  }

  static randomFortyHexChars = (): string => { // 40-character hex
    const bytes = Array.from(secureRandomBytes(20));
    return bytes.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
  }

}
