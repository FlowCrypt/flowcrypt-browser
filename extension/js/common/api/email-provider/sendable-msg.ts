/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Dict, Str } from '../../core/common.js';
import { Mime, MimeEncodeType, SendableMsgBody } from '../../core/mime.js';
import { Attachment } from '../../core/attachment.js';
import { Buf } from '../../core/buf.js';
import { RecipientType } from '../shared/api.js';
import { KeyStore } from '../../platform/store/key-store.js';

type Recipients = { to?: string[], cc?: string[], bcc?: string[] };

type SendableMsgHeaders = {
  headers?: Dict<string>;
  from: string;
  recipients: Recipients;
  subject: string;
  thread?: string;
};

type SendableMsgOptions = {
  type?: MimeEncodeType,
  isDraft?: boolean;
};

type SignMethod = (signable: string) => Promise<string>;

type SendableMsgDefinition = SendableMsgHeaders
  & SendableMsgOptions
  & {
    body?: SendableMsgBody;
    attachments?: Attachment[];
  };

export class InvalidRecipientError extends Error { }

export class SendableMsg {

  public sign?: (signable: string) => Promise<string>;

  public static createSMime = async (acctEmail: string, headers: SendableMsgHeaders, data: Uint8Array, options: SendableMsgOptions): Promise<SendableMsg> => {
    return await SendableMsg.createSendableMsg(acctEmail, headers, { "encrypted/buf": Buf.fromUint8(data) }, [], { type: 'smimeEncrypted', isDraft: options.isDraft });
  }

  public static createPlain = async (acctEmail: string, headers: SendableMsgHeaders, body: SendableMsgBody, attachments: Attachment[]): Promise<SendableMsg> => {
    return await SendableMsg.createSendableMsg(acctEmail, headers, body, attachments, { type: undefined, isDraft: undefined });
  }

  public static createPgpInline = async (acctEmail: string, headers: SendableMsgHeaders, body: string, attachments: Attachment[], options?: SendableMsgOptions): Promise<SendableMsg> => {
    return await SendableMsg.createSendableMsg(acctEmail, headers, { "text/plain": body }, attachments, options ? options : { type: undefined, isDraft: undefined });
  }

  public static createPwdMsg = async (
    acctEmail: string,
    headers: SendableMsgHeaders,
    body: SendableMsgBody,
    attachments: Attachment[],
    options: SendableMsgOptions
  ): Promise<SendableMsg> => {
    return await SendableMsg.createSendableMsg(acctEmail, headers, body, attachments, { type: undefined, isDraft: options.isDraft });
  }

  public static createPgpMime = async (acctEmail: string, headers: SendableMsgHeaders, attachments: Attachment[], options?: SendableMsgOptions): Promise<SendableMsg> => {
    return await SendableMsg.createSendableMsg(acctEmail, headers, {}, attachments, { type: (options ? 'pgpMimeEncrypted' : undefined), isDraft: (options ? options.isDraft : undefined) });
  }

  public static createPgpMimeSigned = async (
    acctEmail: string,
    headers: SendableMsgHeaders,
    body: SendableMsgBody,
    attachments: Attachment[],
    signMethod: SignMethod
  ): Promise<SendableMsg> => {
    const sendableMsg = await SendableMsg.createSendableMsg(acctEmail, headers, body, attachments, { type: 'pgpMimeSigned', isDraft: undefined });
    sendableMsg.sign = signMethod;
    return sendableMsg;
  }

  private static createSendableMsg = async (
    acctEmail: string,
    headers: SendableMsgHeaders,
    body: SendableMsgBody,
    attachments: Attachment[],
    options: SendableMsgOptions
  ): Promise<SendableMsg> => {
    const { from, recipients, subject, thread } = headers;
    const { type, isDraft } = options;
    return await SendableMsg.create(acctEmail, { from, recipients, subject, thread, body, attachments, type, isDraft });
  }

  private static create = async (acctEmail: string, { from, recipients, subject, thread, body, attachments, type, isDraft }: SendableMsgDefinition): Promise<SendableMsg> => {
    const primaryKi = await KeyStore.getFirstRequired(acctEmail);
    const headers: Dict<string> = primaryKi ? { OpenPGP: `id=${primaryKi.longid}` } : {}; // todo - use autocrypt format
    return new SendableMsg(
      acctEmail,
      headers,
      isDraft === true,
      from,
      recipients,
      subject,
      body || {},
      attachments || [],
      thread,
      type
    );
  }

  private constructor(
    public acctEmail: string,
    public headers: Dict<string>,
    isDraft: boolean,
    public from: string,
    public recipients: Recipients,
    public subject: string,
    public body: SendableMsgBody,
    public attachments: Attachment[],
    public thread: string | undefined,
    public type: MimeEncodeType,
  ) {
    const allEmails = [...recipients.to || [], ...recipients.cc || [], ...recipients.bcc || []];
    if (!allEmails.length && !isDraft) {
      throw new Error('The To: field is empty. Please add recipients and try again');
    }
    const invalidEmails = allEmails.filter(email => !Str.isEmailValid(email));
    if (invalidEmails.length) {
      throw new InvalidRecipientError(`The To: field contains invalid emails: ${invalidEmails.join(', ')}\n\nPlease check recipients and try again.`);
    }
  }

  public toMime = async () => {
    this.headers.From = this.from;
    for (const recipientTypeStr of Object.keys(this.recipients)) {
      const recipientType = recipientTypeStr as RecipientType;
      if (this.recipients[recipientType] && this.recipients[recipientType]!.length) {
        // todo - properly escape/encode this header using emailjs
        this.headers[recipientType[0].toUpperCase() + recipientType.slice(1)] = this.recipients[recipientType]!.map(h => h.replace(/[,]/g, '')).join(',');
      }
    }
    this.headers.Subject = this.subject;
    if (this.type === 'smimeEncrypted' && this.body['encrypted/buf']) {
      return await Mime.encodeSmime(this.body['encrypted/buf'], this.headers);
    } else if (this.type === 'pgpMimeSigned' && this.sign) {
      return await Mime.encodePgpMimeSigned(this.body, this.headers, this.attachments, this.sign);
    } else if (this.body['text/plain']) {
      return await Mime.encode(this.body, this.headers, this.attachments, this.type);
    } else {
      throw new Error('Malformed message');
    }
  }

}
