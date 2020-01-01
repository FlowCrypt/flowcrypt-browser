/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypcom */

'use strict';

import { AwsS3UploadItem, Backend, BackendRes, FcUuidAuth } from '../../../../js/common/api/backend.js';
import { BaseMailFormatter, MailFormatterInterface } from './base-mail-formatter.js';
import { ComposerResetBtnTrigger, ComposerUserError } from '../composer-errs.js';
import { Mime, SendableMsgBody } from '../../../../js/common/core/mime.js';
import { NewMsgData, PubkeyResult, SendBtnTexts } from '../composer-types.js';
import { Store, Subscription } from '../../../../js/common/platform/store.js';
import { Str, Value } from '../../../../js/common/core/common.js';

import { ApiErr } from '../../../../js/common/api/error/api-error.js';
import { Att } from '../../../../js/common/core/att.js';
import { Buf } from '../../../../js/common/core/buf.js';
import { Catch } from '../../../../js/common/platform/catch.js';
import { Composer } from '../composer.js';
import { Lang } from '../../../../js/common/lang.js';
import { PgpArmor } from '../../../../js/common/core/pgp-armor.js';
import { PgpKey } from '../../../../js/common/core/pgp-key.js';
import { PgpMsg } from '../../../../js/common/core/pgp-msg.js';
import { SendableMsg } from '../../../../js/common/api/email_provider/sendable-msg.js';
import { Settings } from '../../../../js/common/settings.js';
import { Ui } from '../../../../js/common/browser/ui.js';
import { Xss } from '../../../../js/common/platform/xss.js';
import { openpgp } from '../../../../js/common/core/pgp.js';

export class EncryptedMsgMailFormatter extends BaseMailFormatter implements MailFormatterInterface {

  private fcAdminCodes: string[] = [];

  public static createPgpMimeAtts = (content: string) => { // todo - make this a regular private method
    return [
      new Att({ data: Buf.fromUtfStr('Version: 1'), type: 'application/pgp-encrypted', contentDescription: 'PGP/MIME version identification' }),
      new Att({ data: Buf.fromUtfStr(content), type: 'application/octet-stream', contentDescription: 'OpenPGP encrypted message', name: 'encrypted.asc', inline: true })
    ];
  }

  constructor(
    composer: Composer,
    private armoredPubkeys: PubkeyResult[],
    private isDraft = false
  ) {
    super(composer);
  }

  public sendableMsg = async (newMsg: NewMsgData, signingPrv?: OpenPGP.key.Key): Promise<SendableMsg> => {
    const subscription = await Store.subscription(this.acctEmail);
    const pubkeys = this.armoredPubkeys.map(p => p.pubkey);
    if (!this.richtext) { // simple text: PGP/Inline
      const authInfo = subscription.active ? await Store.authInfo(this.acctEmail) : undefined;
      await this.addReplyTokenToMsgBodyIfNeeded(authInfo, newMsg, subscription);
      let atts = await this.composer.atts.attach.collectEncryptAtts(this.armoredPubkeys.map(p => p.pubkey), newMsg.pwd);
      if (newMsg.pwd && atts.length) { // these will be password encrypted attachments
        this.composer.sendBtn.btnUpdateTimeout = Catch.setHandledTimeout(() => { this.composer.S.now('send_btn_text').text(SendBtnTexts.BTN_SENDING); }, 500);
        await this.uploadAttsToFc(authInfo, atts); // must strictly be preceeding the next function, because it's setting att.url
        newMsg.plaintext = this.addUploadedFileLinksToMsgBody(newMsg.plaintext, atts);
      }
      const encrypted = await this.encryptData(Buf.fromUtfStr(newMsg.plaintext), newMsg.pwd, pubkeys, signingPrv);
      const encryptedBody = { 'text/plain': encrypted.data };
      await Store.dbContactUpdate(undefined, Array.prototype.concat.apply([], Object.values(newMsg.recipients)), { last_use: Date.now() });
      if (newMsg.pwd) {
        await this.uploadAndFormatPwdProtectedEmail(authInfo, encryptedBody);
        // attachmetns already included inside message as links, setting email real email attachmetns to empty array
        // however if there is more than one recipient with pubkeys, still append the encrypted message as attachment
        atts = pubkeys.length === 1 ? [] : [new Att({ data: Buf.fromUtfStr(encrypted.data), name: 'encrypted.asc' })];
      }
      return await SendableMsg.create(this.acctEmail, { ...this.headers(newMsg), body: encryptedBody, atts, isDraft: this.isDraft });
    } else if (newMsg.pwd) { // don't allow rich-text pwd msg yet
      this.composer.sendBtn.popover.toggleItemTick($('.action-toggle-richText-sending-option'), 'richtext', false); // do not use rich text
      throw new ComposerUserError('Rich text is not yet supported for password encrypted messages, please retry (formatting will be removed).');
    } else { // rich text: PGP/MIME - https://tools.ietf.org/html/rfc3156#section-4
      const plainAtts = await this.composer.atts.attach.collectAtts();
      const pgpMimeToEncrypt = await Mime.encode({ 'text/plain': newMsg.plaintext, 'text/html': newMsg.plainhtml }, { Subject: newMsg.subject }, plainAtts);
      const encrypted = await this.encryptData(Buf.fromUtfStr(pgpMimeToEncrypt), undefined, pubkeys, signingPrv);
      const atts = EncryptedMsgMailFormatter.createPgpMimeAtts(encrypted.data);
      return await SendableMsg.create(this.acctEmail, { ...this.headers(newMsg), body: {}, atts, type: 'pgpMimeEncrypted', isDraft: this.isDraft });
    }
  }

  private encryptData = async (data: Buf, pwd: string | undefined, pubkeys: string[], signingPrv?: OpenPGP.key.Key): Promise<OpenPGP.EncryptArmorResult> => {
    const encryptAsOfDate = await this.encryptMsgAsOfDateIfSomeAreExpiredAndUserConfirmedModal();
    return await PgpMsg.encrypt({ pubkeys, signingPrv, pwd, data, armor: true, date: encryptAsOfDate }) as OpenPGP.EncryptArmorResult;
  }

  private addReplyTokenToMsgBodyIfNeeded = async (authInfo: FcUuidAuth | undefined, newMsgData: NewMsgData, subscription: Subscription): Promise<void> => {
    if (!newMsgData.pwd || !subscription.active || !authInfo) {
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
          subject: newMsgData,
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
      } else if (ApiErr.isStandardErr(msgTokenErr, 'subscription')) {
        return;
      }
      throw Catch.rewrapErr(msgTokenErr, 'There was a token error sending this message. Please try again. Let us know at human@flowcrypt.com if this happens repeatedly.');
    }
  }

  private uploadAttsToFc = async (authInfo: FcUuidAuth | undefined, atts: Att[]): Promise<void> => {
    const pfRes: BackendRes.FcMsgPresignFiles = await Backend.messagePresignFiles(authInfo, atts);
    const items: AwsS3UploadItem[] = [];
    for (const i of pfRes.approvals.keys()) {
      items.push({ baseUrl: pfRes.approvals[i].base_url, fields: pfRes.approvals[i].fields, att: atts[i] });
    }
    await Backend.s3Upload(items, this.composer.sendBtn.renderUploadProgress);
    const { admin_codes, confirmed } = await Backend.messageConfirmFiles(items.map(item => item.fields.key));
    if (!confirmed || confirmed.length !== items.length) {
      throw new Error('Attachments did not upload properly, please try again');
    }
    for (const i of atts.keys()) {
      atts[i].url = pfRes.approvals[i].base_url + pfRes.approvals[i].fields.key;
    }
    this.fcAdminCodes.push(...admin_codes);
  }

  private addUploadedFileLinksToMsgBody = (plaintext: string, atts: Att[]) => {
    plaintext += '\n\n';
    for (const att of atts) {
      const sizeMb = att.length / (1024 * 1024);
      const sizeText = sizeMb < 0.1 ? '' : ` ${(Math.round(sizeMb * 10) / 10)}MB`;
      const linkText = `Att: ${att.name} (${att.type})${sizeText}`;
      const fcData = Str.htmlAttrEncode({ size: att.length, type: att.type, name: att.name });
      // triple-check PgpMsg.extractFcAtts() if you change the line below in any way
      plaintext += `<a href="${att.url}" class="cryptup_file" cryptup-data="${fcData}">${linkText}</a>\n`;
    }
    return plaintext;
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

  private uploadAndFormatPwdProtectedEmail = async (authInfo: FcUuidAuth | undefined, encryptedBody: SendableMsgBody): Promise<void> => {
    // this is used when sending encrypted messages to people without encryption plugin, the encrypted data goes through FlowCrypt and recipients get a link
    // admin_code stays locally and helps the sender extend life of the message or delete it
    const { short, admin_code } = await Backend.messageUpload(authInfo, encryptedBody['text/plain']!);
    const storage = await Store.getAcct(this.acctEmail, ['outgoing_language']);
    const lang = storage.outgoing_language || 'EN';
    const msgUrl = Backend.url('decrypt', short);
    const a = `<a href="${Xss.escape(msgUrl)}" style="padding: 2px 6px; background: #2199e8; color: #fff; display: inline-block; text-decoration: none;">
                    ${Lang.compose.openMsg[lang]}
                   </a>`;
    const intro = this.composer.S.cached('input_intro').length && this.composer.input.extract('text', 'input_intro');
    const text = [];
    const html = [];
    if (intro) {
      text.push(intro + '\n');
      html.push(intro.replace(/\n/g, '<br>') + '<br><br>');
    }
    text.push(Lang.compose.msgEncryptedText[lang] + msgUrl + '\n');
    html.push(`
                <div class="cryptup_encrypted_message_replaceable">
                    <div style="opacity: 0;">${PgpArmor.headers('null').begin}</div>
                    ${Lang.compose.msgEncryptedHtml[lang] + a}<br/><br/>
                    ${Lang.compose.alternativelyCopyPaste[lang] + Xss.escape(msgUrl)}<br/><br/><br/>
                </div>`);
    await this.composer.storage.addAdminCodes(short, [admin_code].concat(this.fcAdminCodes));
    encryptedBody['text/plain'] = text.join('\n');
    encryptedBody['text/html'] = html.join('\n');
  }

}
