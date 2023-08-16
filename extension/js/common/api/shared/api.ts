/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Attachment } from '../../core/attachment.js';
import { Buf } from '../../core/buf.js';
import { Catch } from '../../platform/catch.js';
import { Dict, EmailParts, Url, UrlParams } from '../../core/common.js';
import { secureRandomBytes } from '../../platform/util.js';
import { ApiErr, AjaxErr } from './api-error.js';
import { Serializable } from '../../platform/store/abstract-store.js';

export type RecipientType = 'to' | 'cc' | 'bcc';
export type ResFmt = 'json' | 'text' | undefined;
export type ReqMethod = 'POST' | 'GET' | 'DELETE' | 'PUT';
export type EmailProviderContact = EmailParts;
type ProviderContactsResults = { new: EmailProviderContact[]; all: EmailProviderContact[] };
export type AjaxHeaders = {
  authorization?: string;
  ['api-version']?: string;
};
export type Ajax = {
  url: string;
  headers?: AjaxHeaders;
  progress?: ProgressCbs;
  timeout?: number; // todo: implement
  stack: string;
} & (
  | { method: 'GET' | 'DELETE'; data?: UrlParams }
  | { method: 'POST' }
  | { method: 'POST' | 'PUT'; data: Dict<Serializable>; dataType: 'JSON' }
  | { method: 'POST' | 'PUT'; contentType?: string; data: string; dataType: 'TEXT' }
  | { method: 'POST' | 'PUT'; data: FormData; dataType: 'FORM' } // todo: default application/x-www-form-urlencoded; charset=UTF-8 ?
  | { method: never; data: never; contentType: never }
);

export type ChunkedCb = (r: ProviderContactsResults) => Promise<void>;
export type ProgressCb = (percent: number | undefined, loaded: number, total: number) => void;
export type ProgressCbs = { upload?: ProgressCb | null; download?: ProgressCb | null };

type FetchResult<T extends ResFmt, RT> = T extends undefined ? undefined : T extends 'text' ? string : RT;

export class Api {
  public static download = async (url: string, progress?: ProgressCb, timeout?: number): Promise<Buf> => {
    return await new Promise((resolve, reject) => {
      Api.throwIfApiPathTraversalAttempted(url);
      const request = new XMLHttpRequest();
      if (timeout) {
        request.timeout = timeout * 1000;
      }
      request.open('GET', url, true);
      request.responseType = 'arraybuffer';
      if (typeof progress === 'function') {
        request.onprogress = evt => progress(evt.lengthComputable ? Math.floor((evt.loaded / evt.total) * 100) : undefined, evt.loaded, evt.total);
      }
      const errHandler = (progressEvent: ProgressEvent<EventTarget>) => {
        if (!progressEvent.target) {
          reject(new Error(`Api.download(${url}) failed with a null progressEvent.target`));
        } else {
          const { readyState, status, statusText } = progressEvent.target as XMLHttpRequest;
          reject(AjaxErr.fromXhr({ readyState, status, statusText }, { url, method: 'GET', stack: Catch.stackTrace() }));
        }
      };
      request.onerror = errHandler;
      request.ontimeout = errHandler;
      request.onload = e => (request.status <= 299 ? resolve(new Buf(request.response as ArrayBuffer)) : errHandler(e));
      request.send();
    });
  };

  public static ajax = async <T extends ResFmt, RT = unknown>(req: Ajax, resFmt: T): Promise<FetchResult<T, RT>> => {
    Api.throwIfApiPathTraversalAttempted(req.url);
    const headersInit: [string, string][] = req.headers ? Object.entries(req.headers) : [];
    // capitalize? .map(([key, value]) => { return [Str.capitalize(key), value]; })
    let body: BodyInit | undefined;
    let url: string;
    if (req.method === 'GET' || req.method === 'DELETE') {
      if (typeof req.data === 'undefined') {
        url = req.url;
      } else {
        url = Url.create(req.url, req.data, false);
      }
    } else {
      url = req.url;
      if (req.method === 'PUT' || req.method === 'POST') {
        if ('data' in req && typeof req.data !== 'undefined') {
          if (req.dataType === 'JSON') {
            body = JSON.stringify(req.data);
            headersInit.push(['Content-Type', 'application/json; charset=UTF-8']);
          } else if (req.dataType === 'TEXT') {
            body = req.data;
            if (typeof req.contentType === 'string') {
              headersInit.push(['Content-Type', req.contentType]);
            }
          } else {
            body = req.data; // todo: form data content-type?
          }
        }
      }
    }
    const abortController = new AbortController();
    const requestInit: RequestInit = {
      method: req.method,
      headers: headersInit,
      body,
      mode: 'cors',
      signal: abortController.signal,
    };
    let readyState = 1; // OPENED
    const reqContext = { url: req.url, method: req.method, data: body, stack: req.stack };
    try {
      const responsePromises = [fetch(url, requestInit)];
      if (req.timeout || typeof req.progress?.download === 'undefined') {
        // todo: disable timeout on upload
        responsePromises.push(
          new Promise((_resolve, reject) => {
            /* error-handled */ setTimeout(() => {
              abortController.abort(); // Abort the fetch request
              reject(AjaxErr.fromXhr({ readyState, status: -1, statusText: 'timeout' }, reqContext)); // Reject the promise with a timeout error
            }, req.timeout ?? 20000);
          })
        );
      }
      const response = await Promise.race(responsePromises);
      if (!response.ok) {
        let responseText: string | undefined;
        readyState = 2; // HEADERS_RECEIVED
        try {
          readyState = 3; // LOADING
          responseText = await response.text();
          readyState = 4; // DONE
        } catch {
          // continue processing without reponseText
        }
        throw AjaxErr.fromXhr(
          {
            readyState,
            responseText,
            status: response.status,
            statusText: response.statusText,
          },
          reqContext
        );
      }
      if (resFmt === 'text') {
        return (await response.text()) as FetchResult<T, RT>; // todo: progress
      } else if (resFmt === 'json') {
        return (await response.json()) as FetchResult<T, RT>; // todo: progress?
      } else {
        return undefined as FetchResult<T, RT>;
      }
    } catch (e) {
      if (e instanceof Error) {
        if (e.name === 'AbortError') {
          // we assume there was a timeout
          throw AjaxErr.fromXhr({ readyState, status: -1, statusText: 'timeout' }, reqContext);
        }
        throw e;
      }
      throw new Error(`Unknown fetch error (${String(e)}) type when calling ${req.url}`);
    }
  };

  public static isInternetAccessible = async () => {
    try {
      await Api.download('https://google.com');
      return true;
    } catch (e) {
      if (ApiErr.isNetErr(e)) {
        return false;
      }
      throw e;
    }
  };

  public static randomFortyHexChars = (): string => {
    const bytes = Array.from(secureRandomBytes(20));
    return bytes.map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
  };

  public static isRecipientHeaderNameType = (value: string): value is 'to' | 'cc' | 'bcc' => {
    return ['to', 'cc', 'bcc'].includes(value);
  };

  protected static apiCall = async <T extends ResFmt, RT>(
    url: string,
    path: string,
    values:
      | {
          data: Dict<Serializable>;
          fmt: 'JSON';
          method?: 'POST' | 'PUT';
        }
      | {
          data: string;
          fmt: 'TEXT';
          method?: 'POST' | 'PUT';
        }
      | {
          data: Dict<string | Attachment>;
          fmt: 'FORM';
          method?: 'POST' | 'PUT';
        }
      | undefined,
    progress?: ProgressCbs,
    headers?: AjaxHeaders,
    resFmt?: T
  ): Promise<FetchResult<T, RT>> => {
    progress = progress || ({} as ProgressCbs);
    let formattedData: FormData | string | undefined;
    let dataPart:
      | { method: 'GET' }
      | { method: 'POST' | 'PUT'; data: Dict<Serializable>; dataType: 'JSON' }
      | { method: 'POST' | 'PUT'; data: string; dataType: 'TEXT' }
      | { method: 'POST' | 'PUT'; data: FormData; dataType: 'FORM' };
    dataPart = { method: 'GET' };
    if (values) {
      if (values.fmt === 'JSON') {
        dataPart = { method: values.method ?? 'POST', data: values.data, dataType: 'JSON' };
      } else if (values.fmt === 'TEXT') {
        dataPart = { method: values.method ?? 'POST', data: values.data, dataType: 'TEXT' };
      } else if (values.fmt === 'FORM') {
        formattedData = new FormData();
        for (const [formFieldName, a] of Object.entries(values.data)) {
          if (a instanceof Attachment) {
            formattedData.append(formFieldName, new Blob([a.getData()], { type: a.type }), a.name); // xss-none
          } else {
            formattedData.append(formFieldName, a); // xss-none
          }
        }
        dataPart = { method: values.method ?? 'POST', data: formattedData, dataType: 'FORM' };
      }
    }
    const req: Ajax = { url: url + path, stack: Catch.stackTrace(), ...dataPart, headers };
    if (typeof resFmt === 'undefined') {
      const undefinedRes: undefined = await Api.ajax(req, undefined); // we should get an undefined
      return undefinedRes as FetchResult<T, RT>;
    }
    return await Api.ajax(req, resFmt);
  };

  /**
   * Security check, in case attacker modifies parameters which are then used in an url
   * https://github.com/FlowCrypt/flowcrypt-browser/issues/2646
   */
  private static throwIfApiPathTraversalAttempted = (requestUrl: string) => {
    if (requestUrl.includes('../') || requestUrl.includes('/..')) {
      throw new Error(`API path traversal forbidden: ${requestUrl}`);
    }
  };
}
