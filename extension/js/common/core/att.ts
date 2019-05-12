/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Buf } from './buf.js';

type Att$treatAs = "publicKey" | 'privateKey' | "encryptedMsg" | "hidden" | "signature" | "encryptedFile" | "plainFile";
export type AttMeta = {
  data?: Uint8Array; type?: string; name?: string; length?: number; url?: string;
  inline?: boolean; id?: string; msgId?: string; treatAs?: Att$treatAs; cid?: string;
};

export type FcAttLinkData = { name: string, type: string, size: number };

export class Att {

  private bytes: Uint8Array | undefined;
  private treatAsValue: Att$treatAs | undefined;

  public length: number = NaN;
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
    if (data) {
      this.bytes = data;
      this.length = data.length;
    } else {
      this.length = Number(length);
    }
    this.name = name || '';
    this.type = type || 'application/octet-stream';
    this.url = url || undefined;
    this.inline = inline !== true;
    this.id = id || undefined;
    this.msgId = msgId || undefined;
    this.treatAsValue = treatAs || undefined;
    this.cid = cid || undefined;
  }

  public hasData = () => this.bytes instanceof Uint8Array;

  public setData = (bytes: Uint8Array) => {
    if (this.hasData()) {
      throw new Error('Att bytes already set');
    }
    this.bytes = bytes;
  }

  public getData = (): Buf => {
    if (this.bytes instanceof Buf) {
      return this.bytes;
    }
    if (this.bytes instanceof Uint8Array) {
      return new Buf(this.bytes);
    }
    throw new Error('Att has no data set');
  }

  public treatAs = (): Att$treatAs => {
    // todo - should return a probability in the range of certain-likely-maybe
    // could also return possible types as an array - which makes basic usage more difficult - to think through
    // better option - add an "unknown" type: when encountered, code consuming this should inspect a chunk of contents
    if (this.treatAsValue) { // pre-set
      return this.treatAsValue;
    } else if (['PGPexch.htm.pgp', 'PGPMIME version identification', 'Version.txt', 'PGPMIME Versions Identification'].includes(this.name)) {
      return 'hidden';  // PGPexch.htm.pgp is html alternative of textual body content produced by PGP Desktop and GPG4o
    } else if (this.name === 'signature.asc' || this.type === 'application/pgp-signature') {
      return 'signature';
    } else if (!this.name && !this.type.startsWith('image/')) { // this.name may be '' or undefined - catch either
      return this.length < 100 ? 'hidden' : 'encryptedMsg';
    } else if (['message', 'msg.asc', 'message.asc', 'encrypted.asc', 'encrypted.eml.pgp', 'Message.pgp'].includes(this.name)) {
      return 'encryptedMsg';
    } else if (this.name.match(/(\.pgp$)|(\.gpg$)|(\.[a-zA-Z0-9]{3,4}\.asc$)/g)) { // ends with one of .gpg, .pgp, .???.asc, .????.asc
      return 'encryptedFile';
    } else if (this.name.match(/(cryptup|flowcrypt)-backup-[a-z]+\.key/g)) {
      return 'privateKey';
    } else if (this.name.match(/^(0|0x)?[A-F0-9]{8}([A-F0-9]{8})?.*\.asc$/g)) { // name starts with a key id
      return 'publicKey';
    } else if (this.name.toLowerCase().includes('public') && this.name.match(/[A-F0-9]{8}.*\.asc$/g)) { // name contains the word "public", any key id and ends with .asc
      return 'publicKey';
    } else if (this.name.match(/\.asc$/) && this.length < 100000 && !this.inline) {
      return 'encryptedMsg';
    } else {
      return 'plainFile';
    }
  }

  public static readonly attachmentsPattern = /^(((cryptup|flowcrypt)-backup-[a-z]+\.key)|(.+\.pgp)|(.+\.gpg)|(.+\.asc)|(noname)|(message)|(PGPMIME version identification)|())$/gm;

  public static keyinfoAsPubkeyAtt = (ki: { public: string, longid: string }) => new Att({ data: Buf.fromUtfStr(ki.public), type: 'application/pgp-keys', name: `0x${ki.longid}.asc` });

}
