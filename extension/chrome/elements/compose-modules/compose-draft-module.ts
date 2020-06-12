/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Mime, MimeContent, MimeProccesedMsg } from '../../../js/common/core/mime.js';
import { AjaxErr } from '../../../js/common/api/error/api-error-types.js';
import { ApiErr } from '../../../js/common/api/error/api-error.js';
import { BrowserMsg } from '../../../js/common/browser/browser-msg.js';
import { Buf } from '../../../js/common/core/buf.js';
import { Catch } from '../../../js/common/platform/catch.js';
import { EncryptedMsgMailFormatter } from './formatters/encrypted-mail-msg-formatter.js';
import { Env } from '../../../js/common/browser/env.js';
import { MsgBlockParser } from '../../../js/common/core/msg-block-parser.js';
import { PgpMsg } from '../../../js/common/core/crypto/pgp/pgp-msg.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { Url } from '../../../js/common/core/common.js';
import { Xss } from '../../../js/common/platform/xss.js';
import { ViewModule } from '../../../js/common/view-module.js';
import { ComposeView } from '../compose.js';
import { KeyStore } from '../../../js/common/platform/store/key-store.js';
import { PgpKey } from '../../../js/common/core/crypto/key.js';

export class ComposeDraftModule extends ViewModule<ComposeView> {

  public wasMsgLoadedFromDraft = false;

  private currentlySavingDraft = false;
  private saveDraftInterval?: number;
  private lastDraftBody?: string;
  private lastDraftSubject = '';
  private SAVE_DRAFT_FREQUENCY = 3000;

  constructor(composer: ComposeView) {
    super(composer);
    if (!this.view.disableDraftSaving) {
      this.saveDraftInterval = Catch.setHandledInterval(() => this.draftSave(), this.SAVE_DRAFT_FREQUENCY);
    }
  }

  public setHandlers = () => {
    $('.delete_draft').click(this.view.setHandler(() => this.deleteDraftClickHandler(), this.view.errModule.handle('delete draft')));
    this.view.recipientsModule.onRecipientAdded(async () => await this.draftSave(true));
  }

  public initialDraftLoad = async (draftId: string): Promise<void> => {
    if (this.view.isReplyBox) {
      Xss.sanitizeRender(this.view.S.cached('prompt'), `Loading draft.. ${Ui.spinner('green')}`);
    }
    try {
      const draftGetRes = await this.view.emailProvider.draftGet(draftId, 'raw');
      if (!draftGetRes) {
        return await this.abortAndRenderReplyMsgComposeTableIfIsReplyBox('!draftGetRes');
      }
      const decoded = await Mime.decode(Buf.fromBase64UrlStr(draftGetRes.message.raw!));
      const processed = Mime.processDecoded(decoded);
      await this.fillAndRenderDraftHeaders(decoded);
      await this.decryptAndRenderDraft(processed);
    } catch (e) {
      if (ApiErr.isNetErr(e)) {
        Xss.sanitizeRender('body', `Failed to load draft. ${Ui.retryLink()}`);
      } else if (ApiErr.isAuthPopupNeeded(e)) {
        BrowserMsg.send.notificationShowAuthPopupNeeded(this.view.parentTabId, { acctEmail: this.view.acctEmail });
        Xss.sanitizeRender('body', `Failed to load draft - FlowCrypt needs to be re-connected to Gmail. ${Ui.retryLink()}`);
      } else if (this.view.isReplyBox && ApiErr.isNotFound(e)) {
        console.info('about to reload reply_message automatically: get draft 404', this.view.acctEmail);
        await Ui.time.sleep(500);
        await this.view.storageModule.draftMetaDelete(this.view.draftId, this.view.threadId);
        console.info('Above red message means that there used to be a draft, but was since deleted. (not an error)');
        this.view.draftId = '';
        window.location.href = Url.create(Env.getUrlNoParams(), this.urlParams());
      } else {
        Catch.reportErr(e);
        await this.abortAndRenderReplyMsgComposeTableIfIsReplyBox('exception');
      }
    }
  }

  public draftDelete = async () => {
    clearInterval(this.saveDraftInterval);
    await Ui.time.wait(() => !this.currentlySavingDraft ? true : undefined);
    if (this.view.draftId) {
      await this.view.storageModule.draftMetaDelete(this.view.draftId, this.view.threadId);
      try {
        await this.view.emailProvider.draftDelete(this.view.draftId);
        this.view.draftId = '';
      } catch (e) {
        if (ApiErr.isAuthPopupNeeded(e)) {
          BrowserMsg.send.notificationShowAuthPopupNeeded(this.view.parentTabId, { acctEmail: this.view.acctEmail });
        } else if (ApiErr.isNotFound(e)) {
          console.info(`draftDelete: ${e.message}`);
        } else if (!ApiErr.isNetErr(e)) {
          Catch.reportErr(e);
        }
      }
    }
  }

  public draftSave = async (forceSave: boolean = false): Promise<void> => {
    if (this.hasBodyChanged(this.view.inputModule.squire.getHTML()) || this.hasSubjectChanged(String(this.view.S.cached('input_subject').val())) || forceSave) {
      this.currentlySavingDraft = true;
      try {
        const msgData = this.view.inputModule.extractAll();
        const primaryKi = await this.view.storageModule.getKey(msgData.from);
        const pubkeys = [{ isMine: true, email: msgData.from, pubkey: await PgpKey.parse(primaryKi.public) }];
        msgData.pwd = undefined; // not needed for drafts
        const sendable = await new EncryptedMsgMailFormatter(this.view, true).sendableMsg(msgData, pubkeys);
        this.view.S.cached('send_btn_note').text('Saving');
        if (this.view.threadId) { // reply draft
          sendable.body['text/plain'] = `[cryptup:link:draft_reply:${this.view.threadId}]\n\n${sendable.body['text/plain'] || ''}`;
        } else if (this.view.draftId) { // new message compose draft with known draftid
          sendable.body['text/plain'] = `[cryptup:link:draft_compose:${this.view.draftId}]\n\n${sendable.body['text/plain'] || ''}`;
        }
        const mimeMsg = await sendable.toMime();
        if (!this.view.draftId) {
          const { id } = await this.view.emailProvider.draftCreate(mimeMsg, this.view.threadId);
          this.view.S.cached('send_btn_note').text('Saved');
          this.view.draftId = id;
          await this.view.storageModule.draftMetaSet(id, this.view.threadId, msgData.recipients.to || [], String(this.view.S.cached('input_subject').val()));
          // recursing one more time, because we need the draftId we get from this reply in the message itself
          // essentially everytime we save draft for the first time, we have to save it twice
          // currentlySavingDraft will remain true for now
          await this.draftSave(true); // forceSave = true
        } else {
          await this.view.emailProvider.draftUpdate(this.view.draftId, mimeMsg);
          this.view.S.cached('send_btn_note').text('Saved');
        }
      } catch (e) {
        if (ApiErr.isNetErr(e)) {
          this.view.S.cached('send_btn_note').text('Not saved (network)');
        } else if (ApiErr.isAuthPopupNeeded(e)) {
          BrowserMsg.send.notificationShowAuthPopupNeeded(this.view.parentTabId, { acctEmail: this.view.acctEmail });
          this.view.S.cached('send_btn_note').text('Not saved (reconnect)');
        } else if (e instanceof Error && e.message.indexOf('Could not find valid key packet for encryption in key') !== -1) {
          this.view.S.cached('send_btn_note').text('Not saved (bad key)');
        } else if (this.view.draftId && (ApiErr.isNotFound(e) || (e instanceof AjaxErr && e.status === 400 && e.responseText.indexOf('Message not a draft') !== -1))) {
          // not found - updating draft that was since deleted
          // not a draft - updating draft that was since sent as a message (in another window), and is not a draft anymore
          this.view.draftId = ''; // forget there was a draftId - next step will create a new draftId
          await this.draftSave(true); // forceSave=true to not skip
        } else if (!this.view.draftId && ApiErr.isNotFound(e)) {
          // not found - creating draft on a thread that does not exist
          this.view.threadId = ''; // forget there was a threadId
          await this.draftSave(true); // forceSave=true to not skip
        } else {
          Catch.reportErr(e);
          this.view.S.cached('send_btn_note').text('Not saved (error)');
        }
      }
      this.currentlySavingDraft = false;
    }
  }

  private deleteDraftClickHandler = async () => {
    await this.draftDelete();
    if (this.view.isReplyBox && !this.view.removeAfterClose) { // reload iframe so we don't leave users without a reply UI
      this.view.skipClickPrompt = false;
      window.location.href = Url.create(Env.getUrlNoParams(), this.urlParams());
    } else { // close new msg
      this.view.renderModule.closeMsg();
    }
  }

  private fillAndRenderDraftHeaders = async (decoded: MimeContent) => {
    await this.view.recipientsModule.addRecipientsAndShowPreview({ to: decoded.to, cc: decoded.cc, bcc: decoded.bcc });
    if (decoded.from) {
      this.view.S.now('input_from').val(decoded.from);
    }
    if (decoded.subject) {
      this.view.S.cached('input_subject').val(decoded.subject);
    }
  }

  private decryptAndRenderDraft = async (encrypted: MimeProccesedMsg): Promise<void> => {
    const rawBlock = encrypted.blocks.find(b => b.type === 'encryptedMsg' || b.type === 'signedMsg');
    if (!rawBlock) {
      return await this.abortAndRenderReplyMsgComposeTableIfIsReplyBox('!rawBlock');
    }
    const encryptedData = rawBlock.content instanceof Buf ? rawBlock.content : Buf.fromUtfStr(rawBlock.content);
    const passphrase = await this.view.storageModule.passphraseGet();
    if (typeof passphrase !== 'undefined') {
      const decrypted = await PgpMsg.decrypt({ kisWithPp: await KeyStore.getAllWithPp(this.view.acctEmail), encryptedData });
      if (!decrypted.success) {
        return await this.abortAndRenderReplyMsgComposeTableIfIsReplyBox('!decrypted.success');
      }
      this.wasMsgLoadedFromDraft = true;
      this.view.S.cached('prompt').css({ display: 'none' });
      const { blocks, isRichText } = await MsgBlockParser.fmtDecryptedAsSanitizedHtmlBlocks(decrypted.content, 'IMG-KEEP');
      const sanitizedContent = blocks.find(b => b.type === 'decryptedHtml')?.content;
      if (!sanitizedContent) {
        return await this.abortAndRenderReplyMsgComposeTableIfIsReplyBox('!sanitizedContent');
      }
      if (isRichText) {
        this.view.sendBtnModule.popover.toggleItemTick($('.action-toggle-richtext-sending-option'), 'richtext', true);
      }
      this.view.inputModule.inputTextHtmlSetSafely(sanitizedContent.toString());
      this.view.inputModule.squire.focus();
    } else {
      await this.renderPPDialogAndWaitWhenPPEntered();
      await this.decryptAndRenderDraft(encrypted);
    }
  }

  private hasBodyChanged = (msgBody: string) => {
    if (this.lastDraftBody === undefined) { // first check
      this.lastDraftBody = msgBody;
      return false;
    }
    if (msgBody && msgBody !== this.lastDraftBody) {
      this.lastDraftBody = msgBody;
      return true;
    }
    return false;
  }

  private hasSubjectChanged = (subject: string) => {
    if (this.view.isReplyBox) { // user cannot change reply subject
      return false; // this helps prevent unwanted empty drafts
    }
    if (subject && subject !== this.lastDraftSubject) {
      this.lastDraftSubject = subject;
      return true;
    }
    return false;
  }

  private renderPPDialogAndWaitWhenPPEntered = async () => {
    const promptText = `Waiting for <a href="#" class="action_open_passphrase_dialog">pass phrase</a> to open draft..`;
    if (this.view.isReplyBox) {
      Xss.sanitizeRender(this.view.S.cached('prompt'), promptText).css({ display: 'block' });
      this.view.sizeModule.resizeComposeBox();
    } else {
      Xss.sanitizeRender(this.view.S.cached('prompt'), `${promptText}<br><br><a href="#" class="action_close">close</a>`).css({ display: 'block', height: '100%' });
    }
    this.view.S.cached('prompt').find('a.action_open_passphrase_dialog').click(this.view.setHandler(() => {
      BrowserMsg.send.passphraseDialog(this.view.parentTabId, { type: 'draft', longids: ['primary'] });
    }));
    this.view.S.cached('prompt').find('a.action_close').click(this.view.setHandler(() => this.view.renderModule.closeMsg()));
    await this.view.storageModule.whenMasterPassphraseEntered();
  }

  private abortAndRenderReplyMsgComposeTableIfIsReplyBox = async (reason: string) => {
    console.info(`gmail.initialDraftLoad: ${reason}`);
    if (this.view.isReplyBox) {
      await this.view.renderModule.renderReplyMsgComposeTable();
    }
  }

  private urlParams = () => { // used to reload the frame with updated params
    return {
      acctEmail: this.view.acctEmail, draftId: this.view.draftId, threadId: this.view.threadId, replyMsgId: this.view.replyMsgId,
      ...this.view.replyParams, frameId: this.view.frameId, tabId: this.view.tabId, isReplyBox: this.view.isReplyBox,
      skipClickPrompt: this.view.skipClickPrompt, parentTabId: this.view.parentTabId, disableDraftSaving: this.view.disableDraftSaving,
      debug: this.view.debug, removeAfterClose: this.view.removeAfterClose, replyPubkeyMismatch: this.view.replyPubkeyMismatch,
    };
  }

}
