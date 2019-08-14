/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch, UnreportableError } from './platform/catch.js';
import { Store, Subscription } from './platform/store.js';
import { Lang } from './lang.js';
import { Value, Str } from './core/common.js';
import { Att } from './core/att.js';
import { BrowserMsg, Extension, BrowserWidnow } from './extension.js';
import { Pgp, Pwd, PgpMsg } from './core/pgp.js';
import { Api } from './api/api.js';
import { Ui, BrowserEventErrHandler, Env } from './browser.js';
import { SendableMsgBody } from './core/mime.js';
import { GmailRes, Google } from './api/google.js';
import { Buf } from './core/buf.js';
import { Backend, AwsS3UploadItem, BackendRes } from './api/backend.js';
import { SendableMsg } from './api/email_provider_api.js';
import { AttUI, AttLimits } from './ui/att_ui.js';
import { Settings } from './settings.js';
import { KeyImportUi } from './ui/key_import_ui.js';
import { Xss } from './platform/xss.js';
import { Rules } from './rules.js';
import { ComposerAppFunctionsInterface } from './composer/interfaces/composer-app-functions.js';
import { ComposerUrlParams } from './composer/interfaces/composer-types.js';
import { ComposerDraft } from './composer/composer-draft.js';
import { ComposerQuote } from './composer/composer-quote.js';
import { ComposerContacts } from './composer/composer-contacts.js';
import { ComposerNotReadyError, ComposerUserError, ComposerResetBtnTrigger } from './composer/interfaces/composer-errors.js';

declare const openpgp: typeof OpenPGP;

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
    input_to_container: '#input-to-container',
    input_from: '#input_from',
    input_subject: '#input_subject',
    input_password: '#input_password',
    input_intro: '.input_intro',
    all_cells_except_text: 'table#compose > tbody > tr > :not(.text)',
    add_intro: '.action_add_intro',
    add_their_pubkey: '.add_pubkey',
    intro_container: '.intro_container',
    password_or_pubkey: '#password_or_pubkey_container',
    password_label: '.label_password',
    send_btn_note: '#send_btn_note',
    send_btn_span: '#send_btn span',
    send_btn_i: '#send_btn i',
    send_btn: '#send_btn',
    icon_pubkey: '.icon.action_include_pubkey',
    icon_footer: '.icon.action_include_footer',
    icon_help: '.action_feedback',
    icon_sign: '.icon.action_sign',
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
    attached_files: 'table#compose #fineuploader .qq-upload-list li'
  });

  private attach: AttUI;
  private app: ComposerAppFunctionsInterface;
  private composerDraft: ComposerDraft;
  private composerQuote: ComposerQuote;
  private composerContacts: ComposerContacts;

  private BTN_ENCRYPT_AND_SEND = 'Encrypt and Send';
  private BTN_SIGN_AND_SEND = 'Sign and Send';
  private BTN_READY_TEXTS = [this.BTN_ENCRYPT_AND_SEND, this.BTN_SIGN_AND_SEND];
  private BTN_WRONG_ENTRY = 'Re-enter recipient..';
  private BTN_SENDING = 'Sending..';
  private FC_WEB_URL = 'https://flowcrypt.com'; // todo - should use Api.url()
  private FULL_WINDOW_CLASS = 'full_window';

  private lastReplyBoxTableHeight = 0;
  private composeWindowIsMinimized = false;
  private composeWindowIsMaximized = false;
  private additionalMsgHeaders: { [key: string]: string } = {};
  private btnUpdateTimeout?: number;
  private refBodyHeight?: number;
  private urlParams: ComposerUrlParams;

  private isSendMessageInProgress = false;

  public canReadEmails: boolean;
  public initialized: Promise<void>;

  constructor(appFunctions: ComposerAppFunctionsInterface, urlParams: ComposerUrlParams, initSubs: Subscription) {
    this.attach = new AttUI(() => this.getMaxAttSizeAndOversizeNotice());
    this.app = appFunctions;
    this.urlParams = urlParams;
    this.composerDraft = new ComposerDraft(appFunctions, urlParams, this);
    this.composerQuote = new ComposerQuote(this, urlParams);
    this.composerContacts = new ComposerContacts(appFunctions, urlParams, openpgp, this);
    this.urlParams.subject = this.urlParams.subject.replace(/^((Re|Fwd): )+/g, '');
    this.canReadEmails = this.app.canReadEmails();
    if (initSubs.active) {
      this.updateFooterIcon();
    } else if (this.app.storageEmailFooterGet()) { // footer set but subscription not active - subscription expired
      this.app.storageEmailFooterSet(undefined).catch(Catch.reportErr);
      const notification = `${Lang.account.fcSubscriptionEndedNoFooter} <a href="#" class="subscribe">renew</a> <a href="#" class="close">close</a>`;
      BrowserMsg.send.notificationShow(this.urlParams.parentTabId, { notification });
    }
    if (this.app.storageGetHideMsgPassword()) {
      this.S.cached('input_password').attr('type', 'password');
    }
    this.initialized = (async () => {
      await this.initComposeBox();
      await this.initActions();
      await this.checkEmailAliases();
    })(); // this is awaited later. Otherwise normally we would have added .catch here
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
    this.S.cached('input_password').keyup(Ui.event.prevent('spree', () => this.showHidePwdOrPubkeyContainerAndColorSendBtn()));
    this.S.cached('input_password').focus(() => this.showHidePwdOrPubkeyContainerAndColorSendBtn());
    this.S.cached('input_password').blur(() => this.showHidePwdOrPubkeyContainerAndColorSendBtn());
    this.S.cached('add_intro').click(Ui.event.handle(target => {
      $(target).css('display', 'none');
      this.S.cached('intro_container').css('display', 'table-row');
      this.S.cached('input_intro').focus();
      this.setInputTextHeightManuallyIfNeeded();
    }, this.getErrHandlers(`add intro`)));
    this.S.cached('icon_help').click(Ui.event.handle(() => this.app.renderHelpDialog(), this.getErrHandlers(`render help dialog`)));
    this.S.now('input_from').change(() => {
      // when I change input_from, I should completely re-evaluate: update_pubkey_icon() and render_pubkey_result()
      // because they might not have a pubkey for the alternative address, and might get confused
    });
    this.S.cached('input_text').get(0).onpaste = this.inputTextPasteHtmlAsText;
    this.S.cached('icon_footer').click(Ui.event.handle(target => {
      if (!$(target).is('.active')) {
        this.app.renderFooterDialog();
      } else {
        this.updateFooterIcon(!$(target).is('.active'));
      }
    }, this.getErrHandlers(`change footer`)));
    this.composerDraft.initActions().catch(Catch.reportErr);
    this.S.cached('body').bind({ drop: Ui.event.stop(), dragover: Ui.event.stop() }); // prevents files dropped out of the intended drop area to screw up the page
    this.S.cached('icon_sign').click(Ui.event.handle(() => this.toggleSignIcon(), this.getErrHandlers(`enable/disable signing`)));
    $("body").click(event => {
      const target = $(event.target);
      if (this.composeWindowIsMaximized && (!target.closest(".container").length)) {
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
      const isSuccessfulyLoaded = await this.composerDraft.initialDraftLoad();
      if (isSuccessfulyLoaded) {
        await this.composerContacts.parseRenderRecipients(this.S.cached('input_to_container'), true);
      }
    } else {
      if (this.urlParams.isReplyBox) {
        if (this.urlParams.skipClickPrompt) {
          await this.renderReplyMsgComposeTable();
        } else {
          $('#reply_click_area,#a_reply,#a_reply_all,#a_forward').click(Ui.event.handle(async target => {
            if ($(target).attr('id') === 'a_reply') {
              this.urlParams.to = [this.urlParams.to[0]];
            } else if ($(target).attr('id') === 'a_forward') {
              this.urlParams.to = [];
            }
            await this.renderReplyMsgComposeTable((($(target).attr('id') || '').replace('a_', '') || 'reply') as 'reply' | 'forward');
          }, this.getErrHandlers(`activate repply box`)));
        }
      }
    }
    if (this.urlParams.isReplyBox) {
      $(document).ready(() => this.resizeComposeBox());
    } else {
      this.S.cached('body').css('overflow', 'hidden'); // do not enable this for replies or automatic resize won't work
      await this.renderComposeTable();
    }
    $('body').attr('data-test-state', 'ready');  // set as ready so that automated tests can evaluate results
  }

  public resetSendBtn = (delay?: number) => {
    const btnText = this.S.cached('icon_sign').is('.active') ? this.BTN_SIGN_AND_SEND : this.BTN_ENCRYPT_AND_SEND;
    const doReset = () => Xss.sanitizeRender(this.S.cached('send_btn'), `<i class=""></i><span tabindex="4">${btnText}</span>`);
    if (typeof this.btnUpdateTimeout !== 'undefined') {
      clearTimeout(this.btnUpdateTimeout);
    }
    if (!delay) {
      doReset();
    } else {
      Catch.setHandledTimeout(doReset, delay);
    }
  }

  private throwIfFormNotReady = async (recipients: string[]): Promise<void> => {
    if (String(this.S.cached('input_to').val()).length) { // evaluate any recipient errors earlier treated as gentle
      await this.composerContacts.parseRenderRecipients(this.S.cached('input_to_container'));
    }
    if (this.S.cached('icon_show_prev_msg').hasClass('progress')) {
      throw new ComposerNotReadyError('Retrieving previous message, please wait.');
    }
    if (this.BTN_READY_TEXTS.includes(this.S.now('send_btn_span').text().trim()) && recipients.length) {
      return; // all good
    }
    if (this.S.now('send_btn_span').text().trim() === this.BTN_WRONG_ENTRY) {
      throw new ComposerUserError('Please re-enter recipients marked in red color.');
    }
    if (!recipients || !recipients.length) {
      throw new ComposerUserError('Please add a recipient first');
    }
    throw new ComposerNotReadyError('Still working, please wait.');
  }

  private throwIfFormValsInvalid = async (recipients: string[], emailsWithoutPubkeys: string[], subject: string, plaintext: string, challenge?: Pwd) => {
    const shouldEncrypt = !this.S.cached('icon_sign').is('.active');
    if (!recipients.length) {
      throw new ComposerUserError('Please add receiving email address.');
    }
    if (shouldEncrypt && emailsWithoutPubkeys.length && (!challenge || !challenge.answer)) {
      this.S.cached('input_password').focus();
      throw new ComposerUserError('Some recipients don\'t have encryption set up. Please add a password.');
    }
    if (!((plaintext !== '' || await Ui.modal.confirm('Send empty message?')) && (subject !== '' || await Ui.modal.confirm('Send without a subject?')))) {
      throw new ComposerResetBtnTrigger();
    }
  }

  private handleSendErr = async (e: any) => {
    if (Api.err.isNetErr(e)) {
      await Ui.modal.error('Could not send message due to network error. Please check your internet connection and try again.');
    } else if (Api.err.isAuthPopupNeeded(e)) {
      BrowserMsg.send.notificationShowAuthPopupNeeded(this.urlParams.parentTabId, { acctEmail: this.urlParams.acctEmail });
      await Ui.modal.error('Could not send message because FlowCrypt needs to be re-connected to google account.');
    } else if (Api.err.isAuthErr(e)) {
      if (await Ui.modal.confirm('Your FlowCrypt account information is outdated, please review your account settings.')) {
        BrowserMsg.send.subscribeDialog(this.urlParams.parentTabId, { isAuthErr: true });
      }
    } else if (Api.err.isReqTooLarge(e)) {
      await Ui.modal.error(`Could not send: message or attachments too large.`);
    } else if (Api.err.isBadReq(e)) {
      const errMsg = e.parseErrResMsg('google');
      if (errMsg === e.STD_ERR_MSGS.GOOGLE_INVALID_TO_HEADER || errMsg === e.STD_ERR_MSGS.GOOGLE_RECIPIENT_ADDRESS_REQUIRED) {
        await Ui.modal.error('Error from google: Invalid recipients\n\nPlease remove recipients, add them back and re-send the message.');
      } else {
        if (await Ui.modal.confirm(`Google returned an error when sending message. Please help us improve FlowCrypt by reporting the error to us.`)) {
          const page = '/chrome/settings/modules/help.htm';
          const pageUrlParams = { bugReport: Extension.prepareBugReport(`composer: send: bad request (errMsg: ${errMsg})`, {}, e) };
          BrowserMsg.send.bg.settings({ acctEmail: this.urlParams.acctEmail, page, pageUrlParams });
        }
      }
    } else if (e instanceof ComposerUserError) {
      await Ui.modal.error(`Could not send message: ${String(e)}`);
    } else {
      if (!(e instanceof ComposerResetBtnTrigger || e instanceof UnreportableError || e instanceof ComposerNotReadyError)) {
        Catch.reportErr(e);
        await Ui.modal.error(`Failed to send message due to: ${String(e)}`);
      }
    }
    if (!(e instanceof ComposerNotReadyError)) {
      this.resetSendBtn(100);
    }
  }

  public extractAsText = (elSel: 'input_text' | 'input_intro', flag: 'SKIP-ADDONS' | undefined = undefined) => {
    let html = this.S.cached(elSel)[0].innerHTML;
    if (elSel === 'input_text' && this.composerQuote.expandingHTMLPart && flag !== 'SKIP-ADDONS') {
      html += `<br /><br />${this.composerQuote.expandingHTMLPart}`;
    }
    return Xss.htmlUnescape(Xss.htmlSanitizeAndStripAllTags(html, '\n')).trim();
  }

  private extractProcessSendMsg = async () => {
    try {
      const recipients = this.getRecipients().map(r => r.email);
      const subject = this.urlParams.subject || ($('#input_subject').val() === undefined ? '' : String($('#input_subject').val())); // replies have subject in url params
      const plaintext = this.extractAsText('input_text');
      await this.throwIfFormNotReady(recipients);
      this.S.now('send_btn_span').text('Loading');
      Xss.sanitizeRender(this.S.now('send_btn_i'), Ui.spinner('white'));
      this.S.cached('send_btn_note').text('');
      const subscription = await this.app.storageGetSubscription();
      const { armoredPubkeys, emailsWithoutPubkeys } = await this.app.collectAllAvailablePublicKeys(this.urlParams.acctEmail, recipients);
      const pwd = emailsWithoutPubkeys.length ? { answer: String(this.S.cached('input_password').val()) } : undefined;
      await this.throwIfFormValsInvalid(recipients, emailsWithoutPubkeys, subject, plaintext, pwd);
      if (this.S.cached('icon_sign').is('.active')) {
        await this.signSend(recipients, subject, plaintext);
      } else {
        await this.encryptSend(recipients, armoredPubkeys, subject, plaintext, pwd, subscription);
      }
    } catch (e) {
      await this.handleSendErr(e);
    }
  }

  private encryptSend = async (recipients: string[], armoredPubkeys: string[], subject: string, plaintext: string, pwd: Pwd | undefined, subscription: Subscription) => {
    this.S.now('send_btn_span').text('Encrypting');
    plaintext = await this.addReplyTokenToMsgBodyIfNeeded(recipients, subject, plaintext, pwd, subscription);
    const atts = await this.attach.collectEncryptAtts(armoredPubkeys, pwd);
    if (atts.length && pwd) { // these will be password encrypted attachments
      this.btnUpdateTimeout = Catch.setHandledTimeout(() => this.S.now('send_btn_span').text(this.BTN_SENDING), 500);
      const attAdminCodes = await this.uploadAttsToFc(atts, subscription);
      plaintext = this.addUploadedFileLinksToMsgBody(plaintext, atts);
      await this.doEncryptFmtSend(armoredPubkeys, pwd, plaintext, [], recipients, subject, subscription, attAdminCodes);
    } else {
      await this.doEncryptFmtSend(armoredPubkeys, pwd, plaintext, atts, recipients, subject, subscription);
    }
  }

  private signSend = async (recipients: string[], subject: string, plaintext: string) => {
    this.S.now('send_btn_span').text('Signing');
    const [primaryKi] = await Store.keysGet(this.urlParams.acctEmail, ['primary']);
    if (primaryKi) {
      const { keys: [prv] } = await openpgp.key.readArmored(primaryKi.private);
      const passphrase = await this.app.storagePassphraseGet();
      if (typeof passphrase === 'undefined' && !prv.isDecrypted()) {
        BrowserMsg.send.passphraseDialog(this.urlParams.parentTabId, { type: 'sign', longids: ['primary'] });
        if ((typeof await this.app.whenMasterPassphraseEntered(60)) !== 'undefined') { // pass phrase entered
          await this.signSend(recipients, subject, plaintext);
        } else { // timeout - reset - no passphrase entered
          this.resetSendBtn();
        }
      } else {
        // Folding the lines or GMAIL WILL RAPE THE TEXT, regardless of what encoding is used
        // https://mathiasbynens.be/notes/gmail-plain-text applies to API as well
        // resulting in.. wait for it.. signatures that don't match
        // if you are reading this and have ideas about better solutions which:
        //  - don't involve text/html ( Enigmail refuses to fix: https://sourceforge.net/p/enigmail/bugs/218/ - Patrick Brunschwig - 2017-02-12 )
        //  - don't require text to be sent as an attachment
        //  - don't require all other clients to support PGP/MIME
        // then please const me know. Eagerly waiting! In the meanwhile..
        plaintext = (window as BrowserWidnow)['emailjs-mime-codec'].foldLines(plaintext, 76, true); // tslint:disable-line:no-unsafe-any
        // Gmail will also remove trailing spaces on the end of each line in transit, causing signatures that don't match
        // Removing them here will prevent Gmail from screwing up the signature
        plaintext = plaintext.split('\n').map(l => l.replace(/\s+$/g, '')).join('\n').trim();
        if (!prv.isDecrypted()) {
          await Pgp.key.decrypt(prv, [passphrase!]); // checked !== undefined above
        }
        const signedData = await PgpMsg.sign(prv, this.formatEmailTextFooter({ 'text/plain': plaintext })['text/plain'] || '');
        const atts = await this.attach.collectAtts(); // todo - not signing attachments
        this.app.storageContactUpdate(recipients, { last_use: Date.now() }).catch(Catch.reportErr);
        this.S.now('send_btn_span').text(this.BTN_SENDING);
        const body = { 'text/plain': signedData };
        await this.doSendMsg(await Google.createMsgObj(this.urlParams.acctEmail, this.getSender(), recipients, subject, body, atts, this.urlParams.threadId));
      }
    } else {
      await Ui.modal.error('Cannot sign the message because your plugin is not correctly set up. Email human@flowcrypt.com if this persists.');
      this.resetSendBtn();
    }
  }

  private uploadAttsToFc = async (atts: Att[], subscription: Subscription): Promise<string[]> => {
    const pfRes: BackendRes.FcMsgPresignFiles = await Backend.messagePresignFiles(atts, subscription.active ? 'uuid' : undefined);
    const items: AwsS3UploadItem[] = [];
    for (const i of pfRes.approvals.keys()) {
      items.push({ baseUrl: pfRes.approvals[i].base_url, fields: pfRes.approvals[i].fields, att: atts[i] });
    }
    await Backend.s3Upload(items, this.renderUploadProgress);
    const { admin_codes, confirmed } = await Backend.messageConfirmFiles(items.map(item => item.fields.key));
    if (!confirmed || confirmed.length !== items.length) {
      throw new Error('Attachments did not upload properly, please try again');
    }
    for (const i of atts.keys()) {
      atts[i].url = pfRes.approvals[i].base_url + pfRes.approvals[i].fields.key;
    }
    return admin_codes;
  }

  private renderUploadProgress = (progress: number) => {
    if (this.attach.hasAtt()) {
      progress = Math.floor(progress);
      this.S.now('send_btn_span').text(`${this.BTN_SENDING} ${progress < 100 ? `${progress}%` : ''}`);
    }
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

  private addReplyTokenToMsgBodyIfNeeded = async (recipients: string[], subject: string, plaintext: string, challenge: Pwd | undefined, subscription: Subscription): Promise<string> => {
    if (!challenge || !subscription.active) {
      return plaintext;
    }
    let response;
    try {
      response = await Backend.messageToken();
    } catch (msgTokenErr) {
      if (Api.err.isAuthErr(msgTokenErr)) {
        if (await Ui.modal.confirm('Your FlowCrypt account information is outdated, please review your account settings.')) {
          BrowserMsg.send.subscribeDialog(this.urlParams.parentTabId, { isAuthErr: true });
        }
        throw new ComposerResetBtnTrigger();
      } else if (Api.err.isStandardErr(msgTokenErr, 'subscription')) {
        return plaintext;
      } else {
        throw Catch.rewrapErr(msgTokenErr, 'There was a token error sending this message. Please try again. Let us know at human@flowcrypt.com if this happens repeatedly.');
      }
    }
    return plaintext + '\n\n' + Ui.e('div', {
      'style': 'display: none;', 'class': 'cryptup_reply', 'cryptup-data': Str.htmlAttrEncode({
        sender: this.getSender(),
        recipient: Value.arr.withoutVal(Value.arr.withoutVal(recipients, this.getSender()), this.urlParams.acctEmail),
        subject,
        token: response.token,
      })
    });
  }

  private encryptMsgAsOfDateIfSomeAreExpired = async (armoredPubkeys: string[]): Promise<Date | undefined> => {
    // todo - disallow in certain situations
    const usableUntil: number[] = [];
    const usableFrom: number[] = [];
    for (const armoredPubkey of armoredPubkeys) {
      const { keys: [pub] } = await openpgp.key.readArmored(armoredPubkey);
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

  private doEncryptFmtSend = async (pubkeys: string[], pwd: Pwd | undefined, text: string, atts: Att[], to: string[], subj: string, subs: Subscription, attAdminCodes: string[] = []) => {
    const encryptAsOfDate = await this.encryptMsgAsOfDateIfSomeAreExpired(pubkeys);
    const encrypted = await PgpMsg.encrypt({ pubkeys, pwd, data: Buf.fromUtfStr(text), armor: true, date: encryptAsOfDate }) as OpenPGP.EncryptArmorResult;
    let encryptedBody: SendableMsgBody = { 'text/plain': encrypted.data };
    await this.app.storageContactUpdate(to, { last_use: Date.now() });
    this.S.now('send_btn_span').text(this.BTN_SENDING);
    if (pwd) {
      // this is used when sending encrypted messages to people without encryption plugin, the encrypted data goes through FlowCrypt and recipients get a link
      // admin_code stays locally and helps the sender extend life of the message or delete it
      const { short, admin_code } = await Backend.messageUpload(encryptedBody['text/plain']!, subs.active ? 'uuid' : undefined);
      const storage = await Store.getAcct(this.urlParams.acctEmail, ['outgoing_language']);
      encryptedBody = this.fmtPwdProtectedEmail(short, encryptedBody, pubkeys, atts, storage.outgoing_language || 'EN');
      encryptedBody = this.formatEmailTextFooter(encryptedBody);
      await this.app.storageAddAdminCodes(short, admin_code, attAdminCodes);
      await this.doSendMsg(await Google.createMsgObj(this.urlParams.acctEmail, this.getSender(), to, subj, encryptedBody, atts, this.urlParams.threadId));
    } else {
      encryptedBody = this.formatEmailTextFooter(encryptedBody);
      await this.doSendMsg(await Google.createMsgObj(this.urlParams.acctEmail, this.getSender(), to, subj, encryptedBody, atts, this.urlParams.threadId));
    }
  }

  private doSendMsg = async (msg: SendableMsg) => {
    for (const k of Object.keys(this.additionalMsgHeaders)) {
      msg.headers[k] = this.additionalMsgHeaders[k];
    }
    for (const a of msg.atts) {
      a.type = 'application/octet-stream'; // so that Enigmail+Thunderbird does not attempt to display without decrypting
    }
    if (this.S.cached('icon_pubkey').is('.active')) {
      msg.atts.push(Att.keyinfoAsPubkeyAtt(await this.app.storageGetKey(this.urlParams.acctEmail)));
    }
    await this.addNamesToMsg(msg);
    let msgSentRes: GmailRes.GmailMsgSend;
    try {
      this.isSendMessageInProgress = true;
      msgSentRes = await this.app.emailProviderMsgSend(msg, this.renderUploadProgress);
    } catch (e) {
      if (msg.thread && Api.err.isNotFound(e) && this.urlParams.threadId) { // cannot send msg because threadId not found - eg user since deleted it
        msg.thread = undefined;
        msgSentRes = await this.app.emailProviderMsgSend(msg, this.renderUploadProgress);
      } else {
        this.isSendMessageInProgress = false;
        throw e;
      }
    }
    const isSigned = this.S.cached('icon_sign').is('.active');
    BrowserMsg.send.notificationShow(this.urlParams.parentTabId, {
      notification: `Your ${isSigned ? 'signed' : 'encrypted'} ${this.urlParams.isReplyBox ? 'reply' : 'message'} has been sent.`
    });
    await this.composerDraft.draftDelete();
    this.isSendMessageInProgress = false;
    if (this.urlParams.isReplyBox) {
      this.renderReplySuccess(msg, msgSentRes.id);
    } else {
      this.app.closeMsg();
    }
  }

  private getPwdValidationWarning = () => {
    if (!this.S.cached('input_password').val()) {
      return 'No password entered';
    }
    return;
  }

  private showMsgPwdUiAndColorBtn = () => {
    this.S.cached('password_or_pubkey').css('display', 'table-row');
    this.S.cached('password_or_pubkey').css('display', 'table-row');
    if (this.S.cached('input_password').val() || this.S.cached('input_password').is(':focus')) {
      this.S.cached('password_label').css('display', 'inline-block');
      this.S.cached('input_password').attr('placeholder', '');
    } else {
      this.S.cached('password_label').css('display', 'none');
      this.S.cached('input_password').attr('placeholder', 'one time password');
    }
    if (this.getPwdValidationWarning()) {
      this.S.cached('send_btn').removeClass('green').addClass('gray');
    } else {
      this.S.cached('send_btn').removeClass('gray').addClass('green');
    }
    if (this.S.cached('input_intro').is(':visible')) {
      this.S.cached('add_intro').css('display', 'none');
    } else {
      this.S.cached('add_intro').css('display', 'block');
    }
    this.setInputTextHeightManuallyIfNeeded();
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
      this.S.cached('input_text').css('height', this.refBodyHeight - cellHeightExceptText - attListHeight - inputTextVerticalPadding);
    }
  }

  private hideMsgPwdUi = () => {
    this.S.cached('password_or_pubkey').css('display', 'none');
    this.S.cached('input_password').val('');
    this.S.cached('add_intro').css('display', 'none');
    this.S.cached('input_intro').text('');
    this.S.cached('intro_container').css('display', 'none');
    this.setInputTextHeightManuallyIfNeeded();
  }

  public showHidePwdOrPubkeyContainerAndColorSendBtn = () => {
    this.resetSendBtn();
    this.S.cached('send_btn_note').text('');
    this.S.cached('send_btn').removeAttr('title');
    const wasPreviouslyVisible = this.S.cached('password_or_pubkey').css('display') === 'table-row';
    if (!$('.recipients span').length || this.S.cached('icon_sign').is('.active')) { // Hide 'Add Pasword' prompt if there are no recipients or message is signed.
      this.hideMsgPwdUi();
      this.S.cached('send_btn').removeClass('gray').addClass('green');
    } else if ($('.recipients span.no_pgp').length) {
      this.showMsgPwdUiAndColorBtn();
    } else if ($('.recipients span.failed, .recipients span.wrong').length) {
      this.S.now('send_btn_span').text(this.BTN_WRONG_ENTRY);
      this.S.cached('send_btn').attr('title', 'Notice the recipients marked in red: please remove them and try to enter them egain.');
      this.S.cached('send_btn').removeClass('green').addClass('gray');
    } else {
      this.hideMsgPwdUi();
      this.S.cached('send_btn').removeClass('gray').addClass('green');
    }
    if (this.urlParams.isReplyBox) {
      if (!wasPreviouslyVisible && this.S.cached('password_or_pubkey').css('display') === 'table-row') {
        this.resizeComposeBox((this.S.cached('password_or_pubkey').first().height() || 66) + 20);
      } else {
        this.resizeComposeBox();
      }
    }
    this.setInputTextHeightManuallyIfNeeded();
  }

  private respondToInputHotkeys = (inputToKeydownEvent: JQuery.Event<HTMLElement, null>) => {
    this.debug(`respondToInputHotkeys`);
    const value = this.S.cached('input_to').val();
    this.debug(`respondToInputHotkeys.value(${value})`);
    const keys = Env.keyCodes();
    if (!value && inputToKeydownEvent.which === keys.backspace) {
      this.debug(`respondToInputHotkeys.value:del`);
      $('.recipients span').last().remove();
      this.showHidePwdOrPubkeyContainerAndColorSendBtn();
      return;
    }
    this.debug(`respondToInputHotkeys.value:none`);
    return;
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
      this.resizeInputTo();
      this.S.cached('input_text').css('max-width', $('.text_container').width()! - 8 + 'px');
    }
  }

  public renderReplyMsgComposeTable = async (method: 'forward' | 'reply' = 'reply'): Promise<void> => {
    this.S.cached('prompt').css({ display: 'none' });
    this.S.cached('input_to').val(this.urlParams.to.join(',') + (this.urlParams.to.length ? ',' : '')); // the comma causes the last email to be get evaluated
    await this.renderComposeTable();
    if (this.canReadEmails) {
      const determined = await this.app.emailProviderDetermineReplyMsgHeaderVariables();
      if (determined) {
        this.urlParams.subject = `${(method === 'reply' ? 'Re' : 'Fwd')}: ${this.urlParams.subject}`;
        this.additionalMsgHeaders['In-Reply-To'] = determined.headers['In-Reply-To'];
        this.additionalMsgHeaders.References = determined.headers.References;
        if (!this.urlParams.draftId) { // if there is a draft, don't attempt to pull quoted content. It's assumed to be already present in the draft
          (async () => { // not awaited because can take a long time & blocks rendering
            await this.composerQuote.addTripleDotQuoteExpandBtn(determined.lastMsgId, method);
            if (this.composerQuote.messageToReplyOrForward && this.composerQuote.messageToReplyOrForward.isSigned) {
              this.S.cached('icon_sign').click();
            }
          })().catch(Catch.reportErr);
        }
      } else {
        this.urlParams.threadId = '';
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
    Catch.setHandledTimeout(() => BrowserMsg.send.scrollToBottomOfConversation(this.urlParams.parentTabId), 300);
  }

  public resizeInputTo = () => { // below both present in template
    this.S.cached('input_to').css('width', '100%'); // this indeed seems to effect the line below (noticeable when maximizing / back to default)
    this.S.cached('input_to').css('width', (Math.max(150, this.S.cached('input_to').parent().width()! - this.S.cached('input_to').siblings('.recipients').width()! - 50)) + 'px');
  }

  updateFooterIcon = (include?: boolean) => {
    if (typeof include === 'undefined') { // decide if pubkey should be included
      this.updateFooterIcon(!!this.app.storageEmailFooterGet());
    } else { // set icon to specific state
      if (include) {
        this.S.cached('icon_footer').addClass('active');
      } else {
        this.S.cached('icon_footer').removeClass('active');
      }
    }
  }

  private toggleSignIcon = () => {
    let method: 'addClass' | 'removeClass';
    if (!this.S.cached('icon_sign').is('.active')) {
      method = 'addClass';
      this.S.cached('title').text(Lang.compose.headerTitleComposeSign);
      this.S.cached('input_password').val('');
    } else {
      method = 'removeClass';
      this.S.cached('title').text(Lang.compose.headerTitleComposeEncrypt);
    }
    this.S.cached('icon_sign')[method]('active');
    this.S.cached('compose_table')[method]('sign');
    this.S.now('attached_files')[method]('sign');
    if ([this.BTN_SIGN_AND_SEND, this.BTN_ENCRYPT_AND_SEND].includes(this.S.now('send_btn_span').text())) {
      this.resetSendBtn();
    }
    this.showHidePwdOrPubkeyContainerAndColorSendBtn();
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

  private renderReplySuccess = (msg: SendableMsg, msgId: string) => {
    const isSigned = this.S.cached('icon_sign').is('.active');
    this.app.renderReinsertReplyBox(msgId, msg.headers.To.split(',').map(a => Str.parseEmail(a).email).filter(e => !!e) as string[]);
    if (isSigned) {
      this.S.cached('replied_body').addClass('pgp_neutral').removeClass('pgp_secure');
    }
    this.S.cached('replied_body').css('width', ($('table#compose').width() || 500) - 30);
    this.S.cached('compose_table').css('display', 'none');
    this.S.cached('reply_msg_successful').find('div.replied_from').text(this.getSender());
    this.S.cached('reply_msg_successful').find('div.replied_to span').text(msg.headers.To.replace(/,/g, ', '));
    Xss.sanitizeRender(this.S.cached('reply_msg_successful').find('div.replied_body'), Xss.escape(this.extractAsText('input_text', 'SKIP-ADDONS')).replace(/\n/g, '<br>'));
    const emailFooter = this.app.storageEmailFooterGet();
    if (emailFooter) {
      const renderableEscapedEmailFooter = Xss.escape(emailFooter).replace(/\n/g, '<br>');
      if (isSigned) {
        Xss.sanitizeAppend(this.S.cached('replied_body'), `<br><br>${renderableEscapedEmailFooter}`);
      } else {
        Xss.sanitizeRender(this.S.cached('reply_msg_successful').find('.email_footer'), `<br> ${renderableEscapedEmailFooter}`);
      }
    }
    const t = new Date();
    const time = ((t.getHours() !== 12) ? (t.getHours() % 12) : 12) + ':' + (t.getMinutes() < 10 ? '0' : '') + t.getMinutes() + ((t.getHours() >= 12) ? ' PM ' : ' AM ') + '(0 minutes ago)';
    this.S.cached('reply_msg_successful').find('div.replied_time').text(time);
    this.S.cached('reply_msg_successful').css('display', 'block');
    if (msg.atts.length) {
      this.S.cached('replied_attachments').html(msg.atts.map(a => { // xss-safe-factory
        a.msgId = msgId;
        return this.app.factoryAtt(a, true);
      }).join('')).css('display', 'block');
    }
    this.resizeComposeBox();
  }

  private debugFocusEvents = (...selNames: string[]) => {
    for (const selName of selNames) {
      this.S.cached(selName)
        .focusin(e => this.debug(`** ${selName} receiving focus from(${e.relatedTarget ? e.relatedTarget.outerHTML : undefined})`))
        .focusout(e => this.debug(`** ${selName} giving focus to(${e.relatedTarget ? e.relatedTarget.outerHTML : undefined})`));
    }
  }

  private renderComposeTable = async () => {
    this.debugFocusEvents('input_text', 'send_btn', 'input_to', 'input_subject');
    this.S.cached('compose_table').css('display', 'table');
    this.S.cached('body').keydown(Ui.escape(() => !this.composeWindowIsMinimized && !this.urlParams.isReplyBox && $('.close_new_message').click()));
    this.S.cached('body').keypress(Ui.ctrlEnter(() => !this.composeWindowIsMinimized && this.extractProcessSendMsg()));
    this.S.cached('send_btn').click(Ui.event.prevent('double', () => this.extractProcessSendMsg()));
    this.S.cached('send_btn').keypress(Ui.enter(() => this.extractProcessSendMsg()));
    this.S.cached('input_to').keydown(ke => this.respondToInputHotkeys(ke));
    this.composerContacts.initActions();
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
          this.S.cached('input_to').val(keyUser.email).blur().focus(); // Need (blur + focus) to run parseRender function
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
    this.resizeInputTo();
    this.attach.initAttDialog('fineuploader', 'fineuploader_button');
    this.attach.setAttAddedCb(async () => {
      this.setInputTextHeightManuallyIfNeeded();
      this.resizeComposeBox();
    });
    this.attach.setAttRemovedCb(() => {
      this.setInputTextHeightManuallyIfNeeded();
      this.resizeComposeBox();
    });
    if (!String(this.S.cached('input_to').val()).length) {
      // focus on recipients, but only if empty (user has not started typing yet)
      // this is particularly important to skip if CI tests are already typing the recipient in
      this.debug(`renderComposeTable -> calling input_to.focus() when input_to.val(${this.S.cached('input_to').val()})`);
      // Firefox needs an iframe to be focused before focusing its content
      BrowserMsg.send.focusFrame(this.urlParams.parentTabId, { frameId: this.urlParams.frameId });
      this.S.cached('input_to').focus();
    }
    if (this.urlParams.isReplyBox) {
      if (this.urlParams.to.length) {
        this.S.cached('input_text').focus();
        document.getElementById('input_text')!.focus(); // #input_text is in the template
        // Firefox will not always respond to initial automatic $input_text.blur()
        // Recipients may be left unrendered, as standard text, with a trailing comma
        await this.composerContacts.parseRenderRecipients(this.S.cached('input_to_container')); // this will force firefox to render them on load
      }
      this.renderSenderAliasesOptionsToggle();
    } else {
      $('.close_new_message').click(Ui.event.handle(async () => {
        if (!this.isSendMessageInProgress || await Ui.modal.confirm('A message is currently being sent. Closing the compose window may abort sending the message.\nAbort sending?')) {
          this.app.closeMsg();
        }
      }, this.getErrHandlers(`close message`)));
      $('.minimize_new_message').click(Ui.event.handle(this.minimizeComposerWindow));
      $('.popout').click(Ui.event.handle(async () => {
        this.S.cached('body').hide(); // Need to hide because it seems laggy on some devices
        await this.toggleFullScreen();
        this.S.cached('body').show();
      }));
      this.renderSenderAliasesOptions();
      this.setInputTextHeightManuallyIfNeeded();
    }
    Catch.setHandledTimeout(() => { // delay automatic resizing until a second later
      // we use veryslowspree for reply box because hand-resizing the main window will cause too many events
      // we use spree (faster) for new messages because rendering of window buttons on top right depend on it, else visible lag shows
      $(window).resize(Ui.event.prevent(this.urlParams.isReplyBox ? 'veryslowspree' : 'spree', () => this.windowResized()));
      this.S.cached('input_text').keyup(Ui.event.prevent('slowspree', () => this.windowResized()));
    }, 1000);
  }

  private windowResized = () => {
    this.resizeComposeBox();
    this.setInputTextHeightManuallyIfNeeded(true);
  }

  private renderSenderAliasesOptionsToggle() {
    const addresses = this.app.storageGetAddresses();
    if (addresses.length > 1) {
      const showAliasChevronHtml = '<img id="show_sender_aliases_options" src="/img/svgs/chevron-left.svg" title="Choose sending address">';
      const inputAddrContainer = $('#input_addresses_container');
      Xss.sanitizeAppend(inputAddrContainer, showAliasChevronHtml);
      inputAddrContainer.find('#show_sender_aliases_options').click(Ui.event.handle(() => this.renderSenderAliasesOptions(), this.getErrHandlers(`show sending address options`)));
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

  private renderSenderAliasesOptions() {
    const addresses = this.app.storageGetAddresses();
    if (addresses.length > 1) {
      const inputAddrContainer = $('#input_addresses_container');
      inputAddrContainer.addClass('show_send_from');
      let selectElHtml = '<select id="input_from" tabindex="-1" data-test="input-from"></select>';
      if (!this.urlParams.isReplyBox) {
        selectElHtml += '<img id="input_from_settings" src="/img/svgs/settings-icon.svg" data-test="action-open-sending-address-settings" title="Settings">';
      }
      Xss.sanitizeAppend(inputAddrContainer, selectElHtml);
      inputAddrContainer.find('#input_from_settings').click(Ui.event.handle(() => this.app.renderSendingAddrDialog(), this.getErrHandlers(`open sending address dialog`)));
      const fmtOpt = (addr: string) => `<option value="${Xss.escape(addr)}" ${this.getSender() === addr ? 'selected' : ''}>${Xss.escape(addr)}</option>`;
      Xss.sanitizeAppend(inputAddrContainer.find('#input_from'), addresses.map(fmtOpt).join('')).change(() => this.composerContacts.updatePubkeyIcon());
      if (this.urlParams.isReplyBox) {
        this.resizeComposeBox();
      }
      if (Catch.browser().name === 'firefox') {
        inputAddrContainer.find('#input_from_settings').css('margin-top', '20px');
      }
    }
  }

  private async checkEmailAliases() {
    if (!this.urlParams.isReplyBox) {
      const addresses = Value.arr.unique((await Settings.fetchAcctAliasesFromGmail(this.urlParams.acctEmail)).concat(this.urlParams.acctEmail));
      const storedAdresses = (await Store.getAcct(this.urlParams.acctEmail, ['addresses'])).addresses || [];
      if (addresses.sort().join() !== storedAdresses.sort().join()) { // This way of comparation two arrays works only for not object arrays
        await Store.setAcct(this.urlParams.acctEmail, { addresses });
        if (await Ui.modal.confirm('Your email aliases on Gmail have refreshed since the last time you used FlowCrypt.\nReload the compose window now?')) {
          window.location.reload();
        }
      }
    }
  }

  private fmtPwdProtectedEmail = (shortId: string, encryptedBody: SendableMsgBody, armoredPubkeys: string[], atts: Att[], lang: 'DE' | 'EN') => {
    const msgUrl = `${this.FC_WEB_URL}/${shortId}`;
    const a = `<a href="${Xss.escape(msgUrl)}" style="padding: 2px 6px; background: #2199e8; color: #fff; display: inline-block; text-decoration: none;">${Lang.compose.openMsg[lang]}</a>`;
    const intro = this.S.cached('input_intro').length ? this.extractAsText('input_intro') : '';
    const text = [];
    const html = [];
    if (intro) {
      text.push(intro + '\n');
      html.push(intro.replace(/\n/, '<br>') + '<br><br>');
    }
    text.push(Lang.compose.msgEncryptedText[lang] + msgUrl + '\n');
    html.push('<div class="cryptup_encrypted_message_replaceable">');
    html.push('<div style="opacity: 0;">' + Pgp.armor.headers('null').begin + '</div>');
    html.push(Lang.compose.msgEncryptedHtml[lang] + a + '<br><br>');
    html.push(Lang.compose.alternativelyCopyPaste[lang] + Xss.escape(msgUrl) + '<br><br><br>');
    html.push('</div>');
    if (armoredPubkeys.length > 1) { // only include the message in email if a pubkey-holding person is receiving it as well
      atts.push(new Att({ data: Buf.fromUtfStr(encryptedBody['text/plain']!), name: 'encrypted.asc' }));
    }
    return { 'text/plain': text.join('\n'), 'text/html': html.join('\n') };
  }

  private formatEmailTextFooter = (origBody: SendableMsgBody): SendableMsgBody => {
    const emailFooter = this.app.storageEmailFooterGet();
    const body: SendableMsgBody = { 'text/plain': origBody['text/plain'] + (emailFooter ? '\n' + emailFooter : '') };
    if (typeof origBody['text/html'] !== 'undefined') {
      body['text/html'] = origBody['text/html'] + (emailFooter ? '<br>\n' + emailFooter.replace(/\n/g, '<br>\n') : '');
    }
    return body;
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

  private addNamesToMsg = async (msg: SendableMsg): Promise<void> => {
    msg.to = await Promise.all(msg.to.map(async email => {
      const [contact] = await this.app.storageContactGet([email]);
      return contact && contact.name ? `${contact.name.replace(/[<>'"/\\\n\r\t]/g, '')} <${email}>` : email;
    }));
    const { full_name: name } = await Store.getAcct(this.urlParams.acctEmail, ['full_name']);
    if (name) {
      msg.from = `${name.replace(/[<>'"/\\\n\r\t]/g, '')} <${msg.from}>`;
    }
  }
}
