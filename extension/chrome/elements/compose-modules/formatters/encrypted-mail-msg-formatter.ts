/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';


import { BaseMailFormatter } from './base-mail-formatter.js';
import { ComposerResetBtnTrigger } from '../compose-err-module.js';
import { Mime, SendableMsgBody } from '../../../../js/common/core/mime.js';
import { NewMsgData } from '../compose-types.js';
import { Str, Url, Value } from '../../../../js/common/core/common.js';
import { ApiErr } from '../../../../js/common/api/shared/api-error.js';
import { Att } from '../../../../js/common/core/att.js';
import { Buf } from '../../../../js/common/core/buf.js';
import { Catch } from '../../../../js/common/platform/catch.js';
import { Lang } from '../../../../js/common/lang.js';
import { PubkeyResult, Key, KeyUtil } from '../../../../js/common/core/crypto/key.js';
import { MsgUtil, PgpMsgMethod } from '../../../../js/common/core/crypto/pgp/msg-util.js';
import { SendableMsg } from '../../../../js/common/api/email-provider/sendable-msg.js';
import { Settings } from '../../../../js/common/settings.js';
import { Ui } from '../../../../js/common/browser/ui.js';
import { Xss } from '../../../../js/common/platform/xss.js';
import { ContactStore } from '../../../../js/common/platform/store/contact-store.js';
import { AcctStore } from '../../../../js/common/platform/store/acct-store.js';
import { FlowCryptWebsite } from '../../../../js/common/api/flowcrypt-website.js';
import { AccountServer } from '../../../../js/common/api/account-server.js';
import { FcUuidAuth } from '../../../../js/common/api/account-servers/flowcrypt-com-api.js';
import { SmimeKey } from '../../../../js/common/core/crypto/smime/smime-key.js';

export class EncryptedMsgMailFormatter extends BaseMailFormatter {

  public sendableMsg = async (newMsg: NewMsgData, pubkeys: PubkeyResult[], signingPrv?: Key): Promise<SendableMsg> => {
    await ContactStore.update(undefined, Array.prototype.concat.apply([], Object.values(newMsg.recipients)), { last_use: Date.now() });
    if (newMsg.pwd && !this.isDraft) { // password-protected message, temporarily uploaded (encrypted) to FlowCrypt servers, to be served to recipient through web
      const short = await this.prepareAndUploadPwdEncryptedMsg(newMsg); // encrypted for pwd only, pubkeys ignored
      newMsg.pwd = undefined;
      return await this.sendablePwdMsg(newMsg, pubkeys, short, signingPrv); // encrypted for pubkeys only, pwd ignored
    } else if (this.richtext) { // rich text: PGP/MIME - https://tools.ietf.org/html/rfc3156#section-4
      return await this.sendableRichTextMsg(newMsg, pubkeys, signingPrv);
    } else { // simple text: PGP/Inline with attachments in separate files
      return await this.sendableSimpleTextMsg(newMsg, pubkeys, signingPrv);
    }
  }

  private prepareAndUploadPwdEncryptedMsg = async (newMsg: NewMsgData): Promise<string> => {
    // PGP/MIME + included attachments (encrypted for password only)
    const authInfo = await AcctStore.authInfo(this.acctEmail);
    const msgBodyWithReplyToken = await this.getPwdMsgSendableBodyWithOnlineReplyMsgToken(authInfo, newMsg);
    const pgpMimeWithAtts = await Mime.encode(msgBodyWithReplyToken, { Subject: newMsg.subject }, await this.view.attsModule.attach.collectAtts());
    const { data: pwdEncryptedWithAtts } = await this.encryptDataArmor(Buf.fromUtfStr(pgpMimeWithAtts), newMsg.pwd, []); // encrypted only for pwd, not signed
    const { short, admin_code } = await AccountServer.messageUpload(
      authInfo.uuid ? authInfo : undefined,
      pwdEncryptedWithAtts,
      (p) => this.view.sendBtnModule.renderUploadProgress(p, 'FIRST-HALF'), // still need to upload to Gmail later, this request represents first half of progress
    );
    await this.view.storageModule.addAdminCodes(short, [admin_code]); // admin_code stays locally and helps the sender extend life of the message or delete it
    return short;
  }

  private sendablePwdMsg = async (newMsg: NewMsgData, pubs: PubkeyResult[], short: string, signingPrv?: Key) => {
    // encoded as: PGP/MIME-like structure but with attachments as external files due to email size limit (encrypted for pubkeys only)
    const msgBody = this.richtext ? { 'text/plain': newMsg.plaintext, 'text/html': newMsg.plainhtml } : { 'text/plain': newMsg.plaintext };
    const pgpMimeNoAtts = await Mime.encode(msgBody, { Subject: newMsg.subject }, []); // no atts, attached to email separately
    const { data: pubEncryptedNoAtts } = await this.encryptDataArmor(Buf.fromUtfStr(pgpMimeNoAtts), undefined, pubs, signingPrv); // encrypted only for pubs
    const atts = this.createPgpMimeAtts(pubEncryptedNoAtts).concat(await this.view.attsModule.attach.collectEncryptAtts(pubs)); // encrypted only for pubs
    const emailIntroAndLinkBody = await this.formatPwdEncryptedMsgBodyLink(short);
    return await SendableMsg.createPwdMsg(this.acctEmail, this.headers(newMsg), emailIntroAndLinkBody, atts, { isDraft: this.isDraft });
  }

  private sendableSimpleTextMsg = async (newMsg: NewMsgData, pubs: PubkeyResult[], signingPrv?: Key): Promise<SendableMsg> => {
    // todo - choosePubsBasedOnKeyTypeCombinationForPartialSmimeSupport is called later inside encryptDataArmor, could be refactored
    const pubsForEncryption = KeyUtil.choosePubsBasedOnKeyTypeCombinationForPartialSmimeSupport(pubs);
    const x509certs = pubsForEncryption.filter(pub => pub.type === 'x509');
    if (x509certs.length) { // s/mime
      const atts: Att[] = this.isDraft ? [] : await this.view.attsModule.attach.collectAtts(); // collects attachments
      const msgBody = this.richtext ? { 'text/plain': newMsg.plaintext, 'text/html': newMsg.plainhtml } : { 'text/plain': newMsg.plaintext };
      const mimeEncodedPlainMessage = await Mime.encode(msgBody, { Subject: newMsg.subject }, atts);
      const encryptedMessage = await SmimeKey.encryptMessage({ pubkeys: x509certs, data: Buf.fromUtfStr(mimeEncodedPlainMessage) });
      const data = encryptedMessage.data;
      return await SendableMsg.createSMime(this.acctEmail, this.headers(newMsg), data, { isDraft: this.isDraft });
    }
    // openpgp
    const atts: Att[] = this.isDraft ? [] : await this.view.attsModule.attach.collectEncryptAtts(pubs);
    const { data: encryptedBody } = await this.encryptDataArmor(Buf.fromUtfStr(newMsg.plaintext), undefined, pubs, signingPrv);
    return await SendableMsg.createPgpInline(this.acctEmail, this.headers(newMsg), { "encrypted/buf": Buf.fromUint8(encryptedBody) }, atts, { isDraft: this.isDraft });
  }

  private sendableRichTextMsg = async (newMsg: NewMsgData, pubs: PubkeyResult[], signingPrv?: Key) => {
    const plainAtts = this.isDraft ? [] : await this.view.attsModule.attach.collectAtts();
    const pgpMimeToEncrypt = await Mime.encode({ 'text/plain': newMsg.plaintext, 'text/html': newMsg.plainhtml }, { Subject: newMsg.subject }, plainAtts);
    const { data: encrypted } = await this.encryptDataArmor(Buf.fromUtfStr(pgpMimeToEncrypt), undefined, pubs, signingPrv);
    const atts = this.createPgpMimeAtts(encrypted);
    return await SendableMsg.createPgpMime(this.acctEmail, this.headers(newMsg), atts, { isDraft: this.isDraft });
  }

  private createPgpMimeAtts = (data: Uint8Array) => {
    const atts: Att[] = [];
    atts.push(new Att({ data: Buf.fromUtfStr('Version: 1'), type: 'application/pgp-encrypted', contentDescription: 'PGP/MIME version identification' }));
    atts.push(new Att({ data, type: 'application/octet-stream', contentDescription: 'OpenPGP encrypted message', name: 'encrypted.asc', inline: true }));
    return atts;
  }

  private encryptDataArmor = async (data: Buf, pwd: string | undefined, pubs: PubkeyResult[], signingPrv?: Key): Promise<PgpMsgMethod.EncryptAnyArmorResult> => {
    const pgpPubs = pubs.filter(pub => pub.pubkey.type === 'openpgp');
    const encryptAsOfDate = await this.encryptMsgAsOfDateIfSomeAreExpiredAndUserConfirmedModal(pgpPubs);
    const pubsForEncryption = KeyUtil.choosePubsBasedOnKeyTypeCombinationForPartialSmimeSupport(pubs);
    return await MsgUtil.encryptMessage({ pubkeys: pubsForEncryption, signingPrv, pwd, data, armor: true, date: encryptAsOfDate }) as PgpMsgMethod.EncryptAnyArmorResult;
  }

  private getPwdMsgSendableBodyWithOnlineReplyMsgToken = async (authInfo: FcUuidAuth, newMsgData: NewMsgData): Promise<SendableMsgBody> => {
    if (!authInfo.uuid) {
      return { 'text/plain': newMsgData.plaintext, 'text/html': newMsgData.plainhtml };
    }
    const recipients = Array.prototype.concat.apply([], Object.values(newMsgData.recipients));
    try {
      const response = await AccountServer.messageToken(authInfo);
      const infoDiv = Ui.e('div', {
        'style': 'display: none;',
        'class': 'cryptup_reply',
        'cryptup-data': Str.htmlAttrEncode({
          sender: newMsgData.from,
          recipient: Value.arr.withoutVal(Value.arr.withoutVal(recipients, newMsgData.from), this.acctEmail),
          subject: newMsgData.subject,
          token: response.token,
        })
      });
      return { 'text/plain': newMsgData.plaintext + '\n\n' + infoDiv, 'text/html': newMsgData.plainhtml + '<br /><br />' + infoDiv };
    } catch (msgTokenErr) {
      if (ApiErr.isAuthErr(msgTokenErr)) {
        Settings.offerToLoginWithPopupShowModalOnErr(this.acctEmail);
        throw new ComposerResetBtnTrigger();
      } else if (ApiErr.isNetErr(msgTokenErr)) {
        throw msgTokenErr;
      }
      throw Catch.rewrapErr(msgTokenErr, 'There was a token error sending this message. Please try again. Let us know at human@flowcrypt.com if this happens repeatedly.');
    }
  }

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
      if (myKey.pubkey.usableButExpired) {
        const path = Url.create(chrome.runtime.getURL('chrome/settings/index.htm'), {
          acctEmail: myKey.email,
          page: '/chrome/settings/modules/my_key_update.htm',
          pageUrlParams: JSON.stringify({ fingerprint: myKey.pubkey.id }),
        });
        const errModalLines = [
          'This message could not be encrypted because your own Private Key is expired.',
          '',
          'You can extend expiration of this key in other OpenPGP software (such as gnupg), then re-import updated key ' +
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
  }

  private formatPwdEncryptedMsgBodyLink = async (short: string): Promise<SendableMsgBody> => {
    const storage = await AcctStore.get(this.acctEmail, ['outgoing_language']);
    const lang = storage.outgoing_language || 'EN';
    const msgUrl = FlowCryptWebsite.url('decrypt', short);
    const aStyle = `padding: 2px 6px; background: #2199e8; color: #fff; display: inline-block; text-decoration: none;`;
    const a = `<a href="${Xss.escape(msgUrl)}" style="${aStyle}">${Lang.compose.openMsg[lang]}</a>`;
    const intro = this.view.S.cached('input_intro').length ? this.view.inputModule.extract('text', 'input_intro') : undefined;
    const text = [];
    const html = [];
    if (intro) {
      text.push(intro + '\n');
      html.push(intro.replace(/\n/g, '<br>') + '<br><br>');
    }
    text.push(Lang.compose.msgEncryptedText[lang] + msgUrl + '\n\n');
    html.push(`${Lang.compose.msgEncryptedHtml[lang] + a}<br/><br/>${Lang.compose.alternativelyCopyPaste[lang] + Xss.escape(msgUrl)}<br/><br/>`);
    return { 'text/plain': text.join('\n'), 'text/html': html.join('\n') };
  }

}
