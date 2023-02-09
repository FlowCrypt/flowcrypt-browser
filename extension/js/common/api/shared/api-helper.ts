/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { BrowserMsg } from "../../browser/browser-msg.js";
import { Env } from "../..//browser/env.js";
import { secureRandomBytes } from "../../platform/util.js";
import { AjaxErr } from "./api-error.js";

type RawAjaxErr = {
  // getAllResponseHeaders?: () => any,
  // getResponseHeader?: (e: string) => any,
  readyState: number;
  responseText?: string;
  status?: number;
  statusText?: string;
};

export class ApiHelper {
  public static ajax = async (req: JQueryAjaxSettings, stack: string): Promise<unknown | JQuery.jqXHR<unknown>> => {
    if (Env
      .isContentScript()) {
      // content script CORS not allowed anymore, have to drag it through background page
      // https://www.chromestatus.com/feature/5629709824032768
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return await BrowserMsg.send.bg.await.ajax({ req, stack });
    }
    try {
      return await new Promise((resolve, reject) => {
        ApiHelper.throwIfApiPathTraversalAttempted(req.url || '');
        $.ajax({ ...req, dataType: req.dataType === 'xhr' ? undefined : req.dataType })
          .then((data, s, xhr) => {
            if (req.dataType === 'xhr') {
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore -> prevent the xhr object from getting further "resolved" and processed by jQuery, below
              xhr.then = xhr.promise = undefined;
              resolve(xhr);
            } else {
              resolve(data as unknown);
            }
          })
          .catch(reject);
      });
    } catch (e) {
      if (e instanceof Error) {
        throw e;
      }
      if (ApiHelper.isRawAjaxErr(e)) {
        throw AjaxErr.fromXhr(e, req, stack);
      }
      throw new Error(`Unknown Ajax error (${String(e)}) type when calling ${req.url}`);
    }
  };

  public static randomFortyHexChars = (): string => {
    const bytes = Array.from(secureRandomBytes(20));
    return bytes.map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
  };

  /**
   * Security check, in case attacker modifies parameters which are then used in an url
   * https://github.com/FlowCrypt/flowcrypt-browser/issues/2646
   */
  public static throwIfApiPathTraversalAttempted = (requestUrl: string) => {
    if (requestUrl.includes('../') || requestUrl.includes('/..')) {
      throw new Error(`API path traversal forbidden: ${requestUrl}`);
    }
  };

  private static isRawAjaxErr = (e: unknown): e is RawAjaxErr => {
    return !!e && typeof e === 'object' && typeof (e as RawAjaxErr).readyState === 'number';
  };

}