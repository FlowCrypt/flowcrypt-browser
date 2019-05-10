/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

// tslint:disable:no-direct-ajax

import { Store, GlobalStore, Serializable, Subscription } from '../platform/store.js';
import { Value, Str, Dict } from '../core/common.js';
import { Pgp, Contact } from '../core/pgp.js';
import { Ui, Xss, Env } from '../browser.js';
import { Att } from '../core/att.js';
import { SendableMsgBody } from '../core/mime.js';
import { PaymentMethod } from '../account.js';
import { Catch } from '../platform/catch.js';
import { Buf } from '../core/buf.js';
import { BrowserMsg } from '../extension.js';

type StandardError = { code: number | null; message: string; internal: string | null; data?: string; stack?: string; };
type StandardErrorRes = { error: StandardError };
type FcAuthToken = { account: string, token: string };
type FcAuthMethods = 'uuid' | FcAuthToken | null;
type SubscriptionLevel = 'pro' | null;
type ReqFmt = 'JSON' | 'FORM';
type ResFmt = 'json';
export type ReqMethod = 'POST' | 'GET' | 'DELETE' | 'PUT';
export type ProviderContactsResults = { new: Contact[], all: Contact[] };
type RawAjaxError = {
  // getAllResponseHeaders?: () => any,
  // getResponseHeader?: (e: string) => any,
  readyState: number,
  responseText?: string,
  status?: number,
  statusText?: string,
};

export type ChunkedCb = (r: ProviderContactsResults) => void;
export type ProgressCb = (percent?: number, loaded?: number, total?: number) => void;
export type ProgressCbs = { upload?: ProgressCb | null, download?: ProgressCb | null };
export type ProviderContactsQuery = { substring: string };
export type SendableMsg = { headers: Dict<string>; from: string; to: string[]; subject: string; body: SendableMsgBody; atts: Att[]; thread?: string; };
export type SubscriptionInfo = { active?: boolean | null; method?: PaymentMethod | null; level?: SubscriptionLevel; expire?: string | null; expired?: boolean };
export type PubkeySearchResult = { pubkey: string | null; has_cryptup: boolean | null; };
export type AwsS3UploadItem = { baseUrl: string, fields: { key: string; file?: Att }, att: Att };

abstract class ApiCallError extends Error {

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

  protected static censoredUrl = (url: string | undefined): string => {
    if (!url) {
      return '(unknown url)';
    }
    if (url.indexOf('refreshToken=') !== -1) {
      return `${url.split('?')[0]}~censored:refreshToken`;
    }
    if (url.indexOf('token=') !== -1) {
      return `${url.split('?')[0]}~censored:token`;
    }
    if (url.indexOf('code=') !== -1) {
      return `${url.split('?')[0]}~censored:code`;
    }
    return url;
  }

  protected static describeApiAction = (req: JQueryAjaxSettings) => {
    const describeBody = typeof req.data === 'undefined' ? '(no body)' : typeof req.data;
    return `${req.method || 'GET'}-ing ${ApiCallError.censoredUrl(req.url)} ${describeBody}: ${ApiCallError.getPayloadStructure(req)}`;
  }

}

export class AjaxError extends ApiCallError {

  // todo - move these out of the class, they get weirdly serialized in err reports
  public STD_ERR_MSGS = { // tslint:disable-line:oneliner-object-literal
    GOOGLE_INVALID_TO_HEADER: 'Invalid to header',
    GOOGLE_RECIPIENT_ADDRESS_REQUIRED: 'Recipient address required',
  };

  public static fromXhr = (xhr: RawAjaxError, req: JQueryAjaxSettings, stack: string) => {
    const responseText = xhr.responseText || '';
    const status = typeof xhr.status === 'number' ? xhr.status : -1;
    stack += `\n\nprovided ajax call stack:\n${stack}`;
    if (status === 400 || status === 403 || (status === 200 && responseText && responseText[0] !== '{')) {
      // RawAjaxError with status 200 can happen when it fails to parse response - eg non-json result
      stack += `\n\nresponseText(0, 1000):\n${responseText.substr(0, 1000)}\n\npayload(0, 1000):\n${Catch.stringify(req.data).substr(0, 1000)}`;
    }
    const message = `${String(xhr.statusText || '(no status text)')}: ${String(xhr.status || -1)} when ${ApiCallError.describeApiAction(req)}`;
    return new AjaxError(message, stack, status, AjaxError.censoredUrl(req.url), responseText, xhr.statusText || '(no status text)');
  }

  constructor(message: string, public stack: string, public status: number, public url: string, public responseText: string, public statusText: string) {
    super(message);
  }

  public parseErrResMsg = (format: 'google') => {
    try {
      if (format === 'google') {
        const errMsg = ((JSON.parse(this.responseText) as any).error as any).message as string; // catching all errs below
        if (typeof errMsg === 'string') {
          return errMsg;
        }
      }
    } catch (e) {
      return undefined;
    }
    return undefined;
  }

}

export class ApiErrorResponse extends ApiCallError {

  public res: StandardErrorRes;
  public url: string;

  constructor(res: StandardErrorRes, req: JQueryAjaxSettings) {
    super(`Api error response when ${ApiCallError.describeApiAction(req)}`);
    this.res = res;
    this.url = req.url || '(unknown url)';
    this.stack += `\n\nresponse:\n${Catch.stringify(res)}`;
  }

}

export class AuthError extends Error { }

export namespace R { // responses

  export type FcHelpFeedback = { sent: boolean };
  export type FcAccountLogin = { registered: boolean, verified: boolean, subscription: SubscriptionInfo };
  export type FcAccountUpdate$result = { alias: string, email: string, intro: string, name: string, photo: string, default_message_expire: number };
  export type FcAccountUpdate = { result: FcAccountUpdate$result, updated: boolean };
  export type FcAccountSubscribe = { subscription: SubscriptionInfo };
  export type FcAccountCheck = { email: string | null, subscription: SubscriptionInfo | null };
  export type FcBlogPost = { title: string, date: string, url: string };

  export type FcMsgPresignFiles = { approvals: { base_url: string, fields: { key: string } }[] };
  export type FcMsgConfirmFiles = { confirmed: string[], admin_codes: string[] };
  export type FcMsgToken = { token: string };
  export type FcMsgUpload = { short: string, admin_code: string };
  export type FcLinkMsg = { expire: string, deleted: boolean, url: string, expired: boolean };
  export type FcLinkMe$profile = {
    alias: string | null, name: string | null, photo: string | null, intro: string | null, web: string | null,
    phone: string | null, token: string | null, subscription_level: string | null, subscription_method: string | null, email: string | null
  };
  export type FcLinkMe = { profile: null | FcLinkMe$profile };
  export type ApirFcMsgExpiration = { updated: boolean };

  export type AttTestWelcome = { sent: boolean };
  export type AttInitialLegacySugmit = { saved: boolean };
  export type AttKeyserverDiagnosis = { hasPubkeyMissing: boolean, hasPubkeyMismatch: boolean, results: Dict<{ pubkey?: string, match: boolean }> };

  export type GmailUsersMeProfile = { emailAddress: string, historyId: string, messagesTotal: number, threadsTotal: string };
  export type GmailMsg$header = { name: string, value: string };
  export type GmailMsg$payload$body = { attachmentId: string, size: number, data?: string };
  export type GmailMsg$payload$part = { body?: GmailMsg$payload$body, filename?: string, mimeType?: string, headers?: GmailMsg$header[] };
  export type GmailMsg$payload = { parts?: GmailMsg$payload$part[], headers?: GmailMsg$header[], mimeType?: string, body?: GmailMsg$payload$body };
  export type GmailMsg$labelId = 'INBOX' | 'UNREAD' | 'CATEGORY_PERSONAL' | 'IMPORTANT' | 'SENT' | 'CATEGORY_UPDATES';
  export type GmailMsg = {
    id: string; historyId: string; threadId?: string | null; payload: GmailMsg$payload; internalDate?: number | string;
    labelIds?: GmailMsg$labelId[]; snippet?: string; raw?: string;
  };
  export type GmailMsgList$message = { id: string, threadId: string };
  export type GmailMsgList = { messages?: GmailMsgList$message[], resultSizeEstimate: number };
  export type GmailLabels$label = {
    id: string, name: string, messageListVisibility: 'show' | 'hide', labelListVisibility: 'labelShow' | 'labelHide', type: 'user' | 'system',
    messagesTotal?: number, messagesUnread?: number, threadsTotal?: number, threadsUnread?: number, color?: { textColor: string, backgroundColor: string }
  };
  export type GmailLabels = { labels: GmailLabels$label[] };
  export type GmailAtt = { attachmentId: string, size: number, data: Buf };
  export type GmailMsgSend = { id: string };
  export type GmailThread = { id: string, historyId: string, messages: GmailMsg[] };
  export type GmailThreadList = { threads: { historyId: string, id: string, snippet: string }[], nextPageToken: string, resultSizeEstimate: number };
  export type GmailDraftCreate = { id: string };
  export type GmailDraftDelete = {};
  export type GmailDraftUpdate = {};
  export type GmailDraftGet = { id: string, message: GmailMsg };
  export type GmailDraftSend = {};
  export type GmailAliases = { sendAs: GmailAliases$sendAs[] };
  type GmailAliases$sendAs = { sendAsEmail: string, displayName: string, replyToAddress: string, signature: string, isDefault: boolean, treatAsAlias: boolean, verificationStatus: string };

  export type OpenId = { // 'name' is the full name, picture is url
    at_hash: string; exp: number; iat: number; sub: string; aud: string; azp: string; iss: "https://accounts.google.com";
    name: string; picture: string; locale: 'en' | string; family_name: string; given_name: string;
  };

}

export class Api {

  public static err = {
    eli5: (e: any) => {
      if (Api.err.isMailOrAcctDisabled(e)) {
        return 'Email account is disabled';
      } else if (Api.err.isAuthPopupNeeded(e)) {
        return 'Browser needs to be re-connected to email account before proceeding.';
      } else if (Api.err.isInsufficientPermission(e)) {
        return 'Server says user has insufficient permissions for this action.';
      } else if (Api.err.isBlockedByProxy(e)) {
        return 'It seems that a company proxy or firewall is blocking internet traffic from this device.';
      } else if (Api.err.isAuthErr(e)) {
        return 'Server says this request was unauthorized, possibly caused by missing or wrong login.';
      } else if (Api.err.isReqTooLarge(e)) {
        return 'Server says this request is too large.';
      } else if (Api.err.isNotFound(e)) {
        return 'Server says this resource was not found';
      } else if (Api.err.isBadReq(e)) {
        return 'Server says this was a bad request (possibly a FlowCrypt bug)';
      } else if (Api.err.isNetErr(e)) {
        return 'Network connection issue.';
      } else if (Api.err.isServerErr(e)) {
        return 'Server responded with an unexpected error.';
      } else if (e instanceof AjaxError) {
        return 'AjaxError with unknown cause.';
      } else {
        return 'FlowCrypt encountered an error with unknown cause.';
      }
    },
    detailsAsHtmlWithNewlines: (e: any) => {
      let details = 'Below are technical details about the error. This may be useful for debugging.\n\n';
      details += `<b>Error string</b>: ${Xss.escape(String(e))}\n\n`;
      details += `<b>Error stack</b>: ${e instanceof Error ? Xss.escape((e.stack || '(empty)')) : '(no error stack)'}\n\n`;
      if (e instanceof AjaxError) {
        details += `<b>Ajax response</b>:\n${Xss.escape(e.responseText)}\n<b>End of Ajax response</b>\n`;
      }
      return details;
    },
    isNetErr: (e: any) => {
      if (e instanceof TypeError && (e.message === 'Failed to fetch' || e.message === 'NetworkError when attempting to fetch resource.')) {
        return true; // openpgp.js uses fetch()... which produces these errors
      }
      if (e instanceof AjaxError && (e.status === 0 && e.statusText === 'error' || e.statusText === 'timeout' || e.status === -1)) {
        return true;
      }
      if (e instanceof AjaxError && e.status === 400 && typeof e.responseText === 'string' && e.responseText.indexOf('RequestTimeout') !== -1) {
        return true; // AWS: Your socket connection to the server was not read from or written to within the timeout period. Idle connections will be closed.
      }
      return false;
    },
    isAuthErr: (e: any) => {
      if (e instanceof AuthError) {
        return true;
      }
      if (e && typeof e === 'object') {
        if (Api.err.isStandardErr(e, 'auth')) {
          return true; // API auth error response
        }
        if (e instanceof AjaxError && e.status === 401) {
          return true;
        }
      }
      return false;
    },
    isStandardErr: (e: any, internalType: string) => {
      if (e instanceof ApiErrorResponse && typeof e.res === 'object' && typeof e.res.error === 'object' && e.res.error.internal === 'auth') {
        return true;
      }
      if (Api.internal.isStandardError(e) && e.internal === internalType) {
        return true;
      }
      if ((e as StandardErrorRes).error && typeof (e as StandardErrorRes).error === 'object' && (e as StandardErrorRes).error.internal === internalType) {
        return true;
      }
      return false;
    },
    isAuthPopupNeeded: (e: any) => {
      if (e instanceof AjaxError && e.status === 400 && typeof e.responseText === 'string') {
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
    },
    isMailOrAcctDisabled: (e: any): boolean => {
      if (Api.err.isBadReq(e) && typeof e.responseText === 'string') {
        return e.responseText.indexOf('Mail service not enabled') !== -1 || e.responseText.indexOf('Account has been deleted') !== -1;
      }
      return false;
    },
    isInsufficientPermission: (e: any): e is AjaxError => e instanceof AjaxError && e.status === 403 && e.responseText.indexOf('insufficientPermissions') !== -1,
    isNotFound: (e: any): e is AjaxError => e instanceof AjaxError && e.status === 404,
    isBadReq: (e: any): e is AjaxError => e instanceof AjaxError && e.status === 400,
    isReqTooLarge: (e: any): e is AjaxError => e instanceof AjaxError && e.status === 413,
    isServerErr: (e: any): e is AjaxError => e instanceof AjaxError && e.status >= 500,
    isBlockedByProxy: (e: any): e is AjaxError => {
      if (!(e instanceof AjaxError)) {
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
    },
    isSignificant: (e: any) => {
      return !Api.err.isNetErr(e) && !Api.err.isServerErr(e) && !Api.err.isNotFound(e) && !Api.err.isMailOrAcctDisabled(e) && !Api.err.isAuthErr(e)
        && !Api.err.isBlockedByProxy(e);
    },
    isInPrivateMode: (e: any) => {
      return e instanceof Error && e.message.startsWith('BrowserMsg() (no status text): -1 when GET-ing blob:moz-extension://');
    }
  };

  public static common = {
    msg: async (acctEmail: string, from: string = '', to: string[] = [], subject: string = '', by: SendableMsgBody, atts?: Att[], threadRef?: string): Promise<SendableMsg> => {
      const [primaryKi] = await Store.keysGet(acctEmail, ['primary']);
      if (!to.length) {
        throw new Error('The To: field is empty. Please add recipients and try again');
      }
      const invalidEmails = to.filter(email => !Str.isEmailValid(email));
      if (invalidEmails.length) {
        throw new Error(`The To: field contains invalid emails: ${invalidEmails.join(', ')}\n\nPlease check recipients and try again.`);
      }
      return {
        headers: primaryKi ? { OpenPGP: `id=${primaryKi.fingerprint}` } : {},
        from,
        to,
        subject,
        body: typeof by === 'object' ? by : { 'text/plain': by },
        atts: atts || [],
        thread: threadRef,
      };
    },
    replyCorrespondents: (acctEmail: string, addresses: string[], lastMsgSender: string | undefined, lastMsgRecipients: string[]) => {
      const replyToEstimate = lastMsgRecipients;
      if (lastMsgSender) {
        replyToEstimate.unshift(lastMsgSender);
      }
      let replyTo: string[] = [];
      let myEmail = acctEmail;
      for (const email of replyToEstimate) {
        if (email) {
          if (addresses.includes(Str.parseEmail(email).email)) { // my email
            myEmail = email;
          } else if (!replyTo.includes(Str.parseEmail(email).email)) { // skip duplicates
            replyTo.push(Str.parseEmail(email).email); // reply to all except my emails
          }
        }
      }
      if (!replyTo.length) { // happens when user sends email to itself - all reply_to_estimage contained his own emails and got removed
        replyTo = Value.arr.unique(replyToEstimate);
      }
      return { to: replyTo, from: myEmail };
    },
  };

  public static attester = {
    lookupEmail: (email: string): Promise<PubkeySearchResult> => {
      return Api.internal.apiAttesterCall('lookup/email', { email: Str.parseEmail(email).email });
    },
    lookupEmails: async (emails: string[]): Promise<Dict<PubkeySearchResult>> => {
      const results: Dict<PubkeySearchResult> = {};
      await Promise.all(emails.map(async (email: string) => {
        results[email] = await Api.attester.lookupEmail(email);
      }));
      return results;
    },
    initialLegacySubmit: (email: string, pubkey: string): Promise<R.AttInitialLegacySugmit> => Api.internal.apiAttesterCall('initial/legacy_submit', {
      email: Str.parseEmail(email).email,
      pubkey: pubkey.trim(),
      // attest: false,
    }),
    testWelcome: (email: string, pubkey: string): Promise<R.AttTestWelcome> => Api.internal.apiAttesterCall('test/welcome', {
      email,
      pubkey,
    }),
    diagnoseKeyserverPubkeys: async (acctEmail: string): Promise<R.AttKeyserverDiagnosis> => {
      const diagnosis: R.AttKeyserverDiagnosis = { hasPubkeyMissing: false, hasPubkeyMismatch: false, results: {} };
      const { addresses } = await Store.getAcct(acctEmail, ['addresses']);
      const storedKeys = await Store.keysGet(acctEmail);
      const storedKeysLongids = storedKeys.map(ki => ki.longid);
      const results = await Api.attester.lookupEmails(Value.arr.unique([acctEmail].concat(addresses || [])));
      for (const email of Object.keys(results)) {
        const pubkeySearchResult = results[email];
        if (!pubkeySearchResult.pubkey) {
          diagnosis.hasPubkeyMissing = true;
          diagnosis.results[email] = { pubkey: undefined, match: false };
        } else {
          let match = true;
          if (!storedKeysLongids.includes(String(await Pgp.key.longid(pubkeySearchResult.pubkey)))) {
            diagnosis.hasPubkeyMismatch = true;
            match = false;
          }
          diagnosis.results[email] = { pubkey: pubkeySearchResult.pubkey, match };
        }
      }
      return diagnosis;
    },
  };

  public static fc = {
    url: (type: string, variable = '') => {
      return ({
        'api': 'https://flowcrypt.com/api/',
        'me': 'https://flowcrypt.com/me/' + variable,
        'pubkey': 'https://flowcrypt.com/pub/' + variable,
        'decrypt': 'https://flowcrypt.com/' + variable,
        'web': 'https://flowcrypt.com/',
      } as Dict<string>)[type];
    },
    helpFeedback: (acctEmail: string, message: string): Promise<R.FcHelpFeedback> => Api.internal.apiFcCall('help/feedback', {
      email: acctEmail,
      message,
    }),
    helpUninstall: (email: string, client: string): Promise<unknown> => Api.internal.apiFcCall('help/uninstall', {
      email,
      client,
      metrics: null, // tslint:disable-line:no-null-keyword
    }),
    accountLogin: async (acctEmail: string, token?: string): Promise<{ verified: boolean, subscription: SubscriptionInfo }> => {
      const authInfo = await Store.authInfo();
      const uuid = authInfo.uuid || await Pgp.hash.sha1UtfStr(Pgp.password.random());
      const account = authInfo.acctEmail || acctEmail;
      const response = await Api.internal.apiFcCall('account/login', {
        account,
        uuid,
        token: token || null, // tslint:disable-line:no-null-keyword
      }) as R.FcAccountLogin;
      if (response.registered !== true) {
        throw new Error('account_login did not result in successful registration');
      }
      await Store.setGlobal({ cryptup_account_email: account, cryptup_account_uuid: uuid, cryptup_account_subscription: response.subscription });
      return { verified: response.verified === true, subscription: response.subscription };
    },
    accountCheck: (emails: string[]) => Api.internal.apiFcCall('account/check', {
      emails,
    }) as Promise<R.FcAccountCheck>,
    accountCheckSync: async () => { // callbacks true on updated, false not updated, null for could not fetch
      const emails = await Store.acctEmailsGet();
      if (emails.length) {
        const response = await Api.fc.accountCheck(emails);
        const authInfo = await Store.authInfo();
        const subscription = await Store.subscription();
        const globalStoreUpdate: GlobalStore = {};
        if (response.email) {
          if (response.email !== authInfo.acctEmail) {
            // will fail auth when used on server, user will be prompted to verify this new device when that happens
            globalStoreUpdate.cryptup_account_email = response.email;
            globalStoreUpdate.cryptup_account_uuid = await Pgp.hash.sha1UtfStr(Pgp.password.random());
          }
        } else {
          if (authInfo.acctEmail) {
            globalStoreUpdate.cryptup_account_email = undefined;
            globalStoreUpdate.cryptup_account_uuid = undefined;
          }
        }
        Subscription.updateSubscriptionGlobalStore(globalStoreUpdate, subscription, response.subscription);
        if (Object.keys(globalStoreUpdate).length) {
          Catch.log('updating account subscription from ' + subscription.level + ' to ' + (response.subscription ? response.subscription.level : undefined), response);
          await Store.setGlobal(globalStoreUpdate);
          return true;
        } else {
          return false;
        }
      }
      return undefined;
    },
    accountUpdate: async (updateValues?: Dict<Serializable>): Promise<R.FcAccountUpdate> => {
      const authInfo = await Store.authInfo();
      const request = { account: authInfo.acctEmail, uuid: authInfo.uuid } as Dict<Serializable>;
      if (updateValues) {
        for (const k of Object.keys(updateValues)) {
          request[k] = updateValues[k];
        }
      }
      return await Api.internal.apiFcCall('account/update', request) as R.FcAccountUpdate;
    },
    accountSubscribe: async (product: string, method: string, paymentSourceToken?: string): Promise<R.FcAccountSubscribe> => {
      const authInfo = await Store.authInfo();
      const response = await Api.internal.apiFcCall('account/subscribe', {
        account: authInfo.acctEmail,
        uuid: authInfo.uuid,
        method,
        source: paymentSourceToken || null, // tslint:disable-line:no-null-keyword
        product,
      }) as R.FcAccountSubscribe;
      await Store.setGlobal({ cryptup_account_subscription: response.subscription });
      return response;
    },
    messagePresignFiles: async (atts: Att[], authMethod?: FcAuthMethods): Promise<R.FcMsgPresignFiles> => {
      let response: R.FcMsgPresignFiles;
      const lengths = atts.map(a => a.length);
      if (!authMethod) {
        response = await Api.internal.apiFcCall('message/presign_files', {
          lengths,
        }) as R.FcMsgPresignFiles;
      } else if (authMethod === 'uuid') {
        const authInfo = await Store.authInfo();
        response = await Api.internal.apiFcCall('message/presign_files', {
          account: authInfo.acctEmail,
          uuid: authInfo.uuid,
          lengths,
        }) as R.FcMsgPresignFiles;
      } else {
        response = await Api.internal.apiFcCall('message/presign_files', {
          message_token_account: authMethod.account,
          message_token: authMethod.token,
          lengths,
        }) as R.FcMsgPresignFiles;
      }
      if (response.approvals && response.approvals.length === atts.length) {
        return response;
      }
      throw new Error('Could not verify that all files were uploaded properly, please try again.');
    },
    messageConfirmFiles: (identifiers: string[]): Promise<R.FcMsgConfirmFiles> => Api.internal.apiFcCall('message/confirm_files', {
      identifiers,
    }),
    messageUpload: async (encryptedDataArmored: string, authMethod?: FcAuthMethods): Promise<R.FcMsgUpload> => { // todo - DEPRECATE THIS. Send as JSON to message/store
      if (encryptedDataArmored.length > 100000) {
        throw new Error('Message text should not be more than 100 KB. You can send very long texts as attachments.');
      }
      const content = new Att({ name: 'cryptup_encrypted_message.asc', type: 'text/plain', data: Buf.fromUtfStr(encryptedDataArmored) });
      if (!authMethod) {
        return await Api.internal.apiFcCall('message/upload', { content }, 'FORM') as R.FcMsgUpload;
      } else {
        const authInfo = await Store.authInfo();
        return await Api.internal.apiFcCall('message/upload', { account: authInfo.acctEmail, uuid: authInfo.uuid, content }, 'FORM') as R.FcMsgUpload;
      }
    },
    messageToken: async (): Promise<R.FcMsgToken> => {
      const authInfo = await Store.authInfo();
      return await Api.internal.apiFcCall('message/token', { account: authInfo.acctEmail, uuid: authInfo.uuid }) as R.FcMsgToken;
    },
    messageExpiration: async (adminCodes: string[], addDays?: number): Promise<R.ApirFcMsgExpiration> => {
      const authInfo = await Store.authInfo();
      return await Api.internal.apiFcCall('message/expiration', {
        account: authInfo.acctEmail,
        uuid: authInfo.uuid,
        admin_codes: adminCodes,
        add_days: addDays || null, // tslint:disable-line:no-null-keyword
      }) as R.ApirFcMsgExpiration;
    },
    messageReply: (short: string, token: string, from: string, to: string, subject: string, message: string): Promise<unknown> => Api.internal.apiFcCall('message/reply', {
      short,
      token,
      from,
      to,
      subject,
      message,
    }),
    messageContact: (sender: string, message: string, messageToken: FcAuthToken): Promise<unknown> => Api.internal.apiFcCall('message/contact', {
      message_token_account: messageToken.account,
      message_token: messageToken.token,
      sender,
      message,
    }),
    linkMessage: (short: string): Promise<R.FcLinkMsg> => Api.internal.apiFcCall('link/message', {
      short,
    }),
    linkMe: (alias: string): Promise<R.FcLinkMe> => Api.internal.apiFcCall('link/me', {
      alias,
    }),
  };

  public static aws = {
    s3Upload: (items: AwsS3UploadItem[], progressCb: ProgressCb) => {
      const progress = Value.arr.zeroes(items.length);
      const promises: Promise<void>[] = [];
      if (!items.length) {
        return Promise.resolve(promises);
      }
      for (const i of items.keys()) {
        const fields = items[i].fields;
        fields.file = new Att({ name: 'encrpted_attachment', type: 'application/octet-stream', data: items[i].att.getData() });
        promises.push(Api.internal.apiCall(items[i].baseUrl, '', fields, 'FORM', {
          upload: (singleFileProgress: number) => {
            progress[i] = singleFileProgress;
            Ui.event.prevent('spree', () => progressCb(Value.arr.average(progress)))();
          }
        }));
      }
      return Promise.all(promises);
    },
  };

  public static download = (url: string, progress?: ProgressCb): Promise<Buf> => new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('GET', url, true);
    request.responseType = 'arraybuffer';
    if (typeof progress === 'function') {
      request.onprogress = (evt) => progress(evt.lengthComputable ? Math.floor((evt.loaded / evt.total) * 100) : undefined, evt.loaded, evt.total);
    }
    request.onerror = progressEvent => {
      if (!progressEvent.target) {
        reject(new Error(`Api.download(${url}) failed with a null progressEvent.target`));
      } else {
        const { readyState, status, statusText } = progressEvent.target as XMLHttpRequest;
        reject(AjaxError.fromXhr({ readyState, status, statusText }, { url, method: 'GET' }, Catch.stackTrace()));
      }
    };
    request.onload = e => resolve(new Buf(request.response as ArrayBuffer));
    request.send();
  })

  public static ajax = async (req: JQueryAjaxSettings, stack: string): Promise<any> => {
    if (Env.isContentScript()) {
      // content script CORS not allowed anymore, have to drag it through background page
      // https://www.chromestatus.com/feature/5629709824032768
      return await BrowserMsg.send.bg.await.ajax({ req, stack });
    }
    try {
      return await $.ajax(req);
    } catch (e) {
      if (e instanceof Error) {
        throw e;
      }
      if (Api.internal.isRawAjaxError(e)) {
        throw AjaxError.fromXhr(e, req, stack);
      }
      throw new Error(`Unknown Ajax error (${String(e)}) type when calling ${req.url}`);
    }
  }

  public static getAjaxProgressXhrFactory = (progressCbs?: ProgressCbs): (() => XMLHttpRequest) | undefined => {
    if (Env.isContentScript() || Env.isBackgroundPage() || !progressCbs || !Object.keys(progressCbs).length) {
      // xhr object would cause 'The object could not be cloned.' lastError during BrowserMsg passing
      // thus no progress callbacks in bg or content scripts
      // additionally no need to create this if there are no progressCbs defined
      return undefined;
    }
    return () => { // returning a factory
      const progressPeportingXhr = new XMLHttpRequest();
      if (progressCbs && typeof progressCbs.upload === 'function') {
        progressPeportingXhr.upload.addEventListener('progress', (evt: ProgressEvent) => {
          progressCbs.upload!(evt.lengthComputable ? Math.round((evt.loaded / evt.total) * 100) : undefined); // checked ===function above
        }, false);
      }
      if (progressCbs && typeof progressCbs.download === 'function') {
        progressPeportingXhr.onprogress = (evt: ProgressEvent) => {
          progressCbs.download!(evt.lengthComputable ? Math.floor((evt.loaded / evt.total) * 100) : undefined, evt.loaded, evt.total); // checked ===function above
        };
      }
      return progressPeportingXhr;
    };
  }

  public static encodeAsMultipartRelated = (parts: Dict<string>) => { // todo - this could probably be achieved with emailjs-mime-builder
    const boundary = 'this_sucks_' + Str.sloppyRandom(10);
    let body = '';
    for (const type of Object.keys(parts)) {
      body += '--' + boundary + '\n';
      body += 'Content-Type: ' + type + '\n';
      if (type.includes('json')) {
        body += '\n' + parts[type] + '\n\n';
      } else {
        body += 'Content-Transfer-Encoding: base64\n';
        body += '\n' + btoa(parts[type]) + '\n\n';
      }
    }
    body += '--' + boundary + '--';
    return { contentType: 'multipart/related; boundary=' + boundary, body };
  }

  private static internal = {
    isStandardError: (e: any): e is StandardError => {
      return e && typeof e === 'object' && (e as StandardError).hasOwnProperty('internal') && Boolean((e as StandardError).message);
    },
    isRawAjaxError: (e: any): e is RawAjaxError => {
      return e && typeof e === 'object' && typeof (e as RawAjaxError).readyState === 'number';
    },
    apiCall: async (url: string, path: string, fields?: Dict<any>, fmt?: ReqFmt, progress?: ProgressCbs, headers?: Dict<string>, resFmt: ResFmt = 'json', method: ReqMethod = 'POST') => {
      progress = progress || {} as ProgressCbs;
      let formattedData: FormData | string | undefined;
      let contentType: string | false;
      if (fmt === 'JSON' && fields) {
        formattedData = JSON.stringify(fields);
        contentType = 'application/json; charset=UTF-8';
      } else if (fmt === 'FORM' && fields) {
        formattedData = new FormData();
        for (const formFieldName of Object.keys(fields)) {
          const a: Att | string = fields[formFieldName]; // tslint:disable-line:no-unsafe-any
          if (a instanceof Att) {
            formattedData.append(formFieldName, new Blob([a.getData()], { type: a.type }), a.name); // xss-none
          } else {
            formattedData.append(formFieldName, a); // xss-none
          }
        }
        contentType = false;
      } else if (!fmt && !fields && method === 'GET') {
        formattedData = undefined;
        contentType = false;
      } else {
        throw new Error('unknown format:' + String(fmt));
      }
      const req: JQueryAjaxSettings = {
        xhr: Api.getAjaxProgressXhrFactory(progress),
        url: url + path,
        method,
        data: formattedData,
        dataType: resFmt,
        crossDomain: true,
        headers,
        processData: false,
        contentType,
        async: true,
        timeout: typeof progress!.upload === 'function' || typeof progress!.download === 'function' ? undefined : 20000, // substituted with {} above
      };
      const res = await Api.ajax(req, Catch.stackTrace());
      if (res && typeof res === 'object' && typeof (res as StandardErrorRes).error === 'object' && (res as StandardErrorRes).error.message) {
        throw new ApiErrorResponse(res as StandardErrorRes, req);
      }
      return res;
    },
    apiAttesterCall: (path: string, values?: Dict<any>, method: ReqMethod = 'POST'): Promise<any> => {
      return Api.internal.apiCall('https://flowcrypt.com/attester/', path, values, 'JSON', undefined, { 'api-version': '3' }, 'json', method);
    },
    apiFcCall: (path: string, vals: Dict<any>, fmt: ReqFmt = 'JSON'): Promise<any> => {
      return Api.internal.apiCall(Api.fc.url('api'), path, vals, fmt, undefined, { 'api-version': '3' });
    },
  };

  public static retreiveBlogPosts = async (): Promise<R.FcBlogPost[]> => {
    return Api.ajax({ url: 'https://flowcrypt.com/feed', dataType: 'json' }, Catch.stackTrace());
  }

}
