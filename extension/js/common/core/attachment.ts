/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Buf } from './buf.js';
import { Str } from './common.js';

type Attachment$treatAs = 'publicKey' | 'privateKey' | 'encryptedMsg' | 'hidden' | 'signature' | 'encryptedFile' | 'plainFile' | 'inlineImage';
type ContentTransferEncoding = '7bit' | 'quoted-printable' | 'base64';
export type AttachmentMeta = {
  data?: Uint8Array;
  type?: string;
  name?: string;
  length?: number;
  url?: string;
  inline?: boolean;
  id?: string;
  msgId?: string;
  treatAs?: Attachment$treatAs;
  cid?: string;
  contentDescription?: string;
  contentTransferEncoding?: ContentTransferEncoding;
};

export type FcAttachmentLinkData = { name: string; type: string; size: number };

export class Attachment {
  public static readonly webmailNamePattern =
    /^(((cryptup|flowcrypt)-backup-[a-z0-9]+\.(key|asc))|(.+\.pgp)|(.+\.gpg)|(.+\.asc)|(noname)|(message)|(PGPMIME version identification)|(ATT[0-9]{5})|())$/m;
  public static readonly encryptedMsgNames = ['msg.asc', 'message.asc', 'encrypted.asc', 'encrypted.eml.pgp', 'Message.pgp', 'openpgp-encrypted-message.asc'];

  public length = NaN;
  public type: string;
  public name: string;
  public url: string | undefined;
  public id: string | undefined;
  public msgId: string | undefined;
  public inline: boolean;
  public cid: string | undefined;
  public contentDescription: string | undefined;
  public contentTransferEncoding?: ContentTransferEncoding;

  private bytes: Uint8Array | undefined;
  private treatAsValue: Attachment$treatAs | undefined; // this field is to disable on-the-fly detection by this.treatAs()

  public constructor({ data, type, name, length, url, inline, id, msgId, treatAs, cid, contentDescription, contentTransferEncoding }: AttachmentMeta) {
    if (typeof data === 'undefined' && typeof url === 'undefined' && typeof id === 'undefined') {
      throw new Error('Attachment: one of data|url|id has to be set');
    }
    if (id && !msgId) {
      throw new Error('Attachment: if id is set, msgId must be set too');
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
    this.inline = !!inline;
    this.id = id || undefined;
    this.msgId = msgId || undefined;
    this.treatAsValue = treatAs || undefined;
    this.cid = cid || undefined;
    this.contentDescription = contentDescription || undefined;
    this.contentTransferEncoding = contentTransferEncoding || undefined;
  }

  public static treatAsForPgpEncryptedAttachments = (mimeType: string | undefined, pgpEncryptedIndex: number | undefined) => {
    let treatAs: 'hidden' | 'encryptedMsg' | undefined;
    if (mimeType === 'application/pgp-encrypted' && pgpEncryptedIndex === 0) {
      treatAs = 'hidden';
    }
    if (mimeType === 'application/octet-stream' && pgpEncryptedIndex === 1) {
      treatAs = 'encryptedMsg';
    }
    return treatAs;
  };

  public static keyinfoAsPubkeyAttachment = (ki: { public: string; longid: string }) => {
    const data = Buf.fromUtfStr(ki.public);
    return new Attachment({
      data,
      type: 'application/pgp-keys',
      contentTransferEncoding: Str.is7bit(data) ? '7bit' : 'quoted-printable',
      name: `0x${ki.longid}.asc`,
    });
  };

  public static sanitizeName = (name: string): string => {
    const trimmed = name.trim();
    if (trimmed === '') {
      return '_';
    }
    return trimmed.replace(/[\u0000\u002f\u005c]/g, '_').replace(/__+/g, '_');
  };

  public static attachmentId = (): string => {
    return `f_${Str.sloppyRandom(30)}@flowcrypt`;
  };

  public isPublicKey = (): boolean => {
    if (this.treatAsValue) {
      return this.treatAsValue === 'publicKey';
    }
    return (
      this.type === 'application/pgp-keys' ||
      /^(0|0x)?[A-F0-9]{8}([A-F0-9]{8})?.*\.asc$/g.test(this.name) || // name starts with a key id
      (this.name.toLowerCase().includes('public') && /[A-F0-9]{8}.*\.asc$/g.test(this.name)) || // name contains the word "public", any key id and ends with .asc
      (/\.asc$/.test(this.name) && this.hasData() && Buf.with(this.getData().subarray(0, 100)).toUtfStr().includes('-----BEGIN PGP PUBLIC KEY BLOCK-----'))
    );
  };

  public hasData = () => {
    return this.bytes instanceof Uint8Array;
  };

  public setData = (bytes: Uint8Array) => {
    if (this.hasData()) {
      throw new Error('Attachment bytes already set');
    }
    this.bytes = bytes;
  };

  public getData = (): Buf => {
    if (this.bytes instanceof Buf) {
      return this.bytes;
    }
    if (this.bytes instanceof Uint8Array) {
      return new Buf(this.bytes);
    }
    throw new Error('Attachment has no data set');
  };

  public treatAs = (attachments: Attachment[], isBodyEmpty = false): Attachment$treatAs => {
    if (this.treatAsValue) {
      // pre-set
      return this.treatAsValue;
    } else if (['PGPexch.htm.pgp', 'PGPMIME version identification', 'Version.txt', 'PGPMIME Versions Identification'].includes(this.name)) {
      return 'hidden'; // PGPexch.htm.pgp is html alternative of textual body content produced by PGP Desktop and GPG4o
    } else if (this.name === 'signature.asc') {
      return 'signature';
    } else if (this.type === 'application/pgp-signature') {
      // this may be a signature for an attachment following these patterns:
      // sample.name.sig for sample.name.pgp #3448
      // or sample.name.sig for sample.name
      if (attachments.length > 1) {
        const nameWithoutExtension = Str.getFilenameWithoutExtension(this.name);
        if (attachments.some(a => a !== this && (a.name === nameWithoutExtension || Str.getFilenameWithoutExtension(a.name) === nameWithoutExtension))) {
          return 'hidden';
        }
      }
      return 'signature';
    } else if (this.inline && this.type.startsWith('image/')) {
      return 'inlineImage';
    } else if (!this.name && !this.type.startsWith('image/')) {
      // this.name may be '' or undefined - catch either
      return this.length < 100 ? 'hidden' : 'encryptedMsg';
    } else if (this.name === 'msg.asc' && this.length < 100 && this.type === 'application/pgp-encrypted') {
      return 'hidden'; // mail.ch does this - although it looks like encrypted msg, it will just contain PGP version eg "Version: 1"
    } else if (Attachment.encryptedMsgNames.includes(this.name)) {
      return 'encryptedMsg';
    } else if (this.name === 'message' && isBodyEmpty) {
      // treat message as encryptedMsg when empty body for the 'message' attachment
      return 'encryptedMsg';
    } else if (this.name.match(/(\.pgp$)|(\.gpg$)|(\.[a-zA-Z0-9]{3,4}\.asc$)/g)) {
      // ends with one of .gpg, .pgp, .???.asc, .????.asc
      return 'encryptedFile';
      // todo: after #4906 is done we should "decrypt" the encryptedFile here to see if it's a binary 'publicKey' (as in message 1869220e0c8f16dd)
    } else if (this.isPublicKey()) {
      return 'publicKey';
    } else if (this.name.match(/(cryptup|flowcrypt)-backup-[a-z0-9]+\.(key|asc)$/g)) {
      return 'privateKey';
    } else if (this.name.match(/\.asc$/) && this.length < 100000 && !this.inline) {
      return 'encryptedMsg';
    } else {
      return 'plainFile';
    }
  };

  public isExecutableFile = () => {
    return [
      'ade',
      'adp',
      'apk',
      'appx',
      'appxbundle',
      'bat',
      'cab',
      'chm',
      'cmd',
      'com',
      'cpl',
      'diagcab',
      'diagcfg',
      'diagpack',
      'dll',
      'dmg',
      'ex',
      'ex_',
      'exe',
      'hta',
      'img',
      'ins',
      'iso',
      'isp',
      'jar',
      'jnlp',
      'js',
      'jse',
      'lib',
      'lnk',
      'mde',
      'msc',
      'msi',
      'msix',
      'msixbundle',
      'msp',
      'mst',
      'nsh',
      'pif',
      'ps1',
      'scr',
      'sct',
      'shb',
      'sys',
      'vb',
      'vbe',
      'vbs',
      'vhd',
      'vxd',
      'wsc',
      'wsf',
      'wsh',
      'xll',
    ].some(exeFileExtension => this.name.endsWith('.' + exeFileExtension));
  };
}
