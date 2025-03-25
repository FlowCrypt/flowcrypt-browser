/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { BaseMailFormatter } from './base-mail-formatter.js';
import { BrowserWindow } from '../../../../js/common/browser/browser-window.js';
import { Catch } from '../../../../js/common/platform/catch.js';
import { getUniqueRecipientEmails, NewMsgData } from '../compose-types.js';
import { Key } from '../../../../js/common/core/crypto/key.js';
import { MsgUtil } from '../../../../js/common/core/crypto/pgp/msg-util.js';
import { SendableMsg } from '../../../../js/common/api/email-provider/sendable-msg.js';
import { Mime, SendableMsgBody } from '../../../../js/common/core/mime.js';
import { ContactStore } from '../../../../js/common/platform/store/contact-store.js';

export class SignedMsgMailFormatter extends BaseMailFormatter {
  public sendableMsg = async (newMsg: NewMsgData, signingPrv: Key): Promise<SendableMsg> => {
    this.view.errModule.debug(`SignedMsgMailFormatter.sendableMsg signing with key: ${signingPrv.id}`);
    const attachments = this.isDraft ? [] : await this.view.attachmentsModule.attachment.collectAttachments();
    if (signingPrv.family === 'x509') {
      // todo: attachments, richtext #4046, #4047
      if (this.isDraft) {
        throw new Error('signed-only PKCS#7 drafts are not supported');
      }
      const msgBody = this.richtext ? { 'text/plain': newMsg.plaintext, 'text/html': newMsg.plainhtml } : { 'text/plain': newMsg.plaintext };
      // eslint-disable-next-line @typescript-eslint/naming-convention
      const mimeEncodedPlainMessage = await Mime.encode(msgBody, { Subject: newMsg.subject }, attachments);
      return await this.signMimeMessage(signingPrv, mimeEncodedPlainMessage, newMsg);
    }
    if (!this.richtext) {
      // Folding the lines or GMAIL WILL RAPE THE TEXT, regardless of what encoding is used
      // https://mathiasbynens.be/notes/gmail-plain-text applies to API as well
      // resulting in.. wait for it.. signatures that don't match
      // if you are reading this and have ideas about better solutions which:
      //  - don't involve text/html ( Enigmail refuses to fix: https://sourceforge.net/p/enigmail/bugs/218/ - Patrick Brunschwig - 2017-02-12 )
      //  - don't require text to be sent as an attachment
      //  - don't require all other clients to support PGP/MIME
      // then please const me know. Eagerly waiting! In the meanwhile..
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      newMsg.plaintext = (window as unknown as BrowserWindow)['emailjs-mime-codec'].foldLines(newMsg.plaintext, 76, true);
      // Gmail will also remove trailing spaces on the end of each line in transit, causing signatures that don't match
      // Removing them here will prevent Gmail from screwing up the signature
      newMsg.plaintext = newMsg.plaintext
        .split('\n')
        .map(l => l.replace(/\s+$/g, ''))
        .join('\n')
        .trim();
      const signedData = await MsgUtil.sign(signingPrv, newMsg.plaintext);
      const recipients = getUniqueRecipientEmails(newMsg.recipients);
      ContactStore.update(undefined, recipients, { lastUse: Date.now() }).catch(Catch.reportErr);
      return await SendableMsg.createInlineArmored(this.acctEmail, this.headers(newMsg), signedData, attachments);
    }
    // pgp/mime detached signature - it must be signed later, while being mime-encoded
    // prepare a sign function first, which will be used by Mime.encodePgpMimeSigned later
    const body: SendableMsgBody = { 'text/plain': newMsg.plaintext, 'text/html': newMsg.plainhtml };
    const signMethod = (signable: string) => MsgUtil.sign(signingPrv, signable, true);
    return await SendableMsg.createPgpMimeSigned(this.acctEmail, this.headers(newMsg), body, attachments, signMethod);
  };
}
