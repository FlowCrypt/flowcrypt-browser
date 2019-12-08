/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Ui, Env } from '../browser.js';
import { Xss } from '../platform/xss.js';
import { Mime } from '../core/mime.js';
import { Buf } from '../core/buf.js';
import { Pgp, PgpMsg } from '../core/pgp.js';
import { Api, AjaxErr } from '../api/api.js';
import { BrowserMsg } from '../extension.js';
import { Catch } from '../platform/catch.js';
import { Store } from '../platform/store.js';
import { Composer } from './composer.js';
import { Recipients } from './interfaces/composer-types.js';
import { ComposerComponent } from './interfaces/composer-component.js';
import { Url } from '../core/common.js';

export class ComposerDraft extends ComposerComponent {

  private currentlySavingDraft = false;
  private saveDraftInterval?: number;
  private lastDraftBody?: string;
  private lastDraftSubject = '';

  private SAVE_DRAFT_FREQUENCY = 3000;

  constructor(composer: Composer) {
    super(composer);
    if (!this.urlParams.disableDraftSaving) {
      this.saveDraftInterval = Catch.setHandledInterval(() => this.draftSave(), this.SAVE_DRAFT_FREQUENCY);
    }
  }

  async initActions(): Promise<void> {
    $('.delete_draft').click(Ui.event.handle(async () => {
      await this.draftDelete();
      if (this.urlParams.isReplyBox && !this.urlParams.removeAfterClose) { // reload iframe so we don't leave users without a reply UI
        this.urlParams.skipClickPrompt = false;
        window.location.href = Url.create(Env.getUrlNoParams(), this.urlParams);
      } else { // close new msg
        this.composer.render.closeMsg();
      }
    }, this.composer.errs.handlers('delete draft')));
    await this.composer.initPromise;
    this.composer.recipients.onRecipientAdded(async () => {
      await this.draftSave(true);
    });
  }

  public async initialDraftLoad(draftId: string): Promise<boolean> {
    if (this.urlParams.isReplyBox) {
      Xss.sanitizeRender(this.composer.S.cached('prompt'), `Loading draft.. ${Ui.spinner('green')}`);
    }
    try {
      const draftGetRes = await this.composer.app.emailProviderDraftGet(draftId);
      if (!draftGetRes) {
        await this.abortAndRenderReplyMsgComposeTableIfIsReplyBox('!draftGetRes');
        return false;
      }
      const parsedMsg = await Mime.decode(Buf.fromBase64UrlStr(draftGetRes.message.raw!));
      const armored = Pgp.armor.clip(parsedMsg.text || Xss.htmlSanitizeAndStripAllTags(parsedMsg.html || '', '\n') || '');
      if (!armored) {
        await this.abortAndRenderReplyMsgComposeTableIfIsReplyBox('!armored');
        return false;
      }
      return await this.decryptAndRenderDraft(armored, parsedMsg);
    } catch (e) {
      if (Api.err.isNetErr(e)) {
        Xss.sanitizeRender('body', `Failed to load draft. ${Ui.retryLink()}`);
      } else if (Api.err.isAuthPopupNeeded(e)) {
        BrowserMsg.send.notificationShowAuthPopupNeeded(this.urlParams.parentTabId, { acctEmail: this.urlParams.acctEmail });
        Xss.sanitizeRender('body', `Failed to load draft - FlowCrypt needs to be re-connected to Gmail. ${Ui.retryLink()}`);
      } else if (this.urlParams.isReplyBox && Api.err.isNotFound(e)) {
        Catch.log('about to reload reply_message automatically: get draft 404', this.urlParams.acctEmail);
        await Ui.time.sleep(500);
        await this.composer.storage.storageDraftMetaDelete(this.urlParams.draftId, this.urlParams.threadId);
        console.info('Above red message means that there used to be a draft, but was since deleted. (not an error)');
        this.urlParams.draftId = '';
        window.location.href = Url.create(Env.getUrlNoParams(), this.urlParams);
      } else {
        Catch.reportErr(e);
        await this.abortAndRenderReplyMsgComposeTableIfIsReplyBox('exception');
      }
      return false;
    }
  }

  public draftSave = async (forceSave: boolean = false): Promise<void> => {
    if (this.hasBodyChanged(this.composer.S.cached('input_text').text()) || this.hasSubjectChanged(String(this.composer.S.cached('input_subject').val())) || forceSave) {
      this.currentlySavingDraft = true;
      try {
        this.composer.S.cached('send_btn_note').text('Saving');
        const primaryKi = await this.composer.storage.storageGetKey(this.urlParams.acctEmail, this.composer.sender.getSender());
        const plaintext = this.composer.input.extract('text', 'input_text');
        const encrypted = await PgpMsg.encrypt({ pubkeys: [primaryKi.public], data: Buf.fromUtfStr(plaintext), armor: true }) as OpenPGP.EncryptArmorResult;
        let body: string;
        if (this.urlParams.threadId) { // reply draft
          body = `[cryptup:link:draft_reply:${this.urlParams.threadId}]\n\n${encrypted.data}`;
        } else if (this.urlParams.draftId) { // new message compose draft with known draftid
          body = `[cryptup:link:draft_compose:${this.urlParams.draftId}]\n\n${encrypted.data}`;
        } else { // new message compose draft where draftId is not yet known
          body = encrypted.data;
        }
        const subject = String(this.composer.S.cached('input_subject').val() || this.urlParams.subject || 'FlowCrypt draft');
        const to = this.composer.recipients.getRecipients().map(r => r.email); // else google complains https://github.com/FlowCrypt/flowcrypt-browser/issues/1370
        const recipients: Recipients = { to: [], cc: [], bcc: [] };
        for (const recipient of this.composer.recipients.getRecipients()) {
          recipients[recipient.sendingType]!.push(recipient.email);
        }
        const mimeMsg = await Mime.encode(body, {
          To: recipients.to!.join(','),
          Cc: recipients.cc!.join(','),
          Bcc: recipients.bcc!.join(','),
          From: this.composer.sender.getSender(),
          Subject: subject
        }, []);
        if (!this.urlParams.draftId) {
          const { id } = await this.composer.app.emailProviderDraftCreate(this.urlParams.acctEmail, mimeMsg, this.urlParams.threadId);
          this.composer.S.cached('send_btn_note').text('Saved');
          this.urlParams.draftId = id;
          await this.composer.storage.storageDraftMetaSet(id, this.urlParams.threadId, to, String(this.composer.S.cached('input_subject').val()));
          // recursing one more time, because we need the draftId we get from this reply in the message itself
          // essentially everytime we save draft for the first time, we have to save it twice
          // currentlySavingDraft will remain true for now
          await this.draftSave(true); // forceSave = true
        } else {
          await this.composer.app.emailProviderDraftUpdate(this.urlParams.draftId, mimeMsg);
          this.composer.S.cached('send_btn_note').text('Saved');
        }
      } catch (e) {
        if (Api.err.isNetErr(e)) {
          this.composer.S.cached('send_btn_note').text('Not saved (network)');
        } else if (Api.err.isAuthPopupNeeded(e)) {
          BrowserMsg.send.notificationShowAuthPopupNeeded(this.urlParams.parentTabId, { acctEmail: this.urlParams.acctEmail });
          this.composer.S.cached('send_btn_note').text('Not saved (reconnect)');
        } else if (e instanceof Error && e.message.indexOf('Could not find valid key packet for encryption in key') !== -1) {
          this.composer.S.cached('send_btn_note').text('Not saved (bad key)');
        } else if (this.urlParams.draftId && (Api.err.isNotFound(e) || (e instanceof AjaxErr && e.status === 400 && e.responseText.indexOf('Message not a draft') !== -1))) {
          // not found - updating draft that was since deleted
          // not a draft - updating draft that was since sent as a message (in another window), and is not a draft anymore
          this.urlParams.draftId = ''; // forget there was a draftId - next step will create a new draftId
          await this.draftSave(true); // forceSave=true to not skip
        } else if (!this.urlParams.draftId && Api.err.isNotFound(e)) {
          // not found - creating draft on a thread that does not exist
          this.urlParams.threadId = ''; // forget there was a threadId
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
    if (this.urlParams.draftId) {
      await this.composer.storage.storageDraftMetaDelete(this.urlParams.draftId, this.urlParams.threadId);
      try {
        await this.composer.app.emailProviderDraftDelete(this.urlParams.draftId);
        this.urlParams.draftId = '';
      } catch (e) {
        if (Api.err.isAuthPopupNeeded(e)) {
          BrowserMsg.send.notificationShowAuthPopupNeeded(this.urlParams.parentTabId, { acctEmail: this.urlParams.acctEmail });
        } else if (Api.err.isNotFound(e)) {
          console.info(`draftDelete: ${e.message}`);
        } else if (!Api.err.isNetErr(e)) {
          Catch.reportErr(e);
        }
      }
    }
  }

  private async decryptAndRenderDraft(encryptedArmoredDraft: string, headers: { subject?: string, from?: string; to: string[], cc: string[], bcc: string[] }): Promise<boolean> {
    const passphrase = await this.composer.storage.storagePassphraseGet();
    if (typeof passphrase !== 'undefined') {
      const result = await PgpMsg.decrypt({ kisWithPp: await Store.keysGetAllWithPp(this.urlParams.acctEmail), encryptedData: Buf.fromUtfStr(encryptedArmoredDraft) });
      if (result.success) {
        if (headers.subject) {
          this.composer.S.cached('input_subject').val(headers.subject);
        }
        this.composer.S.cached('prompt').css({ display: 'none' });
        Xss.sanitizeRender(this.composer.S.cached('input_text'), await Xss.htmlSanitizeKeepBasicTags(result.content.toUtfStr().replace(/\n/g, '<br>')));
        await this.composer.recipients.addRecipientsAndShowPreview({ to: headers.to, cc: headers.cc, bcc: headers.bcc });
        if (this.urlParams.isReplyBox) {
          await this.composer.render.renderReplyMsgComposeTable();
        }
        if (headers.from) {
          this.composer.S.now('input_from').val(headers.from);
        }
        this.composer.S.cached('input_text').focus();
        return true;
      }
    } else {
      await this.renderPPDialogAndWaitWhenPPEntered();
      return await this.decryptAndRenderDraft(encryptedArmoredDraft, headers);
    }
    return false;
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
    if (this.urlParams.isReplyBox) { // user cannot change reply subject
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
    if (this.urlParams.isReplyBox) {
      Xss.sanitizeRender(this.composer.S.cached('prompt'), promptText).css({ display: 'block' });
      this.composer.size.resizeComposeBox();
    } else {
      Xss.sanitizeRender(this.composer.S.cached('prompt'), `${promptText}<br><br><a href="#" class="action_close">close</a>`).css({ display: 'block', height: '100%' });
    }
    this.composer.S.cached('prompt').find('a.action_open_passphrase_dialog').click(Ui.event.handle(() => {
      BrowserMsg.send.passphraseDialog(this.urlParams.parentTabId, { type: 'draft', longids: ['primary'] });
    }));
    this.composer.S.cached('prompt').find('a.action_close').click(Ui.event.handle(() => this.composer.render.closeMsg()));
    await this.composer.storage.whenMasterPassphraseEntered();
  }

  private async abortAndRenderReplyMsgComposeTableIfIsReplyBox(reason: string) {
    console.info(`Google.gmail.initialDraftLoad: ${reason}`);
    if (this.urlParams.isReplyBox) {
      await this.composer.render.renderReplyMsgComposeTable();
    }
  }
}
