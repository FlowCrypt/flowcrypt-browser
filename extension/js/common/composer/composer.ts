/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch } from '../platform/catch.js';
import { Store, SendAsAlias } from '../platform/store.js';
import { Lang } from '../lang.js';
import { Str, Dict } from '../core/common.js';
import { BrowserMsg } from '../extension.js';
import { Pgp, } from '../core/pgp.js';
import { Api, RecipientType } from '../api/api.js';
import { Ui, BrowserEventErrHandler } from '../browser.js';
import { AttUI, AttLimits } from '../ui/att_ui.js';
import { Settings } from '../settings.js';
import { KeyImportUi } from '../ui/key_import_ui.js';
import { Xss } from '../platform/xss.js';
import { Rules } from '../rules.js';
import { ComposerAppFunctionsInterface } from './interfaces/composer-app-functions.js';
import { ComposerUrlParams, Recipients } from './interfaces/composer-types.js';
import { ComposerDraft } from './composer-draft.js';
import { ComposerQuote } from './composer-quote.js';
import { ComposerContacts } from './composer-contacts.js';
import { ComposerSendBtn } from './composer-send-btn.js';
import { ComposerPwdOrPubkeyContainer } from './composer-pwd-or-pubkey-container.js';

export class Composer {
  private debugId = Str.sloppyRandom();

  public S = Ui.buildJquerySels({
    body: 'body',
    compose_table: 'table#compose',
    header: '#section_header',
    subject: '#section_subject',
    title: 'table#compose th h1',
    input_text: 'div#input_text',
    input_to: '#input_to',
    input_from: '#input_from',
    input_subject: '#input_subject',
    input_password: '#input_password',
    input_intro: '.input_intro',
    recipients_placeholder: '#recipients_placeholder',
    all_cells_except_text: 'table#compose > tbody > tr > :not(.text)',
    add_intro: '.action_add_intro',
    add_their_pubkey: '.add_pubkey',
    intro_container: '.intro_container',
    password_or_pubkey: '#password_or_pubkey_container',
    password_label: '.label_password',
    send_btn_note: '#send_btn_note',
    send_btn_i: '#send_btn i',
    send_btn: '#send_btn',
    send_btn_text: '#send_btn_text',
    toggle_send_options: '#toggle_send_options',
    icon_pubkey: '.icon.action_include_pubkey',
    icon_help: '.action_feedback',
    icon_popout: '.popout img',
    icon_show_prev_msg: '.action_show_prev_msg',
    prompt: 'div#initial_prompt',
    reply_msg_successful: '#reply_message_successful_container',
    replied_body: '.replied_body',
    replied_attachments: '#attachments',
    recipients: 'span.recipients',
    contacts: '#contacts',
    input_addresses_container_outer: '#input_addresses_container',
    input_addresses_container_inner: '#input_addresses_container > div:first',
    recipients_inputs: '#input_addresses_container input',
    attached_files: 'table#compose #fineuploader .qq-upload-list li',
    email_copy_actions: '#input_addresses_container .email-copy-actions',
    cc: '#cc',
    bcc: '#bcc',
    sending_options_container: '#sending-options-container'
  });

  public attach: AttUI;

  private composerQuote: ComposerQuote;
  public composerSendBtn: ComposerSendBtn;
  public composerDraft: ComposerDraft;
  public composerContacts: ComposerContacts;
  public composerPwdOrPubkeyContainer: ComposerPwdOrPubkeyContainer;

  private FULL_WINDOW_CLASS = 'full_window';

  private lastReplyBoxTableHeight = 0;
  private composeWindowIsMinimized = false;
  private composeWindowIsMaximized = false;
  private refBodyHeight?: number;

  public app: ComposerAppFunctionsInterface;
  public urlParams: ComposerUrlParams;
  public canReadEmails: boolean;
  public initialized: Promise<void>;

  constructor(appFunctions: ComposerAppFunctionsInterface, urlParams: ComposerUrlParams) {
    this.attach = new AttUI(() => this.getMaxAttSizeAndOversizeNotice());
    this.app = appFunctions;
    this.urlParams = urlParams;
    this.composerDraft = new ComposerDraft(this);
    this.composerQuote = new ComposerQuote(this);
    this.composerContacts = new ComposerContacts(this);
    this.composerSendBtn = new ComposerSendBtn(this);
    this.composerPwdOrPubkeyContainer = new ComposerPwdOrPubkeyContainer(this);
    this.urlParams.subject = this.urlParams.subject.replace(/^((Re|Fwd): )+/g, '');

    const scopes = this.app.getScopes();
    this.canReadEmails = scopes.read || scopes.modify;

    if (this.app.storageGetHideMsgPassword()) {
      this.S.cached('input_password').attr('type', 'password');
    }
    this.initialized = (async () => {
      await this.initComposeBox();
      this.initActions();
      await this.checkEmailAliases();
    })().catch(Catch.reportErr);
  }

  public debug = (msg: string) => {
    if (this.urlParams.debug) {
      console.log(`[${this.debugId}] ${msg}`);
    }
  }

  public getRecipients = () => this.composerContacts.getRecipients();

  private getMaxAttSizeAndOversizeNotice = async (): Promise<AttLimits> => {
    const subscription = await this.app.storageGetSubscription();
    if (!Rules.relaxSubscriptionRequirements(this.getSender()) && !subscription.active) {
      return {
        sizeMb: 5,
        size: 5 * 1024 * 1024,
        count: 10,
        oversize: async () => {
          let getAdvanced = 'The files are over 5 MB. Advanced users can send files up to 25 MB.';
          if (!subscription.method) {
            getAdvanced += '\n\nTry it free for 30 days.';
          } else if (subscription.method === 'trial') {
            getAdvanced += '\n\nYour trial has expired, please consider supporting our efforts by upgrading.';
          } else if (subscription.method === 'group') {
            getAdvanced += '\n\nGroup billing is due for renewal. Please check with your leadership.';
          } else if (subscription.method === 'stripe') {
            getAdvanced += '\n\nPlease renew your subscription to continue sending large files.';
          } else {
            getAdvanced += '\n\nClick ok to see subscribe options.';
          }
          if (subscription.method === 'group') {
            await Ui.modal.info(getAdvanced);
          } else {
            if (await Ui.modal.confirm(getAdvanced)) {
              BrowserMsg.send.subscribeDialog(this.urlParams.parentTabId, {});
            }
          }
          return;
        },
      };
    } else {
      const allowHugeAtts = ['94658c9c332a11f20b1e45c092e6e98a1e34c953', 'b092dcecf277c9b3502e20c93b9386ec7759443a', '9fbbe6720a6e6c8fc30243dc8ff0a06cbfa4630e'];
      const sizeMb = (subscription.method !== 'trial' && allowHugeAtts.includes(await Pgp.hash.sha1UtfStr(this.urlParams.acctEmail))) ? 200 : 25;
      return {
        sizeMb,
        size: sizeMb * 1024 * 1024,
        count: 10,
        oversize: async (combinedSize: number) => {
          await Ui.modal.warning('Combined attachment size is limited to 25 MB. The last file brings it to ' + Math.ceil(combinedSize / (1024 * 1024)) + ' MB.');
        },
      };
    }
  }

  public getErrHandlers = (couldNotDoWhat: string): BrowserEventErrHandler => {
    return {
      network: async () => await Ui.modal.info(`Could not ${couldNotDoWhat} (network error). Please try again.`),
      authPopup: async () => BrowserMsg.send.notificationShowAuthPopupNeeded(this.urlParams.parentTabId, { acctEmail: this.urlParams.acctEmail }),
      auth: async () => {
        if (await Ui.modal.confirm(`Could not ${couldNotDoWhat}.\nYour FlowCrypt account information is outdated, please review your account settings.`)) {
          BrowserMsg.send.subscribeDialog(this.urlParams.parentTabId, { isAuthErr: true });
        }
      },
      other: async (e: any) => {
        if (e instanceof Error) {
          e.stack = (e.stack || '') + `\n\n[compose action: ${couldNotDoWhat}]`;
        } else if (typeof e === 'object' && e && typeof (e as any).stack === 'undefined') {
          try {
            (e as any).stack = `[compose action: ${couldNotDoWhat}]`;
          } catch (e) {
            // no need
          }
        }
        Catch.reportErr(e);
        await Ui.modal.info(`Could not ${couldNotDoWhat} (unknown error). If this repeats, please contact human@flowcrypt.com.\n\n(${String(e)})`);
      },
    };
  }

  private initActions = () => {
    this.S.cached('icon_pubkey').attr('title', Lang.compose.includePubkeyIconTitle);
    this.S.cached('add_intro').click(Ui.event.handle(target => {
      $(target).css('display', 'none');
      this.S.cached('intro_container').css('display', 'table-row');
      this.S.cached('input_intro').focus();
      this.setInputTextHeightManuallyIfNeeded();
    }, this.getErrHandlers(`add intro`)));
    this.S.cached('icon_help').click(Ui.event.handle(() => this.app.renderHelpDialog(), this.getErrHandlers(`render help dialog`)));
    this.S.cached('input_text').get(0).onpaste = this.inputTextPasteHtmlAsText;
    this.composerDraft.initActions().catch(Catch.reportErr);
    this.S.cached('body').bind({ drop: Ui.event.stop(), dragover: Ui.event.stop() }); // prevents files dropped out of the intended drop area to screw up the page
    $('body').click(event => {
      const target = $(event.target);
      if (this.composeWindowIsMaximized && target.is($('body'))) {
        this.minimizeComposerWindow();
      }
    });
  }

  private inputTextPasteHtmlAsText = (clipboardEvent: ClipboardEvent) => {
    if (!clipboardEvent.clipboardData) {
      return;
    }
    const clipboardHtmlData = clipboardEvent.clipboardData.getData('text/html');
    if (!clipboardHtmlData) {
      return; // if it's text, let the original handlers paste it
    }
    clipboardEvent.preventDefault();
    clipboardEvent.stopPropagation();
    const sanitized = Xss.htmlSanitizeAndStripAllTags(clipboardHtmlData, '<br>');
    // the lines below simulate ctrl+v, but not perfectly (old selected text does not get deleted)
    const selection = window.getSelection();
    if (selection) {
      const r = selection.getRangeAt(0);
      r.insertNode(r.createContextualFragment(sanitized));
    }
  }

  private initComposeBox = async () => {
    if (this.urlParams.isReplyBox) {
      this.S.cached('body').addClass('reply_box');
      this.S.cached('header').remove();
      this.S.cached('subject').remove();
      this.S.cached('contacts').css('top', '39px');
      this.S.cached('compose_table').css({ 'border-bottom': '1px solid #cfcfcf', 'border-top': '1px solid #cfcfcf' });
      this.S.cached('input_text').css('overflow-y', 'hidden');
      if (!this.urlParams.skipClickPrompt && !this.urlParams.draftId) {
        this.S.cached('prompt').css('display', 'block');
      }
    } else {
      this.S.cached('compose_table').css({ 'height': '100%' });
    }
    if (this.urlParams.draftId) {
      await this.composerDraft.initialDraftLoad(this.urlParams.draftId);
      const footer = this.getFooter();
      if (footer) {
        this.composerQuote.setFooter(footer);
      } else {
        this.S.cached('icon_show_prev_msg').remove();
      }
    } else {
      if (this.urlParams.isReplyBox) {
        const recipients: Recipients = { to: this.urlParams.to, cc: this.urlParams.cc, bcc: this.urlParams.bcc };
        this.composerContacts.addRecipients(recipients, false).catch(Catch.reportErr);
        // await this.composerContacts.addRecipientsAndShowPreview(recipients);
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
            this.composerContacts.deleteRecipientsBySendingType(typesToDelete);
            await this.renderReplyMsgComposeTable(method);
          }, this.getErrHandlers(`activate repply box`)));
        }
      }
    }
    if (this.urlParams.isReplyBox) {
      $(document).ready(() => this.resizeComposeBox());
    } else {
      this.S.cached('body').css('overflow', 'hidden'); // do not enable this for replies or automatic resize won't work
      await this.renderComposeTable();
      await this.composerContacts.setEmailsPreview(this.getRecipients());
    }
    this.composerSendBtn.resetSendBtn();
    this.composerSendBtn.popover.render();
    this.loadRecipientsThenSetTestStateReady().catch(Catch.reportErr);
  }

  public extractAsText = (elSel: 'input_text' | 'input_intro', flag: 'SKIP-ADDONS' | undefined = undefined) => {
    let html = this.S.cached(elSel)[0].innerHTML;
    if (elSel === 'input_text' && this.composerQuote.expandingHTMLPart && flag !== 'SKIP-ADDONS') {
      html += `<br /><br />${this.composerQuote.expandingHTMLPart}`;
    }
    return Xss.htmlUnescape(Xss.htmlSanitizeAndStripAllTags(html, '\n')).trim();
  }

  /**
* On Firefox, we have to manage textbox height manually. Only applies to composing new messages
* (else ff will keep expanding body element beyond frame view)
* A decade old firefox bug is the culprit: https://bugzilla.mozilla.org/show_bug.cgi?id=202081
*
* @param updateRefBodyHeight - set to true to take a new snapshot of intended html body height
*/
  public setInputTextHeightManuallyIfNeeded = (updateRefBodyHeight: boolean = false) => {
    if (!this.urlParams.isReplyBox && Catch.browser().name === 'firefox') {
      this.S.cached('input_text').css('height', '0');
      let cellHeightExceptText = 0;
      for (const cell of this.S.cached('all_cells_except_text')) {
        cellHeightExceptText += $(cell).is(':visible') ? ($(cell).parent('tr').height() || 0) + 1 : 0; // add a 1px border height for each table row
      }
      if (updateRefBodyHeight || !this.refBodyHeight) {
        this.refBodyHeight = this.S.cached('body').height() || 605;
      }
      const attListHeight = $("#att_list").height() || 0;
      const inputTextVerticalPadding = parseInt(this.S.cached('input_text').css('padding-top')) + parseInt(this.S.cached('input_text').css('padding-bottom'));
      const iconShowPrevMsgHeight = this.S.cached('icon_show_prev_msg').outerHeight(true) || 0;
      this.S.cached('input_text').css('height', this.refBodyHeight - cellHeightExceptText - attListHeight - inputTextVerticalPadding - iconShowPrevMsgHeight);
    }
  }

  resizeComposeBox = (addExtra: number = 0) => {
    if (this.urlParams.isReplyBox) {
      this.S.cached('input_text').css('max-width', (this.S.cached('body').width()! - 20) + 'px'); // body should always be present
      let minHeight = 0;
      let currentHeight = 0;
      if (this.S.cached('compose_table').is(':visible')) {
        currentHeight = this.S.cached('compose_table').outerHeight() || 0;
        minHeight = 260;
      } else if (this.S.cached('reply_msg_successful').is(':visible')) {
        currentHeight = this.S.cached('reply_msg_successful').outerHeight() || 0;
      } else {
        currentHeight = this.S.cached('prompt').outerHeight() || 0;
      }
      if (currentHeight !== this.lastReplyBoxTableHeight && Math.abs(currentHeight - this.lastReplyBoxTableHeight) > 2) { // more then two pixel difference compared to last time
        this.lastReplyBoxTableHeight = currentHeight;
        BrowserMsg.send.setCss(this.urlParams.parentTabId, { selector: `iframe#${this.urlParams.frameId}`, css: { height: `${(Math.max(minHeight, currentHeight) + addExtra)}px` } });
      }
    } else {
      this.S.cached('input_text').css('max-width', '');
      this.resizeInput();
      this.S.cached('input_text').css('max-width', $('.text_container').width()! - 8 + 'px');
    }
  }

  public renderReplyMsgComposeTable = async (method: 'forward' | 'reply' = 'reply'): Promise<void> => {
    this.S.cached('prompt').css({ display: 'none' });
    this.composerContacts.showHideCcAndBccInputsIfNeeded();
    await this.composerContacts.setEmailsPreview(this.getRecipients());
    await this.renderComposeTable();
    if (this.canReadEmails) {
      this.urlParams.subject = `${(method === 'reply' ? 'Re' : 'Fwd')}: ${this.urlParams.subject}`;
      if (!this.urlParams.draftId) { // if there is a draft, don't attempt to pull quoted content. It's assumed to be already present in the draft
        (async () => { // not awaited because can take a long time & blocks rendering
          const footer = this.getFooter();
          await this.composerQuote.addTripleDotQuoteExpandBtn(this.urlParams.replyMsgId, method, footer);
          if (this.composerQuote.messageToReplyOrForward) {
            const msgId = this.composerQuote.messageToReplyOrForward.headers['message-id'];
            this.composerSendBtn.additionalMsgHeaders['In-Reply-To'] = msgId;
            this.composerSendBtn.additionalMsgHeaders.References = this.composerQuote.messageToReplyOrForward.headers.references + ' ' + msgId;
            if (this.composerQuote.messageToReplyOrForward.isOnlySigned) {
              this.composerSendBtn.popover.toggleItemTick($('.action-toggle-encrypt-sending-option'), 'encrypt', false); // don't encrypt
              this.composerSendBtn.popover.toggleItemTick($('.action-toggle-sign-sending-option'), 'sign', true); // do sign
            }
          }
        })().catch(Catch.reportErr);
      }
    } else {
      Xss.sanitizeRender(this.S.cached('prompt'),
        `${Lang.compose.needReadAccessToReply}<br/><br/><br/>
        <div class="button green auth_settings">${Lang.compose.addMissingPermission}</div><br/><br/>
        Alternatively, <a href="#" class="new_message_button">compose a new secure message</a> to respond.<br/><br/>
      `);
      this.S.cached('prompt').attr('style', 'border:none !important');
      $('.auth_settings').click(() => BrowserMsg.send.bg.settings({ acctEmail: this.urlParams.acctEmail, page: '/chrome/settings/modules/auth_denied.htm' }));
      $('.new_message_button').click(() => BrowserMsg.send.openNewMessage(this.urlParams.parentTabId));
    }
    this.resizeComposeBox();
    if (method === 'forward') {
      this.S.cached('recipients_placeholder').click();
    }
    Catch.setHandledTimeout(() => BrowserMsg.send.scrollToElement(this.urlParams.parentTabId, { selector: `#${this.urlParams.frameId}` }), 300);
  }

  public resizeInput = (inputs?: JQuery<HTMLElement>) => {
    if (!inputs) {
      inputs = this.S.cached('recipients_inputs'); // Resize All Inputs
    }
    inputs.css('width', '100%'); // this indeed seems to effect the line below (noticeable when maximizing / back to default)
    for (const inputElement of inputs) {
      const jqueryElem = $(inputElement);
      const containerWidth = Math.floor(jqueryElem.parent().innerWidth()!);
      let additionalWidth = Math.ceil(Number(jqueryElem.css('padding-left').replace('px', '')) + Number(jqueryElem.css('padding-right').replace('px', '')));
      const minInputWidth = 150;
      let offset = 0;
      if (jqueryElem.next().length) {
        additionalWidth += Math.ceil(jqueryElem.next().outerWidth()!);
      }
      const lastRecipient = jqueryElem.siblings('.recipients').children().last();
      if (lastRecipient.length && lastRecipient.position().left + lastRecipient.outerWidth()! + minInputWidth + additionalWidth < containerWidth) {
        offset = Math.ceil(lastRecipient.position().left + lastRecipient.outerWidth()!);
      }
      jqueryElem.css('width', (containerWidth - offset - additionalWidth - 11) + 'px');
    }
  }

  public getSender = (): string => {
    if (this.S.now('input_from').length) {
      return String(this.S.now('input_from').val());
    }
    if (this.urlParams.from) {
      return this.urlParams.from;
    }
    return this.urlParams.acctEmail;
  }

  private debugFocusEvents = (...selNames: string[]) => {
    for (const selName of selNames) {
      this.S.cached(selName)
        .focusin(e => this.debug(`** ${selName} receiving focus from(${e.relatedTarget ? e.relatedTarget.outerHTML : undefined})`))
        .focusout(e => this.debug(`** ${selName} giving focus to(${e.relatedTarget ? e.relatedTarget.outerHTML : undefined})`));
    }
  }

  private getFocusableEls = () => this.S.cached('compose_table').find('[tabindex]:not([tabindex="-1"]):visible').toArray().sort((a, b) => {
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
    this.debugFocusEvents('input_text', 'send_btn', 'input_to', 'input_subject');
    this.S.cached('compose_table').css('display', 'table');
    this.S.cached('body').keydown(Ui.event.handle((_, e) => {
      if (this.composeWindowIsMinimized) {
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
    this.composerContacts.initActions();
    this.composerSendBtn.initActions();
    this.S.cached('input_to').bind('paste', Ui.event.handle(async (elem, event) => {
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
          this.S.cached('input_to').val(keyUser.email);
          await this.composerContacts.parseRenderRecipients(this.S.cached('input_to'));
        } else {
          await Ui.modal.warning(`The email listed in this public key does not seem valid: ${keyUser}`);
        }
      }
    }));
    this.S.cached('input_text').keyup(() => this.S.cached('send_btn_note').text(''));
    this.S.cached('input_addresses_container_inner').click(Ui.event.handle(() => {
      if (!this.S.cached('input_to').is(':focus')) {
        this.debug(`input_addresses_container_inner.click -> calling input_to.focus() when input_to.val(${this.S.cached('input_to').val()})`);
        this.S.cached('input_to').focus();
      }
    }, this.getErrHandlers(`focus on recipient field`))).children().click(() => false);
    this.attach.initAttDialog('fineuploader', 'fineuploader_button');
    this.attach.setAttAddedCb(async () => {
      this.setInputTextHeightManuallyIfNeeded();
      this.resizeComposeBox();
    });
    this.attach.setAttRemovedCb(() => {
      this.setInputTextHeightManuallyIfNeeded();
      this.resizeComposeBox();
    });
    if (this.urlParams.isReplyBox) {
      if (this.urlParams.to.length) {
        // Firefox will not always respond to initial automatic $input_text.blur()
        // Recipients may be left unrendered, as standard text, with a trailing comma
        await this.composerContacts.parseRenderRecipients(this.S.cached('input_to')); // this will force firefox to render them on load
      }
      this.renderSenderAliasesOptionsToggle();
    } else {
      $('.close_new_message').click(Ui.event.handle(async () => {
        if (!this.composerSendBtn.isSendMessageInProgres() ||
          await Ui.modal.confirm('A message is currently being sent. Closing the compose window may abort sending the message.\nAbort sending?')) {
          this.app.closeMsg();
        }
      }, this.getErrHandlers(`close message`)));
      this.S.cached('header').find('#header_title').click(() => $('.minimize_new_message').click());
      $('.minimize_new_message').click(Ui.event.handle(this.minimizeComposerWindow));
      $('.popout').click(Ui.event.handle(async () => {
        this.S.cached('body').hide(); // Need to hide because it seems laggy on some devices
        await this.toggleFullScreen();
        this.S.cached('body').show();
      }));
      if (this.app.storageGetAddresses()) {
        this.renderSenderAliasesOptions(this.app.storageGetAddresses()!);
      }
      const footer = this.getFooter();
      await this.composerQuote.addTripleDotQuoteExpandBtn(undefined, undefined, footer);
      this.setInputTextHeightManuallyIfNeeded();
    }
    // Firefox needs an iframe to be focused before focusing its content
    BrowserMsg.send.focusFrame(this.urlParams.parentTabId, { frameId: this.urlParams.frameId });
    Catch.setHandledTimeout(() => { // Chrome needs async focus: https://github.com/FlowCrypt/flowcrypt-browser/issues/2056
      this.S.cached(this.urlParams.isReplyBox && this.urlParams.to.length ? 'input_text' : 'input_to').focus();
      // document.getElementById('input_text')!.focus(); // #input_text is in the template
    }, 100);
    Catch.setHandledTimeout(() => { // delay automatic resizing until a second later
      // we use veryslowspree for reply box because hand-resizing the main window will cause too many events
      // we use spree (faster) for new messages because rendering of window buttons on top right depend on it, else visible lag shows
      $(window).resize(Ui.event.prevent(this.urlParams.isReplyBox ? 'veryslowspree' : 'spree', () => this.windowResized().catch(Catch.reportErr)));
      this.S.cached('input_text').keyup(Ui.event.prevent('slowspree', () => this.windowResized().catch(Catch.reportErr)));
    }, 1000);
  }

  private windowResized = async () => {
    this.resizeComposeBox();
    this.setInputTextHeightManuallyIfNeeded(true);
    if (this.S.cached('recipients_placeholder').is(':visible')) {
      await this.composerContacts.setEmailsPreview(this.getRecipients());
    }
  }

  private renderSenderAliasesOptionsToggle() {
    const sendAs = this.app.storageGetAddresses();
    if (sendAs && Object.keys(sendAs).length > 1) {
      const showAliasChevronHtml = '<img tabindex="22" id="show_sender_aliases_options" src="/img/svgs/chevron-left.svg" title="Choose sending address">';
      const inputAddrContainer = this.S.cached('email_copy_actions');
      Xss.sanitizeAppend(inputAddrContainer, showAliasChevronHtml);
      inputAddrContainer.find('#show_sender_aliases_options').click(Ui.event.handle((el) => {
        this.renderSenderAliasesOptions(sendAs);
        el.remove();
      }, this.getErrHandlers(`show sending address options`)));
    }
  }

  private minimizeComposerWindow = () => {
    if (this.composeWindowIsMaximized) {
      this.addOrRemoveFullScreenStyles(this.composeWindowIsMinimized);
    }
    BrowserMsg.send.setCss(this.urlParams.parentTabId, {
      selector: `iframe#${this.urlParams.frameId}, div#new_message`,
      css: { height: this.composeWindowIsMinimized ? '' : this.S.cached('header').css('height') },
    });
    this.composeWindowIsMinimized = !this.composeWindowIsMinimized;
  }

  private renderSenderAliasesOptions(sendAs: Dict<SendAsAlias>) {
    let emailAliases = Object.keys(sendAs);
    const inputAddrContainer = $('.recipients-inputs');
    inputAddrContainer.find('#input_from').remove();
    if (emailAliases.length > 1) {
      inputAddrContainer.addClass('show_send_from');
      Xss.sanitizeAppend(inputAddrContainer, '<select id="input_from" tabindex="1" data-test="input-from"></select>');
      const fmtOpt = (addr: string) => `<option value="${Xss.escape(addr)}" ${this.getSender() === addr ? 'selected' : ''}>${Xss.escape(addr)}</option>`;
      emailAliases = emailAliases.sort((a, b) => {
        return (sendAs[a].isDefault === sendAs[b].isDefault) ? 0 : sendAs[a].isDefault ? -1 : 1;
      });
      Xss.sanitizeAppend(inputAddrContainer.find('#input_from'), emailAliases.map(fmtOpt).join('')).change(() => this.composerContacts.updatePubkeyIcon());
      this.S.now('input_from').change(async () => {
        await this.composerContacts.reEvaluateRecipients(this.getRecipients());
        await this.composerContacts.setEmailsPreview(this.getRecipients());
        this.composerContacts.updatePubkeyIcon();
        this.composerQuote.replaceFooter(this.getFooter());
      });
      if (this.urlParams.isReplyBox) {
        this.resizeComposeBox();
      }
    }
  }

  private async checkEmailAliases() {
    try {
      const refreshResult = await Settings.refreshAcctAliases(this.urlParams.acctEmail);
      if (refreshResult) {
        this.app.updateSendAs(refreshResult.sendAs);
        if (refreshResult.isAliasesChanged || refreshResult.isDefaultEmailChanged) {
          this.renderSenderAliasesOptions(refreshResult.sendAs);
        }
        if (refreshResult.isFooterChanged && !this.urlParams.draftId) {
          const alias = refreshResult.sendAs[this.getSender()];
          if (alias) {
            this.composerQuote.replaceFooter(alias.footer || undefined);
          }
        }
      }
    } catch (e) {
      if (Api.err.isAuthPopupNeeded(e)) {
        BrowserMsg.send.notificationShowAuthPopupNeeded(this.urlParams.parentTabId, { acctEmail: this.urlParams.acctEmail });
      } else if (Api.err.isSignificant(e)) {
        Catch.reportErr(e);
      }
    }
  }

  private toggleFullScreen = async () => {
    if (this.composeWindowIsMinimized) {
      this.minimizeComposerWindow();
    }
    this.addOrRemoveFullScreenStyles(!this.composeWindowIsMaximized);
    if (!this.composeWindowIsMaximized) {
      this.S.cached('icon_popout').attr('src', '/img/svgs/minimize.svg');
    } else {
      this.S.cached('icon_popout').attr('src', '/img/svgs/maximize.svg');
    }
    if (this.S.cached('recipients_placeholder').is(':visible')) {
      await this.composerContacts.setEmailsPreview(this.composerContacts.getRecipients());
    }
    this.composeWindowIsMaximized = !this.composeWindowIsMaximized;
  }

  private addOrRemoveFullScreenStyles = (add: boolean) => {
    if (add) {
      this.S.cached('body').addClass(this.FULL_WINDOW_CLASS);
      BrowserMsg.send.addClass(this.urlParams.parentTabId, { class: this.FULL_WINDOW_CLASS, selector: 'div#new_message' });
    } else {
      this.S.cached('body').removeClass(this.FULL_WINDOW_CLASS);
      BrowserMsg.send.removeClass(this.urlParams.parentTabId, { class: this.FULL_WINDOW_CLASS, selector: 'div#new_message' });
    }
  }

  public isMinimized = () => this.composeWindowIsMinimized;

  public getFooter = () => {
    const addresses = this.app.storageGetAddresses();
    const sender = this.getSender();
    return addresses && addresses[sender] && addresses[sender].footer || undefined;
  }

  private loadRecipientsThenSetTestStateReady = async () => {
    await Promise.all(this.getRecipients().filter(r => r.evaluating).map(r => r.evaluating));
    $('body').attr('data-test-state', 'ready');  // set as ready so that automated tests can evaluate results
  }
}
