/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { ChunkedCb, RecipientType } from '../../../js/common/api/api.js';
import { Contact, PgpKey } from '../../../js/common/core/pgp-key.js';
import { PUBKEY_LOOKUP_RESULT_FAIL, PUBKEY_LOOKUP_RESULT_WRONG } from './composer-errs.js';
import { ProviderContactsQuery, Recipients } from '../../../js/common/api/email_provider/email-provider-api.js';
import { RecipientElement, RecipientStatus, RecipientStatuses } from './composer-types.js';
import { Str, Value } from '../../../js/common/core/common.js';

import { ApiErr } from '../../../js/common/api/error/api-error.js';
import { BrowserMsg } from '../../../js/common/browser/browser-msg.js';
import { Catch } from '../../../js/common/platform/catch.js';
import { Composer } from './composer.js';
import { ComposerComponent } from './composer-abstract-component.js';
import { Google } from '../../../js/common/api/google.js';
import { GoogleAuth } from '../../../js/common/api/google-auth.js';
import { Lang } from '../../../js/common/lang.js';
import { Store } from '../../../js/common/platform/store.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { Xss } from '../../../js/common/platform/xss.js';
import { moveElementInArray } from '../../../js/common/platform/util.js';

export class ComposerRecipients extends ComposerComponent {
  private readonly failedLookupEmails: string[] = [];

  private addedRecipients: RecipientElement[] = [];
  private BTN_LOADING = 'Loading..';

  private readonly MAX_CONTACTS_LENGTH = 8;

  private contactSearchInProgress = false;
  private addedPubkeyDbLookupInterval?: number;

  private recipientsMissingMyKey: string[] = [];

  private onRecipientAddedCallbacks: ((rec: RecipientElement[]) => void)[] = [];

  private dragged: Element | undefined = undefined;

  private canSearchContacts: boolean;

  constructor(composer: Composer) {
    super(composer);
    this.canSearchContacts = this.composer.view.scopes!.readContacts;
  }

  public initActions = (): void => {
    let preventSearchContacts = false;
    const inputs = this.composer.S.cached('recipients_inputs');
    inputs.on('keyup', this.view.setHandlerPrevent('veryslowspree', async (target) => {
      if (!preventSearchContacts) {
        await this.searchContacts($(target));
      }
    }));
    inputs.on('keydown', this.view.setHandler(async (target, e) => {
      preventSearchContacts = this.recipientInputKeydownHandler(e);
    }));
    inputs.on('blur', this.view.setHandler(async (target, e) => {
      if (this.dragged) { // blur while drag&drop
        return;
      }
      this.composer.errs.debug(`input_to.blur -> parseRenderRecipients start causedBy(${e.relatedTarget ? e.relatedTarget.outerHTML : undefined})`);
      await this.parseRenderRecipients($(target));
      // If thereis no related target or related target isn't in recipients functionality
      // then we need to collapse inputs
      await this.collapseIpnutsIfNeeded(e.relatedTarget);
      this.composer.errs.debug(`input_to.blur -> parseRenderRecipients done`);
    }));
    inputs.on('dragenter', this.view.setHandler((target, e) => {
      if (Catch.browser().name === 'firefox') {
        this.insertCursorBefore(target.previousElementSibling!, true);
      } else {
        target.focus();
      }
    }));
    inputs.on('dragleave', this.view.setHandler((target) => {
      if (Catch.browser().name === 'firefox') {
        this.removeCursor(target.previousElementSibling! as HTMLElement);
      } else {
        target.blur();
      }
    }));
    inputs.on('dragover', (e) => e.preventDefault());
    inputs.on('drop', this.view.setHandler((target) => {
      if (Catch.browser().name === 'firefox') {
        this.removeCursor(target.previousElementSibling as HTMLElement);
      }
      if (this.dragged) {
        const previousInput = this.dragged.parentElement!.nextElementSibling!;
        this.dragged.parentElement!.removeChild(this.dragged);
        const sendingType = target.getAttribute('data-sending-type') as RecipientType;
        const jqueryTarget = $(target);
        jqueryTarget.siblings('.recipients').append(this.dragged); // xss-safe-value
        const draggableElementIndex = this.addedRecipients.findIndex(r => r.element === this.dragged);
        this.addedRecipients[draggableElementIndex].sendingType = sendingType;
        this.addedRecipients = moveElementInArray(this.addedRecipients, draggableElementIndex, this.addedRecipients.length - 1);
        this.composer.size.resizeInput(jqueryTarget.add(previousInput));
        target.focus();
      }
    }));
    const handleCopyActionsClick = (target: HTMLElement, newContainer: JQuery<HTMLElement>) => {
      const buttonsContainer = target.parentElement!;
      const curentContainer = buttonsContainer.parentElement!;
      const input = newContainer.find('input');
      curentContainer.removeChild(buttonsContainer);
      newContainer.append(buttonsContainer); // xss-safe-value
      newContainer.css('display', 'block');
      target.style.display = 'none';
      input.focus();
      this.composer.size.resizeComposeBox();
      this.composer.size.setInputTextHeightManuallyIfNeeded();
    };
    this.composer.S.now('cc').click(this.view.setHandler((target) => {
      const newContainer = this.composer.S.cached('input_addresses_container_outer').find(`#input-container-cc`);
      handleCopyActionsClick(target, newContainer);
    }));
    this.composer.S.now('bcc').click(this.view.setHandler((target) => {
      const newContainer = this.composer.S.cached('input_addresses_container_outer').find(`#input-container-bcc`);
      handleCopyActionsClick(target, newContainer);
    }));
    this.composer.S.cached('recipients_placeholder').click(this.view.setHandler((target) => {
      this.composer.S.cached('input_to').focus();
    }));
    this.composer.S.cached('input_to').focus(this.view.setHandler(() => this.focusRecipients()));
    this.composer.S.cached('cc').focus(this.view.setHandler(() => this.focusRecipients()));
    this.composer.S.cached('bcc').focus(this.view.setHandler(() => this.focusRecipients()));
    this.composer.S.cached('compose_table').click(this.view.setHandler(() => this.hideContacts(), this.composer.errs.handlers(`hide contact box`)));
    this.composer.S.cached('add_their_pubkey').click(this.view.setHandler(() => {
      const noPgpRecipients = this.addedRecipients.filter(r => r.element.className.includes('no_pgp'));
      this.composer.render.renderAddPubkeyDialog(noPgpRecipients.map(r => r.email));
      clearInterval(this.addedPubkeyDbLookupInterval); // todo - get rid of Catch.set_interval. just supply tabId and wait for direct callback
      this.addedPubkeyDbLookupInterval = Catch.setHandledInterval(async () => {
        const recipientsHasPgp: RecipientElement[] = [];
        for (const recipient of noPgpRecipients) {
          const [contact] = await Store.dbContactGet(undefined, [recipient.email]);
          if (contact && contact.has_pgp) {
            $(recipient.element).removeClass('no_pgp').find('i').remove();
            clearInterval(this.addedPubkeyDbLookupInterval);
            recipientsHasPgp.push(recipient);
          }
        }
        await this.evaluateRecipients(recipientsHasPgp);
        await this.setEmailsPreview(this.getRecipients());
      }, 1000);
    }, this.composer.errs.handlers('add recipient public key')));
    BrowserMsg.addListener('addToContacts', this.checkReciepientsKeys);
    BrowserMsg.listen(this.view.parentTabId);
  }

  public getRecipients = () => {
    return this.addedRecipients;
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

  public parseRenderRecipients = async (inputs: JQuery<HTMLElement>, force?: boolean, uncheckedEmails?: string[]): Promise<void> => {
    this.composer.errs.debug(`parseRenderRecipients(force: ${force})`);
    for (const inputElem of inputs) {
      const input = $(inputElem);
      const sendingType = input.data('sending-type') as RecipientType;
      this.composer.errs.debug(`parseRenderRecipients(force: ${force}) - sending type - ${sendingType}`);
      uncheckedEmails = uncheckedEmails || String(input.val()).split(/,/g);
      this.composer.errs.debug(`parseRenderRecipients(force: ${force}) - emails to check(${uncheckedEmails.join(',')})`);
      const validationResult = this.validateEmails(uncheckedEmails);
      let recipientsToEvaluate: RecipientElement[] = [];
      const container = input.parent();
      if (validationResult.valid.length) {
        this.composer.errs.debug(`parseRenderRecipients(force: ${force}) - valid emails(${validationResult.valid.join(',')})`);
        recipientsToEvaluate = this.createRecipientsElements(container, validationResult.valid, sendingType, RecipientStatuses.EVALUATING);
      }
      const invalidEmails = validationResult.invalid.filter(em => !!em); // remove empty strings
      this.composer.errs.debug(`parseRenderRecipients(force: ${force}) - invalid emails(${validationResult.invalid.join(',')})`);
      if (force && invalidEmails.length) {
        this.composer.errs.debug(`parseRenderRecipients(force: ${force}) - force add invalid recipients`);
        recipientsToEvaluate = [...recipientsToEvaluate, ...this.createRecipientsElements(container, invalidEmails, sendingType, RecipientStatuses.WRONG)];
        input.val('');
      } else {
        this.composer.errs.debug(`parseRenderRecipients(force: ${force}) - setting inputTo with invalid emails`);
        input.val(validationResult.invalid.join(','));
      }
      this.composer.errs.debug(`parseRenderRecipients(force: ${force}).2`);
      this.composer.size.resizeInput(input);
      if (recipientsToEvaluate.length) {
        await this.evaluateRecipients(recipientsToEvaluate);
        this.composer.errs.debug(`parseRenderRecipients(force: ${force}).3`);
        this.composer.size.resizeInput(input);
        this.composer.errs.debug(`parseRenderRecipients(force: ${force}).4`);
      }
    }
  }

  public addRecipients = async (recipients: Recipients, triggerCallback: boolean = true) => {
    let newRecipients: RecipientElement[] = [];
    for (const key in recipients) {
      if (recipients.hasOwnProperty(key)) {
        const sendingType = key as RecipientType;
        if (recipients[sendingType] && recipients[sendingType]!.length) {
          const recipientsContainer = this.composer.S.cached('input_addresses_container_outer').find(`#input-container-${sendingType}`);
          newRecipients = newRecipients.concat(this.createRecipientsElements(recipientsContainer, recipients[sendingType]!, sendingType, RecipientStatuses.EVALUATING));
          this.composer.S.cached('input_addresses_container_outer').find(`#input-container-${sendingType}`).css('display', '');
          this.composer.size.resizeInput(this.composer.S.cached('input_addresses_container_outer').find(`#input-container-${sendingType} input`));
        }
      }
    }
    await this.evaluateRecipients(newRecipients, triggerCallback);
  }

  public deleteRecipientsBySendingType = (types: ('to' | 'cc' | 'bcc')[]) => {
    for (const recipient of this.addedRecipients.filter(r => types.includes(r.sendingType))) {
      this.removeRecipient(recipient.element);
    }
  }

  public hideContacts = () => {
    this.composer.S.cached('contacts').css('display', 'none');
    this.composer.S.cached('contacts').children().not('ul').remove();
  }

  public addRecipientsAndShowPreview = async (recipients: Recipients) => {
    this.composer.recipients.addRecipients(recipients).catch(Catch.reportErr);
    this.composer.recipients.showHideCcAndBccInputsIfNeeded();
    await this.composer.recipients.setEmailsPreview(this.getRecipients());
  }

  public reEvaluateRecipients = async (recipients: RecipientElement[]) => {
    for (const recipient of recipients) {
      $(recipient.element).empty().removeClass();
      Xss.sanitizeAppend(recipient.element, `${Xss.escape(recipient.email)} ${Ui.spinner('green')}`);
    }
    await this.evaluateRecipients(recipients);
  }

  public evaluateRecipients = async (recipients: RecipientElement[], triggerCallback: boolean = true) => {
    this.composer.errs.debug(`evaluateRecipients`);
    $('body').attr('data-test-state', 'working');
    for (const recipient of recipients) {
      this.composer.errs.debug(`evaluateRecipients.email(${String(recipient.email)})`);
      this.composer.S.now('send_btn_text').text(this.BTN_LOADING);
      this.composer.size.setInputTextHeightManuallyIfNeeded();
      recipient.evaluating = (async () => {
        let pubkeyLookupRes: Contact | 'fail' | 'wrong';
        if (recipient.status !== RecipientStatuses.WRONG) {
          pubkeyLookupRes = await this.composer.storage.lookupPubkeyFromDbOrKeyserverAndUpdateDbIfneeded(recipient.email);
        } else {
          pubkeyLookupRes = 'wrong';
        }
        await this.renderPubkeyResult(recipient, pubkeyLookupRes);
        recipient.evaluating = undefined; // Clear promise when it finished
      })();
    }
    await Promise.all(recipients.map(r => r.evaluating));
    if (triggerCallback) {
      for (const callback of this.onRecipientAddedCallbacks) {
        callback(recipients);
      }
    }
    $('body').attr('data-test-state', 'ready');
    this.composer.size.setInputTextHeightManuallyIfNeeded();
  }

  /**
  * Generate content for emails preview in some container
  * when recipient inputs are collapsed.
  * e.g. 'test@test.com, test2@test.com [3 more]'
  *
  * @param container - HTMLElement where emails have to be inserted
  * @param recipients - Recipients that should be previewed
  */
  public setEmailsPreview = async (recipients: RecipientElement[]): Promise<void> => {
    if (recipients.length) {
      this.composer.S.cached('recipients_placeholder').find('.placeholder').css('display', 'none');
    } else {
      this.composer.S.cached('recipients_placeholder').find('.placeholder').css('display', 'block');
      this.composer.S.cached('recipients_placeholder').find('.email_preview').empty();
      return;
    }
    const container = this.composer.S.cached('recipients_placeholder').find('.email_preview');
    if (recipients.find(r => r.status === RecipientStatuses.EVALUATING)) {
      container.append(`<span id="r_loader">Loading Reciepients ${Ui.spinner('green')}</span>`); // xss-direct
      await Promise.all(recipients.filter(r => r.evaluating).map(r => r.evaluating!));
      container.find('r_loader').remove();
    }
    Xss.sanitizeRender(container, '<span class="rest"><span id="rest_number"></span> more</span>');
    const maxWidth = container.parent().width()!;
    const rest = container.find('.rest');
    let processed = 0;
    while (container.width()! <= maxWidth && recipients.length >= processed + 1) {
      const recipient = recipients[processed];
      const escapedTitle = Xss.escape(recipient.element.getAttribute('title') || '');
      const emailHtml = `<span class="email_address ${recipient.element.className}" title="${escapedTitle}">${Xss.escape(recipient.email)}</span>`;
      $(emailHtml).insertBefore(rest); // xss-escaped
      processed++;
    }
    if (container.width()! > maxWidth) {
      container.find('.email_address').last().remove();
      const restRecipients = recipients.slice(processed - 1);
      rest.find('#rest_number').text(restRecipients.length);
      const orderedByStatus = restRecipients.sort((a: RecipientElement, b: RecipientElement) => {
        return a.status - b.status;
      });
      const last = orderedByStatus[orderedByStatus.length - 1]; // Last element has the worst status
      rest.addClass(last.element.className);
    } else {
      rest.remove();
    }
  }

  public showHideCcAndBccInputsIfNeeded = () => {
    const isThere = { cc: false, bcc: false };
    for (const recipient of this.addedRecipients) {
      if (isThere.cc && isThere.bcc) {
        break;
      }
      if (recipient.sendingType === 'cc') {
        isThere.cc = true;
      } else if (recipient.sendingType === 'bcc') {
        isThere.bcc = true;
      }
    }
    this.composer.S.cached('input_addresses_container_outer').find(`#input-container-cc`).css('display', isThere.cc ? '' : 'none');
    this.composer.S.cached('cc').css('display', isThere.cc ? 'none' : '');
    this.composer.S.cached('input_addresses_container_outer').find(`#input-container-bcc`).css('display', isThere.bcc ? '' : 'none');
    this.composer.S.cached('bcc').css('display', isThere.bcc ? 'none' : '');
    this.composer.S.cached('input_addresses_container_outer').children(`:not([style="display: none;"])`).last().append(this.composer.S.cached('container_cc_bcc_buttons')); // xss-reinsert
  }

  public collapseIpnutsIfNeeded = async (relatedTarget?: HTMLElement | null) => { // TODO: fix issue when loading no-pgp email and user starts typing
    if (!relatedTarget || (!this.composer.S.cached('input_addresses_container_outer')[0].contains(relatedTarget)
      && !this.composer.S.cached('contacts')[0].contains(relatedTarget))) {
      await Promise.all(this.addedRecipients.map(r => r.evaluating)); // Wait untill all recipients loaded.
      if (this.composer.S.cached('recipients_inputs').is(':focus')) { // We don't need to colapse it if some input is on focus again.
        return;
      }
      this.showHideCcAndBccInputsIfNeeded();
      this.composer.S.cached('input_addresses_container_outer').addClass('invisible');
      this.composer.S.cached('recipients_placeholder').css('display', 'flex');
      await this.setEmailsPreview(this.addedRecipients);
      this.hideContacts();
      this.composer.size.setInputTextHeightManuallyIfNeeded();
    }
  }

  public onRecipientAdded = (callback: (rec: RecipientElement[]) => void) => {
    this.onRecipientAddedCallbacks.push(callback);
  }

  public doesRecipientHaveMyPubkey = async (theirEmailUnchecked: string): Promise<boolean | undefined> => {
    const theirEmail = Str.parseEmail(theirEmailUnchecked).email;
    if (!theirEmail) {
      return false;
    }
    const storage = await Store.getAcct(this.view.acctEmail, ['pubkey_sent_to']);
    if (storage.pubkey_sent_to && storage.pubkey_sent_to.includes(theirEmail)) {
      return true;
    }
    if (!this.composer.view.scopes!.read && !this.composer.view.scopes!.modify) {
      return undefined; // cannot read email
    }
    const qSentPubkey = `is:sent to:${theirEmail} "BEGIN PGP PUBLIC KEY" "END PGP PUBLIC KEY"`;
    const qReceivedMsg = `from:${theirEmail} "BEGIN PGP MESSAGE" "END PGP MESSAGE"`;
    try {
      const response = await this.composer.emailProvider.msgList(`(${qSentPubkey}) OR (${qReceivedMsg})`, true);
      if (response.messages) {
        await Store.setAcct(this.view.acctEmail, { pubkey_sent_to: (storage.pubkey_sent_to || []).concat(theirEmail) });
        return true;
      } else {
        return false;
      }
    } catch (e) {
      if (ApiErr.isAuthPopupNeeded(e)) {
        BrowserMsg.send.notificationShowAuthPopupNeeded(this.view.parentTabId, { acctEmail: this.view.acctEmail });
      } else if (!ApiErr.isNetErr(e)) {
        Catch.reportErr(e);
      }
      return undefined;
    }
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
    if (e.key === 'Backspace') {
      if (!$(e.target).val()) {
        const sendingType = e.target.getAttribute('data-sending-type') as RecipientType;
        const lastRecipient = this.addedRecipients.reverse().find(r => r.sendingType === sendingType);
        if (lastRecipient) {
          this.removeRecipient(lastRecipient.element);
        }
      }
      return false;
    } else if (e.keyCode === 32) { // Handle 'Space' key
      const target = $(e.target);
      const emails = String(target.val()).split(/[,\s]/g).filter(e => !!e);
      if (!emails.find(e => !Str.isEmailValid(e))) {
        this.parseRenderRecipients($(e.target), false, emails).catch(Catch.reportErr);
        e.preventDefault();
      } else if (target.val() === '') {
        e.preventDefault();
      }
    } else if (e.key === 'Enter') {
      if (currentActive.length) { // If he pressed enter when contacts popover is shown
        currentActive.click(); // select contact
        currentActive.removeClass('active');
      } else { // We need to force add recipient even it's invalid
        this.parseRenderRecipients($(e.target), true).catch(Catch.reportErr);
      }
      e.target.focus();
      return true;
    } else if (this.composer.S.cached('contacts').is(':hidden')) { // Next will affect contacts popover
      return false;
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      this.hideContacts();
      this.composer.S.cached('input_to').focus();
      return true;
    } else if (!currentActive.length) {
      return false; // all following code operates on selected currentActive element
    } else if (e.key === 'Tab') {
      e.preventDefault(); // don't switch inputs
      e.stopPropagation(); // don't switch inputs
      currentActive.click(); // select contact
      currentActive.removeClass('active');
      return true;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      let prev = currentActive.prev('.select_contact');
      if (!prev.length) {
        prev = this.composer.S.cached('contacts').find('ul li.select_contact').last();
      }
      currentActive.removeClass('active');
      prev.addClass('active');
      return true;
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      let next = currentActive.next('.select_contact');
      if (!next.length) {
        next = this.composer.S.cached('contacts').find('ul li.select_contact').first();
      }
      currentActive.removeClass('active');
      next.addClass('active');
      return true;
    }
    return false;
  }

  private searchContacts = async (input: JQuery<HTMLElement>, dbOnly = false) => {
    try {
      this.composer.errs.debug(`searchContacts`);
      const substring = Str.parseEmail(String(input.val()), 'DO-NOT-VALIDATE').email;
      this.composer.errs.debug(`searchContacts.query.substring(${JSON.stringify(substring)})`);
      if (substring) {
        const query = { substring };
        const contacts = await Store.dbContactSearch(undefined, query);
        const canLoadContactsFromAPI = this.composer.canReadEmails || this.canSearchContacts;
        if (dbOnly || contacts.length >= this.MAX_CONTACTS_LENGTH || !canLoadContactsFromAPI) {
          this.composer.errs.debug(`searchContacts 1`);
          this.renderSearchRes(input, contacts, query);
        } else {
          this.composer.errs.debug(`searchContacts 2`);
          this.contactSearchInProgress = true;
          this.renderSearchRes(input, contacts, query);
          this.composer.errs.debug(`searchContacts 3`);
          if (this.canSearchContacts) {
            this.composer.errs.debug(`searchContacts (Gmail API) 3`);
            const contactsGmail = await Google.contactsGet(this.view.acctEmail, substring, undefined, this.MAX_CONTACTS_LENGTH);
            if (contactsGmail) {
              const newContacts = contactsGmail.filter(cGmail => !contacts.find(c => c.email === cGmail.email));
              const mappedContactsFromGmail = await Promise.all(newContacts.map(({ email, name }) => Store.dbContactObj({ email, name })));
              await this.renderAndAddToDBAPILoadedContacts(input, mappedContactsFromGmail);
            }
          } else if (this.composer.canReadEmails) {
            this.composer.errs.debug(`searchContacts (Gmail Sent Messages) 3`);
            this.guessContactsFromSentEmails(query.substring, contacts, contacts => this.renderAndAddToDBAPILoadedContacts(input, contacts.new));
          }
          this.composer.errs.debug(`searchContacts 4`);
          this.renderSearchResultsLoadingDone();
          this.contactSearchInProgress = false;
          this.composer.errs.debug(`searchContacts 5`);
        }
      } else {
        this.hideContacts(); // todo - show suggestions of most contacted ppl etc
        this.composer.errs.debug(`searchContacts 6`);
      }
    } catch (e) {
      Ui.toast(`Error searching contacts: ${ApiErr.eli5(e)}`, 5).catch(Catch.reportErr);
      throw e;
    }
  }

  private guessContactsFromSentEmails = (query: string, knownContacts: Contact[], multiCb: ChunkedCb) => {
    this.composer.emailProvider.guessContactsFromSentEmails(query, knownContacts, multiCb).catch(e => {
      if (ApiErr.isAuthPopupNeeded(e)) {
        BrowserMsg.send.notificationShowAuthPopupNeeded(this.view.parentTabId, { acctEmail: this.view.acctEmail });
      } else if (ApiErr.isNetErr(e)) {
        Ui.toast(`Network erroc - cannot search contacts`).catch(Catch.reportErr);
      } else if (ApiErr.isMailOrAcctDisabledOrPolicy(e)) {
        Ui.toast(`Cannot search contacts - account disabled or forbidden by admin policy`).catch(Catch.reportErr);
      } else {
        Catch.reportErr(e);
        Ui.toast(`Error searching contacts: ${ApiErr.eli5(e)}`).catch(Catch.reportErr);
      }
    });
  }

  private renderSearchRes = (input: JQuery<HTMLElement>, contacts: Contact[], query: ProviderContactsQuery) => {
    const renderableContacts = contacts.slice(0, this.MAX_CONTACTS_LENGTH);
    renderableContacts.sort((a, b) =>
      (10 * (b.has_pgp - a.has_pgp)) + ((b.last_use || 0) - (a.last_use || 0) > 0 ? 1 : -1)).slice(8); // have pgp on top, no pgp bottom. Sort each groups by last used
    if ((renderableContacts.length > 0 || this.contactSearchInProgress) || !this.canSearchContacts) {
      let ulHtml = '';
      for (const contact of renderableContacts) {
        ulHtml += `<li class="select_contact" data-test="action-select-contact" email="${Xss.escape(contact.email.replace(/<\/?b>/g, ''))}">`;
        if (contact.has_pgp) {
          ulHtml += '<img class="lock-icon" src="/img/svgs/locked-icon-green.svg" />';
        } else {
          ulHtml += '<img class="lock-icon" src="/img/svgs/locked-icon-gray.svg" />';
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
        ulHtml += '<li class="loading" data-test="container-contacts-loading">loading...</li>';
      }
      Xss.sanitizeRender(this.composer.S.cached('contacts').find('ul'), ulHtml);
      if (!this.canSearchContacts) {
        if (!contacts.length) {
          this.composer.S.cached('contacts').find('ul').append('<li>No Contacts Found</li>'); // xss-direct
        }
        this.addBtnToAllowSearchContactsFromGoogle(input);
      }
      const contactItems = this.composer.S.cached('contacts').find('ul li.select_contact');
      contactItems.first().addClass('active');
      contactItems.click(this.view.setHandlerPrevent('double', async (target: HTMLElement) => {
        const email = Str.parseEmail($(target).attr('email') || '').email;
        if (email) {
          await this.selectContact(input, email, query);
        }
      }, this.composer.errs.handlers(`select contact`)));
      contactItems.hover(function () {
        contactItems.removeClass('active');
        $(this).addClass('active');
      });
      this.composer.S.cached('contacts').find('ul li.auth_contacts').click(this.view.setHandler(() =>
        this.authContacts(this.view.acctEmail), this.composer.errs.handlers(`authorize contact search`)));
      const offset = input.offset()!;
      const inputToPadding = parseInt(input.css('padding-left'));
      let leftOffset: number;
      if (this.composer.S.cached('body').width()! < offset.left + inputToPadding + this.composer.S.cached('contacts').width()!) {
        // Here we need to align contacts popover by right side
        leftOffset = offset.left + inputToPadding + input.width()! - this.composer.S.cached('contacts').width()!;
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

  private addBtnToAllowSearchContactsFromGoogle = (input: JQuery<HTMLElement>) => {
    if (this.composer.S.cached('contacts').find('.allow-google-contact-search').length) {
      return;
    }
    this.composer.S.cached('contacts')
      .append('<div class="allow-google-contact-search" data-test="action-auth-with-contacts-scope"><img src="/img/svgs/gmail.svg" />Enable Google Contact Search</div>') // xss-direct
      .find('.allow-google-contact-search')
      .click(this.view.setHandler(async () => {
        const authResult = await BrowserMsg.send.bg.await.reconnectAcctAuthPopup({ acctEmail: this.view.acctEmail, scopes: GoogleAuth.defaultScopes('contacts') });
        if (authResult.result === 'Success') {
          this.canSearchContacts = true;
          this.hideContacts();
          await this.searchContacts(input);
        } else if (authResult.result !== 'Closed') {
          await Ui.modal.error(`Could not enable Google Contact search. Please write us at human@flowcrypt.com\n\n[${authResult.result}] ${authResult.error}`);
        }
      }));
  }

  private selectContact = async (input: JQuery<HTMLElement>, email: string, fromQuery: ProviderContactsQuery) => {
    this.composer.errs.debug(`selectContact 1`);
    const possiblyBogusRecipient = input.siblings('.recipients span.wrong').last();
    const possiblyBogusAddr = Str.parseEmail(possiblyBogusRecipient.text()).email;
    this.composer.errs.debug(`selectContact 2`);
    const q = Str.parseEmail(fromQuery.substring).email;
    if (possiblyBogusAddr && q && (possiblyBogusAddr === q || possiblyBogusAddr.includes(q))) {
      possiblyBogusRecipient.remove();
    }
    if (!this.addedRecipients.find(r => r.email === email)) {
      this.composer.errs.debug(`selectContact -> parseRenderRecipients start`);
      this.parseRenderRecipients(input, false, [email]).catch(Catch.reportErr);
    }
    input.focus();
    this.hideContacts();
  }

  private createRecipientsElements = (container: JQuery<HTMLElement>, emails: string[], sendingType: RecipientType, status: RecipientStatus): RecipientElement[] => {
    const result = [];
    for (const rawEmail of emails) {
      const { email } = Str.parseEmail(rawEmail);
      const recipientId = this.generateRecipientId();
      const recipientsHtml = `<span tabindex="0" id="${recipientId}"><span>${Xss.escape(email || rawEmail)}</span> ${Ui.spinner('green')}</span>`;
      Xss.sanitizeAppend(container.find('.recipients'), recipientsHtml);
      const element = document.getElementById(recipientId);
      if (element) { // if element wasn't created this means that Composer is used by another component
        $(element).on('blur', this.view.setHandler(async (elem, event) => {
          if (!this.dragged) {
            await this.collapseIpnutsIfNeeded(event.relatedTarget);
          }
        }));
        this.addDraggableEvents(element);
        const recipient = { email: email || rawEmail, element, id: recipientId, sendingType, status: email ? status : RecipientStatuses.WRONG };
        this.addedRecipients.push(recipient);
        result.push(recipient);
      }
    }
    return result;
  }

  private renderAndAddToDBAPILoadedContacts = async (input: JQuery<HTMLElement>, contacts: Contact[]) => {
    if (contacts.length) {
      const updatePromises: Promise<void>[] = [];
      for (const contact of contacts) {
        const [inDb] = await Store.dbContactGet(undefined, [contact.email]);
        if (!inDb && !this.failedLookupEmails.includes(contact.email)) {
          updatePromises.push((async () => {
            const lookupRes = await this.composer.storage.lookupPubkeyFromDbOrKeyserverAndUpdateDbIfneeded(contact.email);
            if (lookupRes === 'fail') {
              this.failedLookupEmails.push(contact.email);
            }
          })());
        } else if (!inDb?.name && contact.name) {
          const toUpdate = { name: contact.name };
          await Store.dbContactUpdate(undefined, contact.email, toUpdate);
        }
      }
      await Promise.all(updatePromises);
      await this.searchContacts(input, true);
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
      await this.searchContacts(this.composer.S.cached('input_to'));
    } else if (authRes.result === 'Denied' || authRes.result === 'Closed') {
      await Ui.modal.error('FlowCrypt needs this permission to search your contacts on Gmail. Without it, FlowCrypt will keep a separate contact list.');
    } else {
      await Ui.modal.error(Lang.general.somethingWentWrongTryAgain);
    }
  }

  private checkReciepientsKeys = async () => {
    for (const recipientEl of this.addedRecipients.filter(r => r.element.className.includes('no_pgp'))) {
      const email = $(recipientEl).text().trim();
      const [dbContact] = await Store.dbContactGet(undefined, [email]);
      if (dbContact) {
        recipientEl.element.classList.remove('no_pgp');
        await this.renderPubkeyResult(recipientEl, dbContact);
      }
    }
  }

  private renderPubkeyResult = async (recipient: RecipientElement, contact: Contact | 'fail' | 'wrong') => {
    const el = recipient.element;
    this.composer.errs.debug(`renderPubkeyResult.emailEl(${String(recipient.email)})`);
    this.composer.errs.debug(`renderPubkeyResult.email(${recipient.email})`);
    this.composer.errs.debug(`renderPubkeyResult.contact(${JSON.stringify(contact)})`);
    $(el).children('img, i').remove();
    const contentHtml = '<img src="/img/svgs/close-icon.svg" alt="close" class="close-icon svg" />' +
      '<img src="/img/svgs/close-icon-black.svg" alt="close" class="close-icon svg display_when_sign" />';
    Xss.sanitizeAppend(el, contentHtml)
      .find('img.close-icon')
      .click(this.view.setHandler(target => this.removeRecipient(target.parentElement!), this.composer.errs.handlers('remove recipient')));
    if (contact === PUBKEY_LOOKUP_RESULT_FAIL) {
      recipient.status = RecipientStatuses.FAILED;
      $(el).attr('title', 'Failed to load, click to retry');
      $(el).addClass("failed");
      Xss.sanitizeReplace($(el).children('img:visible'), '<img src="/img/svgs/repeat-icon.svg" class="repeat-icon action_retry_pubkey_fetch">' +
        '<img src="/img/svgs/close-icon-black.svg" class="close-icon-black svg remove-reciepient">');
      $(el).find('.action_retry_pubkey_fetch').click(this.view.setHandler(async () => await this.refreshRecipients(), this.composer.errs.handlers('refresh recipient')));
      $(el).find('.remove-reciepient').click(this.view.setHandler(element => this.removeRecipient(element.parentElement!), this.composer.errs.handlers('remove recipient')));
    } else if (contact === PUBKEY_LOOKUP_RESULT_WRONG) {
      recipient.status = RecipientStatuses.WRONG;
      this.composer.errs.debug(`renderPubkeyResult: Setting email to wrong / misspelled in harsh mode: ${recipient.email}`);
      $(el).attr('title', 'This email address looks misspelled. Please try again.');
      $(el).addClass("wrong");
    } else if (contact.pubkey && ((contact.expiresOn || Infinity) <= Date.now() || await PgpKey.usableButExpired(await PgpKey.read(contact.pubkey)))) {
      recipient.status = RecipientStatuses.EXPIRED;
      $(el).addClass("expired");
      Xss.sanitizePrepend(el, '<img src="/img/svgs/expired-timer.svg" class="expired-time">');
      $(el).attr('title', 'Does use encryption but their public key is expired. You should ask them to send ' +
        'you an updated public key.' + this.recipientKeyIdText(contact));
    } else if (contact.pubkey) {
      recipient.status = RecipientStatuses.HAS_PGP;
      $(el).addClass("has_pgp");
      Xss.sanitizePrepend(el, '<img class="lock-icon" src="/img/svgs/locked-icon.svg" />');
      $(el).attr('title', 'Does use encryption' + this.recipientKeyIdText(contact));
    } else {
      recipient.status = RecipientStatuses.NO_PGP;
      $(el).addClass("no_pgp");
      Xss.sanitizePrepend(el, '<img class="lock-icon" src="/img/svgs/locked-icon.svg" />');
      $(el).attr('title', 'Could not verify their encryption setup. You can encrypt the message with a password below. Alternatively, add their pubkey.');
    }
    this.composer.pwdOrPubkeyContainer.showHideContainerAndColorSendBtn();
    this.composer.myPubkey.reevaluateShouldAttachOrNot();
  }

  private removeRecipient = (element: HTMLElement) => {
    this.recipientsMissingMyKey = Value.arr.withoutVal(this.recipientsMissingMyKey, $(element).parent().text());
    const index = this.addedRecipients.findIndex(r => r.element.isEqualNode(element));
    const container = element.parentElement!.parentElement!; // Get Container, e.g. '.input-container-cc'
    this.addedRecipients[index].element.remove();
    this.composer.size.resizeInput($(container).find('input'));
    this.composer.S.cached('input_addresses_container_outer').find(`#input-container-${this.addedRecipients[index].sendingType} input`).focus();
    this.addedRecipients.splice(index, 1);
    this.composer.pwdOrPubkeyContainer.showHideContainerAndColorSendBtn();
    this.composer.myPubkey.reevaluateShouldAttachOrNot();
  }

  private refreshRecipients = async () => {
    const failedRecipients = this.addedRecipients.filter(r => r.element.className.includes('failed'));
    await this.reEvaluateRecipients(failedRecipients);
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

  private addDraggableEvents = (element: HTMLElement) => {
    element.draggable = true;
    element.ondragstart = (event) => {
      event.dataTransfer!.setData('text/plain', 'FlowCrypt Drag&Drop'); // Firefox requires to run the dataTransfer.setData function in the event.
      this.dragged = element;
    };
    element.ondragenter = () => {
      if (this.dragged !== element) {
        this.insertCursorBefore(element);
      }
    };
    element.ondragleave = () => {
      if (this.dragged !== element) {
        this.removeCursor(element.parentElement!);
      }
    };
    element.ondragover = (ev) => {
      ev.preventDefault();
    };
    element.ondrop = () => {
      this.removeCursor(element.parentElement!);
      // The position won't be changed so we don't need to do any manipulations
      if (!this.dragged || this.dragged === element || this.dragged.nextElementSibling === element) {
        this.dragged = undefined;
        return;
      }
      const previousInput = this.dragged.parentElement!.nextElementSibling!;
      this.dragged.parentElement!.removeChild(this.dragged);
      element.parentElement!.insertBefore(this.dragged, element);  // xss-reinsert
      const draggableElementIndex = this.addedRecipients.findIndex(r => r.element === this.dragged);
      const sendingType = this.addedRecipients.find(r => r.element === element)!.sendingType;
      this.addedRecipients[draggableElementIndex].sendingType = sendingType;
      // Sync the Recipients array with HTML
      this.addedRecipients = moveElementInArray(this.addedRecipients, draggableElementIndex, this.addedRecipients.findIndex(r => r.element === element));
      const newInput = this.composer.S.cached('input_addresses_container_outer').find(`#input-container-${sendingType} input`);
      this.composer.size.resizeInput(newInput.add(previousInput));
      this.dragged = undefined;
      newInput.focus();
    };
    element.ondragend = () => Catch.setHandledTimeout(() => this.dragged = undefined, 0);
  }

  private insertCursorBefore = (element: HTMLElement | Element, append?: boolean) => {
    const cursor = document.createElement('i');
    cursor.classList.add('drag-cursor');
    if (!append) {
      if (!element.parentElement) {
        return false;
      }
      element.parentElement!.insertBefore(cursor, element); // xss-reinsert
    } else {
      element.appendChild(cursor);
    }
    return true;
  }

  private removeCursor = (element: HTMLElement) => {
    for (const child of element.children) {
      if (child.classList.contains('drag-cursor')) {
        child.parentElement!.removeChild(child);
        break;
      }
    }
  }

  private focusRecipients = () => {
    this.composer.S.cached('recipients_placeholder').hide();
    this.composer.S.cached('input_addresses_container_outer').removeClass('invisible');
    this.composer.size.resizeComposeBox();
    if (this.view.isReplyBox) {
      this.composer.size.resizeInput();
    }
    this.composer.size.setInputTextHeightManuallyIfNeeded();
  }

}
