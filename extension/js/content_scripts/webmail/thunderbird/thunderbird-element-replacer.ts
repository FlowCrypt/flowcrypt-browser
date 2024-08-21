/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { BrowserMsg } from '../../../common/browser/browser-msg.js';
import { MsgUtil } from '../../../common/core/crypto/pgp/msg-util.js';
import { PgpArmor } from '../../../common/core/crypto/pgp/pgp-armor';
import { Catch } from '../../../common/platform/catch';
import { KeyStore } from '../../../common/platform/store/key-store.js';
import { IntervalFunction, WebmailElementReplacer } from '../generic/webmail-element-replacer.js';

export class ThunderbirdElementReplacer extends WebmailElementReplacer {
  public setReplyBoxEditable: () => Promise<void>;
  public reinsertReplyBox: (replyMsgId: string) => void;
  public scrollToReplyBox: (replyMsgId: string) => void;
  public scrollToCursorInReplyBox: (replyMsgId: string, cursorOffsetTop: number) => void;
  private encryptedData: string;

  public getIntervalFunctions = (): IntervalFunction[] => {
    return [{ interval: 1000, handler: () => this.replaceThunderbirdMsgPane() }];
  };

  public replaceThunderbirdMsgPane = async () => {
    if (Catch.isThunderbirdMail()) {
      const fullMsg = await BrowserMsg.send.bg.await.thunderbirdMsgGet();
      if (fullMsg && this.checkIfPgpEncryptedMsg(fullMsg)) {
        console.log('ready for decryption!');
        const acctEmail = await BrowserMsg.send.bg.await.thunderbirdGetCurrentUser();
        document.body.className = 'pgp_secure';
        const openpgpjsScript = document.createElement('script');
        openpgpjsScript.src = `moz-extension://${messenger.runtime.id}/lib/openpgp.js`;
        openpgpjsScript.type = 'text/javascript';
        document.querySelector('head')?.appendChild(openpgpjsScript);
        // const acctEmail = await BrowserMsg.send.bg.await.thunderbirdGetCurrentUser();
        const result = await MsgUtil.decryptMessage({
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          kisWithPp: await KeyStore.getAllWithOptionalPassPhrase(acctEmail!),
          encryptedData: this.encryptedData,
          verificationPubs: [], // todo: #4158 signature verification of attachments
        });
        console.log(result);
        // note : embeddedMsg for pgp_block injection -> replaceArmoredBlocks
        // do secure compose badge injection eg. signed or encrypted, (secure email status rendering) etc
        // render decrypted message right into the messageDisplay
      }
      // else if signed message found
    }
  };

  private checkIfPgpEncryptedMsg = (fullMsg: messenger.messages.MessagePart) => {
    const isPgpEncryptedMsg =
      (fullMsg.headers &&
        'openpgp' in fullMsg.headers &&
        fullMsg.parts &&
        fullMsg.parts[0]?.parts?.length === 2 &&
        fullMsg.parts[0]?.parts[1].contentType === 'application/pgp-encrypted' &&
        this.resemblesAsciiArmoredMsg(fullMsg.parts[0]?.parts[0].body?.trim() || '')) ||
      (fullMsg.headers &&
        'openpgp' in fullMsg.headers &&
        fullMsg.parts &&
        fullMsg.parts[0]?.parts?.length === 1 &&
        fullMsg.parts[0]?.contentType === 'multipart/mixed' &&
        this.resemblesAsciiArmoredMsg(fullMsg.parts[0]?.parts[0].body?.trim() || ''));
    return isPgpEncryptedMsg;
  };

  private resemblesAsciiArmoredMsg = (body: string) => {
    this.encryptedData = body;
    return body.startsWith(PgpArmor.ARMOR_HEADER_DICT.encryptedMsg.begin) && body.endsWith(PgpArmor.ARMOR_HEADER_DICT.encryptedMsg.end as string);
  };
}
