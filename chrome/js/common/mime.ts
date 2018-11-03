/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Str, Value, Catch } from './common.js';
import { SendableMessageBody, RichHeaders, FlatHeaders } from './api.js';
import { Pgp } from './pgp.js';
import { Attachment } from './attachment.js';
import { BrowserWidnow, FcWindow, AnyThirdPartyLibrary } from './extension.js';

interface MimeContent {
  headers: FlatHeaders;
  attachments: Attachment[];
  signature: string|undefined;
  html: string|undefined;
  text: string|undefined;
}
interface MimeParserNode {
path: string[];
headers: {
    [key: string]: {value: string}[];
};
rawContent: string;
content: Uint8Array;
appendChild: (child: MimeParserNode) => void;
contentTransferEncoding: {value: string};
charset?: string;
}
export type KeyBlockType = 'public_key'|'private_key';
export type ReplaceableMessageBlockType = KeyBlockType|'attest_packet'|'cryptup_verification'|'signed_message'|'message'|'password_message';
export type MessageBlockType = 'text'|ReplaceableMessageBlockType;
export interface MessageBlock {
  type: MessageBlockType;
  content: string;
  complete: boolean;
  signature?: string;
}
export interface FromToHeaders {
  from: string;
  to: string[];
}

export class Mime {

  public static process = async (mime_message: string) => {
    let decoded = await Mime.decode(mime_message);
    let blocks: MessageBlock[] = [];
    if (decoded.text) {  // may be undefined or empty
      blocks = blocks.concat(Pgp.armor.detect_blocks(decoded.text).blocks);
    }
    for (let file of decoded.attachments) {
      let treat_as = file.treat_as();
      if (treat_as === 'message') {
        let armored = Pgp.armor.clip(file.as_text());
        if (armored) {
          blocks.push(Pgp.internal.crypto_armor_block_object('message', armored));
        }
      } else if (treat_as === 'signature') {
        decoded.signature = decoded.signature || file.as_text();
      } else if (treat_as === 'public_key') {
        blocks = blocks.concat(Pgp.armor.detect_blocks(file.as_text()).blocks);
      }
    }
    if (decoded.signature) {
      for (let block of blocks) {
        if (block.type === 'text') {
          block.type = 'signed_message';
          block.signature = decoded.signature;
        }
      }
    }
    return {headers: decoded.headers, blocks};
  }

  public static headers_to_from = (parsed_mime_message: MimeContent): FromToHeaders => {
    let header_to: string[] = [];
    let header_from;
    // @ts-ignore - I should check this - does it really have .address?
    if (parsed_mime_message.headers.from && parsed_mime_message.headers.from.length && parsed_mime_message.headers.from[0] && parsed_mime_message.headers.from[0].address) {
      // @ts-ignore - I should check this - does it really have .address?
      header_from = parsed_mime_message.headers.from[0].address;
    }
    if (parsed_mime_message.headers.to && parsed_mime_message.headers.to.length) {
      for (let to of parsed_mime_message.headers.to) {
        // @ts-ignore - I should check this - does it really have .address?
        if (to.address) {
          // @ts-ignore - I should check this - does it really have .address?
          header_to.push(to.address);
        }
      }
    }
    return { from: header_from, to: header_to };
  }

  public static reply_headers = (parsed_mime_message: MimeContent) => {
    let message_id = parsed_mime_message.headers['message-id'] || '';
    let references = parsed_mime_message.headers['in-reply-to'] || '';
    return { 'in-reply-to': message_id, 'references': references + ' ' + message_id };
  }

  public static resembles_message = (message: string|Uint8Array) => {
    let m = message.slice(0, 1000);
    // noinspection SuspiciousInstanceOfGuard
    if (m instanceof Uint8Array) {
      m = Str.from_uint8(m);
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

  public static decode = (mime_message: string): Promise<MimeContent> => {
    return new Promise(async resolve => {
      let mime_content = {attachments: [], headers: {} as FlatHeaders, text: undefined, html: undefined, signature: undefined} as MimeContent;
      try {
        let MimeParser = (window as BrowserWidnow)['emailjs-mime-parser'];
        let parser = new MimeParser();
        let parsed: {[key: string]: MimeParserNode} = {};
        parser.onheader = (node: MimeParserNode) => {
          if (!String(node.path.join('.'))) { // root node headers
            for (let name of Object.keys(node.headers)) {
              mime_content.headers[name] = node.headers[name][0].value;
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
            if (Mime.get_node_type(node) === 'application/pgp-signature') {
              mime_content.signature = node.rawContent;
            } else if (Mime.get_node_type(node) === 'text/html' && !Mime.get_node_filename(node)) {
              // html content may be broken up into smaller pieces by attachments in between
              // AppleMail does this with inline attachments
              mime_content.html = (mime_content.html || '') + Mime.get_node_content_as_text(node);
            } else if (Mime.get_node_type(node) === 'text/plain' && !Mime.get_node_filename(node)) {
              mime_content.text = Mime.get_node_content_as_text(node);
            } else {
              mime_content.attachments.push(new Attachment({
                name: Mime.get_node_filename(node),
                type: Mime.get_node_type(node),
                data: node.content,
                cid: Mime.get_node_content_id(node),
              }));
            }
          }
          resolve(mime_content);
        };
        parser.write(mime_message);
        parser.end();
      } catch (e) {
        Catch.handle_exception(e);
        resolve(mime_content);
      }
    });
  }

  public static encode = async (body:string|SendableMessageBody, headers: RichHeaders, attachments:Attachment[]=[]): Promise<string> => {
    let MimeBuilder = (window as BrowserWidnow)['emailjs-mime-builder'];
    let root_node = new MimeBuilder('multipart/mixed');
    for (let key of Object.keys(headers)) {
      root_node.addHeader(key, headers[key]);
    }
    if (typeof body === 'string') {
      body = {'text/plain': body};
    }
    let content_node: MimeParserNode;
    if (Object.keys(body).length === 1) {
      content_node = Mime.new_content_node(MimeBuilder, Object.keys(body)[0], body[Object.keys(body)[0] as "text/plain"|"text/html"] || '');
    } else {
      content_node = new MimeBuilder('multipart/alternative');
      for (let type of Object.keys(body)) {
        content_node.appendChild(Mime.new_content_node(MimeBuilder, type, body[type]!)); // already present, that's why part of for loop
      }
    }
    root_node.appendChild(content_node);
    for (let attachment of attachments) {
      let type = `${attachment.type}; name="${attachment.name}"`;
      let header = {'Content-Disposition': 'attachment', 'X-Attachment-Id': `f_${Str.random(10)}`, 'Content-Transfer-Encoding': 'base64'};
      root_node.appendChild(new MimeBuilder(type, { filename: attachment.name }).setHeader(header).setContent(attachment.data()));
    }
    return root_node.build();
  }

  public static signed = (mime_message: string) => {
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
    let signed_header_index = mime_message.substr(0, 100000).toLowerCase().indexOf('content-type: multipart/signed');
    if (signed_header_index !== -1) {
      mime_message = mime_message.substr(signed_header_index);
      let first_boundary_index = mime_message.substr(0, 1000).toLowerCase().indexOf('boundary=');
      if (first_boundary_index) {
        let boundary = mime_message.substr(first_boundary_index, 100);
        boundary = (boundary.match(/boundary="[^"]{1,70}"/gi) || boundary.match(/boundary=[a-z0-9][a-z0-9 ]{0,68}[a-z0-9]/gi) || [])[0];
        if (boundary) {
          boundary = boundary.replace(/^boundary="?|"$/gi, '');
          let boundary_begin = '\r\n--' + boundary + '\r\n';
          let boundary_end = '--' + boundary + '--';
          let end_index = mime_message.indexOf(boundary_end);
          if (end_index !== -1) {
            mime_message = mime_message.substr(0, end_index + boundary_end.length);
            if (mime_message) {
              let result = { full: mime_message, signed: null as string|null, signature: null as string|null };
              let first_part_start_index = mime_message.indexOf(boundary_begin);
              if (first_part_start_index !== -1) {
                first_part_start_index += boundary_begin.length;
                let first_part_end_index = mime_message.indexOf(boundary_begin, first_part_start_index);
                let second_part_start_index = first_part_end_index + boundary_begin.length;
                let second_part_end_index = mime_message.indexOf(boundary_end, second_part_start_index);
                if (second_part_end_index !== -1) {
                  let first_part = mime_message.substr(first_part_start_index, first_part_end_index - first_part_start_index);
                  let second_part = mime_message.substr(second_part_start_index, second_part_end_index - second_part_start_index);
                  if (first_part.match(/^content-type: application\/pgp-signature/gi) !== null && Value.is('-----BEGIN PGP SIGNATURE-----').in(first_part) && Value.is('-----END PGP SIGNATURE-----').in(first_part)) {
                    result.signature = Pgp.armor.clip(first_part);
                    result.signed = second_part;
                  } else {
                    result.signature = Pgp.armor.clip(second_part);
                    result.signed = first_part;
                  }
                  return result;
                }
              }
            }
          }
        }
      }
    }
  }

  private static get_node_type = (node: MimeParserNode) => {
    if (node.headers['content-type'] && node.headers['content-type'][0]) {
      return node.headers['content-type'][0].value;
    }
  }

  private static get_node_content_id = (node: MimeParserNode) => {
    if (node.headers['content-id'] && node.headers['content-id'][0]) {
      return node.headers['content-id'][0].value;
    }
  }

  private static get_node_filename = (node: MimeParserNode) => {
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

  private static get_node_content_as_text = (node: MimeParserNode): string => {
    if(node.charset === 'utf-8' && node.contentTransferEncoding.value === 'base64') {
      return Str.uint8_as_utf(node.content);
    }
    if(node.charset === 'utf-8' && node.contentTransferEncoding.value === 'quoted-printable') {
      return Str.from_equal_sign_notation_as_utf(node.rawContent);
    }
    if(node.charset === 'iso-8859-2') {
      return (window as FcWindow).iso88592.decode(node.rawContent);  // todo - use iso88592.labels for detection
    }
    return node.rawContent;
  }

  private static new_content_node = (MimeBuilder: AnyThirdPartyLibrary, type: string, content: string): MimeParserNode => {
    let node = new MimeBuilder(type).setContent(content);
    if (type === 'text/plain') {
      node.addHeader('Content-Transfer-Encoding', 'quoted-printable'); // gmail likes this
    }
    return node;
  }

}
