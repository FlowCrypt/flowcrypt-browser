/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Att } from '../../../js/common/core/att.js';
import { BrowserMsg } from '../../../js/common/browser/browser-msg.js';
import { Catch } from '../../../js/common/platform/catch.js';
import { ComposerComponent } from './composer-abstract-component.js';
import { KeyImportUi } from '../../../js/common/ui/key-import-ui.js';
import { Lang } from '../../../js/common/lang.js';
import { PgpKey } from '../../../js/common/core/pgp-key.js';
import { RecipientType } from '../../../js/common/api/api.js';
import { Recipients } from '../../../js/common/api/email-provider/email-provider-api.js';
import { SendableMsg } from '../../../js/common/api/email-provider/sendable-msg.js';
import { Store } from '../../../js/common/platform/store.js';
import { Str } from '../../../js/common/core/common.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { Xss } from '../../../js/common/platform/xss.js';

export class ComposerRender extends ComposerComponent {

  public initActions = async () => {
    await this.initComposeBox();
    BrowserMsg.addListener('close_dialog', async () => { $('.featherlight.featherlight-iframe').remove(); });
    this.composer.S.cached('icon_help').click(this.view.setHandler(() => this.renderSettingsWithDialog('help'), this.composer.errs.handlers(`render help dialog`)));
    this.composer.S.cached('body').bind({ drop: Ui.event.stop(), dragover: Ui.event.stop() }); // prevents files dropped out of the intended drop area to screw up the page
    this.composer.atts.initActions();
    this.composer.draft.initActions().catch(Catch.reportErr);
    this.composer.errs.initActions();
    this.composer.input.initActions();
    this.composer.myPubkey.initActions();
    await this.composer.pwdOrPubkeyContainer.initActions();
    this.composer.quote.initActions();
    this.composer.size.initActions();
    this.composer.storage.initActions();
    // this.composer.recipients.initActions - initiated below
    // this.composer.sendBtn.initActions - initiated below
    await this.composer.sender.checkEmailAliases();
  }

  public renderReplyMsgComposeTable = async (method: 'forward' | 'reply' = 'reply'): Promise<void> => {
    this.composer.S.cached('prompt').css({ display: 'none' });
    this.composer.recipients.showHideCcAndBccInputsIfNeeded();
    await this.composer.recipients.setEmailsPreview(this.composer.recipients.getRecipients());
    await this.renderComposeTable();
    if (this.composer.canReadEmails) {
      if (this.view.replyParams) {
        this.view.replyParams.subject = `${(method === 'reply' ? 'Re' : 'Fwd')}: ${this.view.replyParams.subject}`;
      }
      if (!this.composer.draft.wasMsgLoadedFromDraft) { // if there is a draft, don't attempt to pull quoted content. It's assumed to be already present in the draft
        (async () => { // not awaited because can take a long time & blocks rendering
          await this.composer.quote.addTripleDotQuoteExpandFooterAndQuoteBtn(this.view.replyMsgId, method);
          if (this.composer.quote.messageToReplyOrForward) {
            const msgId = this.composer.quote.messageToReplyOrForward.headers['message-id'];
            this.composer.sendBtn.additionalMsgHeaders['In-Reply-To'] = msgId;
            this.composer.sendBtn.additionalMsgHeaders.References = this.composer.quote.messageToReplyOrForward.headers.references + ' ' + msgId;
            if (this.view.replyPubkeyMismatch) {
              await this.renderReplyMsgAsReplyPubkeyMismatch();
            } else if (this.composer.quote.messageToReplyOrForward.isOnlySigned) {
              this.composer.sendBtn.popover.toggleItemTick($('.action-toggle-encrypt-sending-option'), 'encrypt', false); // don't encrypt
              this.composer.sendBtn.popover.toggleItemTick($('.action-toggle-sign-sending-option'), 'sign', true); // do sign
            }
          }
        })().catch(Catch.reportErr);
      }
    } else {
      Xss.sanitizeRender(this.composer.S.cached('prompt'),
        `${Lang.compose.needReadAccessToReply}<br/><br/><br/>
        <button class="button green auth_settings">${Lang.compose.addMissingPermission}</button><br/><br/>
        Alternatively, <a href="#" class="new_message_button">compose a new secure message</a> to respond.<br/><br/>
      `);
      this.composer.S.cached('prompt').attr('style', 'border:none !important');
      $('.auth_settings').click(() => BrowserMsg.send.bg.settings({ acctEmail: this.view.acctEmail, page: '/chrome/settings/modules/auth_denied.htm' }));
      $('.new_message_button').click(() => BrowserMsg.send.openNewMessage(this.view.parentTabId));
    }
    this.composer.size.resizeComposeBox();
    if (method === 'forward') {
      this.composer.S.cached('recipients_placeholder').click();
    }
    Catch.setHandledTimeout(() => BrowserMsg.send.scrollToElement(this.view.parentTabId, { selector: `#${this.view.frameId}` }), 300);
  }

  public renderReplySuccess = (msg: SendableMsg, msgId: string) => {
    this.composer.render.renderReinsertReplyBox(msgId);
    if (!this.composer.sendBtn.popover.choices.encrypt) {
      this.composer.S.cached('replied_body').addClass('pgp_neutral').removeClass('pgp_secure');
    }
    this.composer.S.cached('replied_body').css('width', ($('table#compose').width() || 500) - 30);
    this.composer.S.cached('compose_table').css('display', 'none');
    this.composer.S.cached('reply_msg_successful').find('div.replied_from').text(this.composer.sender.getSender());
    this.composer.S.cached('reply_msg_successful').find('div.replied_to span').text(msg.headers.To.replace(/,/g, ', '));
    const repliedBodyEl = this.composer.S.cached('reply_msg_successful').find('div.replied_body');
    Xss.sanitizeRender(repliedBodyEl, Xss.escapeTextAsRenderableHtml(this.composer.input.extract('text', 'input_text', 'SKIP-ADDONS')));
    const t = new Date();
    const time = ((t.getHours() !== 12) ? (t.getHours() % 12) : 12) + ':' + (t.getMinutes() < 10 ? '0' : '') + t.getMinutes() + ((t.getHours() >= 12) ? ' PM ' : ' AM ') + '(0 minutes ago)';
    this.composer.S.cached('reply_msg_successful').find('div.replied_time').text(time);
    this.composer.S.cached('reply_msg_successful').css('display', 'block');
    this.renderReplySuccessAtts(msg.atts, msgId);
    this.composer.size.resizeComposeBox();
  }

  public renderReinsertReplyBox = (msgId: string) => {
    BrowserMsg.send.reinsertReplyBox(this.view.parentTabId, { replyMsgId: msgId });
  }

  public renderAddPubkeyDialog = (emails: string[]) => {
    BrowserMsg.send.addPubkeyDialog(this.view.parentTabId, { emails });
  }

  public closeMsg = () => {
    $('body').attr('data-test-state', 'closed'); // used by automated tests
    if (this.view.isReplyBox) {
      BrowserMsg.send.closeReplyMessage(this.view.parentTabId, { frameId: this.view.frameId });
    } else {
      BrowserMsg.send.closeNewMessage(this.view.parentTabId);
    }
  }

  public renderSettingsWithDialog = (settingsModule: string) => {
    BrowserMsg.send.bg.settings({ acctEmail: this.view.acctEmail, page: `/chrome/settings/modules/${settingsModule}.htm` });
  }

  private initComposeBox = async () => {
    this.initComposeBoxStyles();
    if (this.view.draftId) {
      this.composer.S.cached('triple_dot').remove(); // if it's draft, footer and quote should already be included in the draft
      await this.composer.draft.initialDraftLoad(this.view.draftId);
      if (this.view.isReplyBox) {
        await this.composer.render.renderReplyMsgComposeTable();
      }
    } else {
      if (this.view.isReplyBox && this.view.replyParams) {
        const recipients: Recipients = { to: this.view.replyParams.to, cc: this.view.replyParams.cc, bcc: this.view.replyParams.bcc };
        this.composer.recipients.addRecipients(recipients, false).catch(Catch.reportErr);
        // await this.composer.composerContacts.addRecipientsAndShowPreview(recipients);
        if (this.view.skipClickPrompt) { // TODO: fix issue when loading recipients
          await this.renderReplyMsgComposeTable();
        } else {
          $('#reply_click_area,#a_reply,#a_reply_all,#a_forward')
            .click(this.view.setHandler((el) => this.actionActivateReplyBoxHandler(el), this.composer.errs.handlers(`activate repply box`)));
        }
      }
    }
    if (this.view.isReplyBox) {
      $(document).ready(() => this.composer.size.resizeComposeBox());
    } else {
      this.composer.S.cached('body').css('overflow', 'hidden'); // do not enable this for replies or automatic resize won't work
      await this.renderComposeTable();
      await this.composer.recipients.setEmailsPreview(this.composer.recipients.getRecipients());
    }
    this.composer.sendBtn.resetSendBtn();
    await this.composer.sendBtn.popover.render();
    this.loadRecipientsThenSetTestStateReady().catch(Catch.reportErr);
  }

  private initComposeBoxStyles = () => {
    if (this.view.isReplyBox) {
      this.composer.S.cached('body').addClass('reply_box');
      this.composer.S.cached('header').remove();
      this.composer.S.cached('subject').remove();
      this.composer.S.cached('contacts').css('top', '39px');
      this.composer.S.cached('compose_table').css({ 'border-bottom': '1px solid #cfcfcf', 'border-top': '1px solid #cfcfcf' });
      this.composer.S.cached('input_text').css('overflow-y', 'hidden');
      if (!this.view.skipClickPrompt && !this.view.draftId) {
        this.composer.S.cached('prompt').css('display', 'block');
      }
    } else {
      this.composer.S.cached('compose_table').css({ 'height': '100%' });
    }
  }

  private actionActivateReplyBoxHandler = async (target: HTMLElement) => {
    let method: 'reply' | 'forward' = 'reply';
    const typesToDelete: RecipientType[] = [];
    switch ($(target).attr('id')) {
      case 'a_forward':
        method = 'forward';
        typesToDelete.push('to');
      case 'reply_click_area':
      case 'a_reply':
        typesToDelete.push('cc');
        typesToDelete.push('bcc');
        break;
    }
    this.composer.recipients.deleteRecipientsBySendingType(typesToDelete);
    await this.renderReplyMsgComposeTable(method);
  }

  private renderReplyMsgAsReplyPubkeyMismatch = async () => {
    this.composer.input.inputTextHtmlSetSafely(`Hello,
      <br><br>I was not able to read your encrypted message because it was encrypted for a wrong key.
      <br><br>My current public key is attached below. Please update your records and send me a new encrypted message.
      <br><br>Thank you</div>`);
    const [primaryKi] = await Store.keysGet(this.view.acctEmail, ['primary']);
    const att = Att.keyinfoAsPubkeyAtt(primaryKi);
    this.composer.atts.attach.addFile(new File([att.getData()], att.name));
    this.composer.sendBtn.popover.toggleItemTick($('.action-toggle-encrypt-sending-option'), 'encrypt', false); // don't encrypt
    this.composer.sendBtn.popover.toggleItemTick($('.action-toggle-sign-sending-option'), 'sign', false); // don't sign
  }

  private getFocusableEls = () => {
    return this.composer.S.cached('compose_table').find('[tabindex]:not([tabindex="-1"]):visible').toArray().sort((a, b) => {
      const tabindexA = parseInt(a.getAttribute('tabindex') || '');
      const tabindexB = parseInt(b.getAttribute('tabindex') || '');
      if (tabindexA > tabindexB) { // sort according to tabindex
        return 1;
      } else if (tabindexA < tabindexB) {
        return -1;
      }
      return 0;
    });
  }

  private renderComposeTable = async () => {
    this.composer.errs.debugFocusEvents('input_text', 'send_btn', 'input_to', 'input_subject');
    this.composer.S.cached('compose_table').css('display', 'table');
    this.composer.S.cached('body').keydown(this.view.setHandler((el, ev) => this.onBodyKeydownHandler(el, ev)));
    this.composer.recipients.initActions();
    this.composer.sendBtn.initActions();
    this.composer.S.cached('input_to').bind('paste', this.view.setHandler((el, ev) => this.onRecipientPasteHandler(el, ev)));
    this.composer.input.squire.addEventListener('keyup', () => this.composer.S.cached('send_btn_note').text(''));
    this.composer.S.cached('input_addresses_container_inner').click(this.view.setHandler(() => this.onRecipientsClickHandler(), this.composer.errs.handlers(`focus recipients`)));
    this.composer.S.cached('input_addresses_container_inner').children().click(() => false);
    this.composer.atts.onComposeTableRender();
    await this.composer.sender.renderSendFromOrChevron();
    if (this.view.isReplyBox) {
      if (this.view.replyParams?.to.length) {
        // Firefox will not always respond to initial automatic $input_text.blur(): recipients may be left unrendered, as standard text, with a trailing comma
        await this.composer.recipients.parseRenderRecipients(this.composer.S.cached('input_to')); // this will force firefox to render them on load
      }
    } else {
      $('.close_new_message').click(this.view.setHandler(() => this.actionCloseHandler(), this.composer.errs.handlers(`close message`)));
      this.composer.S.cached('header').find('#header_title').click(() => $('.minimize_new_message').click());
      await this.composer.quote.addTripleDotQuoteExpandFooterOnlyBtn();
      this.composer.size.setInputTextHeightManuallyIfNeeded();
    }
    // Firefox needs an iframe to be focused before focusing its content
    BrowserMsg.send.focusFrame(this.view.parentTabId, { frameId: this.view.frameId });
    Catch.setHandledTimeout(() => { // Chrome needs async focus: https://github.com/FlowCrypt/flowcrypt-browser/issues/2056
      this.composer.S.cached(this.view.isReplyBox && this.view.replyParams?.to.length ? 'input_text' : 'input_to').focus();
      // document.getElementById('input_text')!.focus(); // #input_text is in the template
    }, 100);
    this.composer.size.onComposeTableRender();
  }

  private actionCloseHandler = async () => {
    if (!this.composer.sendBtn.isSendMessageInProgres() || await Ui.modal.confirm(Lang.compose.abortSending)) {
      this.composer.render.closeMsg();
    }
  }

  private onRecipientsClickHandler = () => {
    if (!this.composer.S.cached('input_to').is(':focus')) {
      this.composer.errs.debug(`input_addresses_container_inner.click -> calling input_to.focus() when input_to.val(${this.composer.S.cached('input_to').val()})`);
      this.composer.S.cached('input_to').focus();
    }
  }

  private onRecipientPasteHandler = async (elem: HTMLElement, event: JQuery.Event<HTMLElement>) => {
    if (event.originalEvent instanceof ClipboardEvent && event.originalEvent.clipboardData) {
      const textData = event.originalEvent.clipboardData.getData('text/plain');
      const keyImportUi = new KeyImportUi({ checkEncryption: true });
      let normalizedPub: string;
      try {
        normalizedPub = await keyImportUi.checkPub(textData);
      } catch (e) {
        return; // key is invalid
      }
      const { keys: [key] } = await PgpKey.parseDetails(normalizedPub);
      if (!key.users.length) { // there can be no users
        return;
      }
      const keyUser = Str.parseEmail(key.users[0]);
      if (keyUser.email) {
        if (!await Store.dbContactGet(undefined, [keyUser.email])) {
          await Store.dbContactSave(undefined, await Store.dbContactObj({
            email: keyUser.email, name: keyUser.name, client: 'pgp',
            pubkey: normalizedPub, lastCheck: Date.now(), expiresOn: await PgpKey.dateBeforeExpiration(normalizedPub)
          }));
        }
        this.composer.S.cached('input_to').val(keyUser.email);
        await this.composer.recipients.parseRenderRecipients(this.composer.S.cached('input_to'));
      } else {
        await Ui.modal.warning(`The email listed in this public key does not seem valid: ${keyUser}`);
      }
    }
  }

  private onBodyKeydownHandler = (_: HTMLElement, e: JQuery.Event<HTMLElement>) => {
    if (this.composer.size.composeWindowIsMinimized) {
      return e.preventDefault();
    }
    Ui.escape(() => !this.view.isReplyBox && $('.close_new_message').click())(e);
    const focusableEls = this.getFocusableEls();
    const focusIndex = focusableEls.indexOf(e.target);
    if (focusIndex !== -1) { // Focus trap (Tab, Shift+Tab)
      Ui.tab((e) => { // rollover to first item or focus next
        focusableEls[focusIndex === focusableEls.length - 1 ? 0 : focusIndex + 1].focus();
        e.preventDefault();
      })(e);
      Ui.shiftTab((e) => { // rollover to last item or focus prev
        focusableEls[focusIndex === 0 ? focusableEls.length - 1 : focusIndex - 1].focus();
        e.preventDefault();
      })(e);
    }
  }

  private loadRecipientsThenSetTestStateReady = async () => {
    await Promise.all(this.composer.recipients.getRecipients().filter(r => r.evaluating).map(r => r.evaluating));
    $('body').attr('data-test-state', 'ready');  // set as ready so that automated tests can evaluate results
  }

  private renderReplySuccessAtts = (atts: Att[], msgId: string) => {
    const hideAttTypes = this.composer.sendBtn.popover.choices.richtext ? ['hidden', 'encryptedMsg', 'signature', 'publicKey'] : ['publicKey'];
    const renderableAtts = atts.filter(att => !hideAttTypes.includes(att.treatAs()));
    if (renderableAtts.length) {
      this.composer.S.cached('replied_attachments').html(renderableAtts.map(att => { // xss-safe-factory
        att.msgId = msgId;
        return this.composer.view.factory!.embeddedAtta(att, true);
      }).join('')).css('display', 'block');
    }
  }

}
