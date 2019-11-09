/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Str, Dict } from './common.js';
import { Pgp, KeyDetails, DecryptError, VerifyRes } from './pgp.js';
import { Att, AttMeta } from './att.js';
import { Catch } from '../platform/catch.js';
import { requireMimeParser, requireMimeBuilder, requireIso88592 } from '../platform/require.js';
import { Buf } from './buf.js';
import { MimeParserNode } from './types/emailjs';

const MimeParser = requireMimeParser();  // tslint:disable-line:variable-name
const MimeBuilder = requireMimeBuilder();  // tslint:disable-line:variable-name
const Iso88592 = requireIso88592();  // tslint:disable-line:variable-name

type AddressHeader = { address: string; name: string; };
type MimeContentHeader = string | AddressHeader[];
export type MimeContent = {
  headers: Dict<MimeContentHeader>;
  atts: Att[];
  signature?: string;
  rawSignedContent?: string;
  subject?: string;
  html?: string;
  text?: string;
  from?: string;
  to: string[];
  cc: string[];
  bcc: string[];
};

export type RichHeaders = Dict<string | string[]>;
export type SendableMsgBody = { [key: string]: string | undefined; 'text/plain'?: string; 'text/html'?: string; };
export type KeyBlockType = 'publicKey' | 'privateKey';
export type ReplaceableMsgBlockType = KeyBlockType | 'cryptupVerification' | 'signedMsg' | 'encryptedMsg' | 'encryptedMsgLink';
export type MsgBlockType = ReplaceableMsgBlockType | 'plainText' | 'decryptedText' | 'plainHtml' | 'decryptedHtml' | 'plainAtt' | 'encryptedAtt'
  | 'decryptedAtt' | 'encryptedAttLink' | 'decryptErr' | 'verifiedMsg' | 'signedHtml';
export type MsgBlock = {
  type: MsgBlockType;
  content: string | Buf;
  complete: boolean;
  signature?: string;
  keyDetails?: KeyDetails; // only in publicKey when returned to Android (could eventually be made mandatory, done straight in detectBlocks?)
  attMeta?: AttMeta; // only in plainAtt, encryptedAtt, decryptedAtt, encryptedAttLink (not sure if always)
  decryptErr?: DecryptError; // only in decryptErr block, always
  verifyRes?: VerifyRes,
};
export type MimeProccesedMsg = {
  rawSignedContent: string | undefined,
  headers: Dict<MimeContentHeader>,
  blocks: MsgBlock[],
  from: string | undefined,
  to: string[]
};
type SendingType = 'to' | 'cc' | 'bcc';

export class Mime {

  public static processDecoded = (decoded: MimeContent): MimeProccesedMsg => {
    const blocks: MsgBlock[] = [];
    if (decoded.text) {
      const blocksFromTextPart = Pgp.armor.detectBlocks(Str.normalize(decoded.text)).blocks;
      // if there are some encryption-related blocks found in the text section, which we can use, and not look at the html section
      if (blocksFromTextPart.find(b => b.type === 'encryptedMsg' || b.type === 'signedMsg' || b.type === 'publicKey' || b.type === 'privateKey' || b.type === 'cryptupVerification')) {
        blocks.push(...blocksFromTextPart); // because the html most likely containt the same thing, just harder to parse pgp sections cause it's html
      } else if (decoded.html) { // if no pgp blocks found in text part and there is html part, prefer html
        blocks.push(Pgp.internal.msgBlockObj('plainHtml', decoded.html));
      } else { // else if no html and just a plain text message, use that
        blocks.push(...blocksFromTextPart);
      }
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
      } else if (treatAs === 'privateKey') {
        blocks.push(...Pgp.armor.detectBlocks(file.getData().toUtfStr()).blocks);
      } else if (treatAs === 'encryptedFile') {
        blocks.push(Pgp.internal.msgBlockAttObj('encryptedAtt', '', { name: file.name, type: file.type, length: file.getData().length, data: file.getData() }));
      } else if (treatAs === 'plainFile') {
        blocks.push(Pgp.internal.msgBlockAttObj('plainAtt', '', {
          name: file.name, type: file.type, length: file.getData().length, data: file.getData(), inline: file.inline, cid: file.cid
        }));
      }
    }
    if (decoded.signature) {
      for (const block of blocks) {
        if (block.type === 'plainText') {
          block.type = 'signedMsg';
          block.signature = decoded.signature;
        } else if (block.type === 'plainHtml') {
          block.type = 'signedHtml';
          block.signature = decoded.signature;
        }
      }
      if (!blocks.find(block => block.type === 'plainText' || block.type === 'plainHtml' || block.type === 'signedMsg' || block.type === 'signedHtml')) { // signed an empty message
        blocks.push({ type: "signedMsg", "content": "", signature: decoded.signature, complete: true });
      }
    }
    return { headers: decoded.headers, blocks, from: decoded.from, to: decoded.to, rawSignedContent: decoded.rawSignedContent };
  }

  public static process = async (mimeMsg: Uint8Array): Promise<MimeProccesedMsg> => {
    const decoded = await Mime.decode(mimeMsg);
    return Mime.processDecoded(decoded);
  }

  public static isPlainInlineImg = (b: MsgBlock) => {
    return b.type === 'plainAtt' && b.attMeta && b.attMeta.inline && b.attMeta.type && ['image/jpeg', 'image/jpg', 'image/bmp', 'image/png', 'image/svg+xml'].includes(b.attMeta.type);
  }

  private static headerGetAddress = (parsedMimeMsg: MimeContent, headersNames: Array<SendingType | 'from'>) => {
    const result: { to: string[], cc: string[], bcc: string[] } = { to: [], cc: [], bcc: [] };
    let from: string | undefined;
    const getHdrValAsArr = (hdr: MimeContentHeader) => typeof hdr === 'string' ? [hdr].map(h => Str.parseEmail(h).email).filter(e => !!e) as string[] : hdr.map(h => h.address);
    const getHdrValAsStr = (hdr: MimeContentHeader) => Str.parseEmail((Array.isArray(hdr) ? (hdr[0] || {}).address : String(hdr || '')) || '').email;
    for (const hdrName of headersNames) {
      const header = parsedMimeMsg.headers[hdrName];
      if (header) {
        if (hdrName === 'from') {
          from = getHdrValAsStr(header);
        } else {
          result[hdrName] = [...result[hdrName], ...getHdrValAsArr(header)];
        }
      }
    }
    return { ...result, from };
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

  private static retrieveRawSignedContent = (nodes: MimeParserNode[]): string | undefined => {
    for (const node of nodes) {
      if (!node._childNodes || !node._childNodes.length) {
        continue; // signed nodes tend contain two children: content node, signature node. If no node, then this is not pgp/mime signed content
      }
      const isSigned = node._isMultipart === 'signed';
      const isMixedWithSig = node._isMultipart === 'mixed' && node._childNodes.length === 2 && Mime.getNodeType(node._childNodes[1]) === 'application/pgp-signature';
      if (isSigned || isMixedWithSig) {
        // PGP/MIME signed content uses <CR><LF> as in // use CR-LF https://tools.ietf.org/html/rfc3156#section-5
        // however emailjs parser will replace it to <LF>, so we fix it here
        let rawSignedContent = node._childNodes[0].raw.replace(/\r?\n/g, '\r\n');
        if (/--$/.test(rawSignedContent)) { // end of boundary without a mandatory newline
          rawSignedContent += '\r\n'; // emailjs wrongly leaves out the last newline, fix it here
        }
        return rawSignedContent;
      }
      return Mime.retrieveRawSignedContent(node._childNodes);
    }
    return undefined;
  }

  public static decode = (mimeMsg: Uint8Array): Promise<MimeContent> => {
    return new Promise(async resolve => {
      let mimeContent: MimeContent = { atts: [], headers: {}, subject: undefined, text: undefined, html: undefined, signature: undefined, from: undefined, to: [], cc: [], bcc: [] };
      try {
        const parser = new MimeParser();
        const leafNodes: { [key: string]: MimeParserNode } = {};
        parser.onbody = (node: MimeParserNode) => {
          const path = String(node.path.join('.'));
          if (typeof leafNodes[path] === 'undefined') {
            leafNodes[path] = node;
          }
        };
        parser.onend = () => {
          for (const name of Object.keys(parser.node.headers)) {
            mimeContent.headers[name] = parser.node.headers[name][0].value;
          }
          mimeContent.rawSignedContent = Mime.retrieveRawSignedContent([parser.node]);
          for (const node of Object.values(leafNodes)) {
            if (Mime.getNodeType(node) === 'application/pgp-signature') {
              mimeContent.signature = node.rawContent;
            } else if (Mime.getNodeType(node) === 'text/html' && !Mime.getNodeFilename(node)) {
              // html content may be broken up into smaller pieces by attachments in between
              // AppleMail does this with inline attachments
              mimeContent.html = (mimeContent.html || '') + Mime.getNodeContentAsUtfStr(node);
            } else if (Mime.getNodeType(node) === 'text/plain' && !Mime.getNodeFilename(node)) {
              mimeContent.text = Mime.getNodeContentAsUtfStr(node);
            } else if (Mime.getNodeType(node) === 'text/rfc822-headers') {
              if (node._parentNode && node._parentNode.headers.subject) {
                mimeContent.subject = node._parentNode.headers.subject[0].value;
              }
            } else {
              mimeContent.atts.push(Mime.getNodeAsAtt(node));
            }
          }
          const headers = Mime.headerGetAddress(mimeContent, ['from', 'to', 'cc', 'bcc']);
          mimeContent.subject = String(mimeContent.subject || mimeContent.headers.subject || '(no subject)');
          mimeContent = Object.assign(mimeContent, headers);
          resolve(mimeContent);
        };
        parser.write(mimeMsg);
        parser.end();
      } catch (e) { // todo - on Android we may want to fail when this happens, evaluate effect on browser extension
        Catch.reportErr(e);
        resolve(mimeContent);
      }
    });
  }

  public static encode = async (body: string | SendableMsgBody, headers: RichHeaders, atts: Att[] = []): Promise<string> => {
    const rootNode = new MimeBuilder('multipart/mixed', { includeBccInHeader: true }); // tslint:disable-line:no-unsafe-any
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

  private static fromEqualSignNotationAsBuf = (str: string): Buf => {
    return Buf.fromRawBytesStr(str.replace(/(=[A-F0-9]{2})+/g, equalSignUtfPart => {
      const bytes = equalSignUtfPart.replace(/^=/, '').split('=').map(twoHexDigits => parseInt(twoHexDigits, 16));
      return new Buf(bytes).toRawBytesStr();
    }));
  }

  private static getNodeAsAtt = (node: MimeParserNode): Att => {
    return new Att({
      name: Mime.getNodeFilename(node),
      type: Mime.getNodeType(node),
      data: node.contentTransferEncoding.value === 'quoted-printable' ? Mime.fromEqualSignNotationAsBuf(node.rawContent!) : node.content,
      cid: Mime.getNodeContentId(node),
    });
  }

  private static getNodeContentAsUtfStr = (node: MimeParserNode): string => {
    if (node.charset === 'utf-8' && node.contentTransferEncoding.value === 'base64') {
      return Buf.fromUint8(node.content).toUtfStr();
    }
    if (node.charset === 'utf-8' && node.contentTransferEncoding.value === 'quoted-printable') {
      return Mime.fromEqualSignNotationAsBuf(node.rawContent!).toUtfStr();
    }
    if (node.charset && Iso88592.labels.includes(node.charset)) {
      return Iso88592.decode(node.rawContent!); // tslint:disable-line:no-unsafe-any
    }
    return Buf.fromRawBytesStr(node.rawContent!).toUtfStr();
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
