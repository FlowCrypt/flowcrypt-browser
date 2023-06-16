/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Mime, SendableMsgBody } from '../../../core/mime.js';
import { Str, Value } from '../../../core/common.js';

import { Attachment } from '../../../core/attachment.js';
import { Buf } from '../../../core/buf.js';
import { RecipientType } from '../../shared/api.js';
import { ReplyParams } from '../email-provider-api.js';

export const FLOWCRYPT_REPLY_EMAIL_ADDRESSES = ['replies@flowcrypt.com', 'robot@flowcrypt.com', 'tests.only@flowcrypt.dev'];

export namespace GmailRes {
  // responses

  export type GmailMsg$header = { name: string; value: string };
  export type GmailMsg$payload$body = { attachmentId: string; size: number; data?: string };
  export type GmailMsg$payload$part = {
    partId?: string;
    body?: GmailMsg$payload$body;
    filename?: string;
    mimeType?: string;
    headers?: GmailMsg$header[];
    parts?: GmailMsg$payload$part[];
  };
  export type GmailMsg$payload = {
    parts?: GmailMsg$payload$part[];
    headers?: GmailMsg$header[];
    mimeType?: string;
    body?: GmailMsg$payload$body;
  };
  export type GmailMsg$labelId = 'INBOX' | 'UNREAD' | 'CATEGORY_PERSONAL' | 'IMPORTANT' | 'SENT' | 'CATEGORY_UPDATES' | 'TRASH';
  export type GmailMsg = {
    id: string;
    historyId: string;
    threadId?: string | null;
    payload?: GmailMsg$payload;
    internalDate?: number | string;
    labelIds?: GmailMsg$labelId[];
    snippet?: string;
    raw?: string;
  };
  export type GmailMsgList$message = { id: string; threadId: string };
  export type GmailMsgList = { messages?: GmailMsgList$message[]; resultSizeEstimate: number; nextPageToken?: string };
  export type GmailLabels$label = {
    id: string;
    name: string;
    messageListVisibility: 'show' | 'hide';
    labelListVisibility: 'labelShow' | 'labelHide';
    type: 'user' | 'system';
    messagesTotal?: number;
    messagesUnread?: number;
    threadsTotal?: number;
    threadsUnread?: number;
    color?: { textColor: string; backgroundColor: string };
  };
  export type GmailLabels = { labels: GmailLabels$label[] };
  export type GmailAttachment = { attachmentId: string; size: number; data: Buf };
  export type GmailMsgSend = { id: string };
  export type GmailThread = { id: string; historyId: string; messages?: GmailMsg[] };
  export type GmailThreadList = {
    threads: { historyId: string; id: string; snippet: string }[];
    nextPageToken: string;
    resultSizeEstimate: number;
  };
  export type GmailDraftCreate = { id: string };
  export type GmailDraftDelete = {}; // eslint-disable-line @typescript-eslint/ban-types
  export type GmailDraftUpdate = {}; // eslint-disable-line @typescript-eslint/ban-types
  export type GmailDraftGet = { id: string; message: GmailMsg };
  export type GmailDraftMeta = { id: string; message: { id: string; threadId: string } };
  export type GmailDraftList = { drafts: GmailDraftMeta[]; nextPageToken: string };
  export type GmailDraftSend = {}; // eslint-disable-line @typescript-eslint/ban-types
  export type GmailAliases = { sendAs: GmailAliases$sendAs[] };
  type GmailAliases$sendAs = {
    sendAsEmail: string;
    displayName: string;
    replyToAddress: string;
    signature: string;
    isDefault: boolean;
    treatAsAlias: boolean;
    verificationStatus: string;
    isPrimary?: true;
  };

  /* eslint-disable @typescript-eslint/naming-convention */
  export type OpenId = {
    // 'name' is the full name, picture is url
    at_hash: string;
    exp: number;
    iat: number;
    sub: string;
    aud: string;
    azp: string;
    iss: 'https://accounts.google.com';
    name: string;
    picture: string;
    locale: 'en' | string;
    family_name: string;
    given_name: string;
    email?: string;
    email_verified?: boolean;
  };
  /* eslint-enable @typescript-eslint/naming-convention */

  export type GoogleContacts = {
    results: {
      person?: {
        emailAddresses?: {
          metadata: {
            primary: boolean;
          };
          value: string;
        }[];
        names?: {
          metadata: {
            primary: boolean;
          };
          displayName: string;
        }[];
      };
    }[];
  };
}

export class GmailParser {
  public static findHeader = (apiGmailMsgObj: GmailRes.GmailMsg | GmailRes.GmailMsg$payload, headerName: string) => {
    const node: GmailRes.GmailMsg$payload = apiGmailMsgObj.hasOwnProperty('payload')
      ? (apiGmailMsgObj as GmailRes.GmailMsg).payload! // eslint-disable-line @typescript-eslint/no-non-null-assertion
      : (apiGmailMsgObj as GmailRes.GmailMsg$payload);
    if (typeof node.headers !== 'undefined') {
      for (const header of node.headers) {
        if (header.name.toLowerCase() === headerName.toLowerCase()) {
          return header.value;
        }
      }
    }
    return undefined;
  };

  public static findAttachments = (
    msgOrPayloadOrPart: GmailRes.GmailMsg | GmailRes.GmailMsg$payload | GmailRes.GmailMsg$payload$part,
    internalMsgId: string,
    internalResults: Attachment[] = [],
    { pgpEncryptedIndex }: { pgpEncryptedIndex?: number } = {}
  ) => {
    if (msgOrPayloadOrPart.hasOwnProperty('payload')) {
      internalMsgId = (msgOrPayloadOrPart as GmailRes.GmailMsg).id;
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      GmailParser.findAttachments((msgOrPayloadOrPart as GmailRes.GmailMsg).payload!, internalMsgId, internalResults);
    }
    if (msgOrPayloadOrPart.hasOwnProperty('parts')) {
      const payload = msgOrPayloadOrPart as GmailRes.GmailMsg$payload;
      const contentType = payload.headers?.find(x => x.name.toLowerCase() === 'content-type');
      const parts = payload.parts!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
      // are we dealing with a PGP/MIME encrypted message?
      const pgpEncrypted = Boolean(
        parts.length === 2 && contentType?.value?.startsWith('multipart/encrypted;') && contentType.value.includes('protocol="application/pgp-encrypted"')
      );
      for (const [i, part] of parts.entries()) {
        GmailParser.findAttachments(part, internalMsgId, internalResults, {
          pgpEncryptedIndex: pgpEncrypted ? i : undefined,
        });
      }
    }
    /* eslint-disable @typescript-eslint/no-non-null-assertion */
    if (msgOrPayloadOrPart.hasOwnProperty('body') && (msgOrPayloadOrPart as GmailRes.GmailMsg$payload$part).body!.hasOwnProperty('attachmentId')) {
      const payload = msgOrPayloadOrPart as GmailRes.GmailMsg$payload;
      const treatAs = Attachment.treatAsForPgpEncryptedAttachments(payload.mimeType, pgpEncryptedIndex);
      internalResults.push(
        new Attachment({
          msgId: internalMsgId,
          id: (msgOrPayloadOrPart as GmailRes.GmailMsg$payload$part).body!.attachmentId,
          length: (msgOrPayloadOrPart as GmailRes.GmailMsg$payload$part).body!.size,
          name: (msgOrPayloadOrPart as GmailRes.GmailMsg$payload$part).filename,
          type: (msgOrPayloadOrPart as GmailRes.GmailMsg$payload$part).mimeType,
          treatAs,
          inline: (GmailParser.findHeader(msgOrPayloadOrPart, 'content-disposition') || '').toLowerCase().indexOf('inline') === 0,
        })
      );
      /* eslint-enable @typescript-eslint/no-non-null-assertion */
    }
    return internalResults;
  };

  public static findBodies = (
    gmailMsg: GmailRes.GmailMsg | GmailRes.GmailMsg$payload | GmailRes.GmailMsg$payload$part,
    internalResults: SendableMsgBody = {}
  ): SendableMsgBody => {
    const isGmailMsgWithPayload = (v: unknown): v is GmailRes.GmailMsg => !!v && typeof (v as GmailRes.GmailMsg).payload !== 'undefined';
    const isGmailMsgPayload = (v: unknown): v is GmailRes.GmailMsg$payload => !!v && typeof (v as GmailRes.GmailMsg$payload).parts !== 'undefined';
    const isGmailMsgPayloadPart = (v: unknown): v is GmailRes.GmailMsg$payload$part => !!v && typeof (v as GmailRes.GmailMsg$payload$part).body !== 'undefined';
    if (isGmailMsgWithPayload(gmailMsg)) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      GmailParser.findBodies(gmailMsg.payload!, internalResults);
    }
    if (isGmailMsgPayload(gmailMsg) && gmailMsg.parts) {
      for (const part of gmailMsg.parts) {
        GmailParser.findBodies(part, internalResults);
      }
    }
    if (isGmailMsgPayloadPart(gmailMsg) && gmailMsg.body && typeof gmailMsg.body.data !== 'undefined' && gmailMsg.body.size !== 0) {
      if (gmailMsg.mimeType) {
        internalResults[gmailMsg.mimeType] = gmailMsg.body.data;
      }
    }
    return internalResults;
  };

  public static determineReplyMeta = (acctEmail: string, addresses: string[], lastGmailMsg: GmailRes.GmailMsg): ReplyParams => {
    const subject = GmailParser.findHeader(lastGmailMsg, 'subject') || '';
    const headers = {
      from: Str.parseEmail(GmailParser.findHeader(lastGmailMsg, 'from') || '').email,
      to: GmailParser.getAddressesHeader(lastGmailMsg, 'to'),
      // Do not add your emails and aliases to CC and BCC, maybe it's incorrect to filter them here,
      // maybe would be better to return from this method all emails addresses and then filter them in another place
      cc: GmailParser.getAddressesHeader(lastGmailMsg, 'cc').filter(e => !addresses.includes(e)),
      bcc: GmailParser.getAddressesHeader(lastGmailMsg, 'bcc').filter(e => !addresses.includes(e)),
      replyTo: GmailParser.getAddressesHeader(lastGmailMsg, 'reply-to').filter(e => !addresses.includes(e)),
      subject: Mime.subjectWithoutPrefixes(subject),
    };
    let to = Value.arr.unique([...headers.to, ...headers.replyTo]);
    if (headers.from && !to.includes(headers.from) && !FLOWCRYPT_REPLY_EMAIL_ADDRESSES.includes(headers.from)) {
      to.unshift(headers.from);
    }
    const acctEmailAliasesInMsg = [...to, ...headers.cc, ...headers.bcc].filter(e => addresses.includes(e));
    let myEmail = acctEmail;
    if (acctEmailAliasesInMsg.length && !acctEmailAliasesInMsg.includes(acctEmail)) {
      myEmail = acctEmailAliasesInMsg[0];
    }
    if (headers.from !== myEmail || subject.startsWith('Re: ')) {
      const replyToWithoutMyEmail = to.filter(e => myEmail !== e); // thinking about moving it in another place
      if (replyToWithoutMyEmail.length) {
        // when user sends emails it itself here will be 0 elements
        to = replyToWithoutMyEmail;
      }
    }
    return { to, cc: headers.cc, bcc: headers.bcc, myEmail, from: headers.from, subject: headers.subject };
  };

  private static getAddressesHeader = (gmailMsg: GmailRes.GmailMsg, headerName: RecipientType | 'reply-to') => {
    // todo: keep names in email addresses?
    return Value.arr.unique(
      (GmailParser.findHeader(gmailMsg, headerName) || '')
        .split(',')
        .map(e => Str.parseEmail(e).email!) // eslint-disable-line @typescript-eslint/no-non-null-assertion
        .filter(e => !!e)
    );
  };
}
