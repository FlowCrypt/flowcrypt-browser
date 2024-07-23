/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Attachment } from '../core/attachment.js';
import { Catch } from '../platform/catch.js';
import { Dict, Url, UrlParam } from '../core/common.js';
import { GlobalStore } from '../platform/store/global-store.js';
import { BgUtils } from '../../service_worker/bgutils.js';

export class Browser {
  public static objUrlCreate = (content: Uint8Array | string) => {
    return URL.createObjectURL(new Blob([content], { type: 'application/octet-stream' }));
  };

  public static saveToDownloads = (attachment: Attachment) => {
    const blob = new Blob([attachment.getData()], { type: attachment.type });
    const a = window.document.createElement('a');
    a.href = window.URL.createObjectURL(blob);
    a.download = attachment.name;
    if (typeof a.click === 'function') {
      a.click();
    } else {
      // safari
      const ev = document.createEvent('MouseEvents');

      // @ts-expect-error - safari only. expected 15 arguments, but works well with 4
      ev.initMouseEvent('click', true, true, window);
      a.dispatchEvent(ev);
    }
    if (Catch.isFirefox()) {
      try {
        a.remove();
      } catch (err) {
        if (!(err instanceof Error && err.message === 'Node was not found')) {
          throw err;
        }
      }
    }
    Catch.setHandledTimeout(() => window.URL.revokeObjectURL(a.href), 0);
  };

  public static arrFromDomNodeList = (obj: NodeList | JQuery): Node[] => {
    // http://stackoverflow.com/questions/2735067/how-to-convert-a-dom-node-list-to-an-array-in-javascript
    const array = [];
    for (let i = obj.length >>> 0; i--; ) {
      // iterate backwards ensuring that length is an UInt32
      array[i] = obj[i];
    }
    return array;
  };

  public static openSettingsPage = async (path = 'index.htm', acctEmail?: string, page = '', rawPageUrlParams?: Dict<UrlParam>, addNewAcct = false) => {
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
  };

  public static openExtensionTab = async (url: string) => {
    if (Catch.isThunderbirdMail()) {
      await BgUtils.openExtensionTab(url);
    } else {
      const tab = window.open(url, 'flowcrypt');
      if (tab) {
        tab.focus();
      }
    }
  };
}
