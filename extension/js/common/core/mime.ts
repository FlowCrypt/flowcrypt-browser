/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Str, Value, Dict } from './common.js';
import { Pgp, KeyDetails, DecryptError } from './pgp.js';
import { Att, AttMeta } from './att.js';
import { Catch } from '../platform/catch.js';
import { requireMimeParser, requireMimeBuilder, requireIso88592 } from '../platform/require.js';
import { Buf } from './buf.js';

const MimeParser = requireMimeParser();  // tslint:disable-line:variable-name
const MimeBuilder = requireMimeBuilder();  // tslint:disable-line:variable-name
const Iso88592 = requireIso88592();  // tslint:disable-line:variable-name

type MimeContentHeader = string | { address: string; name: string; }[];
type MimeContent = {
  headers: Dict<MimeContentHeader>;
  atts: Att[];
  signature?: string;
  html?: string;
  text?: string;
  from?: string;
  to: string[];
};
type MimeParserNode = {
  path: string[];
  headers: { [key: string]: { value: string; initial: string; params?: { charset?: string, filename?: string, name?: string } }[]; };
  rawContent: string;
  content: Uint8Array;
  appendChild: (child: MimeParserNode) => void;
  contentTransferEncoding: { value: string }; charset?: string;
  addHeader: (name: string, value: string) => void;
};

export type RichHeaders = Dict<string | string[]>;
export type SendableMsgBody = { [key: string]: string | undefined; 'text/plain'?: string; 'text/html'?: string; };
export type KeyBlockType = 'publicKey' | 'privateKey';
export type ReplaceableMsgBlockType = KeyBlockType | 'attestPacket' | 'cryptupVerification' | 'signedMsg' | 'encryptedMsg' | 'encryptedMsgLink';
export type MsgBlockType = 'plainText' | 'decryptedText' | 'plainHtml' | 'decryptedHtml' | 'plainAtt' | 'encryptedAtt' | 'decryptedAtt' | 'encryptedAttLink'
  | 'decryptErr' | ReplaceableMsgBlockType;
export type MsgBlock = {
  type: MsgBlockType;
  content: string | Buf;
  complete: boolean;
  signature?: string;
  keyDetails?: KeyDetails; // only in publicKey when returned to Android (could eventually be made mandatory, done straight in detectBlocks?)
  attMeta?: AttMeta; // only in plainAtt, encryptedAtt, decryptedAtt, encryptedAttLink (not sure if always)
  decryptErr?: DecryptError; // only in decryptErr block, always
};
type MimeParseSignedRes = { full: string, signed?: string, signature?: string };

export class Mime {

  public static process = async (mimeMsg: Uint8Array) => {
    const decoded = await Mime.decode(mimeMsg);
    const blocks: MsgBlock[] = [];
    if (decoded.text) {  // may be undefined or empty
      blocks.push(...Pgp.armor.detectBlocks(decoded.text).blocks);
    } else if (decoded.html) {
      blocks.push(Pgp.internal.msgBlockObj('plainHtml', decoded.html));
    }
    for (const file of decoded.atts) {
      const treatAs = file.treatAs();
      if (treatAs === 'encryptedMsg') {
        const armored = Pgp.armor.clip(file.getData().toUtfStr());
        if (armored) {
          blocks.push(Pgp.internal.msgBlockObj('encryptedMsg', armored));
        }
      } else if (treatAs === 'signature') {
        decoded.signature = decoded.signature || file.getData().toUtfStr();
      } else if (treatAs === 'publicKey') {
        blocks.push(...Pgp.armor.detectBlocks(file.getData().toUtfStr()).blocks);
      }
    }
    if (decoded.signature) {
      for (const block of blocks) {
        if (block.type === 'plainText') {
          block.type = 'signedMsg';
          block.signature = decoded.signature;
        }
      }
    }
    return { headers: decoded.headers, blocks, from: decoded.from, to: decoded.to };
  }

  private static headersToFrom = (parsedMimeMsg: MimeContent) => {
    const headerTo: string[] = [];
    let headerFrom;
    if (Array.isArray(parsedMimeMsg.headers.from) && parsedMimeMsg.headers.from[0] && parsedMimeMsg.headers.from[0].address) {
      headerFrom = parsedMimeMsg.headers.from[0].address;
    }
    if (Array.isArray(parsedMimeMsg.headers.to)) {
      for (const to of parsedMimeMsg.headers.to) {
        if (to.address) {
          headerTo.push(String(to.address));
        }
      }
    }
    return { from: headerFrom, to: headerTo };
  }

  public static replyHeaders = (parsedMimeMsg: MimeContent) => {
    const msgId = String(parsedMimeMsg.headers['message-id'] || '');
    const refs = String(parsedMimeMsg.headers['in-reply-to'] || '');
    return { 'in-reply-to': msgId, 'references': refs + ' ' + msgId };
  }

  public static resemblesMsg = (msg: Uint8Array) => {
    const utf8 = new Buf(msg.slice(0, 1000)).toUtfStr().toLowerCase();
    const contentType = utf8.match(/content-type: +[0-9a-z\-\/]+/);
    if (!contentType) {
      return false;
    }
    if (utf8.match(/content-transfer-encoding: +[0-9a-z\-\/]+/) || utf8.match(/content-disposition: +[0-9a-z\-\/]+/) || utf8.match(/; boundary=/) || utf8.match(/; charset=/)) {
      return true;
    }
    return Boolean(contentType.index === 0 && utf8.match(/boundary=/));
  }

  public static decode = (mimeMsg: Uint8Array): Promise<MimeContent> => {
    return new Promise(async resolve => {
      const mimeContent: MimeContent = { atts: [], headers: {}, text: undefined, html: undefined, signature: undefined, from: undefined, to: [] };
      try {
        const parser = new MimeParser(); // tslint:disable-line:no-unsafe-any
        const parsed: { [key: string]: MimeParserNode } = {};
        parser.onheader = (node: MimeParserNode) => { // tslint:disable-line:no-unsafe-any
          if (!String(node.path.join('.'))) { // root node headers
            for (const name of Object.keys(node.headers)) {
              mimeContent.headers[name] = node.headers[name][0].value;
            }
          }
        };
        parser.onbody = (node: MimeParserNode) => { // tslint:disable-line:no-unsafe-any
          const path = String(node.path.join('.'));
          if (typeof parsed[path] === 'undefined') {
            parsed[path] = node;
          }
        };
        parser.onend = () => { // tslint:disable-line:no-unsafe-any
          for (const node of Object.values(parsed)) {
            if (Mime.getNodeType(node) === 'application/pgp-signature') {
              mimeContent.signature = node.rawContent;
            } else if (Mime.getNodeType(node) === 'text/html' && !Mime.getNodeFilename(node)) {
              // html content may be broken up into smaller pieces by attachments in between
              // AppleMail does this with inline attachments
              mimeContent.html = (mimeContent.html || '') + Mime.getNodeContentAsUtfStr(node);
            } else if (Mime.getNodeType(node) === 'text/plain' && !Mime.getNodeFilename(node)) {
              mimeContent.text = Mime.getNodeContentAsUtfStr(node);
            } else if (Mime.getNodeType(node) === 'text/rfc822-headers') {
              // todo - surface and render encrypted headers
            } else {
              mimeContent.atts.push(new Att({
                name: Mime.getNodeFilename(node),
                type: Mime.getNodeType(node),
                data: node.content,
                cid: Mime.getNodeContentId(node),
              }));
            }
          }
          const { from, to } = Mime.headersToFrom(mimeContent);
          mimeContent.from = from;
          mimeContent.to = to;
          resolve(mimeContent);
        };
        parser.write(mimeMsg); // tslint:disable-line:no-unsafe-any
        parser.end(); // tslint:disable-line:no-unsafe-any
      } catch (e) { // todo - on Android we may want to fail when this happens, evaluate effect on browser extension
        Catch.handleErr(e);
        resolve(mimeContent);
      }
    });
  }

  public static encode = async (body: string | SendableMsgBody, headers: RichHeaders, atts: Att[] = []): Promise<string> => {
    const rootNode = new MimeBuilder('multipart/mixed'); // tslint:disable-line:no-unsafe-any
    for (const key of Object.keys(headers)) {
      rootNode.addHeader(key, headers[key]); // tslint:disable-line:no-unsafe-any
    }
    if (typeof body === 'string') {
      body = { 'text/plain': body };
    }
    let contentNode: MimeParserNode;
    if (Object.keys(body).length === 1) {
      contentNode = Mime.newContentNode(MimeBuilder, Object.keys(body)[0], body[Object.keys(body)[0] as "text/plain" | "text/html"] || '');
    } else {
      contentNode = new MimeBuilder('multipart/alternative'); // tslint:disable-line:no-unsafe-any
      for (const type of Object.keys(body)) {
        contentNode.appendChild(Mime.newContentNode(MimeBuilder, type, body[type]!)); // already present, that's why part of for loop
      }
    }
    rootNode.appendChild(contentNode); // tslint:disable-line:no-unsafe-any
    for (const att of atts) {
      const type = `${att.type}; name="${att.name}"`;
      const id = `f_${Str.sloppyRandom(30)}@flowcrypt`;
      const header = { 'Content-Disposition': 'attachment', 'X-Attachment-Id': id, 'Content-ID': `<${id}>`, 'Content-Transfer-Encoding': 'base64' };
      rootNode.appendChild(new MimeBuilder(type, { filename: att.name }).setHeader(header).setContent(att.getData())); // tslint:disable-line:no-unsafe-any
    }
    return rootNode.build(); // tslint:disable-line:no-unsafe-any
  }

  public static signed = (mimeMsgBytes: Buf) => {
    /*
      Trying to grab the full signed content that may look like this in its entirety (it's a signed mime message. May also be signed plain text)
      Unfortunately, emailjs-mime-parser was not able to do this, or I wasn't able to use it properly

      --eSmP07Gus5SkSc9vNmF4C0AutMibfplSQ
      Content-Type: multipart/mixed; boundary="XKKJ27hlkua53SDqH7d1IqvElFHJROQA1"
      From: Henry Electrum <henry.electrum@gmail.com>
      To: human@flowcrypt.com
      Message-ID: <abd68ba1-35c3-ee8a-0d60-0319c608d56b@gmail.com>
      Subject: compatibility - simples signed email

      --XKKJ27hlkua53SDqH7d1IqvElFHJROQA1
      Content-Type: text/plain; charset=utf-8
      Content-Transfer-Encoding: quoted-printable

      content

      --XKKJ27hlkua53SDqH7d1IqvElFHJROQA1--
      */
    let mimeMsg = mimeMsgBytes.toUtfStr();
    const signedHeaderIndex = mimeMsg.substr(0, 100000).toLowerCase().indexOf('content-type: multipart/signed');
    if (signedHeaderIndex !== -1) {
      mimeMsg = mimeMsg.substr(signedHeaderIndex);
      const firstBoundaryIndex = mimeMsg.substr(0, 1000).toLowerCase().indexOf('boundary=');
      if (firstBoundaryIndex) {
        let boundary = mimeMsg.substr(firstBoundaryIndex, 100);
        boundary = (boundary.match(/boundary="[^"]{1,70}"/gi) || boundary.match(/boundary=[a-z0-9][a-z0-9 ]{0,68}[a-z0-9]/gi) || [])[0];
        if (boundary) {
          boundary = boundary.replace(/^boundary="?|"$/gi, '');
          const boundaryBegin = '\r\n--' + boundary + '\r\n';
          const boundaryEnd = '--' + boundary + '--';
          const endIndex = mimeMsg.indexOf(boundaryEnd);
          if (endIndex !== -1) {
            mimeMsg = mimeMsg.substr(0, endIndex + boundaryEnd.length);
            if (mimeMsg) {
              const res: MimeParseSignedRes = { full: mimeMsg };
              let firstPartStartIndex = mimeMsg.indexOf(boundaryBegin);
              if (firstPartStartIndex !== -1) {
                firstPartStartIndex += boundaryBegin.length;
                const firstPartEndIndex = mimeMsg.indexOf(boundaryBegin, firstPartStartIndex);
                const secondPartStartIndex = firstPartEndIndex + boundaryBegin.length;
                const secondPartEndIndex = mimeMsg.indexOf(boundaryEnd, secondPartStartIndex);
                if (secondPartEndIndex !== -1) {
                  const firstPart = mimeMsg.substr(firstPartStartIndex, firstPartEndIndex - firstPartStartIndex);
                  const secondPart = mimeMsg.substr(secondPartStartIndex, secondPartEndIndex - secondPartStartIndex);
                  const beginSignature = Pgp.armor.headers('signedMsg').middle;
                  const endSignature = String(Pgp.armor.headers('signedMsg').end);
                  if (firstPart.match(/^content-type: application\/pgp-signature/gi) && Value.is(beginSignature).in(firstPart) && Value.is(endSignature).in(firstPart)) {
                    res.signature = Pgp.armor.clip(firstPart);
                    res.signed = secondPart;
                  } else {
                    res.signature = Pgp.armor.clip(secondPart);
                    res.signed = firstPart;
                  }
                  return res;
                }
              }
            }
          }
        }
      }
    }
    return undefined;
  }

  private static getNodeType = (node: MimeParserNode) => {
    if (node.headers['content-type'] && node.headers['content-type'][0]) {
      return node.headers['content-type'][0].value;
    }
    return undefined;
  }

  private static getNodeContentId = (node: MimeParserNode) => {
    if (node.headers['content-id'] && node.headers['content-id'][0]) {
      return node.headers['content-id'][0].value;
    }
    return undefined;
  }

  private static getNodeFilename = (node: MimeParserNode): string | undefined => {
    if (node.headers['content-disposition'] && node.headers['content-disposition'][0]) {
      const header = node.headers['content-disposition'][0];
      if (header.params && header.params.filename) {
        return String(header.params.filename);
      }
    }
    if (node.headers['content-type'] && node.headers['content-type'][0]) {
      const header = node.headers['content-type'][0];
      if (header.params && header.params.name) {
        return String(header.params.name);
      }
    }
    return;
  }

  private static fromEqualSignNotationAsUtf = (str: string): string => {
    return str.replace(/(=[A-F0-9]{2})+/g, equalSignUtfPart => {
      const bytes = equalSignUtfPart.replace(/^=/, '').split('=').map(twoHexDigits => parseInt(twoHexDigits, 16));
      return new Buf(bytes).toUtfStr();
    });
  }

  private static getNodeContentAsUtfStr = (node: MimeParserNode): string => {
    if (node.charset === 'utf-8' && node.contentTransferEncoding.value === 'base64') {
      return Buf.fromUint8(node.content).toUtfStr();
    }
    if (node.charset === 'utf-8' && node.contentTransferEncoding.value === 'quoted-printable') {
      return Mime.fromEqualSignNotationAsUtf(node.rawContent);
    }
    if (node.charset === 'iso-8859-2') { // todo - use iso88592.labels for detection
      return Iso88592.decode(node.rawContent); // tslint:disable-line:no-unsafe-any
    }
    return Buf.fromRawBytesStr(node.rawContent).toUtfStr();
  }

  // tslint:disable-next-line:variable-name
  private static newContentNode = (MimeBuilder: any, type: string, content: string): MimeParserNode => {
    const node: MimeParserNode = new MimeBuilder(type).setContent(content); // tslint:disable-line:no-unsafe-any
    if (type === 'text/plain') {
      // gmail likes this
      node.addHeader('Content-Transfer-Encoding', 'quoted-printable'); // tslint:disable-line:no-unsafe-any
    }
    return node;
  }

}
