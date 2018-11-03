/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Str, Value, Env, Catch } from './common.js';
import { ProgressCallback } from './api.js';
import { Xss } from './browser.js';
import { KeyInfo } from './store.js';

type Attachment$treat_as = "public_key" | "message" | "hidden" | "signature" | "encrypted" | "standard";
type AttachmentMeta = { data?: string|Uint8Array|null; type?:string|null; name?: string|null; length?: number|null; url?: string|null;
  inline?: boolean|null; id?: string|null; message_id?: string|null; treat_as?: Attachment$treat_as; cid?: string|null; };

export type FlowCryptAttachmentLinkData = {name: string, type: string, size: number};

export class Attachment {

  private text: string|null = null;
  private bytes: Uint8Array|null = null;
  private treat_as_value: Attachment$treat_as|null = null;

  public length: number;
  public type: string;
  public name: string;
  public url: string|null;
  public id: string|null;
  public message_id: string|null;
  public inline: boolean;
  public cid: string|null;

  constructor({data, type, name, length, url, inline, id, message_id, treat_as, cid}: AttachmentMeta) {
    if(typeof data === 'undefined' && typeof url === 'undefined' && typeof id === 'undefined') {
      throw new Error('Attachment: one of data|url|id has to be set');
    }
    if(id && !message_id) {
      throw new Error('Attachment: if id is set, message_id must be set too');
    }
    if(data !== null && typeof data !== 'undefined') {
      this.set_data(data);
    }
    this.name = name || '';
    this.type = type || 'application/octet-stream';
    this.length = data ? data.length : (length || NaN);
    this.url = url || null;
    this.inline = inline !== true;
    this.id = id || null;
    this.message_id = message_id || null;
    this.treat_as_value = treat_as || null;
    this.cid = cid || null;
  }

  public set_data = (data: string|Uint8Array) => {
    if(this.has_data()) {
      throw new Error('Attachment: data already set');
    }
    if(data instanceof Uint8Array) {
      this.bytes = data;
    } else if(typeof data === 'string') {
      this.text = data;
    }
    this.length = data.length;
  }

  public has_data = () => {
    if(this.bytes === null && this.text === null) {
      return false;
    }
    return true;
  }

  public data = (): string|Uint8Array => {
    if(this.bytes !== null) {
      return this.bytes;
    }
    if (this.text !== null) {
      return this.text;
    }
    throw new Error('Attachment has no data set');
  }

  public as_text = (): string => {
    if(this.text === null && this.bytes !== null) {
      this.text = Str.from_uint8(this.bytes);
    }
    if(this.text !== null) {
      return this.text;
    }
    throw new Error('Attachment has no data set');
  }

  public as_bytes = (): Uint8Array => {
    if(this.bytes === null && this.text !== null) {
      this.bytes = Str.to_uint8(this.text);
    }
    if (this.bytes !== null) {
      return this.bytes;
    }
    throw new Error('Attachment has no data set');
  }

  public treat_as = (): Attachment$treat_as => {
    // todo - should return a probability in the range of certain-likely-maybe
    // could also return possible types as an array - which makes basic usage more difficult - to think through
    // better option - add an "unknown" type: when encountered, code consuming this should inspect a chunk of contents
    if(this.treat_as_value) { // pre-set
      return this.treat_as_value;
    } else if (Value.is(this.name).in(['PGPexch.htm.pgp', 'PGPMIME version identification', 'Version.txt'])) {
      return 'hidden';  // PGPexch.htm.pgp is html alternative of textual body content produced by PGP Desktop and GPG4o
    } else if (this.name === 'signature.asc' || this.type === 'application/pgp-signature') {
      return  'signature';
    } else if (!this.name && !Value.is('image/').in(this.type)) { // this.name may be '' or undefined - catch either
      return this.length < 100 ? 'hidden' : 'message';
    } else if (Value.is(this.name).in(['message', 'msg.asc', 'message.asc', 'encrypted.asc', 'encrypted.eml.pgp', 'Message.pgp'])) {
      return 'message';
    } else if (this.name.match(/(\.pgp$)|(\.gpg$)|(\.[a-zA-Z0-9]{3,4}\.asc$)/g)) { // ends with one of .gpg, .pgp, .???.asc, .????.asc
      return 'encrypted';
    } else if (this.name.match(/^(0|0x)?[A-F0-9]{8}([A-F0-9]{8})?.*\.asc$/g)) { // name starts with a key id
      return 'public_key';
    } else if (Value.is('public').in(this.name.toLowerCase()) && this.name.match(/[A-F0-9]{8}.*\.asc$/g)) { // name contains the word "public", any key id and ends with .asc
      return 'public_key';
    } else if (this.name.match(/\.asc$/) && this.length < 100000 && !this.inline) {
      return 'message';
    } else {
      return 'standard';
    }
  }

  public static methods = {
    object_url_create: (content: Uint8Array|string) => window.URL.createObjectURL(new Blob([content], { type: 'application/octet-stream' })),
    object_url_consume: async (url: string) => {
      let uint8 = await Attachment.methods.download_as_uint8(url, null);
      window.URL.revokeObjectURL(url);
      return uint8;
    },
    download_as_uint8: (url: string, progress:ProgressCallback|null=null): Promise<Uint8Array> => new Promise((resolve, reject) => {
      let request = new XMLHttpRequest();
      request.open('GET', url, true);
      request.responseType = 'arraybuffer';
      if (typeof progress === 'function') {
        request.onprogress = (evt) => progress(evt.lengthComputable ? Math.floor((evt.loaded / evt.total) * 100) : null, evt.loaded, evt.total);
      }
      request.onerror = reject;
      request.onload = e => resolve(new Uint8Array(request.response));
      request.send();
    }),
    save_to_downloads: (attachment: Attachment, render_in:JQuery<HTMLElement>|null=null) => {
      let blob = new Blob([attachment.data()], {type: attachment.type});
      if (window.navigator && window.navigator.msSaveOrOpenBlob) {
        window.navigator.msSaveBlob(blob, attachment.name);
      } else {
        let a = window.document.createElement('a');
        a.href = window.URL.createObjectURL(blob);
        a.download = Xss.html_escape(attachment.name);
        if (render_in) {
          a.textContent = 'DECRYPTED FILE';
          a.style.cssText = 'font-size: 16px; font-weight: bold;';
          Xss.sanitize_render(render_in, '<div style="font-size: 16px;padding: 17px 0;">File is ready.<br>Right-click the link and select <b>Save Link As</b></div>');
          render_in.append(a); // xss-escaped attachment name above
          render_in.css('height', 'auto');
          render_in.find('a').click(e => {
            alert('Please use right-click and select Save Link As');
            e.preventDefault();
            e.stopPropagation();
            return false;
          });
        } else {
          if (typeof a.click === 'function') {
            a.click();
          } else { // safari
            let e = document.createEvent('MouseEvents');
            // @ts-ignore - safari only. expected 15 arguments, but works well with 4
            e.initMouseEvent('click', true, true, window);
            a.dispatchEvent(e);
          }
          if (Env.browser().name === 'firefox') {
            try {
              document.body.removeChild(a);
            } catch (err) {
              if (err.message !== 'Node was not found') {
                throw err;
              }
            }
          }
          Catch.set_timeout(() => window.URL.revokeObjectURL(a.href), 0);
        }
      }
    },
    pgp_name_patterns: () => ['*.pgp', '*.gpg', '*.asc', 'noname', 'message', 'PGPMIME version identification', ''],
    keyinfo_as_pubkey_attachment: (ki: KeyInfo) => new Attachment({data: ki.public, type: 'application/pgp-keys', name: `0x${ki.longid}.asc`}),
  };

}
