/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { BgUtils } from './bgutils.js';
import { Bm } from '../common/browser/browser-msg.js';
import { Gmail } from '../common/api/email-provider/gmail/gmail.js';
import { GlobalStore } from '../common/platform/store/global-store.js';
import { ContactStore } from '../common/platform/store/contact-store.js';
import { Api } from '../common/api/shared/api.js';
import { ExpirationCache } from '../common/core/expiration-cache.js';

export class BgHandlers {
  public static openSettingsPageHandler: Bm.AsyncResponselessHandler = async ({ page, path, pageUrlParams, addNewAcct, acctEmail }: Bm.Settings) => {
    await BgUtils.openSettingsPage(path, acctEmail, page, pageUrlParams, addNewAcct === true);
  };

  public static dbOperationHandler = async (db: IDBDatabase, request: Bm.Db): Promise<Bm.Res.Db> => {
    if (!db) {
      console.info(`db corrupted, skipping: ${request.f}`);
      return await new Promise(() => undefined); // never resolve, error was already shown
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbFunc = (ContactStore as any)[request.f] as (db: IDBDatabase, ...args: any[]) => Promise<Bm.Res.Db>; // due to https://github.com/Microsoft/TypeScript/issues/6480
    if (request.f === 'obj') {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any
      return await dbFunc(request.args[0] as any); // db not needed, it goes through background because openpgp.js may not be available in the frame
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return await dbFunc(db, ...request.args);
  };

  public static ajaxHandler = async (r: Bm.Ajax): Promise<Bm.Res.Ajax> => {
    return await Api.ajax(r.req, r.resFmt);
  };

  public static ajaxGmailAttachmentGetChunkHandler = async (r: Bm.AjaxGmailAttachmentGetChunk): Promise<Bm.Res.AjaxGmailAttachmentGetChunk> => {
    return { chunk: await new Gmail(r.acctEmail).attachmentGetChunk(r.msgId, r.attachmentId, r.treatAs) };
  };

  public static expirationCacheGetHandler = async <V>(r: Bm.ExpirationCacheGet): Promise<Bm.Res.ExpirationCacheGet<V>> => {
    const expirationCache = new ExpirationCache<V>(r.expirationTicks);
    return await expirationCache.get(r.key);
  };

  public static expirationCacheSetHandler = async <V>(r: Bm.ExpirationCacheSet<V>): Promise<Bm.Res.ExpirationCacheSet> => {
    const expirationCache = new ExpirationCache<V>(r.expirationTicks);
    await expirationCache.set(r.key, r.value, r.expiration);
  };

  public static expirationCacheDeleteExpiredHandler = async (r: Bm.ExpirationCacheDeleteExpired): Promise<Bm.Res.ExpirationCacheDeleteExpired> => {
    const expirationCache = new ExpirationCache(r.expirationTicks);
    await expirationCache.deleteExpired();
  };

  public static updateUninstallUrl: Bm.AsyncResponselessHandler = async () => {
    const acctEmails = await GlobalStore.acctEmailsGet();
    if (typeof chrome.runtime.setUninstallURL !== 'undefined') {
      const email = acctEmails?.length ? acctEmails[0] : undefined;
      chrome.runtime.setUninstallURL(`https://flowcrypt.com/leaving.htm#${JSON.stringify({ email, metrics: null })}`); // eslint-disable-line no-null/no-null
    }
  };

  public static getActiveTabInfo: Bm.AsyncRespondingHandler = () =>
    new Promise((resolve, reject) => {
      chrome.tabs.query({ active: true, currentWindow: true, url: ['*://mail.google.com/*', '*://inbox.google.com/*'] }, activeTabs => {
        if (activeTabs.length) {
          if (activeTabs[0].id !== undefined) {
            type ScriptRes = { acctEmail: string | undefined; sameWorld: boolean | undefined };
            chrome.scripting.executeScript(
              {
                target: { tabId: activeTabs[0].id },
                func: () => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  return { acctEmail: (window as any).account_email_global, sameWorld: (window as any).same_world_global };
                },
              },
              results => {
                const scriptResult = results[0].result as ScriptRes;
                if (scriptResult) {
                  resolve({
                    provider: 'gmail',
                    acctEmail: scriptResult.acctEmail,
                    sameWorld: scriptResult.sameWorld === true,
                  });
                } else {
                  reject(new Error('Script execution failed'));
                }
              }
            );
          } else {
            reject(new Error('tabs[0].id is undefined'));
          }
        } else {
          resolve({ provider: undefined, acctEmail: undefined, sameWorld: undefined });
        }
      });
    });
}
