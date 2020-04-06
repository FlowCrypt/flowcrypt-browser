/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

/// <reference path="../../../../node_modules/@types/chrome/index.d.ts" />

'use strict';

import { Api } from '../api/api.js';
import { Att } from '../core/att.js';
import { BrowserMsg } from './browser-msg.js';
import { Catch } from '../platform/catch.js';
import { Dict, Url, UrlParam } from '../core/common.js';
import { GlobalStore } from '../platform/store/global-store.js';
import { Ui } from './ui.js';
import { Xss } from '../platform/xss.js';

declare type SettingsPage = 'index.htm' | 'initial.htm' | 'fatal.htm';

export class Browser {

  public static objUrlCreate = (content: Uint8Array | string) => {
    return window.URL.createObjectURL(new Blob([content], { type: 'application/octet-stream' }));
  }

  public static objUrlConsume = async (url: string) => {
    const buf = await Api.download(url);
    window.URL.revokeObjectURL(url);
    return buf;
  }

  public static saveToDownloads = (att: Att, renderIn?: JQuery<HTMLElement>) => {
    const blob = new Blob([att.getData()], { type: att.type });
    if (window.navigator && window.navigator.msSaveOrOpenBlob) {
      window.navigator.msSaveBlob(blob, att.name);
    } else {
      const a = window.document.createElement('a');
      a.href = window.URL.createObjectURL(blob);
      a.download = Xss.escape(att.name);
      if (renderIn) {
        const div = document.createElement('div');
        div.innerText = `Right-click here and choose 'Save Link As' to save encrypted file`;
        a.innerText = '';
        a.appendChild(div);
        a.className = 'file-download-right-click-link';
        renderIn.html(a.outerHTML); // xss-escaped attachment name above
        renderIn.css('height', 'auto');
        renderIn.find('a').click(e => {
          Ui.modal.warning('Please use right-click and select Save Link As').catch(Catch.reportErr);
          e.preventDefault();
          e.stopPropagation();
          return false;
        });
      } else {
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
            document.body.removeChild(a);
          } catch (err) {
            if (!(err instanceof Error && err.message === 'Node was not found')) {
              throw err;
            }
          }
        }
        Catch.setHandledTimeout(() => window.URL.revokeObjectURL(a.href), 0);
      }
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

  public static openSettingsPage = async (path: SettingsPage = 'index.htm', acctEmail?: string, page: string = '', rawPageUrlParams?: Dict<UrlParam>, addNewAcct = false) => {
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

  public static openExtensionTab = async (url: string) => {
    // TODO(@limonte): revisit, Firefox 74 doesn't work properly with window.open()
    // - the 2nd parameter `target` will be ignored by it and each window.open() will open a new tab
    // - the returning value of window.open() will be null, not Window, therefore it's impossible
    //   to manage the previously opened tabs
    if (Catch.browser().name === 'firefox') {
      console.log('@', url);
      await BrowserMsg.send.bg.extensionTab({ url });
    } else {
      window.open(url, 'flowcrypt');
    }
  }

}
