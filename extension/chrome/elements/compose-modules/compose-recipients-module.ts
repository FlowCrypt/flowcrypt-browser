/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { ChunkedCb, RecipientType } from '../../../js/common/api/shared/api.js';
import { Contact } from '../../../js/common/core/crypto/key.js';
import { PUBKEY_LOOKUP_RESULT_FAIL, PUBKEY_LOOKUP_RESULT_WRONG } from './compose-err-module.js';
import { ProviderContactsQuery, Recipients } from '../../../js/common/api/email-provider/email-provider-api.js';
import { RecipientElement, RecipientStatus, RecipientStatuses } from './compose-types.js';
import { Str, Value } from '../../../js/common/core/common.js';
import { ApiErr } from '../../../js/common/api/shared/api-error.js';
import { Bm, BrowserMsg } from '../../../js/common/browser/browser-msg.js';
import { Catch } from '../../../js/common/platform/catch.js';
import { Google } from '../../../js/common/api/email-provider/gmail/google.js';
import { GoogleAuth } from '../../../js/common/api/email-provider/gmail/google-auth.js';
import { Lang } from '../../../js/common/lang.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { Xss } from '../../../js/common/platform/xss.js';
import { moveElementInArray } from '../../../js/common/platform/util.js';
import { ViewModule } from '../../../js/common/view-module.js';
import { ComposeView } from '../compose.js';
import { AcctStore } from '../../../js/common/platform/store/acct-store.js';
import { ContactStore, ContactUpdate } from '../../../js/common/platform/store/contact-store.js';

/**
 * todo - this class is getting too big
 * split into ComposeRecipientsModule and ComposeContactSearchModule
 */
export class ComposeRecipientsModule extends ViewModule<ComposeView> {

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
  private canReadEmails: boolean;

  constructor(view: ComposeView) {
    super(view);
    this.canSearchContacts = this.view.scopes.readContacts;
    this.canReadEmails = this.view.scopes.read || this.view.scopes.modify;
  }

  public setHandlers = (): void => {
    let preventSearchContacts = false;
    const inputs = this.view.S.cached('recipients_inputs');
    inputs.on('keyup', this.view.setHandlerPrevent('veryslowspree', async (target) => {
      if (!preventSearchContacts) {
        await this.searchContacts($(target));
      }
    }));
    inputs.on('keydown', this.view.setHandler(async (target, e) => {
      preventSearchContacts = this.recipientInputKeydownHandler(e);
    }));
    inputs.on('blur', this.view.setHandler((target, e) => this.inputsBlurHandler(target, e)));
    inputs.on('dragenter', this.view.setHandler((target, e) => this.inputsDragEnterHandler(target)));
    inputs.on('dragleave', this.view.setHandler((target) => this.inputsDragLeaveHandler(target)));
    inputs.on('dragover', (e) => e.preventDefault());
    inputs.on('drop', this.view.setHandler((target) => this.inputsDropHandler(target)));
    this.view.S.now('cc').click(this.view.setHandler((target) => {
      const newContainer = this.view.S.cached('input_addresses_container_outer').find(`#input-container-cc`);
      this.copyCcBccActionsClickHandler(target, newContainer);
    }));
    this.view.S.now('bcc').click(this.view.setHandler((target) => {
      const newContainer = this.view.S.cached('input_addresses_container_outer').find(`#input-container-bcc`);
      this.copyCcBccActionsClickHandler(target, newContainer);
    }));
    this.view.S.cached('recipients_placeholder').click(this.view.setHandler((target) => {
      this.view.S.cached('input_to').focus();
    }));
    this.view.S.cached('input_to').focus(this.view.setHandler(() => this.focusRecipients()));
    this.view.S.cached('cc').focus(this.view.setHandler(() => this.focusRecipients()));
    this.view.S.cached('bcc').focus(this.view.setHandler(() => this.focusRecipients()));
    this.view.S.cached('compose_table').click(this.view.setHandler(() => this.hideContacts(), this.view.errModule.handle(`hide contact box`)));
    this.view.S.cached('add_their_pubkey').click(this.view.setHandler(() => this.addTheirPubkeyClickHandler(), this.view.errModule.handle('add pubkey')));
    BrowserMsg.addListener('addToContacts', this.checkReciepientsKeys);
    BrowserMsg.addListener('reRenderRecipient', async ({ contact }: Bm.ReRenderRecipient) => await this.reRenderRecipientFor(contact));
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
    this.view.errModule.debug(`parseRenderRecipients(force: ${force})`);
    for (const inputElem of inputs) {
      const input = $(inputElem);
      const sendingType = input.data('sending-type') as RecipientType;
      this.view.errModule.debug(`parseRenderRecipients(force: ${force}) - sending type - ${sendingType}`);
      uncheckedEmails = uncheckedEmails || String(input.val()).split(/,/g);
      this.view.errModule.debug(`parseRenderRecipients(force: ${force}) - emails to check(${uncheckedEmails.join(',')})`);
      const validationResult = this.validateEmails(uncheckedEmails);
      let recipientsToEvaluate: RecipientElement[] = [];
      const container = input.parent();
      if (validationResult.valid.length) {
        this.view.errModule.debug(`parseRenderRecipients(force: ${force}) - valid emails(${validationResult.valid.join(',')})`);
        recipientsToEvaluate = this.createRecipientsElements(container, validationResult.valid, sendingType, RecipientStatuses.EVALUATING);
      }
      const invalidEmails = validationResult.invalid.filter(em => !!em); // remove empty strings
      this.view.errModule.debug(`parseRenderRecipients(force: ${force}) - invalid emails(${validationResult.invalid.join(',')})`);
      if (force && invalidEmails.length) {
        this.view.errModule.debug(`parseRenderRecipients(force: ${force}) - force add invalid recipients`);
        recipientsToEvaluate = [...recipientsToEvaluate, ...this.createRecipientsElements(container, invalidEmails, sendingType, RecipientStatuses.WRONG)];
        input.val('');
      } else {
        this.view.errModule.debug(`parseRenderRecipients(force: ${force}) - setting inputTo with invalid emails`);
        input.val(validationResult.invalid.join(','));
      }
      this.view.errModule.debug(`parseRenderRecipients(force: ${force}).2`);
      this.view.sizeModule.resizeInput(input);
      if (recipientsToEvaluate.length) {
        await this.evaluateRecipients(recipientsToEvaluate);
        this.view.errModule.debug(`parseRenderRecipients(force: ${force}).3`);
        this.view.sizeModule.resizeInput(input);
        this.view.errModule.debug(`parseRenderRecipients(force: ${force}).4`);
      }
    }
  }

  public addRecipients = async (recipients: Recipients, triggerCallback: boolean = true) => {
    let newRecipients: RecipientElement[] = [];
    for (const key in recipients) {
      if (recipients.hasOwnProperty(key) && ['to', 'cc', 'bcc'].includes(key)) {
        const sendingType = key as RecipientType;
        if (recipients[sendingType] && recipients[sendingType]!.length) {
          const recipientsContainer = this.view.S.cached('input_addresses_container_outer').find(`#input-container-${sendingType}`);
          newRecipients = newRecipients.concat(this.createRecipientsElements(recipientsContainer, recipients[sendingType]!, sendingType, RecipientStatuses.EVALUATING));
          this.view.S.cached('input_addresses_container_outer').find(`#input-container-${sendingType}`).css('display', '');
          this.view.sizeModule.resizeInput(this.view.S.cached('input_addresses_container_outer').find(`#input-container-${sendingType} input`));
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
    this.view.S.cached('contacts').css('display', 'none');
    this.view.S.cached('contacts').children().not('ul').remove();
  }

  public addRecipientsAndShowPreview = async (recipients: Recipients) => {
    this.view.recipientsModule.addRecipients(recipients).catch(Catch.reportErr);
    this.view.recipientsModule.showHideCcAndBccInputsIfNeeded();
    await this.view.recipientsModule.setEmailsPreview(this.getRecipients());
  }

  public reEvaluateRecipients = async (recipients: RecipientElement[]) => {
    for (const recipient of recipients) {
      $(recipient.element).empty().removeClass();
      Xss.sanitizeAppend(recipient.element, `${Xss.escape(recipient.email)} ${Ui.spinner('green')}`);
    }
    await this.evaluateRecipients(recipients);
  }

  public evaluateRecipients = async (recipients: RecipientElement[], triggerCallback: boolean = true) => {
    this.view.errModule.debug(`evaluateRecipients`);
    $('body').attr('data-test-state', 'working');
    for (const recipient of recipients) {
      this.view.errModule.debug(`evaluateRecipients.email(${String(recipient.email)})`);
      this.view.S.now('send_btn_text').text(this.BTN_LOADING);
      this.view.sizeModule.setInputTextHeightManuallyIfNeeded();
      recipient.evaluating = (async () => {
        let pubkeyLookupRes: Contact | 'fail' | 'wrong';
        if (recipient.status !== RecipientStatuses.WRONG) {
          pubkeyLookupRes = await this.view.storageModule.lookupPubkeyFromDbOrKeyserverAndUpdateDbIfneeded(recipient.email, undefined);
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
    this.view.sizeModule.setInputTextHeightManuallyIfNeeded();
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
      this.view.S.cached('recipients_placeholder').find('.placeholder').css('display', 'none');
    } else {
      this.view.S.cached('recipients_placeholder').find('.placeholder').css('display', 'block');
      this.view.S.cached('recipients_placeholder').find('.email_preview').empty();
      return;
    }
    const container = this.view.S.cached('recipients_placeholder').find('.email_preview');
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
    this.view.S.cached('input_addresses_container_outer').find(`#input-container-cc`).css('display', isThere.cc ? '' : 'none');
    this.view.S.cached('cc').css('display', isThere.cc ? 'none' : '');
    this.view.S.cached('input_addresses_container_outer').find(`#input-container-bcc`).css('display', isThere.bcc ? '' : 'none');
    this.view.S.cached('bcc').css('display', isThere.bcc ? 'none' : '');
    this.view.S.cached('input_addresses_container_outer').children(`:not([style="display: none;"])`).last().append(this.view.S.cached('container_cc_bcc_buttons')); // xss-reinsert
  }

  public collapseIpnutsIfNeeded = async (relatedTarget?: HTMLElement | null) => { // TODO: fix issue when loading no-pgp email and user starts typing
    if (!relatedTarget || (!this.view.S.cached('input_addresses_container_outer')[0].contains(relatedTarget)
      && !this.view.S.cached('contacts')[0].contains(relatedTarget))) {
      await Promise.all(this.addedRecipients.map(r => r.evaluating)); // Wait untill all recipients loaded.
      if (this.view.S.cached('recipients_inputs').is(':focus')) { // We don't need to colapse it if some input is on focus again.
        return;
      }
      this.showHideCcAndBccInputsIfNeeded();
      this.view.S.cached('input_addresses_container_outer').addClass('invisible');
      this.view.S.cached('recipients_placeholder').css('display', 'flex');
      await this.setEmailsPreview(this.addedRecipients);
      this.hideContacts();
      this.view.sizeModule.setInputTextHeightManuallyIfNeeded();
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
    const storage = await AcctStore.get(this.view.acctEmail, ['pubkey_sent_to']);
    if (storage.pubkey_sent_to && storage.pubkey_sent_to.includes(theirEmail)) {
      return true;
    }
    if (!this.canReadEmails) {
      return undefined;
    }
    const qSentPubkey = `is:sent to:${theirEmail} "BEGIN PGP PUBLIC KEY" "END PGP PUBLIC KEY"`;
    const qReceivedMsg = `from:${theirEmail} "BEGIN PGP MESSAGE" "END PGP MESSAGE"`;
    try {
      const response = await this.view.emailProvider.msgList(`(${qSentPubkey}) OR (${qReceivedMsg})`, true);
      if (response.messages) {
        await AcctStore.set(this.view.acctEmail, { pubkey_sent_to: (storage.pubkey_sent_to || []).concat(theirEmail) });
        return true;
      } else {
        return false;
      }
    } catch (e) {
      if (ApiErr.isAuthErr(e)) {
        BrowserMsg.send.notificationShowAuthPopupNeeded(this.view.parentTabId, { acctEmail: this.view.acctEmail });
      } else if (!ApiErr.isNetErr(e)) {
        Catch.reportErr(e);
      }
      return undefined;
    }
  }

  public reRenderRecipientFor = async (contact: Contact): Promise<void> => {
    for (const recipient of this.addedRecipients.filter(r => r.email === contact.email)) {
      this.view.errModule.debug(`re-rendering recipient: ${contact.email}`);
      await this.renderPubkeyResult(recipient, contact);
      this.view.recipientsModule.showHideCcAndBccInputsIfNeeded();
      await this.view.recipientsModule.setEmailsPreview(this.getRecipients());
    }
  }

  private inputsBlurHandler = async (target: HTMLElement, e: JQuery.Event<HTMLElement, null>) => {
    if (this.dragged) { // blur while drag&drop
      return;
    }
    this.view.errModule.debug(`input_to.blur -> parseRenderRecipients start causedBy(${e.relatedTarget ? e.relatedTarget.outerHTML : undefined})`);
    await this.parseRenderRecipients($(target));
    // If thereis no related target or related target isn't in recipients functionality
    // then we need to collapse inputs
    await this.collapseIpnutsIfNeeded(e.relatedTarget);
    this.view.errModule.debug(`input_to.blur -> parseRenderRecipients done`);
  }

  private inputsDragEnterHandler = (target: HTMLElement) => {
    if (Catch.browser().name === 'firefox') {
      this.insertCursorBefore(target.previousElementSibling!, true);
    } else {
      target.focus();
    }
  }

  private inputsDragLeaveHandler = (target: HTMLElement) => {
    if (Catch.browser().name === 'firefox') {
      this.removeCursor(target.previousElementSibling! as HTMLElement);
    } else {
      target.blur();
    }
  }

  private inputsDropHandler = (target: HTMLElement) => {
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
      this.view.sizeModule.resizeInput(jqueryTarget.add(previousInput));
      target.focus();
    }
  }

  private copyCcBccActionsClickHandler = (target: HTMLElement, newContainer: JQuery<HTMLElement>) => {
    const buttonsContainer = target.parentElement!;
    const curentContainer = buttonsContainer.parentElement!;
    const input = newContainer.find('input');
    curentContainer.removeChild(buttonsContainer);
    newContainer.append(buttonsContainer); // xss-safe-value
    newContainer.css('display', 'block');
    target.style.display = 'none';
    input.focus();
    this.view.sizeModule.resizeComposeBox();
    this.view.sizeModule.setInputTextHeightManuallyIfNeeded();
  }

  private addTheirPubkeyClickHandler = () => {
    const noPgpRecipients = this.addedRecipients.filter(r => r.element.className.includes('no_pgp'));
    this.view.renderModule.renderAddPubkeyDialog(noPgpRecipients.map(r => r.email));
    clearInterval(this.addedPubkeyDbLookupInterval); // todo - get rid of Catch.set_interval. just supply tabId and wait for direct callback
    this.addedPubkeyDbLookupInterval = Catch.setHandledInterval(async () => {
      const recipientsHasPgp: RecipientElement[] = [];
      for (const recipient of noPgpRecipients) {
        const [contact] = await ContactStore.get(undefined, [recipient.email]);
        if (contact && contact.has_pgp) {
          $(recipient.element).removeClass('no_pgp').find('i').remove();
          clearInterval(this.addedPubkeyDbLookupInterval);
          recipientsHasPgp.push(recipient);
        }
      }
      await this.evaluateRecipients(recipientsHasPgp);
      await this.setEmailsPreview(this.getRecipients());
    }, 1000);
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
    const currentActive = this.view.S.cached('contacts').find('ul li.select_contact.active');
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
    } else if (this.view.S.cached('contacts').is(':hidden')) { // Next will affect contacts popover
      return false;
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      this.hideContacts();
      this.view.S.cached('input_to').focus();
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
        prev = this.view.S.cached('contacts').find('ul li.select_contact').last();
      }
      currentActive.removeClass('active');
      prev.addClass('active');
      return true;
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      let next = currentActive.next('.select_contact');
      if (!next.length) {
        next = this.view.S.cached('contacts').find('ul li.select_contact').first();
      }
      currentActive.removeClass('active');
      next.addClass('active');
      return true;
    }
    return false;
  }

  /**
   * todo - contactSearch should be refactored, plus split into a separate module
   * That way things regarding searching contacts would be separate from more general recipients behavior
   */
  private searchContacts = async (input: JQuery<HTMLElement>): Promise<void> => {
    try {
      this.contactSearchInProgress = true;
      this.view.errModule.debug(`searchContacts`);
      const substring = Str.parseEmail(String(input.val()), 'DO-NOT-VALIDATE').email;
      this.view.errModule.debug(`searchContacts.query.substring(${JSON.stringify(substring)})`);
      if (!substring) {
        this.view.errModule.debug(`searchContacts 1`);
        this.hideContacts(); // todo - show suggestions of most contacted ppl etc
        return;
      }
      const contacts: Contact[] = await ContactStore.search(undefined, { substring });
      this.view.errModule.debug(`searchContacts substring: ${substring}`);
      this.view.errModule.debug(`searchContacts db count: ${contacts.length}`);
      this.renderSearchRes(input, contacts, { substring });
      if (contacts.length >= this.MAX_CONTACTS_LENGTH || !(this.canReadEmails || this.canSearchContacts)) {
        this.view.errModule.debug(`searchContacts 2, count: ${contacts.length}`);
        return;
      }
      this.view.errModule.debug(`searchContacts 3`);
      const foundOnGoogle = await this.searchContactsOnGoogle(substring, contacts);
      await this.addApiLoadedContactsToDb(foundOnGoogle);
      contacts.push(...foundOnGoogle);
      this.renderSearchRes(input, contacts, { substring });
      if (contacts.length >= this.MAX_CONTACTS_LENGTH) {
        this.view.errModule.debug(`searchContacts 3.b, count: ${contacts.length}`);
        return;
      }
      this.view.errModule.debug(`searchContacts 4`);
      if (this.canReadEmails && !foundOnGoogle.length) {
        this.view.errModule.debug(`searchContacts (Gmail Sent Messages) 6.b`);
        await this.guessContactsFromSentEmails(substring, contacts, async guessed => {
          await this.addApiLoadedContactsToDb(guessed.new);
          contacts.push(...guessed.new);
          this.renderSearchRes(input, contacts, { substring });
        });
      }
    } catch (e) {
      Ui.toast(`Error searching contacts: ${ApiErr.eli5(e)}`, 5).catch(Catch.reportErr);
      throw e;
    } finally {
      this.view.errModule.debug('searchContacts 7 - finishing');
      this.contactSearchInProgress = false;
      this.renderSearchResultsLoadingDone();
    }
  }

  private guessContactsFromSentEmails = async (query: string, knownContacts: Contact[], multiCb: ChunkedCb) => {
    this.view.errModule.debug('guessContactsFromSentEmails start');
    await this.view.emailProvider.guessContactsFromSentEmails(query, knownContacts, multiCb).catch(e => {
      if (ApiErr.isAuthErr(e)) {
        BrowserMsg.send.notificationShowAuthPopupNeeded(this.view.parentTabId, { acctEmail: this.view.acctEmail });
      } else if (ApiErr.isNetErr(e)) {
        Ui.toast(`Network error - cannot search contacts`).catch(Catch.reportErr);
      } else if (ApiErr.isMailOrAcctDisabledOrPolicy(e)) {
        Ui.toast(`Cannot search contacts - account disabled or forbidden by admin policy`).catch(Catch.reportErr);
      } else {
        Catch.reportErr(e);
        Ui.toast(`Error searching contacts: ${ApiErr.eli5(e)}`).catch(Catch.reportErr);
      }
    });
    this.view.errModule.debug('guessContactsFromSentEmails end');
  }

  private searchContactsOnGoogle = async (query: string, knownContacts: Contact[]): Promise<Contact[]> => {
    if (this.canSearchContacts) {
      this.view.errModule.debug(`searchContacts (Google API) 5`);
      const contactsGoogle = await Google.contactsGet(this.view.acctEmail, query, undefined, this.MAX_CONTACTS_LENGTH);
      if (contactsGoogle && contactsGoogle.length) {
        const newContacts = contactsGoogle.filter(cGmail => !knownContacts.find(c => c.email === cGmail.email));
        return await Promise.all(newContacts.map(({ email, name }) => ContactStore.obj({ email, name })));
      }
    }
    return [];
  }

  private renderSearchRes = (input: JQuery<HTMLElement>, contacts: Contact[], query: ProviderContactsQuery) => {
    this.view.errModule.debug(`renderSearchRes len: ${contacts.length}`);
    const renderableContacts = contacts.slice(0, this.MAX_CONTACTS_LENGTH);
    // have pgp on top, no pgp bottom. Sort each groups by last used
    renderableContacts.sort((a, b) => (10 * (b.has_pgp - a.has_pgp)) + ((b.last_use || 0) - (a.last_use || 0) > 0 ? 1 : -1)).slice(8);
    if ((renderableContacts.length > 0 || this.contactSearchInProgress) || !this.canSearchContacts) {
      let ulHtml = '';
      for (const contact of renderableContacts) {
        ulHtml += `<li class="select_contact" email="${Xss.escape(contact.email.replace(/<\/?b>/g, ''))}">`;
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
        displayEmail = '<div class="select_contact_email" data-test="action-select-contact-email">' + Xss.escape(displayEmail) + '</div>';
        if (contact.name) {
          ulHtml += '<div class="select_contact_name" data-test="action-select-contact-name">' + Xss.escape(contact.name) + displayEmail + '</div>';
        } else {
          ulHtml += displayEmail;
        }
        ulHtml += '</li>';
      }
      if (this.contactSearchInProgress) {
        ulHtml += '<li class="loading" data-test="container-contacts-loading">loading...</li>';
      }
      Xss.sanitizeRender(this.view.S.cached('contacts').find('ul'), ulHtml);
      if (!this.canSearchContacts) {
        if (!contacts.length) {
          this.view.S.cached('contacts').find('ul').append('<li>No Contacts Found</li>'); // xss-direct
        }
        this.addBtnToAllowSearchContactsFromGoogle(input);
      }
      const contactItems = this.view.S.cached('contacts').find('ul li.select_contact');
      contactItems.first().addClass('active');
      contactItems.click(this.view.setHandlerPrevent('double', async (target: HTMLElement) => {
        const email = Str.parseEmail($(target).attr('email') || '').email;
        if (email) {
          await this.selectContact(input, email, query);
        }
      }, this.view.errModule.handle(`select contact`)));
      contactItems.hover(function () {
        contactItems.removeClass('active');
        $(this).addClass('active');
      });
      this.view.S.cached('contacts').find('ul li.auth_contacts').click(this.view.setHandler(() =>
        this.authContacts(this.view.acctEmail), this.view.errModule.handle(`authorize contact search`)));
      const offset = input.offset()!;
      const inputToPadding = parseInt(input.css('padding-left'));
      let leftOffset: number;
      if (this.view.S.cached('body').width()! < offset.left + inputToPadding + this.view.S.cached('contacts').width()!) {
        // Here we need to align contacts popover by right side
        leftOffset = offset.left + inputToPadding + input.width()! - this.view.S.cached('contacts').width()!;
      } else {
        leftOffset = offset.left + inputToPadding;
      }
      this.view.S.cached('contacts').css({
        display: 'block',
        left: leftOffset,
        top: `${$('#compose > tbody > tr:first').height()! + offset.top}px`, // both are in the template
      });
    }
  }

  private addBtnToAllowSearchContactsFromGoogle = (input: JQuery<HTMLElement>) => {
    if (this.view.S.cached('contacts').find('.allow-google-contact-search').length) {
      return;
    }
    this.view.S.cached('contacts')
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
    this.view.errModule.debug(`selectContact 1`);
    const possiblyBogusRecipient = input.siblings('.recipients span.wrong').last();
    const possiblyBogusAddr = Str.parseEmail(possiblyBogusRecipient.text()).email;
    this.view.errModule.debug(`selectContact 2`);
    const q = Str.parseEmail(fromQuery.substring).email;
    if (possiblyBogusAddr && q && (possiblyBogusAddr === q || possiblyBogusAddr.includes(q))) {
      possiblyBogusRecipient.remove();
    }
    if (!this.addedRecipients.find(r => r.email === email)) {
      this.view.errModule.debug(`selectContact -> parseRenderRecipients start`);
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

  private addApiLoadedContactsToDb = async (newContacts: Contact[]) => {
    this.view.errModule.debug('addApiLoadedContactsToDb 1');
    if (!newContacts.length) {
      return;
    }
    const toLookup: Contact[] = [];
    for (const contact of newContacts) {
      const [storedContact] = await ContactStore.get(undefined, [contact.email]);
      if (storedContact) {
        const toUpdate: ContactUpdate = {};
        if (!storedContact.name && contact.name) {
          toUpdate.name = contact.name;
        }
        if (storedContact.searchable.length !== contact.searchable.length && storedContact.searchable.join(',') !== contact.searchable.join(',')) {
          toUpdate.searchable = contact.searchable;
        }
        if (Object.keys(toUpdate).length) {
          await ContactStore.update(undefined, contact.email, toUpdate);
        }
      } else if (!this.failedLookupEmails.includes(contact.email)) {
        toLookup.push(contact);
      }
    }
    await Promise.all(toLookup.map(c => this.view.storageModule.ksLookupUnknownContactPubAndSaveToDb(c.email, c.name || undefined).then(lookupRes => {
      if (lookupRes === 'fail') {
        this.failedLookupEmails.push(c.email);
      }
    })));
  }

  private renderSearchResultsLoadingDone = () => {
    this.view.S.cached('contacts').find('ul li.loading').remove();
    if (!this.view.S.cached('contacts').find('ul li').length) {
      this.hideContacts();
    }
  }

  private authContacts = async (acctEmail: string) => {
    const connectToGoogleRecipientLine = this.addedRecipients[this.addedRecipients.length - 1];
    this.view.S.cached('input_to').val(connectToGoogleRecipientLine.email);
    this.removeRecipient(connectToGoogleRecipientLine.element);
    const authRes = await GoogleAuth.newAuthPopup({ acctEmail, scopes: GoogleAuth.defaultScopes('contacts') });
    if (authRes.result === 'Success') {
      this.canSearchContacts = true;
      this.canReadEmails = true;
      this.view.scopes.readContacts = true;
      this.view.scopes.read = true;
      await this.searchContacts(this.view.S.cached('input_to'));
    } else if (authRes.result === 'Denied' || authRes.result === 'Closed') {
      await Ui.modal.error('FlowCrypt needs this permission to search your contacts on Gmail. Without it, FlowCrypt will keep a separate contact list.');
    } else {
      await Ui.modal.error(Lang.general.somethingWentWrongTryAgain);
    }
  }

  private checkReciepientsKeys = async () => {
    for (const recipientEl of this.addedRecipients.filter(r => r.element.className.includes('no_pgp'))) {
      const email = $(recipientEl).text().trim();
      const [dbContact] = await ContactStore.get(undefined, [email]);
      if (dbContact) {
        recipientEl.element.classList.remove('no_pgp');
        await this.renderPubkeyResult(recipientEl, dbContact);
      }
    }
  }

  private renderPubkeyResult = async (recipient: RecipientElement, contact: Contact | 'fail' | 'wrong') => {
    const el = recipient.element;
    this.view.errModule.debug(`renderPubkeyResult.emailEl(${String(recipient.email)})`);
    this.view.errModule.debug(`renderPubkeyResult.email(${recipient.email})`);
    this.view.errModule.debug(`renderPubkeyResult.contact(${JSON.stringify(contact)})`);
    $(el).children('img, i').remove();
    const contentHtml = '<img src="/img/svgs/close-icon.svg" alt="close" class="close-icon svg" />' +
      '<img src="/img/svgs/close-icon-black.svg" alt="close" class="close-icon svg display_when_sign" />';
    Xss.sanitizeAppend(el, contentHtml)
      .find('img.close-icon')
      .click(this.view.setHandler(target => this.removeRecipient(target.parentElement!), this.view.errModule.handle('remove recipient')));
    $(el).removeClass(['failed', 'wrong', 'has_pgp', 'no_pgp', 'expired']);
    if (contact === PUBKEY_LOOKUP_RESULT_FAIL) {
      recipient.status = RecipientStatuses.FAILED;
      $(el).attr('title', 'Failed to load, click to retry');
      $(el).addClass("failed");
      Xss.sanitizeReplace($(el).children('img:visible'), '<img src="/img/svgs/repeat-icon.svg" class="repeat-icon action_retry_pubkey_fetch">' +
        '<img src="/img/svgs/close-icon-black.svg" class="close-icon-black svg remove-reciepient">');
      $(el).find('.action_retry_pubkey_fetch').click(this.view.setHandler(async () => await this.refreshRecipients(), this.view.errModule.handle('refresh recipient')));
      $(el).find('.remove-reciepient').click(this.view.setHandler(element => this.removeRecipient(element.parentElement!), this.view.errModule.handle('remove recipient')));
    } else if (contact === PUBKEY_LOOKUP_RESULT_WRONG) {
      recipient.status = RecipientStatuses.WRONG;
      this.view.errModule.debug(`renderPubkeyResult: Setting email to wrong / misspelled in harsh mode: ${recipient.email}`);
      $(el).attr('title', 'This email address looks misspelled. Please try again.');
      $(el).addClass("wrong");
    } else if (contact.pubkey && ((contact.expiresOn || Infinity) <= Date.now() || contact.pubkey.usableButExpired)) {
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
    this.view.pwdOrPubkeyContainerModule.showHideContainerAndColorSendBtn();
    this.view.myPubkeyModule.reevaluateShouldAttachOrNot();
  }

  private removeRecipient = (element: HTMLElement) => {
    this.recipientsMissingMyKey = Value.arr.withoutVal(this.recipientsMissingMyKey, $(element).parent().text());
    const index = this.addedRecipients.findIndex(r => r.element.isEqualNode(element));
    this.addedRecipients[index].element.remove();
    const container = element.parentElement?.parentElement; // Get Container, e.g. '.input-container-cc'
    if (container) {
      this.view.sizeModule.resizeInput($(container).find('input'));
    }
    this.view.S.cached('input_addresses_container_outer').find(`#input-container-${this.addedRecipients[index].sendingType} input`).focus();
    this.addedRecipients.splice(index, 1);
    this.view.pwdOrPubkeyContainerModule.showHideContainerAndColorSendBtn();
    this.view.myPubkeyModule.reevaluateShouldAttachOrNot();
  }

  private refreshRecipients = async () => {
    const failedRecipients = this.addedRecipients.filter(r => r.element.className.includes('failed'));
    await this.reEvaluateRecipients(failedRecipients);
  }

  private recipientKeyIdText = (contact: Contact) => {
    if (contact.fingerprint) {
      return `\n\nRecipient public key fingerprint:\n${Str.spaced(contact.fingerprint)}`;
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
      const newInput = this.view.S.cached('input_addresses_container_outer').find(`#input-container-${sendingType} input`);
      this.view.sizeModule.resizeInput(newInput.add(previousInput));
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
    this.view.S.cached('recipients_placeholder').hide();
    this.view.S.cached('input_addresses_container_outer').removeClass('invisible');
    this.view.sizeModule.resizeComposeBox();
    if (this.view.isReplyBox) {
      this.view.sizeModule.resizeInput();
    }
    this.view.sizeModule.setInputTextHeightManuallyIfNeeded();
  }

}
