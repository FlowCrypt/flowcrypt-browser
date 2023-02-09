/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Env } from '../../browser/env.js';
import { Attachment } from '../../core/attachment.js';
import { Buf } from '../../core/buf.js';
import { Dict, EmailParts } from '../../core/common.js';
import { Catch } from '../../platform/catch.js';
import { GoogleAuth } from '../email-provider/gmail/google-auth.js';
import { AjaxErr, ApiErr } from './api-error.js';
import { ApiHelper } from './api-helper.js';

export type ReqFmt = 'JSON' | 'FORM' | 'TEXT';
export type RecipientType = 'to' | 'cc' | 'bcc';
type ResFmt = 'json' | 'xhr';
export type ReqMethod = 'POST' | 'GET' | 'DELETE' | 'PUT';
export type EmailProviderContact = EmailParts;
type ProviderContactsResults = { new: EmailProviderContact[]; all: EmailProviderContact[] };

export type ChunkedCb = (r: ProviderContactsResults) => Promise<void>;
export type ProgressCb = (percent: number | undefined, loaded: number, total: number) => void;
export type ProgressCbs = { upload?: ProgressCb | null; download?: ProgressCb | null };

export class Api {
  public static download = async (url: string, progress?: ProgressCb, timeout?: number): Promise<Buf> => {
    return await new Promise((resolve, reject) => {
      ApiHelper.throwIfApiPathTraversalAttempted(url);
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
          reject(AjaxErr.fromXhr({ readyState, status, statusText }, { url, method: 'GET' }, Catch.stackTrace()));
        }
      };
      request.onerror = errHandler;
      request.ontimeout = errHandler;
      request.onload = e => (request.status <= 299 ? resolve(new Buf(request.response as ArrayBuffer)) : errHandler(e));
      request.send();
    });
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

  public static getAjaxProgressXhrFactory = (progressCbs?: ProgressCbs): (() => XMLHttpRequest) | undefined => {
    if (Env.isContentScript() || Env.isBackgroundPage() || !progressCbs || !Object.keys(progressCbs).length) {
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
  };

  public static isRecipientHeaderNameType = (value: string): value is 'to' | 'cc' | 'bcc' => {
    return ['to', 'cc', 'bcc'].includes(value);
  };

  protected static apiCall = async <RT>(
    url: string,
    path: string,
    fields?: Dict<unknown> | string,
    fmt?: ReqFmt,
    progress?: ProgressCbs,
    headers?: Dict<string>,
    resFmt: ResFmt = 'json',
    method: ReqMethod = 'POST'
  ): Promise<RT> => {
    progress = progress || ({} as ProgressCbs);
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
        const a: Attachment | string = fields[formFieldName] as Attachment | string;
        if (a instanceof Attachment) {
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
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      timeout: typeof progress!.upload === 'function' || typeof progress!.download === 'function' ? undefined : 20000, // substituted with {} above
    };
    try {
      const res = await ApiHelper.ajax(req, Catch.stackTrace());
      return res as RT;
    } catch (firstAttemptErr) {
      const idToken = req.headers?.Authorization?.split(' ')[1];
      if (ApiErr.isAuthErr(firstAttemptErr) && idToken) {
        // force refresh token
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const { email } = GoogleAuth.parseIdToken(idToken);
        if (email) {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          req.headers!.Authorization = await GoogleAuth.googleApiAuthHeader(email, true);
          return await ApiHelper.ajax(req, Catch.stackTrace()) as RT;
        }
      }
      throw firstAttemptErr;
    }
  };
}
