/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { DecryptError, VerifyRes } from './pgp-msg.js';

import { AttMeta } from './att.js';
import { Buf } from './buf.js';
import { KeyDetails } from './pgp-key.js';

export type KeyBlockType = 'publicKey' | 'privateKey';
export type ReplaceableMsgBlockType = KeyBlockType | 'signedMsg' | 'encryptedMsg' | 'encryptedMsgLink';
export type MsgBlockType = ReplaceableMsgBlockType | 'plainText' | 'decryptedText' | 'plainHtml' | 'decryptedHtml' | 'plainAtt' | 'encryptedAtt'
  | 'decryptedAtt' | 'encryptedAttLink' | 'decryptErr' | 'verifiedMsg' | 'signedHtml';

export class MsgBlock {

  public static fromContent = (type: MsgBlockType, content: string | Buf, missingEnd = false): MsgBlock => {
    return new MsgBlock(type, content, !missingEnd);
  }

  public static fromKeyDetails = (type: MsgBlockType, content: string, keyDetails: KeyDetails): MsgBlock => {
    return new MsgBlock(type, content, true, undefined, keyDetails);
  }

  public static fromAtt = (type: MsgBlockType, content: string, attMeta: AttMeta): MsgBlock => {
    return new MsgBlock(type, content, true, undefined, undefined, attMeta);
  }

  constructor(
    public type: MsgBlockType,
    public content: string | Buf,
    public complete: boolean,
    public signature?: string,
    public keyDetails?: KeyDetails, // only in publicKey when returned to Android (could eventually be made mandatory, done straight in detectBlocks?)
    public attMeta?: AttMeta, // only in plainAtt, encryptedAtt, decryptedAtt, encryptedAttLink (not sure if always)
    public decryptErr?: DecryptError, // only in decryptErr block, always
    public verifyRes?: VerifyRes,
  ) {
  }

  /**
   * todo - rethink - cannot 100% garantee that would be UTF string, what if it was raw bytes string?
   *    see if we can review usage and forbid use of strings in this.content. Also investigate if used in flowcrypt-mobile-core, and why
   */
  public getContentBuf = () => {
    return this.content instanceof Buf ? this.content : Buf.fromUtfStr(this.content);
  }

}
