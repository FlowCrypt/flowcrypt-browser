/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { Env } from '../../browser/env.js';
import { BrowserMsg } from '../../browser/browser-msg.js';
import { AbstractStore } from './abstract-store.js';

/**
 * Local session store of information to store temporarily, such as pass phrases
 */
export class SessionStore extends AbstractStore {

  public static get = async (acctEmail: string, key: string): Promise<string | null> => {
    if (!Env.isBackgroundPage()) {
      // session in background page is separated from content script frames
      // must always go through background page to be consistent
      return await BrowserMsg.send.bg.await.storeSessionGet({ acctEmail, key });
    }
    return window.sessionStorage.getItem(SessionStore.singleScopeRawIndex(acctEmail, key));
  }

  public static set = async (acctEmail: string, key: string, value: string | undefined): Promise<void> => {
    if (!Env.isBackgroundPage()) {
      // session in background page is separated from content script frames
      // must always go through background page to be consistent
      return await BrowserMsg.send.bg.await.storeSessionSet({ acctEmail, key, value });
    }
    if (typeof value !== 'undefined') { // pass phrases may be stored in session for reuse
      sessionStorage.setItem(SessionStore.singleScopeRawIndex(acctEmail, key), String(value)); // lgtm [js/clear-text-storage-of-sensitive-data]
    } else {
      sessionStorage.removeItem(SessionStore.singleScopeRawIndex(acctEmail, key));
    }
  }

}
