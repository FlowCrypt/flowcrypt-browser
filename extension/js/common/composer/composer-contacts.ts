/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Composer } from '../composer.js';
import { Str } from '../core/common.js';
import { ComposerAppFunctionsInterface } from './interfaces/composer-app-functions.js';
import { ProviderContactsQuery } from '../api/email_provider_api.js';
import { Contact } from '../core/pgp.js';
import { Xss } from '../platform/xss.js';
import { Ui } from '../browser.js';
import { GoogleAuth } from '../api/google.js';
import { Lang } from '../lang.js';
import { ComposerUrlParams } from './interfaces/composer-types.js';

export class ComposerContacts {
    private app: ComposerAppFunctionsInterface;
    private composer: Composer;
    private urlParams: ComposerUrlParams;

    private contactSearchInProgress = false;

    constructor(app: ComposerAppFunctionsInterface, urlParams: ComposerUrlParams, composer: Composer) {
        this.app = app;
        this.urlParams = urlParams;
        this.composer = composer;
    }

    public searchContacts = async (dbOnly = false) => {
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
            await this.composer.parseRenderRecipients('harshRecipientErrs', true);
            this.composer.debug(`selectContact -> parseRenderRecipients done`);
        }
        this.hideContacts();
    }

    public hideContacts = () => {
        this.composer.S.cached('contacts').css('display', 'none');
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
}
