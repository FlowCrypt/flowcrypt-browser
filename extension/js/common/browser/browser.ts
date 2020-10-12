/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

/// <reference path="../../../../node_modules/@types/chrome/index.d.ts" />

'use strict';

import { Api } from '../api/shared/api.js';
import { Att } from '../core/att.js';
import { Catch } from '../platform/catch.js';
import { Dict, Url, UrlParam } from '../core/common.js';
import { GlobalStore } from '../platform/store/global-store.js';
import { Xss } from '../platform/xss.js';

export class Browser {

  public static objUrlCreate = (content: Uint8Array | string) => {
    return window.URL.createObjectURL(new Blob([content], { type: 'application/octet-stream' }));
  }

  public static objUrlConsume = async (url: string) => {
    const buf = await Api.download(url);
    window.URL.revokeObjectURL(url);
    return buf;
  }

  public static saveToDownloads = (att: Att) => {
    const blob = new Blob([att.getData()], { type: att.type });
    if (window.navigator && window.navigator.msSaveOrOpenBlob) {
      window.navigator.msSaveBlob(blob, att.name);
    } else {
      const a = window.document.createElement('a');
      a.href = window.URL.createObjectURL(blob);
      a.download = Xss.escape(att.name);
      if (typeof a.click === 'function') { // tslint:disable-line:no-unbound-method - only testing if exists
        a.click();
      } else { // safari
        const ev = document.createEvent('MouseEvents');
        // @ts-ignore - safari only. expected 15 arguments, but works well with 4
        ev.initMouseEvent('click', true, true, window);
        a.dispatchEvent(ev);
      }
      if (Catch.browser().name === 'firefox') {
        try {
          a.remove();
        } catch (err) {
          if (!(err instanceof Error && err.message === 'Node was not found')) {
            throw err;
          }
        }
      }
      Catch.setHandledTimeout(() => window.URL.revokeObjectURL(a.href), 0);
    }
  }

  public static arrFromDomNodeList = (obj: NodeList | JQuery<HTMLElement>): Node[] => {
    // http://stackoverflow.com/questions/2735067/how-to-convert-a-dom-node-list-to-an-array-in-javascript
    const array = [];
    for (let i = obj.length >>> 0; i--;) { // iterate backwards ensuring that length is an UInt32
      array[i] = obj[i];
    }
    return array;
  }

  public static openSettingsPage = async (path: string = 'index.htm', acctEmail?: string, page: string = '', rawPageUrlParams?: Dict<UrlParam>, addNewAcct = false) => {
    const basePath = chrome.runtime.getURL(`chrome/settings/${path}`);
    const pageUrlParams = rawPageUrlParams ? JSON.stringify(rawPageUrlParams) : undefined;
    if (acctEmail || path === 'fatal.htm') {
      await Browser.openExtensionTab(Url.create(basePath, { acctEmail, page, pageUrlParams }));
    } else if (addNewAcct) {
      await Browser.openExtensionTab(Url.create(basePath, { addNewAcct }));
    } else {
      const acctEmails = await GlobalStore.acctEmailsGet();
      await Browser.openExtensionTab(Url.create(basePath, { acctEmail: acctEmails[0], page, pageUrlParams }));
    }
  }

  private static openExtensionTab = async (url: string) => {
    window.open(url, 'flowcrypt');
  }

}
