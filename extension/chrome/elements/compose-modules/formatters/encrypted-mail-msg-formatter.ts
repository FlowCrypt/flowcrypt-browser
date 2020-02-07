/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Backend, FcUuidAuth } from '../../../../js/common/api/backend.js';
import { BaseMailFormatter, MailFormatterInterface } from './base-mail-formatter.js';
import { ComposerResetBtnTrigger } from '../compose-err-module.js';
import { Mime, SendableMsgBody } from '../../../../js/common/core/mime.js';
import { NewMsgData, PubkeyResult } from '../compose-types.js';
import { Store } from '../../../../js/common/platform/store.js';
import { Str, Value } from '../../../../js/common/core/common.js';
import { ApiErr } from '../../../../js/common/api/error/api-error.js';
import { Att } from '../../../../js/common/core/att.js';
import { Buf } from '../../../../js/common/core/buf.js';
import { Catch } from '../../../../js/common/platform/catch.js';
import { Lang } from '../../../../js/common/lang.js';
import { PgpKey } from '../../../../js/common/core/pgp-key.js';
import { PgpMsg } from '../../../../js/common/core/pgp-msg.js';
import { SendableMsg } from '../../../../js/common/api/email-provider/sendable-msg.js';
import { Settings } from '../../../../js/common/settings.js';
import { Ui } from '../../../../js/common/browser/ui.js';
import { Xss } from '../../../../js/common/platform/xss.js';
import { openpgp } from '../../../../js/common/core/pgp.js';
import { ComposeView } from '../../compose.js';

export class EncryptedMsgMailFormatter extends BaseMailFormatter implements MailFormatterInterface {

  constructor(
    view: ComposeView,
    private armoredPubkeys: PubkeyResult[],
    private isDraft = false
  ) {
    super(view);
  }

  public sendableMsg = async (newMsg: NewMsgData, signingPrv?: OpenPGP.key.Key): Promise<SendableMsg> => {
    await Store.dbContactUpdate(undefined, Array.prototype.concat.apply([], Object.values(newMsg.recipients)), { last_use: Date.now() });
    const pubkeys = this.armoredPubkeys.map(p => p.pubkey);
    if (!this.richtext && !newMsg.pwd) { // simple text: PGP/Inline with attachments in separate files
      const atts = await this.view.attsModule.attach.collectEncryptAtts(this.armoredPubkeys.map(p => p.pubkey), newMsg.pwd);
      const encrypted = await this.encryptData(Buf.fromUtfStr(newMsg.plaintext), newMsg.pwd, pubkeys, signingPrv);
      const encryptedBody = { 'text/plain': encrypted.data };
      return await SendableMsg.create(this.acctEmail, { ...this.headers(newMsg), body: encryptedBody, atts, isDraft: this.isDraft });
    }
    if (this.richtext && !newMsg.pwd) { // rich text: PGP/MIME - https://tools.ietf.org/html/rfc3156#section-4
      const plainAtts = await this.view.attsModule.attach.collectAtts();
      const pgpMimeToEncrypt = await Mime.encode({ 'text/plain': newMsg.plaintext, 'text/html': newMsg.plainhtml }, { Subject: newMsg.subject }, plainAtts);
      const encrypted = await this.encryptData(Buf.fromUtfStr(pgpMimeToEncrypt), undefined, pubkeys, signingPrv);
      const atts = this.createPgpMimeAtts(encrypted.data, 'GMAIL-RFC-LIKE');
      return await SendableMsg.create(this.acctEmail, { ...this.headers(newMsg), body: {}, atts, type: 'pgpMimeEncrypted', isDraft: this.isDraft });
    }
    // password-protected message, temporarily uploaded (encrypted) to FlowCrypt servers, to be served to recipient through web, encoded as PGP/MIME
    const authInfo = await Store.authInfo(this.acctEmail);
    if (authInfo.uuid) { // logged in
      await this.addOnlineReplyTokenToMsgBody(authInfo, newMsg);
    }
    const plainAtts = await this.view.attsModule.attach.collectAtts();
    const bodyParts = this.richtext ? { 'text/plain': newMsg.plaintext, 'text/html': newMsg.plainhtml } : { 'text/plain': newMsg.plaintext };
    const pgpMimeToEncrypt = await Mime.encode(bodyParts, { Subject: newMsg.subject }, plainAtts);
    const encrypted = await this.encryptData(Buf.fromUtfStr(pgpMimeToEncrypt), newMsg.pwd, pubkeys, signingPrv);
    const short = await this.uploadPwdEncryptedMsgToFc(authInfo, encrypted.data);
    const introAndLinkBody = await this.formatPwdEncryptedMsgBodyLink(short);
    const atts = this.createPgpMimeAtts(encrypted.data, 'PWD-ENCRYPTED-MSG');
    return await SendableMsg.create(this.acctEmail, { ...this.headers(newMsg), body: introAndLinkBody, atts, isDraft: this.isDraft });
  }

  private createPgpMimeAtts = (content: string, format: 'GMAIL-RFC-LIKE' | 'PWD-ENCRYPTED-MSG') => { // todo - make this a regular private method
    const atts: Att[] = [];
    if (format === 'GMAIL-RFC-LIKE') {
      atts.push(new Att({ data: Buf.fromUtfStr('Version: 1'), type: 'application/pgp-encrypted', contentDescription: 'PGP/MIME version identification' }));
    }
    atts.push(new Att({ data: Buf.fromUtfStr(content), type: 'application/octet-stream', contentDescription: 'OpenPGP encrypted message', name: 'encrypted.asc', inline: true }));
    return atts;
  }

  private encryptData = async (data: Buf, pwd: string | undefined, pubkeys: string[], signingPrv?: OpenPGP.key.Key): Promise<OpenPGP.EncryptArmorResult> => {
    const encryptAsOfDate = await this.encryptMsgAsOfDateIfSomeAreExpiredAndUserConfirmedModal();
    return await PgpMsg.encrypt({ pubkeys, signingPrv, pwd, data, armor: true, date: encryptAsOfDate }) as OpenPGP.EncryptArmorResult;
  }

  private addOnlineReplyTokenToMsgBody = async (authInfo: FcUuidAuth, newMsgData: NewMsgData): Promise<void> => {
    if (!newMsgData.pwd || !authInfo.uuid) {
      return;
    }
    const recipients = Array.prototype.concat.apply([], Object.values(newMsgData.recipients));
    try {
      const response = await Backend.messageToken(authInfo);
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
      newMsgData.plaintext += '\n\n' + infoDiv;
      newMsgData.plainhtml += '<br /><br />' + infoDiv;
      return;
    } catch (msgTokenErr) {
      if (ApiErr.isAuthErr(msgTokenErr)) {
        Settings.offerToLoginWithPopupShowModalOnErr(this.acctEmail);
        throw new ComposerResetBtnTrigger();
      }
      throw Catch.rewrapErr(msgTokenErr, 'There was a token error sending this message. Please try again. Let us know at human@flowcrypt.com if this happens repeatedly.');
    }
  }

  private encryptMsgAsOfDateIfSomeAreExpiredAndUserConfirmedModal = async (): Promise<Date | undefined> => {
    const usableUntil: number[] = [];
    const usableFrom: number[] = [];
    for (const armoredPubkey of this.armoredPubkeys) {
      const { keys: [pub] } = await openpgp.key.readArmored(armoredPubkey.pubkey);
      const oneSecondBeforeExpiration = await PgpKey.dateBeforeExpiration(pub);
      usableFrom.push(pub.getCreationTime().getTime());
      if (typeof oneSecondBeforeExpiration !== 'undefined') { // key does expire
        usableUntil.push(oneSecondBeforeExpiration.getTime());
      }
    }
    if (!usableUntil.length) { // none of the keys expire
      return undefined;
    }
    if (Math.max(...usableUntil) > Date.now()) { // all keys either don't expire or expire in the future
      return undefined;
    }
    for (const myKey of this.armoredPubkeys.filter(ap => ap.isMine)) {
      if (await PgpKey.usableButExpired(await PgpKey.read(myKey.pubkey))) {
        const path = chrome.runtime.getURL(`chrome/settings/index.htm?acctEmail=${encodeURIComponent(myKey.email)}&page=%2Fchrome%2Fsettings%2Fmodules%2Fmy_key_update.htm`);
        await Ui.modal.error(
          ['This message could not be encrypted because your own Private Key is expired.',
            '',
            'You can extend expiration of this key in other OpenPGP software (such as gnupg), then re-import updated key ' +
            `<a href="${path}" id="action_update_prv" target="_blank">here</a>.`].join('\n'), true);
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

  private uploadPwdEncryptedMsgToFc = async (authInfo: FcUuidAuth, pgpMimeEncryptedArmored: string): Promise<string> => {
    // this is used when sending encrypted messages to people without encryption plugin, the encrypted data goes through FlowCrypt and recipients get a link
    // admin_code stays locally and helps the sender extend life of the message or delete it
    const { short, admin_code } = await Backend.messageUpload(authInfo.uuid ? authInfo : undefined, pgpMimeEncryptedArmored);
    await this.view.storageModule.addAdminCodes(short, [admin_code]);
    return short;
  }

  private formatPwdEncryptedMsgBodyLink = async (short: string): Promise<SendableMsgBody> => {
    const storage = await Store.getAcct(this.acctEmail, ['outgoing_language']);
    const lang = storage.outgoing_language || 'EN';
    const msgUrl = Backend.url('decrypt', short);
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
