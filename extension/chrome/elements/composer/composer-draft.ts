/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { AjaxErr } from '../../../js/common/api/error/api-error-types.js';
import { ApiErr } from '../../../js/common/api/error/api-error.js';
import { BrowserMsg } from '../../../js/common/browser/browser-msg.js';
import { Buf } from '../../../js/common/core/buf.js';
import { Catch } from '../../../js/common/platform/catch.js';
import { Composer } from './composer.js';
import { ComposerComponent } from './composer-abstract-component.js';
import { Env } from '../../../js/common/browser/env.js';
import { Mime } from '../../../js/common/core/mime.js';
import { PgpArmor } from '../../../js/common/core/pgp-armor.js';
import { PgpMsg } from '../../../js/common/core/pgp-msg.js';
import { Recipients } from '../../../js/common/api/email_provider/email_provider_api.js';
import { Store } from '../../../js/common/platform/store.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { Url } from '../../../js/common/core/common.js';
import { Xss } from '../../../js/common/platform/xss.js';

export class ComposerDraft extends ComposerComponent {

  private currentlySavingDraft = false;
  private saveDraftInterval?: number;
  private lastDraftBody?: string;
  private lastDraftSubject = '';

  private SAVE_DRAFT_FREQUENCY = 3000;

  public wasMsgLoadedFromDraft = false;

  constructor(composer: Composer) {
    super(composer);
    if (!this.view.disableDraftSaving) {
      this.saveDraftInterval = Catch.setHandledInterval(() => this.draftSave(), this.SAVE_DRAFT_FREQUENCY);
    }
  }

  public initActions = async (): Promise<void> => {
    $('.delete_draft').click(this.view.setHandler(async () => {
      await this.draftDelete();
      if (this.view.isReplyBox && !this.view.removeAfterClose) { // reload iframe so we don't leave users without a reply UI
        this.view.skipClickPrompt = false;
        window.location.href = Url.create(Env.getUrlNoParams(), this.view.urlParams());
      } else { // close new msg
        this.composer.render.closeMsg();
      }
    }, this.composer.errs.handlers('delete draft')));
    await this.composer.initPromise;
    this.composer.recipients.onRecipientAdded(async () => {
      await this.draftSave(true);
    });
  }

  public initialDraftLoad = async (draftId: string): Promise<void> => {
    if (this.view.isReplyBox) {
      Xss.sanitizeRender(this.composer.S.cached('prompt'), `Loading draft.. ${Ui.spinner('green')}`);
    }
    try {
      const draftGetRes = await this.composer.emailProvider.draftGet(draftId, 'raw');
      if (!draftGetRes) {
        await this.abortAndRenderReplyMsgComposeTableIfIsReplyBox('!draftGetRes');
        return;
      }
      const parsedMsg = await Mime.decode(Buf.fromBase64UrlStr(draftGetRes.message.raw!));
      const armored = PgpArmor.clip(parsedMsg.text || Xss.htmlSanitizeAndStripAllTags(parsedMsg.html || '', '\n') || '');
      if (!armored) {
        await this.abortAndRenderReplyMsgComposeTableIfIsReplyBox('!armored');
        return;
      }
      await this.decryptAndRenderDraft(armored, parsedMsg);
    } catch (e) {
      if (ApiErr.isNetErr(e)) {
        Xss.sanitizeRender('body', `Failed to load draft. ${Ui.retryLink()}`);
      } else if (ApiErr.isAuthPopupNeeded(e)) {
        BrowserMsg.send.notificationShowAuthPopupNeeded(this.view.parentTabId, { acctEmail: this.view.acctEmail });
        Xss.sanitizeRender('body', `Failed to load draft - FlowCrypt needs to be re-connected to Gmail. ${Ui.retryLink()}`);
      } else if (this.view.isReplyBox && ApiErr.isNotFound(e)) {
        console.info('about to reload reply_message automatically: get draft 404', this.view.acctEmail);
        await Ui.time.sleep(500);
        await this.composer.storage.draftMetaDelete(this.view.draftId, this.view.threadId);
        console.info('Above red message means that there used to be a draft, but was since deleted. (not an error)');
        this.view.draftId = '';
        window.location.href = Url.create(Env.getUrlNoParams(), this.view.urlParams());
      } else {
        Catch.reportErr(e);
        await this.abortAndRenderReplyMsgComposeTableIfIsReplyBox('exception');
      }
    }
  }

  public draftSave = async (forceSave: boolean = false): Promise<void> => {
    if (this.hasBodyChanged(this.composer.input.squire.getHTML()) || this.hasSubjectChanged(String(this.composer.S.cached('input_subject').val())) || forceSave) {
      this.currentlySavingDraft = true;
      try {
        this.composer.S.cached('send_btn_note').text('Saving');
        const primaryKi = await this.composer.storage.getKey(this.composer.sender.getSender());
        const plaintext = this.composer.input.extract('text', 'input_text');
        const encrypted = await PgpMsg.encrypt({ pubkeys: [primaryKi.public], data: Buf.fromUtfStr(plaintext), armor: true }) as OpenPGP.EncryptArmorResult;
        let body: string;
        if (this.view.threadId) { // reply draft
          body = `[cryptup:link:draft_reply:${this.view.threadId}]\n\n${encrypted.data}`;
        } else if (this.view.draftId) { // new message compose draft with known draftid
          body = `[cryptup:link:draft_compose:${this.view.draftId}]\n\n${encrypted.data}`;
        } else { // new message compose draft where draftId is not yet known
          body = encrypted.data;
        }
        const subject = String(this.composer.S.cached('input_subject').val() || (this.view.replyParams ? this.view.replyParams.subject : undefined) || 'FlowCrypt draft');
        const to = this.composer.recipients.getRecipients().map(r => r.email); // else google complains https://github.com/FlowCrypt/flowcrypt-browser/issues/1370
        const recipients: Recipients = { to: [], cc: [], bcc: [] };
        for (const recipient of this.composer.recipients.getRecipients()) {
          recipients[recipient.sendingType]!.push(recipient.email);
        }
        const mimeMsg = await Mime.encode({ 'text/plain': body }, {
          To: recipients.to!.join(','),
          Cc: recipients.cc!.join(','),
          Bcc: recipients.bcc!.join(','),
          From: this.composer.sender.getSender(),
          Subject: subject
        }, []);
        if (!this.view.draftId) {
          const { id } = await this.composer.emailProvider.draftCreate(mimeMsg, this.view.threadId);
          this.composer.S.cached('send_btn_note').text('Saved');
          this.view.draftId = id;
          await this.composer.storage.draftMetaSet(id, this.view.threadId, to, String(this.composer.S.cached('input_subject').val()));
          // recursing one more time, because we need the draftId we get from this reply in the message itself
          // essentially everytime we save draft for the first time, we have to save it twice
          // currentlySavingDraft will remain true for now
          await this.draftSave(true); // forceSave = true
        } else {
          await this.composer.emailProvider.draftUpdate(this.view.draftId, mimeMsg);
          this.composer.S.cached('send_btn_note').text('Saved');
        }
      } catch (e) {
        if (ApiErr.isNetErr(e)) {
          this.composer.S.cached('send_btn_note').text('Not saved (network)');
        } else if (ApiErr.isAuthPopupNeeded(e)) {
          BrowserMsg.send.notificationShowAuthPopupNeeded(this.view.parentTabId, { acctEmail: this.view.acctEmail });
          this.composer.S.cached('send_btn_note').text('Not saved (reconnect)');
        } else if (e instanceof Error && e.message.indexOf('Could not find valid key packet for encryption in key') !== -1) {
          this.composer.S.cached('send_btn_note').text('Not saved (bad key)');
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
          this.composer.S.cached('send_btn_note').text('Not saved (error)');
        }
      }
      this.currentlySavingDraft = false;
    }
  }

  public draftDelete = async () => {
    clearInterval(this.saveDraftInterval);
    await Ui.time.wait(() => !this.currentlySavingDraft ? true : undefined);
    if (this.view.draftId) {
      await this.composer.storage.draftMetaDelete(this.view.draftId, this.view.threadId);
      try {
        await this.composer.emailProvider.draftDelete(this.view.draftId);
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

  private decryptAndRenderDraft = async (encryptedArmoredDraft: string, headers: { subject?: string, from?: string; to: string[], cc: string[], bcc: string[] }): Promise<void> => {
    const passphrase = await this.composer.storage.passphraseGet();
    if (typeof passphrase !== 'undefined') {
      const result = await PgpMsg.decrypt({ kisWithPp: await Store.keysGetAllWithPp(this.view.acctEmail), encryptedData: Buf.fromUtfStr(encryptedArmoredDraft) });
      if (result.success) {
        this.wasMsgLoadedFromDraft = true;
        if (headers.subject) {
          this.composer.S.cached('input_subject').val(headers.subject);
        }
        this.composer.S.cached('prompt').css({ display: 'none' });
        this.composer.input.inputTextHtmlSetSafely(Xss.escape(result.content.toUtfStr()).replace(/\n/g, '<br>'));
        await this.composer.recipients.addRecipientsAndShowPreview({ to: headers.to, cc: headers.cc, bcc: headers.bcc });
        if (headers.from) {
          this.composer.S.now('input_from').val(headers.from);
        }
        this.composer.input.squire.focus();
      }
    } else {
      await this.renderPPDialogAndWaitWhenPPEntered();
      await this.decryptAndRenderDraft(encryptedArmoredDraft, headers);
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
      Xss.sanitizeRender(this.composer.S.cached('prompt'), promptText).css({ display: 'block' });
      this.composer.size.resizeComposeBox();
    } else {
      Xss.sanitizeRender(this.composer.S.cached('prompt'), `${promptText}<br><br><a href="#" class="action_close">close</a>`).css({ display: 'block', height: '100%' });
    }
    this.composer.S.cached('prompt').find('a.action_open_passphrase_dialog').click(this.view.setHandler(() => {
      BrowserMsg.send.passphraseDialog(this.view.parentTabId, { type: 'draft', longids: ['primary'] });
    }));
    this.composer.S.cached('prompt').find('a.action_close').click(this.view.setHandler(() => this.composer.render.closeMsg()));
    await this.composer.storage.whenMasterPassphraseEntered();
  }

  private abortAndRenderReplyMsgComposeTableIfIsReplyBox = async (reason: string) => {
    console.info(`gmail.initialDraftLoad: ${reason}`);
    if (this.view.isReplyBox) {
      await this.composer.render.renderReplyMsgComposeTable();
    }
  }
}
