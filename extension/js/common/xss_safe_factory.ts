/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

/// <reference path="../../../node_modules/@types/chrome/index.d.ts" />

'use strict';

import { Dict, Str, Url, UrlParams } from './core/common.js';

import { Att } from './core/att.js';
import { Browser } from './browser/browser.js';
import { Catch } from './platform/catch.js';
import { MsgBlock } from './core/msg-block.js';
import { MsgBlockParser } from './core/msg-block-parser.js';
import { PgpArmor } from './core/pgp-armor.js';
import { SendAsAlias } from './platform/store.js';
import { Ui } from './browser/ui.js';
import { WebMailName } from './browser/env.js';
import { Xss } from './platform/xss.js';

type Placement = 'settings' | 'settings_compose' | 'default' | 'dialog' | 'gmail' | 'embedded' | 'compose';
export type WebmailVariantString = undefined | 'html' | 'standard' | 'new';
export type PassphraseDialogType = 'embedded' | 'message' | 'attachment' | 'draft' | 'sign' | `quote` | `backup`;
export type FactoryReplyParams = {
  replyMsgId?: string,
  sendAs?: Dict<SendAsAlias>,
  subject?: string,
  removeAfterClose?: boolean,
};

export class XssSafeFactory {

  /**
   * XSS WARNING
   *
   * Method return values are inserted directly into DOM.
   *
   * All public methods are expected to escape unknown content to prevent XSS.
   *
   * If you add or edit a method, REQUEST A SECOND SET OF EYES TO REVIEW CHANGES
   */

  private setParams: UrlParams;
  private reloadableCls: string;
  private destroyableCls: string;
  private hideGmailNewMsgInThreadNotification = '<style>.ata-asE { display: none !important; visibility: hidden !important; }</style>';

  constructor(acctEmail: string, parentTabId: string, reloadableCls: string = '', destroyableCls: string = '', setParams: UrlParams = {}) {
    this.reloadableCls = Xss.escape(reloadableCls);
    this.destroyableCls = Xss.escape(destroyableCls);
    this.setParams = setParams;
    this.setParams.acctEmail = acctEmail;
    this.setParams.parentTabId = parentTabId;
  }

  srcImg = (relPath: string) => this.extUrl(`img/${relPath}`);

  private frameSrc = (path: string, params: UrlParams = {}) => {
    for (const k of Object.keys(this.setParams)) {
      params[k] = this.setParams[k];
    }
    return Url.create(path, params);
  }

  srcComposeMsg = (draftId?: string) => {
    return this.frameSrc(this.extUrl('chrome/elements/compose.htm'), { frameId: this.newId(), draftId });
  }

  srcPassphraseDialog = (longids: string[] = [], type: PassphraseDialogType) => {
    return this.frameSrc(this.extUrl('chrome/elements/passphrase.htm'), { type, longids });
  }

  srcSubscribeDialog = (placement?: Placement, isAuthErr?: boolean) => {
    return this.frameSrc(this.extUrl('chrome/elements/subscribe.htm'), { placement, isAuthErr });
  }

  srcAddPubkeyDialog = (emails: string[], placement: Placement) => {
    return this.frameSrc(this.extUrl('chrome/elements/add_pubkey.htm'), { emails, placement });
  }

  srcPgpAttIframe = (a: Att, isEncrypted: boolean) => {
    if (!a.id && !a.url && a.hasData()) { // data provided directly, pass as object url
      a.url = Browser.objUrlCreate(a.getData());
    }
    return this.frameSrc(this.extUrl('chrome/elements/attachment.htm'), {
      frameId: this.newId(), msgId: a.msgId, name: a.name, type: a.type, size: a.length, attId: a.id, url: a.url, isEncrypted
    });
  }

  srcPgpBlockIframe = (message: string, msgId?: string, isOutgoing?: boolean, senderEmail?: string, hasPassword?: boolean, signature?: string | boolean, short?: string) => {
    return this.frameSrc(this.extUrl('chrome/elements/pgp_block.htm'), { frameId: this.newId(), message, hasPassword, msgId, senderEmail, isOutgoing, signature, short });
  }

  srcPgpPubkeyIframe = (armoredPubkey: string, isOutgoing?: boolean) => {
    return this.frameSrc(this.extUrl('chrome/elements/pgp_pubkey.htm'), { frameId: this.newId(), armoredPubkey, minimized: Boolean(isOutgoing), });
  }

  srcBackupIframe = (armoredPrvBackup: string) => {
    return this.frameSrc(this.extUrl('chrome/elements/backup.htm'), { frameId: this.newId(), armoredPrvBackup });
  }

  srcReplyMsgIframe = (convoParams: FactoryReplyParams, skipClickPrompt: boolean, ignoreDraft: boolean) => {
    const params: UrlParams = {
      isReplyBox: true,
      frameId: `frame_${Str.sloppyRandom(10)}`,
      skipClickPrompt: Boolean(skipClickPrompt),
      ignoreDraft: Boolean(ignoreDraft),
      replyMsgId: convoParams.replyMsgId,
      removeAfterClose: convoParams.removeAfterClose
    };
    return this.frameSrc(this.extUrl('chrome/elements/compose.htm'), params);
  }

  srcStripeCheckout = () => {
    return this.frameSrc('https://flowcrypt.com/stripe.htm', {});
  }

  metaNotificationContainer = () => {
    return `<div class="${this.destroyableCls} webmail_notifications" style="text-align: center;"></div>`;
  }

  metaStylesheet = (file: string) => {
    return `<link class="${this.destroyableCls}" rel="stylesheet" href="${this.extUrl(`css/${file}.css`)}" />`;
  }

  dialogPassphrase = (longids: string[], type: PassphraseDialogType) => {
    return this.divDialog_DANGEROUS(this.iframe(this.srcPassphraseDialog(longids, type), ['medium'], { scrolling: 'no' }), 'dialog-passphrase'); // xss-safe-factory
  }

  dialogSubscribe = (isAuthErr?: boolean) => {
    const src = this.srcSubscribeDialog('dialog', isAuthErr);
    return this.divDialog_DANGEROUS(this.iframe(src, ['mediumtall'], { scrolling: 'no' }), 'dialog-subscribe'); // xss-safe-factory
  }

  dialogAddPubkey = (emails: string[]) => {
    return this.divDialog_DANGEROUS(this.iframe(this.srcAddPubkeyDialog(emails, 'gmail'), ['tall'], { scrolling: 'no' }), 'dialog-add-pubkey'); // xss-safe-factory
  }

  embeddedCompose = (draftId?: string) => {
    return Ui.e('div', { id: 'new_message', class: 'new_message', 'data-test': 'container-new-message', html: this.iframe(this.srcComposeMsg(draftId), [], { scrolling: 'no' }) });
  }

  embeddedSubscribe = (isAuthErr: boolean) => {
    return this.iframe(this.srcSubscribeDialog('embedded', isAuthErr), ['short', 'embedded'], { scrolling: 'no' });
  }

  embeddedAtta = (meta: Att, isEncrypted: boolean) => {
    return Ui.e('span', { class: 'pgp_attachment', html: this.iframe(this.srcPgpAttIframe(meta, isEncrypted)) });
  }

  embeddedMsg = (armored: string, msgId?: string, isOutgoing?: boolean, sender?: string, hasPassword?: boolean, signature?: string | boolean, short?: string) => {
    return this.iframe(this.srcPgpBlockIframe(armored, msgId, isOutgoing, sender, hasPassword, signature, short), ['pgp_block']) + this.hideGmailNewMsgInThreadNotification;
  }

  embeddedPubkey = (armoredPubkey: string, isOutgoing?: boolean) => {
    return this.iframe(this.srcPgpPubkeyIframe(armoredPubkey, isOutgoing), ['pgp_block']);
  }

  embeddedBackup = (armoredPrvBackup: string) => {
    return this.iframe(this.srcBackupIframe(armoredPrvBackup), ['backup_block']);
  }

  embeddedReply = (convoParams: FactoryReplyParams, skipClickPrompt: boolean, ignoreDraft: boolean = false) => {
    return this.iframe(this.srcReplyMsgIframe(convoParams, skipClickPrompt, ignoreDraft), ['reply_message']);
  }

  embeddedPassphrase = (longids: string[]) => {
    return this.divDialog_DANGEROUS(this.iframe(this.srcPassphraseDialog(longids, 'embedded'), ['medium'], { scrolling: 'no' }), 'embedded-passphrase'); // xss-safe-factory
  }

  embeddedAttaStatus = (content: string) => {
    return Ui.e('div', { class: 'attachment_loader', html: Xss.htmlSanitize(content) });
  }

  embeddedStripeCheckout = () => {
    return this.iframe(this.srcStripeCheckout(), [], { sandbox: 'allow-forms allow-scripts allow-same-origin' });
  }

  btnCompose = (webmailName: WebMailName) => {
    if (webmailName === 'outlook') {
      const btn = `<div class="new_message_button" title="New Secure Email"><img src="${this.srcImg('logo-19-19.png')}"></div>`;
      return `<div class="_fce_c ${this.destroyableCls} cryptup_compose_button_container" role="presentation">${btn}</div>`;
    } else {
      const btn = `<div class="new_message_button T-I J-J5-Ji T-I-KE L3" id="flowcrypt_new_message_button" role="button" tabindex="0" data-test="action-secure-compose">Secure Compose</div>`;
      return `<div class="${this.destroyableCls} z0">${btn}</div>`;
    }
  }

  btnSecureReply = () => {
    return `<div class="${this.destroyableCls} reply_message_button" data-test="secure-reply-button" role="button" tabindex="0" data-tooltip="Secure Reply" aria-label="Secure Reply">
      <img title="Secure Reply" src="${this.srcImg('svgs/reply-icon.svg')}" />
    </div>`;
  }

  btnEndPPSession = (webmailName: string) => {
    return `<div class="action_finish_session zo" ${webmailName === 'gmail' ? 'data-tooltip' : 'title'}="End Pass Phrase Session" data-test="action-finish-session">
                <a class="gb_se t6" ${webmailName === 'gmail' ? 'style="text-align: center; width: 18px;"' : ''}>
                  <img src="${this.srcImg('svgs/unlock.svg')}"  ${webmailName === 'gmail' ? 'style="width: 18px;"' : ''} />
                </a>
              </div>`;
  }

  btnWithoutFc = () => {
    const span = `<span>see original</span>`;
    return `<span class="hk J-J5-Ji cryptup_convo_button show_original_conversation ${this.destroyableCls}" data-tooltip="Show conversation without FlowCrypt">${span}</span>`;
  }

  btnWithFc = () => {
    return `<span class="hk J-J5-Ji cryptup_convo_button use_secure_reply ${this.destroyableCls}" data-tooltip="Use Secure Reply"><span>secure reply</span></span>`;
  }

  btnRecipientsUseEncryption = (webmailName: WebMailName) => {
    if (webmailName !== 'gmail') {
      Catch.report('switch_to_secure not implemented for ' + webmailName);
      return '';
    } else {
      return '<div class="aoD az6 recipients_use_encryption">Your recipients seem to have encryption set up! <a href="#">Secure Compose</a></div>';
    }
  }

  btnSettings = (webmailName: WebMailName) => {
    if (webmailName !== 'gmail') {
      Catch.report('btnSettings not implemented for ' + webmailName);
      return '';
    } else {
      return `<div id="fc_settings_btn" class="f1">FlowCrypt</div>`;
    }
  }

  private extUrl = (s: string) => {
    return chrome.runtime.getURL(s);
  }

  private newId = () => {
    return `frame_${Str.sloppyRandom(10)}`;
  }

  private iframe = (src: string, classes: string[] = [], elAttributes: UrlParams = {}) => {
    const id = String(Url.parse(['frameId'], src).frameId);
    const classAttribute = (classes || []).concat(this.reloadableCls).join(' ');
    const attrs: Dict<string> = { id, class: classAttribute, src };
    for (const name of Object.keys(elAttributes)) {
      attrs[name] = String(elAttributes[name]);
    }
    return Ui.e('iframe', attrs);
  }

  // tslint:disable-next-line:variable-name
  private divDialog_DANGEROUS(content_MUST_BE_XSS_SAFE: string, dataTest: string) { // xss-dangerous-function
    return Ui.e('div', { id: 'cryptup_dialog', html: content_MUST_BE_XSS_SAFE, 'data-test': dataTest });
  }

  /**
   * XSS WARNING
   *
   * Return values are inserted directly into DOM. Results must be html escaped.
   *
   * When edited, REQUEST A SECOND SET OF EYES TO REVIEW CHANGES
   */
  public static renderableMsgBlock = (factory: XssSafeFactory, block: MsgBlock, msgId?: string, senderEmail?: string, isOutgoing?: boolean) => {
    if (block.type === 'plainText') {
      return Xss.escape(block.content.toString()).replace(/\n/g, '<br>') + '<br><br>';
    } else if (block.type === 'plainHtml') {
      return Xss.htmlSanitizeAndStripAllTags(block.content.toString(), '<br>') + '<br><br>';
    } else if (block.type === 'encryptedMsg') {
      return factory.embeddedMsg(block.complete ? PgpArmor.normalize(block.content.toString(), 'encryptedMsg') : '', msgId, isOutgoing, senderEmail, false);
    } else if (block.type === 'signedMsg') {
      return factory.embeddedMsg(block.content.toString(), msgId, isOutgoing, senderEmail, false);
    } else if (block.type === 'publicKey') {
      return factory.embeddedPubkey(PgpArmor.normalize(block.content.toString(), 'publicKey'), isOutgoing);
    } else if (block.type === 'privateKey') {
      return factory.embeddedBackup(PgpArmor.normalize(block.content.toString(), 'privateKey'));
    } else if (block.type === 'encryptedMsgLink') {
      return factory.embeddedMsg('', msgId, isOutgoing, senderEmail, true, undefined, block.content.toString()); // here block.content is message short id
    } else if (['encryptedAtt', 'plainAtt'].includes(block.type)) {
      return block.attMeta ? factory.embeddedAtta(new Att(block.attMeta), block.type === 'encryptedAtt') : '[missing encrypted attachment details]';
    } else if (block.type === 'signedHtml') {
      return factory.embeddedMsg('', msgId, isOutgoing, senderEmail, false, true); // empty msg so it re-fetches from api. True at the and for "signature"
    } else {
      Catch.report(`don't know how to process block type: ${block.type} (not a hard fail)`);
      return '';
    }
  }

  /**
   * XSS WARNING
   *
   * Return values are inserted directly into DOM. Results must be html escaped.
   *
   * When edited, REQUEST A SECOND SET OF EYES TO REVIEW CHANGES
   */
  public static replaceRenderableMsgBlocks = (factory: XssSafeFactory, origText: string, msgId?: string, senderEmail?: string, isOutgoing?: boolean) => {
    const { blocks } = MsgBlockParser.detectBlocks(origText);
    if (blocks.length === 1 && blocks[0].type === 'plainText') {
      return undefined; // only has single block which is plain text - meaning
    }
    let r = '';
    for (const block of blocks) {
      r += (r ? '\n\n' : '') + XssSafeFactory.renderableMsgBlock(factory, block, msgId, senderEmail, isOutgoing);
    }
    return r;
  }

}
