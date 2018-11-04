/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Str, Value, Catch } from './common.js';
import { SendableMsgBody, RichHeaders, FlatHeaders } from './api.js';
import { Pgp } from './pgp.js';
import { Att } from './att.js';
import { BrowserWidnow, FcWindow, AnyThirdPartyLibrary } from './extension.js';

type MimeContent = { headers: FlatHeaders; atts: Att[]; signature: string|undefined; html: string|undefined; text: string|undefined; };
type MimeParserNode = { path: string[]; headers: { [key: string]: {value: string}[]; }; rawContent: string; content: Uint8Array;
  appendChild: (child: MimeParserNode) => void; contentTransferEncoding: {value: string}; charset?: string; };

export type KeyBlockType = 'publicKey'|'privateKey';
export type ReplaceableMsgBlockType = KeyBlockType|'attestPacket'|'cryptupVerification'|'signedMsg'|'message'|'passwordMsg';
export type MsgBlockType = 'text'|ReplaceableMsgBlockType;
export type MsgBlock = { type: MsgBlockType; content: string; complete: boolean; signature?: string; };
export type FromToHeaders = { from: string; to: string[]; };

export class Mime {

  public static process = async (mimeMsg: string) => {
    let decoded = await Mime.decode(mimeMsg);
    let blocks: MsgBlock[] = [];
    if (decoded.text) {  // may be undefined or empty
      blocks = blocks.concat(Pgp.armor.detectBlocks(decoded.text).blocks);
    }
    for (let file of decoded.atts) {
      let treatAs = file.treatAs();
      if (treatAs === 'message') {
        let armored = Pgp.armor.clip(file.asText());
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
      for (let block of blocks) {
        if (block.type === 'text') {
          block.type = 'signedMsg';
          block.signature = decoded.signature;
        }
      }
    }
    return {headers: decoded.headers, blocks};
  }

  public static headersToFrom = (parsedMimeMsg: MimeContent): FromToHeaders => {
    let headerTo: string[] = [];
    let headerFrom;
    // @ts-ignore - I should check this - does it really have .address?
    if (parsedMimeMsg.headers.from && parsedMimeMsg.headers.from.length && parsedMimeMsg.headers.from[0] && parsedMimeMsg.headers.from[0].address) {
      // @ts-ignore - I should check this - does it really have .address?
      headerFrom = parsedMimeMsg.headers.from[0].address;
    }
    if (parsedMimeMsg.headers.to && parsedMimeMsg.headers.to.length) {
      for (let to of parsedMimeMsg.headers.to) {
        // @ts-ignore - I should check this - does it really have .address?
        if (to.address) {
          // @ts-ignore - I should check this - does it really have .address?
          headerTo.push(to.address);
        }
      }
    }
    return { from: headerFrom, to: headerTo };
  }

  public static replyHeaders = (parsedMimeMsg: MimeContent) => {
    let msgId = parsedMimeMsg.headers['message-id'] || '';
    let refs = parsedMimeMsg.headers['in-reply-to'] || '';
    return { 'in-reply-to': msgId, 'references': refs + ' ' + msgId };
  }

  public static resemblesMsg = (msg: string|Uint8Array) => {
    let m = msg.slice(0, 1000);
    // noinspection SuspiciousInstanceOfGuard
    if (m instanceof Uint8Array) {
      m = Str.fromUint8(m);
    }
    m = m.toLowerCase();
    let contentType = m.match(/content-type: +[0-9a-z\-\/]+/);
    if (contentType === null) {
      return false;
    }
    if (m.match(/content-transfer-encoding: +[0-9a-z\-\/]+/) || m.match(/content-disposition: +[0-9a-z\-\/]+/) || m.match(/; boundary=/) || m.match(/; charset=/)) {
      return true;
    }
    return Boolean(contentType.index === 0 && m.match(/boundary=/));
  }

  public static decode = (mimeMsg: string): Promise<MimeContent> => {
    return new Promise(async resolve => {
      let mimeContent = {atts: [], headers: {} as FlatHeaders, text: undefined, html: undefined, signature: undefined} as MimeContent;
      try {
        let parser = new (window as BrowserWidnow)['emailjs-mime-parser']();
        let parsed: {[key: string]: MimeParserNode} = {};
        parser.onheader = (node: MimeParserNode) => {
          if (!String(node.path.join('.'))) { // root node headers
            for (let name of Object.keys(node.headers)) {
              mimeContent.headers[name] = node.headers[name][0].value;
            }
          }
        };
        parser.onbody = (node: MimeParserNode) => {
          let path = String(node.path.join('.'));
          if (typeof parsed[path] === 'undefined') {
            parsed[path] = node;
          }
        };
        parser.onend = () => {
          for (let node of Object.values(parsed)) {
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
          resolve(mimeContent);
        };
        parser.write(mimeMsg);
        parser.end();
      } catch (e) {
        Catch.handleException(e);
        resolve(mimeContent);
      }
    });
  }

  public static encode = async (body:string|SendableMsgBody, headers: RichHeaders, atts:Att[]=[]): Promise<string> => {
    let MimeBuilder = (window as BrowserWidnow)['emailjs-mime-builder']; // tslint:disable-line:variable-name
    let rootNode = new MimeBuilder('multipart/mixed');
    for (let key of Object.keys(headers)) {
      rootNode.addHeader(key, headers[key]);
    }
    if (typeof body === 'string') {
      body = {'text/plain': body};
    }
    let contentNode: MimeParserNode;
    if (Object.keys(body).length === 1) {
      contentNode = Mime.newContentNode(MimeBuilder, Object.keys(body)[0], body[Object.keys(body)[0] as "text/plain"|"text/html"] || '');
    } else {
      contentNode = new MimeBuilder('multipart/alternative');
      for (let type of Object.keys(body)) {
        contentNode.appendChild(Mime.newContentNode(MimeBuilder, type, body[type]!)); // already present, that's why part of for loop
      }
    }
    rootNode.appendChild(contentNode);
    for (let att of atts) {
      let type = `${att.type}; name="${att.name}"`;
      let header = {'Content-Disposition': 'attachment', 'X-Att-Id': `f_${Str.random(10)}`, 'Content-Transfer-Encoding': 'base64'};
      rootNode.appendChild(new MimeBuilder(type, { filename: att.name }).setHeader(header).setContent(att.data()));
    }
    return rootNode.build();
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
    let signedHeaderIndex = mimeMsg.substr(0, 100000).toLowerCase().indexOf('content-type: multipart/signed');
    if (signedHeaderIndex !== -1) {
      mimeMsg = mimeMsg.substr(signedHeaderIndex);
      let firstBoundaryIndex = mimeMsg.substr(0, 1000).toLowerCase().indexOf('boundary=');
      if (firstBoundaryIndex) {
        let boundary = mimeMsg.substr(firstBoundaryIndex, 100);
        boundary = (boundary.match(/boundary="[^"]{1,70}"/gi) || boundary.match(/boundary=[a-z0-9][a-z0-9 ]{0,68}[a-z0-9]/gi) || [])[0];
        if (boundary) {
          boundary = boundary.replace(/^boundary="?|"$/gi, '');
          let boundaryBegin = '\r\n--' + boundary + '\r\n';
          let boundaryEnd = '--' + boundary + '--';
          let endIndex = mimeMsg.indexOf(boundaryEnd);
          if (endIndex !== -1) {
            mimeMsg = mimeMsg.substr(0, endIndex + boundaryEnd.length);
            if (mimeMsg) {
              let res = { full: mimeMsg, signed: null as string|null, signature: null as string|null };
              let firstPartStartIndex = mimeMsg.indexOf(boundaryBegin);
              if (firstPartStartIndex !== -1) {
                firstPartStartIndex += boundaryBegin.length;
                let firstPartEndIndex = mimeMsg.indexOf(boundaryBegin, firstPartStartIndex);
                let secondPartStartIndex = firstPartEndIndex + boundaryBegin.length;
                let secondPartEndIndex = mimeMsg.indexOf(boundaryEnd, secondPartStartIndex);
                if (secondPartEndIndex !== -1) {
                  let firstPart = mimeMsg.substr(firstPartStartIndex, firstPartEndIndex - firstPartStartIndex);
                  let secondPart = mimeMsg.substr(secondPartStartIndex, secondPartEndIndex - secondPartStartIndex);
                  if (firstPart.match(/^content-type: application\/pgp-signature/gi) !== null && Value.is('-----BEGIN PGP SIGNATURE-----').in(firstPart) && Value.is('-----END PGP SIGNATURE-----').in(firstPart)) {
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
  }

  private static getNodeType = (node: MimeParserNode) => {
    if (node.headers['content-type'] && node.headers['content-type'][0]) {
      return node.headers['content-type'][0].value;
    }
  }

  private static getNodeContentId = (node: MimeParserNode) => {
    if (node.headers['content-id'] && node.headers['content-id'][0]) {
      return node.headers['content-id'][0].value;
    }
  }

  private static getNodeFilename = (node: MimeParserNode) => {
    // @ts-ignore - lazy
    if (node.headers['content-disposition'] && node.headers['content-disposition'][0] && node.headers['content-disposition'][0].params && node.headers['content-disposition'][0].params.filename) {
      // @ts-ignore - lazy
      return node.headers['content-disposition'][0].params.filename;
    }
    // @ts-ignore - lazy
    if (node.headers['content-type'] && node.headers['content-type'][0] && node.headers['content-type'][0].params && node.headers['content-type'][0].params.name) {
      // @ts-ignore - lazy
      return node.headers['content-type'][0].params.name;
    }
  }

  private static getNodeContentAsText = (node: MimeParserNode): string => {
    if(node.charset === 'utf-8' && node.contentTransferEncoding.value === 'base64') {
      return Str.uint8AsUtf(node.content);
    }
    if(node.charset === 'utf-8' && node.contentTransferEncoding.value === 'quoted-printable') {
      return Str.fromEqualSignNotationAsUtf(node.rawContent);
    }
    if(node.charset === 'iso-8859-2') {
      return (window as FcWindow).iso88592.decode(node.rawContent);  // todo - use iso88592.labels for detection
    }
    return node.rawContent;
  }

  // tslint:disable-next-line:variable-name
  private static newContentNode = (MimeBuilder: AnyThirdPartyLibrary, type: string, content: string): MimeParserNode => {
    let node = new MimeBuilder(type).setContent(content);
    if (type === 'text/plain') {
      node.addHeader('Content-Transfer-Encoding', 'quoted-printable'); // gmail likes this
    }
    return node;
  }

}
