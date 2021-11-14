/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { DecryptError, VerifyRes } from './crypto/pgp/msg-util.js';

import { AttachmentMeta } from './attachment.js';
import { Buf } from './buf.js';

export type KeyBlockType = 'publicKey' | 'privateKey' | 'certificate' | 'pkcs12' | 'pkcs8EncryptedPrivateKey' | 'pkcs8PrivateKey' | 'pkcs8RsaPrivateKey';
export type ReplaceableMsgBlockType = KeyBlockType | 'signedMsg' | 'encryptedMsg' | 'pkcs7';
export type MsgBlockType = ReplaceableMsgBlockType | 'plainText' | 'signedText' | 'plainHtml' | 'decryptedHtml' | 'plainAttachment' | 'encryptedAttachment'
  | 'decryptedAttachment' | 'encryptedAttachmentLink' | 'decryptErr' | 'verifiedMsg' | 'signedHtml';

export class MsgBlock {

  public static fromContent = (type: MsgBlockType, content: string | Buf, missingEnd = false): MsgBlock => {
    return new MsgBlock(type, content, !missingEnd);
  };

  public static fromAttachment = (type: MsgBlockType, content: string, attachmentMeta: AttachmentMeta): MsgBlock => {
    return new MsgBlock(type, content, true, undefined, attachmentMeta);
  };

  constructor(
    public type: MsgBlockType,
    public content: string | Buf,
    public complete: boolean,
    public signature?: string,
    public attachmentMeta?: AttachmentMeta, // only in plainAttachment, encryptedAttachment, decryptedAttachment, encryptedAttachmentLink (not sure if always)
    public decryptErr?: DecryptError, // only in decryptErr block, always
    public verifyRes?: VerifyRes,
  ) {
  }

}
