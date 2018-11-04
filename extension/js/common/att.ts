/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Str, Value, Env, Catch } from './common.js';
import { ProgressCb } from './api.js';
import { Xss } from './browser.js';
import { KeyInfo } from './store.js';

type Att$treatAs = "publicKey" | "message" | "hidden" | "signature" | "encrypted" | "standard";
type AttMeta = {
  data?: string | Uint8Array | null; type?: string | null; name?: string | null; length?: number | null; url?: string | null;
  inline?: boolean | null; id?: string | null; msgId?: string | null; treatAs?: Att$treatAs; cid?: string | null;
};

export type FlowCryptAttLinkData = { name: string, type: string, size: number };

export class Att {

  private text: string | null = null;
  private bytes: Uint8Array | null = null;
  private treatAsValue: Att$treatAs | null = null;

  public length: number;
  public type: string;
  public name: string;
  public url: string | null;
  public id: string | null;
  public msgId: string | null;
  public inline: boolean;
  public cid: string | null;

  constructor({ data, type, name, length, url, inline, id, msgId, treatAs, cid }: AttMeta) {
    if (typeof data === 'undefined' && typeof url === 'undefined' && typeof id === 'undefined') {
      throw new Error('Att: one of data|url|id has to be set');
    }
    if (id && !msgId) {
      throw new Error('Att: if id is set, msgId must be set too');
    }
    if (data !== null && typeof data !== 'undefined') {
      this.setData(data);
    }
    this.name = name || '';
    this.type = type || 'application/octet-stream';
    this.length = data ? data.length : (length || NaN);
    this.url = url || null;
    this.inline = inline !== true;
    this.id = id || null;
    this.msgId = msgId || null;
    this.treatAsValue = treatAs || null;
    this.cid = cid || null;
  }

  public setData = (data: string | Uint8Array) => {
    if (this.hasData()) {
      throw new Error('Att: data already set');
    }
    if (data instanceof Uint8Array) {
      this.bytes = data;
    } else if (typeof data === 'string') {
      this.text = data;
    }
    this.length = data.length;
  }

  public hasData = () => {
    if (this.bytes === null && this.text === null) {
      return false;
    }
    return true;
  }

  public data = (): string | Uint8Array => {
    if (this.bytes !== null) {
      return this.bytes;
    }
    if (this.text !== null) {
      return this.text;
    }
    throw new Error('Att has no data set');
  }

  public asText = (): string => {
    if (this.text === null && this.bytes !== null) {
      this.text = Str.fromUint8(this.bytes);
    }
    if (this.text !== null) {
      return this.text;
    }
    throw new Error('Att has no data set');
  }

  public asBytes = (): Uint8Array => {
    if (this.bytes === null && this.text !== null) {
      this.bytes = Str.toUint8(this.text);
    }
    if (this.bytes !== null) {
      return this.bytes;
    }
    throw new Error('Att has no data set');
  }

  public treatAs = (): Att$treatAs => {
    // todo - should return a probability in the range of certain-likely-maybe
    // could also return possible types as an array - which makes basic usage more difficult - to think through
    // better option - add an "unknown" type: when encountered, code consuming this should inspect a chunk of contents
    if (this.treatAsValue) { // pre-set
      return this.treatAsValue;
    } else if (Value.is(this.name).in(['PGPexch.htm.pgp', 'PGPMIME version identification', 'Version.txt'])) {
      return 'hidden';  // PGPexch.htm.pgp is html alternative of textual body content produced by PGP Desktop and GPG4o
    } else if (this.name === 'signature.asc' || this.type === 'application/pgp-signature') {
      return 'signature';
    } else if (!this.name && !Value.is('image/').in(this.type)) { // this.name may be '' or undefined - catch either
      return this.length < 100 ? 'hidden' : 'message';
    } else if (Value.is(this.name).in(['message', 'msg.asc', 'message.asc', 'encrypted.asc', 'encrypted.eml.pgp', 'Message.pgp'])) {
      return 'message';
    } else if (this.name.match(/(\.pgp$)|(\.gpg$)|(\.[a-zA-Z0-9]{3,4}\.asc$)/g)) { // ends with one of .gpg, .pgp, .???.asc, .????.asc
      return 'encrypted';
    } else if (this.name.match(/^(0|0x)?[A-F0-9]{8}([A-F0-9]{8})?.*\.asc$/g)) { // name starts with a key id
      return 'publicKey';
    } else if (Value.is('public').in(this.name.toLowerCase()) && this.name.match(/[A-F0-9]{8}.*\.asc$/g)) { // name contains the word "public", any key id and ends with .asc
      return 'publicKey';
    } else if (this.name.match(/\.asc$/) && this.length < 100000 && !this.inline) {
      return 'message';
    } else {
      return 'standard';
    }
  }

  public static methods = {
    objUrlCreate: (content: Uint8Array | string) => window.URL.createObjectURL(new Blob([content], { type: 'application/octet-stream' })),
    objUrlConsume: async (url: string) => {
      let uint8 = await Att.methods.downloadAsUint8(url, null);
      window.URL.revokeObjectURL(url);
      return uint8;
    },
    downloadAsUint8: (url: string, progress: ProgressCb | null = null): Promise<Uint8Array> => new Promise((resolve, reject) => {
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
    saveToDownloads: (att: Att, renderIn: JQuery<HTMLElement> | null = null) => {
      let blob = new Blob([att.data()], { type: att.type });
      if (window.navigator && window.navigator.msSaveOrOpenBlob) {
        window.navigator.msSaveBlob(blob, att.name);
      } else {
        let a = window.document.createElement('a');
        a.href = window.URL.createObjectURL(blob);
        a.download = Xss.htmlEscape(att.name);
        if (renderIn) {
          a.textContent = 'DECRYPTED FILE';
          a.style.cssText = 'font-size: 16px; font-weight: bold;';
          Xss.sanitizeRender(renderIn, '<div style="font-size: 16px;padding: 17px 0;">File is ready.<br>Right-click the link and select <b>Save Link As</b></div>');
          renderIn.append(a); // xss-escaped attachment name above
          renderIn.css('height', 'auto');
          renderIn.find('a').click(e => {
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
          Catch.setHandledTimeout(() => window.URL.revokeObjectURL(a.href), 0);
        }
      }
    },
    pgpNamePatterns: () => ['*.pgp', '*.gpg', '*.asc', 'noname', 'message', 'PGPMIME version identification', ''],
    keyinfoAsPubkeyAtt: (ki: KeyInfo) => new Att({ data: ki.public, type: 'application/pgp-keys', name: `0x${ki.longid}.asc` }),
  };

}
