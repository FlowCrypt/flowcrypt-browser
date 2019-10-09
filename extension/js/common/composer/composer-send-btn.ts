import { ComposerComponent } from './interfaces/composer-component.js';
import { ComposerPopoverItem, EncryptionType, ComposerUrlParams, RecipientElement, Recipients, PubkeyResult, SendBtnButtonTexts } from './interfaces/composer-types.js';
import { ComposerAppFunctionsInterface } from './interfaces/composer-app-functions.js';
import { Composer } from '../composer.js';
import { Xss } from '../platform/xss.js';
import { Lang } from '../lang.js';
import { Ui } from '../browser.js';
import { Catch, UnreportableError } from '../platform/catch.js';
import { Api } from '../api/api.js';
import { BrowserMsg, Extension, BrowserWidnow } from '../extension.js';
import { ComposerUserError, ComposerResetBtnTrigger, ComposerNotReadyError } from './interfaces/composer-errors.js';
import { Pwd, Pgp, PgpMsg } from '../core/pgp.js';
import { Subscription, Store } from '../platform/store.js';
import { Backend, BackendRes, AwsS3UploadItem } from '../api/backend.js';
import { Value, Str } from '../core/common.js';
import { Google, GmailRes } from '../api/google.js';
import { SendableMsgBody } from '../core/mime.js';
import { SendableMsg } from '../api/email_provider_api.js';
import { Att } from '../core/att.js';
import { Buf } from '../core/buf.js';

declare const openpgp: typeof OpenPGP;

export class ComposerSendBtn extends ComposerComponent {

    private app: ComposerAppFunctionsInterface;

    private popoverItems?: ComposerPopoverItem[];

    public encryptionType: EncryptionType = 'encrypted';
    public additionalMsgHeaders: { [key: string]: string } = {};

    private DEFAULT_BTN_TEXTS: { [key in EncryptionType]: string } = {
        "encrypted": SendBtnButtonTexts.BTN_ENCRYPT_AND_SEND,
        "encryptedAndSigned": SendBtnButtonTexts.BTN_ENCRYPT_SIGN_AND_SEND,
        "signed": SendBtnButtonTexts.BTN_SIGN_AND_SEND,
        "plain": SendBtnButtonTexts.BTN_PLAIN_SEND
    };

    private BTN_READY_TEXTS = [
        SendBtnButtonTexts.BTN_ENCRYPT_AND_SEND,
        SendBtnButtonTexts.BTN_SIGN_AND_SEND,
        SendBtnButtonTexts.BTN_ENCRYPT_SIGN_AND_SEND,
        SendBtnButtonTexts.BTN_PLAIN_SEND
    ];

    private FC_WEB_URL = 'https://flowcrypt.com'; // todo - should use Api.url()

    private btnUpdateTimeout?: number;

    private isSendMessageInProgress = false;

    constructor(app: ComposerAppFunctionsInterface, urlParams: ComposerUrlParams, composer: Composer) {
        super(composer, urlParams);
        this.app = app;
    }

    initActions(): void {
        this.composer.S.cached('body').keypress(Ui.ctrlEnter(() => !this.composer.isMinimized() && this.extractProcessSendMsg()));
        this.composer.S.cached('send_btn').click(Ui.event.prevent('double', () => this.extractProcessSendMsg()));
    }

    isSendMessageInProgres(): boolean {
        return this.isSendMessageInProgress;
    }

    initComposerPopover() {
        this.popoverItems = [
            { HTMLContent: 'Encrypt and Send', data: 'encrypted', iconPath: '/img/svgs/locked-icon-green.svg' },
            { HTMLContent: 'Encrypt, Sign and Send', data: 'encryptedAndSigned', iconPath: '/img/svgs/locked-icon-green.svg' },
            { HTMLContent: 'Sign and Send', data: 'signed', iconPath: '/img/svgs/signature-gray.svg' },
            { HTMLContent: 'Send plain (not encrypted)', data: 'plain', iconPath: '/img/svgs/gmail.svg' },
        ];
        for (const item of this.popoverItems) {
            const elem = $(`<div class="sending-option" data-test="action-choose-${item.data}"><span class="option-name">${Xss.htmlSanitize(item.HTMLContent)}</span></div>`);
            elem.on('click', Ui.event.handle(() => this.handleEncryptionTypeSelected(elem, item.data)));
            if (item.iconPath) {
                elem.find('.option-name').prepend(`<img src="${item.iconPath}" />`); // xss-direct
            }
            this.composer.S.cached('sending_options_container').append(elem); // xss-safe-factory
            if (item.data === this.encryptionType) {
                this.addTickToPopover(elem);
            }
        }
        if (!this.urlParams.isReplyBox) {
            this.setPopoverTopPosition();
        }
    }

    resetSendBtn(delay?: number) {
        const btnText: string = this.DEFAULT_BTN_TEXTS[this.encryptionType];
        const doReset = () => {
            Xss.sanitizeRender(this.composer.S.cached('send_btn_text'), `<i></i>${btnText}`);
            this.composer.S.cached('toggle_send_options').show();
        };
        if (typeof this.btnUpdateTimeout !== 'undefined') {
            clearTimeout(this.btnUpdateTimeout);
        }
        if (!delay) {
            doReset();
        } else {
            Catch.setHandledTimeout(doReset, delay);
        }
    }

    setPopoverTopPosition() {
        this.composer.S.cached('sending_options_container').css('top', - (this.composer.S.cached('sending_options_container').outerHeight()! + 3) + 'px');
    }

    private handleEncryptionTypeSelected = (elem: JQuery<HTMLElement>, encryptionType: EncryptionType) => {
        if (this.encryptionType === encryptionType) {
            return;
        }
        const method = ['signed', 'plain'].includes(encryptionType) ? 'addClass' : 'removeClass';
        this.encryptionType = encryptionType;
        this.addTickToPopover(elem);
        this.composer.S.cached('title').text(Lang.compose.headers[encryptionType]);
        this.composer.S.cached('compose_table')[method]('not-encrypted');
        this.composer.S.now('attached_files')[method]('not-encrypted');
        this.resetSendBtn();
        $('.sending-container').removeClass('popover-opened');
        this.composer.showHidePwdOrPubkeyContainerAndColorSendBtn();
    }

    private addTickToPopover = (elem: JQuery<HTMLElement>) => {
        elem.parent().find('img.icon-tick').remove();
        elem.append('<img class="icon-tick" src="/img/svgs/tick.svg" />').addClass('active'); // xss-direct
    }

    private extractProcessSendMsg = async () => {
        try {
            this.composer.S.cached('toggle_send_options').hide();
            const recipientElements = this.composer.getRecipients();
            const recipients = this.mapRecipients(recipientElements);
            const subject = this.urlParams.subject || ($('#input_subject').val() === undefined ? '' : String($('#input_subject').val())); // replies have subject in url params
            const plaintext = this.composer.extractAsText('input_text');
            await this.throwIfFormNotReady(recipientElements);
            this.composer.S.now('send_btn_text').text('Loading');
            Xss.sanitizeRender(this.composer.S.now('send_btn_i'), Ui.spinner('white'));
            this.composer.S.cached('send_btn_note').text('');
            const subscription = await this.app.storageGetSubscription();
            const { armoredPubkeys, emailsWithoutPubkeys } = await this.app.collectAllAvailablePublicKeys(this.urlParams.acctEmail, recipientElements.map(r => r.email));
            const pwd = emailsWithoutPubkeys.length ? { answer: String(this.composer.S.cached('input_password').val()) } : undefined;
            await this.throwIfFormValsInvalid(recipientElements, emailsWithoutPubkeys, subject, plaintext, pwd);
            if (this.encryptionType === 'signed') {
                await this.signSend(recipients, subject, plaintext);
            } else if (['encrypted', 'encryptedAndSigned'].includes(this.encryptionType)) {
                const prv = this.encryptionType === 'encryptedAndSigned' ? await this.getDecryptedPrimaryPrvOrShowError() : undefined;
                if (this.encryptionType === 'encryptedAndSigned' && !prv) {
                    return;
                }
                await this.encryptSend(recipients, armoredPubkeys, subject, plaintext, pwd, subscription, prv);
            } else { // Send Plain
                await this.plainSend(recipients, subject, plaintext);
            }
        } catch (e) {
            await this.handleSendErr(e);
        } finally {
            this.composer.S.cached('toggle_send_options').show();
        }
    }

    private encryptSend = async (recipients: Recipients, armoredPubkeys: PubkeyResult[], subject: string, plaintext: string, pwd: Pwd | undefined, subscription: Subscription,
        signingPrv?: OpenPGP.key.Key) => {
        this.composer.S.now('send_btn_text').text('Encrypting');
        plaintext = await this.addReplyTokenToMsgBodyIfNeeded([...recipients.to || [], ...recipients.cc || [], ...recipients.bcc || []], subject, plaintext, pwd, subscription);
        const atts = await this.composer.attach.collectEncryptAtts(armoredPubkeys.map(p => p.pubkey), pwd);
        if (atts.length && pwd) { // these will be password encrypted attachments
            this.btnUpdateTimeout = Catch.setHandledTimeout(() => this.composer.S.now('send_btn_text').text(SendBtnButtonTexts.BTN_SENDING), 500);
            const attAdminCodes = await this.uploadAttsToFc(atts, subscription);
            plaintext = this.addUploadedFileLinksToMsgBody(plaintext, atts);
            await this.doEncryptFmtSend(armoredPubkeys, pwd, plaintext, [], recipients, subject, subscription, attAdminCodes, signingPrv);
        } else {
            await this.doEncryptFmtSend(armoredPubkeys, pwd, plaintext, atts, recipients, subject, subscription, undefined, signingPrv);
        }
    }

    private doEncryptFmtSend = async (
        pubkeys: PubkeyResult[], pwd: Pwd | undefined, text: string, atts: Att[], recipients: Recipients, subj: string, subs: Subscription, attAdminCodes: string[] = [],
        signingPrv?: OpenPGP.key.Key
    ) => {
        const pubkeysOnly = pubkeys.map(p => p.pubkey);
        const encryptAsOfDate = await this.encryptMsgAsOfDateIfSomeAreExpiredAndUserConfirmedModal(pubkeys);
        const encrypted = await PgpMsg.encrypt({ pubkeys: pubkeysOnly, signingPrv, pwd, data: Buf.fromUtfStr(text), armor: true, date: encryptAsOfDate }) as OpenPGP.EncryptArmorResult;
        let encryptedBody: SendableMsgBody = { 'text/plain': encrypted.data };
        await this.app.storageContactUpdate([...recipients.to || [], ...recipients.cc || [], ...recipients.bcc || []], { last_use: Date.now() });
        this.composer.S.now('send_btn_text').text(SendBtnButtonTexts.BTN_SENDING);
        if (pwd) {
            // this is used when sending encrypted messages to people without encryption plugin, the encrypted data goes through FlowCrypt and recipients get a link
            // admin_code stays locally and helps the sender extend life of the message or delete it
            const { short, admin_code } = await Backend.messageUpload(encryptedBody['text/plain']!, subs.active ? 'uuid' : undefined);
            const storage = await Store.getAcct(this.urlParams.acctEmail, ['outgoing_language']);
            encryptedBody = this.fmtPwdProtectedEmail(short, encryptedBody, pubkeysOnly, atts, storage.outgoing_language || 'EN');
            encryptedBody = this.formatEmailTextFooter(encryptedBody);
            await this.app.storageAddAdminCodes(short, admin_code, attAdminCodes);
            await this.doSendMsg(await Google.createMsgObj(this.urlParams.acctEmail, this.composer.getSender(), recipients, subj, encryptedBody, atts, this.urlParams.threadId));
        } else {
            encryptedBody = this.formatEmailTextFooter(encryptedBody);
            await this.doSendMsg(await Google.createMsgObj(this.urlParams.acctEmail, this.composer.getSender(), recipients, subj, encryptedBody, atts, this.urlParams.threadId));
        }
    }

    private signSend = async (recipients: Recipients, subject: string, plaintext: string) => {
        this.composer.S.now('send_btn_text').text('Signing');
        const prv = await this.getDecryptedPrimaryPrvOrShowError();
        if (prv) {
            // Folding the lines or GMAIL WILL RAPE THE TEXT, regardless of what encoding is used
            // https://mathiasbynens.be/notes/gmail-plain-text applies to API as well
            // resulting in.. wait for it.. signatures that don't match
            // if you are reading this and have ideas about better solutions which:
            //  - don't involve text/html ( Enigmail refuses to fix: https://sourceforge.net/p/enigmail/bugs/218/ - Patrick Brunschwig - 2017-02-12 )
            //  - don't require text to be sent as an attachment
            //  - don't require all other clients to support PGP/MIME
            // then please const me know. Eagerly waiting! In the meanwhile..
            plaintext = (window as unknown as BrowserWidnow)['emailjs-mime-codec'].foldLines(plaintext, 76, true); // tslint:disable-line:no-unsafe-any
            // Gmail will also remove trailing spaces on the end of each line in transit, causing signatures that don't match
            // Removing them here will prevent Gmail from screwing up the signature
            plaintext = plaintext.split('\n').map(l => l.replace(/\s+$/g, '')).join('\n').trim();
            const signedData = await PgpMsg.sign(prv, this.formatEmailTextFooter({ 'text/plain': plaintext })['text/plain'] || '');
            const atts = await this.composer.attach.collectAtts(); // todo - not signing attachments
            this.app.storageContactUpdate([...recipients.to || [], ...recipients.cc || [], ...recipients.bcc || []], { last_use: Date.now() }).catch(Catch.reportErr);
            this.composer.S.now('send_btn_text').text(SendBtnButtonTexts.BTN_SENDING);
            const body = { 'text/plain': signedData };
            await this.doSendMsg(await Google.createMsgObj(this.urlParams.acctEmail, this.composer.getSender(), recipients, subject, body, atts, this.urlParams.threadId));
        }
    }

    private plainSend = async (recipients: Recipients, subject: string, plaintext: string) => {
        this.composer.S.now('send_btn_text').text(SendBtnButtonTexts.BTN_SENDING);
        const atts = await this.composer.attach.collectAtts();
        const body = { 'text/plain': plaintext };
        await this.doSendMsg(await Google.createMsgObj(this.urlParams.acctEmail, this.composer.getSender(), recipients, subject, body, atts, this.urlParams.threadId));
    }

    private doSendMsg = async (msg: SendableMsg) => {
        for (const k of Object.keys(this.additionalMsgHeaders)) {
            msg.headers[k] = this.additionalMsgHeaders[k];
        }
        for (const a of msg.atts) {
            a.type = 'application/octet-stream'; // so that Enigmail+Thunderbird does not attempt to display without decrypting
        }
        if (this.composer.S.cached('icon_pubkey').is('.active')) {
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
        const isSigned = this.encryptionType === 'signed';
        BrowserMsg.send.notificationShow(this.urlParams.parentTabId, {
            notification: `Your ${isSigned ? 'signed' : 'encrypted'} ${this.urlParams.isReplyBox ? 'reply' : 'message'} has been sent.`
        });
        BrowserMsg.send.focusBody(this.urlParams.parentTabId); // Bring focus back to body so Gmails shortcuts will work
        await this.composer.composerDraft.draftDelete();
        this.isSendMessageInProgress = false;
        if (this.urlParams.isReplyBox) {
            this.renderReplySuccess(msg, msgSentRes.id);
        } else {
            this.app.closeMsg();
        }
    }

    /**
     * Try to find an intersection of time that public keys of all recipients were usable (if user confirms this with a modal)
     */
    private encryptMsgAsOfDateIfSomeAreExpiredAndUserConfirmedModal = async (armoredPubkeys: PubkeyResult[]): Promise<Date | undefined> => {
        const usableUntil: number[] = [];
        const usableFrom: number[] = [];
        for (const armoredPubkey of armoredPubkeys) {
            const { keys: [pub] } = await openpgp.key.readArmored(armoredPubkey.pubkey);
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
        for (const myKey of armoredPubkeys.filter(ap => ap.isMine)) {
            if (await Pgp.key.usableButExpired(await Pgp.key.read(myKey.pubkey))) {
                const path = chrome.runtime.getURL(`chrome/settings/index.htm?acctEmail=${encodeURIComponent(myKey.email)}&page=%2Fchrome%2Fsettings%2Fmodules%2Fmy_key_update.htm`);
                await Ui.modal.error(
                    ['This message could not be encrypted because your own Private Key is expired.',
                        '',
                        'You can extend expiration of this key in other OpenPGP software (such as gnupg), then re-import updated key ' +
                        `<a href="${path}" id="action_update_prv" target="_blank">here</a>.`].join('\n'), true);
                throw new ComposerResetBtnTrigger();
            }
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

    private getDecryptedPrimaryPrvOrShowError = async (): Promise<OpenPGP.key.Key | undefined> => {
        const [primaryKi] = await Store.keysGet(this.urlParams.acctEmail, ['primary']);
        if (primaryKi) {
            const { keys: [prv] } = await openpgp.key.readArmored(primaryKi.private);
            const passphrase = await this.app.storagePassphraseGet();
            if (typeof passphrase === 'undefined' && !prv.isFullyDecrypted()) {
                BrowserMsg.send.passphraseDialog(this.urlParams.parentTabId, { type: 'sign', longids: ['primary'] });
                if ((typeof await this.app.whenMasterPassphraseEntered(60)) !== 'undefined') { // pass phrase entered
                    return await this.getDecryptedPrimaryPrvOrShowError();
                } else { // timeout - reset - no passphrase entered
                    this.resetSendBtn();
                }
            } else {
                if (!prv.isFullyDecrypted()) {
                    await Pgp.key.decrypt(prv, passphrase!); // checked !== undefined above
                }
                return prv;
            }
        } else {
            await Ui.modal.error('Cannot sign the message because your plugin is not correctly set up. Email human@flowcrypt.com if this persists.');
            this.resetSendBtn();
        }
        return undefined;
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
                sender: this.composer.getSender(),
                recipient: Value.arr.withoutVal(Value.arr.withoutVal(recipients, this.composer.getSender()), this.urlParams.acctEmail),
                subject,
                token: response.token,
            })
        });
    }

    private mapRecipients = (recipients: RecipientElement[]) => {
        const result: Recipients = { to: [], cc: [], bcc: [] };
        for (const recipient of recipients) {
            switch (recipient.sendingType) {
                case "to":
                    result.to!.push(recipient.email);
                    break;
                case "cc":
                    result.cc!.push(recipient.email);
                    break;
                case "bcc":
                    result.bcc!.push(recipient.email);
                    break;
            }
        }
        return result;
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
        if (this.composer.attach.hasAtt()) {
            progress = Math.floor(progress);
            this.composer.S.now('send_btn_text').text(`${SendBtnButtonTexts.BTN_SENDING} ${progress < 100 ? `${progress}%` : ''}`);
        }
    }

    private fmtPwdProtectedEmail = (shortId: string, encryptedBody: SendableMsgBody, armoredPubkeys: string[], atts: Att[], lang: 'DE' | 'EN') => {
        const msgUrl = `${this.FC_WEB_URL}/${shortId}`;
        const a = `<a href="${Xss.escape(msgUrl)}" style="padding: 2px 6px; background: #2199e8; color: #fff; display: inline-block; text-decoration: none;">
                    ${Lang.compose.openMsg[lang]}
                   </a>`;
        const intro = this.composer.S.cached('input_intro').length ? this.composer.extractAsText('input_intro') : '';
        const text = [];
        const html = [];
        if (intro) {
            text.push(intro + '\n');
            html.push(intro.replace(/\n/g, '<br>') + '<br><br>');
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

    private addNamesToMsg = async (msg: SendableMsg): Promise<void> => {
        const { sendAs } = await Store.getAcct(this.urlParams.acctEmail, ['sendAs']);
        const addNameToEmail = async (emails: string[]): Promise<string[]> => {
            return await Promise.all(await emails.map(async email => {
                let name: string | undefined;
                if (sendAs && sendAs[email] && sendAs[email].name) {
                    name = sendAs[email].name!;
                } else {
                    const [contact] = await this.app.storageContactGet([email]);
                    if (contact && contact.name) {
                        name = contact.name;
                    }
                }
                return name ? `${name.replace(/[<>'"/\\\n\r\t]/g, '')} <${email}>` : email;
            }));
        };
        msg.recipients.to = await addNameToEmail(msg.recipients.to || []);
        msg.recipients.cc = await addNameToEmail(msg.recipients.cc || []);
        msg.recipients.bcc = await addNameToEmail(msg.recipients.bcc || []);
        msg.from = (await addNameToEmail([msg.from]))[0];
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

    private renderReplySuccess = (msg: SendableMsg, msgId: string) => {
        const isSigned = this.encryptionType === 'signed';
        this.app.renderReinsertReplyBox(msgId, msg.headers.To.split(',').map(a => Str.parseEmail(a).email).filter(e => !!e) as string[]);
        if (isSigned) {
            this.composer.S.cached('replied_body').addClass('pgp_neutral').removeClass('pgp_secure');
        }
        this.composer.S.cached('replied_body').css('width', ($('table#compose').width() || 500) - 30);
        this.composer.S.cached('compose_table').css('display', 'none');
        this.composer.S.cached('reply_msg_successful').find('div.replied_from').text(this.composer.getSender());
        this.composer.S.cached('reply_msg_successful').find('div.replied_to span').text(msg.headers.To.replace(/,/g, ', '));
        Xss.sanitizeRender(this.composer.S.cached('reply_msg_successful').find('div.replied_body'), Xss.escapeTextAsRenderableHtml(this.composer.extractAsText('input_text', 'SKIP-ADDONS')));
        const emailFooter = this.app.storageEmailFooterGet();
        if (emailFooter) {
            const renderableEscapedEmailFooter = Xss.escape(emailFooter).replace(/\n/g, '<br>');
            if (isSigned) {
                Xss.sanitizeAppend(this.composer.S.cached('replied_body'), `<br><br>${renderableEscapedEmailFooter}`);
            } else {
                Xss.sanitizeRender(this.composer.S.cached('reply_msg_successful').find('.email_footer'), `<br> ${renderableEscapedEmailFooter}`);
            }
        }
        const t = new Date();
        const time = ((t.getHours() !== 12) ?
            (t.getHours() % 12) : 12) + ':' + (t.getMinutes() < 10 ? '0' : '') + t.getMinutes() + ((t.getHours() >= 12) ? ' PM ' : ' AM ') + '(0 minutes ago)';
        this.composer.S.cached('reply_msg_successful').find('div.replied_time').text(time);
        this.composer.S.cached('reply_msg_successful').css('display', 'block');
        if (msg.atts.length) {
            this.composer.S.cached('replied_attachments').html(msg.atts.map(a => { // xss-safe-factory
                a.msgId = msgId;
                return this.app.factoryAtt(a, true);
            }).join('')).css('display', 'block');
        }
        this.composer.resizeComposeBox();
    }

    private throwIfFormNotReady = async (recipients: RecipientElement[]): Promise<void> => {
        if (this.hasValue(this.composer.S.cached('recipients_inputs'))) {
            this.composer.composerContacts.parseRenderRecipients(this.composer.S.cached('recipients_inputs')).catch(Catch.reportErr);
        }
        if (this.composer.S.cached('icon_show_prev_msg').hasClass('progress')) {
            throw new ComposerNotReadyError('Retrieving previous message, please wait.');
        }
        if (this.BTN_READY_TEXTS.includes(this.composer.S.now('send_btn_text').text().trim()) && recipients.length) {
            return; // all good
        }
        if (this.composer.S.now('send_btn_text').text().trim() === SendBtnButtonTexts.BTN_WRONG_ENTRY) {
            throw new ComposerUserError('Please re-enter recipients marked in red color.');
        }
        if (!recipients || !recipients.length) {
            throw new ComposerUserError('Please add a recipient first');
        }
        throw new ComposerNotReadyError('Still working, please wait.');
    }

    private throwIfFormValsInvalid = async (recipients: RecipientElement[], emailsWithoutPubkeys: string[], subject: string, plaintext: string, challenge?: Pwd) => {
        const shouldEncrypt = ['encrypted', 'encryptedAndSigned'].includes(this.encryptionType);
        if (!recipients.length) {
            throw new ComposerUserError('Please add receiving email address.');
        }
        if (shouldEncrypt && emailsWithoutPubkeys.length && (!challenge || !challenge.answer)) {
            this.composer.S.cached('input_password').focus();
            throw new ComposerUserError('Some recipients don\'t have encryption set up. Please add a password.');
        }
        if (!((plaintext !== '' || await Ui.modal.confirm('Send empty message?')) && (subject !== '' || await Ui.modal.confirm('Send without a subject?')))) {
            throw new ComposerResetBtnTrigger();
        }
    }

    private hasValue(inputs: JQuery<HTMLElement>): boolean {
        return !!inputs.filter((index, elem) => !!$(elem).val()).length;
    }

}
