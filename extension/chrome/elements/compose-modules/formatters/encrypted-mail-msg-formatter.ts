/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { BaseMailFormatter } from './base-mail-formatter.js';
import { ComposerResetBtnTrigger } from '../compose-err-module.js';
import { Mime, SendableMsgBody } from '../../../../js/common/core/mime.js';
import { NewMsgData } from '../compose-types.js';
import { Str, Url, Value } from '../../../../js/common/core/common.js';
import { ApiErr } from '../../../../js/common/api/shared/api-error.js';
import { Attachment } from '../../../../js/common/core/attachment.js';
import { Buf } from '../../../../js/common/core/buf.js';
import { Catch } from '../../../../js/common/platform/catch.js';
import { Lang } from '../../../../js/common/lang.js';
import { PubkeyResult, Key, KeyUtil } from '../../../../js/common/core/crypto/key.js';
import { MsgUtil, PgpMsgMethod } from '../../../../js/common/core/crypto/pgp/msg-util.js';
import { SendableMsg } from '../../../../js/common/api/email-provider/sendable-msg.js';
import { Settings } from '../../../../js/common/settings.js';
import { Ui } from '../../../../js/common/browser/ui.js';
import { Xss } from '../../../../js/common/platform/xss.js';
import { AcctStore } from '../../../../js/common/platform/store/acct-store.js';
import { FcUuidAuth } from '../../../../js/common/api/account-servers/flowcrypt-com-api.js';
import { SmimeKey } from '../../../../js/common/core/crypto/smime/smime-key.js';
import { PgpHash } from '../../../../js/common/core/crypto/pgp/pgp-hash.js';

export class EncryptedMsgMailFormatter extends BaseMailFormatter {

  public sendableMsg = async (newMsg: NewMsgData, pubkeys: PubkeyResult[], signingPrv?: Key): Promise<SendableMsg> => {
    if (newMsg.pwd && !this.isDraft) {
      // password-protected message, temporarily uploaded (already encrypted) to:
      //    - flowcrypt.com/api (consumers and customers without on-prem setup), or
      //    - FlowCrypt Enterprise Server (enterprise customers with on-prem setup)
      //    It will be served to recipient through web
      const msgUrl = await this.prepareAndUploadPwdEncryptedMsg(newMsg); // encrypted for pwd only, pubkeys ignored
      newMsg.pwd = undefined;
      return await this.sendablePwdMsg(newMsg, pubkeys, msgUrl, signingPrv); // encrypted for pubkeys only, pwd ignored
    } else if (this.richtext) { // rich text: PGP/MIME - https://tools.ietf.org/html/rfc3156#section-4
      // or S/MIME
      return await this.sendableRichTextMsg(newMsg, pubkeys, signingPrv);
    } else { // simple text: PGP or S/MIME Inline with attachments in separate files
      // todo: #4046 check attachments for S/MIME
      return await this.sendableSimpleTextMsg(newMsg, pubkeys, signingPrv);
    }
  };

  private prepareAndUploadPwdEncryptedMsg = async (newMsg: NewMsgData): Promise<string> => {
    // PGP/MIME + included attachments (encrypted for password only)
    if (!newMsg.pwd) {
      throw new Error('password unexpectedly missing');
    }
    /**
     * There are two mechanisms to send password protected messages: flowcrypt.com/api and FES
     *  - flowcrypt.com/api is older API, shared instance used by non-enterprise customers
     *  - FES is a more recent API, a dedicated instance that an enterprise customer may run
     * The flowcrypt.com mechanism expects the password to be hashed 100k times, then used
     * The FES mechanism expects the password to be given to OpenPGP.js verbatim
     *
     * Reason: OpenPGP spec already has a mechanism for iterated hashing of passwords,
     *   there is no need to invent our own:
     *   https://datatracker.ietf.org/doc/html/rfc4880#section-3.7.1.3
     *
     * The advantage is that it's dynamic - the sender can choose the rounds of iterations, and
     *   the recipient will follow transparently. For now, we'll be following the default set
     *   in OpenPGP.js, and later we can make a deliberate choice on how many iterations to use
     *   without having to affect recipient code.
     *
     * Another thing to note is that eventually, flowcrypt.com/api web portal functionality will
     *   be deprecated, and we'll instead run a "shared tenant FES instance" to fill that role.
     *   Nothing will change for users, but our code on the client will be more streamlined.
     *   Therefore, eventually, this `if` branch with the line below will be removed once both
     *   consumers and enterprises use API with the same structure.
     */
    if (! await this.view.acctServer.isFesUsed()) { // if flowcrypt.com/api is used
      newMsg.pwd = await PgpHash.challengeAnswer(newMsg.pwd); // then hash the password to preserve compatibility
    }
    const authInfo = await AcctStore.authInfo(this.acctEmail);
    const { bodyWithReplyToken, replyToken } = await this.getPwdMsgSendableBodyWithOnlineReplyMsgToken(authInfo, newMsg);
    const pgpMimeWithAttachments = await Mime.encode(bodyWithReplyToken, { Subject: newMsg.subject }, await this.view.attachmentsModule.attachment.collectAttachments());
    const { data: pwdEncryptedWithAttachments } = await this.encryptDataArmor(Buf.fromUtfStr(pgpMimeWithAttachments), newMsg.pwd, []); // encrypted only for pwd, not signed
    const { url } = await this.view.acctServer.messageUpload(
      authInfo.uuid ? authInfo : undefined,
      pwdEncryptedWithAttachments,
      replyToken,
      newMsg.from,
      newMsg.recipients,
      (p) => this.view.sendBtnModule.renderUploadProgress(p, 'FIRST-HALF'), // still need to upload to Gmail later, this request represents first half of progress
    );
    return url;
  };

  private sendablePwdMsg = async (newMsg: NewMsgData, pubs: PubkeyResult[], msgUrl: string, signingPrv?: Key) => {
    // encoded as: PGP/MIME-like structure but with attachments as external files due to email size limit (encrypted for pubkeys only)
    const msgBody = this.richtext ? { 'text/plain': newMsg.plaintext, 'text/html': newMsg.plainhtml } : { 'text/plain': newMsg.plaintext };
    const pgpMimeNoAttachments = await Mime.encode(msgBody, { Subject: newMsg.subject }, []); // no attachments, attached to email separately
    const { data: pubEncryptedNoAttachments } = await this.encryptDataArmor(Buf.fromUtfStr(pgpMimeNoAttachments), undefined, pubs, signingPrv); // encrypted only for pubs
    const attachments = this.createPgpMimeAttachments(pubEncryptedNoAttachments).
      concat(await this.view.attachmentsModule.attachment.collectEncryptAttachments(pubs)); // encrypted only for pubs
    const emailIntroAndLinkBody = await this.formatPwdEncryptedMsgBodyLink(msgUrl);
    return await SendableMsg.createPwdMsg(this.acctEmail, this.headers(newMsg), emailIntroAndLinkBody, attachments, { isDraft: this.isDraft });
  };

  private sendableSimpleTextMsg = async (newMsg: NewMsgData, pubs: PubkeyResult[], signingPrv?: Key): Promise<SendableMsg> => {
    const pubsForEncryption = pubs.map(entry => entry.pubkey);
    if (this.isDraft) {
      const { data: encrypted } = await this.encryptDataArmor(Buf.fromUtfStr(newMsg.plaintext), undefined, pubs, signingPrv);
      return await SendableMsg.createInlineArmored(this.acctEmail, this.headers(newMsg), Buf.fromUint8(encrypted).toUtfStr(), [], { isDraft: this.isDraft });
    }
    const x509certs = pubsForEncryption.filter(pub => pub.type === 'x509');
    if (x509certs.length) { // s/mime
      const attachments: Attachment[] = this.isDraft ? [] : await this.view.attachmentsModule.attachment.collectAttachments(); // collects attachments
      const msgBody = { 'text/plain': newMsg.plaintext };
      const mimeEncodedPlainMessage = await Mime.encode(msgBody, { Subject: newMsg.subject }, attachments);
      let mimeData = Buf.fromUtfStr(mimeEncodedPlainMessage);
      if (signingPrv) {
        const signedMessage = await this.signMimeMessage(signingPrv, mimeEncodedPlainMessage, newMsg);
        mimeData = Buf.fromUtfStr(await signedMessage.toMime());
      }
      const encryptedMessage = await SmimeKey.encryptMessage({ pubkeys: x509certs, data: mimeData, armor: false });
      const data = encryptedMessage.data;
      return await SendableMsg.createSMimeEncrypted(this.acctEmail, this.headers(newMsg), data, { isDraft: this.isDraft });
    } else { // openpgp
      const attachments: Attachment[] = this.isDraft ? [] : await this.view.attachmentsModule.attachment.collectEncryptAttachments(pubs);
      const encrypted = await this.encryptDataArmor(Buf.fromUtfStr(newMsg.plaintext), undefined, pubs, signingPrv);
      return await SendableMsg.createInlineArmored(this.acctEmail, this.headers(newMsg), Buf.fromUint8(encrypted.data).toUtfStr(), attachments, { isDraft: this.isDraft });
    }
  };

  private sendableRichTextMsg = async (newMsg: NewMsgData, pubs: PubkeyResult[], signingPrv?: Key) => {
    // todo: pubs.type === 'x509' #4047
    const plainAttachments = this.isDraft ? [] : await this.view.attachmentsModule.attachment.collectAttachments();
    if (this.isDraft) { // this patch is needed as gmail makes it hard (or impossible) to render messages saved as https://tools.ietf.org/html/rfc3156
      const pgpMimeToEncrypt = await Mime.encode({ 'text/plain': newMsg.plaintext, 'text/html': newMsg.plainhtml }, { Subject: newMsg.subject }, plainAttachments);
      const { data: encrypted } = await this.encryptDataArmor(Buf.fromUtfStr(pgpMimeToEncrypt), undefined, pubs, signingPrv);
      return await SendableMsg.createInlineArmored(this.acctEmail, this.headers(newMsg), Buf.fromUint8(encrypted).toUtfStr(), plainAttachments, { isDraft: this.isDraft });
    }
    const pgpMimeToEncrypt = await Mime.encode({ 'text/plain': newMsg.plaintext, 'text/html': newMsg.plainhtml }, { Subject: newMsg.subject }, plainAttachments);
    // todo: don't armor S/MIME and decide what to do with attachments #4046 and #4047
    const { data: encrypted } = await this.encryptDataArmor(Buf.fromUtfStr(pgpMimeToEncrypt), undefined, pubs, signingPrv);
    const attachments = this.createPgpMimeAttachments(encrypted);
    return await SendableMsg.createPgpMime(this.acctEmail, this.headers(newMsg), attachments, { isDraft: this.isDraft });
  };

  private createPgpMimeAttachments = (data: Uint8Array) => {
    const attachments: Attachment[] = [];
    attachments.push(new Attachment({ data: Buf.fromUtfStr('Version: 1'), type: 'application/pgp-encrypted', contentDescription: 'PGP/MIME version identification' }));
    attachments.push(new Attachment({ data, type: 'application/octet-stream', contentDescription: 'OpenPGP encrypted message', name: 'encrypted.asc', inline: true }));
    return attachments;
  };

  private encryptDataArmor = async (data: Buf, pwd: string | undefined, pubs: PubkeyResult[], signingPrv?: Key): Promise<PgpMsgMethod.EncryptAnyArmorResult> => {
    const pgpPubs = pubs.filter(pub => pub.pubkey.type === 'openpgp');
    const encryptAsOfDate = await this.encryptMsgAsOfDateIfSomeAreExpiredAndUserConfirmedModal(pgpPubs);
    const pubsForEncryption = pubs.map(entry => entry.pubkey);
    return await MsgUtil.encryptMessage({ pubkeys: pubsForEncryption, signingPrv, pwd, data, armor: true, date: encryptAsOfDate }) as PgpMsgMethod.EncryptAnyArmorResult;
  };

  private getPwdMsgSendableBodyWithOnlineReplyMsgToken = async (
    authInfo: FcUuidAuth, newMsgData: NewMsgData
  ): Promise<{ bodyWithReplyToken: SendableMsgBody, replyToken: string }> => {
    const recipients = Array.prototype.concat.apply([], Object.values(newMsgData.recipients));
    try {
      const response = await this.view.acctServer.messageToken(authInfo);
      const infoDiv = Ui.e('div', {
        'style': 'display: none;',
        'class': 'cryptup_reply',
        'cryptup-data': Str.htmlAttrEncode({
          sender: newMsgData.from,
          recipient: Value.arr.withoutVal(Value.arr.withoutVal(recipients, newMsgData.from), this.acctEmail),
          subject: newMsgData.subject,
          token: response.replyToken,
        })
      });
      return {
        bodyWithReplyToken: { 'text/plain': newMsgData.plaintext + '\n\n' + infoDiv, 'text/html': newMsgData.plainhtml + '<br /><br />' + infoDiv },
        replyToken: response.replyToken
      };
    } catch (msgTokenErr) {
      if (ApiErr.isAuthErr(msgTokenErr)) {
        Settings.offerToLoginWithPopupShowModalOnErr(this.acctEmail);
        throw new ComposerResetBtnTrigger();
      } else if (ApiErr.isNetErr(msgTokenErr)) {
        throw msgTokenErr;
      }
      throw Catch.rewrapErr(msgTokenErr, 'There was a token error sending this message. Please try again. ' +
        Lang.general.contactIfHappensAgain(this.view.isFesUsed()));
    }
  };

  private encryptMsgAsOfDateIfSomeAreExpiredAndUserConfirmedModal = async (pubs: PubkeyResult[]): Promise<Date | undefined> => {
    if (!pubs.length) {
      return undefined;
    }
    const usableUntil: number[] = [];
    const usableFrom: number[] = [];
    for (const armoredPubkey of pubs) {
      const oneSecondBeforeExpiration = KeyUtil.dateBeforeExpirationIfAlreadyExpired(armoredPubkey.pubkey);
      usableFrom.push(armoredPubkey.pubkey.created);
      if (typeof oneSecondBeforeExpiration !== 'undefined') { // key is expired
        usableUntil.push(oneSecondBeforeExpiration.getTime());
      }
    }
    if (!usableUntil.length) { // none of the keys are expired
      return undefined;
    }
    if (Math.max(...usableUntil) > Date.now()) { // all keys either don't expire or expire in the future
      return undefined;
    }
    for (const myKey of pubs.filter(ap => ap.isMine)) {
      if (myKey.pubkey.usableForEncryptionButExpired) {
        const path = Url.create(chrome.runtime.getURL('chrome/settings/index.htm'), {
          acctEmail: myKey.email,
          page: '/chrome/settings/modules/my_key_update.htm',
          pageUrlParams: JSON.stringify({ fingerprint: myKey.pubkey.id }),
        });
        const errModalLines = [
          'This message could not be encrypted because your own Private Key is expired.',
          '',
          'You can extend the expiration of this key in other OpenPGP software (such as GnuPG), then re-import the updated key ' +
          `<a href="${path}" id="action_update_prv" target="_blank">here</a>.`
        ];
        await Ui.modal.error(errModalLines.join('\n'), true);
        throw new ComposerResetBtnTrigger();
      }
    }
    const usableTimeFrom = Math.max(...usableFrom);
    const usableTimeUntil = Math.min(...usableUntil);
    if (usableTimeFrom > usableTimeUntil) { // used public keys have no intersection of usable dates
      await Ui.modal.error('The public key of one of your recipients has been expired for too long.\n\nPlease ask the recipient to send you an updated Public Key.');
      throw new ComposerResetBtnTrigger();
    }
    if (! await Ui.modal.confirm(Lang.compose.pubkeyExpiredConfirmCompose)) {
      throw new ComposerResetBtnTrigger();
    }
    return new Date(usableTimeUntil); // latest date none of the keys were expired
  };

  private formatPwdEncryptedMsgBodyLink = async (msgUrl: string): Promise<SendableMsgBody> => {
    const storage = await AcctStore.get(this.acctEmail, ['outgoing_language']);
    const lang = storage.outgoing_language || 'EN';
    const aStyle = `padding: 2px 6px; background: #2199e8; color: #fff; display: inline-block; text-decoration: none;`;
    const a = `<a href="${Xss.escape(msgUrl)}" style="${aStyle}">${Lang.compose.openMsg[lang]}</a>`;
    const intro = this.view.S.cached('input_intro').length ? this.view.inputModule.extract('text', 'input_intro') : undefined;
    const text = [];
    const html = [];
    if (intro) {
      text.push(intro + '\n');
      html.push(Xss.escape(intro).replace(/\n/g, '<br>') + '<br><br>');
    }
    const senderEmail = Xss.escape(this.view.senderModule.getSender());
    text.push(Lang.compose.msgEncryptedText(lang, senderEmail) + msgUrl + '\n\n');
    html.push(`${Lang.compose.msgEncryptedHtml(lang, senderEmail) + a}<br/><br/>${Lang.compose.alternativelyCopyPaste[lang] + Xss.escape(msgUrl)}<br/><br/>`);
    return { 'text/plain': text.join('\n'), 'text/html': html.join('\n') };
  };

}
