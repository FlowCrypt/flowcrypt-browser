/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Api, ChunkedCb, EmailProviderContact, RecipientType } from '../../../js/common/api/shared/api.js';
import { ContactInfoWithSortedPubkeys, KeyUtil, PubkeyInfo } from '../../../js/common/core/crypto/key.js';
import { PUBKEY_LOOKUP_RESULT_FAIL } from './compose-err-module.js';
import { ProviderContactsQuery, Recipients } from '../../../js/common/api/email-provider/email-provider-api.js';
import { RecipientElement, RecipientStatus, ValidRecipientElement } from './compose-types.js';
import { EmailParts, Str } from '../../../js/common/core/common.js';
import { ApiErr } from '../../../js/common/api/shared/api-error.js';
import { Bm, BrowserMsg } from '../../../js/common/browser/browser-msg.js';
import { Catch } from '../../../js/common/platform/catch.js';
import { Google } from '../../../js/common/api/email-provider/gmail/google.js';
import { GoogleOAuth } from '../../../js/common/api/authentication/google/google-oauth.js';
import { Lang } from '../../../js/common/lang.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { Xss } from '../../../js/common/platform/xss.js';
import { moveElementInArray } from '../../../js/common/platform/util.js';
import { ViewModule } from '../../../js/common/view-module.js';
import { ComposeView } from '../compose.js';
import { AcctStore } from '../../../js/common/platform/store/acct-store.js';
import { ContactPreview, ContactStore } from '../../../js/common/platform/store/contact-store.js';
import { FLOWCRYPT_REPLY_EMAIL_ADDRESSES } from '../../../js/common/api/email-provider/gmail/gmail-parser.js';

/**
 * todo - this class is getting too big
 * split into ComposeRecipientsModule and ComposeContactSearchModule
 */
export class ComposeRecipientsModule extends ViewModule<ComposeView> {
  private readonly failedLookupEmails: string[] = [];

  private addedRecipients: RecipientElement[] = [];
  private BTN_LOADING = 'Loading..';

  private readonly MAX_CONTACTS_LENGTH = 8;

  private addedPubkeyDbLookupInterval?: number;

  private onRecipientAddedCallbacks: ((rec: RecipientElement[]) => void)[] = [];

  private dragged: Element | undefined = undefined;

  private googleContactsSearchEnabled: boolean | Promise<boolean | undefined>;

  private uniqueRecipientIndex = 0;
  private inputContainerPaddingBottom = '30px';

  public constructor(view: ComposeView) {
    super(view);
    this.googleContactsSearchEnabled = this.queryIfGoogleSearchEnabled();
  }

  public setHandlers = (): void => {
    let preventSearchContacts = false;
    const inputs = this.view.S.cached('recipients_inputs');
    inputs.on(
      'input',
      this.view.setHandlerPrevent('veryslowspree', async target => {
        if (!preventSearchContacts) {
          await this.searchContacts($(target));
        }
      })
    );
    inputs.on(
      'keydown',
      this.view.setHandler(async (target, e) => {
        preventSearchContacts = this.recipientInputKeydownHandler(e);
      })
    );
    inputs.on(
      'blur',
      this.view.setHandler((target, e) => this.inputsBlurHandler(target, e))
    );
    inputs.on(
      'dragenter',
      this.view.setHandler(target => this.inputsDragEnterHandler(target))
    );
    inputs.on(
      'dragleave',
      this.view.setHandler(target => this.inputsDragLeaveHandler(target))
    );
    inputs.on('dragover', e => e.preventDefault());
    inputs.on(
      'drop',
      this.view.setHandler(target => this.inputsDropHandler(target))
    );
    this.view.S.cached('recipients_toggle_elements').on(
      'focus',
      this.view.setHandler(() => this.collapseInputsIfNeeded())
    );
    this.view.S.now('cc').on(
      'click',
      this.view.setHandler(target => {
        $('#input-container-to').css('padding-bottom', 0);
        const newContainer = this.view.S.cached('input_addresses_container_outer').find(`#input-container-cc`);
        this.copyCcBccActionsClickHandler(target, newContainer);
      })
    );
    this.view.S.now('bcc').on(
      'click',
      this.view.setHandler(target => {
        $('#input-container-cc').css('padding-bottom', 0);
        const newContainer = this.view.S.cached('input_addresses_container_outer').find(`#input-container-bcc`);
        this.copyCcBccActionsClickHandler(target, newContainer);
      })
    );
    this.view.S.cached('recipients_placeholder').on(
      'click',
      this.view.setHandler(() => {
        this.view.S.cached('input_to').trigger('focus');
        this.setCorrectPaddingForInputContainer();
      })
    );
    this.view.S.cached('input_to').on(
      'focus',
      this.view.setHandler(() => this.focusRecipients())
    );
    this.view.S.cached('cc').on(
      'focus',
      this.view.setHandler(() => this.focusRecipients())
    );
    this.view.S.cached('bcc').on(
      'focus',
      this.view.setHandler(() => this.focusRecipients())
    );
    this.view.S.cached('compose_table').on(
      'click',
      this.view.setHandler(() => this.hideContacts(), this.view.errModule.handle(`hide contact box`))
    );
    this.view.S.cached('add_their_pubkey').on(
      'click',
      this.view.setHandler(() => this.addTheirPubkeyClickHandler(), this.view.errModule.handle('add pubkey'))
    );
    BrowserMsg.addListener('addToContacts', this.checkReciepientsKeys);
    BrowserMsg.addListener('reRenderRecipient', async ({ email }: Bm.ReRenderRecipient) => {
      await this.reRenderRecipientFor(email);
    });
    BrowserMsg.listen(this.view.parentTabId);
  };

  public getRecipients = () => {
    return this.addedRecipients;
  };

  public getValidRecipients = (): ValidRecipientElement[] => {
    const validRecipients: ValidRecipientElement[] = [];
    for (const recipient of this.addedRecipients) {
      if (recipient.email) {
        const email = recipient.email;
        validRecipients.push({ ...recipient, email });
      }
    }
    return validRecipients;
  };

  public validateEmails = (uncheckedEmails: string[]): { valid: EmailParts[]; invalid: string[] } => {
    const valid: EmailParts[] = [];
    const invalid: string[] = [];
    for (const email of uncheckedEmails) {
      const parsed = Str.parseEmail(email);
      if (parsed.email) {
        valid.push({ email: parsed.email, name: parsed.name });
      } else {
        invalid.push(email);
      }
    }
    return { valid, invalid };
  };

  public parseRenderRecipients = async (inputs: JQuery, force?: boolean, uncheckedEmails?: string[]): Promise<void> => {
    this.view.errModule.debug(`parseRenderRecipients(force: ${force})`);
    for (const inputElem of inputs) {
      const input = $(inputElem);
      const sendingType = input.data('sending-type') as RecipientType;
      this.view.errModule.debug(`parseRenderRecipients(force: ${force}) - sending type - ${sendingType}`);
      uncheckedEmails = uncheckedEmails || String(input.val()).split(/,/g);
      this.view.errModule.debug(`parseRenderRecipients(force: ${force}) - emails to check(${uncheckedEmails.join(',')})`);
      const validationResult = this.validateEmails(uncheckedEmails);
      let recipientsToEvaluate: ValidRecipientElement[] = [];
      const container = input.parent();
      if (validationResult.valid.length) {
        this.view.errModule.debug(`parseRenderRecipients(force: ${force}) - valid emails(${Str.formatEmailList(validationResult.valid)}`);
        recipientsToEvaluate = this.createRecipientsElements(
          container,
          validationResult.valid,
          sendingType,
          RecipientStatus.EVALUATING
        ) as ValidRecipientElement[];
      }
      const invalidEmails = validationResult.invalid.filter(em => !!em); // remove empty strings
      this.view.errModule.debug(`parseRenderRecipients(force: ${force}) - invalid emails(${validationResult.invalid.join(',')})`);
      if (force && invalidEmails.length) {
        this.view.errModule.debug(`parseRenderRecipients(force: ${force}) - force add invalid recipients`);
        this.createRecipientsElements(
          container,
          invalidEmails.map(invalid => {
            return { invalid };
          }),
          sendingType,
          RecipientStatus.WRONG
        );
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
      } else {
        this.view.sizeModule.setInputTextHeightManuallyIfNeeded();
        document.querySelector('body')?.setAttribute('data-test-state', 'ready');
      }
    }
  };

  public addRecipients = async (recipients: Recipients, triggerCallback = true) => {
    const newRecipients: ValidRecipientElement[] = [];
    for (const [sendingType, value] of Object.entries(recipients)) {
      if (Api.isRecipientHeaderNameType(sendingType)) {
        if (value?.length) {
          const recipientsContainer = this.view.S.cached('input_addresses_container_outer').find(`#input-container-${sendingType}`);
          for (const email of value) {
            const parsed = Str.parseEmail(email);
            if (parsed.email) {
              newRecipients.push(
                ...(this.createRecipientsElements(
                  recipientsContainer,
                  [{ email: parsed.email, name: parsed.name }],
                  sendingType,
                  RecipientStatus.EVALUATING
                ) as ValidRecipientElement[])
              );
            } else {
              this.createRecipientsElements(recipientsContainer, [{ invalid: email }], sendingType, RecipientStatus.WRONG);
            }
          }
          this.view.S.cached('input_addresses_container_outer').find(`#input-container-${sendingType}`).css('display', '');
          this.view.sizeModule.resizeInput(this.view.S.cached('input_addresses_container_outer').find(`#input-container-${sendingType} input`));
        }
      }
    }
    await this.evaluateRecipients(newRecipients, triggerCallback);
  };

  public clearRecipients = () => {
    const addedRecipientsCopy = [...this.addedRecipients];
    for (const recipient of addedRecipientsCopy) {
      this.removeRecipient(recipient.element);
    }
  };

  public clearRecipientsForReply = async () => {
    for (const recipient of this.addedRecipients.filter(r => r.sendingType !== 'to')) {
      this.removeRecipient(recipient.element);
    }
    // reply only to the sender if the message is not from the same account
    const from = this.view.replyParams?.from;
    const myEmail = this.view.replyParams?.myEmail;
    if (from !== myEmail && !FLOWCRYPT_REPLY_EMAIL_ADDRESSES.includes(from ?? '')) {
      for (const recipient of this.addedRecipients.filter(r => r.email !== from)) {
        this.removeRecipient(recipient.element);
      }
    }
  };

  public showContacts = () => {
    this.view.S.cached('contacts').css('display', 'block');
  };

  public hideContacts = () => {
    this.view.S.cached('contacts').css('display', 'none');
    this.view.S.cached('contacts').find('ul').empty();
    this.view.S.cached('contacts').children().not('ul').remove();
  };

  public addRecipientsAndShowPreview = (recipients: Recipients) => {
    this.view.recipientsModule.addRecipients(recipients).catch(Catch.reportErr);
    this.view.recipientsModule.showHideCcAndBccInputsIfNeeded();
    this.view.recipientsModule.setEmailsPreview();
  };

  public reEvaluateRecipients = async (recipients: ValidRecipientElement[]) => {
    for (const recipient of recipients) {
      $(recipient.element).empty().removeClass();
      Xss.sanitizeAppend(recipient.element, `${Xss.escape(recipient.email)} ${Ui.spinner('green')}`);
    }
    await this.evaluateRecipients(recipients);
  };

  public evaluateRecipients = async (recipientEls: ValidRecipientElement[], triggerCallback = true) => {
    this.view.errModule.debug(`evaluateRecipients`);
    document.querySelector('body')?.setAttribute('data-test-state', 'working');
    for (const recipientEl of recipientEls) {
      this.view.S.now('send_btn_text').text(this.BTN_LOADING);
      this.view.sizeModule.setInputTextHeightManuallyIfNeeded();
      recipientEl.evaluating = (async () => {
        this.view.errModule.debug(`evaluateRecipients.evaluat.recipient.email(${String(recipientEl.email)})`);
        this.view.errModule.debug(`evaluateRecipients.evaluating.recipient.status(${recipientEl.status})`);
        this.view.errModule.debug(`evaluateRecipients.evaluating: calling getUpToDatePubkeys`);
        const info = await this.view.storageModule.getUpToDatePubkeys(recipientEl.email);
        this.renderPubkeyResult(recipientEl, info);
        // Clear promise when after finished
        // todo - it would be better if we could avoid doing this, eg
        //    recipient.evaluating would be a bool
        Catch.setHandledTimeout(() => {
          recipientEl.evaluating = undefined;
        }, 0);
      })();
    }
    await Promise.all(recipientEls.map(r => r.evaluating));
    if (triggerCallback) {
      for (const callback of this.onRecipientAddedCallbacks) {
        callback(recipientEls);
      }
    }
    this.setEmailsPreview();
    document.querySelector('body')?.setAttribute('data-test-state', 'ready');
    this.view.sizeModule.setInputTextHeightManuallyIfNeeded();
  };

  /**
   * Generate content for emails preview in some container
   * when recipient inputs are collapsed.
   * e.g. 'test@test.com, test2@test.com [3 more]'
   */
  public setEmailsPreview = (): void => {
    const orderedRecipients = this.getRecipients().sort(this.orderRecipientsBySendingType);
    if (orderedRecipients.length) {
      this.view.S.cached('recipients_placeholder').find('.placeholder').css('display', 'none');
    } else {
      this.view.S.cached('recipients_placeholder').find('.placeholder').css('display', 'block');
      this.view.S.cached('recipients_placeholder').find('.email_preview').empty();
      return;
    }
    const container = this.view.S.cached('recipients_placeholder').find('.email_preview');
    if (orderedRecipients.find(r => r.status === RecipientStatus.EVALUATING)) {
      if (container.find('r_loader').length === 0) {
        container.append(`<span id="r_loader">Loading Recipients ${Ui.spinner('green')}</span>`); // xss-direct
      }
      return;
    }
    container.find('r_loader').remove();
    Xss.sanitizeRender(container, '<span class="rest"><span id="rest_number"></span> more</span>');
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const maxWidth = container.parent().width()! - this.view.S.cached('container_cc_bcc_buttons').width()!;
    if (maxWidth <= 0) {
      return;
    }
    const rest = container.find('.rest');
    let processed = 0;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    while (container.width()! <= maxWidth && orderedRecipients.length >= processed + 1) {
      const recipient = orderedRecipients[processed];
      const escapedTitle = Xss.escape(recipient.element.getAttribute('title') || '');
      const nameOrEmail = recipient.name || recipient.email || recipient.invalid || '';
      const emailHtml = `<span class="email_address ${recipient.element.className}" title="${escapedTitle}">${Xss.escape(nameOrEmail)}</span>`;
      $(emailHtml).insertBefore(rest); // xss-escaped
      processed++;
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    if (container.width()! > maxWidth) {
      container.find('.email_address').last().remove();
      const restRecipients = orderedRecipients.slice(processed - 1);
      rest.find('#rest_number').text(restRecipients.length);
      const orderedByStatus = restRecipients.sort((a: RecipientElement, b: RecipientElement) => {
        return a.status - b.status;
      });
      const last = orderedByStatus[orderedByStatus.length - 1]; // Last element has the worst status
      rest.addClass(last.element.className);
    } else {
      rest.remove();
    }
  };

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
    this.view.S.cached('input_addresses_container_outer')
      .find(`#input-container-cc`)
      .css('display', isThere.cc ? '' : 'none');
    this.view.S.cached('cc').css('display', isThere.cc ? 'none' : '');
    this.view.S.cached('input_addresses_container_outer')
      .find(`#input-container-bcc`)
      .css('display', isThere.bcc ? '' : 'none');
    this.view.S.cached('bcc').css('display', isThere.bcc ? 'none' : '');
    this.view.S.cached('input_addresses_container_outer').children(':visible').last().append(this.view.S.cached('container_cc_bcc_buttons')); // xss-reinsert
  };

  public collapseInputsIfNeeded = async () => {
    if (this.view.S.cached('input_addresses_container_outer').hasClass('invisible')) {
      return;
    }
    await Promise.all(this.addedRecipients.map(r => r.evaluating)); // Wait until all recipients loaded.
    this.showHideCcAndBccInputsIfNeeded();
    this.view.S.cached('input_addresses_container_outer').addClass('invisible');
    this.view.S.cached('recipients_placeholder').css('display', 'flex');
    $('.input-container').css('padding-bottom', '0');
    this.setEmailsPreview();
    this.hideContacts();
    this.view.sizeModule.setInputTextHeightManuallyIfNeeded();
  };

  public onRecipientAdded = (callback: (rec: RecipientElement[]) => void) => {
    this.onRecipientAddedCallbacks.push(callback);
  };

  // todo: shouldn't we check longid?
  public doesRecipientHaveMyPubkey = async (theirEmailUnchecked: string): Promise<boolean | undefined> => {
    const theirEmail = Str.parseEmail(theirEmailUnchecked).email;
    if (!theirEmail) {
      return false;
    }
    const storage = await AcctStore.get(this.view.acctEmail, ['pubkey_sent_to']);
    if (storage.pubkey_sent_to?.includes(theirEmail)) {
      return true;
    }
    const qSentPubkey = `is:sent to:${theirEmail} "BEGIN PGP PUBLIC KEY" "END PGP PUBLIC KEY"`;
    const qReceivedMsg = `from:${theirEmail} "BEGIN PGP MESSAGE" "END PGP MESSAGE"`;
    try {
      const response = await this.view.emailProvider.msgList(`(${qSentPubkey}) OR (${qReceivedMsg})`, true);
      if (response.messages && response.messages.length > 0) {
        await AcctStore.set(this.view.acctEmail, { pubkey_sent_to: (storage.pubkey_sent_to || []).concat(theirEmail) }); // eslint-disable-line @typescript-eslint/naming-convention
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
  };

  public reRenderRecipientFor = async (email: string): Promise<void> => {
    const validRecipients = this.getValidRecipients().filter(r => r.email === email);
    if (!validRecipients.length) {
      return;
    }
    const emailAndPubkeys = await ContactStore.getOneWithAllPubkeys(undefined, email);
    for (const recipient of validRecipients) {
      this.view.errModule.debug(`re-rendering recipient: ${email}`);
      this.renderPubkeyResult(recipient, emailAndPubkeys);
    }
    this.showHideCcAndBccInputsIfNeeded();
    this.setEmailsPreview();
  };

  private queryIfGoogleSearchEnabled = async () => {
    try {
      const scopes = await AcctStore.getScopes(this.view.acctEmail);
      return scopes.readContacts && scopes.readOtherContacts;
    } catch (e) {
      this.view.errModule.debug(`googleContactsSearchEnabled: Error occurred while fetching result: ${e}`);
      return undefined;
    }
  };

  private inputsBlurHandler = async (target: HTMLElement, e: JQuery.TriggeredEvent<HTMLElement>) => {
    if (this.dragged) {
      // blur while drag&drop
      return;
    }
    const relatedTarget = (e as JQuery.BlurEvent).relatedTarget;
    if (relatedTarget === this.view.S.cached('contacts').get(0)) {
      // user selected contact in #contacts list, do nothing here
      return;
    }
    this.view.errModule.debug(`input_to.blur -> parseRenderRecipients start causedBy(${(relatedTarget as HTMLElement)?.outerHTML})`);
    this.hideContacts();
    await this.parseRenderRecipients($(target));
    this.view.errModule.debug(`input_to.blur -> parseRenderRecipients done`);
  };

  private inputsDragEnterHandler = (target: HTMLElement) => {
    if (Catch.isFirefox()) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.insertCursorBefore(target.previousElementSibling!, true);
    } else {
      target.focus();
    }
  };

  private inputsDragLeaveHandler = (target: HTMLElement) => {
    if (Catch.isFirefox()) {
      this.removeCursor(target.previousElementSibling as HTMLElement);
    } else {
      target.blur();
    }
  };

  private inputsDropHandler = (target: HTMLElement) => {
    if (Catch.isFirefox()) {
      this.removeCursor(target.previousElementSibling as HTMLElement);
    }
    if (this.dragged) {
      /* eslint-disable @typescript-eslint/no-non-null-assertion */
      const previousInput = this.dragged.parentElement!.nextElementSibling!;
      this.dragged.parentElement!.removeChild(this.dragged);
      /* eslint-enable @typescript-eslint/no-non-null-assertion */
      const sendingType = target.getAttribute('data-sending-type') as RecipientType;
      const jqueryTarget = $(target);
      jqueryTarget.siblings('.recipients').append(this.dragged); // xss-safe-value
      const draggableElementIndex = this.addedRecipients.findIndex(r => r.element === this.dragged);
      this.addedRecipients[draggableElementIndex].sendingType = sendingType;
      this.addedRecipients = moveElementInArray(this.addedRecipients, draggableElementIndex, this.addedRecipients.length - 1);
      this.view.sizeModule.resizeInput(jqueryTarget.add(previousInput));
      target.focus();
    }
  };

  private copyCcBccActionsClickHandler = (target: HTMLElement, newContainer: JQuery) => {
    /* eslint-disable @typescript-eslint/no-non-null-assertion */
    const buttonsContainer = target.parentElement!;
    const curentContainer = buttonsContainer.parentElement!;
    /* eslint-enable @typescript-eslint/no-non-null-assertion */
    const input = newContainer.find('input');
    curentContainer.removeChild(buttonsContainer);
    newContainer.append(buttonsContainer); // xss-safe-value
    newContainer.css('display', 'flex');
    target.style.display = 'none';
    input.trigger('focus');
    this.view.sizeModule.resizeComposeBox();
    this.view.sizeModule.setInputTextHeightManuallyIfNeeded();
  };

  private addTheirPubkeyClickHandler = () => {
    const noPgpRecipients = this.getValidRecipients().filter(r => r.element.className.includes('no_pgp'));
    this.view.renderModule.renderAddPubkeyDialog(noPgpRecipients.map(r => r.email));
    clearInterval(this.addedPubkeyDbLookupInterval); // todo - get rid of Catch.set_interval. just supply tabId and wait for direct callback
    this.addedPubkeyDbLookupInterval = Catch.setHandledInterval(async () => {
      const recipientsHasPgp: ValidRecipientElement[] = [];
      for (const recipient of noPgpRecipients) {
        const pubkeys = (await ContactStore.getEncryptionKeys(undefined, [recipient.email]))[0].keys;
        if (pubkeys.length > 0) {
          $(recipient.element).removeClass('no_pgp').find('i').remove();
          clearInterval(this.addedPubkeyDbLookupInterval);
          recipientsHasPgp.push(recipient);
          await this.evaluateRecipients(recipientsHasPgp);
        }
      }
    }, 1000);
  };

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
  private recipientInputKeydownHandler = (e: JQuery.TriggeredEvent<HTMLElement>): boolean => {
    const currentActive = this.view.S.cached('contacts').find('ul li.select_contact.active');
    if (e.key === 'Backspace') {
      if (!$(e.target).val()) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        const sendingType = e.target.getAttribute('data-sending-type') as RecipientType;
        const reversedRecipients = [...this.addedRecipients].reverse();
        const lastRecipient = reversedRecipients.find(r => r.sendingType === sendingType);
        if (lastRecipient) {
          this.removeRecipient(lastRecipient.element);
        }
      }
      return false;
    } else if (e.key === 'Space') {
      // Handle 'Space' key
      const target = $(e.target);
      const emails = String(target.val())
        .split(/[,\s]/g)
        .filter(e => !!e);
      if (!emails.find(e => !Str.isEmailValid(e))) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        this.parseRenderRecipients($(e.target), false, emails).catch(Catch.reportErr);
        e.preventDefault();
      } else if (target.val() === '') {
        e.preventDefault();
      }
    } else if (e.key === 'Enter') {
      if (currentActive.length) {
        // If he pressed enter when contacts popover is shown
        currentActive.trigger('click'); // select contact
        currentActive.removeClass('active');
      } else {
        // We need to force add recipient even it's invalid
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        this.parseRenderRecipients($(e.target), true).catch(Catch.reportErr);
        this.hideContacts();
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      e.target.focus();
      return true;
    } else if (this.view.S.cached('contacts').is(':hidden')) {
      // Next will affect contacts popover
      return false;
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      this.hideContacts();
      this.view.S.cached('input_to').trigger('focus');
      return true;
    } else if (!currentActive.length) {
      return false; // all following code operates on selected currentActive element
    } else if (e.key === 'Tab') {
      e.preventDefault(); // don't switch inputs
      e.stopPropagation(); // don't switch inputs
      currentActive.trigger('click'); // select contact
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
  };

  /**
   * todo - contactSearch should be refactored, plus split into a separate module
   * That way things regarding searching contacts would be separate from more general recipients behavior
   */
  private searchContacts = async (input: JQuery): Promise<void> => {
    try {
      const searchString = String(input.val());
      if (searchString.includes(',') || searchString.length >= 100) {
        // https://github.com/FlowCrypt/flowcrypt-browser/issues/5169
        this.view.errModule.debug(`Skipping searchContacts if the user is pasting multiple recipients or the search string length exceeds 100 characters`);
        return;
      }
      this.view.errModule.debug(`searchContacts`);
      const substring = Str.parseEmail(searchString, 'DO-NOT-VALIDATE').email;
      this.view.errModule.debug(`searchContacts.query.substring(${JSON.stringify(substring)})`);
      if (!substring) {
        this.view.errModule.debug(`searchContacts 1`);
        this.hideContacts(); // todo - show suggestions of most contacted ppl etc
        return;
      }
      const contacts: ContactPreview[] = await ContactStore.search(undefined, { substring });
      this.view.errModule.debug(`searchContacts substring: ${substring}`);
      this.view.errModule.debug(`searchContacts db count: ${contacts.length}`);
      if (contacts.length > 0) {
        // do not show `no results found` when there are no stored contacts. We might get result from google api
        await this.renderSearchRes(input, contacts, { substring });
      }
      if (contacts.length >= this.MAX_CONTACTS_LENGTH) {
        this.view.errModule.debug(`searchContacts 2, count: ${contacts.length}`);
        return;
      }
      let foundOnGoogle: EmailProviderContact[] = [];
      if ((await this.googleContactsSearchEnabled) !== false) {
        this.view.errModule.debug(`searchContacts 3`);
        foundOnGoogle = await this.searchContactsOnGoogle(substring, contacts);
        const contactPreview = await this.addApiLoadedContactsToDb(foundOnGoogle);
        this.view.errModule.debug(`searchContacts foundOnGoogle, count: ${foundOnGoogle.length}`);
        contacts.push(...contactPreview);
        await this.renderSearchRes(input, contacts, { substring });
        if (contacts.length >= this.MAX_CONTACTS_LENGTH) {
          this.view.errModule.debug(`searchContacts 3.b, count: ${contacts.length}`);
          return;
        }
      }
      this.view.errModule.debug(`searchContacts 4`);
      if (!foundOnGoogle.length) {
        this.view.errModule.debug(`searchContacts (Gmail Sent Messages) 6.b`);
        await this.guessContactsFromSentEmails(substring, contacts, async guessed => {
          const contactPreview = await this.addApiLoadedContactsToDb(guessed.new);
          this.view.errModule.debug(`searchContacts (Gmail Sent Messages), count: ${guessed.new.length}`);
          contacts.push(...contactPreview);
          await this.renderSearchRes(input, contacts, { substring });
        });
      }
      if (contacts.length === 0) {
        // Show `no results found` view when there are no contacts
        await this.renderSearchRes(input, contacts, { substring });
      }
    } catch (e) {
      Ui.toast(`Error searching contacts: ${ApiErr.eli5(e)}`, false, 5);
      throw e;
    } finally {
      this.view.errModule.debug('searchContacts 7 - finishing');
      this.renderSearchResultsLoadingDone();
    }
  };

  private guessContactsFromSentEmails = async (query: string, knownContacts: ContactPreview[], multiCb: ChunkedCb) => {
    this.view.errModule.debug('guessContactsFromSentEmails start');
    await this.view.emailProvider
      .guessContactsFromSentEmails(
        query,
        knownContacts.map(c => c.email).filter(e => Str.isEmailValid(e)),
        multiCb
      )
      .catch((e: unknown) => {
        if (ApiErr.isAuthErr(e)) {
          BrowserMsg.send.notificationShowAuthPopupNeeded(this.view.parentTabId, { acctEmail: this.view.acctEmail });
        } else if (ApiErr.isNetErr(e)) {
          Ui.toast(`Network error - cannot search contacts`);
        } else if (ApiErr.isMailOrAcctDisabledOrPolicy(e)) {
          Ui.toast(`Cannot search contacts - account disabled or forbidden by admin policy`);
        } else {
          Catch.reportErr(e);
          Ui.toast(`Error searching contacts: ${ApiErr.eli5(e)}`);
        }
      });
    this.view.errModule.debug('guessContactsFromSentEmails end');
  };

  private searchContactsOnGoogle = async (query: string, knownContacts: ContactPreview[]): Promise<EmailProviderContact[]> => {
    this.view.errModule.debug(`searchContacts (Google API) 5`);
    const contactsGoogle = await Google.contactsGet(this.view.acctEmail, query, undefined, this.MAX_CONTACTS_LENGTH);
    if (contactsGoogle?.length) {
      return contactsGoogle.filter(cGmail => !knownContacts.find(c => c.email === cGmail.email));
    }
    return [];
  };

  private setContactPopupStyle = (input: JQuery) => {
    const contactEl = this.view.S.cached('contacts');
    /* eslint-disable @typescript-eslint/no-non-null-assertion */
    const offset = input.offset()!;
    const offsetTop = input.outerHeight()! + offset.top; // both are in the template
    const bottomGap = 10;
    const inputToPadding = parseInt(input.css('padding-left'));
    let leftOffset: number;
    if (this.view.S.cached('body').width()! < offset.left + inputToPadding + contactEl.width()!) {
      // Here we need to align contacts popover by right side
      leftOffset = offset.left + inputToPadding + input.width()! - contactEl.width()!;
    } else {
      leftOffset = offset.left + inputToPadding;
    }
    /* eslint-enable @typescript-eslint/no-non-null-assertion */
    this.view.S.cached('contacts').css({
      display: 'block',
      top: offsetTop,
      left: leftOffset,
      maxHeight: `calc(100% - ${offsetTop + bottomGap}px)`,
    });
  };

  private getPgpIconHtml = (hasPgp: boolean) => {
    return `<img class="lock-icon" src="/img/svgs/locked-icon-${hasPgp ? 'green' : 'gray'}.svg" />`;
  };

  private renderSearchRes = async (input: JQuery, contacts: ContactPreview[], query: ProviderContactsQuery) => {
    if (!input.is(':focus')) {
      // focus was moved away from input
      return;
    }
    if ((input.val() as string).toLowerCase() !== query.substring.toLowerCase()) {
      // the input value has changed meanwhile
      return;
    }
    this.view.errModule.debug(`renderSearchRes len: ${contacts.length}`);
    // have pgp on top, no pgp bottom. Sort each groups by last use
    const sortedContacts = contacts.sort((a: ContactPreview, b: ContactPreview) => {
      if (a.hasPgp && !b.hasPgp) {
        return -1;
      }
      if (!a.hasPgp && b.hasPgp) {
        return 1;
      }
      if ((a.lastUse || 0) > (b.lastUse || 0)) {
        return -1;
      }
      if ((a.lastUse || 0) < (b.lastUse || 0)) {
        return 1;
      }
      return 0;
    });
    const contactEl = this.view.S.cached('contacts');
    const renderableContacts = sortedContacts.slice(0, this.MAX_CONTACTS_LENGTH);
    if (renderableContacts.length > 0) {
      let ulHtml = '';
      for (const contact of renderableContacts) {
        ulHtml += `<li class="select_contact" email="${Xss.escape(contact.email.replace(/<\/?b>/g, ''))}">`;
        if (contact.pgpLoading) {
          ulHtml += '<img class="loading-icon" data-test="pgp-loading-icon" src="/img/svgs/spinner-green-small.svg" />';
          contact.pgpLoading
            .then(hasPgp => {
              Xss.replaceElementDANGEROUSLY($(`[email="${contact.email}"] .loading-icon`)[0], this.getPgpIconHtml(hasPgp)); // xss-escaped
            })
            .catch(() => {
              this.failedLookupEmails.push(contact.email);
            });
        } else {
          ulHtml += this.getPgpIconHtml(contact.hasPgp);
        }
        let displayEmail;
        if (contact.email.length < 40) {
          displayEmail = contact.email;
        } else {
          const parts = contact.email.split('@');
          displayEmail = parts[0].replace(/<\/?b>/g, '').substring(0, 10) + '...@' + parts[1];
        }
        displayEmail = '<div class="select_contact_email" data-test="action-select-contact-email">' + Xss.escape(displayEmail) + '</div>';
        if (contact.name) {
          ulHtml += '<div class="select_contact_name" data-test="action-select-contact-name">' + Xss.escape(contact.name) + displayEmail + '</div>';
        } else {
          ulHtml += displayEmail;
        }
        ulHtml += '</li>';
      }
      this.removeBtnToAllowSearchContactsFromGoogle(); // remove allow search contacts from google if it was present
      Xss.sanitizeRender(contactEl.find('ul'), ulHtml);
      const contactItems = contactEl.find('ul li.select_contact');
      contactItems.first().addClass('active');
      contactItems.on(
        'click',
        this.view.setHandlerPrevent(
          'double',
          async (target: HTMLElement) => {
            const email = Str.parseEmail($(target).attr('email') || '').email;
            if (email) {
              await this.selectContact(input, email, query);
            }
          },
          this.view.errModule.handle(`select contact`)
        )
      );
      contactItems.on('hover', function () {
        contactItems.removeClass('active');
        $(this).addClass('active');
      });
      this.setContactPopupStyle(input);
    } else {
      this.setContactPopupStyle(input);
      contactEl.find('ul').html('<li data-test="no-contact-found">No Contacts Found</li>'); // xss-direct
      if ((await this.googleContactsSearchEnabled) === false) {
        this.addBtnToAllowSearchContactsFromGoogle(input);
      }
    }
  };

  private addBtnToAllowSearchContactsFromGoogle = (input: JQuery) => {
    if (this.view.S.cached('contacts').find('.allow-google-contact-search').length) {
      return;
    }
    this.view.S.cached('contacts')
      .append(
        '<div class="allow-google-contact-search" data-test="action-auth-with-contacts-scope"><img src="/img/svgs/gmail.svg" />Enable Google Contact Search</div>'
      ) // xss-direct
      .find('.allow-google-contact-search')
      .on(
        'click',
        this.view.setHandler(async () => {
          const authResult = await BrowserMsg.send.bg.await.reconnectAcctAuthPopup({
            acctEmail: this.view.acctEmail,
            scopes: GoogleOAuth.defaultScopes('contacts'),
            screenDimensions: Ui.getScreenDimensions(),
          });
          if (authResult.result === 'Success') {
            this.googleContactsSearchEnabled = true;
            this.hideContacts();
            input.trigger('focus');
            await this.searchContacts(input);
          } else if (authResult.result !== 'Closed') {
            await Ui.modal.error(
              `Could not enable Google Contact search. ${Lang.general.writeMeToFixIt(!!this.view.fesUrl)}\n\n[${authResult.result}] ${authResult.error}`
            );
          }
        })
      );
  };

  private removeBtnToAllowSearchContactsFromGoogle = () => {
    this.view.S.cached('contacts').find('.allow-google-contact-search')?.remove();
  };

  private selectContact = async (input: JQuery, email: string, fromQuery: ProviderContactsQuery) => {
    this.view.errModule.debug(`selectContact 1`);
    const possiblyBogusRecipient = input.siblings('.recipients span.wrong').last();
    const possiblyBogusAddr = Str.parseEmail(possiblyBogusRecipient.text()).email;
    this.view.errModule.debug(`selectContact 2`);
    const q = Str.parseEmail(fromQuery.substring).email;
    if (possiblyBogusAddr && q && (possiblyBogusAddr === q || possiblyBogusAddr.includes(q))) {
      possiblyBogusRecipient.remove();
    }
    this.view.errModule.debug(`selectContact -> parseRenderRecipients start`);
    this.parseRenderRecipients(input, false, [email]).catch(Catch.reportErr);
    input.trigger('focus');
    this.hideContacts();
  };

  private createRecipientsElements = (
    container: JQuery,
    emails: { email?: string; name?: string; invalid?: string }[],
    sendingType: RecipientType,
    status: RecipientStatus
  ): RecipientElement[] => {
    // Do not add padding-bottom for reply box
    // https://github.com/FlowCrypt/flowcrypt-browser/issues/5935
    if (!container.hasClass('input-container')) {
      if (sendingType === 'to') {
        if ($('#input-container-cc').css('display') === 'none' && $('#input-container-bcc').css('display') === 'none') {
          container.parent().css('padding-bottom', this.inputContainerPaddingBottom);
        }
      }
      if (sendingType === 'cc') {
        if ($('#input-container-bcc').css('display') === 'none') {
          container.parent().css('padding-bottom', this.inputContainerPaddingBottom);
        }
      }
    }

    const result: RecipientElement[] = [];
    for (const { email, name, invalid } of emails) {
      const recipientId = this.generateRecipientId();
      const recipientsHtml =
        `<span tabindex="0" id="${recipientId}" data-test="${recipientId}">` +
        `<span class="recipient-name">${Xss.escape(name || '')}</span>` +
        `<span class="recipient-email">${Xss.escape(email || invalid || '')}</span> ${Ui.spinner('green')}</span>`;
      Xss.sanitizeAppend(container.find('.recipients'), recipientsHtml);
      const element = document.getElementById(recipientId);
      if (element) {
        // if element wasn't created this means that Composer is used by another component
        $(element).on(
          'keydown',
          this.view.setHandler((el, ev) => {
            if (ev.key === 'Delete' || ev.key === 'Backspace') {
              this.removeRecipient(element);
            }
          }, this.view.errModule.handle('remove recipient with keyboard'))
        );
        this.addDraggableEvents(element);
        const recipient = {
          email,
          name,
          invalid,
          element,
          id: recipientId,
          sendingType,
          status: email ? status : RecipientStatus.WRONG,
        };
        this.addedRecipients.push(recipient);
        if (recipient.status === RecipientStatus.WRONG) {
          this.renderPubkeyResult(recipient, undefined);
        }
        result.push(recipient);
      }
    }
    return result;
  };

  private addApiLoadedContactsToDb = async (newContacts: EmailProviderContact[]): Promise<ContactPreview[]> => {
    this.view.errModule.debug('addApiLoadedContactsToDb 1');
    const contacts: ContactPreview[] = [];
    for (const contact of newContacts) {
      const validEmail = Str.parseEmail(contact.email).email;
      if (!validEmail) {
        continue;
      }
      const storedContact = await ContactStore.getOneWithAllPubkeys(undefined, validEmail);
      if (storedContact) {
        if (!storedContact.info.name && contact.name) {
          await ContactStore.update(undefined, validEmail, { name: contact.name });
        }
      }
      contacts.push({
        email: validEmail,
        name: contact.name,
        hasPgp: (storedContact?.sortedPubkeys.length ?? 0) > 0,
        lastUse: 0,
        pgpLoading: this.failedLookupEmails.includes(validEmail)
          ? undefined
          : this.view.storageModule.updateLocalPubkeysFromRemote([], validEmail, contact.name),
      });
    }
    return contacts;
  };

  private renderSearchResultsLoadingDone = () => {
    if (this.view.S.cached('contacts').find('.select_contact, .allow-google-contact-search').length) {
      this.showContacts();
    }
  };

  private orderRecipientsBySendingType = (a: RecipientElement, b: RecipientElement) => {
    if (a.sendingType === b.sendingType) {
      return 0;
    }
    if (a.sendingType === 'to' && b.sendingType !== 'to') {
      return -1;
    }
    if (a.sendingType === 'cc' && b.sendingType === 'bcc') {
      return -1;
    }
    return 1;
  };

  // todo: I guess we can combine this with reRenderRecipientFor
  private checkReciepientsKeys = async () => {
    for (const recipientEl of this.getValidRecipients().filter(r => r.element.className.includes('no_pgp'))) {
      const email = $(recipientEl).text().trim();
      const dbContacts = await ContactStore.getOneWithAllPubkeys(undefined, email);
      if (dbContacts?.sortedPubkeys?.length) {
        recipientEl.element.classList.remove('no_pgp');
        this.renderPubkeyResult(recipientEl, dbContacts);
      }
    }
  };

  private renderPubkeyResult = (recipient: RecipientElement, info: ContactInfoWithSortedPubkeys | undefined | 'fail') => {
    // console.log(`>>>> renderPubkeyResult: ${JSON.stringify(info)}`);
    const el = recipient.element;
    const emailId = recipient.email?.replace(/[^a-z0-9]+/g, '') ?? '';
    this.view.errModule.debug(`renderPubkeyResult.email(${recipient.email || recipient.invalid})`);
    // this.view.errModule.debug(`renderPubkeyResult.contact(${JSON.stringify(info)})`);
    $(el).children('img, i').remove();
    const contentHtml =
      `<img src="/img/svgs/close-icon.svg" alt="close" class="close-icon svg" data-test="action-remove-${emailId}-recipient"/>` +
      `<img src="/img/svgs/close-icon-black.svg" alt="close" class="close-icon svg display_when_sign" />`;
    Xss.sanitizeAppend(el, contentHtml)
      .find('img.close-icon')
      .on(
        'click',
        this.view.setHandler(
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          target => this.removeRecipient(target.parentElement!),
          this.view.errModule.handle('remove recipient')
        )
      );
    $(el).removeClass(['failed', 'wrong', 'has_pgp', 'no_pgp', 'expired']);
    if (recipient.status === RecipientStatus.WRONG) {
      this.view.errModule.debug(`renderPubkeyResult: Setting email to wrong / misspelled in harsh mode: ${recipient.invalid}`);
      $(el).attr('title', 'This email address looks misspelled. Please try again.');
      $(el).addClass('wrong');
    } else if (info === PUBKEY_LOOKUP_RESULT_FAIL) {
      recipient.status = RecipientStatus.FAILED;
      $(el).attr('title', 'Failed to load, click to retry');
      $(el).addClass('failed');
      Xss.sanitizeReplace(
        $(el).children('img:visible'),
        `
          <img
            src="/img/svgs/repeat-icon.svg"
            data-test="action-retry-${emailId}-pubkey-fetch"
            class="repeat-icon action_retry_pubkey_fetch"
          >
          <img src="/img/svgs/close-icon-black.svg" class="close-icon-black svg remove-reciepient">
        `
      );
      $(el)
        .find('.action_retry_pubkey_fetch')
        .on(
          'click',
          this.view.setHandler(async () => await this.refreshRecipients(), this.view.errModule.handle('refresh recipient'))
        );
      $(el)
        .find('.remove-reciepient')
        .on(
          'click',
          this.view.setHandler(
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            element => this.removeRecipient(element.parentElement!),
            this.view.errModule.handle('remove recipient')
          )
        );
    } else if (info?.sortedPubkeys.length) {
      if (info.info.name) {
        recipient.name = info.info.name;
        $(el).find('.recipient-name').text(Xss.escape(info.info.name));
      }
      // New logic:
      // 1. Keys are sorted in a special way.
      // 2. If there is at least one key:
      //    - if first key is valid (non-expired, non-revoked) public key, then it's HAS_PGP.
      //    - else if first key is revoked, then REVOKED.
      //    - else EXPIRED.
      // 3. Otherwise NO_PGP.
      const firstKeyInfo = info.sortedPubkeys[0];
      if (!firstKeyInfo.revoked && !KeyUtil.expired(firstKeyInfo.pubkey)) {
        recipient.status = RecipientStatus.HAS_PGP;
        $(el).addClass('has_pgp');
        Xss.sanitizePrepend(el, '<img class="lock-icon" src="/img/svgs/locked-icon.svg" />');
        $(el).attr('title', 'Does use encryption\n\n' + this.formatPubkeysHintText(info.sortedPubkeys));
      } else if (firstKeyInfo.revoked) {
        recipient.status = RecipientStatus.REVOKED;
        $(el).addClass('revoked');
        Xss.sanitizePrepend(el, '<img src="/img/svgs/revoked.svg" class="revoked-or-expired">');
        $(el).attr(
          'title',
          'Does use encryption but their public key is revoked. ' +
            'You should ask them to send you an updated public key.\n\n' +
            this.formatPubkeysHintText(info.sortedPubkeys)
        );
      } else {
        recipient.status = RecipientStatus.EXPIRED;
        $(el).addClass('expired');
        Xss.sanitizePrepend(el, '<img src="/img/svgs/expired-timer.svg" class="revoked-or-expired">');
        $(el).attr(
          'title',
          'Does use encryption but their public key is expired. ' +
            'You should ask them to send you an updated public key.\n\n' +
            this.formatPubkeysHintText(info.sortedPubkeys)
        );
      }
    } else {
      recipient.status = RecipientStatus.NO_PGP;
      $(el).addClass('no_pgp');
      if (info?.info.name) {
        recipient.name = info.info.name;
        $(el).find('.recipient-name').text(Xss.escape(info.info.name));
      }
      Xss.sanitizePrepend(el, '<img class="lock-icon" src="/img/svgs/locked-icon.svg" />');
      $(el).attr('title', 'Could not verify their encryption setup. You can encrypt the message with a password below. Alternatively, add their pubkey.');
    }
    // Replace updated recipient in addedRecipients
    const changedIndex = this.addedRecipients.findIndex(
      addedRecipient => (!recipient.email || addedRecipient.email === recipient.email) && addedRecipient.id === recipient.id
    );
    if (changedIndex > -1) {
      this.addedRecipients.splice(changedIndex, 1, recipient);
    }
    this.view.pwdOrPubkeyContainerModule.showHideContainerAndColorSendBtn().catch(Catch.reportErr);
    this.view.myPubkeyModule.reevaluateShouldAttachOrNot();
  };

  private formatPubkeysHintText = (pubkeyInfos: PubkeyInfo[]): string => {
    const valid: PubkeyInfo[] = [];
    const expired: PubkeyInfo[] = [];
    const revoked: PubkeyInfo[] = [];
    for (const pubkeyInfo of pubkeyInfos) {
      if (pubkeyInfo.revoked) {
        revoked.push(pubkeyInfo);
      } else if (KeyUtil.expired(pubkeyInfo.pubkey)) {
        expired.push(pubkeyInfo);
      } else {
        valid.push(pubkeyInfo);
      }
    }
    return [
      { groupName: 'Valid public key fingerprints:', pubkeyInfos: valid },
      { groupName: 'Expired public key fingerprints:', pubkeyInfos: expired },
      { groupName: 'Revoked public key fingerprints:', pubkeyInfos: revoked },
    ]
      .filter(g => g.pubkeyInfos.length)
      .map(g => this.formatKeyGroup(g.groupName, g.pubkeyInfos))
      .join('\n\n');
  };

  private formatKeyGroup = (groupName: string, pubkeyInfos: PubkeyInfo[]): string => {
    return [groupName, ...pubkeyInfos.map(info => this.formatPubkeyId(info))].join('\n');
  };

  private removeRecipient = (element: HTMLElement) => {
    const index = this.addedRecipients.findIndex(r => r.element.isEqualNode(element));
    const recipient = this.addedRecipients[index];
    // Adjust padding when the last recipient of a specific type is removed
    if (this.addedRecipients.filter(r => r.sendingType === recipient.sendingType).length === 1) {
      $(`#input-container-${recipient.sendingType}`).css('padding-bottom', '0');
    }
    recipient.element.remove();
    const container = element.parentElement?.parentElement; // Get Container, e.g. '.input-container-cc'
    if (container) {
      this.view.sizeModule.resizeInput($(container).find('input'));
    }
    this.view.S.cached('input_addresses_container_outer').find(`#input-container-${recipient.sendingType} input`).trigger('focus');
    this.addedRecipients.splice(index, 1);
    this.view.pwdOrPubkeyContainerModule.showHideContainerAndColorSendBtn().catch(Catch.reportErr);
    this.view.myPubkeyModule.reevaluateShouldAttachOrNot();
  };

  private refreshRecipients = async () => {
    const failedRecipients = this.getValidRecipients().filter(r => r.element.className.includes('failed'));
    await this.reEvaluateRecipients(failedRecipients);
  };

  private formatPubkeyId = (pubkeyInfo: PubkeyInfo): string => {
    return `${Str.spaced(pubkeyInfo.pubkey.id)} (${pubkeyInfo.pubkey.family})`;
  };

  private generateRecipientId = (): string => {
    const recipientId = `recipient_${this.uniqueRecipientIndex}`;
    this.uniqueRecipientIndex += 1;
    return recipientId;
  };

  private addDraggableEvents = (element: HTMLElement) => {
    element.draggable = true;
    /* eslint-disable @typescript-eslint/no-non-null-assertion */
    element.ondragstart = event => {
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
    element.ondragover = ev => {
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
      element.parentElement!.insertBefore(this.dragged, element); // xss-reinsert
      const draggableElementIndex = this.addedRecipients.findIndex(r => r.element === this.dragged);
      const sendingType = this.addedRecipients.find(r => r.element === element)!.sendingType;
      /* eslint-enable @typescript-eslint/no-non-null-assertion */
      this.addedRecipients[draggableElementIndex].sendingType = sendingType;
      // Sync the Recipients array with HTML
      this.addedRecipients = moveElementInArray(
        this.addedRecipients,
        draggableElementIndex,
        this.addedRecipients.findIndex(r => r.element === element)
      );
      const newInput = this.view.S.cached('input_addresses_container_outer').find(`#input-container-${sendingType} input`);
      this.view.sizeModule.resizeInput(newInput.add(previousInput));
      this.dragged = undefined;
      newInput.trigger('focus');
    };
    element.ondragend = () => Catch.setHandledTimeout(() => (this.dragged = undefined), 0);
  };

  private insertCursorBefore = (element: HTMLElement | Element, append?: boolean) => {
    const cursor = document.createElement('i');
    cursor.classList.add('drag-cursor');
    if (!append) {
      if (!element.parentElement) {
        return false;
      }
      element.parentElement?.insertBefore(cursor, element); // xss-reinsert
    } else {
      element.appendChild(cursor);
    }
    return true;
  };

  private removeCursor = (element: HTMLElement) => {
    for (const child of element.children) {
      if (child.classList.contains('drag-cursor')) {
        child.parentElement?.removeChild(child);
        break;
      }
    }
  };

  private setCorrectPaddingForInputContainer = () => {
    if (this.addedRecipients.some(r => r.sendingType === 'to') && !this.addedRecipients.some(r => r.sendingType === 'cc')) {
      $('#input-container-to').css('padding-bottom', this.inputContainerPaddingBottom);
    } else if (this.addedRecipients.some(r => r.sendingType === 'cc') && !this.addedRecipients.some(r => r.sendingType === 'bcc')) {
      $('#input-container-cc').css('padding-bottom', this.inputContainerPaddingBottom);
    }
  };

  private focusRecipients = () => {
    this.view.S.cached('recipients_placeholder').hide();
    this.view.S.cached('input_addresses_container_outer').removeClass('invisible');
    this.view.sizeModule.resizeComposeBox();
    if (this.view.isReplyBox) {
      this.view.sizeModule.resizeInput();
    }
    this.view.sizeModule.setInputTextHeightManuallyIfNeeded();
  };
}
