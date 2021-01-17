/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { EmailProviderInterface, ReplyParams } from '../../js/common/api/email-provider/email-provider-api.js';
import { ApiErr } from '../../js/common/api/shared/api-error.js';
import { Assert } from '../../js/common/assert.js';
import { BrowserMsg } from '../../js/common/browser/browser-msg.js';
import { Gmail } from '../../js/common/api/email-provider/gmail/gmail.js';
import { Ui } from '../../js/common/browser/ui.js';
import { Url } from '../../js/common/core/common.js';
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
import { OrgRules } from '../../js/common/org-rules.js';
import { PubLookup } from '../../js/common/api/pub-lookup.js';
import { Scopes, AcctStore } from '../../js/common/platform/store/acct-store.js';
import { AccountServer } from '../../js/common/api/account-server.js';

export class ComposeView extends View {

  public readonly acctEmail: string;
  public readonly parentTabId: string;
  public readonly frameId: string;
  public readonly ignoreDraft: boolean;
  public readonly removeAfterClose: boolean;
  public readonly disableDraftSaving: boolean;
  public readonly debug: boolean;
  public readonly isReplyBox: boolean;
  public readonly replyMsgId: string;
  public readonly replyPubkeyMismatch: boolean;
  public skipClickPrompt: boolean;
  public draftId: string;
  public threadId: string = '';

  public scopes!: Scopes;
  public tabId!: string;
  public factory!: XssSafeFactory;
  public replyParams: ReplyParams | undefined;
  public emailProvider: EmailProviderInterface;
  public orgRules!: OrgRules;
  public pubLookup!: PubLookup;
  public acctServer: AccountServer;

  public quoteModule!: ComposeQuoteModule;
  public sendBtnModule!: ComposeSendBtnModule;
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
    password_label: '.label_password',
    send_btn_note: '#send_btn_note',
    send_btn_i: '#send_btn i',
    send_btn: '#send_btn',
    send_btn_text: '#send_btn_text',
    toggle_send_options: '#toggle_send_options',
    icon_pubkey: '.icon.action_include_pubkey',
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
    input_addresses_container_inner: '#input_addresses_container > div:first',
    recipients_inputs: '#input_addresses_container input',
    attached_files: 'table#compose #fineuploader .qq-upload-list li',
    container_cc_bcc_buttons: '#input_addresses_container .container-cc-bcc-buttons',
    cc: '#cc',
    bcc: '#bcc',
    sending_options_container: '#sending-options-container'
  });

  constructor() {
    super();
    Ui.event.protect();
    const uncheckedUrlParams = Url.parse(['acctEmail', 'parentTabId', 'draftId', 'frameId',
      'replyMsgId', 'skipClickPrompt', 'ignoreDraft', 'debug', 'removeAfterClose', 'replyPubkeyMismatch']);
    this.acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
    this.parentTabId = Assert.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');
    this.frameId = Assert.urlParamRequire.string(uncheckedUrlParams, 'frameId');
    this.skipClickPrompt = uncheckedUrlParams.skipClickPrompt === true;
    this.ignoreDraft = uncheckedUrlParams.ignoreDraft === true;
    this.removeAfterClose = uncheckedUrlParams.removeAfterClose === true;
    this.disableDraftSaving = false;
    this.debug = uncheckedUrlParams.debug === true;
    this.replyPubkeyMismatch = uncheckedUrlParams.replyPubkeyMismatch === true;
    this.draftId = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'draftId') || '';
    this.replyMsgId = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'replyMsgId') || '';
    this.isReplyBox = !!this.replyMsgId;
    this.emailProvider = new Gmail(this.acctEmail);
    this.acctServer = new AccountServer(this.acctEmail);
    opgp.initWorker({ path: '/lib/openpgp.worker.js' });
  }

  public render = async () => {
    const storage = await AcctStore.get(this.acctEmail, ['sendAs', 'hide_message_password']);
    this.orgRules = await OrgRules.newInstance(this.acctEmail);
    this.pubLookup = new PubLookup(this.orgRules);
    this.tabId = await BrowserMsg.requiredTabId();
    this.factory = new XssSafeFactory(this.acctEmail, this.tabId);
    this.scopes = await AcctStore.getScopes(this.acctEmail);
    this.draftModule = new ComposeDraftModule(this);
    this.quoteModule = new ComposeQuoteModule(this);
    this.recipientsModule = new ComposeRecipientsModule(this);
    this.sendBtnModule = new ComposeSendBtnModule(this);
    this.pwdOrPubkeyContainerModule = new ComposePwdOrPubkeyContainerModule(this, storage.hide_message_password);
    this.sizeModule = new ComposeSizeModule(this);
    this.senderModule = new ComposeSenderModule(this);
    this.footerModule = new ComposeFooterModule(this);
    this.attachmentsModule = new ComposeAttachmentsModule(this);
    this.errModule = new ComposeErrModule(this);
    this.inputModule = new ComposeInputModule(this);
    this.renderModule = new ComposeRenderModule(this);
    this.myPubkeyModule = new ComposeMyPubkeyModule(this);
    this.storageModule = new ComposeStorageModule(this);
    if (!this.isReplyBox) {
      await Assert.abortAndRenderErrOnUnprotectedKey(this.acctEmail);
    }
    this.storageModule.refreshAccountAndSubscriptionIfLoggedIn().catch(ApiErr.reportIfSignificant);
    if (this.replyMsgId) {
      await this.renderModule.fetchReplyMeta(Object.keys(storage.sendAs!));
    }
    if (this.isReplyBox) { // reply
      if (this.threadId && !this.ignoreDraft) {
        // this.draftId = TODO; // there may be a draft we want to load
      }
    } else { // compose
      if (!this.draftId) {
        this.draftId = this.draftModule.localNewMessageDraftId;
      }
    }
    BrowserMsg.listen(this.tabId!);
    await this.renderModule.initComposeBox();
    this.senderModule.checkEmailAliases().catch(Catch.reportErr);
  }

  public setHandlers = () => {
    this.S.cached('icon_help').click(this.setHandler(async () => await this.renderModule.openSettingsWithDialog('help'), this.errModule.handle(`help dialog`)));
    this.attachmentsModule.setHandlers();
    this.inputModule.setHandlers();
    this.myPubkeyModule.setHandlers();
    this.pwdOrPubkeyContainerModule.setHandlers();
    this.sizeModule.setHandlers();
    this.storageModule.setHandlers();
    this.recipientsModule.setHandlers();
    this.sendBtnModule.setHandlers();
    this.draftModule.setHandlers(); // must be the last one so that 'onRecipientAdded/draftSave' to works properly
  }

}

View.run(ComposeView);
