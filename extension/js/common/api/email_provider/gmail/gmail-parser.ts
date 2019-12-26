/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Mime, SendableMsgBody } from '../../../core/mime.js';
import { Str, Value } from '../../../core/common.js';

import { Att } from '../../../core/att.js';
import { Buf } from '../../../core/buf.js';
import { RecipientType } from '../../api.js';
import { ReplyParams } from '../email_provider_api.js';

export namespace GmailRes { // responses

  export type GmailMsg$header = { name: string, value: string };
  export type GmailMsg$payload$body = { attachmentId: string, size: number, data?: string };
  export type GmailMsg$payload$part = { body?: GmailMsg$payload$body, filename?: string, mimeType?: string, headers?: GmailMsg$header[] };
  export type GmailMsg$payload = { parts?: GmailMsg$payload$part[], headers?: GmailMsg$header[], mimeType?: string, body?: GmailMsg$payload$body };
  export type GmailMsg$labelId = 'INBOX' | 'UNREAD' | 'CATEGORY_PERSONAL' | 'IMPORTANT' | 'SENT' | 'CATEGORY_UPDATES' | 'TRASH';
  export type GmailMsg = {
    id: string; historyId: string; threadId?: string | null; payload?: GmailMsg$payload; internalDate?: number | string;
    labelIds?: GmailMsg$labelId[]; snippet?: string; raw?: string;
  };
  export type GmailMsgList$message = { id: string, threadId: string };
  export type GmailMsgList = { messages?: GmailMsgList$message[], resultSizeEstimate: number, nextPageToken?: string };
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
  export type GmailDraftMeta = { id: string, message: { id: string, threadId: string } };
  export type GmailDraftList = { drafts: GmailDraftMeta[], nextPageToken: string };
  export type GmailDraftSend = {};
  export type GmailAliases = { sendAs: GmailAliases$sendAs[] };
  type GmailAliases$sendAs = {
    sendAsEmail: string, displayName: string, replyToAddress: string, signature: string,
    isDefault: boolean, treatAsAlias: boolean, verificationStatus: string, isPrimary?: true
  };

  export type OpenId = { // 'name' is the full name, picture is url
    at_hash: string; exp: number; iat: number; sub: string; aud: string; azp: string; iss: "https://accounts.google.com";
    name: string; picture: string; locale: 'en' | string; family_name: string; given_name: string;
    email?: string, email_verified?: boolean;
  };

  export type GoogleContacts = {
    feed: {
      entry?: {
        gd$email?: {
          address: string,
          primary: string
        }[],
        gd$name?: {
          gd$fullName?: {
            $t: string
          }
        }
      }[]
    }
  };

}

export class GmailParser {

  private static getAddressesHeader = (gmailMsg: GmailRes.GmailMsg, headerName: RecipientType) => {
    return Value.arr.unique((GmailParser.findHeader(gmailMsg, headerName) || '').split(',').map(e => Str.parseEmail(e).email!).filter(e => !!e));
  }

  static findHeader = (apiGmailMsgObj: GmailRes.GmailMsg | GmailRes.GmailMsg$payload, headerName: string) => {
    const node: GmailRes.GmailMsg$payload = apiGmailMsgObj.hasOwnProperty('payload') ? (apiGmailMsgObj as GmailRes.GmailMsg).payload! : apiGmailMsgObj as GmailRes.GmailMsg$payload;
    if (typeof node.headers !== 'undefined') {
      for (const header of node.headers) {
        if (header.name.toLowerCase() === headerName.toLowerCase()) {
          return header.value;
        }
      }
    }
    return undefined;
  }

  static findAtts = (msgOrPayloadOrPart: GmailRes.GmailMsg | GmailRes.GmailMsg$payload | GmailRes.GmailMsg$payload$part, internalResults: Att[] = [], internalMsgId?: string) => {
    if (msgOrPayloadOrPart.hasOwnProperty('payload')) {
      internalMsgId = (msgOrPayloadOrPart as GmailRes.GmailMsg).id;
      GmailParser.findAtts((msgOrPayloadOrPart as GmailRes.GmailMsg).payload!, internalResults, internalMsgId);
    }
    if (msgOrPayloadOrPart.hasOwnProperty('parts')) {
      for (const part of (msgOrPayloadOrPart as GmailRes.GmailMsg$payload).parts!) {
        GmailParser.findAtts(part, internalResults, internalMsgId);
      }
    }
    if (msgOrPayloadOrPart.hasOwnProperty('body') && (msgOrPayloadOrPart as GmailRes.GmailMsg$payload$part).body!.hasOwnProperty('attachmentId')) {
      internalResults.push(new Att({
        msgId: internalMsgId,
        id: (msgOrPayloadOrPart as GmailRes.GmailMsg$payload$part).body!.attachmentId,
        length: (msgOrPayloadOrPart as GmailRes.GmailMsg$payload$part).body!.size,
        name: (msgOrPayloadOrPart as GmailRes.GmailMsg$payload$part).filename,
        type: (msgOrPayloadOrPart as GmailRes.GmailMsg$payload$part).mimeType,
        inline: (GmailParser.findHeader(msgOrPayloadOrPart, 'content-disposition') || '').toLowerCase().indexOf('inline') === 0,
      }));
    }
    return internalResults;
  }

  static findBodies = (gmailMsg: GmailRes.GmailMsg | GmailRes.GmailMsg$payload | GmailRes.GmailMsg$payload$part, internalResults: SendableMsgBody = {}): SendableMsgBody => {
    const isGmailMsgWithPayload = (v: any): v is GmailRes.GmailMsg => v && typeof (v as GmailRes.GmailMsg).payload !== 'undefined';
    const isGmailMsgPayload = (v: any): v is GmailRes.GmailMsg$payload => v && typeof (v as GmailRes.GmailMsg$payload).parts !== 'undefined';
    const isGmailMsgPayloadPart = (v: any): v is GmailRes.GmailMsg$payload$part => v && typeof (v as GmailRes.GmailMsg$payload$part).body !== 'undefined';
    if (isGmailMsgWithPayload(gmailMsg)) {
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
  }

  static determineReplyMeta = (acctEmail: string, addresses: string[], lastGmailMsg: GmailRes.GmailMsg): ReplyParams => {
    const headers = {
      from: Str.parseEmail(GmailParser.findHeader(lastGmailMsg, 'from') || '').email,
      to: GmailParser.getAddressesHeader(lastGmailMsg, 'to'),
      // Do not add your emails and aliases to CC and BCC, maybe it's incorrect to filter them here,
      // maybe would be better to return from this method all emails addresses and then filter them in another place
      cc: GmailParser.getAddressesHeader(lastGmailMsg, 'cc').filter(e => !addresses.includes(e)),
      bcc: GmailParser.getAddressesHeader(lastGmailMsg, 'bcc').filter(e => !addresses.includes(e)),
      replyTo: GmailParser.findHeader(lastGmailMsg, 'reply-to'),
      subject: Mime.subjectWithoutPrefixes(GmailParser.findHeader(lastGmailMsg, 'subject') || ''),
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
      return { to: [headers.replyTo], cc: [], bcc: [], from: myEmail, subject: headers.subject };
    }
    const replyToWithoutMyEmail = headers.to.filter(e => myEmail !== e); // thinking about moving it in another place
    if (replyToWithoutMyEmail.length) { // when user sends emails it itself here will be 0 elements
      headers.to = replyToWithoutMyEmail;
    }
    return { to: headers.to, cc: headers.cc, bcc: headers.bcc, from: myEmail, subject: headers.subject };
  }

}
