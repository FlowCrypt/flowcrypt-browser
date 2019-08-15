/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

// tslint:disable:oneliner-object-literal

'use strict';

import { Api } from './api.js';
import { Value, Dict, Str } from '../core/common.js';
import { Store } from '../platform/store.js';
import { Att } from '../core/att.js';
import { SendableMsgBody } from '../core/mime.js';
import { Recipients, BaseRecipient } from '../composer/interfaces/composer-types.js';

export type ProviderContactsQuery = { substring: string };
export type SendableMsg = { headers: Dict<string>; from: string; recipients: Recipients; subject: string; body: SendableMsgBody; atts: Att[]; thread?: string; };
type LastMsgHeaders = { lmSender: string | undefined, lmRecipients: string[], lmReplyTo: string | undefined };

export class EmailProviderApi extends Api {

  public static createMsgObj = async (
    acctEmail: string, from: string = '', recipientElements: BaseRecipient[] = [], subject: string = '', by: SendableMsgBody, atts?: Att[], threadRef?: string
  ): Promise<SendableMsg> => {
    const [primaryKi] = await Store.keysGet(acctEmail, ['primary']);
    if (!recipientElements.length) {
      throw new Error('The To: field is empty. Please add recipients and try again');
    }
    const invalidEmails = recipientElements.filter(r => !Str.isEmailValid(r.email));
    if (invalidEmails.length) {
      throw new Error(`The To: field contains invalid emails: ${invalidEmails.join(', ')}\n\nPlease check recipients and try again.`);
    }
    const recipients: Recipients = { to: [], cc: [], bcc: [] };
    // tslint:disable-next-line: standard-loops
    recipientElements.forEach(r => recipients[r.sendingType].push(r.email));
    return {
      headers: primaryKi ? { OpenPGP: `id=${primaryKi.fingerprint}` } : {},
      from,
      recipients,
      subject,
      body: typeof by === 'object' ? by : { 'text/plain': by },
      atts: atts || [],
      thread: threadRef,
    };
  }

  public static determineReplyCorrespondents = (acctEmail: string, addresses: string[], { lmSender, lmRecipients, lmReplyTo }: LastMsgHeaders) => {
    const replyToEstimate = lmRecipients.map(e => Str.parseEmail(e).email!).filter(e => !!e); // the ! is due to a QS quirk, we filter it after
    if (lmSender) {
      replyToEstimate.unshift(lmSender);
    }
    let replyTo: string[] = [];
    let myEmail = acctEmail;
    for (const email of replyToEstimate) {
      if (addresses.includes(email)) { // my email
        myEmail = email;
      } else if (!replyTo.includes(email)) { // skip duplicates
        replyTo.push(email); // reply to all except my emails
      }
    }
    if (!replyTo.length) { // happens when user sends email to itself - all reply_to_estimage contained his own emails and got removed
      replyTo = Value.arr.unique(replyToEstimate);
    }
    if (lmReplyTo) {
      return { to: [lmReplyTo], from: myEmail };
    }
    return { to: replyTo, from: myEmail };
  }

}
