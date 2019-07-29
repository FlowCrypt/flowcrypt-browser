/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { ComposerAppFunctionsInterface } from './interfaces/composer-app-functions.js';
import { ComposerUrlParams } from './interfaces/composer-ur-params.js';
import { Ui, Env } from '../browser.js';
import { Xss } from '../platform/xss.js';
import { Mime } from '../core/mime.js';
import { Buf } from '../core/buf.js';
import { Pgp, PgpMsg } from '../core/pgp.js';
import { Api, AjaxError } from '../api/api.js';
import { BrowserMsg } from '../extension.js';
import { Catch } from '../platform/catch.js';
import { Store } from '../platform/store.js';
import { Str } from '../core/common.js';
import { Composer } from '../composer.js';

export class ComposerDraft {
    private app: ComposerAppFunctionsInterface;
    private composer: Composer;
    private urlParams: ComposerUrlParams;

    private currentlySavingDraft = false;
    private saveDraftInterval?: number;
    private lastDraftBody = '';
    private lastDraftSubject = '';

    private SAVE_DRAFT_FREQUENCY = 3000;

    constructor(app: ComposerAppFunctionsInterface, urlParams: ComposerUrlParams, composer: Composer) {
        this.app = app;
        this.urlParams = urlParams;
        this.composer = composer;
        if (!this.urlParams.disableDraftSaving) {
            this.saveDraftInterval = Catch.setHandledInterval(() => this.draftSave(), this.SAVE_DRAFT_FREQUENCY);
        }
    }

    public async initialDraftLoad(): Promise<void> {
        if (this.urlParams.isReplyBox) {
            Xss.sanitizeRender(this.composer.S.cached('prompt'), `Loading draft.. ${Ui.spinner('green')}`);
        }
        try {
            const draftGetRes = await this.app.emailProviderDraftGet(this.urlParams.draftId);
            if (!draftGetRes) {
                return this.abortAndRenderReplyMsgComposeTableIfIsReplyBox('!draftGetRes');
            }
            const parsedMsg = await Mime.decode(Buf.fromBase64UrlStr(draftGetRes.message.raw!));
            const armored = Pgp.armor.clip(parsedMsg.text || Xss.htmlSanitizeAndStripAllTags(parsedMsg.html || '', '\n') || '');
            if (!armored) {
                return this.abortAndRenderReplyMsgComposeTableIfIsReplyBox('!armored');
            }
            if (String(parsedMsg.headers.subject)) {
                this.composer.S.cached('input_subject').val(String(parsedMsg.headers.subject));
            }
            if (parsedMsg.to.length) {
                this.urlParams.to = parsedMsg.to;
            }
            await this.decryptAndRenderDraft(armored, parsedMsg);
        } catch (e) {
            if (Api.err.isNetErr(e)) {
                Xss.sanitizeRender('body', `Failed to load draft. ${Ui.retryLink()}`);
            } else if (Api.err.isAuthPopupNeeded(e)) {
                BrowserMsg.send.notificationShowAuthPopupNeeded(this.urlParams.parentTabId, { acctEmail: this.urlParams.acctEmail });
                Xss.sanitizeRender('body', `Failed to load draft - FlowCrypt needs to be re-connected to Gmail. ${Ui.retryLink()}`);
            } else if (this.urlParams.isReplyBox && Api.err.isNotFound(e)) {
                Catch.log('about to reload reply_message automatically: get draft 404', this.urlParams.acctEmail);
                await Ui.time.sleep(500);
                await this.app.storageSetDraftMeta(false, this.urlParams.draftId, this.urlParams.threadId);
                console.info('Above red message means that there used to be a draft, but was since deleted. (not an error)');
                this.urlParams.draftId = '';
                window.location.href = Env.urlCreate(Env.getUrlNoParams(), this.urlParams);
            } else {
                Catch.reportErr(e);
                return this.abortAndRenderReplyMsgComposeTableIfIsReplyBox('exception');
            }
        }
    }

    public draftSave = async (forceSave: boolean = false): Promise<void> => {
        if (this.hasBodyChanged(this.composer.S.cached('input_text').text()) || this.hasSubjectChanged(String(this.composer.S.cached('input_subject').val())) || forceSave) {
            this.currentlySavingDraft = true;
            try {
                this.composer.S.cached('send_btn_note').text('Saving');
                const primaryKi = await this.app.storageGetKey(this.urlParams.acctEmail);
                const plainText = this.composer.extractAsText('input_text');
                const encrypted = await PgpMsg.encrypt({ pubkeys: [primaryKi.public], data: Buf.fromUtfStr(plainText), armor: true }) as OpenPGP.EncryptArmorResult;
                let body: string;
                if (this.urlParams.threadId) { // reply draft
                    body = `[cryptup:link:draft_reply:${this.urlParams.threadId}]\n\n${encrypted.data}`;
                } else if (this.urlParams.draftId) { // new message compose draft with known draftid
                    body = `[cryptup:link:draft_compose:${this.urlParams.draftId}]\n\n${encrypted.data}`;
                } else { // new message compose draft where draftId is not yet known
                    body = encrypted.data;
                }
                const subject = String(this.composer.S.cached('input_subject').val() || this.urlParams.subject || 'FlowCrypt draft');
                const to = this.composer.getRecipientsFromDom().filter(Str.isEmailValid); // else google complains https://github.com/FlowCrypt/flowcrypt-browser/issues/1370
                const mimeMsg = await Mime.encode(body, { To: to, From: this.composer.getSender(), Subject: subject }, []);
                if (!this.urlParams.draftId) {
                    const { id } = await this.app.emailProviderDraftCreate(this.urlParams.acctEmail, mimeMsg, this.urlParams.threadId);
                    this.composer.S.cached('send_btn_note').text('Saved');
                    this.urlParams.draftId = id;
                    await this.app.storageSetDraftMeta(true, id, this.urlParams.threadId, to, String(this.composer.S.cached('input_subject').val()));
                    // recursing one more time, because we need the draftId we get from this reply in the message itself
                    // essentially everytime we save draft for the first time, we have to save it twice
                    // currentlySavingDraft will remain true for now
                    await this.draftSave(true); // forceSave = true
                } else {
                    await this.app.emailProviderDraftUpdate(this.urlParams.draftId, mimeMsg);
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
                } else if (this.urlParams.draftId && (Api.err.isNotFound(e) || (e instanceof AjaxError && e.status === 400 && e.responseText.indexOf('Message not a draft') !== -1))) {
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
            await this.app.storageSetDraftMeta(false, this.urlParams.draftId, this.urlParams.threadId);
            try {
                await this.app.emailProviderDraftDelete(this.urlParams.draftId);
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

    private async decryptAndRenderDraft(encryptedArmoredDraft: string, headers: { from?: string; to: string[] }) {
        const passphrase = await this.app.storagePassphraseGet();
        if (typeof passphrase !== 'undefined') {
            const result = await PgpMsg.decrypt({ kisWithPp: await Store.keysGetAllWithPp(this.urlParams.acctEmail), encryptedData: Buf.fromUtfStr(encryptedArmoredDraft) });
            if (result.success) {
                this.composer.S.cached('prompt').css({ display: 'none' });
                Xss.sanitizeRender(this.composer.S.cached('input_text'), await Xss.htmlSanitizeKeepBasicTags(result.content.toUtfStr().replace(/\n/g, '<br>')));
                if (this.urlParams.isReplyBox) {
                    await this.composer.renderReplyMsgComposeTable();
                } else if (headers && headers.to && headers.to.length) {
                    this.composer.S.cached('input_to').focus();
                    this.composer.S.cached('input_to').val(headers.to.join(','));
                    this.composer.S.cached('input_text').focus();
                    this.composer.parseRenderRecipients('harshRecipientErrs').catch(Catch.reportErr);
                }
                if (headers && headers.from) {
                    this.composer.S.now('input_from').val(headers.from);
                }
            }
        } else {
            const promptText = `Waiting for <a href="#" class="action_open_passphrase_dialog">pass phrase</a> to open draft..`;
            if (this.urlParams.isReplyBox) {
                Xss.sanitizeRender(this.composer.S.cached('prompt'), promptText).css({ display: 'block' });
                this.composer.resizeComposeBox();
            } else {
                Xss.sanitizeRender(this.composer.S.cached('prompt'), `${promptText}<br><br><a href="#" class="action_close">close</a>`).css({ display: 'block', height: '100%' });
            }
            this.composer.S.cached('prompt').find('a.action_open_passphrase_dialog').click(Ui.event.handle(() => {
                BrowserMsg.send.passphraseDialog(this.urlParams.parentTabId, { type: 'draft', longids: ['primary'] });
            }));
            this.composer.S.cached('prompt').find('a.action_close').click(Ui.event.handle(() => this.app.closeMsg()));
            await this.app.whenMasterPassphraseEntered();
            await this.decryptAndRenderDraft(encryptedArmoredDraft, headers);
        }
    }

    private hasBodyChanged = (msgBody: string) => {
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

    private async abortAndRenderReplyMsgComposeTableIfIsReplyBox(reason: string) {
        console.info(`Google.gmail.initialDraftLoad: ${reason}`);
        if (this.urlParams.isReplyBox) {
            await this.composer.renderReplyMsgComposeTable();
        }
    }
}
