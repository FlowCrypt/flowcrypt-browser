/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Str, Value } from './common.js';
import { KeyInfo } from '../platform/store.js';

type Att$treatAs = "publicKey" | "message" | "hidden" | "signature" | "encrypted" | "standard";
type AttMeta = {
  data?: string | Uint8Array; type?: string; name?: string; length?: number; url?: string;
  inline?: boolean; id?: string; msgId?: string; treatAs?: Att$treatAs; cid?: string;
};

export type FcAttLinkData = { name: string, type: string, size: number };

export class Att {

  private text: string | undefined = undefined;
  private bytes: Uint8Array | undefined = undefined;
  private treatAsValue: Att$treatAs | undefined = undefined;

  public length: number;
  public type: string;
  public name: string;
  public url: string | undefined;
  public id: string | undefined;
  public msgId: string | undefined;
  public inline: boolean;
  public cid: string | undefined;

  constructor({ data, type, name, length, url, inline, id, msgId, treatAs, cid }: AttMeta) {
    if (typeof data === 'undefined' && typeof url === 'undefined' && typeof id === 'undefined') {
      throw new Error('Att: one of data|url|id has to be set');
    }
    if (id && !msgId) {
      throw new Error('Att: if id is set, msgId must be set too');
    }
    if (typeof data !== null && typeof data !== 'undefined') {
      this.setData(data);
    }
    this.name = name || '';
    this.type = type || 'application/octet-stream';
    this.length = data ? data.length : (length || NaN);
    this.url = url || undefined;
    this.inline = inline !== true;
    this.id = id || undefined;
    this.msgId = msgId || undefined;
    this.treatAsValue = treatAs || undefined;
    this.cid = cid || undefined;
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
    if (typeof this.bytes === 'undefined' && typeof this.text === 'undefined') {
      return false;
    }
    return true;
  }

  public data = (): string | Uint8Array => {
    if (typeof this.bytes !== 'undefined') {
      return this.bytes;
    }
    if (typeof this.text !== 'undefined') {
      return this.text;
    }
    throw new Error('Att has no data set');
  }

  public asText = (): string => {
    if (typeof this.text === 'undefined' && typeof this.bytes !== 'undefined') {
      this.text = Str.fromUint8(this.bytes);
    }
    if (typeof this.text !== 'undefined') {
      return this.text;
    }
    throw new Error('Att has no data set');
  }

  public asBytes = (): Uint8Array => {
    if (typeof this.bytes === 'undefined' && typeof this.text !== 'undefined') {
      this.bytes = Str.toUint8(this.text);
    }
    if (typeof this.bytes !== 'undefined') {
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

  public static pgpNamePatterns = () => ['*.pgp', '*.gpg', '*.asc', 'noname', 'message', 'PGPMIME version identification', ''];

  public static keyinfoAsPubkeyAtt = (ki: KeyInfo) => new Att({ data: ki.public, type: 'application/pgp-keys', name: `0x${ki.longid}.asc` });

}
