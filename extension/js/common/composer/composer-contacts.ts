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
import { ComposerUrlParams, RecipientElement } from './interfaces/composer-types.js';
import { ComposerComponent } from './interfaces/composer-component.js';
import { BrowserMsg } from '../extension.js';
import { PUBKEY_LOOKUP_RESULT_FAIL, PUBKEY_LOOKUP_RESULT_WRONG } from './interfaces/composer-errors.js';
import { Catch } from '../platform/catch.js';

export class ComposerContacts extends ComposerComponent {
  private app: ComposerAppFunctionsInterface;
  private openPGP: typeof OpenPGP;
  private addedRecipients: RecipientElement[] = [];
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
    let preventSearchContacts = false;
    this.composer.S.cached('input_to').on('keyup', Ui.event.prevent('veryslowspree', async () => {
      if (!preventSearchContacts) {
        await this.searchContacts();
      }
    }));
    this.composer.S.cached('input_to').on('keydown', Ui.event.handle(async (target, e) => {
      preventSearchContacts = this.recipientInputKeydownHandler(e);
    }));
    this.composer.S.cached('input_to').on('blur', Ui.event.handle(async (target, e) => {
      this.composer.debug(`input_to.blur -> parseRenderRecipients start causedBy(${e.relatedTarget ? e.relatedTarget.outerHTML : undefined})`);
      this.parseRenderRecipients(this.composer.S.cached('input_to_container'));
      this.composer.debug(`input_to.blur -> parseRenderRecipients done`);
    }));
    this.composer.S.cached('compose_table').click(Ui.event.handle(() => this.hideContacts(), this.composer.getErrHandlers(`hide contact box`)));
    this.composer.S.cached('add_their_pubkey').click(Ui.event.handle(() => {
      const noPgpRecipients = this.addedRecipients.filter(r => r.element.className.includes('no_pgp'));
      this.app.renderAddPubkeyDialog(noPgpRecipients.map(r => r.email));
      clearInterval(this.addedPubkeyDbLookupInterval); // todo - get rid of Catch.set_interval. just supply tabId and wait for direct callback
      this.addedPubkeyDbLookupInterval = Catch.setHandledInterval(async () => {
        const recipientsHasPgp: RecipientElement[] = [];
        for (const recipient of noPgpRecipients) {
          const [contact] = await this.app.storageContactGet([recipient.email]);
          if (contact && contact.has_pgp) {
            $(recipient.element).removeClass('no_pgp').find('i').remove();
            clearInterval(this.addedPubkeyDbLookupInterval);
            recipientsHasPgp.push(recipient);
          }
        }
        await this.evaluateRecipients(recipientsHasPgp);
      }, 1000);
    }, this.composer.getErrHandlers('add recipient public key')));
    this.composer.S.cached('icon_pubkey').click(Ui.event.handle(target => {
      this.includePubkeyToggledManually = true;
      this.updatePubkeyIcon(!$(target).is('.active'));
    }, this.composer.getErrHandlers(`set/unset pubkey attachment`)));
    BrowserMsg.addListener('addToContacts', this.checkReciepientsKeys);
    BrowserMsg.listen(this.urlParams.parentTabId);
  }

  /**
   * Keyboard navigation in search results.
   *
   * Arrows: select next/prev result
   * Enter: choose result
   * Esc: close search results dropdown
   *
   * Returns the boolean value which indicates if this.searchContacts() should be
   * prevented from triggering (in keyup handler)
   */
  private recipientInputKeydownHandler = (e: JQuery.Event<HTMLElement, null>): boolean => {
    const currentActive = this.composer.S.cached('contacts').find('ul li.select_contact.active');
    // Enter
    if (e.key === 'Enter') {
      currentActive.click();
      return true;
    // Escape
    } else if (e.key === 'Escape') {
      if (this.composer.S.cached('contacts').is(':visible')) {
        e.stopPropagation();
        this.hideContacts();
        this.composer.S.cached('input_to').focus();
      }
      return true;
    // Arrow Up
    } else if (e.key === 'ArrowUp') {
      let prev = currentActive.prev();
      if (!prev.length) {
        prev = this.composer.S.cached('contacts').find('ul li.select_contact').last();
      }
      currentActive.removeClass('active');
      prev.addClass('active');
      return true;
    // Arrow Down
    } else if (e.key === 'ArrowDown') {
      let next = currentActive.next();
      if (!next.length) {
        next = this.composer.S.cached('contacts').find('ul li.select_contact').first();
      }
      currentActive.removeClass('active');
      next.addClass('active');
      return true;
    }
    return false;
  }

  public getRecipients = () => this.addedRecipients;

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
      this.composer.S.cached('contacts').find('ul li.select_contact').first().addClass('active');
      this.composer.S.cached('contacts').find('ul li.select_contact').click(Ui.event.prevent('double', async (target: HTMLElement) => {
        const email = Str.parseEmail($(target).attr('email') || '').email;
        if (email) {
          await this.selectContact(email, query);
        }
      }, this.composer.getErrHandlers(`select contact`)));
      this.composer.S.cached('contacts').find('ul li.select_contact').hover(function () { $(this).addClass('active'); }, function () { $(this).removeClass('active'); });
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
    if (!this.addedRecipients.find(r => r.email === email)) {
      this.composer.debug(`selectContact -> parseRenderRecipients start`);
      this.parseRenderRecipients(this.composer.S.cached('input_to_container'), false, [email]);
    }
    this.hideContacts();
  }

  public validateEmails = (uncheckedEmails: string[]): { valid: string[], invalid: string[] } => {
    const valid: string[] = [];
    const invalid: string[] = [];
    for (const email of uncheckedEmails) {
      const parsed = Str.parseEmail(email).email;
      if (parsed) {
        valid.push(parsed);
      } else {
        invalid.push(email);
      }
    }
    return { valid, invalid };
  }

  public parseRenderRecipients = (container: JQuery<HTMLElement>, force?: boolean, uncheckedEmails?: string[]): boolean => {
    this.composer.debug(`parseRenderRecipients(force: ${force})`);
    const inputTo = container.find('#input_to');
    uncheckedEmails = uncheckedEmails || String(inputTo.val()).split(',');
    this.composer.debug(`parseRenderRecipients(force: ${force}) - emails to check(${uncheckedEmails.join(',')})`);
    const validationResult = this.validateEmails(uncheckedEmails);
    let recipientsToEvaluate: RecipientElement[] = [];
    if (validationResult.valid.length) {
      this.composer.debug(`parseRenderRecipients(force: ${force}) - valid emails(${validationResult.valid.join(',')})`);
      recipientsToEvaluate = this.createRecipientsElements(container, validationResult.valid);
    }
    const invalidEmails = validationResult.invalid.filter(em => !!em); // remove empty strings
    this.composer.debug(`parseRenderRecipients(force: ${force}) - invalid emails(${validationResult.invalid.join(',')})`);
    if (force && invalidEmails.length) {
      this.composer.debug(`parseRenderRecipients(force: ${force}) - force add invalid recipients`);
      recipientsToEvaluate = [...recipientsToEvaluate, ...this.createRecipientsElements(container, invalidEmails, true)];
      inputTo.val('');
    } else {
      this.composer.debug(`parseRenderRecipients(force: ${force}) - setting inputTo with invalid emails`);
      inputTo.val(validationResult.invalid.join(','));
    }
    this.composer.debug(`parseRenderRecipients(force: ${force}).2`);
    this.evaluateRecipients(recipientsToEvaluate).catch(Catch.reportErr);
    this.composer.debug(`parseRenderRecipients(force: ${force}).3`);
    this.composer.resizeInputTo();
    this.composer.debug(`parseRenderRecipients(force: ${force}).4`);
    this.composer.setInputTextHeightManuallyIfNeeded();
    this.composer.debug(`parseRenderRecipients(force: ${force}).5`);
    return !!validationResult.valid.length;
  }

  private createRecipientsElements = (container: JQuery<HTMLElement>, emails: string[], isWrong?: boolean): RecipientElement[] => {
    const result = [];
    for (const email of emails) {
      const recipientId = this.generateRecipientId();
      const recipientsHtml = `<span id="${recipientId}">${Xss.escape(email)} ${Ui.spinner('green')}</span>`;
      Xss.sanitizeAppend(container.find('.recipients'), recipientsHtml);
      const element = document.getElementById(recipientId)!;
      const recipient = { email, element, id: recipientId, isWrong };
      this.addedRecipients.push(recipient);
      result.push(recipient);
    }
    return result;
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
    const lastRecipient = this.addedRecipients[this.addedRecipients.length - 1];
    this.composer.S.cached('input_to').val(lastRecipient.email);
    this.removeRecipient(lastRecipient.element);
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
    for (const recipientEl of this.addedRecipients.filter(r => r.element.className.includes('no_pgp'))) {
      const email = $(recipientEl).text().trim();
      const [dbContact] = await this.app.storageContactGet([email]);
      if (dbContact) {
        recipientEl.element.classList.remove('no_pgp');
        await this.renderPubkeyResult(recipientEl, dbContact);
      }
    }
  }

  private renderPubkeyResult = async (recipient: RecipientElement, contact: Contact | 'fail' | 'wrong') => {
    this.composer.debug(`renderPubkeyResult.emailEl(${String(recipient.email)})`);
    this.composer.debug(`renderPubkeyResult.email(${recipient.email})`);
    this.composer.debug(`renderPubkeyResult.contact(${JSON.stringify(contact)})`);
    if ($('body#new_message').length) {
      if (typeof contact === 'object' && contact.has_pgp) {
        const sendingAddrOnKeyserver = this.myAddrsOnKeyserver.includes(this.composer.getSender());
        if ((contact.client === 'cryptup' && !sendingAddrOnKeyserver) || (contact.client !== 'cryptup')) {
          // new message, and my key is not uploaded where the recipient would look for it
          if (await this.app.doesRecipientHaveMyPubkey(recipient.email) !== true) { // either don't know if they need pubkey (can_read_emails false), or they do need pubkey
            this.recipientsMissingMyKey.push(recipient.email);
          }
        }
      }
      this.updatePubkeyIcon();
    }
    $(recipient.element).children('img, i').remove();
    // tslint:disable-next-line:max-line-length
    const contentHtml = '<img src="/img/svgs/close-icon.svg" alt="close" class="close-icon svg" /><img src="/img/svgs/close-icon-black.svg" alt="close" class="close-icon svg display_when_sign" />';
    Xss.sanitizeAppend(recipient.element, contentHtml)
      .find('img.close-icon')
      .click(Ui.event.handle(target => this.removeRecipient(target.parentElement!), this.composer.getErrHandlers('remove recipient')));
    if (contact === PUBKEY_LOOKUP_RESULT_FAIL) {
      $(recipient.element).attr('title', 'Loading contact information failed, please try to add their email again.');
      $(recipient.element).addClass("failed");
      Xss.sanitizeReplace($(recipient.element).children('img:visible'), '<img src="/img/svgs/repeat-icon.svg" class="repeat-icon action_retry_pubkey_fetch">' +
        '<img src="/img/svgs/close-icon-black.svg" class="close-icon-black svg remove-reciepient">');
      $(recipient.element).find('.action_retry_pubkey_fetch').click(Ui.event.handle(async () => await this.refreshRecipients(), this.composer.getErrHandlers('refresh recipient')));
      $(recipient.element).find('.remove-reciepient').click(Ui.event.handle(element => this.removeRecipient(element.parentElement!), this.composer.getErrHandlers('remove recipient')));
    } else if (contact === PUBKEY_LOOKUP_RESULT_WRONG) {
      this.composer.debug(`renderPubkeyResult: Setting email to wrong / misspelled in harsh mode: ${recipient.email}`);
      $(recipient.element).attr('title', 'This email address looks misspelled. Please try again.');
      $(recipient.element).addClass("wrong");
    } else if (contact.pubkey &&
      ((contact.expiresOn || Infinity) <= Date.now() ||
        await Pgp.key.usableButExpired((await this.openPGP.key.readArmored(contact.pubkey)).keys[0]))) {
      $(recipient.element).addClass("expired");
      Xss.sanitizePrepend(recipient.element, '<img src="/img/svgs/expired-timer.svg" class="expired-time">');
      $(recipient.element).attr('title', 'Does use encryption but their public key is expired. You should ask them to send ' +
        'you an updated public key.' + this.recipientKeyIdText(contact));
    } else if (contact.pubkey) {
      $(recipient.element).addClass("has_pgp");
      Xss.sanitizePrepend(recipient.element, '<img src="/img/svgs/locked-icon.svg" />');
      $(recipient.element).attr('title', 'Does use encryption' + this.recipientKeyIdText(contact));
    } else {
      $(recipient.element).addClass("no_pgp");
      Xss.sanitizePrepend(recipient.element, '<img src="/img/svgs/locked-icon.svg" />');
      $(recipient.element).attr('title', 'Could not verify their encryption setup. You can encrypt the message with a password below. Alternatively, add their pubkey.');
    }
    this.composer.showHidePwdOrPubkeyContainerAndColorSendBtn();
  }

  private removeRecipient = (element: HTMLElement) => {
    this.recipientsMissingMyKey = Value.arr.withoutVal(this.recipientsMissingMyKey, $(element).parent().text());
    const index = this.addedRecipients.findIndex(r => r.element.isEqualNode(element));
    this.addedRecipients[index].element.remove();
    this.addedRecipients.splice(index, 1);
    this.composer.resizeInputTo();
    this.composer.showHidePwdOrPubkeyContainerAndColorSendBtn();
    this.updatePubkeyIcon();
  }

  private refreshRecipients = async () => {
    const failedRecipients = this.addedRecipients.filter(r => r.element.className.includes('failed'));
    for (const recipient of failedRecipients) {
      Xss.sanitizeReplace(recipient.element, `<span id="${recipient.id}">${Xss.escape(recipient.email)} ${Ui.spinner('green')}</span>`);
      recipient.element = document.getElementById(recipient.id)!;
    }
    await this.evaluateRecipients(failedRecipients);
  }

  private evaluateRecipients = async (recipients: RecipientElement[]) => {
    this.composer.debug(`evaluateRenderedRecipients`);
    for (const recipient of recipients) {
      this.composer.debug(`evaluateRenderedRecipients.email(${String(recipient.email)})`);
      this.composer.S.now('send_btn_span').text(this.BTN_LOADING);
      this.composer.setInputTextHeightManuallyIfNeeded();
      let pubkeyLookupRes: Contact | 'fail' | 'wrong';
      if (!recipient.isWrong) {
        pubkeyLookupRes = await this.app.lookupPubkeyFromDbOrKeyserverAndUpdateDbIfneeded(recipient.email);
      } else {
        pubkeyLookupRes = 'wrong';
      }
      await this.renderPubkeyResult(recipient, pubkeyLookupRes);
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

  private generateRecipientId = (): string => {
    return `recipient_${this.addedRecipients.length}`;
  }
}
