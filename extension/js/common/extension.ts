
import { Str, Catch, Env, Value, Dict } from './common.js';
import { Pgp, DiagnoseMsgPubkeysResult, DecryptResult, MsgVerifyResult } from './pgp.js';

import { FlatTypes } from './store.js';
import { Ui } from './browser.js';
import { Att } from './att.js';

type Codec = {encode: (text: string, mode: 'fatal'|'html') => string, decode: (text: string) => string, labels: string[], version: string};

type PossibleBgExecResults = DecryptResult|DiagnoseMsgPubkeysResult|MsgVerifyResult|string;
type BgExecRequest = {path: string, args: any[]};
type BgExecResponse = {result?: PossibleBgExecResults, exception?: {name: string, message: string, stack: string}};
type BrowserMsgReq = null|Dict<any>;
type BrowserMsgRes = any|Dict<any>;

export type AnyThirdPartyLibrary = any;
export type BrowserMsgReqtDb = {f: string, args: any[]};
export type BrowserMsgReqSessionSet = {account_email: string, key: string, value: string|undefined};
export type BrowserMsgReqSessionGet = {account_email: string, key: string};
export type BrowserMsgHandler = (request: BrowserMsgReq, sender: chrome.runtime.MessageSender|'background', respond: (r?: any) => void) => void|Promise<void>;

export interface BrowserWidnow extends Window {
  XMLHttpRequest: any;
  onunhandledrejection: (e: any) => void;
  'emailjs-mime-codec': AnyThirdPartyLibrary;
  'emailjs-mime-parser': AnyThirdPartyLibrary;
  'emailjs-mime-builder': AnyThirdPartyLibrary;
  'emailjs-addressparser': {
    parse: (raw: string) => {name: string, address: string}[];
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
  account_email_global: null|string; // used by background script
  same_world_global: true; // used by background_script
  destruction_event: string;
  destroyable_class: string;
  reloadable_class: string;
  destroyable_intervals: number[];
  destroyable_timeouts: number[];
  destroy: () => void;
  vacant: () => boolean;
}
export interface FlowCryptManifest extends chrome.runtime.Manifest {
  oauth2: {client_id:string, url_code:string, url_tokens:string, url_redirect:string, state_header:string, scopes:string[] };
}

export class TabIdRequiredError extends Error {}

export class Extension { // todo - move extension-specific common.js code here

  public static prepare_bug_report = (name: string, details?: Dict<FlatTypes>, error?: Error|any): string => {
    let bug_report: Dict<string> = {
      name,
      stack: Catch.stack_trace(),
    };
    try {
      bug_report.error = JSON.stringify(error, null, 2);
    } catch(e) {
      bug_report.error_as_string = String(error);
      bug_report.error_serialization_error = String(e);
    }
    try {
      bug_report.details = JSON.stringify(details, null, 2);
    } catch(e) {
      bug_report.details_as_string = String(details);
      bug_report.details_serialization_error = String(e);
    }
    let result = '';
    for(let k of Object.keys(bug_report)) {
      result += `\n[${k}]\n${bug_report[k]}\n`;
    }
    return result;
  }

}

export class BrowserMsg {

  public static MAX_SIZE = 1024 * 1024; // 1MB
  private static HANDLERS_REGISTERED_BACKGROUND: Dict<BrowserMsgHandler>|null = null;
  private static HANDLERS_REGISTERED_FRAME: Dict<BrowserMsgHandler> = {};
  private static HANDLERS_STANDARD = {
    set_css: (data: {css: Dict<string|number>, selector: string, traverse_up?: number}) => {
      let element = $(data.selector);
      let traverse_up_levels = data.traverse_up as number || 0;
      for (let i = 0; i < traverse_up_levels; i++) {
        element = element.parent();
      }
      element.css(data.css);
    },
  } as Dict<BrowserMsgHandler>;

  public static send = (destination_string: string|null, name: string, data: Dict<any>|null=null) => {
    BrowserMsg.sendAwait(destination_string, name, data).catch(Catch.rejection);
  }

  public static sendAwait = (destination_string: string|null, name: string, data: Dict<any>|null=null): Promise<BrowserMsgRes> => new Promise(resolve => {
    let msg = { name, data, to: destination_string || null, uid: Str.random(10), stack: Catch.stack_trace() };
    let try_resolve_no_undefined = (r?: BrowserMsgRes) => Catch.try(() => resolve(typeof r === 'undefined' ? {} : r))();
    let is_background_page = Env.isBackgroundPage();
    if (typeof  destination_string === 'undefined') { // don't know where to send the message
      Catch.log('BrowserMsg.send to:undefined');
      try_resolve_no_undefined();
    } else if (is_background_page && BrowserMsg.HANDLERS_REGISTERED_BACKGROUND && msg.to === null) {
      BrowserMsg.HANDLERS_REGISTERED_BACKGROUND[msg.name](msg.data, 'background', try_resolve_no_undefined); // calling from background script to background script: skip messaging completely
    } else if (is_background_page) {
      chrome.tabs.sendMessage(BrowserMsg.browser_msg_dest_parse(msg.to).tab!, msg, {}, try_resolve_no_undefined);
    } else {
      chrome.runtime.sendMessage(msg, try_resolve_no_undefined);
    }
  })

  public static tab_id = async (): Promise<string|null|undefined> => {
    let r = await BrowserMsg.sendAwait(null, '_tab_', null);
    if(typeof r === 'string' || typeof r === 'undefined' || r === null) {
      return r; // for compatibility reasons when upgrading from 5.7.2 - can be removed later
    } else {
      return r.tab_id; // new format
    }
  }

  public static required_tab_id = async (): Promise<string> => {
    let tab_id;
    for(let i = 0; i < 10; i++) { // up to 10 attempts. Sometimes returns undefined right after browser start
      tab_id = await BrowserMsg.tab_id();
      if(tab_id) {
        return tab_id;
      }
      await Ui.time.sleep(200); // sleep 200ms between attempts
    }
    throw new TabIdRequiredError(`Tab id is required, but received '${String(tab_id)}' after 10 attempts`);
  }

  public static listen = (handlers: Dict<BrowserMsgHandler>, listen_for_tab_id='all') => {
    for (let name of Object.keys(handlers)) {
      // newly registered handlers with the same name will overwrite the old ones if BrowserMsg.listen is declared twice for the same frame
      // original handlers not mentioned in newly set handlers will continue to work
      BrowserMsg.HANDLERS_REGISTERED_FRAME[name] = handlers[name];
    }
    for (let name of Object.keys(BrowserMsg.HANDLERS_STANDARD)) {
      if (typeof BrowserMsg.HANDLERS_REGISTERED_FRAME[name] !== 'function') {
        BrowserMsg.HANDLERS_REGISTERED_FRAME[name] = BrowserMsg.HANDLERS_STANDARD[name]; // standard handlers are only added if not already set above
      }
    }
    let processed:string[] = [];
    chrome.runtime.onMessage.addListener((msg, sender, respond) => {
      try {
        if (msg.to === listen_for_tab_id || msg.to === 'broadcast') {
          if (!Value.is(msg.uid).in(processed)) {
            processed.push(msg.uid);
            if (typeof BrowserMsg.HANDLERS_REGISTERED_FRAME[msg.name] !== 'undefined') {
              let r = BrowserMsg.HANDLERS_REGISTERED_FRAME[msg.name](msg.data, sender, respond);
              if(r && typeof r === 'object' && (r as Promise<void>).then && (r as Promise<void>).catch) {
                // todo - a way to callback the error to be re-thrown to caller stack
                (r as Promise<void>).catch(Catch.rejection);
              }
            } else if (msg.name !== '_tab_' && msg.to !== 'broadcast') {
              if (BrowserMsg.browser_msg_dest_parse(msg.to).frame !== null) { // only consider it an error if frameId was set because of firefox bug: https://bugzilla.mozilla.org/show_bug.cgi?id=1354337
                Catch.report('BrowserMsg.listen error: handler "' + msg.name + '" not set', 'Message sender stack:\n' + msg.stack);
              } else { // once firefox fixes the bug, it will behave the same as Chrome and the following will never happen.
                console.log('BrowserMsg.listen ignoring missing handler "' + msg.name + '" due to Firefox Bug');
              }
            }
          }
        }
        return !!respond; // indicate that this listener intends to respond
      } catch(e) {
        // todo - a way to callback the error to be re-thrown to caller stack
        Catch.handle_exception(e);
      }
    });
  }

  public static listen_background = (handlers: Dict<BrowserMsgHandler>) => {
    if (!BrowserMsg.HANDLERS_REGISTERED_BACKGROUND) {
      BrowserMsg.HANDLERS_REGISTERED_BACKGROUND = handlers;
    } else {
      for (let name of Object.keys(handlers)) {
        BrowserMsg.HANDLERS_REGISTERED_BACKGROUND[name] = handlers[name];
      }
    }
    chrome.runtime.onMessage.addListener((msg, sender, respond) => {
      try {
        let safe_respond = (response: any) => {
          try { // avoiding unnecessary errors when target tab gets closed
            respond(response);
          } catch (e) {
            // todo - the sender should still know - could have PageClosedError
            if (e.message !== 'Attempting to use a disconnected port object') {
              Catch.handle_exception(e);
              throw e;
            }
          }
        };
        if (msg.to && msg.to !== 'broadcast') {
          msg.sender = sender;
          chrome.tabs.sendMessage(BrowserMsg.browser_msg_dest_parse(msg.to).tab!, msg, {}, safe_respond);
        } else if (Value.is(msg.name).in(Object.keys(BrowserMsg.HANDLERS_REGISTERED_BACKGROUND!))) { // is !null because added above
          let r = BrowserMsg.HANDLERS_REGISTERED_BACKGROUND![msg.name](msg.data, sender, safe_respond); // is !null because checked above
          if(r && typeof r === 'object' && (r as Promise<void>).then && (r as Promise<void>).catch) {
            // todo - a way to callback the error to be re-thrown to caller stack
            (r as Promise<void>).catch(Catch.rejection);
          }
        } else if (msg.to !== 'broadcast') {
          Catch.report('BrowserMsg.listen_background error: handler "' + msg.name + '" not set', 'Message sender stack:\n' + msg.stack);
        }
        return !!respond; // indicate that we intend to respond later
      } catch (e) {
        // todo - a way to callback the error to be re-thrown to caller stack
        Catch.handle_exception(e);
      }
    });
  }

  private static browser_msg_dest_parse = (destination_string: string|null) => {
    let parsed = { tab: null as null|number, frame: null as null|number };
    if (destination_string) {
      parsed.tab = Number(destination_string.split(':')[0]);
      // @ts-ignore - adding nonsense into isNaN
      parsed.frame = !isNaN(destination_string.split(':')[1]) ? Number(destination_string.split(':')[1]) : null;
    }
    return parsed;
  }

}

export class BgExec {

  private static MAX_MESSAGE_SIZE = 1024 * 1024;

  public static background_request_handler: BrowserMsgHandler = async (message: BgExecRequest, sender, respond: (r: BgExecResponse) => void) => {
    try {
      let arg_promises = BgExec.arg_object_urls_consume(message.args);
      let args = await Promise.all(arg_promises);
      let result = await BgExec.execute_and_format_result(message.path, args);
      respond({result});
    } catch(e) {
      try {
        respond({
          exception: {
            name: e.constructor.name,
            message: e.message,
            stack: (e.stack || '') + ((e as any).workerStack ? `\n\nWorker stack:\n${(e as any).workerStack}`: ''),
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

  public static diagnose_msg_pubkeys = (account_email: string, message: string) => {
    return BgExec.request_to_process_in_background('Pgp.msg.diagnose_pubkeys', [account_email, message]) as Promise<DiagnoseMsgPubkeysResult>;
  }

  public static crypto_hash_challenge_answer = (password: string) => {
    return BgExec.request_to_process_in_background('Pgp.hash.challenge_answer', [password]) as Promise<string>;
  }

  public static crypto_msg_decrypt = async (account_email: string, encrypted_data: string|Uint8Array, msg_pwd:string|null=null, get_uint8=false) => {
    let result = await BgExec.request_to_process_in_background('Pgp.msg.decrypt', [account_email, encrypted_data, msg_pwd, get_uint8]) as DecryptResult;
    if (result.success && result.content && result.content.blob && result.content.blob.blob_url.indexOf(`blob:${chrome.runtime.getURL('')}`) === 0) {
      if(result.content.blob.blob_type === 'text') {
        result.content.text = Str.from_uint8(await Att.methods.object_url_consume(result.content.blob.blob_url));
      } else {
        result.content.uint8 = await Att.methods.object_url_consume(result.content.blob.blob_url);
      }
      result.content.blob = undefined;
    }
    return result;
  }

  public static crypto_msg_verify_detached = (account_email: string, message: string|Uint8Array, signature: string|Uint8Array) => {
    return BgExec.request_to_process_in_background('Pgp.msg.verify_detached', [account_email, message, signature]) as Promise<MsgVerifyResult>;
  }

  private static execute_and_format_result = async (path: string, resolved_args: any[]): Promise<PossibleBgExecResults> => {
    let f = BgExec.resolve_path_to_callable_function(path);
    let returned: Promise<PossibleBgExecResults>|PossibleBgExecResults = f.apply(null, resolved_args);
    if (returned && typeof returned === 'object' && typeof (returned as Promise<PossibleBgExecResults>).then === 'function') { // got a promise
      let resolved = await returned;
      if (path === 'Pgp.msg.decrypt') {
        BgExec.crypto_msg_decrypt_result_create_blobs(resolved as DecryptResult);
      }
      return resolved;
    }
    return returned as PossibleBgExecResults; // direct result
  }

  private static crypto_msg_decrypt_result_create_blobs = (decrypt_res: DecryptResult) => {
    if (decrypt_res && decrypt_res.success && decrypt_res.content) {
      if(decrypt_res.content.text && decrypt_res.content.text.length >= BgExec.MAX_MESSAGE_SIZE) {
        decrypt_res.content.blob = {blob_type: 'text', blob_url: Att.methods.object_url_create(decrypt_res.content.text)};
        decrypt_res.content.text = undefined; // replaced with a blob
      } else if(decrypt_res.content.uint8 && decrypt_res.content.uint8 instanceof Uint8Array) {
        decrypt_res.content.blob = {blob_type: 'uint8', blob_url: Att.methods.object_url_create(decrypt_res.content.uint8)};
        decrypt_res.content.uint8 = undefined; // replaced with a blob
      }
    }
  }

  private static is_object_url = (arg: any) => typeof arg === 'string' && arg.indexOf('blob:' + chrome.runtime.getURL('')) === 0;

  private static should_be_object_url = (arg: any) => (typeof arg === 'string' && arg.length > BrowserMsg.MAX_SIZE) || arg instanceof Uint8Array;

  private static arg_object_urls_consume = (args: any[]) => args.map((arg: any) => BgExec.is_object_url(arg) ? Att.methods.object_url_consume(arg) : arg);

  private static arg_object_urls_create = (args: any[]) => args.map(arg => BgExec.should_be_object_url(arg) ? Att.methods.object_url_create(arg) : arg);

  private static resolve_path_to_callable_function = (path: string): Function => {  // tslint:disable-line:ban-types
    let f:Function|object|null = null; // tslint:disable-line:ban-types
    for (let step of path.split('.')) {
      if (f === null) {
        if(step === 'Pgp') {
          f = Pgp;
        } else {
          throw new Error(`BgExec: Not prepared for relaying class ${step}`);
        }
      } else {
        // @ts-ignore
        f = f[step];
      }
    }
    return f as Function; // tslint:disable-line:ban-types
  }

  private static request_to_process_in_background = async (path: string, args: any[]) => {
    let response: BgExecResponse = await BrowserMsg.sendAwait(null, 'bg_exec', {path, args: BgExec.arg_object_urls_create(args)});
    if(response.exception) {
      let e = new Error(`[BgExec] ${response.exception.name}: ${response.exception.message}`);
      e.stack += `\n\nBgExec stack:\n${response.exception.stack}`;
      throw e;
    }
    return response.result!;
  }

}
