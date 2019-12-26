import { AjaxErr, ApiErrResponse, AuthErr, GoogleAuthErr, StandardErrRes, StandardError } from './api-error-types.js';

import { BgNotReadyErr } from '../../browser/browser-msg.js';
import { Catch } from '../../platform/catch.js';
import { Xss } from '../../platform/xss.js';

export class ApiErr {
  public static eli5 = (e: any): string => {
    if (ApiErr.isMailOrAcctDisabledOrPolicy(e)) {
      return 'Email account is disabled, or access has been blocked by admin policy. Contact your email administrator.';
    } else if (ApiErr.isAuthPopupNeeded(e)) {
      return 'Browser needs to be re-connected to email account before proceeding.';
    } else if (ApiErr.isInsufficientPermission(e)) {
      return 'Server says user has insufficient permissions for this action.';
    } else if (ApiErr.isBlockedByProxy(e)) {
      return 'It seems that a company proxy or firewall is blocking internet traffic from this device.';
    } else if (ApiErr.isAuthErr(e)) {
      return 'Server says this request was unauthorized, possibly caused by missing or wrong login.';
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
    } else {
      return 'FlowCrypt encountered an error with unknown cause.';
    }
  }

  public static isStandardErr = (e: any, internalType: 'auth' | 'subscription'): boolean => {
    if (!e || !(typeof e === 'object')) {
      return false;
    }
    if (e instanceof ApiErrResponse && typeof e.res === 'object' && typeof e.res.error === 'object' && e.res.error.internal === internalType) {
      return true;
    }
    if ((e as StandardError).hasOwnProperty('internal') && !!((e as StandardError).message) && (e as StandardError).internal === internalType) {
      return true;
    }
    if ((e as StandardErrRes).error && typeof (e as StandardErrRes).error === 'object' && (e as StandardErrRes).error.internal === internalType) {
      return true;
    }
    return false;
  }

  public static isAuthErr = (e: any): boolean => {
    if (e instanceof AuthErr) {
      return true;
    }
    if (e && typeof e === 'object') {
      if (ApiErr.isStandardErr(e, 'auth')) {
        return true; // API auth error response
      }
      if (e instanceof AjaxErr && e.status === 401) {
        return true;
      }
    }
    return false;
  }

  public static isAuthPopupNeeded = (e: any): boolean => {
    if (e instanceof GoogleAuthErr) {
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
  }

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
  }

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
  }

  public static isNetErr = (e: any): boolean => {
    if (e instanceof TypeError && (e.message === 'Failed to fetch' || e.message === 'NetworkError when attempting to fetch resource.')) {
      return true; // openpgp.js uses fetch()... which produces these errors
    }
    if (e instanceof AjaxErr && (e.status === 0 && e.statusText === 'error' || e.statusText === 'timeout' || e.status === -1)) {
      return true;
    }
    if (e instanceof AjaxErr && e.status === 400 && typeof e.responseText === 'string' && e.responseText.indexOf('RequestTimeout') !== -1) {
      return true; // AWS: Your socket connection to the server was not read from or written to within the timeout period. Idle connections will be closed.
    }
    return false;
  }

  public static isSignificant = (e: any): boolean => {
    return !ApiErr.isNetErr(e) && !ApiErr.isServerErr(e) && !ApiErr.isNotFound(e) && !ApiErr.isMailOrAcctDisabledOrPolicy(e)
      && !ApiErr.isAuthErr(e) && !ApiErr.isBlockedByProxy(e) && !ApiErr.isAuthPopupNeeded(e);
  }

  public static isBadReq = (e: any): e is AjaxErr => {
    return e instanceof AjaxErr && e.status === 400;
  }
  public static isInsufficientPermission = (e: any): e is AjaxErr => {
    return e instanceof AjaxErr && e.status === 403 && e.responseText.indexOf('insufficientPermissions') !== -1;
  }

  public static isNotFound = (e: any): e is AjaxErr => {
    return e instanceof AjaxErr && e.status === 404;
  }

  public static isReqTooLarge = (e: any): boolean => {
    return e instanceof AjaxErr && e.status === 413;
  }

  public static isServerErr = (e: any): boolean => {
    return e instanceof AjaxErr && e.status >= 500;
  }

  public static detailsAsHtmlWithNewlines = (e: any): string => {
    let details = 'Below are technical details about the error. This may be useful for debugging.\n\n';
    details += `<b>Error string</b>: ${Xss.escape(String(e))}\n\n`;
    details += `<b>Error stack</b>: ${e instanceof Error ? Xss.escape((e.stack || '(empty)')) : '(no error stack)'}\n\n`;
    if (e instanceof AjaxErr) {
      details += `<b>Ajax response</b>:\n${Xss.escape(e.responseText)}\n<b>End of Ajax response</b>\n`;
    }
    return details;
  }

  public static isInPrivateMode = (e: any) => {
    return e instanceof Error && e.message.startsWith('BrowserMsg() (no status text): -1 when GET-ing blob:moz-extension://');
  }

  public static reportIfSignificant = (e: any) => {
    if (ApiErr.isSignificant(e)) {
      Catch.reportErr(e);
    }
  }

}
