/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Attachment } from '../../core/attachment.js';
import { Buf } from '../../core/buf.js';
import { CatchHelper } from '../../platform/catch-helper.js';
import { Dict, EmailParts, HTTP_STATUS_TEXTS, Url, UrlParams } from '../../core/common.js';
import { secureRandomBytes } from '../../platform/util.js';
import { ApiErr, AjaxErr } from './api-error.js';
import { Serializable } from '../../platform/store/abstract-store.js';
import { Env } from '../../browser/env.js';
import { BrowserMsg } from '../../browser/browser-msg.js';

export type ReqFmt = 'JSON' | 'FORM' | 'TEXT';
export type ProgressDestFrame = { operationId: string; expectedTransferSize: number; frameId: string };
export type ApiCallContext = ProgressDestFrame | undefined;

export type RecipientType = 'to' | 'cc' | 'bcc';
export type ResFmt = 'json' | 'text' | undefined;
export type ReqMethod = 'POST' | 'GET' | 'DELETE' | 'PUT';
export type EmailProviderContact = EmailParts;
type ProviderContactsResults = { new: EmailProviderContact[]; all: EmailProviderContact[] };
export type AjaxHeaders = {
  authorization?: string;
  ['api-version']?: string;
};
interface GetParams {
  method: 'GET' | 'DELETE';
  data?: UrlParams;
}
export interface JsonParams {
  method: 'POST' | 'PUT';
  data?: Dict<Serializable>;
  dataType?: 'JSON';
}

interface TextParams {
  method: 'POST' | 'PUT';
  data: string;
  contentType?: string;
  dataType: 'TEXT';
}
interface FormParams {
  method: 'POST' | 'PUT';
  data: FormData;
  dataType: 'FORM';
}

export type AjaxParams = GetParams | JsonParams | TextParams | FormParams;
export type Ajax = {
  url: string;
  headers?: AjaxHeaders;
  progress?: ProgressCbs;
  timeout?: number;
  stack: string;
} & AjaxParams;
type RawAjaxErr = {
  readyState: number;
  responseText?: string;
  status?: number;
  statusText?: string;
};

export type ChunkedCb = (r: ProviderContactsResults) => Promise<void>;
export type ProgressCb = (percent: number | undefined, loaded: number, total: number) => void;
export type ProgressCbs = { upload?: ProgressCb | null; download?: ProgressCb | null; operationId?: string; expectedTransferSize?: number; frameId?: string };

type FetchResult<T extends ResFmt, RT> = T extends undefined ? undefined : T extends 'text' ? string : RT;

export class Api {
  public static async download(url: string, progress?: ProgressCb, timeout?: number): Promise<Buf> {
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
      const errHandler = (progressEvent: ProgressEvent) => {
        if (!progressEvent.target) {
          reject(new Error(`Api.download(${url}) failed with a null progressEvent.target`));
        } else {
          const { readyState, status, statusText } = progressEvent.target as XMLHttpRequest;
          reject(AjaxErr.fromXhr({ readyState, status, statusText }, { url, method: 'GET', stack: CatchHelper.stackTrace() }));
        }
      };
      request.onerror = errHandler;
      request.ontimeout = errHandler;
      request.onload = e => (request.status <= 299 ? resolve(new Buf(request.response as ArrayBuffer)) : errHandler(e));
      request.send();
    });
  }

  public static async ajax<T extends ResFmt, RT = unknown>(req: Ajax, resFmt: T): Promise<FetchResult<T, RT>> {
    if (Env.isContentScript()) {
      // content script CORS not allowed anymore, have to drag it through background page
      // https://www.chromestatus.com/feature/5629709824032768
      if (req.progress) {
        req.progress = JSON.parse(JSON.stringify(req.progress)) as ProgressCbs;
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return await BrowserMsg.send.bg.await.ajax({ req, resFmt });
    }
    Api.throwIfApiPathTraversalAttempted(req.url);
    const headersInit: [string, string][] = req.headers ? Object.entries(req.headers) : [];
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
            body = req.data as FormData; // todo: form data content-type?
          }
        }
      }
    }
    const requestInit: RequestInit = {
      method: req.method,
      headers: headersInit,
      body,
      mode: 'cors',
      signal: AbortSignal.timeout(req.timeout ?? 20000),
    };
    let readyState = 1; // OPENED
    const reqContext = { url: req.url, method: req.method, data: body, stack: req.stack };
    const isTimeoutError = (e: unknown): boolean => e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError');
    try {
      const response = await fetch(url, requestInit);
      if (!response.ok) {
        let responseText: string | undefined;
        readyState = 2; // HEADERS_RECEIVED
        try {
          readyState = 3; // LOADING
          responseText = await response.text();
          readyState = 4; // DONE
        } catch (e) {
          if (isTimeoutError(e)) {
            throw e;
          }
          // continue processing without reponseText
        }
        throw AjaxErr.fromXhr(
          {
            readyState,
            responseText,
            status: response.status,
            statusText: response.statusText || HTTP_STATUS_TEXTS[response.status],
          },
          reqContext
        );
      }
      const transformResponseWithProgress = () => {
        if (req.progress && response.body) {
          const contentLength = response.headers.get('content-length');
          // real content length is approximately 140% of content-length header value
          const total = contentLength ? parseInt(contentLength) * 1.4 : 0;
          const downloadProgress = req.progress.download;
          const expectedTransferSize = req.progress.expectedTransferSize;
          const operationId = req.progress.operationId;
          let downloadedBytes = 0;
          const bodyWithProgress = response.body.pipeThrough(
            new TransformStream<Uint8Array, Uint8Array>({
              transform: (chunk, controller) => {
                downloadedBytes += chunk.length;
                if (downloadProgress) {
                  downloadProgress(undefined, downloadedBytes, total);
                } else if (expectedTransferSize && operationId) {
                  BrowserMsg.send.ajaxProgress('broadcast', {
                    percent: undefined,
                    loaded: downloadedBytes,
                    total,
                    expectedTransferSize,
                    operationId,
                  });
                }
                controller.enqueue(chunk);
              },
            })
          );
          return new Response(bodyWithProgress, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
          });
        } else {
          return response;
        }
      };

      if (resFmt === 'text') {
        return (await transformResponseWithProgress().text()) as FetchResult<T, RT>;
      } else if (resFmt === 'json') {
        try {
          const text = await transformResponseWithProgress().text();
          return (text ? JSON.parse(text) : {}) as FetchResult<T, RT>; // Handle empty response body
        } catch (e) {
          // handle empty response https://github.com/FlowCrypt/flowcrypt-browser/issues/5601
          if (e instanceof SyntaxError && (e.message === 'Unexpected end of JSON input' || e.message.startsWith('JSON.parse: unexpected end of data'))) {
            return undefined as FetchResult<T, RT>;
          }
          throw e;
        }
      } else {
        return undefined as FetchResult<T, RT>;
      }
    } catch (e) {
      if (e instanceof Error) {
        if (isTimeoutError(e)) {
          // The request's only abort signal is its timeout signal.
          throw AjaxErr.fromXhr({ readyState, status: -1, statusText: 'timeout' }, reqContext);
        }
        if (e.name === 'TypeError' && ApiErr.isNetErr(e)) {
          // generic failed to fetch
          throw AjaxErr.fromXhr({ readyState, status: 0, statusText: 'error' }, reqContext);
        }
        throw e;
      }
      throw new Error(`Unknown fetch error (${String(e)}) type when calling ${req.url}`);
    }
  }

  /** @deprecated should use ajax() */
  public static async ajaxWithJquery<T extends ResFmt, RT = unknown>(req: Ajax, resFmt: T, formattedData?: FormData | string): Promise<FetchResult<T, RT>> {
    let data: BodyInit | undefined = formattedData;
    const headersInit: Dict<string> = req.headers ?? {};

    if ((req.method === 'PUT' || req.method === 'POST') && 'data' in req) {
      switch (req.dataType) {
        case 'JSON':
          // req.data is Dict<Serializable>
          data = JSON.stringify(req.data);
          headersInit['Content-Type'] = 'application/json';
          break;
        case 'TEXT':
          // req.data is string
          data = req.data;
          if (req.contentType) {
            headersInit['Content-Type'] = req.contentType;
          }
          break;
        case 'FORM':
          // req.data is FormData
          data = req.data;
          break;
        default:
          break;
      }
    }
    const apiReq: JQuery.AjaxSettings<ApiCallContext> = {
      xhr: Api.getAjaxProgressXhrFactory(req.progress),
      url: req.url,
      method: req.method,
      data,
      dataType: resFmt,
      crossDomain: true,
      headers: headersInit,
      processData: false,
      contentType: false,
      async: true,
      timeout: typeof req.progress?.upload === 'function' || typeof req.progress?.download === 'function' ? undefined : 20000, // substituted with {} above
    };

    try {
      return await new Promise((resolve, reject) => {
        Api.throwIfApiPathTraversalAttempted(req.url || '');
        $.ajax({ ...apiReq, dataType: apiReq.dataType === 'xhr' ? undefined : apiReq.dataType })
          .then(data => {
            resolve(data as FetchResult<T, RT>);
          })

          .catch(reject);
      });
    } catch (e) {
      if (e instanceof Error) {
        throw e;
      }
      if (Api.isRawAjaxErr(e)) {
        throw AjaxErr.fromXhr(e, { ...req, stack: CatchHelper.stackTrace() });
      }
      throw new Error(`Unknown Ajax error (${String(e)}) type when calling ${req.url}`);
    }
  }

  public static async isInternetAccessible() {
    try {
      await fetch('https://google.com', {
        method: 'GET',
        mode: 'no-cors',
      });
      return true;
    } catch (e) {
      if (ApiErr.isNetErr(e)) {
        return false;
      }
      throw e;
    }
  }

  public static randomFortyHexChars(): string {
    const bytes = Array.from(secureRandomBytes(20));
    return bytes.map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
  }

  public static isRecipientHeaderNameType(value: string): value is 'to' | 'cc' | 'bcc' {
    return ['to', 'cc', 'bcc'].includes(value);
  }

  protected static async apiCall<T extends ResFmt, RT>(
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
  ): Promise<FetchResult<T, RT>> {
    progress = progress || {};
    let formattedData: FormData | string | undefined;
    let dataPart: AjaxParams = { method: 'GET' };
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
    const req: Ajax = { url: url + path, stack: CatchHelper.stackTrace(), ...dataPart, headers, progress };
    if (typeof resFmt === 'undefined') {
      const undefinedRes: undefined = await Api.ajax(req, undefined); // we should get an undefined
      return undefinedRes as FetchResult<T, RT>;
    }
    if (progress.upload) {
      // as of October 2023 fetch upload progress (through ReadableStream)
      // is supported only by Chrome and requires HTTP/2 on backend
      // as temporary solution we use XMLHTTPRequest for such requests
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const result = await Api.ajaxWithJquery(req, resFmt, formattedData);
      return result as FetchResult<T, RT>;
    } else {
      try {
        return await Api.ajax(req, resFmt);
      } catch (firstAttemptErr) {
        const idToken = headers?.authorization?.split('Bearer ')?.[1];
        if (ApiErr.isAuthErr(firstAttemptErr) && idToken) {
          // Needed authorization from the service worker side to avoid circular dependency injection errors
          // that occur when importing GoogleAuth directly.
          const authorizationHeader = await BrowserMsg.send.bg.await.getApiAuthorization({ idToken });
          if (authorizationHeader) {
            const updatedReq = {
              ...req,
              headers: authorizationHeader,
            };
            return await Api.ajax(updatedReq, resFmt);
          }
        }
        throw firstAttemptErr;
      }
    }
  }

  private static getAjaxProgressXhrFactory(progressCbs: ProgressCbs | undefined): (() => XMLHttpRequest) | undefined {
    if (Env.isContentScript() || !progressCbs || !(progressCbs.upload || progressCbs.download)) {
      // xhr object would cause 'The object could not be cloned.' lastError during BrowserMsg passing
      // thus no progress callbacks in bg or content scripts
      // additionally no need to create this if there are no progressCbs defined
      return undefined;
    }
    return () => {
      // returning a factory
      let lastProgressPercent = -1;
      const progressPeportingXhr = new XMLHttpRequest();
      if (progressCbs && typeof progressCbs.upload === 'function') {
        progressPeportingXhr.upload.addEventListener(
          'progress',
          (evt: ProgressEvent) => {
            const newProgressPercent = evt.lengthComputable ? Math.round((evt.loaded / evt.total) * 100) : undefined;
            if (newProgressPercent && newProgressPercent !== lastProgressPercent) {
              lastProgressPercent = newProgressPercent;
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              progressCbs.upload!(newProgressPercent, evt.loaded, evt.total); // checked ===function above
            }
          },
          false
        );
      }
      if (progressCbs && typeof progressCbs.download === 'function') {
        progressPeportingXhr.addEventListener('progress', (evt: ProgressEvent) => {
          // 100 because if the request takes less time than 1-2 seconds browsers trigger this function only once and when it's completed
          const newProgressPercent = evt.lengthComputable ? Math.floor((evt.loaded / evt.total) * 100) : undefined;
          if (typeof newProgressPercent === 'undefined' || newProgressPercent !== lastProgressPercent) {
            if (newProgressPercent) {
              lastProgressPercent = newProgressPercent;
            }
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            progressCbs.download!(newProgressPercent, evt.loaded, evt.total); // checked ===function above
          }
        });
      }
      return progressPeportingXhr;
    };
  }

  private static isRawAjaxErr(e: unknown): e is RawAjaxErr {
    return !!e && typeof e === 'object' && typeof (e as RawAjaxErr).readyState === 'number';
  }

  /**
   * Security check, in case attacker modifies parameters which are then used in an url
   * https://github.com/FlowCrypt/flowcrypt-browser/issues/2646
   */
  private static throwIfApiPathTraversalAttempted(requestUrl: string) {
    if (requestUrl.includes('../') || requestUrl.includes('/..')) {
      throw new Error(`API path traversal forbidden: ${requestUrl}`);
    }
  }
}
