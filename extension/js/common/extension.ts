/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Str, Value, Dict } from './common.js';
import { Pgp, DiagnoseMsgPubkeysResult, DecryptResult, MsgVerifyResult } from './pgp.js';
import { FlatTypes } from './store.js';
import { Ui, Env, Browser, UrlParams, PassphraseDialogType } from './browser.js';
import { Catch } from './catch.js';

type Codec = { encode: (text: string, mode: 'fatal' | 'html') => string, decode: (text: string) => string, labels: string[], version: string };
export type GoogleAuthWindowResult$result = 'Success' | 'Denied' | 'Error' | 'Closed';
export type PossibleBgExecResults = DecryptResult | DiagnoseMsgPubkeysResult | MsgVerifyResult | string;

export type AnyThirdPartyLibrary = any;

export namespace Bm {
  export type Dest = string;
  export type Sender = chrome.runtime.MessageSender | 'background';
  export type Response = any;
  export type Raw = { name: string; data: AnyRequest | {}; to: Dest | null; uid: string; stack: string; sender?: Sender; };

  export type SetCss = { css: Dict<string>, traverseUp?: number, selector: string; };
  export type Settings = { path?: string, page?: string, acctEmail?: string, pageUrlParams?: UrlParams, addNewAcct?: boolean };
  export type PassphraseDialog = { type: PassphraseDialogType, longids: string[] };
  export type NotificationShow = { notification: string, callbacks?: Dict<() => void> };
  export type NotificationShowAuthPopupNeeded = { acctEmail: string };
  export type RenderPublicKeys = { afterFrameId: string, publicKeys: string[], traverseUp?: number };
  export type SubscribeDialog = { source?: 'authErr', subscribeResultTabId?: Dest };
  export type ShowSubscribeDialog = {};
  export type CloseReplyMessage = { frameId: string, threadId: string };
  export type ReinsertReplyBox = { acctEmail: string, myEmail: string, subject: string, theirEmail: string[], threadId: string, threadMsgId: string };
  export type AddPubkeyDialog = { emails: string[] };
  export type SubscribeResult = { active: boolean };
  export type SetFooter = { footer: string | null };
  export type Reload = { advanced?: boolean };
  export type Redirect = { location: string };
  export type OpenGoogleAuthDialog = { acctEmail?: string, omitReadScope?: boolean };
  export type AttestRequested = { acctEmail: string };
  export type OpenPage = { page: string, addUrlText?: string | UrlParams };
  export type StripeResult = { token: string };
  export type PassphraseEntry = { entered: boolean; };
  export type BgExec = { path: string, args: any[] };
  export type Db = { f: string, args: any[] };
  export type SessionSet = { acctEmail: string, key: string, value: string | undefined };
  export type SessionGet = { acctEmail: string, key: string };
  export type AttestPacketReceived = { acctEmail: string, packet: string, passphrase: string };
  export type Inbox = { acctEmail?: string };

  export namespace Res {
    export type ShowSubscribeDialog = { active: boolean };
    export type BgExec = { result?: PossibleBgExecResults, exception?: { name: string, message: string, stack: string } };
    export type AttestPacketReceived = { success: boolean; result: string };
    export type GetActiveTabInfo = { provider: 'gmail' | null, acctEmail: string | null | undefined, sameWorld: boolean | null };
    export type SessionGet = string | null;
    export type SessionSet = void;
    export type _tab_ = { tabId: string | null | undefined };
    export type Db = any; // not included in Any
    export type Any = BgExec | AttestPacketReceived | GetActiveTabInfo | SessionGet | SessionSet | _tab_ | ShowSubscribeDialog;
  }

  export type AnyRequest = PassphraseEntry | StripeResult | OpenPage | AttestRequested | OpenGoogleAuthDialog | Redirect | Reload |
    SubscribeResult | AddPubkeyDialog | ReinsertReplyBox | CloseReplyMessage | SubscribeDialog | RenderPublicKeys | NotificationShowAuthPopupNeeded |
    NotificationShow | PassphraseDialog | PassphraseDialog | Settings | SetCss | BgExec | Db | SessionSet | SetFooter |
    SessionGet | AttestPacketReceived;

  export type ResponselessHandler = (req: AnyRequest) => void | Promise<void>;
  export type RespondingHandler = (req: AnyRequest, sender: Sender, respond: (r: Res.Any) => void) => void | Promise<void>;
}

type Handler = Bm.RespondingHandler | Bm.ResponselessHandler;
export type Handlers = Dict<Handler>;

export interface BrowserWidnow extends Window {
  onunhandledrejection: (e: any) => void;
  'emailjs-mime-codec': AnyThirdPartyLibrary;
  'emailjs-mime-parser': AnyThirdPartyLibrary;
  'emailjs-mime-builder': AnyThirdPartyLibrary;
  'emailjs-addressparser': {
    parse: (raw: string) => { name: string, address: string }[];
  };
}
export interface FcWindow extends BrowserWidnow {
  $: JQuery;
  iso88592: Codec;
  // windows1252: Codec;
  // koi8r: Codec;
  is_bare_engine: boolean;
}
export interface ContentScriptWindow extends FcWindow {
  TrySetDestroyableTimeout: (code: () => void, ms: number) => number;
  TrySetDestroyableInterval: (code: () => void, ms: number) => number;
  injected: true; // background script will use this to test if scripts were already injected, and inject if not
  account_email_global: null | string; // used by background script
  same_world_global: true; // used by background_script
  destruction_event: string;
  destroyable_class: string;
  reloadable_class: string;
  destroyable_intervals: number[];
  destroyable_timeouts: number[];
  destroy: () => void;
  vacant: () => boolean;
}

export class TabIdRequiredError extends Error { }

export class Extension { // todo - move extension-specific common.js code here

  public static prepareBugReport = (name: string, details?: Dict<FlatTypes>, error?: Error | any): string => {
    const bugReport: Dict<string> = {
      name,
      stack: Catch.stackTrace(),
    };
    try {
      bugReport.error = JSON.stringify(error, null, 2);
    } catch (e) {
      bugReport.error_as_string = String(error);
      bugReport.error_serialization_error = String(e);
    }
    try {
      bugReport.details = JSON.stringify(details, null, 2);
    } catch (e) {
      bugReport.details_as_string = String(details);
      bugReport.details_serialization_error = String(e);
    }
    let result = '';
    for (const k of Object.keys(bugReport)) {
      result += `\n[${k}]\n${bugReport[k]}\n`;
    }
    return result;
  }

}

export class BrowserMsg {

  public static MAX_SIZE = 1024 * 1024; // 1MB
  private static HANDLERS_REGISTERED_BACKGROUND: Handlers = {};
  private static HANDLERS_REGISTERED_FRAME: Handlers = {
    set_css: (data: Bm.SetCss) => {
      let el = $(data.selector);
      const traverseUpLevels = data.traverseUp as number || 0;
      for (let i = 0; i < traverseUpLevels; i++) {
        el = el.parent();
      }
      el.css(data.css);
    },
  };

  public static send = {
    bg: {
      attestRequested: (bm: Bm.AttestRequested) => BrowserMsg.sendCatch(null, 'attest_requested', bm),
      settings: (bm: Bm.Settings) => BrowserMsg.sendCatch(null, 'settings', bm),
      updateUninstallUrl: () => BrowserMsg.sendCatch(null, 'update_uninstall_url', {}),
      inbox: (bm: Bm.Inbox) => BrowserMsg.sendCatch(null, 'inbox', bm),
    },
    passphraseEntry: (dest: Bm.Dest, bm: Bm.PassphraseEntry) => BrowserMsg.sendCatch(dest, 'passphrase_entry', bm),
    stripeResult: (dest: Bm.Dest, bm: Bm.StripeResult) => BrowserMsg.sendCatch(dest, 'stripe_result', bm),
    openPage: (dest: Bm.Dest, bm: Bm.OpenPage) => BrowserMsg.sendCatch(dest, 'open_page', bm),
    setCss: (dest: Bm.Dest, bm: Bm.SetCss) => BrowserMsg.sendCatch(dest, 'set_css', bm),
    closeDialog: (dest: Bm.Dest) => BrowserMsg.sendCatch(dest, 'close_dialog', {}),
    closePage: (dest: Bm.Dest) => BrowserMsg.sendCatch(dest, 'close_page', {}),
    closeNewMessage: (dest: Bm.Dest) => BrowserMsg.sendCatch(dest, 'close_new_message', {}),
    closeReplyMessage: (dest: Bm.Dest, bm: Bm.CloseReplyMessage) => BrowserMsg.sendCatch(dest, 'close_reply_message', bm),
    setFooter: (dest: Bm.Dest, bm: Bm.SetFooter) => BrowserMsg.sendCatch(dest, 'set_footer', bm),
    openNewMessage: (dest: Bm.Dest) => BrowserMsg.sendCatch(dest, 'open_new_message', {}),
    scrollToBottomOfConversation: (dest: Bm.Dest) => BrowserMsg.sendCatch(dest, 'scroll_to_bottom_of_conversation', {}),
    reinsertReplyBox: (dest: Bm.Dest, bm: Bm.ReinsertReplyBox) => BrowserMsg.sendCatch(dest, 'reinsert_reply_box', bm),
    passphraseDialog: (dest: Bm.Dest, bm: Bm.PassphraseDialog) => BrowserMsg.sendCatch(dest, 'passphrase_dialog', bm),
    notificationShow: (dest: Bm.Dest, bm: Bm.NotificationShow) => BrowserMsg.sendCatch(dest, 'notification_show', bm),
    notificationShowAuthPopupNeeded: (dest: Bm.Dest, bm: Bm.NotificationShowAuthPopupNeeded) => BrowserMsg.sendCatch(dest, 'notification_show_auth_popup_needed', bm),
    renderPublicKeys: (dest: Bm.Dest, bm: Bm.RenderPublicKeys) => BrowserMsg.sendCatch(dest, 'render_public_keys', bm),
    subscribeDialog: (dest: Bm.Dest, bm: Bm.SubscribeDialog) => BrowserMsg.sendCatch(dest, 'subscribe_dialog', bm),
    replyPubkeyMismatch: (dest: Bm.Dest) => BrowserMsg.sendCatch(dest, 'reply_pubkey_mismatch', {}),
    addPubkeyDialog: (dest: Bm.Dest, bm: Bm.AddPubkeyDialog) => BrowserMsg.sendCatch(dest, 'add_pubkey_dialog', bm),
    subscribeResult: (dest: Bm.Dest, bm: Bm.SubscribeResult) => BrowserMsg.sendCatch(dest, 'subscribe_result', bm),
    reload: (dest: Bm.Dest, bm: Bm.Reload) => BrowserMsg.sendCatch(dest, 'reload', bm),
    redirect: (dest: Bm.Dest, bm: Bm.Redirect) => BrowserMsg.sendCatch(dest, 'redirect', bm),
    openGoogleAuthDialog: (dest: Bm.Dest, bm: Bm.OpenGoogleAuthDialog) => BrowserMsg.sendCatch(dest, 'open_google_auth_dialog', bm),
    await: {
      bg: {
        attestPacketReceived: (bm: Bm.AttestPacketReceived) => BrowserMsg.sendAwait(null, 'attest_packet_received', bm) as Promise<Bm.Res.AttestPacketReceived>,
        bgExec: (bm: Bm.BgExec) => BrowserMsg.sendAwait(null, 'bg_exec', bm) as Promise<Bm.Res.BgExec>,
        getActiveTabInfo: () => BrowserMsg.sendAwait(null, 'get_active_tab_info') as Promise<Bm.Res.GetActiveTabInfo>,
        sessionGet: (bm: Bm.SessionGet) => BrowserMsg.sendAwait(null, 'session_get', bm) as Promise<Bm.Res.SessionGet>,
        sessionSet: (bm: Bm.SessionSet) => BrowserMsg.sendAwait(null, 'session_set', bm) as Promise<Bm.Res.SessionSet>,
        db: (bm: Bm.Db) => BrowserMsg.sendAwait(null, 'db', bm) as Promise<Bm.Res.Db>,
      },
      showSubscribeDialog: (dest: Bm.Dest) => BrowserMsg.sendAwait(dest, 'show_subscribe_dialog', {}) as Promise<Bm.Res.ShowSubscribeDialog>,
    },
  };

  private static sendCatch = (dest: Bm.Dest | null, name: string, bm: Dict<any>) => {
    BrowserMsg.sendAwait(dest, name, bm).catch(Catch.handleErr);
  }

  private static sendAwait = (destString: string | null, name: string, bm?: Dict<any>): Promise<Bm.Response> => new Promise(resolve => {
    const msg: Bm.Raw = { name, data: bm || {}, to: destString || null, uid: Str.sloppyRandom(10), stack: Catch.stackTrace() };
    const tryResolveNoUndefined = (r?: Bm.Response) => Catch.try(() => resolve(typeof r === 'undefined' ? {} : r))();
    const isBackgroundPage = Env.isBackgroundPage();
    if (typeof destString === 'undefined') { // don't know where to send the message
      Catch.log('BrowserMsg.send to:undefined');
      tryResolveNoUndefined();
    } else if (isBackgroundPage && BrowserMsg.HANDLERS_REGISTERED_BACKGROUND && msg.to === null) {
      const handler: Bm.RespondingHandler = BrowserMsg.HANDLERS_REGISTERED_BACKGROUND[msg.name];
      handler(msg.data, 'background', tryResolveNoUndefined); // calling from background script to background script: skip messaging completely
    } else if (isBackgroundPage) {
      chrome.tabs.sendMessage(BrowserMsg.browserMsgDestParse(msg.to).tab!, msg, {}, tryResolveNoUndefined);
    } else {
      chrome.runtime.sendMessage(msg, tryResolveNoUndefined);
    }
  })

  public static tabId = async (): Promise<string | null | undefined> => {
    const r = await BrowserMsg.sendAwait(null, '_tab_', undefined) as Bm.Res._tab_;
    return r.tabId;
  }

  public static requiredTabId = async (attempts = 10, delay = 200): Promise<string> => {
    let tabId;
    for (let i = 0; i < attempts; i++) { // sometimes returns undefined right after browser start
      tabId = await BrowserMsg.tabId();
      if (tabId) {
        return tabId;
      }
      await Ui.time.sleep(delay);
    }
    throw new TabIdRequiredError(`Tab id is required, but received '${String(tabId)}' after ${attempts} attempts`);
  }

  public static addListener = (name: string, handler: Handler) => {
    BrowserMsg.HANDLERS_REGISTERED_FRAME[name] = handler;
  }

  public static listen = (listenForTabId: string) => {
    const processed: string[] = [];
    chrome.runtime.onMessage.addListener((msg: Bm.Raw, sender, respond) => {
      try {
        if (msg.to === listenForTabId || msg.to === 'broadcast') {
          if (!Value.is(msg.uid).in(processed)) {
            processed.push(msg.uid);
            if (typeof BrowserMsg.HANDLERS_REGISTERED_FRAME[msg.name] !== 'undefined') {
              const handler: Bm.RespondingHandler = BrowserMsg.HANDLERS_REGISTERED_FRAME[msg.name];
              const r = handler(msg.data, sender, respond);
              if (r && typeof r === 'object' && (r as Promise<void>).then && (r as Promise<void>).catch) {
                // todo - a way to callback the error to be re-thrown to caller stack
                (r as Promise<void>).catch(Catch.handleErr);
              }
            } else if (msg.name !== '_tab_' && msg.to !== 'broadcast') {
              if (BrowserMsg.browserMsgDestParse(msg.to).frame !== null) {
                // only consider it an error if frameId was set because of firefox bug: https://bugzilla.mozilla.org/show_bug.cgi?id=1354337
                Catch.report('BrowserMsg.listen error: handler "' + msg.name + '" not set', 'Message sender stack:\n' + msg.stack);
              } else { // once firefox fixes the bug, it will behave the same as Chrome and the following will never happen.
                console.log('BrowserMsg.listen ignoring missing handler "' + msg.name + '" due to Firefox Bug');
              }
            }
          }
        }
        return !!respond; // indicate that this listener intends to respond
      } catch (e) {
        // todo - a way to callback the error to be re-thrown to caller stack
        Catch.handleErr(e);
      }
      return undefined;
    });
  }

  public static bgAddListener = (name: string, handler: Handler) => {
    BrowserMsg.HANDLERS_REGISTERED_BACKGROUND[name] = handler;
  }

  public static bgListen = () => {
    chrome.runtime.onMessage.addListener((msg: Bm.Raw, sender, respond) => {
      try {
        const safeRespond = (response: any) => {
          try { // avoiding unnecessary errors when target tab gets closed
            respond(response);
          } catch (e) {
            if (e instanceof Error && e.message === 'Attempting to use a disconnected port object') {
              // todo - the sender should still know - could have PageClosedError
            } else {
              Catch.handleErr(e);
              throw e;
            }
          }
        };
        if (msg.to && msg.to !== 'broadcast') {
          msg.sender = sender;
          chrome.tabs.sendMessage(BrowserMsg.browserMsgDestParse(msg.to).tab!, msg, {}, safeRespond);
        } else if (Value.is(msg.name).in(Object.keys(BrowserMsg.HANDLERS_REGISTERED_BACKGROUND))) { // is !null because added above
          const handler: Bm.RespondingHandler = BrowserMsg.HANDLERS_REGISTERED_BACKGROUND[msg.name];
          const r = handler(msg.data, sender, safeRespond); // is !null because checked above
          if (r && typeof r === 'object' && (r as Promise<void>).then && (r as Promise<void>).catch) {
            // todo - a way to callback the error to be re-thrown to caller stack
            (r as Promise<void>).catch(Catch.handleErr);
          }
        } else if (msg.to !== 'broadcast') {
          Catch.report('BrowserMsg.listen_background error: handler "' + msg.name + '" not set', 'Message sender stack:\n' + msg.stack);
        }
        return !!respond; // indicate that we intend to respond later
      } catch (e) {
        // todo - a way to callback the error to be re-thrown to caller stack
        Catch.handleErr(e);
      }
      return undefined;
    });
  }

  private static browserMsgDestParse = (destString: string | null) => {
    const parsed = { tab: null as null | number, frame: null as null | number };
    if (destString) {
      parsed.tab = Number(destString.split(':')[0]);
      // @ts-ignore - adding nonsense into isNaN
      parsed.frame = !isNaN(destString.split(':')[1]) ? Number(destString.split(':')[1]) : null;
    }
    return parsed;
  }

}

export class BgExec {

  private static MAX_MESSAGE_SIZE = 1024 * 1024;

  public static bgReqHandler: Bm.RespondingHandler = async (message: Bm.BgExec, sender, respond: (r: Bm.Res.BgExec) => void) => {
    try {
      const argPromises = BgExec.argObjUrlsConsume(message.args);
      const args = await Promise.all(argPromises);
      const result = await BgExec.executeAndFormatResult(message.path, args);
      respond({ result });
    } catch (e) {
      try {
        const eIsObj = e instanceof Object;
        respond({
          exception: {
            name: eIsObj ? (e as Object).constructor.name : String(e), // tslint:disable-line:ban-types
            message: e instanceof Error ? e.message : String(e),
            stack: `${eIsObj && (e as any).stack ? (e as any).stack : ''}\n\n${eIsObj && (e as any).workerStack ? `Worker stack:\n${(e as any).workerStack}` : ''}`,
          },
        });
      } catch (e2) {
        respond({
          exception: {
            name: `CANNOT_PROCESS_BG_EXEC_ERROR: ${String(e2)}`,
            message: String(e),
            stack: new Error().stack!,
          },
        });
      }
    }
  }

  public static diagnoseMsgPubkeys = (acctEmail: string, message: string) => {
    return BgExec.requestToProcessInBg('Pgp.msg.diagnosePubkeys', [acctEmail, message]) as Promise<DiagnoseMsgPubkeysResult>;
  }

  public static cryptoHashChallengeAnswer = (password: string) => {
    return BgExec.requestToProcessInBg('Pgp.hash.challengeAnswer', [password]) as Promise<string>;
  }

  public static cryptoMsgDecrypt = async (acctEmail: string, encryptedData: string | Uint8Array, msgPwd: string | null = null, getUint8 = false) => {
    const result = await BgExec.requestToProcessInBg('Pgp.msg.decrypt', [acctEmail, encryptedData, msgPwd, getUint8]) as DecryptResult;
    if (result.success && result.content && result.content.blob && result.content.blob.blob_url.indexOf(`blob:${chrome.runtime.getURL('')}`) === 0) {
      if (result.content.blob.blob_type === 'text') {
        result.content.text = Str.fromUint8(await Browser.objUrlConsume(result.content.blob.blob_url));
      } else {
        result.content.uint8 = await Browser.objUrlConsume(result.content.blob.blob_url);
      }
      result.content.blob = undefined;
    }
    return result;
  }

  public static cryptoMsgVerifyDetached = (acctEmail: string, message: string | Uint8Array, signature: string | Uint8Array) => {
    return BgExec.requestToProcessInBg('Pgp.msg.verifyDetached', [acctEmail, message, signature]) as Promise<MsgVerifyResult>;
  }

  private static executeAndFormatResult = async (path: string, resolvedArgs: any[]): Promise<PossibleBgExecResults> => {
    const f = BgExec.resolvePathToCallableFunction(path);
    const returned: Promise<PossibleBgExecResults> | PossibleBgExecResults = f.apply(null, resolvedArgs); // tslint:disable-line:no-unsafe-any
    if (returned && typeof returned === 'object' && typeof (returned as Promise<PossibleBgExecResults>).then === 'function') { // got a promise
      const resolved = await returned;
      if (path === 'Pgp.msg.decrypt') {
        BgExec.cryptoMsgDecryptResCreateBlobs(resolved as DecryptResult);
      }
      return resolved;
    }
    return returned as PossibleBgExecResults; // direct result
  }

  private static cryptoMsgDecryptResCreateBlobs = (decryptRes: DecryptResult) => {
    if (decryptRes && decryptRes.success && decryptRes.content) {
      if (decryptRes.content.text && decryptRes.content.text.length >= BgExec.MAX_MESSAGE_SIZE) {
        decryptRes.content.blob = { blob_type: 'text', blob_url: Browser.objUrlCreate(decryptRes.content.text) };
        decryptRes.content.text = undefined; // replaced with a blob
      } else if (decryptRes.content.uint8 && decryptRes.content.uint8 instanceof Uint8Array) {
        decryptRes.content.blob = { blob_type: 'uint8', blob_url: Browser.objUrlCreate(decryptRes.content.uint8) };
        decryptRes.content.uint8 = undefined; // replaced with a blob
      }
    }
  }

  private static isObjUrl = (arg: any) => typeof arg === 'string' && arg.indexOf('blob:' + chrome.runtime.getURL('')) === 0;

  private static shouldBeObjUrl = (arg: any) => (typeof arg === 'string' && arg.length > BrowserMsg.MAX_SIZE) || arg instanceof Uint8Array;

  private static argObjUrlsConsume = (args: any[]) => args.map((arg: any) => BgExec.isObjUrl(arg) ? Browser.objUrlConsume(arg) : arg); // tslint:disable-line:no-unsafe-any

  private static argObjUrlsCreate = (args: any[]) => args.map(arg => BgExec.shouldBeObjUrl(arg) ? Browser.objUrlCreate(arg) : arg); // tslint:disable-line:no-unsafe-any

  private static resolvePathToCallableFunction = (path: string): Function => {  // tslint:disable-line:ban-types
    let f: Function | object | null = null; // tslint:disable-line:ban-types
    for (const step of path.split('.')) {
      if (f === null) {
        if (step === 'Pgp') {
          f = Pgp;
        } else {
          throw new Error(`BgExec: Not prepared for relaying class ${step}`);
        }
      } else {
        // @ts-ignore
        f = f[step]; // tslint:disable-line:no-unsafe-any
      }
    }
    return f as Function; // tslint:disable-line:ban-types
  }

  private static requestToProcessInBg = async (path: string, args: any[]) => {
    const response = await BrowserMsg.send.await.bg.bgExec({ path, args: BgExec.argObjUrlsCreate(args) });
    if (response.exception) {
      const e = new Error(`[BgExec] ${response.exception.name}: ${response.exception.message}`);
      e.stack += `\n\nBgExec stack:\n${response.exception.stack}`;
      throw e;
    }
    return response.result!;
  }

}
