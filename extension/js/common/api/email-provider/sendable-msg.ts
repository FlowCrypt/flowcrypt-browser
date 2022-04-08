/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Dict, Str } from '../../core/common.js';
import { Mime, MimeEncodeType, SendableMsgBody } from '../../core/mime.js';
import { Attachment } from '../../core/attachment.js';
import { Buf } from '../../core/buf.js';
import { KeyStore } from '../../platform/store/key-store.js';
import { KeyStoreUtil } from "../../core/crypto/key-store-util";
import { ParsedRecipients } from './email-provider-api.js';

type SendableMsgHeaders = {
  headers?: Dict<string>;
  from: string;
  recipients: ParsedRecipients;
  subject: string;
  thread?: string;
};

type SendableMsgOptions = {
  type?: MimeEncodeType,
  isDraft?: boolean;
  externalId?: string; // id of pwd-protected message on FES
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

  public static createSMimeEncrypted = async (acctEmail: string, headers: SendableMsgHeaders, data: Uint8Array, options: SendableMsgOptions): Promise<SendableMsg> => {
    return await SendableMsg.createSendableMsg(acctEmail, headers, { "pkcs7/buf": Buf.fromUint8(data) }, [], { type: 'smimeEncrypted', isDraft: options.isDraft });
  };

  public static createSMimeSigned = async (acctEmail: string, headers: SendableMsgHeaders, data: Uint8Array): Promise<SendableMsg> => {
    return await SendableMsg.createSendableMsg(acctEmail, headers, { "pkcs7/buf": Buf.fromUint8(data) }, [], { type: 'smimeSigned' });
  };

  public static createPlain = async (acctEmail: string, headers: SendableMsgHeaders, body: SendableMsgBody, attachments: Attachment[]): Promise<SendableMsg> => {
    return await SendableMsg.createSendableMsg(acctEmail, headers, body, attachments, { type: undefined, isDraft: undefined });
  };

  public static createInlineArmored = async (acctEmail: string, headers: SendableMsgHeaders, body: string, attachments: Attachment[], options?: SendableMsgOptions): Promise<SendableMsg> => {
    return await SendableMsg.createSendableMsg(acctEmail, headers, { "text/plain": body }, attachments, options ? options : { type: undefined, isDraft: undefined });
  };

  public static createPwdMsg = async (
    acctEmail: string,
    headers: SendableMsgHeaders,
    body: SendableMsgBody,
    attachments: Attachment[],
    options: SendableMsgOptions
  ): Promise<SendableMsg> => {
    return await SendableMsg.createSendableMsg(acctEmail, headers, body, attachments, { type: undefined, isDraft: options.isDraft, externalId: options.externalId });
  };

  public static createPgpMime = async (acctEmail: string, headers: SendableMsgHeaders, attachments: Attachment[], options?: SendableMsgOptions): Promise<SendableMsg> => {
    return await SendableMsg.createSendableMsg(acctEmail, headers, {}, attachments, { type: (options ? 'pgpMimeEncrypted' : undefined), isDraft: (options ? options.isDraft : undefined) });
  };

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
  };

  private static createSendableMsg = async (
    acctEmail: string,
    headers: SendableMsgHeaders,
    body: SendableMsgBody,
    attachments: Attachment[],
    options: SendableMsgOptions
  ): Promise<SendableMsg> => {
    const { from, recipients, subject, thread } = headers;
    const { type, isDraft, externalId } = options;
    return await SendableMsg.create(acctEmail, { from, recipients, subject, thread, body, attachments, type, isDraft, externalId });
  };

  private static create = async (acctEmail: string, { from, recipients, subject, thread, body, attachments, type, isDraft, externalId }: SendableMsgDefinition): Promise<SendableMsg> => {
    const mostUsefulPrv = KeyStoreUtil.chooseMostUseful(
      await KeyStoreUtil.parse(await KeyStore.getRequired(acctEmail)),
      'EVEN-IF-UNUSABLE'
    );
    const headers: Dict<string> = {};
    if (mostUsefulPrv && mostUsefulPrv.key.family === 'openpgp') {
      headers.Openpgp = `id=${mostUsefulPrv.key.id}`; // todo - use autocrypt format
    }
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
      type,
      externalId
    );
  };

  private constructor(
    public acctEmail: string,
    public headers: Dict<string>,
    isDraft: boolean,
    public from: string,
    public recipients: ParsedRecipients,
    public subject: string,
    public body: SendableMsgBody,
    public attachments: Attachment[],
    public thread: string | undefined,
    public type: MimeEncodeType,
    public externalId?: string, // for binding a password-protected message
  ) {
    const allEmails = [...recipients.to || [], ...recipients.cc || [], ...recipients.bcc || []];
    if (!allEmails.length && !isDraft) {
      throw new Error('The To: field is empty. Please add recipients and try again');
    }
    const invalidEmails = allEmails.filter(email => !Str.isEmailValid(email.email));
    if (invalidEmails.length) {
      throw new InvalidRecipientError(`The To: field contains invalid emails: ${invalidEmails.join(', ')}\n\nPlease check recipients and try again.`);
    }
  }

  public toMime = async () => {
    this.headers.From = this.from;
    for (const [recipientType, value] of Object.entries(this.recipients)) {
      if (value && value!.length) {
        // todo - properly escape/encode this header using emailjs
        this.headers[recipientType[0].toUpperCase() + recipientType.slice(1)] = value.map(h => Str.formatEmailWithOptionalName(h).replace(/[,]/g, '')).join(',');
      }
    }
    this.headers.Subject = this.subject;
    if (this.body['pkcs7/buf']) {
      return await Mime.encodeSmime(this.body['pkcs7/buf'], this.headers, this.type === 'smimeSigned' ? 'signed-data' : 'enveloped-data');
    } else if (this.type === 'pgpMimeSigned' && this.sign) {
      return await Mime.encodePgpMimeSigned(this.body, this.headers, this.attachments, this.sign);
    } else {
      return await Mime.encode(this.body, this.headers, this.attachments, this.type);
    }
  };

}
