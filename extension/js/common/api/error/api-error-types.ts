/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { Catch } from '../../platform/catch.js';
import { Str } from '../../core/common.js';

export interface StandardError {
  code: number | null;
  message: string;
  internal: string | null;
  data?: string;
  stack?: string;
}

export interface StandardErrRes {
  error: StandardError;
}

export interface RawAjaxErr {
  readyState: number;
  responseText?: string;
  status?: number;
  statusText?: string;
}

export abstract class AuthErr extends Error { }
export class GoogleAuthErr extends AuthErr { }
export class BackendAuthErr extends AuthErr { }

abstract class ApiCallErr extends Error {

  protected static describeApiAction = (req: JQueryAjaxSettings) => {
    const describeBody = typeof req.data === 'undefined' ? '(no body)' : typeof req.data;
    return `${req.method || 'GET'}-ing ${Catch.censoredUrl(req.url)} ${describeBody}: ${ApiCallErr.getPayloadStructure(req)}`;
  }

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
  }

}

export class ApiErrResponse extends ApiCallErr {

  public res: StandardErrRes;
  public url: string;

  constructor(res: StandardErrRes, req: JQueryAjaxSettings) {
    super(`Api error response when ${ApiCallErr.describeApiAction(req)}`);
    this.res = res;
    this.url = req.url || '(unknown url)';
    this.stack += `\n\nresponse:\n${Catch.stringify(res)}`;
  }

}

export class AjaxErrMsgs {
  public static GOOGLE_INVALID_TO_HEADER = 'Invalid to header';
  public static GOOGLE_RECIPIENT_ADDRESS_REQUIRED = 'Recipient address required';
}

export class AjaxErr extends ApiCallErr { // no static props, else will get serialised into err reports. Static methods ok

  public static fromXhr = (xhr: RawAjaxErr, req: JQueryAjaxSettings, stack: string) => {
    const responseText = xhr.responseText || '';
    const status = typeof xhr.status === 'number' ? xhr.status : -1;
    stack += `\n\nprovided ajax call stack:\n${stack}`;
    if (status === 400 || status === 403 || (status === 200 && responseText && responseText[0] !== '{')) {
      // RawAjaxErr with status 200 can happen when it fails to parse response - eg non-json result
      const redactedRes = AjaxErr.redactSensitiveData(responseText.substr(0, 1000));
      const redactedPayload = AjaxErr.redactSensitiveData(Catch.stringify(req.data).substr(0, 1000));
      stack += `\n\nresponseText(0, 1000):\n${redactedRes}\n\npayload(0, 1000):\n${redactedPayload}`;
    }
    const errMsg = AjaxErr.parseErrMsg(responseText, 'JSON[error][message] || JSON[message]');
    const message = `${String(xhr.statusText || '(no status text)')}: ${String(xhr.status || -1)} when ${ApiCallErr.describeApiAction(req)} -> ${errMsg}`;
    return new AjaxErr(message, stack, status, Catch.censoredUrl(req.url), responseText, xhr.statusText || '(no status text)', errMsg);
  }

  private static parseErrMsg = (responseText: string, format: 'JSON[error][message] || JSON[message]'): string | undefined => {
    if (format !== 'JSON[error][message] || JSON[message]') {
      return undefined;
    }
    let parsedRes: unknown;
    try {
      parsedRes = JSON.parse(responseText);
    } catch (e) {
      return undefined;
    }
    try { // JSON[error][message]
      const errMsg = ((parsedRes as any).error as any).message as string; // catching all errs below
      if (typeof errMsg === 'string') {
        return Str.truncate(errMsg, 300);
      }
    } catch (e) {
      // skip
    }
    try { // JSON[message]
      const errMsg = (parsedRes as any).message as string; // catching all errs below
      if (typeof errMsg === 'string') {
        return Str.truncate(errMsg, 300);
      }
    } catch (e) {
      // skip
    }
    return undefined;
  }

  private static redactSensitiveData = (str: string): string => {
    const lowered = str.toLowerCase();
    if (lowered.includes('private key') || lowered.includes('privatekey')) {
      return '<REDACTED:PRV>';
    }
    if (lowered.includes('idtoken') || lowered.includes('id_token')) {
      return '<REDACTED:IDTOKEN>';
    }
    return str;
  }

  constructor(
    message: string,
    public stack: string,
    public status: number,
    public url: string,
    public responseText: string,
    public statusText: string,
    public parsedErrMsg: string | undefined
  ) {
    super(message);
  }

}
