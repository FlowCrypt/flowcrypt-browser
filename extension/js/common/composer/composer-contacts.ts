/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Composer } from '../composer.js';
import { Str, Value } from '../core/common.js';
import { ComposerAppFunctionsInterface } from './interfaces/composer-app-functions.js';
import { ProviderContactsQuery } from '../api/email_provider_api.js';
import { Contact, Pgp } from '../core/pgp.js';
import { Xss } from '../platform/xss.js';
import { Ui } from '../browser.js';
import { GoogleAuth } from '../api/google.js';
import { Lang } from '../lang.js';
import { ComposerUrlParams } from './interfaces/composer-types.js';
import { ComposerComponent } from './interfaces/comopser-component.js';
import { BrowserMsg } from '../extension.js';
import { PUBKEY_LOOKUP_RESULT_FAIL, PUBKEY_LOOKUP_RESULT_WRONG, RecipientErrsMode } from './interfaces/comopserr-errors.js';
import { Catch } from '../platform/catch.js';

export class ComposerContacts extends ComposerComponent {
    private app: ComposerAppFunctionsInterface;
    private openPGP: typeof OpenPGP;

    private BTN_LOADING = 'Loading..';

    private contactSearchInProgress = false;
    private includePubkeyToggledManually = false;
    private addedPubkeyDbLookupInterval?: number;

    private myAddrsOnKeyserver: string[] = [];
    private recipientsMissingMyKey: string[] = [];

    constructor(app: ComposerAppFunctionsInterface, urlParams: ComposerUrlParams, openPGP: typeof OpenPGP, composer: Composer) {
        super(composer, urlParams);
        this.app = app;
        this.openPGP = openPGP;
        this.myAddrsOnKeyserver = this.app.storageGetAddressesKeyserver() || [];
    }

    initActions(): void {
        this.composer.S.cached('input_to').keyup(Ui.event.prevent('veryslowspree', () => this.searchContacts()));
        this.composer.S.cached('compose_table').click(Ui.event.handle(() => this.hideContacts(), this.composer.getErrHandlers(`hide contact box`)));
        this.composer.S.cached('add_their_pubkey').click(Ui.event.handle(() => {
            const noPgpEmails = this.composer.getRecipientsFromDom('no_pgp');
            this.app.renderAddPubkeyDialog(noPgpEmails);
            clearInterval(this.addedPubkeyDbLookupInterval); // todo - get rid of Catch.set_interval. just supply tabId and wait for direct callback
            this.addedPubkeyDbLookupInterval = Catch.setHandledInterval(async () => {
                for (const email of noPgpEmails) {
                    const [contact] = await this.app.storageContactGet([email]);
                    if (contact && contact.has_pgp) {
                        $("span.recipients span.no_pgp:contains('" + email + "') i").remove();
                        $("span.recipients span.no_pgp:contains('" + email + "')").removeClass('no_pgp');
                        clearInterval(this.addedPubkeyDbLookupInterval);
                        await this.evaluateRenderedRecipients();
                    }
                }
            }, 1000);
        }, this.composer.getErrHandlers('add recipient public key')));
        this.composer.S.cached('icon_pubkey').click(Ui.event.handle(target => {
            this.includePubkeyToggledManually = true;
            this.updatePubkeyIcon(!$(target).is('.active'));
        }, this.composer.getErrHandlers(`set/unset pubkey attachment`)));
        this.composer.S.cached('input_to').blur(Ui.event.handle(async (target, e) => {
            this.composer.debug(`input_to.blur -> parseRenderRecipients start causedBy(${e.relatedTarget ? e.relatedTarget.outerHTML : undefined})`);
            // gentle because sometimes blur can happen by accident, it can get annoying (plus affects CI)
            await this.parseRenderRecipients('gentleRecipientErrs');
            this.composer.debug(`input_to.blur -> parseRenderRecipients done`);
        }));
        BrowserMsg.addListener('addToContacts', this.checkReciepientsKeys);
        BrowserMsg.listen(this.urlParams.parentTabId);
    }

    private searchContacts = async (dbOnly = false) => {
        this.composer.debug(`searchContacts`);
        const substring = Str.parseEmail(String(this.composer.S.cached('input_to').val()), 'DO-NOT-VALIDATE').email;
        this.composer.debug(`searchContacts.query.substring(${JSON.stringify(substring)})`);
        if (substring) {
            const query = { substring };
            const contacts = await this.app.storageContactSearch(query);
            if (dbOnly || !this.composer.canReadEmails) {
                this.composer.debug(`searchContacts 1`);
                this.renderSearchRes(contacts, query);
            } else {
                this.composer.debug(`searchContacts 2`);
                this.contactSearchInProgress = true;
                this.renderSearchRes(contacts, query);
                this.composer.debug(`searchContacts 3`);
                this.app.emailEroviderSearchContacts(query.substring, contacts, async searchContactsRes => {
                    this.composer.debug(`searchContacts 4`);
                    if (searchContactsRes.new.length) {
                        for (const contact of searchContactsRes.new) {
                            const [inDb] = await this.app.storageContactGet([contact.email]);
                            this.composer.debug(`searchContacts 5`);
                            if (!inDb) {
                                await this.app.storageContactSave(await this.app.storageContactObj({
                                    email: contact.email, name: contact.name, pendingLookup: true, lastUse: contact.last_use
                                }));
                            } else if (!inDb.name && contact.name) {
                                const toUpdate = { name: contact.name };
                                await this.app.storageContactUpdate(contact.email, toUpdate);
                                this.composer.debug(`searchContacts 6`);
                            }
                        }
                        this.composer.debug(`searchContacts 7`);
                        await this.searchContacts(true);
                        this.composer.debug(`searchContacts 8`);
                    } else {
                        this.composer.debug(`searchContacts 9`);
                        this.renderSearchResultsLoadingDone();
                        this.contactSearchInProgress = false;
                    }
                });
            }
        } else {
            this.hideContacts(); // todo - show suggestions of most contacted ppl etc
            this.composer.debug(`searchContacts 10`);
        }
    }

    private renderSearchRes = (contacts: Contact[], query: ProviderContactsQuery) => {
        const renderableContacts = contacts.slice();
        renderableContacts.sort((a, b) =>
            (10 * (b.has_pgp - a.has_pgp)) + ((b.last_use || 0) - (a.last_use || 0) > 0 ? 1 : -1)).slice(8); // have pgp on top, no pgp bottom. Sort each groups by last used
        if (renderableContacts.length > 0 || this.contactSearchInProgress) {
            let ulHtml = '';
            for (const contact of renderableContacts) {
                ulHtml += `<li class="select_contact" data-test="action-select-contact" email="${Xss.escape(contact.email.replace(/<\/?b>/g, ''))}">`;
                if (contact.has_pgp) {
                    ulHtml += '<img src="/img/svgs/locked-icon-green.svg" />';
                } else {
                    ulHtml += '<img src="/img/svgs/locked-icon-gray.svg" />';
                }
                let displayEmail;
                if (contact.email.length < 40) {
                    displayEmail = contact.email;
                } else {
                    const parts = contact.email.split('@');
                    displayEmail = parts[0].replace(/<\/?b>/g, '').substr(0, 10) + '...@' + parts[1];
                }
                if (contact.name) {
                    ulHtml += (Xss.escape(contact.name) + ' &lt;' + Xss.escape(displayEmail) + '&gt;');
                } else {
                    ulHtml += Xss.escape(displayEmail);
                }
                ulHtml += '</li>';
            }
            if (this.contactSearchInProgress) {
                ulHtml += '<li class="loading">loading...</li>';
            }
            Xss.sanitizeRender(this.composer.S.cached('contacts').find('ul'), ulHtml);
            this.composer.S.cached('contacts').find('ul li.select_contact').click(Ui.event.prevent('double', async (target: HTMLElement) => {
                const email = Str.parseEmail($(target).attr('email') || '').email;
                if (email) {
                    await this.selectContact(email, query);
                }
            }, this.composer.getErrHandlers(`select contact`)));
            this.composer.S.cached('contacts').find('ul li.select_contact').hover(function () { $(this).addClass('hover'); }, function () { $(this).removeClass('hover'); });
            this.composer.S.cached('contacts').find('ul li.auth_contacts').click(Ui.event.handle(() =>
                this.authContacts(this.urlParams.acctEmail), this.composer.getErrHandlers(`authorize contact search`)));
            const offset = this.composer.S.cached('input_to').offset()!;
            const inputToPadding = parseInt(this.composer.S.cached('input_to').css('padding-left'));
            let leftOffset: number;
            if (this.composer.S.cached('body').width()! < offset.left + inputToPadding + this.composer.S.cached('contacts').width()!) {
                // Here we need to align contacts popover by right side
                leftOffset = offset.left + inputToPadding + this.composer.S.cached('input_to').width()! - this.composer.S.cached('contacts').width()!;
            } else {
                leftOffset = offset.left + inputToPadding;
            }
            this.composer.S.cached('contacts').css({
                display: 'block',
                left: leftOffset,
                top: `${$('#compose > tbody > tr:first').height()! + offset.top}px`, // both are in the template
            });
        } else {
            this.hideContacts();
        }
    }

    private selectContact = async (email: string, fromQuery: ProviderContactsQuery) => {
        this.composer.debug(`selectContact 1`);
        const possiblyBogusRecipient = $('.recipients span.wrong').last();
        const possiblyBogusAddr = Str.parseEmail(possiblyBogusRecipient.text()).email;
        this.composer.debug(`selectContact 2`);
        const q = Str.parseEmail(fromQuery.substring).email;
        if (possiblyBogusAddr && q && (possiblyBogusAddr === q || possiblyBogusAddr.includes(q))) {
            possiblyBogusRecipient.remove();
        }
        if (!this.composer.getRecipientsFromDom().includes(email)) {
            this.composer.S.cached('input_to').val(Str.parseEmail(email).email || '');
            this.composer.debug(`selectContact -> parseRenderRecipients start`);
            this.parseRenderRecipients('harshRecipientErrs').catch(Catch.reportErr);
        }
        this.hideContacts();
    }
    public parseRenderRecipients = async (errsMode: RecipientErrsMode): Promise<boolean> => {
        this.composer.debug(`parseRenderRecipients(${errsMode})`);
        const inputTo = String(this.composer.S.cached('input_to').val()).toLowerCase();
        this.composer.debug(`parseRenderRecipients(${errsMode}).inputTo(${String(inputTo)})`);
        let gentleErrInvalidEmails = '';
        if (!(inputTo.includes(',') || (!this.composer.S.cached('input_to').is(':focus') && inputTo))) {
            this.composer.debug(`parseRenderRecipients(${errsMode}).1-a early exit`);
            return false;
        }
        this.composer.debug(`parseRenderRecipients(${errsMode}).2`);
        let isRecipientAdded = false;
        for (const rawRecipientAddrInput of inputTo.split(',')) {
            this.composer.debug(`parseRenderRecipients(${errsMode}).3 (${rawRecipientAddrInput})`);
            if (!rawRecipientAddrInput) {
                this.composer.debug(`parseRenderRecipients(${errsMode}).4`);
                continue; // users or scripts may append `,` to trigger evaluation - causes last entry to be "empty" - should be skipped
            }
            this.composer.debug(`parseRenderRecipients(${errsMode}).5`);
            const { email } = Str.parseEmail(rawRecipientAddrInput); // raw may be `Human at Flowcrypt <Human@FlowCrypt.com>` but we only want `human@flowcrypt.com`
            this.composer.debug(`parseRenderRecipients(${errsMode}).6 (${email})`);
            if (!email) {
                this.composer.debug(`parseRenderRecipients(${errsMode}).6-a (${email}|${rawRecipientAddrInput})`);
                if (errsMode === 'gentleRecipientErrs') {
                    gentleErrInvalidEmails += rawRecipientAddrInput;
                    this.composer.debug(`parseRenderRecipients(${errsMode}).6-b (${email}|${rawRecipientAddrInput})`);
                } else {
                    // maybe there could be:
                    // Xss.sanitizeAppend(this.S.cached('input_to').siblings('.recipients'), `<span>${Xss.escape(rawRecipientAddrInput)} ${Ui.spinner('green')}</span>`);
                    // but it seems to work well without it, so not adding until proved needed
                    this.composer.debug(`parseRenderRecipients(${errsMode}).6-c SKIPPING HARSH ERR? (${email}|${rawRecipientAddrInput})`);
                }
            } else {
                this.composer.debug(`parseRenderRecipients(${errsMode}).6-c (${email})`);
                Xss.sanitizeAppend(this.composer.S.cached('input_to').siblings('.recipients'), `<span>${Xss.escape(email)} ${Ui.spinner('green')}</span>`);
                isRecipientAdded = true;
            }
        }
        this.composer.debug(`parseRenderRecipients(${errsMode}).7.gentleErrs(${gentleErrInvalidEmails})`);
        this.composer.S.cached('input_to').val(gentleErrInvalidEmails);
        this.composer.debug(`parseRenderRecipients(${errsMode}).8`);
        this.composer.resizeInputTo();
        this.composer.debug(`parseRenderRecipients(${errsMode}).9`);
        await this.evaluateRenderedRecipients();
        this.composer.debug(`parseRenderRecipients(${errsMode}).10`);
        this.composer.setInputTextHeightManuallyIfNeeded();
        this.composer.debug(`parseRenderRecipients(${errsMode}).11`);
        return isRecipientAdded;
    }

    public hideContacts = () => {
        this.composer.S.cached('contacts').css('display', 'none');
    }

    public updatePubkeyIcon = (include?: boolean) => {
        if (typeof include === 'undefined') { // decide if pubkey should be included
            if (!this.includePubkeyToggledManually) { // leave it as is if toggled manually before
                this.updatePubkeyIcon(Boolean(this.recipientsMissingMyKey.length));
            }
        } else { // set icon to specific state
            if (include) {
                this.composer.S.cached('icon_pubkey').addClass('active').attr('title', Lang.compose.includePubkeyIconTitleActive);
            } else {
                this.composer.S.cached('icon_pubkey').removeClass('active').attr('title', Lang.compose.includePubkeyIconTitle);
            }
        }
    }

    private renderSearchResultsLoadingDone = () => {
        this.composer.S.cached('contacts').find('ul li.loading').remove();
        if (!this.composer.S.cached('contacts').find('ul li').length) {
            this.hideContacts();
        }
    }

    private authContacts = async (acctEmail: string) => {
        const lastRecipient = $('.recipients span').last();
        this.composer.S.cached('input_to').val(lastRecipient.text());
        lastRecipient.last().remove();
        const authRes = await GoogleAuth.newAuthPopup({ acctEmail, scopes: GoogleAuth.defaultScopes('contacts') });
        if (authRes.result === 'Success') {
            this.composer.canReadEmails = true;
            await this.searchContacts();
        } else if (authRes.result === 'Denied' || authRes.result === 'Closed') {
            await Ui.modal.error('FlowCrypt needs this permission to search your contacts on Gmail. Without it, FlowCrypt will keep a separate contact list.');
        } else {
            await Ui.modal.error(Lang.general.somethingWentWrongTryAgain);
        }
    }

    private checkReciepientsKeys = async () => {
        for (const recipientEl of $('.recipients span.no_pgp')) {
            const email = $(recipientEl).text().trim();
            const [dbContact] = await this.app.storageContactGet([email]);
            if (dbContact) {
                $(recipientEl).removeClass('no_pgp');
                await this.renderPubkeyResult(recipientEl, email, dbContact);
            }
        }
    }
    private renderPubkeyResult = async (emailEl: HTMLElement, email: string, contact: Contact | 'fail' | 'wrong') => {
        this.composer.debug(`renderPubkeyResult.emailEl(${String(emailEl)})`);
        this.composer.debug(`renderPubkeyResult.email(${email})`);
        this.composer.debug(`renderPubkeyResult.contact(${JSON.stringify(contact)})`);
        if ($('body#new_message').length) {
            if (typeof contact === 'object' && contact.has_pgp) {
                const sendingAddrOnKeyserver = this.myAddrsOnKeyserver.includes(this.composer.getSender());
                if ((contact.client === 'cryptup' && !sendingAddrOnKeyserver) || (contact.client !== 'cryptup')) {
                    // new message, and my key is not uploaded where the recipient would look for it
                    if (await this.app.doesRecipientHaveMyPubkey(email) !== true) { // either don't know if they need pubkey (can_read_emails false), or they do need pubkey
                        this.recipientsMissingMyKey.push(email);
                    }
                }
            }
            this.updatePubkeyIcon();
        }
        $(emailEl).children('img, i').remove();
        // tslint:disable-next-line:max-line-length
        const contentHtml = '<img src="/img/svgs/close-icon.svg" alt="close" class="close-icon svg" /><img src="/img/svgs/close-icon-black.svg" alt="close" class="close-icon svg display_when_sign" />';
        Xss.sanitizeAppend(emailEl, contentHtml).find('img.close-icon').click(Ui.event.handle(target => this.removeReceiver(target), this.composer.getErrHandlers('remove recipient')));
        if (contact === PUBKEY_LOOKUP_RESULT_FAIL) {
            $(emailEl).attr('title', 'Loading contact information failed, please try to add their email again.');
            $(emailEl).addClass("failed");
            Xss.sanitizeReplace($(emailEl).children('img:visible'), '<img src="/img/svgs/repeat-icon.svg" class="repeat-icon action_retry_pubkey_fetch">' +
                '<img src="/img/svgs/close-icon-black.svg" class="close-icon-black svg remove-reciepient">');
            $(emailEl).find('.action_retry_pubkey_fetch').click(Ui.event.handle(async () => await this.refreshReceiver(), this.composer.getErrHandlers('refresh recipient')));
            $(emailEl).find('.remove-reciepient').click(Ui.event.handle(element => this.removeReceiver(element), this.composer.getErrHandlers('remove recipient')));
        } else if (contact === PUBKEY_LOOKUP_RESULT_WRONG) {
            this.composer.debug(`renderPubkeyResult: Setting email to wrong / misspelled in harsh mode: ${email}`);
            $(emailEl).attr('title', 'This email address looks misspelled. Please try again.');
            $(emailEl).addClass("wrong");
        } else if (contact.pubkey &&
            ((contact.expiresOn || Infinity) <= Date.now() ||
                await Pgp.key.usableButExpired((await this.openPGP.key.readArmored(contact.pubkey)).keys[0]))) {
            $(emailEl).addClass("expired");
            Xss.sanitizePrepend(emailEl, '<img src="/img/svgs/expired-timer.svg" class="expired-time">');
            $(emailEl).attr('title', 'Does use encryption but their public key is expired. You should ask them to send you an updated public key.' + this.recipientKeyIdText(contact));
        } else if (contact.pubkey) {
            $(emailEl).addClass("has_pgp");
            Xss.sanitizePrepend(emailEl, '<img src="/img/svgs/locked-icon.svg" />');
            $(emailEl).attr('title', 'Does use encryption' + this.recipientKeyIdText(contact));
        } else {
            $(emailEl).addClass("no_pgp");
            Xss.sanitizePrepend(emailEl, '<img src="/img/svgs/locked-icon.svg" />');
            $(emailEl).attr('title', 'Could not verify their encryption setup. You can encrypt the message with a password below. Alternatively, add their pubkey.');
        }
        this.composer.showHidePwdOrPubkeyContainerAndColorSendBtn();
    }

    private removeReceiver = (element: HTMLElement) => {
        this.recipientsMissingMyKey = Value.arr.withoutVal(this.recipientsMissingMyKey, $(element).parent().text());
        $(element).parent().remove();
        this.composer.resizeInputTo();
        this.composer.showHidePwdOrPubkeyContainerAndColorSendBtn();
        this.updatePubkeyIcon();
    }

    private refreshReceiver = async () => {
        const failedRecipients = $('.recipients span.failed');
        failedRecipients.removeClass('failed');
        for (const recipient of failedRecipients) {
            if (recipient.textContent) {
                const { email } = Str.parseEmail(recipient.textContent);
                Xss.sanitizeReplace(recipient, `<span>${Xss.escape(email || recipient.textContent)} ${Ui.spinner('green')}</span>`);
            }
        }
        await this.evaluateRenderedRecipients();
    }

    private evaluateRenderedRecipients = async () => {
        this.composer.debug(`evaluateRenderedRecipients`);
        for (const emailEl of $('.recipients span').not('.working, .has_pgp, .no_pgp, .wrong, .failed, .expired')) {
            this.composer.debug(`evaluateRenderedRecipients.emailEl(${String(emailEl)})`);
            const email = Str.parseEmail($(emailEl).text()).email;
            this.composer.debug(`evaluateRenderedRecipients.email(${email})`);
            if (email) {
                this.composer.S.now('send_btn_span').text(this.BTN_LOADING);
                this.composer.setInputTextHeightManuallyIfNeeded();
                const pubkeyLookupRes = await this.app.lookupPubkeyFromDbOrKeyserverAndUpdateDbIfneeded(email);
                await this.renderPubkeyResult(emailEl, email, pubkeyLookupRes);
            } else {
                await this.renderPubkeyResult(emailEl, $(emailEl).text(), PUBKEY_LOOKUP_RESULT_WRONG);
            }
        }
        this.composer.setInputTextHeightManuallyIfNeeded();
    }

    private recipientKeyIdText = (contact: Contact) => {
        if (contact.client === 'cryptup' && contact.keywords) {
            return '\n\n' + 'Public KeyWords:\n' + contact.keywords;
        } else if (contact.fingerprint) {
            return '\n\n' + 'Key fingerprint:\n' + contact.fingerprint;
        } else {
            return '';
        }
    }
}
