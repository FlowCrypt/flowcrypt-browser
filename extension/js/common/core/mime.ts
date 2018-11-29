/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Str, Value, Dict } from './common.js';
import { Pgp } from './pgp.js';
import { Att } from './att.js';
import { Catch } from '../platform/catch.js';

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
export type ReplaceableMsgBlockType = KeyBlockType | 'attestPacket' | 'cryptupVerification' | 'signedMsg' | 'message' | 'passwordMsg';
export type MsgBlockType = 'text' | ReplaceableMsgBlockType;
export type MsgBlock = { type: MsgBlockType; content: string; complete: boolean; signature?: string; };
type MimeParseSignedRes = { full: string, signed?: string, signature?: string };

export class Mime {

  public static process = async (mimeMsg: string) => {
    const decoded = await Mime.decode(mimeMsg);
    let blocks: MsgBlock[] = [];
    if (decoded.text) {  // may be undefined or empty
      blocks = blocks.concat(Pgp.armor.detectBlocks(decoded.text).blocks);
    }
    for (const file of decoded.atts) {
      const treatAs = file.treatAs();
      if (treatAs === 'message') {
        const armored = Pgp.armor.clip(file.asText());
        if (armored) {
          blocks.push(Pgp.internal.cryptoArmorBlockObj('message', armored));
        }
      } else if (treatAs === 'signature') {
        decoded.signature = decoded.signature || file.asText();
      } else if (treatAs === 'publicKey') {
        blocks = blocks.concat(Pgp.armor.detectBlocks(file.asText()).blocks);
      }
    }
    if (decoded.signature) {
      for (const block of blocks) {
        if (block.type === 'text') {
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
    const msgId = parsedMimeMsg.headers['message-id'] || '';
    const refs = parsedMimeMsg.headers['in-reply-to'] || '';
    return { 'in-reply-to': msgId, 'references': refs + ' ' + msgId };
  }

  public static resemblesMsg = (msg: string | Uint8Array) => {
    let m = msg.slice(0, 1000);
    // noinspection SuspiciousInstanceOfGuard
    if (m instanceof Uint8Array) {
      m = Str.fromUint8(m);
    }
    m = m.toLowerCase();
    const contentType = m.match(/content-type: +[0-9a-z\-\/]+/);
    if (!contentType) {
      return false;
    }
    if (m.match(/content-transfer-encoding: +[0-9a-z\-\/]+/) || m.match(/content-disposition: +[0-9a-z\-\/]+/) || m.match(/; boundary=/) || m.match(/; charset=/)) {
      return true;
    }
    return Boolean(contentType.index === 0 && m.match(/boundary=/));
  }

  public static decode = (mimeMsg: string): Promise<MimeContent> => {
    return new Promise(async resolve => {
      const mimeContent: MimeContent = { atts: [], headers: {}, text: undefined, html: undefined, signature: undefined, from: undefined, to: [] };
      try {
        const parser = new (window as any)['emailjs-mime-parser'](); // tslint:disable-line:no-unsafe-any
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
              mimeContent.html = (mimeContent.html || '') + Mime.getNodeContentAsText(node);
            } else if (Mime.getNodeType(node) === 'text/plain' && !Mime.getNodeFilename(node)) {
              mimeContent.text = Mime.getNodeContentAsText(node);
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
      } catch (e) {
        Catch.handleErr(e);
        resolve(mimeContent);
      }
    });
  }

  public static encode = async (body: string | SendableMsgBody, headers: RichHeaders, atts: Att[] = []): Promise<string> => {
    const MimeBuilder = (window as any)['emailjs-mime-builder']; // tslint:disable-line:variable-name
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
      const header = { 'Content-Disposition': 'attachment', 'X-Att-Id': `f_${Str.sloppyRandom(10)}`, 'Content-Transfer-Encoding': 'base64' };
      rootNode.appendChild(new MimeBuilder(type, { filename: att.name }).setHeader(header).setContent(att.data())); // tslint:disable-line:no-unsafe-any
    }
    return rootNode.build(); // tslint:disable-line:no-unsafe-any
  }

  public static signed = (mimeMsg: string) => {
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

  private static getNodeContentAsText = (node: MimeParserNode): string => {
    if (node.charset === 'utf-8' && node.contentTransferEncoding.value === 'base64') {
      return Str.uint8AsUtf(node.content);
    }
    if (node.charset === 'utf-8' && node.contentTransferEncoding.value === 'quoted-printable') {
      return Str.fromEqualSignNotationAsUtf(node.rawContent);
    }
    if (node.charset === 'iso-8859-2') { // todo - use iso88592.labels for detection
      return (window as any).iso88592.decode(node.rawContent); // tslint:disable-line:no-unsafe-any
    }
    return node.rawContent;
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
