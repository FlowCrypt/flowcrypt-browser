/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

// tslint:disable:oneliner-object-literal

'use strict';

import { Dict, Str, Value } from '../core/common.js';
import { Store } from '../platform/store.js';
import { Att } from '../core/att.js';
import { SendableMsgBody } from '../core/mime.js';
import { Recipients } from '../composer/interfaces/composer-types.js';
import { GmailRes, Google } from './google.js';
import { Api, RecipientType } from './api.js';

export type ProviderContactsQuery = { substring: string };
export type SendableMsg = {
  headers: Dict<string>;
  from: string;
  recipients: Recipients;
  subject: string;
  body: SendableMsgBody;
  atts: Att[];
  thread?: string;
  mimeRootType: string,
  sign?: (signable: string) => Promise<string>,
};

export class EmailProviderApi extends Api {

  public static createMsgObj = async (
    acctEmail: string, from: string = '', recipients: Recipients, subject: string = '', body: SendableMsgBody, atts?: Att[], threadRef?: string,
    mimeRootType?: string, sign?: (content: string) => Promise<string>,
  ): Promise<SendableMsg> => {
    const allEmails = [...recipients.to || [], ...recipients.cc || [], ...recipients.bcc || []];
    const [primaryKi] = await Store.keysGet(acctEmail, ['primary']);
    if (!allEmails.length) {
      throw new Error('The To: field is empty. Please add recipients and try again');
    }
    const invalidEmails = allEmails.filter(email => !Str.isEmailValid(email));
    if (invalidEmails.length) {
      throw new Error(`The To: field contains invalid emails: ${invalidEmails.join(', ')}\n\nPlease check recipients and try again.`);
    }
    return {
      headers: primaryKi ? { OpenPGP: `id=${primaryKi.fingerprint}` } : {},
      from,
      recipients,
      subject,
      body: typeof body === 'object' ? body : { 'text/plain': body },
      atts: atts || [],
      thread: threadRef,
      mimeRootType: mimeRootType || 'multipart/mixed',
      sign,
    };
  }

  public static determineReplyCorrespondents = (acctEmail: string, addresses: string[], lastGmailMsg: GmailRes.GmailMsg) => {
    const headers = {
      from: Str.parseEmail(Google.gmail.findHeader(lastGmailMsg, 'from') || '').email,
      to: EmailProviderApi.getAddressesHeader(lastGmailMsg, 'to'),
      // Do not add your emails and aliases to CC and BCC, maybe it's incorrect to filter them here,
      // maybe would be better to return from this method all emails addresses and then filter them in another place
      cc: EmailProviderApi.getAddressesHeader(lastGmailMsg, 'cc').filter(e => !addresses.includes(e)),
      bcc: EmailProviderApi.getAddressesHeader(lastGmailMsg, 'bcc').filter(e => !addresses.includes(e)),
      replyTo: Google.gmail.findHeader(lastGmailMsg, 'reply-to')
    };
    if (headers.from && !headers.to.includes(headers.from)) {
      headers.to.unshift(headers.from);
    }
    const acctEmailAliasesInMsg = [...headers.to, ...headers.cc, ...headers.bcc].filter(e => addresses.includes(e));
    let myEmail = acctEmail;
    if (acctEmailAliasesInMsg.length && !acctEmailAliasesInMsg.includes(acctEmail)) {
      myEmail = acctEmailAliasesInMsg[0];
    }
    if (headers.replyTo) {
      return { to: [headers.replyTo], cc: [], bcc: [], from: myEmail };
    }
    const replyTowWithoutMyEmail = headers.to.filter(e => myEmail !== e); // thinking about moving it in another place
    if (replyTowWithoutMyEmail.length) { // when user sends emails it itself here will be 0 elements
      headers.to = replyTowWithoutMyEmail;
    }
    return { to: headers.to, cc: headers.cc, bcc: headers.bcc, from: myEmail };
  }

  private static getAddressesHeader = (gmailMsg: GmailRes.GmailMsg, headerName: RecipientType) => {
    return Value.arr.unique((Google.gmail.findHeader(gmailMsg, headerName) || '').split(',').map(e => Str.parseEmail(e).email!).filter(e => !!e));
  }

}
