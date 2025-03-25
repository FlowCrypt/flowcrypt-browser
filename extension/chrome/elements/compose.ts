/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { EmailProviderInterface, ReplyParams } from '../../js/common/api/email-provider/email-provider-api.js';
import { Assert } from '../../js/common/assert.js';
import { Bm, BrowserMsg } from '../../js/common/browser/browser-msg.js';
import { Gmail } from '../../js/common/api/email-provider/gmail/gmail.js';
import { Ui } from '../../js/common/browser/ui.js';
import { PromiseCancellation, Url } from '../../js/common/core/common.js';
import { View } from '../../js/common/view.js';
import { XssSafeFactory } from '../../js/common/xss-safe-factory.js';
import { opgp } from '../../js/common/core/crypto/pgp/openpgpjs-custom.js';
import { ComposeAttachmentsModule } from './compose-modules/compose-attachments-module.js';
import { ComposeDraftModule } from './compose-modules/compose-draft-module.js';
import { ComposeErrModule } from './compose-modules/compose-err-module.js';
import { ComposeFooterModule } from './compose-modules/compose-footer-module.js';
import { ComposeInputModule } from './compose-modules/compose-input-module.js';
import { ComposeMyPubkeyModule } from './compose-modules/compose-my-pubkey-module.js';
import { ComposePwdOrPubkeyContainerModule } from './compose-modules/compose-pwd-or-pubkey-container-module.js';
import { ComposeQuoteModule } from './compose-modules/compose-quote-module.js';
import { ComposeRecipientsModule } from './compose-modules/compose-recipients-module.js';
import { ComposeRenderModule } from './compose-modules/compose-render-module.js';
import { ComposeSendBtnModule } from './compose-modules/compose-send-btn-module.js';
import { ComposeSenderModule } from './compose-modules/compose-sender-module.js';
import { ComposeSizeModule } from './compose-modules/compose-size-module.js';
import { ComposeStorageModule } from './compose-modules/compose-storage-module.js';
import { Catch } from '../../js/common/platform/catch.js';
import { ClientConfiguration } from '../../js/common/client-configuration.js';
import { PubLookup } from '../../js/common/api/pub-lookup.js';
import { AcctStore } from '../../js/common/platform/store/acct-store.js';
import { AccountServer } from '../../js/common/api/account-server.js';
import { ComposeReplyBtnPopoverModule, ReplyOption } from './compose-modules/compose-reply-btn-popover-module.js';
import { Lang } from '../../js/common/lang.js';

export class ComposeView extends View {
  public readonly acctEmail: string;
  public readonly parentTabId: string;
  public readonly frameId: string;
  public readonly ignoreDraft: boolean;
  public readonly removeAfterClose: boolean;
  public readonly disableDraftSaving: boolean;
  public readonly debug: boolean;
  public readonly useFullScreenSecureCompose: boolean;
  public readonly isReplyBox: boolean;
  public readonly replyMsgId: string;
  public readonly replyPubkeyMismatch: boolean;
  public replyOption?: ReplyOption;
  public fesUrl?: string;
  public skipClickPrompt: boolean;
  public draftId: string;
  public threadId = '';
  public ppChangedPromiseCancellation: PromiseCancellation = { cancel: false };

  public readonly tabId = BrowserMsg.generateTabId();
  public factory!: XssSafeFactory;
  public replyParams: ReplyParams | undefined;
  public emailProvider: EmailProviderInterface;
  public clientConfiguration!: ClientConfiguration;
  public pubLookup!: PubLookup;
  public acctServer: AccountServer;

  public quoteModule!: ComposeQuoteModule;
  public sendBtnModule!: ComposeSendBtnModule;
  public replyPopoverModule!: ComposeReplyBtnPopoverModule;
  public draftModule!: ComposeDraftModule;
  public recipientsModule!: ComposeRecipientsModule;
  public pwdOrPubkeyContainerModule!: ComposePwdOrPubkeyContainerModule;
  public sizeModule!: ComposeSizeModule;
  public senderModule!: ComposeSenderModule;
  public footerModule!: ComposeFooterModule;
  public attachmentsModule!: ComposeAttachmentsModule;
  public errModule!: ComposeErrModule;
  public inputModule!: ComposeInputModule;
  public renderModule!: ComposeRenderModule;
  public myPubkeyModule!: ComposeMyPubkeyModule;
  public storageModule!: ComposeStorageModule;

  /* eslint-disable @typescript-eslint/naming-convention */
  public S = Ui.buildJquerySels({
    body: 'body',
    compose_table: 'table#compose',
    header: '#section_header',
    subject: '#section_subject',
    compose: '#section_compose',
    footer: '#section_footer',
    title: '#header_title',
    input_text: 'div#input_text',
    input_to: '#input_to',
    input_from: '#input_from',
    input_subject: '#input_subject',
    input_password: '#input_password',
    expiration_note: '#expiration_note',
    input_intro: '.input_intro',
    recipients_placeholder: '#recipients_placeholder',
    all_cells_except_text: 'table#compose > tbody > tr > :not(.text)',
    add_intro: '.action_add_intro',
    add_their_pubkey: '.add_pubkey',
    intro_container: '.intro_container',
    password_or_pubkey: '#password_or_pubkey_container',
    password_input_container: '.password_input_container',
    warning_nopgp: '.warning_nopgp',
    warning_revoked: '.warning_revoked',
    warning_no_pubkey_on_attester: '.warning_no_pubkey_on_attester',
    send_btn_note: '#send_btn_note',
    send_btn_i: '#send_btn i',
    send_btn: '#send_btn',
    send_btn_text: '#send_btn_text',
    toggle_send_options: '#toggle_send_options',
    toggle_reply_options: '#toggle_reply_options',
    icon_pubkey: '.icon.action_include_pubkey',
    close_compose_window: '.close_compose_window',
    icon_help: '.action_feedback',
    icon_popout: '.popout img',
    triple_dot: '.action_show_prev_msg',
    prompt: 'div#initial_prompt',
    reply_msg_successful: '#reply_message_successful_container',
    replied_body: '.replied_body',
    replied_attachments: '#attachments',
    fineuploader: '#fineuploader',
    recipients: 'span.recipients',
    contacts: '#contacts',
    input_addresses_container_outer: '#input_addresses_container',
    recipient_left_label: '.recipient-left-label',
    input_container_from: '#input-container-from',
    input_addresses_container_inner: '#input_addresses_container > div:first',
    recipients_inputs: '#input_addresses_container input',
    recipients_toggle_elements: '#input_subject, #input_text, #input_password',
    attached_files: 'table#compose #fineuploader .qq-upload-list li',
    container_cc_bcc_buttons: '#input_addresses_container .container-cc-bcc-buttons',
    cc: '#cc',
    bcc: '#bcc',
    sending_options_container: '#sending-options-container',
    reply_options_container: '#reply-options-container',
  });
  /* eslint-enable @typescript-eslint/naming-convention */

  public constructor() {
    super();
    Ui.event.protect();
    const uncheckedUrlParams = Url.parse([
      'acctEmail',
      'parentTabId',
      'draftId',
      'frameId',
      'replyMsgId',
      'skipClickPrompt',
      'ignoreDraft',
      'debug',
      'removeAfterClose',
      'replyPubkeyMismatch',
      'replyOption',
      'useFullScreenSecureCompose',
    ]);
    this.acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
    this.parentTabId = Assert.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');
    this.frameId = Assert.urlParamRequire.string(uncheckedUrlParams, 'frameId');
    this.skipClickPrompt = uncheckedUrlParams.skipClickPrompt === true;
    this.ignoreDraft = uncheckedUrlParams.ignoreDraft === true;
    this.removeAfterClose = uncheckedUrlParams.removeAfterClose === true;
    this.replyOption = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'replyOption') as ReplyOption;
    this.disableDraftSaving = false;
    this.debug = uncheckedUrlParams.debug === true;
    this.replyPubkeyMismatch = uncheckedUrlParams.replyPubkeyMismatch === true;
    this.draftId = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'draftId') || '';
    this.replyMsgId = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'replyMsgId') || '';
    this.useFullScreenSecureCompose = uncheckedUrlParams.useFullScreenSecureCompose === true;
    this.isReplyBox = !!this.replyMsgId && !this.useFullScreenSecureCompose;
    this.emailProvider = new Gmail(this.acctEmail);
    this.acctServer = new AccountServer(this.acctEmail);
  }

  public render = async () => {
    const storage = await AcctStore.get(this.acctEmail, ['sendAs', 'hide_message_password', 'fesUrl']);
    this.clientConfiguration = await ClientConfiguration.newInstance(this.acctEmail);
    if (this.clientConfiguration.shouldHideArmorMeta()) {
      opgp.config.showComment = false;
      opgp.config.showVersion = false;
    }
    this.pubLookup = new PubLookup(this.clientConfiguration);
    this.factory = new XssSafeFactory(this.acctEmail, this.tabId);
    this.draftModule = new ComposeDraftModule(this);
    this.quoteModule = new ComposeQuoteModule(this);
    this.recipientsModule = new ComposeRecipientsModule(this);
    this.sendBtnModule = new ComposeSendBtnModule(this);
    this.replyPopoverModule = new ComposeReplyBtnPopoverModule(this);
    this.pwdOrPubkeyContainerModule = new ComposePwdOrPubkeyContainerModule(this, storage.hide_message_password);
    this.fesUrl = storage.fesUrl;
    this.sizeModule = new ComposeSizeModule(this);
    this.senderModule = new ComposeSenderModule(this);
    this.footerModule = new ComposeFooterModule(this);
    this.attachmentsModule = new ComposeAttachmentsModule(this);
    this.errModule = new ComposeErrModule(this);
    this.inputModule = new ComposeInputModule(this);
    this.renderModule = new ComposeRenderModule(this);
    this.myPubkeyModule = new ComposeMyPubkeyModule(this);
    this.storageModule = new ComposeStorageModule(this);
    await this.acctServer.initialize();
    if (!this.isReplyBox) {
      await Assert.abortAndRenderErrOnUnprotectedKey(this.acctEmail);
    }
    if (this.replyMsgId) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      await this.renderModule.fetchReplyMeta(Object.keys(storage.sendAs!));
    }
    BrowserMsg.listen(this.tabId);
    await this.renderModule.initComposeBox();
    if (this.replyOption && this.replyMsgId) {
      await this.renderModule.activateReplyOption(this.replyOption, true);
    }
    this.senderModule.checkEmailAliases().catch(Catch.reportErr);
  };

  public setHandlers = () => {
    BrowserMsg.addListener('focus_previous_active_window', async ({ frameId }: Bm.ComposeWindow) => {
      if (this.frameId === frameId) {
        this.S.cached('input_to').trigger('focus');
      }
    });
    BrowserMsg.addListener('passphrase_entry', async ({ entered }: Bm.PassphraseEntry) => {
      if (!entered) {
        this.ppChangedPromiseCancellation.cancel = true; // update original object which is monitored by a promise
        this.ppChangedPromiseCancellation = { cancel: false }; // set to a new, not yet used object
      }
    });
    BrowserMsg.listen(this.parentTabId);
    const setActiveWindow = this.setHandler(async () => {
      BrowserMsg.send.setActiveWindow(this.parentTabId, { frameId: this.frameId });
    });
    this.S.cached('body').on('focusin', setActiveWindow);
    this.S.cached('body').on('click', setActiveWindow);
    this.S.cached('close_compose_window').on(
      'click',
      this.setHandler(async () => await this.renderModule.actionCloseHandler(), this.errModule.handle(`close compose window`))
    );
    this.S.cached('icon_help').on(
      'click',
      this.setHandler(async () => await this.renderModule.openSettingsWithDialog('help'), this.errModule.handle(`help dialog`))
    );
    this.S.cached('input_intro').on(
      'paste',
      this.setHandler(async (el, ev) => {
        const clipboardEvent = ev.originalEvent as ClipboardEvent;
        if (clipboardEvent.clipboardData) {
          const isInputLimitExceeded = this.inputModule.willInputLimitBeExceeded(clipboardEvent.clipboardData.getData('text/plain'), el, () => {
            const selection = window.getSelection();
            if (selection && selection.anchorNode === selection.focusNode && selection.anchorNode?.parentElement === el) {
              return Math.abs(selection.anchorOffset - selection.focusOffset);
            }
            return 0;
          });
          if (isInputLimitExceeded) {
            ev.preventDefault();
            await Ui.modal.warning(Lang.compose.inputLimitExceededOnPaste);
          }
        }
      })
    );
    this.attachmentsModule.setHandlers();
    this.inputModule.setHandlers();
    this.myPubkeyModule.setHandlers();
    this.pwdOrPubkeyContainerModule.setHandlers();
    this.sizeModule.setHandlers();
    this.recipientsModule.setHandlers();
    this.sendBtnModule.setHandlers();
    this.replyPopoverModule.setHandlers();
    this.draftModule.setHandlers(); // must be the last one so that 'onRecipientAdded/draftSave' to works properly
  };

  public isCustomerUrlFesUsed = () => Boolean(this.fesUrl);
}

View.run(ComposeView);
