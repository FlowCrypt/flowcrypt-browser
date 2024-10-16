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
  private thunderbirdEmailSelector = $('div.moz-text-plain');

  public getIntervalFunctions = (): IntervalFunction[] => {
    return [{ interval: 2000, handler: () => this.replaceThunderbirdMsgPane() }];
  };

  public replaceThunderbirdMsgPane = async () => {
    if (Catch.isThunderbirdMail()) {
      const { messagePart, attachments } = await BrowserMsg.send.bg.await.thunderbirdMsgGet();
      if (!messagePart) {
        return;
      } else {
        const acctEmail = await BrowserMsg.send.bg.await.thunderbirdGetCurrentUser();
        const parsedPubs = (await ContactStore.getOneWithAllPubkeys(undefined, String(acctEmail)))?.sortedPubkeys ?? [];
        const signerKeys = parsedPubs.map(key => KeyUtil.armor(key.pubkey));
        if (this.isPublicKeyEncryptedMsg()) {
          const result = await MsgUtil.decryptMessage({
            kisWithPp: await KeyStore.getAllWithOptionalPassPhrase(String(acctEmail)),
            encryptedData: this.emailBodyFromThunderbirdMail,
            verificationPubs: signerKeys,
          });
          if (result.success && result.content) {
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
          } else {
            const decryptErr = result as DecryptError;
            let decryptionErrorMsg = '';
            if (decryptErr.error && decryptErr.error.type === DecryptErrTypes.needPassphrase) {
              const acctEmail = String(await BrowserMsg.send.bg.await.thunderbirdGetCurrentUser());
              const longids = decryptErr.longids.needPassphrase.join(',');
              decryptionErrorMsg = `decrypt error: private key needs to be unlocked by your passphrase.`;
              await BrowserMsg.send.bg.await.thunderbirdOpenPassphraseDiaglog({ acctEmail, longids });
            } else {
              decryptionErrorMsg = `decrypt error: ${(result as DecryptError).error.message}`;
            }
            const pgpBlock = this.generatePgpBlockTemplate(decryptionErrorMsg, 'not signed', this.emailBodyFromThunderbirdMail);
            $('body').html(pgpBlock); // xss-sanitized
          }
        } else if (this.isCleartextMsg()) {
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
      }
      if (!attachments.length) {
        return;
      } else {
        for (const attachment of attachments) {
          const generatedPgpTemplate = this.generatePgpAttachmentTemplate(attachment.name);
          const pgpAttachmentHtml = $('<div>');
          pgpAttachmentHtml.html(generatedPgpTemplate); // xss-sanitized
          $('.pgp_attachments_block').append(pgpAttachmentHtml); // xss-sanitized
          // todo: detached signed message via https://github.com/FlowCrypt/flowcrypt-browser/issues/5668
        }
      }
    }
  };

  private generatePgpBlockTemplate = (encryptionStatus: string, verificationStatus: string, messageToRender: string): string => {
    return `
      <div ${encryptionStatus === 'encrypted' ? 'class="pgp_secure"' : 'class="pgp_neutral"'}>
        <div>
          <div id="pgp_encryption" class="pgp_badge short ${encryptionStatus === 'encrypted' ? 'green_label' : 'red_label'}">${encryptionStatus}</div>
          <div id="pgp_signature" class="pgp_badge short ${verificationStatus === 'signed' ? 'green_label' : 'red_label'}">${verificationStatus}</div>
        </div>
        <div class="pgp_block">
        <pre>${Xss.escape(messageToRender)}</pre>
        </div>
        <div class="pgp_attachments_block">
        </div>
      </div>`;
  };

  private generatePgpAttachmentTemplate = (attachmentName: string): string => {
    return `<div>
    <div class="attachment_name">${Xss.escape(attachmentName)}</div>
    </div>
    `;
  };

  private isCleartextMsg = (): boolean => {
    const emailBody = this.thunderbirdEmailSelector.text().trim();
    return this.resemblesCleartextMsg(emailBody);
  };

  private resemblesCleartextMsg = (body: string) => {
    this.emailBodyFromThunderbirdMail = body;
    return (
      body.startsWith(PgpArmor.ARMOR_HEADER_DICT.signedMsg.begin) &&
      body.includes(String(PgpArmor.ARMOR_HEADER_DICT.signedMsg.middle)) &&
      body.endsWith(String(PgpArmor.ARMOR_HEADER_DICT.signedMsg.end))
    );
  };

  private isPublicKeyEncryptedMsg = (): boolean => {
    // todo - recognized email sent via FlowCrypt encrypted contact pages
    const emailBody = this.thunderbirdEmailSelector.text().trim();
    return this.resemblesAsciiArmoredMsg(emailBody);
  };

  private resemblesAsciiArmoredMsg = (body: string): boolean => {
    this.emailBodyFromThunderbirdMail = body;
    return body.startsWith(PgpArmor.ARMOR_HEADER_DICT.encryptedMsg.begin) && body.endsWith(PgpArmor.ARMOR_HEADER_DICT.encryptedMsg.end as string);
  };
}
