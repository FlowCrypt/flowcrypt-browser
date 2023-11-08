/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Ajax, ProgressCbs } from '../../shared/api.js';
import { Dict, Str, UrlParams } from '../../../core/common.js';

import { GMAIL_GOOGLE_API_HOST, PEOPLE_GOOGLE_API_HOST } from '../../../core/const.js';
import { GmailRes } from './gmail-parser.js';
import { GoogleOAuth } from '../../authentication/google/google-oauth.js';
import { Serializable } from '../../../platform/store/abstract-store.js';
import { Catch } from '../../../platform/catch.js';

export class Google {
  public static webmailUrl = (acctEmail: string) => {
    return `https://mail.google.com/mail/u/${acctEmail}`;
  };

  public static gmailCall = async <RT>(
    acctEmail: string,
    path: string,
    params?:
      | {
          method: 'POST' | 'PUT';
          data: Dict<Serializable>;
          dataType?: 'JSON';
        }
      | {
          method: 'POST';
          data: string;
          contentType: string;
          dataType: 'TEXT';
        }
      | {
          method: 'GET';
          data?: UrlParams;
        }
      | { method: 'DELETE' },
    progress?: ProgressCbs
  ): Promise<RT> => {
    progress = progress || {};
    let url;
    let dataPart:
      | { method: 'POST' | 'PUT'; data: Dict<Serializable>; dataType: 'JSON' }
      | { method: 'POST'; data: string; contentType: string; dataType: 'TEXT' }
      | { method: 'GET'; data?: UrlParams }
      | { method: 'DELETE' };
    if (params?.method === 'POST' && params.dataType === 'TEXT') {
      url = `${GMAIL_GOOGLE_API_HOST}/upload/gmail/v1/users/me/${path}?uploadType=multipart`;
      dataPart = { method: 'POST', data: params.data, contentType: params.contentType, dataType: 'TEXT' };
    } else {
      url = `${GMAIL_GOOGLE_API_HOST}/gmail/v1/users/me/${path}`;
      if (params?.method === 'GET') {
        dataPart = { method: 'GET', data: params.data };
      } else if (params?.method === 'POST' || params?.method === 'PUT') {
        dataPart = { method: params.method, data: params.data, dataType: 'JSON' };
      } else if (params?.method === 'DELETE') {
        dataPart = { ...params };
      } else {
        dataPart = { method: 'GET' };
      }
    }
    const headers = { authorization: await GoogleOAuth.googleApiAuthHeader(acctEmail) };
    const progressCbs = 'download' in progress || 'upload' in progress ? progress : undefined;
    const request: Ajax = { url, headers, ...dataPart, stack: Catch.stackTrace(), progress: progressCbs };
    return await GoogleOAuth.apiGoogleCallRetryAuthErrorOneTime<RT>(acctEmail, request);
  };

  public static contactsGet = async (acctEmail: string, query?: string, progress?: ProgressCbs, max = 10) => {
    progress = progress || {};
    const searchContactsUrl = `${PEOPLE_GOOGLE_API_HOST}/v1/people:searchContacts`;
    const searchOtherContactsUrl = `${PEOPLE_GOOGLE_API_HOST}/v1/otherContacts:search`;
    const data = { query, readMask: 'names,emailAddresses', pageSize: max };
    const authorization = await GoogleOAuth.googleApiAuthHeader(acctEmail);
    const contacts = await Promise.all(
      [searchContactsUrl, searchOtherContactsUrl].map(url =>
        GoogleOAuth.apiGoogleCallRetryAuthErrorOneTime<GmailRes.GoogleContacts>(acctEmail, {
          progress,
          url,
          method: 'GET',
          data,
          headers: { authorization },
          stack: Catch.stackTrace(),
        })
      )
    );
    const userContacts = contacts[0].results || [];
    const otherContacts = contacts[1].results || [];
    const contactsMerged = [...userContacts, ...otherContacts];
    return contactsMerged
      .filter(entry => !!(entry.person?.emailAddresses || []).find(email => email.metadata.primary === true)) // find all entries that have primary email
      .map(entry => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const email = (entry.person?.emailAddresses || []).find(email => email.metadata.primary === true)!.value;
        const name = (entry.person?.names || []).find(name => name.metadata.primary === true)?.displayName;
        return { email, name };
      });
  };

  public static getNames = async (acctEmail: string) => {
    const getProfileUrl = `${PEOPLE_GOOGLE_API_HOST}/v1/people/me`;
    const data = { personFields: 'names' };
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const authorization = await GoogleOAuth.googleApiAuthHeader(acctEmail);
    const contacts = GoogleOAuth.apiGoogleCallRetryAuthErrorOneTime(acctEmail, {
      url: getProfileUrl,
      method: 'GET',
      data,
      headers: { authorization },
      stack: Catch.stackTrace(),
    }) as Promise<GmailRes.GoogleUserProfile>;
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
