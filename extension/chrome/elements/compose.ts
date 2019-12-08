/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch } from '../../js/common/platform/catch.js';
import { Store, AccountStoreExtension, Scopes, AccountStore } from '../../js/common/platform/store.js';
import { Ui } from '../../js/common/browser.js';
import { Composer } from '../../js/common/composer/composer.js';
import { Api, ProgressCb, ChunkedCb } from '../../js/common/api/api.js';
import { BrowserMsg } from '../../js/common/extension.js';
import { Google } from '../../js/common/api/google.js';
import { Contact, openpgp } from '../../js/common/core/pgp.js';
import { SendableMsg } from '../../js/common/api/email_provider_api.js';
import { Assert } from '../../js/common/assert.js';
import { XssSafeFactory } from '../../js/common/xss_safe_factory.js';
import { Xss } from '../../js/common/platform/xss.js';
import { Backend } from '../../js/common/api/backend.js';
import { Url } from '../../js/common/core/common.js';
import { View } from '../../js/common/view.js';

export type DeterminedMsgHeaders = {
  lastMsgId: string,
  headers: { 'In-Reply-To': string, 'References': string }
};

export class ComposeView extends View { // temporarily extended by ReplyPubkeyMismatchView

  protected readonly acctEmail: string;
  private readonly parentTabId: string;
  private readonly frameId: string;
  private readonly skipClickPrompt: boolean;
  private readonly ignoreDraft: boolean;
  private readonly removeAfterClose: boolean;
  private readonly placement: 'settings' | 'gmail' | undefined;
  private readonly disableDraftSaving: boolean;
  private readonly debug: boolean;
  private readonly isReplyBox: boolean;
  private readonly replyMsgId: string;
  private readonly replyPubkeyMismatch: boolean;
  private draftId: string;
  private threadId: string = '';

  private scopes: Scopes | undefined;
  private tabId: string | undefined;
  private storage: AccountStore | undefined;
  private replyParams: { from: string, subject: string, to: string[], cc: string[], bcc: string[] } = { from: '', subject: '', to: [], cc: [], bcc: [] };
  public factory: XssSafeFactory | undefined;

  constructor() {
    super();
    Ui.event.protect();
    const uncheckedUrlParams = Url.parse(['acctEmail', 'parentTabId', 'draftId', 'placement', 'frameId',
      'replyMsgId', 'skipClickPrompt', 'ignoreDraft', 'debug', 'removeAfterClose', 'replyPubkeyMismatch']);
    this.acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
    this.parentTabId = Assert.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');
    this.frameId = Assert.urlParamRequire.string(uncheckedUrlParams, 'frameId');
    this.skipClickPrompt = uncheckedUrlParams.skipClickPrompt === true;
    this.ignoreDraft = uncheckedUrlParams.ignoreDraft === true;
    this.removeAfterClose = uncheckedUrlParams.removeAfterClose === true;
    this.placement = Assert.urlParamRequire.oneof(uncheckedUrlParams, 'placement', ['settings', 'gmail', undefined]);
    this.disableDraftSaving = false;
    this.debug = uncheckedUrlParams.debug === true;
    this.replyPubkeyMismatch = uncheckedUrlParams.replyPubkeyMismatch === true;
    this.draftId = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'draftId') || '';
    this.replyMsgId = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'replyMsgId') || '';
    this.isReplyBox = !!this.replyMsgId;
    Backend.getSubscriptionWithoutLogin(this.acctEmail).catch(Api.err.reportIfSignificant); // updates storage
    openpgp.initWorker({ path: '/lib/openpgp.worker.js' });
  }

  async render() {
    this.storage = await Store.getAcct(this.acctEmail, ['google_token_scopes', 'addresses', 'sendAs', 'email_provider',
      'hide_message_password', 'drafts_reply']);
    this.tabId = await BrowserMsg.requiredTabId();
    this.factory = new XssSafeFactory(this.acctEmail, this.tabId);
    this.scopes = await Store.getScopes(this.acctEmail);
    if (!this.isReplyBox) { // don't want to deal with resizing the frame
      await Assert.abortAndRenderErrOnUnprotectedKey(this.acctEmail);
    }
    if (this.replyMsgId) {
      await this.fetchReplyMsgInfo();
    }
    if (this.isReplyBox && this.threadId && !this.ignoreDraft && this.storage.drafts_reply && this.storage.drafts_reply[this.threadId]) {
      this.draftId = this.storage.drafts_reply[this.threadId]; // there may be a draft we want to load
    }
  }

  setHandlers() {
    const processedUrlParams = {
      acctEmail: this.acctEmail, draftId: this.draftId, threadId: this.threadId, replyMsgId: this.replyMsgId, ...this.replyParams, frameId: this.frameId,
      tabId: this.tabId!, isReplyBox: this.isReplyBox, skipClickPrompt: this.skipClickPrompt, parentTabId: this.parentTabId,
      disableDraftSaving: this.disableDraftSaving, debug: this.debug, removeAfterClose: this.removeAfterClose, placement: this.placement,
      replyPubkeyMismatch: this.replyPubkeyMismatch,
    };
    new Composer({ // tslint:disable-line:no-unused-expression
      emailProviderDraftGet: (draftId: string) => Google.gmail.draftGet(this.acctEmail, draftId, 'raw'),
      emailProviderDraftCreate: Google.gmail.draftCreate,
      emailProviderDraftUpdate: (draftId: string, mimeMsg: string) => Google.gmail.draftUpdate(this.acctEmail, draftId, mimeMsg),
      emailProviderDraftDelete: (draftId: string) => Google.gmail.draftDelete(this.acctEmail, draftId),
      emailProviderMsgSend: (message: SendableMsg, renderUploadProgress: ProgressCb) => Google.gmail.msgSend(this.acctEmail, message, renderUploadProgress),
      emailProviderGuessContactsFromSentEmails: (query: string, knownContacts: Contact[], multiCb: ChunkedCb) => this.emailProviderGuessContactsFromSentEmails(query, knownContacts, multiCb),
      emailProviderExtractArmoredBlock: (msgId: string) => Google.gmail.extractArmoredBlock(this.acctEmail, msgId, 'full'),
    }, processedUrlParams, this.scopes!, this.factory!);
    BrowserMsg.addListener('close_dialog', async () => { $('.featherlight.featherlight-iframe').remove(); });
    BrowserMsg.listen(this.tabId!);
  }

  private async fetchReplyMsgInfo(): Promise<void> {
    Xss.sanitizePrepend('#new_message', Ui.e('div', { id: 'loader', html: 'Loading secure reply box..' + Ui.spinner('green') }));
    try {
      const gmailMsg = await Google.gmail.msgGet(this.acctEmail, this.replyMsgId!, 'metadata');
      const aliases = AccountStoreExtension.getEmailAliasesIncludingPrimary(this.acctEmail, this.storage!.sendAs);
      Object.assign(this.replyParams, Google.determineReplyCorrespondents(this.acctEmail, aliases, gmailMsg));
      this.replyParams.subject = Google.gmail.findHeader(gmailMsg, 'subject') || '';
      this.threadId = gmailMsg.threadId || '';
    } catch (e) {
      if (Api.err.isAuthPopupNeeded(e)) {
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

  private emailProviderGuessContactsFromSentEmails(query: string, knownContacts: Contact[], multiCb: ChunkedCb) {
    Google.gmail.searchContacts(this.acctEmail, query, knownContacts, multiCb).catch(e => {
      if (Api.err.isAuthPopupNeeded(e)) {
        BrowserMsg.send.notificationShowAuthPopupNeeded(this.parentTabId, { acctEmail: this.acctEmail });
      } else if (Api.err.isNetErr(e)) {
        Ui.toast(`Network erroc - cannot search contacts`).catch(Catch.reportErr);
      } else if (Api.err.isMailOrAcctDisabledOrPolicy(e)) {
        Ui.toast(`Cannot search contacts - account disabled or forbidden by admin policy`).catch(Catch.reportErr);
      } else {
        Catch.reportErr(e);
        Ui.toast(`Error searching contacts: ${Api.err.eli5(e)}`).catch(Catch.reportErr);
      }
    });
  }

}

View.run(ComposeView);
