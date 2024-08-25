/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { BrowserMsg } from '../../../common/browser/browser-msg.js';
import { KeyUtil } from '../../../common/core/crypto/key.js';
import { DecryptError, DecryptErrTypes, MsgUtil } from '../../../common/core/crypto/pgp/msg-util.js';
import { OpenPGPKey } from '../../../common/core/crypto/pgp/openpgp-key.js';
import { PgpArmor } from '../../../common/core/crypto/pgp/pgp-armor';
import { Catch } from '../../../common/platform/catch';
import { ContactStore } from '../../../common/platform/store/contact-store.js';
import { KeyStore } from '../../../common/platform/store/key-store.js';
import { Xss } from '../../../common/platform/xss.js';
import { IntervalFunction, WebmailElementReplacer } from '../generic/webmail-element-replacer.js';
import * as openpgp from 'openpgp';

export class ThunderbirdElementReplacer extends WebmailElementReplacer {
  public setReplyBoxEditable: () => Promise<void>;
  public reinsertReplyBox: (replyMsgId: string) => void;
  public scrollToReplyBox: (replyMsgId: string) => void;
  public scrollToCursorInReplyBox: (replyMsgId: string, cursorOffsetTop: number) => void;
  private emailBodyFromThunderbirdMail: string;

  public getIntervalFunctions = (): IntervalFunction[] => {
    return [{ interval: 2000, handler: () => this.replaceThunderbirdMsgPane() }];
  };

  public replaceThunderbirdMsgPane = async () => {
    if (Catch.isThunderbirdMail()) {
      const fullMsg = await BrowserMsg.send.bg.await.thunderbirdMsgGet();
      if (!fullMsg) {
        return;
      } else {
        if (this.isPublicKeyEncryptedMsg(fullMsg)) {
          const acctEmail = await BrowserMsg.send.bg.await.thunderbirdGetCurrentUser();
          const parsedPubs = (await ContactStore.getOneWithAllPubkeys(undefined, String(acctEmail)))?.sortedPubkeys ?? [];
          const signerKeys = parsedPubs.map(key => KeyUtil.armor(key.pubkey));
          const result = await MsgUtil.decryptMessage({
            kisWithPp: await KeyStore.getAllWithOptionalPassPhrase(String(acctEmail)),
            encryptedData: this.emailBodyFromThunderbirdMail,
            verificationPubs: signerKeys,
          });
          if ((result as DecryptError).error && (result as DecryptError).error.type === DecryptErrTypes.needPassphrase) {
            // thunderbird does not allow script to access moz-extension:// and window.alert/confirm does work
            // needs to show help directly from the email body where-in detected as PGP message and such.
            // workaround here would be -- start thunderbird setup with passphrase remembered upon key recovery or generation
          }
          if (result.content && result.success) {
            const decryptedMsg = result.content.toUtfStr();
            const encryptionStatus = result.isEncrypted ? 'encrypted' : 'not encrypted';
            let verificationStatus = '';
            if (result?.signature) {
              if (result.signature.match) {
                verificationStatus = 'signed';
              } else if (result.signature.error) {
                verificationStatus = `could not verify signature: ${result.signature.error}`;
              } else {
                verificationStatus = 'not signed';
              }
            }
            const pgpBlock = this.generatePgpBlockTemplate(encryptionStatus, verificationStatus, decryptedMsg);
            $('body').html(pgpBlock); // xss-sanitized
          }
        } else if (this.isCleartextMsg(fullMsg)) {
          const acctEmail = await BrowserMsg.send.bg.await.thunderbirdGetCurrentUser();
          const parsedPubs = (await ContactStore.getOneWithAllPubkeys(undefined, String(acctEmail)))?.sortedPubkeys ?? [];
          const signerKeys = parsedPubs.map(key => KeyUtil.armor(key.pubkey));
          const message = await openpgp.readCleartextMessage({ cleartextMessage: this.emailBodyFromThunderbirdMail });
          const result = await OpenPGPKey.verify(message, await ContactStore.getPubkeyInfos(undefined, signerKeys));
          let verificationStatus = '';
          let signedMessage = '';
          if (result.match && result.content) {
            verificationStatus = 'signed';
            signedMessage = result.content.toUtfStr();
          } else if (result.error) {
            verificationStatus = `could not verify signature: ${result.error}`;
          }
          const pgpBlock = this.generatePgpBlockTemplate('not encrypted', verificationStatus, signedMessage);
          $('body').html(pgpBlock); // xss-sanitized
        }
        // else if detached signed message
      }
    }
  };

  private generatePgpBlockTemplate = (encryptionStatus: string, verificationStatus: string, messageToRender: string): string => {
    const pgpBlockTemplate = `
      <div class="pgp_secure">
        <div>
          <div id="pgp_encryption" class="pgp_badge short ${encryptionStatus === 'encrypted' ? 'green_label' : 'red_label'}">${encryptionStatus}</div>
          <div id="pgp_signature" class="pgp_badge short ${verificationStatus === 'signed' ? 'green_label' : 'red_label'}">${verificationStatus}</div>
        </div>
        <div class="pgp_block">
        <pre>${Xss.escape(messageToRender)}</pre>
        </div>
      </div>`;
    return pgpBlockTemplate;
  };

  private isCleartextMsg = (fullMsg: messenger.messages.MessagePart): boolean => {
    const isClearTextMsg =
      (fullMsg.headers &&
        'openpgp' in fullMsg.headers &&
        fullMsg.parts &&
        fullMsg.parts[0]?.parts?.length === 1 &&
        fullMsg.parts[0].parts[0].contentType === 'text/plain' &&
        this.resemblesCleartextMsg(fullMsg.parts[0].parts[0].body?.trim() || '')) ||
      false;
    return isClearTextMsg;
  };

  private resemblesCleartextMsg = (body: string) => {
    this.emailBodyFromThunderbirdMail = body;
    return (
      body.startsWith(PgpArmor.ARMOR_HEADER_DICT.signedMsg.begin) &&
      body.includes(String(PgpArmor.ARMOR_HEADER_DICT.signedMsg.middle)) &&
      body.endsWith(String(PgpArmor.ARMOR_HEADER_DICT.signedMsg.end))
    );
  };

  private isPublicKeyEncryptedMsg = (fullMsg: messenger.messages.MessagePart): boolean => {
    const isPublicKeyEncrypted =
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
        this.resemblesAsciiArmoredMsg(fullMsg.parts[0]?.parts[0].body?.trim() || '')) ||
      false;
    return isPublicKeyEncrypted;
  };

  private resemblesAsciiArmoredMsg = (body: string): boolean => {
    this.emailBodyFromThunderbirdMail = body;
    return body.startsWith(PgpArmor.ARMOR_HEADER_DICT.encryptedMsg.begin) && body.endsWith(PgpArmor.ARMOR_HEADER_DICT.encryptedMsg.end as string);
  };
}
