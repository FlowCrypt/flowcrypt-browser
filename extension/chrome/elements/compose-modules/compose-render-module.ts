/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Attachment } from '../../../js/common/core/attachment.js';
import { Browser } from '../../../js/common/browser/browser.js';
import { BrowserMsg } from '../../../js/common/browser/browser-msg.js';
import { Catch } from '../../../js/common/platform/catch.js';
import { KeyImportUi } from '../../../js/common/ui/key-import-ui.js';
import { Lang } from '../../../js/common/lang.js';
import { ParsedRecipients, Recipients } from '../../../js/common/api/email-provider/email-provider-api.js';
import { Str } from '../../../js/common/core/common.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { Xss } from '../../../js/common/platform/xss.js';
import { ViewModule } from '../../../js/common/view-module.js';
import { ComposeView } from '../compose.js';
import { ApiErr } from '../../../js/common/api/shared/api-error.js';
import { GmailParser } from '../../../js/common/api/email-provider/gmail/gmail-parser.js';
import { KeyStore } from '../../../js/common/platform/store/key-store.js';
import { KeyStoreUtil } from '../../../js/common/core/crypto/key-store-util.js';
import { ContactStore } from '../../../js/common/platform/store/contact-store.js';
import { KeyUtil } from '../../../js/common/core/crypto/key.js';
import { ReplyOption } from './compose-reply-btn-popover-module.js';

export class ComposeRenderModule extends ViewModule<ComposeView> {
  private responseMethod: 'reply' | 'forward' | undefined;
  private previousReplyOption: ReplyOption | undefined;

  public initComposeBox = async () => {
    if (this.view.useFullScreenSecureCompose) {
      this.view.S.cached('body').addClass('full_window');
      this.view.S.cached('password_or_pubkey').height(1); // fix UI issue in fullscreen
    }
    if (this.view.replyMsgId) {
      this.responseMethod = 'reply';
    }
    await this.view.replyPopoverModule.render(this.view.isReplyBox);
    this.initComposeBoxStyles();
    if (!this.view.draftId && (await this.view.draftModule.localDraftGet())) {
      this.view.draftId = this.view.draftModule.getLocalDraftId();
    }
    if (this.view.draftId) {
      const draftLoaded = await this.view.draftModule.initialDraftLoad();
      if (draftLoaded) {
        this.view.draftModule.startDraftTimer();
        this.view.S.cached('triple_dot').remove(); // if it's draft, footer and quote should already be included in the draft
      }
      if (this.view.replyMsgId) {
        await this.view.renderModule.renderReplyMsgComposeTable();
      }
    } else {
      if (this.view.replyMsgId && this.view.replyParams) {
        const recipients: Recipients = {
          to: this.view.replyParams.to,
          cc: this.view.replyParams.cc,
          bcc: this.view.replyParams.bcc,
        };
        this.view.recipientsModule.addRecipients(recipients, false).catch(Catch.reportErr);

        if (this.view.skipClickPrompt) {
          if (this.view.replyOption === 'a_reply') {
            await this.view.recipientsModule.clearRecipientsForReply();
          } else if (this.view.replyOption === 'a_forward') {
            this.view.recipientsModule.clearRecipients();
          }

          await this.renderReplyMsgComposeTable();
        } else {
          $('#a_reply,#a_reply_all,#a_forward').on(
            'click',
            this.view.setHandler(el => this.actionActivateReplyBoxHandler(el), this.view.errModule.handle(`activate reply box`))
          );
        }
      }
    }
    if (this.view.isReplyBox) {
      $(() => {
        this.view.sizeModule.resizeComposeBox();
      });
    } else {
      this.view.S.cached('body').css('overflow', 'hidden'); // do not enable this for replies or automatic resize won't work
      await this.renderComposeTable();
      this.view.recipientsModule.setEmailsPreview();
    }
    this.view.sendBtnModule.resetSendBtn();
    await this.view.sendBtnModule.popover.render();
    this.loadRecipientsThenSetTestStateReady().catch(Catch.reportErr);
  };

  public renderReplyMsgComposeTable = async (): Promise<void> => {
    this.view.S.cached('prompt').css({ display: 'none' });
    this.view.recipientsModule.showHideCcAndBccInputsIfNeeded();
    // 4498 setEmailsPreview() can't be called here as parent elements width is not yet set up (when called from actionActivateReplyBoxHandler)
    // need to await something first https://stackoverflow.com/a/6132918
    await this.renderComposeTable();
    this.view.recipientsModule.setEmailsPreview();
    if (this.view.replyParams) {
      const thread = await this.view.emailProvider.threadGet(this.view.threadId, 'metadata');
      const inReplyToMessage = thread.messages?.find(message => message.id === this.view.replyMsgId);
      if (inReplyToMessage) {
        const msgId = inReplyToMessage.payload?.headers?.find(header => header.name === 'Message-Id' || header.name === 'Message-ID')?.value;
        const references = inReplyToMessage.payload?.headers?.find(header => header.name === 'References')?.value;
        this.setReplyHeaders(msgId, references);
      }
      this.view.replyParams.subject = `${this.responseMethod === 'reply' ? 'Re' : 'Fwd'}: ${this.view.replyParams.subject}`;
      if (this.view.useFullScreenSecureCompose) {
        this.view.S.cached('input_subject').val(this.view.replyParams.subject);
      }
    }
    if (!this.view.draftModule.wasMsgLoadedFromDraft) {
      // if there is a draft, don't attempt to pull quoted content. It's assumed to be already present in the draft
      (async () => {
        // not awaited because can take a long time & blocks rendering
        await this.view.quoteModule.addTripleDotQuoteExpandFooterAndQuoteBtn(
          this.view.replyMsgId,
          this.responseMethod! // eslint-disable-line @typescript-eslint/no-non-null-assertion
        );
        if (this.view.quoteModule.messageToReplyOrForward) {
          const msgId = this.view.quoteModule.messageToReplyOrForward.headers['message-id'];
          this.setReplyHeaders(msgId, this.view.quoteModule.messageToReplyOrForward.headers.references);
          if (this.view.replyPubkeyMismatch) {
            await this.renderReplyMsgAsReplyPubkeyMismatch();
          } else if (this.view.quoteModule.messageToReplyOrForward.isOnlySigned) {
            this.view.sendBtnModule.popover.toggleItemTick($('.action-toggle-encrypt-sending-option'), 'encrypt', false); // don't encrypt
            this.view.sendBtnModule.popover.toggleItemTick($('.action-toggle-sign-sending-option'), 'sign', true); // do sign
          }
        }
      })().catch(Catch.reportErr);
    }
    this.view.sizeModule.resizeComposeBox();
    if (this.responseMethod === 'forward') {
      this.view.S.cached('recipients_placeholder').trigger('click');
    }
    BrowserMsg.send.scrollToReplyBox(this.view.parentTabId, { replyMsgId: `#${this.view.frameId}` });
  };

  public renderPrompt = () => {
    this.view.S.cached('prompt').css('display', 'block');
    if (this.view.replyParams) {
      const recipientsNumber = this.view.replyParams.to.length + this.view.replyParams.cc.length + this.view.replyParams.bcc.length;
      if (recipientsNumber > 1) {
        $('#a_reply_all').css('display', 'inline-flex');
      } else {
        $('#popover_a_reply_all_option').addClass('hidden');
      }
    }
  };

  public renderReplySuccess = (attachments: Attachment[], recipients: ParsedRecipients, msgId: string) => {
    this.view.renderModule.renderReinsertReplyBox(msgId);
    if (!this.view.sendBtnModule.popover.choices.encrypt) {
      this.view.S.cached('replied_body').removeClass('pgp_secure');
      if (this.view.sendBtnModule.popover.choices.sign) {
        this.view.S.cached('replied_body').addClass('pgp_neutral');
      }
    }
    this.view.S.cached('replied_body').css('width', ($('table#compose').width() || 500) - 30);
    this.view.S.cached('compose_table').css('display', 'none');
    this.view.S.cached('reply_msg_successful').find('div.replied_from').text(this.view.senderModule.getSender());
    this.view.S.cached('reply_msg_successful')
      .find('div.replied_to span')
      .text(Str.formatEmailList(recipients.to || []));
    if (recipients.cc !== undefined && recipients.cc.length > 0) {
      this.view.S.cached('reply_msg_successful').find('div.replied_cc span').text(Str.formatEmailList(recipients.cc));
      $('.replied_cc').show();
    }
    if (recipients.bcc !== undefined && recipients.bcc.length > 0) {
      this.view.S.cached('reply_msg_successful').find('div.replied_bcc span').text(Str.formatEmailList(recipients.bcc));
      $('.replied_bcc').show();
    }
    const repliedBodyEl = this.view.S.cached('reply_msg_successful').find('div.replied_body');
    if (this.view.inputModule.isRichText()) {
      const sanitized = Xss.htmlSanitizeKeepBasicTags(this.view.inputModule.extract('html', 'input_text', 'SKIP-ADDONS'), 'IMG-KEEP');
      Xss.setElementContentDANGEROUSLY(repliedBodyEl.get(0) as Element, sanitized); // xss-sanitized
      this.renderReplySuccessMimeAttachments(this.view.inputModule.extractAttachments());
    } else {
      Xss.sanitizeRender(repliedBodyEl, Str.escapeTextAsRenderableHtml(this.view.inputModule.extract('text', 'input_text', 'SKIP-ADDONS')));
      this.renderReplySuccessAttachments(attachments, msgId, this.view.sendBtnModule.popover.choices.encrypt);
    }
    const t = new Date();
    const time =
      (t.getHours() !== 12 ? t.getHours() % 12 : 12) +
      ':' +
      (t.getMinutes() < 10 ? '0' : '') +
      t.getMinutes() +
      (t.getHours() >= 12 ? ' PM ' : ' AM ') +
      '(0 minutes ago)';
    this.view.S.cached('reply_msg_successful').find('div.replied_time').text(time);
    this.view.S.cached('reply_msg_successful').css('display', 'block');
    this.view.sizeModule.resizeComposeBox();
  };

  public renderReinsertReplyBox = (msgId: string) => {
    BrowserMsg.send.reinsertReplyBox(this.view.parentTabId, { replyMsgId: msgId });
  };

  public renderAddPubkeyDialog = (emails: string[]) => {
    BrowserMsg.send.addPubkeyDialog(this.view.parentTabId, { emails });
  };

  public closeMsg = () => {
    document.querySelector('body')?.setAttribute('data-test-state', 'closed'); // used by automated tests
    if (this.view.isReplyBox) {
      BrowserMsg.send.closeReplyMessage(this.view.parentTabId, { frameId: this.view.frameId });
    } else {
      BrowserMsg.send.closeComposeWindow(this.view.parentTabId, { frameId: this.view.frameId });
    }
  };

  public openSettingsWithDialog = async (settingsModule: string) => {
    await Browser.openSettingsPage('index.htm', this.view.acctEmail, `/chrome/settings/modules/${settingsModule}.htm`);
  };

  public fetchReplyMeta = async (aliases: string[]): Promise<void> => {
    Xss.sanitizePrepend('#new_message', Ui.e('div', { id: 'loader', html: `Loading secure reply box..${Ui.spinner('green')}` }));
    try {
      const gmailMsg = await this.view.emailProvider.msgGet(this.view.replyMsgId, 'metadata');
      this.view.replyParams = GmailParser.determineReplyMeta(this.view.acctEmail, aliases, gmailMsg);
      this.view.threadId = gmailMsg.threadId || '';
    } catch (e) {
      if (ApiErr.isAuthErr(e)) {
        BrowserMsg.send.notificationShowAuthPopupNeeded(this.view.parentTabId, { acctEmail: this.view.acctEmail });
      }
      if (e instanceof Error) {
        e.message = `Cannot get reply data for the message you are replying to.`;
      }
      throw e;
    } finally {
      $('#loader').remove();
    }
  };

  public changeReplyOption = async (option: ReplyOption) => {
    if (!this.view.replyParams) {
      return;
    }
    this.view.recipientsModule.clearRecipients();
    if (option === 'a_forward') {
      await this.view.quoteModule.addTripleDotQuoteExpandFooterAndQuoteBtn(this.view.replyMsgId, 'forward', true);
    } else {
      this.view.recipientsModule.addRecipients(this.view.replyParams, false).catch(Catch.reportErr);
      if (this.previousReplyOption === 'a_forward') {
        this.view.attachmentsModule.attachment.clearAllAttachments();
      }
      if (option === 'a_reply') {
        await this.view.recipientsModule.clearRecipientsForReply();
      }
      Catch.setHandledTimeout(() => {
        // Chrome needs async focus: https://github.com/FlowCrypt/flowcrypt-browser/issues/2056
        document.getElementById('input_text')?.focus(); // jQuery no longer worked as of 3.6.0
      }, 10);
    }
    this.previousReplyOption = option;
  };

  public activateReplyOption = async (replyOption: ReplyOption, fromCompose = false) => {
    this.view.replyPopoverModule.changeOptionImage(replyOption);
    if (replyOption === 'a_forward') {
      this.responseMethod = 'forward';
      if (!fromCompose) {
        this.view.recipientsModule.clearRecipients();
      }
    } else if (replyOption === 'a_reply') {
      await this.view.recipientsModule.clearRecipientsForReply();
    }
    await this.renderReplyMsgComposeTable();
  };

  public actionCloseHandler = async () => {
    if (!this.view.sendBtnModule.isSendMessageInProgres() || (await Ui.modal.confirm(Lang.compose.abortSending))) {
      this.view.renderModule.closeMsg();
    }
  };

  private setReplyHeaders = (msgId?: string, references?: string) => {
    if (msgId) {
      this.view.sendBtnModule.additionalMsgHeaders['In-Reply-To'] = msgId;
      this.view.sendBtnModule.additionalMsgHeaders.References = [references, msgId].filter(Boolean).join(' ');
    }
  };

  private initComposeBoxStyles = () => {
    if (this.view.isReplyBox) {
      this.view.S.cached('body').addClass('reply_box');
      this.view.S.cached('header').remove();
      this.view.S.cached('subject').remove();
      this.view.S.cached('contacts').css('top', '39px');
      this.view.S.cached('compose_table').css({
        'border-bottom': '1px solid #cfcfcf',
        'border-top': '1px solid #cfcfcf',
      });
      this.view.S.cached('input_text').css('overflow-y', 'hidden');
      if (!this.view.skipClickPrompt && !this.view.draftId) {
        this.renderPrompt();
      }
    } else {
      this.view.S.cached('compose_table').css({ height: '100%' });
    }
  };

  private actionActivateReplyBoxHandler = async (target: HTMLElement) => {
    const replyOption = $(target).attr('id') as ReplyOption;
    await this.activateReplyOption(replyOption);
  };

  private renderReplyMsgAsReplyPubkeyMismatch = async () => {
    this.view.inputModule.inputTextHtmlSetSafely(`Hello,
      <br><br>I was not able to read your encrypted message because it was encrypted for a wrong key.
      <br><br>My current public key is attached below. Please update your records and send me a new encrypted message.
      <br><br>Thank you</div>`);
    const prvs = await KeyStoreUtil.parse(await KeyStore.getRequired(this.view.acctEmail));
    // todo - send all valid?
    const mostUsefulPrv = KeyStoreUtil.chooseMostUseful(prvs, 'ONLY-FULLY-USABLE');
    if (!mostUsefulPrv) {
      await Ui.modal.warning(
        'None of your private keys are usable.\n\n' +
          'If you are part of an enterprise deployment, ask your Help Desk\n\n.' +
          'Other users, please check Settings -> Additional settings -> My keys.'
      );
      return;
    }
    const attachment = Attachment.keyinfoAsPubkeyAttachment(mostUsefulPrv.keyInfo);
    this.view.attachmentsModule.attachment.addFile(new File([attachment.getData()], attachment.name));
    this.view.sendBtnModule.popover.toggleItemTick($('.action-toggle-encrypt-sending-option'), 'encrypt', false); // don't encrypt
    this.view.sendBtnModule.popover.toggleItemTick($('.action-toggle-sign-sending-option'), 'sign', false); // don't sign
  };

  private getFocusableEls = () => {
    return this.view.S.cached('compose_table')
      .find('[tabindex]:not([tabindex="-1"]):visible')
      .toArray()
      .sort((a, b) => {
        const tabindexA = parseInt(a.getAttribute('tabindex') || '');
        const tabindexB = parseInt(b.getAttribute('tabindex') || '');
        if (tabindexA > tabindexB) {
          // sort according to tabindex
          return 1;
        } else if (tabindexA < tabindexB) {
          return -1;
        }
        return 0;
      });
  };

  private renderComposeTable = async () => {
    this.view.errModule.debugFocusEvents('input_text', 'send_btn', 'input_to', 'input_subject');
    this.view.S.cached('compose_table').css('display', 'table');
    await this.addComposeTableHandlers();
    await this.view.senderModule.renderSendFromIfMoreThanOneAlias();
    if (this.view.replyMsgId) {
      if (this.view.replyParams?.to.length) {
        // Firefox will not always respond to initial automatic $input_text.blur(): recipients may be left unrendered, as standard text, with a trailing comma
        await this.view.recipientsModule.parseRenderRecipients(this.view.S.cached('input_to')); // this will force firefox to render them on load
      }
    } else {
      this.view.S.cached('title').on('click', () => {
        if (this.view.sizeModule.composeWindowIsMinimized) {
          $('.minimize_compose_window').trigger('click');
        }
      });
      await this.view.quoteModule.addSignatureToInput();
      this.view.sizeModule.setInputTextHeightManuallyIfNeeded(true);
    }
    // Firefox needs an iframe to be focused before focusing its content
    this.view.errModule.debug(`renderComposeTable: focusing this iframe`);
    BrowserMsg.send.focusFrame(this.view.parentTabId, { frameId: this.view.frameId });
    Catch.setHandledTimeout(() => {
      // Chrome needs async focus: https://github.com/FlowCrypt/flowcrypt-browser/issues/2056
      const toCount = this.view.replyParams?.to.length;
      const focusId = this.view.isReplyBox && this.responseMethod !== 'forward' && toCount ? 'input_text' : 'input_to';
      this.view.errModule.debug(
        `renderComposeTable: focusing ${focusId} isReplyBox=${this.view.isReplyBox},responseMethod=${this.responseMethod},toCount=${toCount}`
      );
      document.getElementById(focusId)?.focus(); // jQuery no longer worked as of 3.6.0
    }, 100);
    this.view.sizeModule.onComposeTableRender();
  };

  private addComposeTableHandlers = async () => {
    this.view.S.cached('body').on(
      'keydown',
      this.view.setHandler((el, ev) => {
        this.onBodyKeydownHandler(el, ev);
      })
    );
    this.view.S.cached('input_to').on(
      'paste',
      this.view.setHandler((el, ev) => this.onRecipientPasteHandler(el, ev))
    );
    this.view.inputModule.squire.addEventListener('input', () => this.view.S.cached('send_btn_note').text(''));
    this.view.S.cached('input_addresses_container_inner').on(
      'click',
      this.view.setHandler(() => {
        this.onRecipientsClickHandler();
      }, this.view.errModule.handle(`focus recipients`))
    );
    this.view.S.cached('input_addresses_container_inner')
      .children()
      .on('click', () => false);
    this.view.S.cached('input_subject')
      .on(
        'input',
        this.view.setHandler((el: HTMLInputElement) => {
          this.subjectRTLHandler(el);
        })
      )
      .trigger('input');
  };

  private subjectRTLHandler = (el: HTMLInputElement) => {
    const rtlCheck = new RegExp('^[' + Str.rtlChars + ']');
    if (el.value.match(rtlCheck)) {
      $(el).attr('dir', 'rtl');
    } else {
      $(el).removeAttr('dir');
    }
  };

  private onRecipientsClickHandler = () => {
    if (!this.view.S.cached('input_to').is(':focus')) {
      this.view.errModule.debug(
        `input_addresses_container_inner.click -> calling input_to.trigger('focus') when input_to.val(${this.view.S.cached('input_to').val()})`
      );
      this.view.S.cached('input_to').trigger('focus');
    }
  };

  private onRecipientPasteHandler = async (_: HTMLElement, event: JQuery.TriggeredEvent<HTMLElement>) => {
    if (event.originalEvent instanceof ClipboardEvent && event.originalEvent.clipboardData) {
      const textData = event.originalEvent.clipboardData.getData('text/plain');
      const keyImportUi = new KeyImportUi({ checkEncryption: true });
      let normalizedPub: string;
      try {
        normalizedPub = await keyImportUi.checkPub(textData);
      } catch {
        return; // key is invalid
      }
      const key = await KeyUtil.parse(normalizedPub);
      if (!key.emails.length) {
        // no users is not desired
        await Ui.modal.warning(`There are no email addresses listed in this Public Key - don't know who this key belongs to.`);
        return;
      }
      await ContactStore.update(undefined, key.emails[0], {
        name: Str.parseEmail(key.identities[0]).name,
        pubkey: normalizedPub,
        pubkeyLastCheck: Date.now(),
      });
      this.view.S.cached('input_to').val(key.emails[0]);
      await this.view.recipientsModule.parseRenderRecipients(this.view.S.cached('input_to'));
    }
  };

  private onBodyKeydownHandler = (_: HTMLElement, e: JQuery.TriggeredEvent<HTMLElement>) => {
    if (this.view.sizeModule.composeWindowIsMinimized) {
      e.preventDefault();
      return;
    }
    Ui.escape(() => !this.view.isReplyBox && $('.close_compose_window').trigger('click'))(e);
    const focusableEls = this.getFocusableEls();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const focusIndex = focusableEls.indexOf(e.target);
    if (focusIndex !== -1) {
      // Focus trap (Tab, Shift+Tab)
      Ui.tab(e => {
        // rollover to first item or focus next
        focusableEls[focusIndex === focusableEls.length - 1 ? 0 : focusIndex + 1].focus();
        e.preventDefault();
      })(e);
      Ui.shiftTab(e => {
        // rollover to last item or focus prev
        focusableEls[focusIndex === 0 ? focusableEls.length - 1 : focusIndex - 1].focus();
        e.preventDefault();
      })(e);
    }
  };

  private loadRecipientsThenSetTestStateReady = async () => {
    await Promise.all(
      this.view.recipientsModule
        .getRecipients()
        .filter(r => r.evaluating)
        .map(r => r.evaluating)
    );
    document.querySelector('body')?.setAttribute('data-test-state', 'ready'); // set as ready so that automated tests can evaluate results
  };

  private renderReplySuccessAttachments = (attachments: Attachment[], msgId: string, isEncrypted: boolean) => {
    const hideAttachmentTypes = this.view.sendBtnModule.popover.choices.richtext ? ['hidden', 'encryptedMsg', 'signature', 'publicKey'] : ['publicKey'];
    const renderableAttachments = attachments.filter(attachment => !hideAttachmentTypes.includes(attachment.treatAs(attachments)));
    if (renderableAttachments.length) {
      this.view.S.cached('replied_attachments')
        .html(
          renderableAttachments
            .map(attachment => {
              // xss-safe-factory
              attachment.msgId = msgId;
              return this.view.factory.embeddedAttachment(attachment, isEncrypted, this.view.parentTabId);
            })
            .join('')
        )
        .css('display', 'block');
    }
  };

  private renderReplySuccessMimeAttachments = (attachmentsFilenames: string[]) => {
    const attachments = $('<div id="attachments"></div>');
    for (const [index, filename] of attachmentsFilenames.entries()) {
      if (attachmentsFilenames.hasOwnProperty(index)) {
        const escapedFilename = Xss.escape(filename);
        attachments.append(`<button class="attachment" index="${index}" title="${escapedFilename}"><b>${escapedFilename}</b></button>`); // xss-escaped
      }
    }
    this.view.S.cached('replied_body').append(attachments); // xss-escaped
  };
}
