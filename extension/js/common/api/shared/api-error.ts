/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { BgNotReadyErr } from '../../browser/browser-msg.js';
import { Catch } from '../../platform/catch.js';
import { DecryptionError } from '../../core/crypto/pgp/msg-util.js';
import { Xss } from '../../platform/xss.js';
import { StoreFailedError } from '../../platform/store/abstract-store.js';
import { Str } from '../../core/common.js';

interface StandardErrRes { error: StandardError; }
interface StandardError { code: number | null; message: string; internal: string | null; data?: string; stack?: string; }

interface RawAjaxErr {
  readyState: number;
  responseText?: string;
  status?: number;
  statusText?: string;
}

abstract class AuthErr extends Error { }
export class GoogleAuthErr extends AuthErr { }
export class BackendAuthErr extends AuthErr { }

abstract class ApiCallErr extends Error {

  protected static describeApiAction = (req: JQueryAjaxSettings) => {
    const describeBody = typeof req.data === 'undefined' ? '(no body)' : typeof req.data;
    return `${req.method || 'GET'}-ing ${Catch.censoredUrl(req.url)} ${describeBody}: ${ApiCallErr.getPayloadStructure(req)}`;
  };

  private static getPayloadStructure = (req: JQueryAjaxSettings): string => {
    if (typeof req.data === 'string') {
      try {
        return Object.keys(JSON.parse(req.data) as any).join(',');
      } catch (e) {
        return 'not-a-json';
      }
    } else if (req.data && typeof req.data === 'object') {
      return Object.keys(req.data).join(',');
    }
    return '';
  };

}

export class AjaxErrMsgs {
  public static GOOGLE_INVALID_TO_HEADER = 'Invalid to header';
  public static GOOGLE_RECIPIENT_ADDRESS_REQUIRED = 'Recipient address required';
}

export class AjaxErr extends ApiCallErr { // no static props, else will get serialised into err reports. Static methods ok

  public static fromXhr = (xhr: RawAjaxErr, req: JQueryAjaxSettings, stack: string) => {
    const responseText = xhr.responseText || '';
    stack += `\n\nprovided ajax call stack:\n${stack}`;
    const { resMsg, resDetails, resCode } = AjaxErr.parseResErr(responseText);
    const status = resCode || (typeof xhr.status === 'number' ? xhr.status : -1);
    if (status === 400 || status === 403 || (status === 200 && responseText && responseText[0] !== '{')) {
      // RawAjaxErr with status 200 can happen when it fails to parse response - eg non-json result
      const redactedRes = AjaxErr.redactSensitiveData(responseText.substr(0, 1000));
      const redactedPayload = AjaxErr.redactSensitiveData(Catch.stringify(req.data).substr(0, 1000));
      stack += `\n\nresponseText(0, 1000):\n${redactedRes}\n\npayload(0, 1000):\n${redactedPayload}`;
    }
    const message = `${String(xhr.statusText || '(no status text)')}: ${String(xhr.status || -1)} when ${ApiCallErr.describeApiAction(req)} -> ${resMsg || '(no standard err msg)'}`;
    return new AjaxErr(
      message,
      stack,
      status,
      Catch.censoredUrl(req.url),
      responseText,
      xhr.statusText || '(no status text)',
      resMsg,
      resDetails
    );
  };

  private static parseResErr = (responseText: string): { resMsg?: string, resDetails?: string, resCode?: number } => {
    const returnable: { resMsg?: string, resDetails?: string, resCode?: number } = {};
    let parsedRes: unknown;
    try {
      parsedRes = JSON.parse(responseText);
    } catch (e) {
      return {};
    }
    try { // JSON[error][message,code,internal]
      const resMsg = ((parsedRes as any).error as any).message as string; // catching all errs below
      if (typeof resMsg === 'string') {
        returnable.resMsg = Str.truncate(resMsg, 300);
      }
      const resDetails = ((parsedRes as any).error as any).internal as string; // catching all errs below
      if (typeof resDetails === 'string') {
        returnable.resDetails = Str.truncate(resDetails, 300);
      }
      const resCode = ((parsedRes as any).error as any).code as number; // catching all errs below
      if (typeof resCode === 'number') {
        returnable.resCode = resCode;
      }
    } catch (e) {
      // skip
    }
    try { // JSON[message,code,details]
      const resMsg = (parsedRes as any).message as string; // catching all errs below
      if (typeof resMsg === 'string') {
        returnable.resMsg = Str.truncate(resMsg, 300);
      }
      const resDetails = (parsedRes as any).details as string; // catching all errs below
      if (typeof resDetails === 'string') {
        returnable.resDetails = Str.truncate(resDetails, 300);
      }
      const resCode = (parsedRes as any).code as number; // catching all errs below
      if (typeof resCode === 'number') {
        returnable.resCode = resCode;
      }
    } catch (e) {
      // skip
    }
    return returnable;
  };

  private static redactSensitiveData = (str: string): string => {
    const lowered = str.toLowerCase();
    if (lowered.includes('private key') || lowered.includes('privatekey')) {
      return '<REDACTED:PRV>';
    }
    if (lowered.includes('idtoken') || lowered.includes('id_token')) {
      return '<REDACTED:IDTOKEN>';
    }
    return str;
  };

  constructor(
    message: string,
    public stack: string,
    public status: number,
    public url: string,
    public responseText: string,
    public statusText: string,
    public resMsg: string | undefined,
    public resDetails: string | undefined,
  ) {
    super(message);
  }

}

export class ApiErr {
  public static eli5 = (e: any): string => { // "explain like I'm five"
    if (ApiErr.isMailOrAcctDisabledOrPolicy(e)) {
      return 'Email account is disabled, or access has been blocked by admin policy. Contact your email administrator.';
    } else if (ApiErr.isAuthErr(e)) {
      return 'Browser needs to be re-connected to your account before proceeding.';
    } else if (ApiErr.isInsufficientPermission(e)) {
      return 'Server says user has insufficient permissions for this action.';
    } else if (ApiErr.isBlockedByProxy(e)) {
      return 'It seems that a company proxy or firewall is blocking internet traffic from this device.';
    } else if (ApiErr.isReqTooLarge(e)) {
      return 'Server says this request is too large.';
    } else if (ApiErr.isNotFound(e)) {
      return 'Server says this resource was not found';
    } else if (ApiErr.isBadReq(e)) {
      return 'Server says this was a bad request (possibly a FlowCrypt bug)';
    } else if (ApiErr.isNetErr(e)) {
      return 'Network connection issue.';
    } else if (ApiErr.isServerErr(e)) {
      return 'Server responded with an unexpected error.';
    } else if (e instanceof AjaxErr) {
      return 'AjaxErr with unknown cause.';
    } else if (e instanceof BgNotReadyErr) {
      return 'Extension not ready. Restarting the browser should help.';
    } else if (e instanceof StoreFailedError) {
      return 'Failed to access browser extension storage. Restarting the browser should help.';
    } else {
      return 'FlowCrypt encountered an error with unknown cause.';
    }
  };

  public static isStandardErr = (e: any, internalType: 'auth' | 'subscription'): boolean => {
    if (!e || !(typeof e === 'object')) {
      return false;
    }
    if (e instanceof AjaxErr && e.resDetails === internalType) {
      return true;
    }
    if ((e as StandardError).hasOwnProperty('internal') && !!((e as StandardError).message) && (e as StandardError).internal === internalType) {
      return true;
    }
    if ((e as StandardErrRes).error && typeof (e as StandardErrRes).error === 'object' && (e as StandardErrRes).error.internal === internalType) {
      return true;
    }
    return false;
  };

  public static isAuthErr = (e: any): boolean => {
    if (e instanceof AuthErr || e instanceof GoogleAuthErr) {
      return true;
    }
    if (ApiErr.isStandardErr(e, 'auth')) {
      return true; // API auth error response
    }
    if (e instanceof AjaxErr && e.status === 401) {
      return true;
    }
    if (e instanceof AjaxErr && e.status === 400 && typeof e.responseText === 'string') {
      try {
        const json = JSON.parse(e.responseText);
        if (json && (json as any).error === 'invalid_grant') {
          const jsonErrorDesc = (json as any).error_description;
          return jsonErrorDesc === 'Bad Request' || jsonErrorDesc === 'Token has been expired or revoked.';
        }
      } catch (e) {
        return false;
      }
    }
    return false;
  };

  public static isMailOrAcctDisabledOrPolicy = (e: any): boolean => {
    if (e instanceof AjaxErr && ApiErr.isBadReq(e) && typeof e.responseText === 'string') {
      if (e.responseText.indexOf('Mail service not enabled') !== -1 || e.responseText.indexOf('Account has been deleted') !== -1) {
        return true;
      }
      if (e.responseText.indexOf('This application is currently blocked') !== -1 || e.responseText.indexOf('account data is restricted by policies') !== -1) {
        return true; // could correctly be a separate type, but it's quite rare
      }
    }
    return false;
  };

  public static isBlockedByProxy = (e: any): boolean => {
    if (!(e instanceof AjaxErr)) {
      return false;
    }
    if (e.status === 200 || e.status === 403) {
      if (/(site|content|script|internet|web) (is|has been|was|access|filter) (restricted|blocked|disabled|denied|violat)/i.test(e.responseText)) {
        return true;
      }
      if (/access to the requested site|internet security by|blockedgateway/.test(e.responseText)) {
        return true;
      }
    }
    return false;
  };

  public static isNetErr = (e: any): e is Error => {
    if (e instanceof TypeError && (e.message === 'Failed to fetch' || e.message === 'NetworkError when attempting to fetch resource.')) {
      return true; // openpgp.js uses fetch()... which produces these errors
    }
    if (e instanceof AjaxErr && e.status === 0 && (e.statusText === 'error' || e.statusText === '(no status text)')) {
      return true;
    }
    if (e instanceof AjaxErr && (e.statusText === 'timeout' || e.status === -1)) {
      return true;
    }
    if (e instanceof AjaxErr && e.status === 400 && typeof e.responseText === 'string' && e.responseText.indexOf('RequestTimeout') !== -1) {
      return true; // AWS: Your socket connection to the server was not read from or written to within the timeout period. Idle connections will be closed.
    }
    return false;
  };

  public static isDecryptErr = (e: any): e is DecryptionError => {
    if (e instanceof DecryptionError) {
      return true;
    }
    return false;
  };

  public static isSignificant = (e: any): boolean => {
    return !ApiErr.isNetErr(e) && !ApiErr.isServerErr(e) && !ApiErr.isNotFound(e) && !ApiErr.isMailOrAcctDisabledOrPolicy(e)
      && !ApiErr.isAuthErr(e) && !ApiErr.isBlockedByProxy(e);
  };

  public static isBadReq = (e: any): e is AjaxErr => {
    return e instanceof AjaxErr && e.status === 400;
  };
  public static isInsufficientPermission = (e: any): e is AjaxErr => {
    return e instanceof AjaxErr && e.status === 403 && e.responseText.indexOf('insufficientPermissions') !== -1;
  };

  public static isNotFound = (e: any): e is AjaxErr => {
    return e instanceof AjaxErr && e.status === 404;
  };

  public static isReqTooLarge = (e: any): boolean => {
    return e instanceof AjaxErr && e.status === 413;
  };

  public static isServerErr = (e: any): boolean => {
    return e instanceof AjaxErr && e.status >= 500;
  };

  public static detailsAsHtmlWithNewlines = (e: any): string => {
    let details = 'Below are technical details about the error. This may be useful for debugging.\n\n';
    details += `<b>Error string</b>: ${Xss.escape(String(e))}\n\n`;
    details += `<b>Error stack</b>: ${e instanceof Error ? Xss.escape((e.stack || '(empty)')) : '(no error stack)'}\n\n`;
    if (e instanceof AjaxErr) {
      details += `<b>Ajax response</b>:\n${Xss.escape(e.responseText)}\n<b>End of Ajax response</b>\n`;
    }
    return details;
  };

  public static isInPrivateMode = (e: any) => {
    return e instanceof Error && e.message.startsWith('BrowserMsg() (no status text): -1 when GET-ing blob:moz-extension://');
  };

  public static reportIfSignificant = (e: any) => {
    if (ApiErr.isSignificant(e)) {
      Catch.reportErr(e);
    }
  };

}
