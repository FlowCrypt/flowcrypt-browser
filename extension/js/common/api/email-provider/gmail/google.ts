/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

// tslint:disable:no-direct-ajax

import { Api, ProgressCbs, ReqMethod } from '../../shared/api.js';
import { Dict, Str } from '../../../core/common.js';

import { GOOGLE_API_HOST, PEOPLE_API_HOST } from '../../../core/const.js';
import { GmailRes } from './gmail-parser.js';
import { GoogleAuth } from './google-auth.js';
import { Serializable } from '../../../platform/store/abstract-store.js';

export class Google {

  public static webmailUrl = (acctEmail: string) => {
    return `https://mail.google.com/mail/u/${acctEmail}`;
  };

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
  };

  public static contactsGet = async (acctEmail: string, query?: string, progress?: ProgressCbs, max: number = 10) => {
    progress = progress || {};
    const method = 'GET';
    const contentType = 'application/json; charset=UTF-8';
    const searchContactsUrl = `${PEOPLE_API_HOST}/v1/people:searchContacts`;
    const searchOtherContactsUrl = `${PEOPLE_API_HOST}/v1/otherContacts:search`;
    const data = { query, 'readMask': 'names,emailAddresses', 'pageSize': max };
    const xhr = Api.getAjaxProgressXhrFactory(progress);
    const headers = { 'Authorization': await GoogleAuth.googleApiAuthHeader(acctEmail) };
    const contacts = await Promise.all([
      GoogleAuth.apiGoogleCallRetryAuthErrorOneTime(acctEmail,
        { xhr, url: searchContactsUrl, method, data, headers, contentType, crossDomain: true, async: true }) as Promise<GmailRes.GoogleContacts>,
      GoogleAuth.apiGoogleCallRetryAuthErrorOneTime(acctEmail,
        { xhr, url: searchOtherContactsUrl, method, data, headers, contentType, crossDomain: true, async: true }) as Promise<GmailRes.GoogleContacts>
    ]);
    const userContacts = contacts[0].results || [];
    const otherContacts = contacts[1].results || [];
    const contactsMerged = [...userContacts, ...otherContacts];
    return contactsMerged
      .filter(entry => !!(entry.person?.emailAddresses || []).find(email => email.metadata.primary === true)) // find all entries that have primary email
      .map(entry => {
        const email = (entry.person?.emailAddresses || []).find(email => email.metadata.primary === true)!.value;
        const name = (entry.person?.names || []).find(name => name.metadata.primary === true)?.displayName;
        return { email, name };
      });
  };

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
  };

}
