/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { AccountStore, Scopes, Store } from '../../js/common/platform/store.js';
import { EmailProviderInterface, ReplyParams } from '../../js/common/api/email-provider/email-provider-api.js';
import { ApiErr } from '../../js/common/api/error/api-error.js';
import { Assert } from '../../js/common/assert.js';
import { Backend } from '../../js/common/api/backend.js';
import { BrowserMsg } from '../../js/common/browser/browser-msg.js';
import { Gmail } from '../../js/common/api/email-provider/gmail/gmail.js';
import { GmailParser } from '../../js/common/api/email-provider/gmail/gmail-parser.js';
import { Ui } from '../../js/common/browser/ui.js';
import { Url } from '../../js/common/core/common.js';
import { View } from '../../js/common/view.js';
import { Xss } from '../../js/common/platform/xss.js';
import { XssSafeFactory } from '../../js/common/xss-safe-factory.js';
import { openpgp } from '../../js/common/core/pgp.js';
import { ComposerAtts } from './composer/composer-atts.js';
import { ComposerDraft } from './composer/composer-draft.js';
import { ComposerErrs } from './composer/composer-errs.js';
import { ComposerFooter } from './composer/composer-footer.js';
import { ComposerInput } from './composer/composer-input.js';
import { ComposerMyPubkey } from './composer/composer-my-pubkey.js';
import { ComposerPwdOrPubkeyContainer } from './composer/composer-pwd-or-pubkey-container.js';
import { ComposerQuote } from './composer/composer-quote.js';
import { ComposerRecipients } from './composer/composer-recipients.js';
import { ComposerRender } from './composer/composer-render.js';
import { ComposerSendBtn } from './composer/composer-send-btn.js';
import { ComposerSender } from './composer/composer-sender.js';
import { ComposerSize } from './composer/composer-size.js';
import { ComposerStorage } from './composer/composer-storage.js';

export type DeterminedMsgHeaders = {
  lastMsgId: string,
  headers: { 'In-Reply-To': string, 'References': string }
};

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
  public storage!: AccountStore;
  public factory!: XssSafeFactory;
  public replyParams: ReplyParams | undefined;
  public emailProvider: EmailProviderInterface;

  public quoteModule!: ComposerQuote;
  public sendBtnModule!: ComposerSendBtn;
  public draftModule!: ComposerDraft;
  public recipientsModule!: ComposerRecipients;
  public pwdOrPubkeyContainerModule!: ComposerPwdOrPubkeyContainer;
  public sizeModule!: ComposerSize;
  public senderModule!: ComposerSender;
  public footerModule!: ComposerFooter;
  public attsModule!: ComposerAtts;
  public errModule!: ComposerErrs;
  public inputModule!: ComposerInput;
  public renderModule!: ComposerRender;
  public myPubkeyModule!: ComposerMyPubkey;
  public storageModule!: ComposerStorage;

  public S = Ui.buildJquerySels({
    body: 'body',
    compose_table: 'table#compose',
    header: '#section_header',
    subject: '#section_subject',
    footer: '#section_footer',
    title: 'table#compose th h1',
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
    Backend.getSubscriptionWithoutLogin(this.acctEmail).catch(ApiErr.reportIfSignificant); // updates storage
    openpgp.initWorker({ path: '/lib/openpgp.worker.js' });
  }

  public render = async () => {
    this.storage = await Store.getAcct(this.acctEmail, ['google_token_scopes', 'sendAs', 'email_provider', 'hide_message_password', 'drafts_reply']);
    this.tabId = await BrowserMsg.requiredTabId();
    this.factory = new XssSafeFactory(this.acctEmail, this.tabId);
    this.scopes = await Store.getScopes(this.acctEmail);
    if (!this.isReplyBox) { // don't want to deal with resizing the frame
      await Assert.abortAndRenderErrOnUnprotectedKey(this.acctEmail);
    }
    if (this.replyMsgId) {
      await this.fetchReplyMeta();
    }
    if (this.isReplyBox && this.threadId && !this.ignoreDraft && this.storage.drafts_reply && this.storage.drafts_reply[this.threadId]) {
      this.draftId = this.storage.drafts_reply[this.threadId]; // there may be a draft we want to load
    }
    this.draftModule = new ComposerDraft(this);
    this.quoteModule = new ComposerQuote(this);
    this.recipientsModule = new ComposerRecipients(this);
    this.sendBtnModule = new ComposerSendBtn(this);
    this.pwdOrPubkeyContainerModule = new ComposerPwdOrPubkeyContainer(this);
    this.sizeModule = new ComposerSize(this);
    this.senderModule = new ComposerSender(this);
    this.footerModule = new ComposerFooter(this);
    this.attsModule = new ComposerAtts(this);
    this.errModule = new ComposerErrs(this);
    this.inputModule = new ComposerInput(this);
    this.renderModule = new ComposerRender(this);
    this.myPubkeyModule = new ComposerMyPubkey(this);
    this.storageModule = new ComposerStorage(this);
    BrowserMsg.listen(this.tabId!);
  }

  public setHandlers = async () => {
    await this.renderModule.initComposeBox();
    BrowserMsg.addListener('close_dialog', async () => { $('.featherlight.featherlight-iframe').remove(); });
    this.S.cached('icon_help').click(this.setHandler(() => this.renderModule.renderSettingsWithDialog('help'), this.errModule.handle(`help dialog`)));
    this.S.cached('body').bind({ drop: Ui.event.stop(), dragover: Ui.event.stop() }); // prevents files dropped out of the intended drop area to interfere
    this.attsModule.setHandlers();
    this.inputModule.setHandlers();
    this.myPubkeyModule.setHandlers();
    this.pwdOrPubkeyContainerModule.setHandlers();
    this.sizeModule.setHandlers();
    this.storageModule.setHandlers();
    this.recipientsModule.setHandlers();
    this.sendBtnModule.setHandlers();
    await this.senderModule.checkEmailAliases();
    this.draftModule.setHandlers(); // must be last for 'onRecipientAdded/draftSave' to work properly
  }

  private fetchReplyMeta = async (): Promise<void> => {
    Xss.sanitizePrepend('#new_message', Ui.e('div', { id: 'loader', html: `Loading secure reply box..${Ui.spinner('green')}` }));
    try {
      const gmailMsg = await this.emailProvider.msgGet(this.replyMsgId!, 'metadata');
      const aliases = Object.keys(this.storage.sendAs!);
      this.replyParams = GmailParser.determineReplyMeta(this.acctEmail, aliases, gmailMsg);
      this.threadId = gmailMsg.threadId || '';
    } catch (e) {
      if (ApiErr.isAuthPopupNeeded(e)) {
        BrowserMsg.send.notificationShowAuthPopupNeeded(this.parentTabId, { acctEmail: this.acctEmail });
      }
      if (e instanceof Error) {
        e.message = `Cannot get reply data for the message you are replying to.`;
      }
      throw e;
    } finally {
      $('#loader').remove();
    }
  }

}

View.run(ComposeView);
