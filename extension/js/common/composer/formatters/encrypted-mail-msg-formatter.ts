/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypcom */

'use strict';

import { NewMsgData, PubkeyResult, SendBtnTexts } from '../interfaces/composer-types.js';
import { SendableMsg } from '../../api/email_provider_api.js';
import { MailFormatterInterface, BaseMailFormatter } from './base-mail-formatter.js';
import { Composer } from '../composer.js';
import { PgpMsg, Pwd, Pgp } from '../../core/pgp.js';
import { Google } from '../../api/google.js';
import { Catch } from '../../platform/catch.js';
import { SendableMsgBody } from '../../core/mime.js';
import { Buf } from '../../core/buf.js';
import { Backend, BackendRes, AwsS3UploadItem } from '../../api/backend.js';
import { Store, Subscription } from '../../platform/store.js';
import { Value, Str } from '../../core/common.js';
import { Ui } from '../../browser.js';
import { ComposerResetBtnTrigger } from '../interfaces/composer-errors.js';
import { BrowserMsg } from '../../extension.js';
import { Api } from '../../api/api.js';
import { Att } from '../../core/att.js';
import { Xss } from '../../platform/xss.js';
import { Lang } from '../../lang.js';

declare const openpgp: typeof OpenPGP;

export class EncryptedMsgMailFormatter extends BaseMailFormatter implements MailFormatterInterface {

  private armoredPubkeys: PubkeyResult[];
  private signingPrv: OpenPGP.key.Key | undefined;
  private pwd: Pwd | undefined;

  private FC_WEB_URL = 'https://flowcrypt.com'; // todo Send plain (not encrypted)uld use Api.url()

  constructor(composer: Composer, newMsgData: NewMsgData, armoredPubkeys: PubkeyResult[], signingPrv: OpenPGP.key.Key | undefined) {
    super(composer, newMsgData);
    this.armoredPubkeys = armoredPubkeys;
    this.signingPrv = signingPrv;
  }

  async createMsgObject(): Promise<SendableMsg> {
    const subscription = await this.composer.app.storageGetSubscription();
    this.newMsgData.plaintext = await this.addReplyTokenToMsgBodyIfNeeded(subscription);
    const atts = await this.composer.atts.attach.collectEncryptAtts(this.armoredPubkeys.map(p => p.pubkey), this.pwd);
    if (atts.length && this.pwd) { // these will be password encrypted attachments
      this.composer.sendBtn.btnUpdateTimeout = Catch.setHandledTimeout(() => this.composer.S.now('send_btn_text').text(SendBtnTexts.BTN_SENDING), 500);
      this.newMsgData.plaintext = this.addUploadedFileLinksToMsgBody(this.newMsgData.plaintext, atts);
    }
    const pubkeysOnly = this.armoredPubkeys.map(p => p.pubkey);
    const encryptAsOfDate = await this.encryptMsgAsOfDateIfSomeAreExpiredAndUserConfirmedModal(this.armoredPubkeys);
    const encrypted = await PgpMsg.encrypt({
      pubkeys: pubkeysOnly, signingPrv: this.signingPrv, pwd: this.pwd,
      data: Buf.fromUtfStr(this.newMsgData.plaintext), armor: true, date: encryptAsOfDate
    }) as OpenPGP.EncryptArmorResult;
    let encryptedBody: SendableMsgBody = { 'text/plain': encrypted.data };
    await this.composer.app.storageContactUpdate(Array.prototype.concat.apply([], Object.values(this.newMsgData.recipients)), { last_use: Date.now() });
    if (this.pwd) {
      // this is used when sending encrypted messages to people without encryption plugin, the encrypted data goes through FlowCrypt and recipients get a link
      // admin_code stays locally and helps the sender extend life of the message or delete it
      const { short, admin_code } = await Backend.messageUpload(encryptedBody['text/plain']!, subscription.active ? 'uuid' : undefined);
      const storage = await Store.getAcct(this.urlParams.acctEmail, ['outgoing_language']);
      encryptedBody = this.fmtPwdProtectedEmail(short, encryptedBody, pubkeysOnly, atts, storage.outgoing_language || 'EN');
      const attAdminCodes = await this.uploadAttsToFc(atts, subscription);
      await this.composer.app.storageAddAdminCodes(short, admin_code, attAdminCodes);
    }
    return await Google.createMsgObj(this.urlParams.acctEmail, this.newMsgData.sender, this.newMsgData.recipients, this.newMsgData.subject, encryptedBody, atts, this.urlParams.threadId);
  }

  private async addReplyTokenToMsgBodyIfNeeded(subscription: Subscription): Promise<string> {
    if (!this.newMsgData.pwd || !subscription.active) {
      return this.newMsgData.plaintext;
    }
    const recipients = Array.prototype.concat.apply([], Object.values(this.newMsgData.recipients));
    try {
      const response = await Backend.messageToken();
      return this.newMsgData.plaintext + '\n\n' + Ui.e('div', {
        'style': 'display: none;', 'class': 'cryptup_reply', 'cryptup-data': Str.htmlAttrEncode({
          sender: this.newMsgData.sender,
          recipient: Value.arr.withoutVal(Value.arr.withoutVal(recipients, this.newMsgData.sender), this.urlParams.acctEmail),
          subject: this.newMsgData,
          token: response.token,
        })
      });
    } catch (msgTokenErr) {
      if (Api.err.isAuthErr(msgTokenErr)) {
        if (await Ui.modal.confirm('Your FlowCrypt account information is outdated, please review your account settings.')) {
          BrowserMsg.send.subscribeDialog(this.urlParams.parentTabId, { isAuthErr: true });
        }
        throw new ComposerResetBtnTrigger();
      } else if (Api.err.isStandardErr(msgTokenErr, 'subscription')) {
        return this.newMsgData.plaintext;
      }
      throw Catch.rewrapErr(msgTokenErr, 'There was a token error sending this message. Please try again. Let us know at human@flowcrypt.com if this happens repeatedly.');
    }
  }

  private async uploadAttsToFc(atts: Att[], subscription: Subscription): Promise<string[]> {
    const pfRes: BackendRes.FcMsgPresignFiles = await Backend.messagePresignFiles(atts, subscription.active ? 'uuid' : undefined);
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
    return admin_codes;
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

  private async encryptMsgAsOfDateIfSomeAreExpiredAndUserConfirmedModal(armoredPubkeys: PubkeyResult[]): Promise<Date | undefined> {
    const usableUntil: number[] = [];
    const usableFrom: number[] = [];
    for (const armoredPubkey of armoredPubkeys) {
      const { keys: [pub] } = await openpgp.key.readArmored(armoredPubkey.pubkey);
      const oneSecondBeforeExpiration = await Pgp.key.dateBeforeExpiration(pub);
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
    for (const myKey of armoredPubkeys.filter(ap => ap.isMine)) {
      if (await Pgp.key.usableButExpired(await Pgp.key.read(myKey.pubkey))) {
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

  private fmtPwdProtectedEmail(shortId: string, encryptedBody: SendableMsgBody, armoredPubkeys: string[], atts: Att[], lang: 'DE' | 'EN') {
    const msgUrl = `${this.FC_WEB_URL}/${shortId}`;
    const a = `<a href="${Xss.escape(msgUrl)}" style="padding: 2px 6px; background: #2199e8; color: #fff; display: inline-block; text-decoration: none;">
                    ${Lang.compose.openMsg[lang]}
                   </a>`;
    const intro = this.composer.S.cached('input_intro').length && this.composer.textInput.extractAsText('input_intro');
    const text = [];
    const html = [];
    if (intro) {
      text.push(intro + '\n');
      html.push(intro.replace(/\n/g, '<br>') + '<br><br>');
    }
    text.push(Lang.compose.msgEncryptedText[lang] + msgUrl + '\n');
    html.push(`
                <div class="cryptup_encrypted_message_replaceable">
                    <div style="opacity: 0;">${Pgp.armor.headers('null').begin}</div>
                    ${Lang.compose.msgEncryptedHtml[lang] + a}<br/><br/>
                    ${Lang.compose.alternativelyCopyPaste[lang] + Xss.escape(msgUrl)}<br/><br/><br/>
                </div>`);
    if (armoredPubkeys.length > 1) { // only include the message in email if a pubkey-holding person is receiving it as well
      atts.push(new Att({ data: Buf.fromUtfStr(encryptedBody['text/plain']!), name: 'encrypted.asc' }));
    }
    return { 'text/plain': text.join('\n'), 'text/html': html.join('\n') };
  }
}
