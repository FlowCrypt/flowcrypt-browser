/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { DecryptError, VerifyRes } from './crypto/pgp/msg-util.js';

import { AttMeta } from './attachment.js';
import { Buf } from './buf.js';

export type KeyBlockType = 'publicKey' | 'privateKey' | 'certificate';
export type ReplaceableMsgBlockType = KeyBlockType | 'signedMsg' | 'encryptedMsg';
export type MsgBlockType = ReplaceableMsgBlockType | 'plainText' | 'signedText' | 'plainHtml' | 'decryptedHtml' | 'plainAtt' | 'encryptedAtt'
  | 'decryptedAtt' | 'encryptedAttLink' | 'decryptErr' | 'verifiedMsg' | 'signedHtml';

export class MsgBlock {

  public static fromContent = (type: MsgBlockType, content: string | Buf, missingEnd = false): MsgBlock => {
    return new MsgBlock(type, content, !missingEnd);
  }

  public static fromAtt = (type: MsgBlockType, content: string, attMeta: AttMeta): MsgBlock => {
    return new MsgBlock(type, content, true, undefined, attMeta);
  }

  constructor(
    public type: MsgBlockType,
    public content: string | Buf,
    public complete: boolean,
    public signature?: string,
    public attMeta?: AttMeta, // only in plainAtt, encryptedAtt, decryptedAtt, encryptedAttLink (not sure if always)
    public decryptErr?: DecryptError, // only in decryptErr block, always
    public verifyRes?: VerifyRes,
  ) {
  }

}
