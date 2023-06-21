/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Dict, Str } from './common.js';
import { requireIso88592, requireMimeBuilder, requireMimeParser } from '../platform/require.js';

import { Attachment } from './attachment.js';
import { Buf } from './buf.js';
import { Catch } from '../platform/catch.js';
import { MimeParserNode } from './types/emailjs';
import { MsgBlock } from './msg-block.js';
import { MsgBlockParser } from './msg-block-parser.js';
import { PgpArmor } from './crypto/pgp/pgp-armor.js';
import { iso2022jpToUtf } from '../platform/util.js';

/* eslint-disable @typescript-eslint/naming-convention */
const MimeParser = requireMimeParser();
const MimeBuilder = requireMimeBuilder();
const Iso88592 = requireIso88592();
/* eslint-enable @typescript-eslint/naming-convention */

type AddressHeader = { address: string; name: string };
type MimeContentHeader = string | AddressHeader[];

export type MessageBody = {
  html?: string;
  text?: string;
};

export type MimeContent = MessageBody & {
  attachments: Attachment[]; // attachments in MimeContent are parsed from a raw MIME message and always have data
  rawSignedContent?: string;
  subject?: string;
};

export type MimeContentWithHeaders = MimeContent & {
  headers: Dict<MimeContentHeader>;
  to: string[];
  cc: string[];
  bcc: string[];
  from?: string;
};

export type MimeEncodeType = 'pgpMimeEncrypted' | 'pgpMimeSigned' | 'smimeEncrypted' | 'smimeSigned' | undefined;
export type RichHeaders = Dict<string | string[]>;

export type SendableMsgBody = {
  [key: string]: string | Buf | undefined;
  'text/plain'?: string;
  'text/html'?: string;
  'pkcs7/buf'?: Buf; // DER-encoded PKCS#7 message
};

export type MimeProccesedMsg = {
  rawSignedContent: string | undefined; // undefined if format was 'full'
  blocks: MsgBlock[]; // may be many blocks per file
};

type SendingType = 'to' | 'cc' | 'bcc';

export class Mime {
  public static processBody = (decoded: MessageBody): MsgBlock[] => {
    const blocks: MsgBlock[] = [];
    if (decoded.text) {
      const blocksFromTextPart = MsgBlockParser.detectBlocks(Str.normalize(decoded.text), true).blocks;
      // if there are some encryption-related blocks found in the text section, which we can use, and not look at the html section
      if (blocksFromTextPart.find(b => ['pkcs7', 'encryptedMsg', 'signedMsg', 'publicKey', 'privateKey'].includes(b.type))) {
        blocks.push(...blocksFromTextPart); // because the html most likely containt the same thing, just harder to parse pgp sections cause it's html
      } else if (decoded.html) {
        // if no pgp blocks found in text part and there is html part, prefer html
        blocks.push(MsgBlock.fromContent('plainHtml', decoded.html));
      } else {
        // else if no html and just a plain text message, use that
        blocks.push(...blocksFromTextPart);
      }
    } else if (decoded.html) {
      blocks.push(MsgBlock.fromContent('plainHtml', decoded.html));
    }
    return blocks;
  };

  public static isBodyEmpty = ({ text, html }: MessageBody) => {
    return Mime.isBodyTextEmpty(text) && Mime.isBodyTextEmpty(html);
  };

  public static isBodyTextEmpty = (text: string | undefined) => {
    return !(text && !/^(\r)?(\n)?$/.test(text));
  };

  public static processAttachments = (bodyBlocks: MsgBlock[], decoded: MimeContent): MimeProccesedMsg => {
    const attachmentBlocks: MsgBlock[] = [];
    const signatureAttachments: Attachment[] = [];
    for (const file of decoded.attachments) {
      let treatAs = file.treatAs(decoded.attachments, Mime.isBodyEmpty(decoded));
      if (['needChunk', 'maybePgp'].includes(treatAs)) {
        // todo: attachments from MimeContent always have data set (so 'needChunk' should never happen),
        // and we can perform whatever analysis is needed based on the actual data,
        // but we don't want to reference MsgUtil and OpenPGP.js from this class,
        // so I suggest to move this method to MessageRenderer for further refactoring
        treatAs = 'encryptedMsg'; // publicKey?
      }
      if (treatAs === 'encryptedMsg') {
        const armored = PgpArmor.clip(file.getData().toUtfStr());
        if (armored) {
          attachmentBlocks.push(MsgBlock.fromContent('encryptedMsg', armored));
        }
      } else if (treatAs === 'signature') {
        signatureAttachments.push(file);
      } else if (treatAs === 'publicKey') {
        attachmentBlocks.push(...MsgBlockParser.detectBlocks(file.getData().toUtfStr(), true).blocks); // todo: test when more than one
      } else if (treatAs === 'privateKey') {
        attachmentBlocks.push(...MsgBlockParser.detectBlocks(file.getData().toUtfStr(), true).blocks); // todo: test when more than one
      } else if (treatAs === 'encryptedFile') {
        attachmentBlocks.push(
          MsgBlock.fromAttachment('encryptedAttachment', '', {
            name: file.name,
            type: file.type,
            length: file.getData().length,
            data: file.getData(),
          })
        );
      } else if (treatAs === 'plainFile') {
        attachmentBlocks.push(
          MsgBlock.fromAttachment('plainAttachment', '', {
            name: file.name,
            type: file.type,
            length: file.getData().length,
            data: file.getData(),
            inline: file.inline,
            cid: file.cid,
          })
        );
      }
    }
    if (signatureAttachments.length) {
      // todo: if multiple signatures, figure out which fits what
      // attachments from MimeContent always have data set
      const signature = signatureAttachments[0].getData().toUtfStr();
      if (![...bodyBlocks, ...attachmentBlocks].some(block => ['plainText', 'plainHtml', 'signedMsg'].includes(block.type))) {
        // signed an empty message
        attachmentBlocks.push(new MsgBlock('signedMsg', '', true, signature));
      }
    }
    return {
      blocks: [...bodyBlocks, ...attachmentBlocks],
      rawSignedContent: decoded.rawSignedContent,
    };
  };

  public static processDecoded = (decoded: MimeContent): MimeProccesedMsg => {
    const bodyBlocks = Mime.processBody(decoded);
    return Mime.processAttachments(bodyBlocks, decoded);
  };

  public static process = async (mimeMsg: Uint8Array) => {
    const decoded = await Mime.decode(mimeMsg);
    return Mime.processDecoded(decoded);
  };

  public static resemblesMsg = (msg: Uint8Array | string) => {
    const chunk = (typeof msg === 'string' ? msg.substring(0, 3000) : new Buf(msg.slice(0, 3000)).toUtfStr('ignore')).toLowerCase().replace(/\r\n/g, '\n');
    const headers = chunk.split('\n\n')[0];
    if (!headers) {
      return false;
    }
    const contentType = headers.match(/content-type: +[0-9a-z\-\/]+/);
    if (!contentType) {
      return false;
    }
    if (headers.match(/;\s+boundary=/) || headers.match(/;\s+charset=/)) {
      return true;
    }
    if (!headers.match(/boundary=/)) {
      return false;
    }
    if (chunk.match(/\ncontent-transfer-encoding: +[0-9a-z\-\/]+/) || chunk.match(/\ncontent-disposition: +[0-9a-z\-\/]+/)) {
      return true; // these tend to be inside body-part headers, after the first `\n\n` which we test above
    }
    return contentType.index === 0;
  };

  public static decode = async (mimeMsg: Uint8Array | string): Promise<MimeContentWithHeaders> => {
    let mimeContent: MimeContentWithHeaders = {
      attachments: [],
      headers: {},
      subject: undefined,
      text: undefined,
      html: undefined,
      from: undefined,
      to: [],
      cc: [],
      bcc: [],
    };
    const parser = new MimeParser();
    const leafNodes: { [key: string]: MimeParserNode } = {};
    parser.onbody = (node: MimeParserNode) => {
      const path = String(node.path.join('.'));
      if (typeof leafNodes[path] === 'undefined') {
        leafNodes[path] = node;
      }
    };
    return await new Promise((resolve, reject) => {
      try {
        parser.onend = async () => {
          try {
            for (const name of Object.keys(parser.node.headers)) {
              mimeContent.headers[name] = parser.node.headers[name][0].value;
            }
            mimeContent.rawSignedContent = Mime.retrieveRawSignedContent([parser.node]);
            if (!mimeContent.subject && mimeContent.rawSignedContent) {
              const rawSignedContentDecoded = await Mime.decode(Buf.fromUtfStr(mimeContent.rawSignedContent));
              mimeContent.subject = rawSignedContentDecoded.subject;
            }
            for (const node of Object.values(leafNodes)) {
              const nodeType = Mime.getNodeType(node);
              if (nodeType === 'text/html' && !Mime.getNodeFilename(node)) {
                // html content may be broken up into smaller pieces by attachments in between
                // AppleMail does this with inline attachments
                mimeContent.html = (mimeContent.html || '') + Mime.getNodeContentAsUtfStr(node);
              } else if (nodeType === 'text/plain' && (!Mime.getNodeFilename(node) || Mime.isNodeInline(node))) {
                mimeContent.text = (mimeContent.text ? `${mimeContent.text}\n\n` : '') + Mime.getNodeContentAsUtfStr(node);
              } else if (nodeType === 'text/rfc822-headers') {
                /* eslint-disable no-underscore-dangle */
                if (node._parentNode && node._parentNode.headers.subject) {
                  mimeContent.subject = node._parentNode.headers.subject[0].value;
                }
                /* eslint-enable no-underscore-dangle */
              } else {
                mimeContent.attachments.push(Mime.getNodeAsAttachment(node));
              }
            }
            const headers = Mime.headerGetAddress(mimeContent, ['from', 'to', 'cc', 'bcc']);
            mimeContent.subject = String(mimeContent.subject || mimeContent.headers.subject || '');
            mimeContent = Object.assign(mimeContent, headers);
            resolve(mimeContent);
          } catch (e) {
            reject(e);
          }
        };
        parser.write(mimeMsg);
        parser.end();
      } catch (e) {
        // todo - on Android we may want to fail when this happens, evaluate effect on browser extension
        Catch.reportErr(e);
        resolve(mimeContent);
      }
    });
  };

  public static encode = async (body: SendableMsgBody, headers: RichHeaders, attachments: Attachment[] = [], type?: MimeEncodeType): Promise<string> => {
    const rootContentType = type !== 'pgpMimeEncrypted' ? 'multipart/mixed' : `multipart/encrypted; protocol="application/pgp-encrypted";`;
    const rootNode = new MimeBuilder(rootContentType, { includeBccInHeader: true });
    for (const key of Object.keys(headers)) {
      rootNode.addHeader(key, headers[key]);
    }
    if (Object.keys(body).length) {
      let contentNode: MimeParserNode;
      if (Object.keys(body).length === 1) {
        contentNode = Mime.newContentNode(MimeBuilder, Object.keys(body)[0], body[Object.keys(body)[0] as 'text/plain' | 'text/html'] || '');
      } else {
        contentNode = new MimeBuilder('multipart/alternative');
        for (const [type, content] of Object.entries(body)) {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          contentNode.appendChild(Mime.newContentNode(MimeBuilder, type, Str.with(content!))); // already present, that's why part of for loop
        }
      }
      rootNode.appendChild(contentNode);
    }
    for (const attachment of attachments) {
      rootNode.appendChild(Mime.createAttachmentNode(attachment));
    }
    return rootNode.build(); // eslint-disable-line @typescript-eslint/no-unsafe-return
  };

  public static encodeSmime = async (body: Uint8Array, headers: RichHeaders, type: 'enveloped-data' | 'signed-data'): Promise<string> => {
    const rootContentType = `application/pkcs7-mime; name="smime.p7m"; smime-type=${type}`;
    const rootNode = new MimeBuilder(rootContentType, { includeBccInHeader: true });
    for (const key of Object.keys(headers)) {
      rootNode.addHeader(key, headers[key]);
    }
    rootNode.setContent(body);
    rootNode.addHeader('Content-Transfer-Encoding', 'base64');
    rootNode.addHeader('Content-Disposition', 'attachment; filename="smime.p7m"');
    let contentDescription = 'S/MIME Encrypted Message';
    if (type === 'signed-data') {
      contentDescription = 'S/MIME Signed Message';
    }
    rootNode.addHeader('Content-Description', contentDescription);
    return rootNode.build(); // eslint-disable-line @typescript-eslint/no-unsafe-return
  };

  public static subjectWithoutPrefixes = (subject: string): string => {
    return subject.replace(/^((Re|Fwd): ?)+/g, '').trim();
  };

  public static encodePgpMimeSigned = async (
    body: SendableMsgBody,
    headers: RichHeaders,
    attachments: Attachment[] = [],
    sign: (data: string) => Promise<string>
  ): Promise<string> => {
    const sigPlaceholder = `SIG_PLACEHOLDER_${Str.sloppyRandom(10)}`;
    const rootNode = new MimeBuilder(`multipart/signed; protocol="application/pgp-signature";`, {
      includeBccInHeader: true,
    });
    for (const key of Object.keys(headers)) {
      rootNode.addHeader(key, headers[key]);
    }
    const bodyNodes = new MimeBuilder('multipart/alternative');
    for (const [type, content] of Object.entries(body)) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      bodyNodes.appendChild(Mime.newContentNode(MimeBuilder, type, Str.with(content!)));
    }
    const signedContentNode = new MimeBuilder('multipart/mixed');
    signedContentNode.appendChild(bodyNodes);
    for (const attachment of attachments) {
      signedContentNode.appendChild(Mime.createAttachmentNode(attachment));
    }
    const sigAttachmentPlaceholder = new Attachment({
      data: Buf.fromUtfStr(sigPlaceholder),
      type: 'application/pgp-signature',
      name: 'signature.asc',
    });
    const sigAttachmentPlaceholderNode = Mime.createAttachmentNode(sigAttachmentPlaceholder);
    // https://tools.ietf.org/html/rfc3156#section-5 - signed content first, signature after
    rootNode.appendChild(signedContentNode);
    rootNode.appendChild(sigAttachmentPlaceholderNode);
    const mimeStrWithPlaceholderSig = rootNode.build() as string;
    const { rawSignedContent } = await Mime.decode(Buf.fromUtfStr(mimeStrWithPlaceholderSig));
    if (!rawSignedContent) {
      console.log(`mimeStrWithPlaceholderSig(placeholder:${sigPlaceholder}):\n${mimeStrWithPlaceholderSig}`);
      throw new Error('Could not find raw signed content immediately after mime-encoding a signed message');
    }
    const realSignature = await sign(rawSignedContent);
    const pgpMimeSigned = mimeStrWithPlaceholderSig.replace(Buf.fromUtfStr(sigPlaceholder).toBase64Str(), Buf.fromUtfStr(realSignature).toBase64Str());
    if (pgpMimeSigned === mimeStrWithPlaceholderSig) {
      console.log(`pgpMimeSigned(placeholder:${sigPlaceholder}):\n${pgpMimeSigned}`);
      throw new Error('Replaced sigPlaceholder with realSignature but mime stayed the same');
    }
    return pgpMimeSigned;
  };

  private static headerGetAddress = (parsedMimeMsg: MimeContentWithHeaders, headersNames: Array<SendingType | 'from'>) => {
    const result: { to: string[]; cc: string[]; bcc: string[] } = { to: [], cc: [], bcc: [] };
    let from: string | undefined;
    const getHdrValAsArr = (hdr: MimeContentHeader) =>
      typeof hdr === 'string' ? ([hdr].map(h => Str.parseEmail(h).email).filter(e => !!e) as string[]) : hdr.map(h => h.address);
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
  };

  private static retrieveRawSignedContent = (nodes: MimeParserNode[]): string | undefined => {
    for (const node of nodes) {
      /* eslint-disable no-underscore-dangle */
      if (!node._childNodes || !node._childNodes.length) {
        continue; // signed nodes tend contain two children: content node, signature node. If no node, then this is not pgp/mime signed content
      }
      const isSigned = node._isMultipart === 'signed';
      const isMixedWithSig =
        node._isMultipart === 'mixed' &&
        node._childNodes.length === 2 &&
        (Mime.getNodeType(node._childNodes[1]) === 'application/pgp-signature' || node._childNodes[1].contentType?.params?.name === 'signature.asc');
      if (isSigned || isMixedWithSig) {
        // PGP/MIME signed content uses <CR><LF> as in // use CR-LF https://tools.ietf.org/html/rfc3156#section-5
        // however emailjs parser will replace it to <LF>, so we fix it here
        let rawSignedContent = node._childNodes[0].raw.replace(/\r?\n/g, '\r\n');
        if (/--$/.test(rawSignedContent)) {
          // end of boundary without a mandatory newline
          rawSignedContent += '\r\n'; // emailjs wrongly leaves out the last newline, fix it here
        }
        return rawSignedContent;
      }
      return Mime.retrieveRawSignedContent(node._childNodes);
    }
    /* eslint-enable no-underscore-dangle */
    return undefined;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static createAttachmentNode = (attachment: Attachment): any => {
    // todo: MimeBuilder types
    const type = `${attachment.type}; name="${attachment.name}"`;
    const id = attachment.cid || Attachment.attachmentId();
    const header: Dict<string> = {};
    if (attachment.contentDescription) {
      header['Content-Description'] = attachment.contentDescription;
    }
    header['Content-Disposition'] = attachment.inline ? 'inline' : 'attachment';
    header['X-Attachment-Id'] = id;
    header['Content-ID'] = `<${id}>`;
    header['Content-Transfer-Encoding'] = attachment.contentTransferEncoding || 'base64';
    const content =
      attachment.contentTransferEncoding === '7bit'
        ? attachment.getData().toRawBytesStr() // emailjs-mime-builder doesn't support Buf for 7bit encoding
        : attachment.getData();
    return new MimeBuilder(type, { filename: attachment.name }).setHeader(header).setContent(content);
  };

  private static getNodeType = (node: MimeParserNode, type: 'value' | 'initial' = 'value') => {
    if (node.headers['content-type'] && node.headers['content-type'][0]) {
      return node.headers['content-type'][0][type];
    }
    return undefined;
  };

  private static getNodeContentId = (node: MimeParserNode) => {
    if (node.headers['content-id'] && node.headers['content-id'][0]) {
      return node.headers['content-id'][0].value;
    }
    return undefined;
  };

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
  };

  private static isNodeInline = (node: MimeParserNode): boolean => {
    const cd = node.headers['content-disposition'];
    return cd && cd[0] && cd[0].value === 'inline';
  };

  private static fromEqualSignNotationAsBuf = (str: string): Buf => {
    return Buf.fromRawBytesStr(
      str.replace(/(=[A-F0-9]{2})+/g, equalSignUtfPart => {
        const bytes = equalSignUtfPart
          .replace(/^=/, '')
          .split('=')
          .map(twoHexDigits => parseInt(twoHexDigits, 16));
        return new Buf(bytes).toRawBytesStr();
      })
    );
  };

  private static getNodeAsAttachment = (node: MimeParserNode): Attachment => {
    let treatAs: 'hidden' | 'encryptedMsg' | undefined;
    // are we dealing with a PGP/MIME encrypted message?
    if (
      /* eslint-disable no-underscore-dangle */
      node._parentNode &&
      node._parentNode.contentType &&
      node._parentNode._childNodes &&
      node._parentNode.contentType.params?.protocol === 'application/pgp-encrypted' &&
      node._parentNode.contentType.value === 'multipart/encrypted'
    ) {
      treatAs = Attachment.treatAsForPgpEncryptedAttachments(node.contentType?.value, node._parentNode?._childNodes.indexOf(node));
      /* eslint-enable no-underscore-dangle */
    }
    return new Attachment({
      treatAs,
      name: Mime.getNodeFilename(node),
      type: Mime.getNodeType(node),
      data:
        node.contentTransferEncoding.value === 'quoted-printable'
          ? Mime.fromEqualSignNotationAsBuf(node.rawContent!) // eslint-disable-line @typescript-eslint/no-non-null-assertion
          : node.content,
      cid: Mime.getNodeContentId(node),
    });
  };

  private static getNodeContentAsUtfStr = (node: MimeParserNode): string => {
    /* eslint-disable @typescript-eslint/no-non-null-assertion */
    if (node.charset && Iso88592.labels.includes(node.charset)) {
      return Iso88592.decode(node.rawContent!); // eslint-disable-line @typescript-eslint/no-unsafe-return
    }
    let resultBuf: Buf;
    if (node.charset === 'utf-8' && node.contentTransferEncoding.value === 'base64') {
      resultBuf = Buf.fromUint8(node.content);
    } else if (node.charset === 'utf-8' && node.contentTransferEncoding.value === 'quoted-printable') {
      resultBuf = Mime.fromEqualSignNotationAsBuf(node.rawContent!);
    } else {
      resultBuf = Buf.fromRawBytesStr(node.rawContent!);
    }
    /* eslint-enable @typescript-eslint/no-non-null-assertion */
    if (node.charset?.toUpperCase() === 'ISO-2022-JP' || (node.charset === 'utf-8' && Mime.getNodeType(node, 'initial')?.includes('ISO-2022-JP'))) {
      return iso2022jpToUtf(resultBuf);
    }
    return resultBuf.toUtfStr();
  };

  // eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/no-explicit-any
  private static newContentNode = (MimeBuilder: any, type: string, content: string): MimeParserNode => {
    const node: MimeParserNode = new MimeBuilder(type).setContent(content);
    if (type === 'text/plain') {
      // gmail likes this
      node.addHeader('Content-Transfer-Encoding', 'quoted-printable');
    }
    return node;
  };
}
