/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

// tslint:disable:no-direct-ajax

import { Api, ProgressCbs, ReqMethod } from './api.js';
import { Dict, Str } from '../core/common.js';

import { GOOGLE_API_HOST } from '../core/const.js';
import { GmailRes } from './email-provider/gmail/gmail-parser.js';
import { GoogleAuth } from './google-auth.js';
import { Serializable } from '../platform/store/abstract-store.js';

export class Google {

  public static webmailUrl = (acctEmail: string) => {
    return `https://mail.google.com/mail/u/${acctEmail}`;
  }

  public static gmailCall = async <RT>(
    acctEmail: string, method: ReqMethod, path: string, params: Dict<Serializable> | string | undefined, progress?: ProgressCbs, contentType?: string
  ): Promise<RT> => {
    progress = progress || {};
    let data, url;
    if (typeof progress.upload === 'function') {
      url = `${GOOGLE_API_HOST}/upload/gmail/v1/users/me/${path}?uploadType=multipart`;
      data = params;
    } else {
      url = `${GOOGLE_API_HOST}/gmail/v1/users/me/${path}`;
      if (method === 'GET' || method === 'DELETE') {
        data = params;
      } else {
        data = JSON.stringify(params);
      }
    }
    contentType = contentType || 'application/json; charset=UTF-8';
    const headers = { 'Authorization': await GoogleAuth.googleApiAuthHeader(acctEmail) };
    const xhr = Api.getAjaxProgressXhrFactory(progress);
    const request = { xhr, url, method, data, headers, crossDomain: true, contentType, async: true };
    return await GoogleAuth.apiGoogleCallRetryAuthErrorOneTime(acctEmail, request) as RT;
  }

  public static contactsGet = async (acctEmail: string, query?: string, progress?: ProgressCbs, max: number = 10, start: number = 0) => {
    progress = progress || {};
    const method = 'GET';
    const contentType = 'application/json; charset=UTF-8';
    const url = `${GOOGLE_API_HOST}/m8/feeds/contacts/default/thin`;
    const data = { 'alt': "json", 'q': query, 'v': '3.0', 'max-results': max, 'start-index': start };
    const xhr = Api.getAjaxProgressXhrFactory(progress);
    const headers = { 'Authorization': await GoogleAuth.googleApiAuthHeader(acctEmail) };
    const contacts = await GoogleAuth.apiGoogleCallRetryAuthErrorOneTime(acctEmail,
      { xhr, url, method, data, headers, contentType, crossDomain: true, async: true }) as GmailRes.GoogleContacts;
    return contacts.feed.entry && contacts.feed.entry // todo - causes weird function signature, could be improved to return empty arr
      .filter(entry => !!(entry.gd$email || []).find(email => email.primary === "true")) // find all entries that have primary email
      .map(e => ({
        email: (e.gd$email || []).find(e => e.primary === "true")!.address,
        name: e.gd$name && e.gd$name.gd$fullName && e.gd$name.gd$fullName.$t
      }));
  }

  public static encodeAsMultipartRelated = (parts: Dict<string>) => { // todo - this could probably be achieved with emailjs-mime-builder
    const boundary = 'the_boundary_is_' + Str.sloppyRandom(10);
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

}
