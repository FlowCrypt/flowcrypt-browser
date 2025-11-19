/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Ajax, AjaxParams, JsonParams, ProgressCbs } from '../../shared/api.js';
import { Dict, Str } from '../../../core/common.js';

import { GMAIL_GOOGLE_API_HOST, PEOPLE_GOOGLE_API_HOST } from '../../../core/const.js';
import { GmailRes } from './gmail-parser.js';
import { GoogleOAuth } from '../../authentication/google/google-oauth.js';
import { CatchHelper } from '../../../platform/catch-helper.js';
export class Google {
  public static webmailUrl = (acctEmail: string) => {
    return `https://mail.google.com/mail/u/${acctEmail}`;
  };

  public static gmailCall = async <RT>(acctEmail: string, path: string, params?: AjaxParams, progress?: ProgressCbs): Promise<RT> => {
    progress = progress || {};
    let url;
    let dataPart: AjaxParams;
    if (params?.method === 'POST' && params.dataType === 'TEXT') {
      url = `${GMAIL_GOOGLE_API_HOST}/upload/gmail/v1/users/me/${path}?uploadType=multipart`;
      dataPart = { method: 'POST', data: params.data, contentType: params.contentType, dataType: 'TEXT' };
    } else {
      url = `${GMAIL_GOOGLE_API_HOST}/gmail/v1/users/me/${path}`;
      if (params?.method === 'GET') {
        dataPart = { method: 'GET', data: params.data };
      } else if (params?.method === 'POST' || params?.method === 'PUT') {
        const { method, data } = params as JsonParams;
        dataPart = {
          method,
          data,
          dataType: 'JSON',
        };
      } else if (params?.method === 'DELETE') {
        dataPart = { ...params };
      } else {
        dataPart = { method: 'GET' };
      }
    }
    const headers = await GoogleOAuth.googleApiAuthHeader(acctEmail);
    const progressCbs = 'download' in progress || 'upload' in progress ? progress : undefined;
    const request: Ajax = { url, headers, ...dataPart, stack: CatchHelper.stackTrace(), progress: progressCbs };
    return await GoogleOAuth.apiGoogleCallRetryAuthErrorOneTime<RT>(acctEmail, request);
  };

  public static contactsGet = async (acctEmail: string, query?: string, progress?: ProgressCbs, max = 10) => {
    progress = progress || {};
    const searchContactsUrl = `${PEOPLE_GOOGLE_API_HOST}/v1/people:searchContacts`;
    const searchOtherContactsUrl = `${PEOPLE_GOOGLE_API_HOST}/v1/otherContacts:search`;
    const data = { query, readMask: 'names,emailAddresses', pageSize: max };
    const authorizationHeader = await GoogleOAuth.googleApiAuthHeader(acctEmail);
    const contacts = await Promise.all(
      [searchContactsUrl, searchOtherContactsUrl].map(url =>
        GoogleOAuth.apiGoogleCallRetryAuthErrorOneTime<GmailRes.GoogleContacts>(acctEmail, {
          progress,
          url,
          method: 'GET',
          data,
          headers: authorizationHeader,
          stack: CatchHelper.stackTrace(),
        })
      )
    );
    const userContacts = contacts[0].results || [];
    const otherContacts = contacts[1].results || [];
    const contactsMerged = [...userContacts, ...otherContacts];
    return contactsMerged
      .filter(entry => !!(entry.person?.emailAddresses || []).find(email => email.metadata.primary)) // find all entries that have primary email
      .map(entry => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const email = (entry.person?.emailAddresses || []).find(email => email.metadata.primary)!.value;
        const name = (entry.person?.names || []).find(name => name.metadata.primary)?.displayName;
        return { email, name };
      });
  };

  public static getNames = async (acctEmail: string): Promise<GmailRes.GoogleUserProfile> => {
    const getProfileUrl = `${PEOPLE_GOOGLE_API_HOST}/v1/people/me`;
    const data = { personFields: 'names' };
    const authorizationHeader = await GoogleOAuth.googleApiAuthHeader(acctEmail);
    const contacts = GoogleOAuth.apiGoogleCallRetryAuthErrorOneTime<GmailRes.GoogleUserProfile>(acctEmail, {
      url: getProfileUrl,
      method: 'GET',
      data,
      headers: authorizationHeader,
      stack: CatchHelper.stackTrace(),
    });
    return contacts;
  };

  public static encodeAsMultipartRelated = (parts: Dict<string>) => {
    // todo - this could probably be achieved with emailjs-mime-builder
    const boundary = 'the_boundary_is_' + Str.sloppyRandom(10);
    let body = '';
    for (const [type, content] of Object.entries(parts)) {
      body += '--' + boundary + '\n';
      body += 'Content-Type: ' + type + '\n';
      if (type.includes('json')) {
        body += '\n' + content + '\n\n';
      } else {
        body += 'Content-Transfer-Encoding: base64\n';
        body += '\n' + btoa(parts[type]) + '\n\n';
      }
    }
    body += '--' + boundary + '--';
    return { contentType: 'multipart/related; boundary=' + boundary, body };
  };
}
