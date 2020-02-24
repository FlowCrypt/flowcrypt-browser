/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Api } from '../common/api/api.js';
import { BgUtils } from './bgutils.js';
import { Bm } from '../common/browser/browser-msg.js';
import { Gmail } from '../common/api/email-provider/gmail/gmail.js';
import { Url } from '../common/core/common.js';
import { GlobalStore } from '../common/platform/store/global-store.js';
import { ContactStore } from '../common/platform/store/contact-store.js';

export class BgHandlers {

  public static openSettingsPageHandler: Bm.AsyncResponselessHandler = async ({ page, path, pageUrlParams, addNewAcct, acctEmail }: Bm.Settings) => {
    await BgUtils.openSettingsPage(path, acctEmail, page, pageUrlParams, addNewAcct === true);
  }

  public static openInboxPageHandler: Bm.AsyncResponselessHandler = async (message: { acctEmail: string, threadId?: string, folder?: string }) => {
    await BgUtils.openExtensionTab(Url.create(chrome.runtime.getURL(`chrome/settings/inbox/inbox.htm`), message));
  }

  public static dbOperationHandler = async (db: IDBDatabase, request: Bm.Db): Promise<Bm.Res.Db> => {
    if (!db) {
      console.info(`db corrupted, skipping: ${request.f}`);
      return await new Promise(resolve => undefined); // never resolve, error was already shown
    }
    const dbFunc = (ContactStore as any)[request.f] as (db: IDBDatabase, ...args: any[]) => Promise<Bm.Res.Db>; // due to https://github.com/Microsoft/TypeScript/issues/6480
    if (request.f === 'obj') {
      return await dbFunc(request.args[0] as any); // db not needed, it goes through background because openpgp.js may not be available in the frame
    }
    return await dbFunc(db, ...request.args);
  }

  public static ajaxHandler = async (r: Bm.Ajax): Promise<Bm.Res.Ajax> => {
    return await Api.ajax(r.req, r.stack); // tslint:disable-line:no-direct-ajax
  }

  public static ajaxGmailAttGetChunkHandler = async (r: Bm.AjaxGmailAttGetChunk): Promise<Bm.Res.AjaxGmailAttGetChunk> => {
    return { chunk: await new Gmail(r.acctEmail).attGetChunk(r.msgId, r.attId) };
  }

  public static updateUninstallUrl: Bm.AsyncResponselessHandler = async () => {
    const acctEmails = await GlobalStore.acctEmailsGet();
    if (typeof chrome.runtime.setUninstallURL !== 'undefined') {
      const email = acctEmails?.length ? acctEmails[0] : undefined;
      chrome.runtime.setUninstallURL(`https://flowcrypt.com/leaving.htm#${JSON.stringify({ email, metrics: null })}`); // tslint:disable-line:no-null-keyword
    }
  }

  public static getActiveTabInfo: Bm.AsyncRespondingHandler = () => new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true, url: ["*://mail.google.com/*", "*://inbox.google.com/*"] }, (activeTabs) => {
      if (activeTabs.length) {
        if (activeTabs[0].id !== undefined) {
          type ScriptRes = { acctEmail: string | undefined, sameWorld: boolean | undefined }[];
          chrome.tabs.executeScript(activeTabs[0].id!, { code: 'var r = {acctEmail: window.account_email_global, sameWorld: window.same_world_global}; r' }, (result: ScriptRes) => {
            resolve({ provider: 'gmail', acctEmail: result[0].acctEmail, sameWorld: result[0].sameWorld === true });
          });
        } else {
          reject(new Error('tabs[0].id is undefined'));
        }
      } else {
        resolve({ provider: undefined, acctEmail: undefined, sameWorld: undefined });
      }
    });
  })

  public static respondWithSenderTabId = async (r: unknown, sender: Bm.Sender): Promise<Bm.Res._tab_> => {
    if (sender === 'background') {
      return { tabId: null };  // tslint:disable-line:no-null-keyword
    } else if (sender.tab) {
      return { tabId: `${sender.tab.id}:${sender.frameId}` };
    } else {
      // sender.tab: "This property will only be present when the connection was opened from a tab (including content scripts)"
      // https://developers.chrome.com/extensions/runtime#type-MessageSender
      // MDN says the same - thus this is most likely a background script, through browser message passing
      return { tabId: null }; // tslint:disable-line:no-null-keyword
    }
  }

}
