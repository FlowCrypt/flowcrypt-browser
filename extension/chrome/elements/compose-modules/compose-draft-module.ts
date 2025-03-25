/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { GmailRes } from '../../../js/common/api/email-provider/gmail/gmail-parser.js';
import { InvalidRecipientError, SendableMsg } from '../../../js/common/api/email-provider/sendable-msg.js';
import { AjaxErr, ApiErr } from '../../../js/common/api/shared/api-error.js';
import { BrowserMsg } from '../../../js/common/browser/browser-msg.js';
import { Env } from '../../../js/common/browser/env.js';
import { Time } from '../../../js/common/browser/time.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { Buf } from '../../../js/common/core/buf.js';
import { Str, Url } from '../../../js/common/core/common.js';
import { DecryptErrTypes, MsgUtil } from '../../../js/common/core/crypto/pgp/msg-util.js';
import { Mime, MimeContentWithHeaders, MimeProccesedMsg } from '../../../js/common/core/mime.js';
import { MsgBlockParser } from '../../../js/common/core/msg-block-parser.js';
import { Catch } from '../../../js/common/platform/catch.js';
import { GlobalStore } from '../../../js/common/platform/store/global-store.js';
import { KeyStore } from '../../../js/common/platform/store/key-store.js';
import { PassphraseStore } from '../../../js/common/platform/store/passphrase-store.js';
import { Xss } from '../../../js/common/platform/xss.js';
import { ViewModule } from '../../../js/common/view-module.js';
import { ComposeView } from '../compose.js';
import { EncryptedMsgMailFormatter } from './formatters/encrypted-mail-msg-formatter.js';

export class ComposeDraftModule extends ViewModule<ComposeView> {
  public wasMsgLoadedFromDraft = false;

  private currentlySavingDraft = false;
  private disableSendingDrafts = false;
  private saveDraftInterval?: number;
  private lastDraftBody = '';
  private lastDraftSubject = '';
  private SAVE_DRAFT_FREQUENCY = 3000;
  private localDraftPrefix = 'local-draft-';
  private localComposeDraftPrefix = 'compose-';
  private localComposeDraftId = Str.sloppyRandom(10);

  public constructor(composer: ComposeView) {
    super(composer);
    // Only start draft timer when draft id is not set.
    // When draft id is set, draft timer will start only when draft is decrypted successfully
    if (!this.view.disableDraftSaving && !this.view.draftId) {
      this.startDraftTimer();
    }
  }

  public setHandlers = () => {
    $('.delete_draft').on(
      'click',
      this.view.setHandler(() => this.deleteDraftClickHandler(), this.view.errModule.handle('delete draft'))
    );
    this.view.recipientsModule.onRecipientAdded(async () => {
      await this.draftSave(true);
    });
  };

  /**
   * Returns `true` if either a local or a cloud draft was loaded, otherwise returns `false`
   */
  public initialDraftLoad = async (): Promise<boolean> => {
    if (this.view.isReplyBox) {
      Xss.sanitizeRender(this.view.S.cached('prompt'), `Loading draft.. ${Ui.spinner('green')}`);
    }
    try {
      let draftGetRes = await this.localDraftGet();
      if (!draftGetRes && !this.isLocalDraftId(this.view.draftId)) {
        // local draft not found, try to load from cloud
        draftGetRes = await this.view.emailProvider.draftGet(this.view.draftId, 'raw');
      }
      if (!draftGetRes) {
        await this.abortAndRenderReplyMsgComposeTableIfIsReplyBox('!draftGetRes');
        return false;
      }
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const decoded = await Mime.decode(Buf.fromBase64UrlStr(draftGetRes.message.raw!));
      const processed = Mime.processDecoded(decoded);
      await this.fillAndRenderDraftHeaders(decoded);
      await this.decryptAndRenderDraft(processed);
      return true;
    } catch (e) {
      if (ApiErr.isNetErr(e)) {
        Xss.sanitizeRender('body', `Failed to load draft. ${Ui.retryLink()}`);
      } else if (ApiErr.isAuthErr(e)) {
        BrowserMsg.send.notificationShowAuthPopupNeeded(this.view.parentTabId, { acctEmail: this.view.acctEmail });
        Xss.sanitizeRender('body', `Failed to load draft - FlowCrypt needs to be re-connected to Gmail. ${Ui.retryLink()}`);
      } else if (this.view.isReplyBox && ApiErr.isNotFound(e)) {
        console.info('about to reload reply_message automatically: get draft 404', this.view.acctEmail);
        await Time.sleep(500);
        console.info('Above red message means that there used to be a draft, but was since deleted. (not an error)');
        this.view.draftId = '';
        window.location.href = Url.create(Env.getUrlNoParams(), this.urlParams());
      } else {
        Catch.reportErr(e);
        await this.abortAndRenderReplyMsgComposeTableIfIsReplyBox('exception');
      }
    }
    return false;
  };

  public draftDelete = async () => {
    clearInterval(this.saveDraftInterval);
    await Time.wait(() => (!this.currentlySavingDraft ? true : undefined));
    if (this.view.draftId) {
      try {
        if (!this.isLocalDraftId(this.view.draftId)) {
          await this.view.emailProvider.draftDelete(this.view.draftId);
        }
        await this.localDraftRemove();
        this.view.draftId = '';
      } catch (e) {
        if (ApiErr.isAuthErr(e)) {
          BrowserMsg.send.notificationShowAuthPopupNeeded(this.view.parentTabId, { acctEmail: this.view.acctEmail });
        } else if (ApiErr.isNotFound(e)) {
          console.info(`draftDelete: ${e.message}`);
        } else if (!ApiErr.isNetErr(e)) {
          Catch.reportErr(e);
        }
      }
    }
  };

  public setLastDraftBody = (draftBody: string): void => {
    this.lastDraftBody = draftBody;
  };

  public draftSave = async (forceSave = false): Promise<void> => {
    if (this.disableSendingDrafts) {
      return;
    }
    if (this.hasBodyChanged(this.view.inputModule.squire.getHTML()) || this.hasSubjectChanged(String(this.view.S.cached('input_subject').val())) || forceSave) {
      this.currentlySavingDraft = true;
      try {
        const msgData = await this.view.inputModule.extractAll();
        const { pubkeys } = await this.view.storageModule.collectSingleFamilyKeys([], msgData.from.email, true);
        msgData.pwd = undefined; // not needed for drafts
        const sendable = await new EncryptedMsgMailFormatter(this.view, true).sendableNonPwdMsg(msgData, pubkeys);
        if (this.view.replyParams?.inReplyTo) {
          sendable.headers.References = this.view.replyParams.inReplyTo;
          sendable.headers['In-Reply-To'] = this.view.replyParams.inReplyTo;
        }
        this.view.S.cached('send_btn_note').text('Saving');
        this.draftSetPrefixIntoBody(sendable);
        const mimeMsg = await sendable.toMime();
        // If a draft was loaded from the local storage, once a user is back online, the local draft will be moved to the email provider
        if (!this.view.draftId || this.isLocalDraftId(this.view.draftId)) {
          this.view.draftId = await this.doUploadDraftWithLocalStorageFallback(mimeMsg, async () => {
            const { id } = await this.view.emailProvider.draftCreate(mimeMsg, this.view.threadId);
            return id;
          });
          // recursing one more time, because we need the draftId we get from this reply in the message itself
          // essentially everytime we save draft for the first time, we have to save it twice
          // currentlySavingDraft will remain true for now
          if (!this.isLocalDraftId(this.view.draftId)) {
            await this.draftSave(true); // forceSave = true
          }
        } else {
          this.view.draftId = await this.doUploadDraftWithLocalStorageFallback(mimeMsg, async () => {
            await this.view.emailProvider.draftUpdate(this.view.draftId, mimeMsg, this.view.threadId);
            return this.view.draftId;
          });
        }
      } catch (e) {
        if (ApiErr.isAuthErr(e)) {
          BrowserMsg.send.notificationShowAuthPopupNeeded(this.view.parentTabId, { acctEmail: this.view.acctEmail });
          this.view.S.cached('send_btn_note').text('Not saved (reconnect)');
        } else if (e instanceof Error && e.message.includes('Could not find valid key packet for encryption in key')) {
          this.view.S.cached('send_btn_note').text('Not saved (bad key)');
        } else if (
          this.view.draftId &&
          (ApiErr.isNotFound(e) || (e instanceof AjaxErr && e.status === 400 && e.responseText.includes('Message not a draft')))
        ) {
          // not found - updating draft that was since deleted
          // not a draft - updating draft that was since sent as a message (in another window), and is not a draft anymore
          this.view.draftId = ''; // forget there was a draftId - next step will create a new draftId
          await this.draftSave(true); // forceSave=true to not skip
        } else if (!this.view.draftId && ApiErr.isNotFound(e)) {
          // not found - creating draft on a thread that does not exist
          this.view.threadId = ''; // forget there was a threadId
          await this.draftSave(true); // forceSave=true to not skip
        } else if (e instanceof InvalidRecipientError) {
          this.view.S.cached('send_btn_note').text('Not saved (invalid recipients)');
        } else {
          Catch.reportErr(e);
          this.view.S.cached('send_btn_note').text('Not saved (error)');
          Ui.toast(`Draft not saved: ${e}`, false, 5);
          if (!ApiErr.isNetErr(e)) {
            // no point trying again on fatal error
            // eg maybe keys could be broken or missing
            this.disableSendingDrafts = true;
            // todo - could in the future add "once" click handler on send_btn_note
            //   which would set this back to false & re-run draftSave
          }
        }
      }
      this.currentlySavingDraft = false;
    }
  };

  public getLocalDraftId = () => {
    // local draft id passed from openComposeWin()
    if (this.view.draftId.startsWith(this.localDraftPrefix)) {
      return this.view.draftId;
    }
    // reply local draft
    if (this.view.threadId) {
      return `${this.localDraftPrefix}${this.view.threadId}`;
    }
    // compose local draft
    return `${this.localDraftPrefix}${this.localComposeDraftPrefix}${this.localComposeDraftId}`;
  };

  public localDraftGet = async (): Promise<GmailRes.GmailDraftGet | undefined> => {
    const draftId = this.getLocalDraftId();
    const storage = await GlobalStore.get(['local_drafts']);
    if (typeof storage.local_drafts === 'undefined') {
      return undefined;
    }
    const localDraft = storage.local_drafts[draftId];
    if (this.isValidLocalDraft(localDraft)) {
      return localDraft;
    }
    return undefined;
  };

  public startDraftTimer = () => {
    if (this.saveDraftInterval) {
      clearInterval(this.saveDraftInterval);
      this.saveDraftInterval = undefined;
    }
    this.saveDraftInterval = Catch.setHandledInterval(() => this.draftSave(), this.SAVE_DRAFT_FREQUENCY);
  };

  private draftSetPrefixIntoBody = (sendable: SendableMsg) => {
    if (!this.view.threadId && !this.view.draftId) {
      const prefix = `(saving of this draft was interrupted - to decrypt it, send it to yourself)\n\n`;
      sendable.body['text/plain'] = `${prefix}${sendable.body['text/plain'] || ''}`;
    }
  };

  private doUploadDraftWithLocalStorageFallback = async (mimeMsg: string, uploadDraft: () => Promise<string>) => {
    let draftId: string;
    try {
      draftId = await uploadDraft();
      await this.localDraftRemove(); // delete local draft if there is one
      this.view.S.cached('send_btn_note').text('Saved');
    } catch (e) {
      if (ApiErr.isNetErr(e)) {
        draftId = await this.localDraftCreate(mimeMsg, this.view.threadId);
        this.view.S.cached('send_btn_note').text('Draft saved locally (offline)');
      } else {
        throw e;
      }
    }
    return draftId;
  };

  private isLocalDraftId = (draftId: string) => {
    return !!draftId.match(this.localDraftPrefix);
  };

  private localDraftCreate = async (mimeMsg: string, threadId: string) => {
    const storage = await GlobalStore.get(['local_drafts']);
    if (typeof storage.local_drafts === 'undefined') {
      storage.local_drafts = {};
    }
    const draftId = this.getLocalDraftId();
    storage.local_drafts[draftId] = {
      id: '',
      timestamp: new Date().getTime(),
      acctEmail: this.view.acctEmail,
      message: { id: '', historyId: '', raw: Buf.fromUtfStr(mimeMsg).toBase64UrlStr(), threadId },
    };
    await GlobalStore.set(storage);
    return draftId;
  };

  private localDraftRemove = async () => {
    const draftId = this.getLocalDraftId();
    const storage = await GlobalStore.get(['local_drafts']);
    if (typeof storage.local_drafts !== 'undefined') {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete storage.local_drafts[draftId];
      await GlobalStore.set(storage);
    }
  };

  private isValidLocalDraft = (localDraft: unknown): localDraft is GmailRes.GmailDraftGet => {
    return !!localDraft && typeof (localDraft as GmailRes.GmailDraftGet).message === 'object';
  };

  private deleteDraftClickHandler = async () => {
    await this.draftDelete();
    if (this.view.isReplyBox && !this.view.removeAfterClose) {
      // reload iframe so we don't leave users without a reply UI
      this.view.skipClickPrompt = false;
      window.location.href = Url.create(Env.getUrlNoParams(), this.urlParams());
    } else {
      // close new msg
      this.view.renderModule.closeMsg();
    }
  };

  private fillAndRenderDraftHeaders = async (decoded: MimeContentWithHeaders) => {
    this.view.recipientsModule.addRecipientsAndShowPreview({ to: decoded.to, cc: decoded.cc, bcc: decoded.bcc });
    if (decoded.from) {
      this.view.S.now('input_from').val(decoded.from);
    }
    if (decoded.subject) {
      this.lastDraftSubject = decoded.subject;
      this.view.S.cached('input_subject').val(decoded.subject);
    }
  };

  private decryptAndRenderDraft = async (encrypted: MimeProccesedMsg): Promise<void> => {
    const rawBlock = encrypted.blocks.find(b => ['encryptedMsg', 'signedMsg', 'pkcs7'].includes(b.type));
    if (!rawBlock) {
      await this.abortAndRenderReplyMsgComposeTableIfIsReplyBox('!rawBlock');
      return;
    }
    const decrypted = await MsgUtil.decryptMessage({
      kisWithPp: await KeyStore.getAllWithOptionalPassPhrase(this.view.acctEmail),
      encryptedData: rawBlock.content,
      verificationPubs: [],
    });
    if (!decrypted.success) {
      if (decrypted.error.type === DecryptErrTypes.needPassphrase) {
        // "close" button will wipe this frame out, so no need to exit the recursion
        await this.renderPPDialogAndWaitWhenPPEntered(decrypted.longids.needPassphrase);
        await this.decryptAndRenderDraft(encrypted);
      }
      await this.abortAndRenderReplyMsgComposeTableIfIsReplyBox('!decrypted.success');
      return;
    }
    this.wasMsgLoadedFromDraft = true;
    this.view.S.cached('prompt').css({ display: 'none' });
    const { blocks, isRichText } = await MsgBlockParser.fmtDecryptedAsSanitizedHtmlBlocks(decrypted.content, 'IMG-KEEP');
    const sanitizedContent = blocks.find(b => b.type === 'decryptedHtml')?.content;
    if (!sanitizedContent) {
      await this.abortAndRenderReplyMsgComposeTableIfIsReplyBox('!sanitizedContent');
      return;
    }
    if (isRichText) {
      this.view.sendBtnModule.popover.toggleItemTick($('.action-toggle-richtext-sending-option'), 'richtext', true);
    }
    this.view.inputModule.inputTextHtmlSetSafely(Str.with(sanitizedContent));
    this.view.inputModule.squire.focus();
  };

  private hasBodyChanged = (msgBody: string) => {
    if (msgBody && msgBody !== this.lastDraftBody) {
      this.lastDraftBody = msgBody;
      return true;
    }
    return false;
  };

  private hasSubjectChanged = (subject: string) => {
    if (this.view.isReplyBox) {
      // user cannot change reply subject
      return false; // this helps prevent unwanted empty drafts
    }
    if (subject && subject !== this.lastDraftSubject) {
      this.lastDraftSubject = subject;
      return true;
    }
    return false;
  };

  private renderPPDialogAndWaitWhenPPEntered = async (longids: string[]) => {
    if (this.view.isReplyBox) {
      const promptHtml = `<div class="draft-passphrase-container"><a class="action_open_passphrase_dialog" href="#">Enter passphrase</a> to open this draft.</div>`;
      Xss.sanitizeRender(this.view.S.cached('prompt'), promptHtml).css({ display: 'block' });
      this.view.sizeModule.resizeComposeBox();
    } else {
      Xss.sanitizeRender(
        this.view.S.cached('prompt'),
        `
        <div style="font-size: 18px">Waiting for pass phrase to open draft...</div>
        <div class="mt-20">
          <button href="#" data-test="action-open-passphrase-dialog" class="button long green action_open_passphrase_dialog">Enter pass phrase</button>
          <button href="#" class="button gray action_close">close</button>
        </div>
      `
      ).css({ display: 'flex', height: '100%' });
      BrowserMsg.send.setActiveWindow(this.view.parentTabId, { frameId: this.view.frameId });
    }
    this.view.S.cached('prompt')
      .find('.action_open_passphrase_dialog')
      .on(
        'click',
        this.view.setHandler(async () => {
          BrowserMsg.send.passphraseDialog(this.view.parentTabId, { type: 'draft', longids });
        })
      )
      .trigger('focus');
    this.view.S.cached('prompt')
      .find('.action_close')
      .on(
        'click',
        this.view.setHandler(() => {
          this.view.renderModule.closeMsg();
        })
      );
    const setActiveWindow = this.view.setHandler(async () => {
      BrowserMsg.send.setActiveWindow(this.view.parentTabId, { frameId: this.view.frameId });
    });
    this.view.S.cached('prompt').on('click', setActiveWindow).trigger('click');
    await PassphraseStore.waitUntilPassphraseChanged(this.view.acctEmail, longids, 1000, this.view.ppChangedPromiseCancellation);
  };

  private abortAndRenderReplyMsgComposeTableIfIsReplyBox = async (reason: string) => {
    console.info(`gmail.initialDraftLoad: ${reason}`);
    if (this.view.isReplyBox) {
      await this.view.renderModule.renderReplyMsgComposeTable();
    }
  };

  private urlParams = () => {
    // used to reload the frame with updated params
    return {
      acctEmail: this.view.acctEmail,
      draftId: this.view.draftId,
      threadId: this.view.threadId,
      replyMsgId: this.view.replyMsgId,
      ...this.view.replyParams,
      frameId: this.view.frameId,
      tabId: this.view.tabId,
      isReplyBox: this.view.isReplyBox,
      skipClickPrompt: this.view.skipClickPrompt,
      parentTabId: this.view.parentTabId,
      disableDraftSaving: this.view.disableDraftSaving,
      debug: this.view.debug,
      removeAfterClose: this.view.removeAfterClose,
      replyPubkeyMismatch: this.view.replyPubkeyMismatch,
    };
  };
}
