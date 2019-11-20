/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypcom */

'use strict';

import { ComposerComponent } from './interfaces/composer-component.js';
import { Recipients } from './interfaces/composer-types.js';
import { Ui } from '../browser.js';
import { RecipientType } from '../api/api.js';
import { Xss } from '../platform/xss.js';
import { Catch } from '../platform/catch.js';
import { BrowserMsg } from '../extension.js';
import { Lang } from '../lang.js';
import { KeyImportUi } from '../ui/key_import_ui.js';
import { Pgp } from '../core/pgp.js';
import { Str } from '../core/common.js';
import { Store } from '../platform/store.js';

export class ComposerRender extends ComposerComponent {

  async initActions() {
    await this.initComposeBox();
    this.composer.S.cached('icon_pubkey').attr('title', Lang.compose.includePubkeyIconTitle);
    this.composer.S.cached('icon_help').click(Ui.event.handle(() => this.composer.app.renderHelpDialog(), this.composer.errs.handlers(`render help dialog`)));
    this.composer.S.cached('body').bind({ drop: Ui.event.stop(), dragover: Ui.event.stop() }); // prevents files dropped out of the intended drop area to screw up the page
    this.composer.draft.initActions().catch(Catch.reportErr);
    this.composer.windowSize.initActions();
    this.composer.textInput.initActions();
    await this.composer.sender.checkEmailAliases();
  }

  private initComposeBox = async () => {
    if (this.urlParams.isReplyBox) {
      this.composer.S.cached('body').addClass('reply_box');
      this.composer.S.cached('header').remove();
      this.composer.S.cached('subject').remove();
      this.composer.S.cached('contacts').css('top', '39px');
      this.composer.S.cached('compose_table').css({ 'border-bottom': '1px solid #cfcfcf', 'border-top': '1px solid #cfcfcf' });
      this.composer.S.cached('input_text').css('overflow-y', 'hidden');
      if (!this.urlParams.skipClickPrompt && !this.urlParams.draftId) {
        this.composer.S.cached('prompt').css('display', 'block');
      }
    } else {
      this.composer.S.cached('compose_table').css({ 'height': '100%' });
    }
    if (this.urlParams.draftId) {
      await this.composer.draft.initialDraftLoad(this.urlParams.draftId);
      const footer = this.composer.sender.getFooter();
      if (footer) {
        this.composer.quote.setFooter(footer);
      } else {
        this.composer.S.cached('icon_show_prev_msg').remove();
      }
    } else {
      if (this.urlParams.isReplyBox) {
        const recipients: Recipients = { to: this.urlParams.to, cc: this.urlParams.cc, bcc: this.urlParams.bcc };
        this.composer.contacts.addRecipients(recipients, false).catch(Catch
          .reportErr);
        // await this.composer.composerContacts.addRecipientsAndShowPreview(recipients);
        if (this.urlParams.skipClickPrompt) { // TODO: fix issue when loading recipients
          await this.renderReplyMsgComposeTable();
        } else {
          $('#reply_click_area,#a_reply,#a_reply_all,#a_forward').click(Ui.event.handle(async target => {
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
            this.composer.contacts.deleteRecipientsBySendingType(typesToDelete);
            await this.renderReplyMsgComposeTable(method);
          }, this.composer.errs.handlers(`activate repply box`)));
        }
      }
    }
    if (this.urlParams.isReplyBox) {
      $(document).ready(() => this.composer.windowSize.resizeComposeBox());
    } else {
      this.composer.S.cached('body').css('overflow', 'hidden'); // do not enable this for replies or automatic resize won't work
      await this.renderComposeTable();
      await this.composer.contacts.setEmailsPreview(this.composer.contacts.getRecipients());
    }
    this.composer.sendBtn.resetSendBtn();
    this.composer.sendBtn.popover.render();
    this.loadRecipientsThenSetTestStateReady().catch(Catch.reportErr);
  }

  public renderReplyMsgComposeTable = async (method: 'forward' | 'reply' = 'reply'): Promise<void> => {
    this.composer.S.cached('prompt').css({ display: 'none' });
    this.composer.contacts.showHideCcAndBccInputsIfNeeded();
    await this.composer.contacts.setEmailsPreview(this.composer.contacts.getRecipients());
    await this.renderComposeTable();
    if (this.composer.canReadEmails) {
      this.urlParams.subject = `${(method === 'reply' ? 'Re' : 'Fwd')}: ${this.urlParams.subject}`;
      if (!this.urlParams.draftId) { // if there is a draft, don't attempt to pull quoted content. It's assumed to be already present in the draft
        (async () => { // not awaited because can take a long time & blocks rendering
          const footer = this.composer.sender.getFooter();
          await this.composer.quote.addTripleDotQuoteExpandBtn(this.urlParams.replyMsgId, method, footer);
          if (this.composer.quote.messageToReplyOrForward) {
            const msgId = this.composer.quote.messageToReplyOrForward.headers['message-id'];
            this.composer.sendBtn.additionalMsgHeaders['In-Reply-To'] = msgId;
            this.composer.sendBtn.additionalMsgHeaders.References = this.composer.quote.messageToReplyOrForward.headers.references + ' ' + msgId;
            if (this.composer.quote.messageToReplyOrForward.isOnlySigned) {
              this.composer.sendBtn.popover.toggleItemTick($('.action-toggle-encrypt-sending-option'), 'encrypt', false); // don't encrypt
              this.composer.sendBtn.popover.toggleItemTick($('.action-toggle-sign-sending-option'), 'sign', true); // do sign
            }
          }
        })().catch(Catch.reportErr);
      }
    } else {
      Xss.sanitizeRender(this.composer.S.cached('prompt'),
        `${Lang.compose.needReadAccessToReply}<br/><br/><br/>
        <div class="button green auth_settings">${Lang.compose.addMissingPermission}</div><br/><br/>
        Alternatively, <a href="#" class="new_message_button">compose a new secure message</a> to respond.<br/><br/>
      `);
      this.composer.S.cached('prompt').attr('style', 'border:none !important');
      $('.auth_settings').click(() => BrowserMsg.send.bg.settings({ acctEmail: this.urlParams.acctEmail, page: '/chrome/settings/modules/auth_denied.htm' }));
      $('.new_message_button').click(() => BrowserMsg.send.openNewMessage(this.urlParams.parentTabId));
    }
    this.composer.windowSize.resizeComposeBox();
    if (method === 'forward') {
      this.composer.S.cached('recipients_placeholder').click();
    }
    Catch.setHandledTimeout(() => BrowserMsg.send.scrollToElement(this.urlParams.parentTabId, { selector: `#${this.urlParams.frameId}` }), 300);
  }

  private getFocusableEls = () => this.composer.S.cached('compose_table').find('[tabindex]:not([tabindex="-1"]):visible').toArray().sort((a, b) => {
    const tabindexA = parseInt(a.getAttribute('tabindex') || '');
    const tabindexB = parseInt(b.getAttribute('tabindex') || '');
    if (tabindexA > tabindexB) { // sort according to tabindex
      return 1;
    } else if (tabindexA < tabindexB) {
      return -1;
    }
    return 0;
  })

  private renderComposeTable = async () => {
    this.composer.errs.debugFocusEvents('input_text', 'send_btn', 'input_to', 'input_subject');
    this.composer.S.cached('compose_table').css('display', 'table');
    this.composer.S.cached('body').keydown(Ui.event.handle((_, e) => {
      if (this.composer.windowSize.composeWindowIsMinimized) {
        return e.preventDefault();
      }
      Ui.escape(() => !this.urlParams.isReplyBox && $('.close_new_message').click())(e);
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
    }));
    this.composer.contacts.initActions();
    this.composer.sendBtn.initActions();
    this.composer.S.cached('input_to').bind('paste', Ui.event.handle(async (elem, event) => {
      if (event.originalEvent instanceof ClipboardEvent && event.originalEvent.clipboardData) {
        const textData = event.originalEvent.clipboardData.getData('text/plain');
        const keyImportUi = new KeyImportUi({ checkEncryption: true });
        let normalizedPub: string;
        try {
          normalizedPub = await keyImportUi.checkPub(textData);
        } catch (e) {
          return; // key is invalid
        }
        const { keys: [key] } = await Pgp.key.parse(normalizedPub);
        if (!key.users.length) { // there can be no users
          return;
        }
        const keyUser = Str.parseEmail(key.users[0]);
        if (keyUser.email) {
          if (!await Store.dbContactGet(undefined, [keyUser.email])) {
            await Store.dbContactSave(undefined, await Store.dbContactObj({
              email: keyUser.email, name: keyUser.name, client: 'pgp',
              pubkey: normalizedPub, lastCheck: Date.now(), expiresOn: await Pgp.key.dateBeforeExpiration(normalizedPub)
            }));
          }
          this.composer.S.cached('input_to').val(keyUser.email);
          await this.composer.contacts.parseRenderRecipients(this.composer.S.cached('input_to'));
        } else {
          await Ui.modal.warning(`The email listed in this public key does not seem valid: ${keyUser}`);
        }
      }
    }));
    this.composer.S.cached('input_text').keyup(() => this.composer.S.cached('send_btn_note').text(''));
    this.composer.S.cached('input_addresses_container_inner').click(Ui.event.handle(() => {
      if (!this.composer.S.cached('input_to').is(':focus')) {
        this.composer.errs.debug(`input_addresses_container_inner.click -> calling input_to.focus() when input_to.val(${this.composer.S.cached('input_to').val()})`);
        this.composer.S.cached('input_to').focus();
      }
    }, this.composer.errs.handlers(`focus on recipient field`))).children().click(() => false);
    this.composer.atts.onComposeTableRender();
    if (this.urlParams.isReplyBox) {
      if (this.urlParams.to.length) {
        // Firefox will not always respond to initial automatic $input_text.blur()
        // Recipients may be left unrendered, as standard text, with a trailing comma
        await this.composer.contacts.parseRenderRecipients(this.composer.S.cached('input_to')); // this will force firefox to render them on load
      }
      this.composer.sender.renderSenderAliasesOptionsToggle();
    } else {
      $('.close_new_message').click(Ui.event.handle(async () => {
        if (!this.composer.sendBtn.isSendMessageInProgres() ||
          await Ui.modal.confirm('A message is currently being sent. Closing the compose window may abort sending the message.\nAbort sending?')) {
          this.composer.app.closeMsg();
        }
      }, this.composer.errs.handlers(`close message`)));
      this.composer.S.cached('header').find('#header_title').click(() => $('.minimize_new_message').click());
      if (this.composer.app.storageGetAddresses()) {
        this.composer.sender.renderSenderAliasesOptions(this.composer.app.storageGetAddresses()!);
      }
      const footer = this.composer.sender.getFooter();
      await this.composer.quote.addTripleDotQuoteExpandBtn(undefined, undefined, footer);
      this.composer.windowSize.setInputTextHeightManuallyIfNeeded();
    }
    // Firefox needs an iframe to be focused before focusing its content
    BrowserMsg.send.focusFrame(this.urlParams.parentTabId, { frameId: this.urlParams.frameId });
    Catch.setHandledTimeout(() => { // Chrome needs async focus: https://github.com/FlowCrypt/flowcrypt-browser/issues/2056
      this.composer.S.cached(this.urlParams.isReplyBox && this.urlParams.to.length ? 'input_text' : 'input_to').focus();
      // document.getElementById('input_text')!.focus(); // #input_text is in the template
    }, 100);
    this.composer.windowSize.onComposeTableRender();
  }

  private loadRecipientsThenSetTestStateReady = async () => {
    await Promise.all(this.composer.contacts.getRecipients().filter(r => r.evaluating).map(r => r.evaluating));
    $('body').attr('data-test-state', 'ready');  // set as ready so that automated tests can evaluate results
  }

}
