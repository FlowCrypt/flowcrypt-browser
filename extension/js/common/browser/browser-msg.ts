/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { AccountIndex, AccountStore, GlobalIndex, GlobalStore } from '../platform/store.js';
import { DecryptResult, DiagnoseMsgPubkeysResult, PgpMsgMethod, VerifyRes } from '../core/pgp-msg.js';
import { Dict, Str, UrlParams } from '../core/common.js';

import { AjaxErr } from '../api/error/api-error-types.js';
import { AuthRes } from '../api/google-auth.js';
import { Browser } from './browser.js';
import { BrowserMsgCommonHandlers } from './browser-msg-common-handlers.js';
import { Buf } from '../core/buf.js';
import { Catch } from '../platform/catch.js';
import { Env } from './env.js';
import { KeyDetails } from '../core/pgp-key.js';
import { PassphraseDialogType } from '../xss-safe-factory.js';
import { Ui } from './ui.js';

export type GoogleAuthWindowResult$result = 'Success' | 'Denied' | 'Error' | 'Closed';

export namespace Bm {
  export type Dest = string;
  export type Sender = chrome.runtime.MessageSender | 'background';
  export type Response = any;
  export type RawResponse = { result: any, objUrls: { [name: string]: string }, exception?: Bm.ErrAsJson };
  export type Raw = { name: string; data: { bm: AnyRequest | {}, objUrls: Dict<string> }; to: Dest | null; uid: string; stack: string; sender?: Sender; };

  export type SetCss = { css: Dict<string>, traverseUp?: number, selector: string; };
  export type AddOrRemoveClass = { class: string, selector: string; };
  export type Settings = { path?: string, page?: string, acctEmail?: string, pageUrlParams?: UrlParams, addNewAcct?: boolean };
  export type PassphraseDialog = { type: PassphraseDialogType, longids: string[] };
  export type ScrollToElement = { selector: string };
  export type NotificationShow = { notification: string, callbacks?: Dict<() => void> };
  export type NotificationShowAuthPopupNeeded = { acctEmail: string };
  export type RenderPublicKeys = { afterFrameId: string, publicKeys: string[], traverseUp?: number };
  export type SubscribeDialog = { isAuthErr?: boolean };
  export type FocusFrame = { frameId: string };
  export type CloseReplyMessage = { frameId: string };
  export type ReinsertReplyBox = { replyMsgId: string };
  export type AddPubkeyDialog = { emails: string[] };
  export type Reload = { advanced?: boolean };
  export type Redirect = { location: string };
  export type OpenGoogleAuthDialog = { acctEmail?: string, scopes?: string[] };
  export type OpenPage = { page: string, addUrlText?: string | UrlParams };
  export type StripeResult = { token: string };
  export type PassphraseEntry = { entered: boolean; };
  export type Db = { f: string, args: any[] };
  export type StoreSessionSet = { acctEmail: string, key: string, value: string | undefined };
  export type StoreSessionGet = { acctEmail: string, key: string };
  export type StoreGlobalGet = { keys: GlobalIndex[]; };
  export type StoreGlobalSet = { values: GlobalStore; };
  export type StoreAcctGet = { acctEmail: string, keys: AccountIndex[]; };
  export type StoreAcctSet = { acctEmail: string, values: AccountStore; };
  export type Inbox = { acctEmail?: string };
  export type ReconnectAcctAuthPopup = { acctEmail: string, scopes?: string[] };
  export type PgpKeyDetails = { pubkey: string };
  export type PgpMsgDecrypt = PgpMsgMethod.Arg.Decrypt;
  export type PgpMsgDiagnoseMsgPubkeys = PgpMsgMethod.Arg.DiagnosePubkeys;
  export type PgpMsgVerifyDetached = PgpMsgMethod.Arg.VerifyDetached;
  export type PgpHashChallengeAnswer = { answer: string };
  export type Ajax = { req: JQueryAjaxSettings, stack: string };
  export type AjaxGmailAttGetChunk = { acctEmail: string, msgId: string, attId: string };

  export namespace Res {
    export type GetActiveTabInfo = { provider: 'gmail' | undefined, acctEmail: string | undefined, sameWorld: boolean | undefined };
    export type StoreSessionGet = string | null;
    export type StoreSessionSet = void;
    export type StoreGlobalGet = GlobalStore;
    export type StoreGlobalSet = void;
    export type StoreAcctGet = AccountStore;
    export type StoreAcctSet = void;
    export type ReconnectAcctAuthPopup = AuthRes;
    export type PgpKeyDetails = { original: string, normalized: string, keys: KeyDetails[] };
    export type PgpMsgDecrypt = DecryptResult;
    export type PgpMsgDiagnoseMsgPubkeys = DiagnoseMsgPubkeysResult;
    export type PgpMsgVerify = VerifyRes;
    export type PgpHashChallengeAnswer = { hashed: string };
    export type AjaxGmailAttGetChunk = { chunk: Buf };
    export type _tab_ = { tabId: string | null | undefined };
    export type Db = any; // not included in Any below
    export type Ajax = any; // not included in Any below

    export type Any = GetActiveTabInfo | _tab_ | ReconnectAcctAuthPopup | PgpKeyDetails
      | PgpMsgDecrypt | PgpMsgDiagnoseMsgPubkeys | PgpMsgVerify | PgpHashChallengeAnswer
      | StoreSessionGet | StoreSessionSet | StoreAcctGet | StoreAcctSet | StoreGlobalGet | StoreGlobalSet
      | AjaxGmailAttGetChunk;
  }

  export type AnyRequest = PassphraseEntry | StripeResult | OpenPage | OpenGoogleAuthDialog | Redirect | Reload |
    AddPubkeyDialog | ReinsertReplyBox | CloseReplyMessage | ScrollToElement | SubscribeDialog | RenderPublicKeys | NotificationShowAuthPopupNeeded |
    NotificationShow | PassphraseDialog | PassphraseDialog | Settings | SetCss | AddOrRemoveClass | ReconnectAcctAuthPopup |
    PgpKeyDetails | Db | StoreSessionSet | StoreSessionGet | StoreGlobalGet | StoreGlobalSet | StoreAcctGet | StoreAcctSet |
    PgpMsgDecrypt | PgpMsgDiagnoseMsgPubkeys | PgpMsgVerifyDetached | PgpHashChallengeAnswer | Ajax | FocusFrame;

  // export type RawResponselessHandler = (req: AnyRequest) => Promise<void>;
  // export type RawRespoHandler = (req: AnyRequest) => Promise<void>;
  export type RawBrowserMsgHandler = (req: AnyRequest, sender: Sender, respond: (r: RawResponse) => void) => void;
  export type AsyncRespondingHandler = (req: AnyRequest, sender: Sender) => Promise<Res.Any>;
  export type AsyncResponselessHandler = (req: AnyRequest, sender: Sender) => Promise<void>;

  export type ErrAsJson =
    { stack?: string; message: string, errorConstructor: 'Error' } |
    { stack?: string; message: string, errorConstructor: 'AjaxErr', ajaxErrorDetails: { status: number, url: string, responseText: string, statusText: string } };
}

type Handler = Bm.AsyncRespondingHandler | Bm.AsyncResponselessHandler;
export type Handlers = Dict<Handler>;

export class BgNotReadyErr extends Error { }
export class TabIdRequiredError extends Error { }

export class BrowserMsg {

  public static MAX_SIZE = 1024 * 1024; // 1MB

  public static send = { // todo - may want to organise this differently, seems to always confuse me when sending a message
    bg: {
      settings: (bm: Bm.Settings) => BrowserMsg.sendCatch(undefined, 'settings', bm),
      updateUninstallUrl: () => BrowserMsg.sendCatch(undefined, 'update_uninstall_url', {}),
      inbox: (bm: Bm.Inbox) => BrowserMsg.sendCatch(undefined, 'inbox', bm),
      await: {
        reconnectAcctAuthPopup: (bm: Bm.ReconnectAcctAuthPopup) => BrowserMsg.sendAwait(undefined, 'reconnect_acct_auth_popup', bm, true) as Promise<Bm.Res.ReconnectAcctAuthPopup>,
        getActiveTabInfo: () => BrowserMsg.sendAwait(undefined, 'get_active_tab_info', undefined, true) as Promise<Bm.Res.GetActiveTabInfo>,
        storeSessionGet: (bm: Bm.StoreSessionGet) => BrowserMsg.sendAwait(undefined, 'session_get', bm, true) as Promise<Bm.Res.StoreSessionGet>,
        storeSessionSet: (bm: Bm.StoreSessionSet) => BrowserMsg.sendAwait(undefined, 'session_set', bm, true) as Promise<Bm.Res.StoreSessionSet>,
        storeGlobalGet: (bm: Bm.StoreGlobalGet) => BrowserMsg.sendAwait(undefined, 'storeGlobalGet', bm, true) as Promise<Bm.Res.StoreGlobalGet>,
        storeGlobalSet: (bm: Bm.StoreGlobalSet) => BrowserMsg.sendAwait(undefined, 'storeGlobalSet', bm, true) as Promise<Bm.Res.StoreGlobalSet>,
        storeAcctGet: (bm: Bm.StoreAcctGet) => BrowserMsg.sendAwait(undefined, 'storeAcctGet', bm, true) as Promise<Bm.Res.StoreAcctGet>,
        storeAcctSet: (bm: Bm.StoreAcctSet) => BrowserMsg.sendAwait(undefined, 'storeAcctSet', bm, true) as Promise<Bm.Res.StoreAcctSet>,
        db: (bm: Bm.Db): Promise<Bm.Res.Db> => BrowserMsg.sendAwait(undefined, 'db', bm, true) as Promise<Bm.Res.Db>,
        pgpMsgDecrypt: (bm: Bm.PgpMsgDecrypt) => BrowserMsg.sendAwait(undefined, 'pgpMsgDecrypt', bm, true) as Promise<Bm.Res.PgpMsgDecrypt>,
        pgpMsgVerifyDetached: (bm: Bm.PgpMsgVerifyDetached) => BrowserMsg.sendAwait(undefined, 'pgpMsgVerifyDetached', bm, true) as Promise<Bm.Res.PgpMsgVerify>,
        ajax: (bm: Bm.Ajax): Promise<Bm.Res.Ajax> => BrowserMsg.sendAwait(undefined, 'ajax', bm, true) as Promise<Bm.Res.Ajax>,
        ajaxGmailAttGetChunk: (bm: Bm.AjaxGmailAttGetChunk) => BrowserMsg.sendAwait(undefined, 'ajaxGmailAttGetChunk', bm, true) as Promise<Bm.Res.AjaxGmailAttGetChunk>,
        pgpKeyDetails: (bm: Bm.PgpKeyDetails) => BrowserMsg.sendAwait(undefined, 'pgpKeyDetails', bm, true) as Promise<Bm.Res.PgpKeyDetails>,
      },
    },
    passphraseEntry: (dest: Bm.Dest, bm: Bm.PassphraseEntry) => BrowserMsg.sendCatch(dest, 'passphrase_entry', bm),
    addEndSessionBtn: (dest: Bm.Dest) => BrowserMsg.sendCatch(dest, 'add_end_session_btn', {}),
    stripeResult: (dest: Bm.Dest, bm: Bm.StripeResult) => BrowserMsg.sendCatch(dest, 'stripe_result', bm),
    openPage: (dest: Bm.Dest, bm: Bm.OpenPage) => BrowserMsg.sendCatch(dest, 'open_page', bm),
    setCss: (dest: Bm.Dest, bm: Bm.SetCss) => BrowserMsg.sendCatch(dest, 'set_css', bm),
    addClass: (dest: Bm.Dest, bm: Bm.AddOrRemoveClass) => BrowserMsg.sendCatch(dest, 'add_class', bm),
    removeClass: (dest: Bm.Dest, bm: Bm.AddOrRemoveClass) => BrowserMsg.sendCatch(dest, 'remove_class', bm),
    closeDialog: (dest: Bm.Dest) => BrowserMsg.sendCatch(dest, 'close_dialog', {}),
    closePage: (dest: Bm.Dest) => BrowserMsg.sendCatch(dest, 'close_page', {}),
    closeNewMessage: (dest: Bm.Dest) => BrowserMsg.sendCatch(dest, 'close_new_message', {}),
    focusBody: (dest: Bm.Dest) => BrowserMsg.sendCatch(dest, 'focus_body', {}),
    focusFrame: (dest: Bm.Dest, bm: Bm.FocusFrame) => BrowserMsg.sendCatch(dest, 'focus_frame', bm),
    closeReplyMessage: (dest: Bm.Dest, bm: Bm.CloseReplyMessage) => BrowserMsg.sendCatch(dest, 'close_reply_message', bm),
    openNewMessage: (dest: Bm.Dest) => BrowserMsg.sendCatch(dest, 'open_new_message', {}),
    scrollToElement: (dest: Bm.Dest, bm: Bm.ScrollToElement) => BrowserMsg.sendCatch(dest, 'scroll_to_element', bm),
    reinsertReplyBox: (dest: Bm.Dest, bm: Bm.ReinsertReplyBox) => BrowserMsg.sendCatch(dest, 'reinsert_reply_box', bm),
    passphraseDialog: (dest: Bm.Dest, bm: Bm.PassphraseDialog) => BrowserMsg.sendCatch(dest, 'passphrase_dialog', bm),
    notificationShow: (dest: Bm.Dest, bm: Bm.NotificationShow) => BrowserMsg.sendCatch(dest, 'notification_show', bm),
    notificationShowAuthPopupNeeded: (dest: Bm.Dest, bm: Bm.NotificationShowAuthPopupNeeded) => BrowserMsg.sendCatch(dest, 'notification_show_auth_popup_needed', bm),
    renderPublicKeys: (dest: Bm.Dest, bm: Bm.RenderPublicKeys) => BrowserMsg.sendCatch(dest, 'render_public_keys', bm),
    subscribeDialog: (dest: Bm.Dest, bm: Bm.SubscribeDialog) => BrowserMsg.sendCatch(dest, 'subscribe_dialog', bm),
    replyPubkeyMismatch: (dest: Bm.Dest) => BrowserMsg.sendCatch(dest, 'reply_pubkey_mismatch', {}),
    addPubkeyDialog: (dest: Bm.Dest, bm: Bm.AddPubkeyDialog) => BrowserMsg.sendCatch(dest, 'add_pubkey_dialog', bm),
    reload: (dest: Bm.Dest, bm: Bm.Reload) => BrowserMsg.sendCatch(dest, 'reload', bm),
    redirect: (dest: Bm.Dest, bm: Bm.Redirect) => BrowserMsg.sendCatch(dest, 'redirect', bm),
    openGoogleAuthDialog: (dest: Bm.Dest, bm: Bm.OpenGoogleAuthDialog) => BrowserMsg.sendCatch(dest, 'open_google_auth_dialog', bm),
    addToContacts: (dest: Bm.Dest) => BrowserMsg.sendCatch(dest, 'addToContacts', {}),
    await: {
      pgpMsgDiagnosePubkeys: (dest: Bm.Dest, bm: Bm.PgpMsgDiagnoseMsgPubkeys) => BrowserMsg.sendAwait(dest, 'pgpMsgDiagnosePubkeys', bm, true) as Promise<Bm.Res.PgpMsgDiagnoseMsgPubkeys>,
      pgpHashChallengeAnswer: (dest: Bm.Dest, bm: Bm.PgpHashChallengeAnswer) => BrowserMsg.sendAwait(dest, 'pgpHashChallengeAnswer', bm, true) as Promise<Bm.Res.PgpHashChallengeAnswer>,
    }
  };
  private static HANDLERS_REGISTERED_BACKGROUND: Handlers = {};
  private static HANDLERS_REGISTERED_FRAME: Handlers = {
    set_css: BrowserMsgCommonHandlers.setCss,
    add_class: BrowserMsgCommonHandlers.addClass,
    remove_class: BrowserMsgCommonHandlers.removeClass,
  };

  public static renderFatalErrCorner = (message: string, style: 'GREEN-NOTIFICATION' | 'RED-RELOAD-PROMPT') => {
    const div = document.createElement('div');
    div.textContent = message;
    div.style.position = 'fixed';
    div.style.bottom = '0';
    div.style.right = '0';
    div.style.fontSize = '12px';
    div.style.backgroundColor = '#31a217';
    div.style.color = 'white';
    div.style.padding = '1px 3px';
    div.style.zIndex = '1000';
    if (style === 'RED-RELOAD-PROMPT') {
      div.style.fontSize = '14px';
      div.style.backgroundColor = '#a44';
      div.style.padding = '4px 6px';
      const a = document.createElement('a');
      a.href = window.location.href.split('#')[0];
      a.textContent = 'RELOAD';
      a.style.color = 'white';
      a.style.fontWeight = 'bold';
      a.style.marginLeft = '12px';
      div.appendChild(a);
    }
    window.document.body.appendChild(div);
  }

  public static tabId = async (): Promise<string | null | undefined> => {
    try {
      const { tabId } = await BrowserMsg.sendAwait(undefined, '_tab_', undefined, true) as Bm.Res._tab_;
      return tabId;
    } catch (e) {
      if (e instanceof BgNotReadyErr) {
        return undefined;
      }
      throw e;
    }
  }

  public static requiredTabId = async (attempts = 10, delay = 200): Promise<string> => {
    let tabId;
    for (let i = 0; i < attempts; i++) { // sometimes returns undefined right after browser start due to BgNotReadyErr
      tabId = await BrowserMsg.tabId();
      if (tabId) {
        return tabId;
      }
      await Ui.time.sleep(delay);
    }
    throw new TabIdRequiredError(`tabId is required, but received '${String(tabId)}' after ${attempts} attempts`);
  }

  public static addListener = (name: string, handler: Handler) => {
    BrowserMsg.HANDLERS_REGISTERED_FRAME[name] = handler;
  }

  public static listen = (listenForTabId: string) => {
    const processed: string[] = [];
    chrome.runtime.onMessage.addListener((msg: Bm.Raw, sender, rawRespond: (rawResponse: Bm.RawResponse) => void) => {
      try {
        if (msg.to === listenForTabId || msg.to === 'broadcast') {
          if (!processed.includes(msg.uid)) {
            processed.push(msg.uid);
            if (typeof BrowserMsg.HANDLERS_REGISTERED_FRAME[msg.name] !== 'undefined') {
              const handler: Bm.AsyncRespondingHandler = BrowserMsg.HANDLERS_REGISTERED_FRAME[msg.name];
              BrowserMsg.replaceObjUrlWithBuf(msg.data.bm, msg.data.objUrls)
                .then(bm => BrowserMsg.sendRawResponse(handler(bm, sender), rawRespond))
                .catch(e => BrowserMsg.sendRawResponse(Promise.reject(e), rawRespond));
              return true; // will respond
            } else if (msg.name !== '_tab_' && msg.to !== 'broadcast') {
              BrowserMsg.sendRawResponse(Promise.reject(new Error(`BrowserMsg.listen error: handler "${msg.name}" not set`)), rawRespond);
              return true; // will respond
            }
          } else {
            // sometimes received events get duplicated
            // while first event is being processed, second even will arrive
            // that's why we generate a unique id of each request (uid) and filter them above to identify truly unique requests
            // if we got here, that means we are handing a duplicate request
            // we'll indicate will respond = true, so that the processing of the actual request is not negatively affected
            // leaving it at "false" would respond with null, which would throw an error back to the original BrowserMsg sender:
            // "Error: BrowserMsg.sendAwait(pgpMsgDiagnosePubkeys) returned(null) with lastError: (no lastError)"
            // why the requests get duplicated in the first place I'm not sure, it feels like a browser bug
            return true;
          }
        }
      } catch (e) {
        BrowserMsg.sendRawResponse(Promise.reject(e), rawRespond);
        return true; // will respond
      }
      return false; // will not respond
    });
  }

  public static bgAddListener = (name: string, handler: Handler) => {
    BrowserMsg.HANDLERS_REGISTERED_BACKGROUND[name] = handler;
  }

  public static bgListen = () => {
    chrome.runtime.onMessage.addListener((msg: Bm.Raw, sender, rawRespond: (rawRes: Bm.RawResponse) => void) => {
      const respondIfPageStillOpen = (response: Bm.RawResponse) => {
        try { // avoiding unnecessary errors when target tab gets closed
          rawRespond(response);
        } catch (cannotRespondErr) {
          if (cannotRespondErr instanceof Error && cannotRespondErr.message === 'Attempting to use a disconnected port object') {
            // the page we're responding to is closed - ec when closing secure compose
          } else {
            if (cannotRespondErr instanceof Error) {
              cannotRespondErr.stack += `\n\nOriginal msg sender stack: ${msg.stack}`;
            }
            Catch.reportErr(Catch.rewrapErr(cannotRespondErr, `BrowserMsg.bgListen.respondIfPageStillOpen:${msg.name}`));
          }
        }
      };
      try {
        if (msg.to && msg.to !== 'broadcast') { // the bg is relaying a msg from one page to another
          msg.sender = sender;
          chrome.tabs.sendMessage(BrowserMsg.browserMsgDestParse(msg.to).tab!, msg, {}, respondIfPageStillOpen);
          return true; // will respond
        } else if (Object.keys(BrowserMsg.HANDLERS_REGISTERED_BACKGROUND).includes(msg.name)) { // standard or broadcast message
          const handler: Bm.AsyncRespondingHandler = BrowserMsg.HANDLERS_REGISTERED_BACKGROUND[msg.name];
          BrowserMsg.replaceObjUrlWithBuf(msg.data.bm, msg.data.objUrls)
            .then(bm => BrowserMsg.sendRawResponse(handler(bm, sender), respondIfPageStillOpen))
            .catch(e => BrowserMsg.sendRawResponse(Promise.reject(e), respondIfPageStillOpen));
          return true; // will respond
        } else if (msg.to !== 'broadcast') { // non-broadcast message that we don't have a handler for
          BrowserMsg.sendRawResponse(Promise.reject(new Error(`BrowserMsg.bgListen:${msg.name}:no such handler`)), respondIfPageStillOpen);
          return true; // will respond
        } else { // broadcast message that backend does not have a handler for - ignored
          return false; // no plans to respond
        }
      } catch (exception) {
        BrowserMsg.sendRawResponse(Promise.reject(exception), respondIfPageStillOpen);
        return true; // will respond
      }
    });
  }

  private static sendCatch = (dest: Bm.Dest | undefined, name: string, bm: Dict<any>) => {
    BrowserMsg.sendAwait(dest, name, bm).catch(Catch.reportErr);
  }

  private static sendAwait = async (destString: string | undefined, name: string, bm?: Dict<unknown>, awaitRes = false): Promise<Bm.Response> => {
    bm = bm || {};
    const isBackgroundPage = Env.isBackgroundPage();
    if (isBackgroundPage && BrowserMsg.HANDLERS_REGISTERED_BACKGROUND && typeof destString === 'undefined') { // calling from bg script to bg script: skip messaging
      const handler: Bm.AsyncRespondingHandler = BrowserMsg.HANDLERS_REGISTERED_BACKGROUND[name];
      return await handler(bm, 'background');
    }
    return await new Promise((resolve, reject) => { // here browser messaging is used - msg has to be serializable - Buf instances need to be converted to object urls, and back upon receipt
      const objUrls = BrowserMsg.replaceBufWithObjUrlInplace(bm);
      const msg: Bm.Raw = { name, data: { bm: bm!, objUrls }, to: destString || null, uid: Str.sloppyRandom(10), stack: Catch.stackTrace() }; // tslint:disable-line:no-null-keyword
      const processRawMsgResponse = (r: Bm.RawResponse) => {
        if (!awaitRes) {
          resolve();
        } else if (!r || typeof r !== 'object') { // r can be null if we sent a message to a non-existent window id
          const lastError = chrome.runtime.lastError ? chrome.runtime.lastError.message || '(empty lastError)' : '(no lastError)';
          let e: Error;
          if (typeof destString === 'undefined' && typeof r === 'undefined') {
            if (lastError === 'The object could not be cloned.') {
              e = new Error(`BrowserMsg.sendAwait(${name}) failed with lastError: ${lastError}`);
            } else if (lastError === 'Could not establish connection. Receiving end does not exist.' || lastError === 'The message port closed before a response was received.') {
              // "The message port closed before a response was received." could also happen for otherwise working extension, if bg script
              //    did not return `true` (indicating async response). That would be our own coding error in BrowserMsg.
              e = new BgNotReadyErr(`BgNotReadyErr: BrowserMsg.sendAwait(${name}) failed with lastError: ${lastError}`);
            } else {
              e = new Error(`BrowserMsg.sendAwait(${name}) failed with unknown lastError: ${lastError}`);
            }
          } else {
            e = new Error(`BrowserMsg.sendAwait(${name}) returned(${String(r)}) with lastError: ${lastError}`);
          }
          e.stack = `${msg.stack}\n\n${e.stack}`;
          reject(e);
        } else if (typeof r === 'object' && r.exception) {
          reject(BrowserMsg.jsonToErr(r.exception, msg));
        } else if (!r.result || typeof r.result !== 'object') {
          resolve(r.result as Bm.Response);
        } else {
          BrowserMsg.replaceObjUrlWithBuf(r.result, r.objUrls).then(resolve).catch(reject);
        }
      };
      try {
        if (isBackgroundPage) {
          chrome.tabs.sendMessage(BrowserMsg.browserMsgDestParse(msg.to).tab!, msg, {}, processRawMsgResponse);
        } else if (chrome.runtime) {
          chrome.runtime.sendMessage(msg, processRawMsgResponse);
        } else {
          BrowserMsg.renderFatalErrCorner('Error: missing chrome.runtime', 'RED-RELOAD-PROMPT');
        }
      } catch (e) {
        if (e instanceof Error && e.message === 'Extension context invalidated.') {
          BrowserMsg.renderFatalErrCorner('Restart browser to re-enable FlowCrypt', 'GREEN-NOTIFICATION');
        } else {
          throw e;
        }
      }
    });
  }

  /**
   * Be careful when editting - the type system won't help you here and you'll likely make mistakes
   *
   * The requestOrResponse object will get directly updated in this function
   */
  private static replaceBufWithObjUrlInplace = (requestOrResponse: unknown): Dict<string> => {
    const objUrls: Dict<string> = {};
    if (requestOrResponse && typeof requestOrResponse === 'object' && requestOrResponse !== null) { // lgtm [js/comparison-between-incompatible-types]
      for (const possibleBufName of Object.keys(requestOrResponse)) {
        const possibleBufs = (requestOrResponse as any)[possibleBufName];
        if (possibleBufs instanceof Uint8Array) {
          objUrls[possibleBufName] = Browser.objUrlCreate(possibleBufs);
          (requestOrResponse as any)[possibleBufName] = undefined;
        }
      }
    }
    return objUrls;
  }

  /**
   * Be careful when editting - the type system won't help you here and you'll likely make mistakes
   */
  private static replaceObjUrlWithBuf = async <T>(requestOrResponse: T, objUrls: Dict<string>): Promise<T> => {
    if (requestOrResponse && typeof requestOrResponse === 'object' && requestOrResponse !== null && objUrls) { // lgtm [js/comparison-between-incompatible-types]
      for (const consumableObjUrlName of Object.keys(objUrls)) {
        (requestOrResponse as any)[consumableObjUrlName] = await Browser.objUrlConsume(objUrls[consumableObjUrlName]);
      }
    }
    return requestOrResponse;
  }

  private static errToJson = (e: any): Bm.ErrAsJson => {
    if (e instanceof AjaxErr) {
      const { message, stack, status, url, responseText, statusText } = e;
      return { stack, message, errorConstructor: 'AjaxErr', ajaxErrorDetails: { status, url, responseText, statusText } };
    }
    const { stack, message } = Catch.rewrapErr(e, 'sendRawResponse');
    return { stack, message, errorConstructor: 'Error' };
  }

  private static jsonToErr = (errAsJson: Bm.ErrAsJson, msg: Bm.Raw) => {
    const stackInfo = `\n\n[callerStack]\n${msg.stack}\n[/callerStack]\n\n[responderStack]\n${errAsJson.stack}\n[/responderStack]\n`;
    if (errAsJson.errorConstructor === 'AjaxErr') {
      const { status, url, responseText, statusText } = errAsJson.ajaxErrorDetails;
      return new AjaxErr(`BrowserMsg(${name}) ${errAsJson.message}`, stackInfo, status, url, responseText, statusText);
    }
    const e = new Error(`BrowserMsg(${name}) ${errAsJson.message}`);
    e.stack += stackInfo;
    return e;
  }

  private static sendRawResponse = (handlerPromise: Promise<Bm.Res.Any>, rawRespond: (rawResponse: Bm.RawResponse) => void) => {
    handlerPromise.then(result => {
      const objUrls = BrowserMsg.replaceBufWithObjUrlInplace(result); // this actually changes the result object
      rawRespond({ result, exception: undefined, objUrls });
    }).catch(e => {
      rawRespond({ result: undefined, exception: BrowserMsg.errToJson(e), objUrls: {} });
    });
  }

  private static browserMsgDestParse = (destString: string | null) => {
    const parsed = { tab: undefined as undefined | number, frame: undefined as undefined | number };
    if (destString) {
      parsed.tab = Number(destString.split(':')[0]);
      const parsedFrame = Number(destString.split(':')[1]);
      parsed.frame = !isNaN(parsedFrame) ? parsedFrame : undefined;
    }
    return parsed;
  }

}
