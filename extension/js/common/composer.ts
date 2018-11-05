/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store, Subscription, KeyInfo, ContactUpdate, Serializable, Contact, DbContactFilter } from './store.js';
import { Lang } from './lang.js';
import { Catch, Value, Str, Env, UnreportableError, Dict, UrlParams } from './common.js';
import { Att } from './att.js';
import { BrowserMsg, Extension, BrowserMsgHandler, BrowserWidnow } from './extension.js';
import { Pgp } from './pgp.js';
import { Api, R, ProgressCb, ProviderContactsQuery, PubkeySearchResult, SendableMsg, RichHeaders, StandardError, SendableMsgBody, AwsS3UploadItem } from './api.js';
import { Ui, Xss, AttUI, BrowserEventErrorHandler, Pwd } from './browser.js';
import { FromToHeaders, Mime } from './mime.js';

declare let openpgp: typeof OpenPGP;

interface ComposerAppFunctionsInterface {
  canReadEmails: () => boolean;
  doesRecipientHaveMyPubkey: (email: string) => Promise<boolean | undefined>;
  storageGetAddresses: () => string[];
  storageGetAddressesPks: () => string[];
  storageGetAddressesKeyserver: () => string[];
  storageEmailFooterGet: () => string | null;
  storageEmailFooterSet: (footer: string | null) => Promise<void>;
  storageGetHideMsgPassword: () => boolean;
  storageGetSubscription: () => Promise<Subscription>;
  storageGetKey: (senderEmail: string) => Promise<KeyInfo>;
  storageSetDraftMeta: (storeIfTrue: boolean, draftId: string, threadId: string, recipients: string[] | null, subject: string | null) => Promise<void>;
  storagePassphraseGet: () => Promise<string | null>;
  storageAddAdminCodes: (shortId: string, msgAdminCode: string, attAdminCodes: string[]) => Promise<void>;
  storageContactGet: (email: string[]) => Promise<(Contact | null)[]>;
  storageContactUpdate: (email: string | string[], update: ContactUpdate) => Promise<void>;
  storageContactSave: (contact: Contact) => Promise<void>;
  storageContactSearch: (query: ProviderContactsQuery) => Promise<Contact[]>;
  storageContactObj: (email: string, name?: string, client?: string, pubkey?: string, attested?: boolean, pendingLookup?: boolean, lastUse?: number) => Contact;
  emailProviderDraftGet: (draftId: string) => Promise<R.GmailDraftGet>;
  emailProviderDraftCreate: (mimeMsg: string) => Promise<R.GmailDraftCreate>;
  emailProviderDraftUpdate: (draftId: string, mimeMsg: string) => Promise<R.GmailDraftUpdate>;
  emailProviderDraftDelete: (draftId: string) => Promise<R.GmailDraftDelete>;
  emailProviderMsgSend: (msg: SendableMsg, renderUploadProgress: ProgressCb) => Promise<R.GmailMsgSend>;
  emailEroviderSearchContacts: (query: string, knownContacts: Contact[], multiCb: (r: { new: Contact[], all: Contact[] }) => void) => void;
  emailProviderDetermineReplyMsgHeaderVariables: () => Promise<undefined | { lastMsgId: string, headers: { 'In-Reply-To': string, 'References': string } }>;
  emailProviderExtractArmoredBlock: (msgId: string) => Promise<string>;
  sendMsgToMainWin: (channel: string, data?: object) => void;
  sendMsgToBgScript: (channel: string, data?: object) => void;
  renderFooterDialog: () => void;
  renderAddPubkeyDialog: (emails: string[]) => void;
  renderReinsertReplyBox: (lastMsgId: string, recipients: string[]) => void;
  renderHelpDialog: () => void;
  renderSendingAddrDialog: () => void;
  factoryAtt: (att: Att) => string;
  closeMsg: () => void;
}

export class ComposerUserError extends Error { }
export class ComposerNotReadyError extends ComposerUserError { }
export class ComposerNetworkError extends Error { }
export class ComposerResetBtnTrigger extends Error { }

export class Composer {

  private S = Ui.buildJquerySels({
    body: 'body',
    compose_table: 'table#compose',
    header: '#section_header',
    subject: '#section_subject',
    title: 'table#compose th h1',
    input_text: 'div#input_text',
    input_to: '#input_to',
    input_from: '#input_from',
    input_subject: '#input_subject',
    input_password: '#input_password',
    input_intro: '.input_intro',
    all_cells_except_text: 'table#compose > tbody > tr > :not(.text)',
    add_intro: '.action_add_intro',
    add_their_pubkey: '.add_pubkey',
    intro_container: '.intro_container',
    password_or_pubkey: '#password_or_pubkey_container',
    password_label: '.label_password',
    send_btn_note: '#send_btn_note',
    send_btn_span: '#send_btn span',
    send_btn_i: '#send_btn i',
    send_btn: '#send_btn',
    icon_pubkey: '.icon.action_include_pubkey',
    icon_footer: '.icon.action_include_footer',
    icon_help: '.action_feedback',
    icon_sign: '.icon.action_sign',
    prompt: 'div#initial_prompt',
    reply_msg_successful: '#reply_message_successful_container',
    replied_body: '.replied_body',
    replied_attachments: '#attachments',
    contacts: '#contacts',
    input_addresses_container_outer: '#input_addresses_container',
    input_addresses_container_inner: '#input_addresses_container > div:first',
  });

  private attach: AttUI;
  private app: ComposerAppFunctionsInterface;

  private SAVE_DRAFT_FREQUENCY = 3000;
  private PUBKEY_LOOKUP_RESULT_WRONG: 'wrong' = 'wrong';
  private PUBKEY_LOOKUP_RESULT_FAIL: 'fail' = 'fail';
  private BTN_ENCRYPT_AND_SEND = 'Encrypt and Send';
  private BTN_SIGN_AND_SEND = 'Sign and Send';
  private BTN_WRONG_ENTRY = 'Re-enter recipient..';
  private BTN_LOADING = 'Loading..';
  private BTN_SENDING = 'Sending..';
  private FC_WEB_URL = 'https://flowcrypt.com'; // todo - should use Api.url()

  private lastDraft = '';
  private canReadEmails: boolean;
  private lastReplyBoxTableHeight = 0;
  private contactSearchInProgress = false;
  private addedPubkeyDbLookupInterval: number;
  private saveDraftInterval: number;
  private draftSaveInProgress = false;
  private passphraseInterval: number;
  private includePubkeyToggledManually = false;
  private myAddrsOnPks: string[] = [];
  private myAddrsOnKeyserver: string[] = [];
  private recipientsMissingMyKey: string[] = [];
  private ksLookupsByEmail: { [key: string]: PubkeySearchResult | Contact } = {};
  private subscribeResListener: ((subscriptionActive: boolean) => void) | undefined;
  private additionalMsgHeaders: { [key: string]: string } = {};
  private btnUpdateTimeout: number | null = null;
  private isReplyBox: boolean;
  private tabId: string;
  private acctEmail: string;
  private threadId: string;
  private draftId: string;
  private suppliedSubject: string;
  private suppliedFrom: string;
  private suppliedTo: string;
  private frameId: string;
  private refBodyHeight: number;

  constructor(appFunctions: ComposerAppFunctionsInterface, variables: UrlParams, subscription: Subscription) {
    this.attach = new AttUI(() => this.getMaxAttSizeAndOversizeNotice(subscription));
    this.app = appFunctions;

    if (!variables.disableDraftSaving) {
      this.saveDraftInterval = Catch.setHandledInterval(() => this.draftSave(), this.SAVE_DRAFT_FREQUENCY);
    }

    this.acctEmail = variables.acctEmail as string;
    this.draftId = variables.draftId as string;
    this.threadId = variables.threadId as string;
    this.suppliedSubject = variables.subject as string;
    this.suppliedFrom = variables.from as string;
    this.suppliedTo = variables.to as string;
    this.frameId = variables.frameId as string;
    this.tabId = variables.tabId as string;
    this.isReplyBox = variables.isReplyBox as boolean;
    this.myAddrsOnPks = this.app.storageGetAddressesPks() || [];
    this.myAddrsOnKeyserver = this.app.storageGetAddressesKeyserver() || [];
    this.canReadEmails = this.app.canReadEmails();
    if (subscription.active) {
      this.updateFooterIcon();
    } else if (this.app.storageEmailFooterGet()) { // footer set but subscription not active - subscription expired
      this.app.storageEmailFooterSet(null).catch(Catch.handleException);
      this.app.sendMsgToMainWin('notification_show', {
        notification: `${Lang.account.fcSubscriptionEndedNoFooter} <a href="#" class="subscribe">renew</a> <a href="#" class="close">close</a>`,
      });
    }
    if (this.app.storageGetHideMsgPassword()) {
      this.S.cached('input_password').attr('type', 'password');
    }
    this.initComposeBox(variables).catch(Catch.rejection);
    this.initActions();
  }

  private getMaxAttSizeAndOversizeNotice = (subscription: Subscription) => {
    if (!subscription.active) {
      return {
        sizeMb: 5,
        size: 5 * 1024 * 1024,
        count: 10,
        oversize: () => {
          let getAdvanced = 'The files are over 5 MB. Advanced users can send files up to 25 MB.';
          if (!subscription.method) {
            getAdvanced += '\n\nTry it free for 30 days.';
          } else if (subscription.method === 'trial') {
            getAdvanced += '\n\nYour trial has expired, please consider supporting our efforts by upgrading.';
          } else if (subscription.method === 'group') {
            getAdvanced += '\n\nGroup billing is due for renewal. Please check with your leadership.';
          } else if (subscription.method === 'stripe') {
            getAdvanced += '\n\nPlease renew your subscription to continue sending large files.';
          } else {
            getAdvanced += '\n\nClick ok to see subscribe options.';
          }
          if (subscription.method === 'group') {
            alert(getAdvanced);
          } else {
            if (confirm(getAdvanced)) {
              this.showSubscribeDialogAndWaitForRes(null, {}, (newSubscriptionActive: boolean) => {
                if (newSubscriptionActive) {
                  alert('You\'re all set, now you can add your file again.');
                }
              });
            }
          }
        },
      };
    } else {
      let allowHugeAtts = ['94658c9c332a11f20b1e45c092e6e98a1e34c953', 'b092dcecf277c9b3502e20c93b9386ec7759443a', '9fbbe6720a6e6c8fc30243dc8ff0a06cbfa4630e'];
      let sizeMb = (subscription.method !== 'trial' && Value.is(Pgp.hash.sha1(this.acctEmail)).in(allowHugeAtts)) ? 200 : 25;
      return {
        sizeMb,
        size: sizeMb * 1024 * 1024,
        count: 10,
        oversize: (combinedSize: number) => {
          alert('Combined attachment size is limited to 25 MB. The last file brings it to ' + Math.ceil(combinedSize / (1024 * 1024)) + ' MB.');
        },
      };
    }
  }

  private handleErrs = (couldNotDoWhat: string): BrowserEventErrorHandler => {
    return {
      network: () => alert(`Could not ${couldNotDoWhat} (network error). Please try again.`),
      authPopup: () => this.app.sendMsgToMainWin('notification_show_auth_popup_needed', { acctEmail: this.acctEmail }),
      auth: () => {
        if (confirm(`Could not ${couldNotDoWhat}.\nYour FlowCrypt account information is outdated, please review your account settings.`)) {
          this.app.sendMsgToMainWin('subscribe_dialog', { source: 'authErr' });
        }
      },
      other: (e: any) => {
        // todo - add an alert that action could not be finished
        // alert(`Could not ${could_not_do_what} (unknown error). If this repeats, please contact human@flowcrypt.com.\n\n(${String(e)})`);
        if (e instanceof Error) {
          e.stack = (e.stack || '') + `\n\n[compose action: ${couldNotDoWhat}]`;
        } else if (typeof e === 'object' && e && typeof e.stack === 'undefined') {
          try {
            e.stack = `[compose action: ${couldNotDoWhat}]`;
          } catch (e) {
            // no need
          }
        }
        Catch.handleException(e);
      },
    };
  }

  private initActions = () => {
    this.S.cached('icon_pubkey').attr('title', Lang.compose.includePubkeyIconTitle);
    this.S.cached('input_password').keyup(Ui.event.prevent('spree', () => this.showHidePwdOrPubkeyContainerAndColorSendBtn()));
    this.S.cached('input_password').focus(() => this.showHidePwdOrPubkeyContainerAndColorSendBtn());
    this.S.cached('input_password').blur(() => this.showHidePwdOrPubkeyContainerAndColorSendBtn());
    this.S.cached('add_their_pubkey').click(Ui.event.handle(() => {
      let noPgpEmails = this.getRecipientsFromDom('no_pgp');
      this.app.renderAddPubkeyDialog(noPgpEmails);
      clearInterval(this.addedPubkeyDbLookupInterval); // todo - get rid of Catch.set_interval. just supply tabId and wait for direct callback
      this.addedPubkeyDbLookupInterval = Catch.setHandledInterval(async () => {
        for (let email of noPgpEmails) {
          let [contact] = await this.app.storageContactGet([email]);
          if (contact && contact.has_pgp) {
            $("span.recipients span.no_pgp:contains('" + email + "') i").remove();
            $("span.recipients span.no_pgp:contains('" + email + "')").removeClass('no_pgp');
            clearInterval(this.addedPubkeyDbLookupInterval);
            await this.evaluateRenderedRecipients();
          }
        }
      }, 1000);
    }, this.handleErrs('add recipient public key')));
    this.S.cached('add_intro').click(Ui.event.handle(target => {
      $(target).css('display', 'none');
      this.S.cached('intro_container').css('display', 'table-row');
      this.S.cached('input_intro').focus();
      this.setInputTextHeightManuallyIfNeeded();
    }, this.handleErrs(`add intro`)));
    this.S.cached('icon_help').click(Ui.event.handle(() => this.app.renderHelpDialog(), this.handleErrs(`render help dialog`)));
    this.S.now('input_from').change(() => {
      // when I change input_from, I should completely re-evaluate: update_pubkey_icon() and render_pubkey_result()
      // because they might not have a pubkey for the alternative address, and might get confused
    });
    this.S.cached('input_text').get(0).onpaste = async e => {
      let clipboardHtmlData = e.clipboardData.getData('text/html');
      if (clipboardHtmlData) {
        e.preventDefault();
        e.stopPropagation();
        let sanitized = Xss.htmlSanitizeAndStripAllTags(clipboardHtmlData, '<br>');
        this.simulateCtrlV(sanitized);
      }
    };
    this.S.cached('icon_pubkey').click(Ui.event.handle(target => {
      this.includePubkeyToggledManually = true;
      this.updatePubkeyIcon(!$(target).is('.active'));
    }, this.handleErrs(`set/unset pubkey attachment`)));
    this.S.cached('icon_footer').click(Ui.event.handle(target => {
      if (!$(target).is('.active')) {
        this.app.renderFooterDialog();
      } else {
        this.updateFooterIcon(!$(target).is('.active'));
      }
    }, this.handleErrs(`change footer`)));
    $('.delete_draft').click(Ui.event.handle(async () => {
      await this.draftDelete();
      this.app.closeMsg();
    }, this.handleErrs('delete draft')));
    this.S.cached('body').bind({ drop: Ui.event.stop(), dragover: Ui.event.stop() }); // prevents files dropped out of the intended drop area to screw up the page
    this.S.cached('icon_sign').click(Ui.event.handle(() => this.toggleSignIcon(), this.handleErrs(`enable/disable signing`)));
  }

  showSubscribeDialogAndWaitForRes: BrowserMsgHandler = (data, sender, respond: (subscribed: boolean) => void) => {
    this.subscribeResListener = respond;
    this.app.sendMsgToMainWin('subscribe_dialog', { subscribeResultTabId: this.tabId });
  }

  private initComposeBox = async (variables: UrlParams) => {
    if (this.isReplyBox) {
      this.S.cached('header').remove();
      this.S.cached('subject').remove();
      this.S.cached('contacts').css('top', '39px');
      this.S.cached('compose_table').css({ 'border-bottom': '1px solid #cfcfcf', 'border-top': '1px solid #cfcfcf' });
      this.S.cached('input_text').css('overflow-y', 'hidden');
    }
    if (this.draftId) {
      await this.initialDraftLoad();
    } else {
      if (this.isReplyBox) {
        if (variables.skipClickPrompt) {
          await this.renderReplyMsgComposeTable();
        } else {
          $('#reply_click_area,#a_reply,#a_reply_all,#a_forward').click(Ui.event.handle(async target => {
            if ($(target).attr('id') === 'a_reply') {
              this.suppliedTo = this.suppliedTo.split(',')[0];
            } else if ($(target).attr('id') === 'a_forward') {
              this.suppliedTo = '';
            }
            await this.renderReplyMsgComposeTable((($(target).attr('id') || '').replace('a_', '') || 'reply') as 'reply' | 'forward');
          }, this.handleErrs(`activate repply box`)));
        }
      }
    }
    if (this.isReplyBox) {
      if (!variables.skipClickPrompt && !this.draftId) {
        this.S.cached('prompt').css('display', 'block');
      }
      $(document).ready(() => this.resizeReplyBox());
    } else {
      this.S.cached('body').css('overflow', 'hidden'); // do not enable this for replies or automatic resize won't work
      await this.renderComposeTable();
    }
    $('body').attr('data-test-state', 'ready');  // set as ready so that automated tests can evaluate results
  }

  private initialDraftLoad = async () => {
    if (this.isReplyBox) {
      Xss.sanitizeRender(this.S.cached('prompt'), `Loading draft.. ${Ui.spinner('green')}`);
    }
    try {
      let draftGetRes = await this.app.emailProviderDraftGet(this.draftId);
      let parsedMsg = await Mime.decode(Str.base64urlDecode(draftGetRes.message.raw!));
      let armored = Pgp.armor.clip(parsedMsg.text || Pgp.armor.strip(parsedMsg.html || '') || '');
      if (armored) {
        this.S.cached('input_subject').val(parsedMsg.headers.subject || '');
        await this.decryptAndRenderDraft(armored, Mime.headersToFrom(parsedMsg));
      } else {
        console.info('Api.gmail.draft_get Mime.decode else {}');
        if (this.isReplyBox) {
          await this.renderReplyMsgComposeTable();
        }
      }
    } catch (e) {
      if (Api.err.isNetErr(e)) {
        Xss.sanitizeRender('body', `Failed to load draft. ${Ui.retryLink()}`);
      } else if (Api.err.isAuthPopupNeeded(e)) {
        this.app.sendMsgToMainWin('notification_show_auth_popup_needed', { acctEmail: this.acctEmail });
        Xss.sanitizeRender('body', `Failed to load draft - FlowCrypt needs to be re-connected to Gmail. ${Ui.retryLink()}`);
      } else if (this.isReplyBox && Api.err.isNotFound(e)) {
        Catch.log('about to reload reply_message automatically: get draft 404', this.acctEmail);
        await Ui.time.sleep(500);
        await this.app.storageSetDraftMeta(false, this.draftId, this.threadId, null, null);
        console.info('Above red message means that there used to be a draft, but was since deleted. (not an error)');
        window.location.reload();
      } else {
        console.info('Api.gmail.draft_get success===false');
        Catch.handleException(e);
        if (this.isReplyBox) {
          await this.renderReplyMsgComposeTable();
        }
      }
    }
  }

  processSubscribeRes = (newSubscription: Subscription) => {
    if (typeof this.subscribeResListener === 'function') {
      this.subscribeResListener(newSubscription.active || false);
      this.subscribeResListener = undefined;
    }
  }

  private resetSendBtn = (delay: number | null = null) => {
    let btnText = this.S.cached('icon_sign').is('.active') ? this.BTN_SIGN_AND_SEND : this.BTN_ENCRYPT_AND_SEND;
    const doReset = () => Xss.sanitizeRender(this.S.cached('send_btn'), `<i class=""></i><span tabindex="4">${btnText}</span>`);
    if (this.btnUpdateTimeout !== null) {
      clearTimeout(this.btnUpdateTimeout);
    }
    if (!delay) {
      doReset();
    } else {
      Catch.setHandledTimeout(doReset, delay);
    }
  }

  passphraseEntry = (entered: boolean) => {
    if (!entered) {
      this.resetSendBtn();
      clearInterval(this.passphraseInterval);
    }
  }

  private draftSave = async (forceSave: boolean = false) => {
    if (this.shouldSaveDraft(this.S.cached('input_text').text()) || forceSave) {
      this.draftSaveInProgress = true;
      this.S.cached('send_btn_note').text('Saving');
      let primaryKi = await this.app.storageGetKey(this.acctEmail);
      let encrypted = await Pgp.msg.encrypt([primaryKi.public], null, null, this.extractAsText('input_text'), undefined, true) as OpenPGP.EncryptArmorResult;
      let body;
      if (this.threadId) { // replied message
        body = '[cryptup:link:draft_reply:' + this.threadId + ']\n\n' + encrypted.data;
      } else if (this.draftId) {
        body = '[cryptup:link:draft_compose:' + this.draftId + ']\n\n' + encrypted.data;
      } else {
        body = encrypted.data;
      }
      let subject = String(this.S.cached('input_subject').val() || this.suppliedSubject || 'FlowCrypt draft');
      let mimeMsg = await Mime.encode(body as string, { To: this.getRecipientsFromDom(), From: this.suppliedFrom || this.getSenderFromDom(), Subject: subject } as RichHeaders, []);
      try {
        if (!this.draftId) {
          let newDraft = await this.app.emailProviderDraftCreate(mimeMsg);
          this.S.cached('send_btn_note').text('Saved');
          this.draftId = newDraft.id;
          await this.app.storageSetDraftMeta(true, newDraft.id, this.threadId, this.getRecipientsFromDom(), this.S.cached('input_subject').val() as string); // text input
          // recursing one more time, because we need the draft_id we get from this reply in the message itself
          // essentially everytime we save draft for the first time, we have to save it twice
          // save_draft_in_process will remain true because well.. it's still in process
          await this.draftSave(true); // force_save = true
        } else {
          await this.app.emailProviderDraftUpdate(this.draftId, mimeMsg);
          this.S.cached('send_btn_note').text('Saved');
        }
      } catch (e) {
        if (Api.err.isNetErr(e)) {
          this.S.cached('send_btn_note').text('Not saved (network)');
        } else if (Api.err.isAuthPopupNeeded(e)) {
          this.app.sendMsgToMainWin('notification_show_auth_popup_needed', { acctEmail: this.acctEmail });
          this.S.cached('send_btn_note').text('Not saved (reconnect)');
        } else {
          Catch.handleException(e);
          this.S.cached('send_btn_note').text('Not saved');
        }
      }
      this.draftSaveInProgress = false;
    }
  }

  private draftDelete = async () => {
    clearInterval(this.saveDraftInterval);
    await Ui.time.wait(() => !this.draftSaveInProgress ? true : undefined);
    if (this.draftId) {
      await this.app.storageSetDraftMeta(false, this.draftId, this.threadId, null, null);
      try {
        await this.app.emailProviderDraftDelete(this.draftId);
      } catch (e) {
        if (Api.err.isAuthPopupNeeded(e)) {
          this.app.sendMsgToMainWin('notification_show_auth_popup_needed', { acctEmail: this.acctEmail });
        } else if (!Api.err.isNetErr(e)) {
          Catch.handleException(e);
        }
      }
    }
  }

  private decryptAndRenderDraft = async (encryptedDraft: string, headers: FromToHeaders) => {
    let passphrase = await this.app.storagePassphraseGet();
    if (passphrase !== null) {
      let result = await Pgp.msg.decrypt(this.acctEmail, encryptedDraft);
      if (result.success) {
        this.S.cached('prompt').css({ display: 'none' });
        Xss.sanitizeRender(this.S.cached('input_text'), await Xss.htmlSanitizeKeepBasicTags(result.content.text!.replace(/\n/g, '<br>')));
        if (headers && headers.to && headers.to.length) {
          this.S.cached('input_to').focus();
          this.S.cached('input_to').val(headers.to.join(','));
          this.S.cached('input_text').focus();
        }
        if (headers && headers.from) {
          this.S.now('input_from').val(headers.from);
        }
        this.setInputTextHeightManuallyIfNeeded();
      } else {
        this.setInputTextHeightManuallyIfNeeded();
      }
      if (this.isReplyBox) {
        await this.renderReplyMsgComposeTable();
      }
    } else {
      let promptText = `Waiting for <a href="#" class="action_open_passphrase_dialog">pass phrase</a> to open draft..`;
      if (this.isReplyBox) {
        Xss.sanitizeRender(this.S.cached('prompt'), promptText).css({ display: 'block' });
        this.resizeReplyBox();
      } else {
        Xss.sanitizeRender(this.S.cached('prompt'), `${promptText}<br><br><a href="#" class="action_close">close</a>`).css({ display: 'block', height: '100%' });
      }
      this.S.cached('prompt').find('a.action_open_passphrase_dialog').click(Ui.event.handle(target => this.app.sendMsgToMainWin('passphrase_dialog', { type: 'draft', longids: 'primary' })));
      this.S.cached('prompt').find('a.action_close').click(Ui.event.handle(target => this.app.closeMsg()));
      await this.whenMasterPassphraseEntered();
      await this.decryptAndRenderDraft(encryptedDraft, headers);
    }
  }

  private whenMasterPassphraseEntered = (secondsTimeout: number | null = null): Promise<string | null> => {
    return new Promise(resolve => {
      clearInterval(this.passphraseInterval);
      const timeoutAt = secondsTimeout ? Date.now() + secondsTimeout * 1000 : null;
      this.passphraseInterval = Catch.setHandledInterval(async () => {
        let passphrase = await this.app.storagePassphraseGet();
        if (passphrase !== null) {
          clearInterval(this.passphraseInterval);
          resolve(passphrase);
        } else if (timeoutAt && Date.now() > timeoutAt) {
          clearInterval(this.passphraseInterval);
          resolve(null);
        }
      }, 1000);
    });
  }

  private collectAllAvailablePublicKeys = async (acctEmail: string, recipients: string[]): Promise<{ armoredPubkeys: string[], emailsWithoutPubkeys: string[] }> => {
    let contacts = await this.app.storageContactGet(recipients);
    let { public: armoredPublicKey } = await this.app.storageGetKey(acctEmail);
    const armoredPubkeys = [armoredPublicKey];
    const emailsWithoutPubkeys = [];
    for (let i of contacts.keys()) {
      let contact = contacts[i];
      if (contact && contact.has_pgp && contact.pubkey) {
        armoredPubkeys.push(contact.pubkey);
      } else if (contact && this.ksLookupsByEmail[contact.email] && this.ksLookupsByEmail[contact.email].pubkey) {
        armoredPubkeys.push(this.ksLookupsByEmail[contact.email].pubkey!); // checked !null right above. Null evaluates to false.
      } else {
        emailsWithoutPubkeys.push(recipients[i]);
      }
    }
    return { armoredPubkeys, emailsWithoutPubkeys };
  }

  private throwIfFormNotReady = (recipients: string[]): void => {
    if (Value.is(this.S.now('send_btn_span').text().trim()).in([this.BTN_ENCRYPT_AND_SEND, this.BTN_SIGN_AND_SEND]) && recipients && recipients.length) {
      return; // all good
    }
    if (this.S.now('send_btn_span').text().trim() === this.BTN_WRONG_ENTRY) {
      throw new ComposerUserError('Please re-enter recipients marked in red color.');
    }
    if (!recipients || !recipients.length) {
      throw new ComposerUserError('Please add a recipient first');
    }
    throw new ComposerNotReadyError('Still working, please wait.');
  }

  private throwIfFormValsInvalid = (recipients: string[], emailsWithoutPubkeys: string[], subject: string, plaintext: string, challenge: Pwd | null) => {
    const shouldEncrypt = !this.S.cached('icon_sign').is('.active');
    if (!recipients.length) {
      throw new ComposerUserError('Please add receiving email address.');
    }
    if (shouldEncrypt && emailsWithoutPubkeys.length && (!challenge || !challenge.answer)) {
      this.S.cached('input_password').focus();
      throw new ComposerUserError('Some recipients don\'t have encryption set up. Please add a password.');
    }
    if (!((plaintext !== '' || window.confirm('Send empty message?')) && (subject !== '' || window.confirm('Send without a subject?')))) {
      throw new ComposerResetBtnTrigger();
    }
  }

  private handleSendErr(e: Error | StandardError) {
    if (Api.err.isNetErr(e)) {
      alert('Could not send message due to network error. Please check your internet connection and try again.');
    } else if (Api.err.isAuthPopupNeeded(e)) {
      this.app.sendMsgToMainWin('notification_show_auth_popup_needed', { acctEmail: this.acctEmail });
      alert('Could not send message because FlowCrypt needs to be re-connected to google account.');
    } else if (Api.err.isAuthErr(e)) {
      if (confirm('Your FlowCrypt account information is outdated, please review your account settings.')) {
        this.app.sendMsgToMainWin('subscribe_dialog', { source: 'authErr' });
      }
    } else if (Api.err.isBadReq(e)) {
      if (confirm(`Google returned an error when sending message. Please help us improve FlowCrypt by reporting the error to us.`)) {
        let page = '/chrome/settings/modules/help.htm';
        let pageUrlParams = { bugReport: Extension.prepareBugReport('composer: send: bad request', {}, e) };
        this.app.sendMsgToBgScript('settings', { acctEmail: this.acctEmail, page, pageUrlParams });
      }
    } else if (typeof e === 'object' && e.hasOwnProperty('internal')) {
      Catch.report('StandardError | failed to send message', e);
      alert(`Failed to send message: [${(e as StandardError).internal}] ${e.message}`);
    } else if (e instanceof ComposerUserError) {
      alert(`Could not send message: ${e.message}`);
    } else {
      if (!(e instanceof ComposerResetBtnTrigger || e instanceof UnreportableError || e instanceof ComposerNotReadyError)) {
        if (e instanceof Error) {
          Catch.handleException(e);
        } else {
          Catch.report('Thrown object | failed to send message', e);
        }
        alert(`Failed to send message due to: ${e.message}`);
      }
    }
    if (!(e instanceof ComposerNotReadyError)) {
      this.resetSendBtn(100);
    }
  }

  private extractAsText = (elSel: 'input_text' | 'input_intro') => {
    return Xss.htmlUnescape(Xss.htmlSanitizeAndStripAllTags(this.S.cached(elSel)[0].innerHTML, '\n'));
  }

  private extractProcessSendMsg = async () => {
    try {
      const recipients = this.getRecipientsFromDom();
      const subject = this.suppliedSubject || String($('#input_subject').val()); // replies have subject in url params
      const plaintext = this.extractAsText('input_text');
      this.throwIfFormNotReady(recipients);
      this.S.now('send_btn_span').text('Loading');
      Xss.sanitizeRender(this.S.now('send_btn_i'), Ui.spinner('white'));
      this.S.cached('send_btn_note').text('');
      let subscription = await this.app.storageGetSubscription();
      let { armoredPubkeys, emailsWithoutPubkeys } = await this.collectAllAvailablePublicKeys(this.acctEmail, recipients);
      const challenge = emailsWithoutPubkeys.length ? { answer: String(this.S.cached('input_password').val()) } : null;
      this.throwIfFormValsInvalid(recipients, emailsWithoutPubkeys, subject, plaintext, challenge);
      if (this.S.cached('icon_sign').is('.active')) {
        await this.signSend(recipients, armoredPubkeys, subject, plaintext, challenge, subscription);
      } else {
        await this.encryptSend(recipients, armoredPubkeys, subject, plaintext, challenge, subscription);
      }
    } catch (e) {
      this.handleSendErr(e);
    }
  }

  private encryptSend = async (recipients: string[], armoredPubkeys: string[], subject: string, plaintext: string, challenge: Pwd | null, subscription: Subscription) => {
    this.S.now('send_btn_span').text('Encrypting');
    plaintext = await this.addReplyTokenToMsgBodyIfNeeded(recipients, subject, plaintext, challenge, subscription);
    let atts = await this.attach.collectEncryptAtts(armoredPubkeys, challenge);
    if (atts.length && challenge) { // these will be password encrypted attachments
      this.btnUpdateTimeout = Catch.setHandledTimeout(() => this.S.now('send_btn_span').text(this.BTN_SENDING), 500);
      let attAdminCodes = await this.uploadAttsToFc(atts, subscription);
      plaintext = this.addUploadedFileLinksToMsgBody(plaintext, atts);
      await this.doEncryptFormatSend(armoredPubkeys, challenge, plaintext, [], recipients, subject, subscription, attAdminCodes);
    } else {
      await this.doEncryptFormatSend(armoredPubkeys, challenge, plaintext, atts, recipients, subject, subscription);
    }
  }

  private signSend = async (recipients: string[], armoredPubkeys: string[], subject: string, plaintext: string, challenge: Pwd | null, subscription: Subscription) => {
    this.S.now('send_btn_span').text('Signing');
    let [primaryKi] = await Store.keysGet(this.acctEmail, ['primary']);
    if (primaryKi) {
      const prv = openpgp.key.readArmored(primaryKi.private).keys[0];
      let passphrase = await this.app.storagePassphraseGet();
      if (passphrase === null && !prv.isDecrypted()) {
        this.app.sendMsgToMainWin('passphrase_dialog', { type: 'sign', longids: 'primary' });
        if ((await this.whenMasterPassphraseEntered(60)) !== null) { // pass phrase entered
          await this.signSend(recipients, armoredPubkeys, subject, plaintext, challenge, subscription);
        } else { // timeout - reset - no passphrase entered
          clearInterval(this.passphraseInterval);
          this.resetSendBtn();
        }
      } else {
        // Folding the lines or GMAIL WILL RAPE THE TEXT, regardless of what encoding is used
        // https://mathiasbynens.be/notes/gmail-plain-text applies to API as well
        // resulting in.. wait for it.. signatures that don't match
        // if you are reading this and have ideas about better solutions which:
        //  - don't involve text/html ( Enigmail refuses to fix: https://sourceforge.net/p/enigmail/bugs/218/ - Patrick Brunschwig - 2017-02-12 )
        //  - don't require text to be sent as an attachment
        //  - don't require all other clients to support PGP/MIME
        // then please let me know. Eagerly waiting! In the meanwhile..
        plaintext = (window as BrowserWidnow)['emailjs-mime-codec'].foldLines(plaintext, 76, true);

        // Gmail will also remove trailing spaces on the end of each line in transit, causing signatures that don't match
        // Removing them here will prevent Gmail from screwing up the signature
        plaintext = plaintext.split('\n').map(l => l.replace(/\s+$/g, '')).join('\n').trim();

        if (!prv.isDecrypted()) {
          await Pgp.key.decrypt(prv, [passphrase!]); // checked !== null above
        }
        let signedData = await Pgp.msg.sign(prv, this.formatEmailTextFooter({ 'text/plain': plaintext })['text/plain'] || '');
        let atts = await this.attach.collectAtts(); // todo - not signing attachments
        this.app.storageContactUpdate(recipients, { last_use: Date.now() }).catch(Catch.rejection);
        this.S.now('send_btn_span').text(this.BTN_SENDING);
        const body = { 'text/plain': signedData };
        await this.doSendMsg(await Api.common.msg(this.acctEmail, this.suppliedFrom || this.getSenderFromDom(), recipients, subject, body, atts, this.threadId), plaintext);
      }
    } else {
      alert('Cannot sign the message because your plugin is not correctly set up. Email human@flowcrypt.com if this persists.');
      this.resetSendBtn();
    }
  }

  private uploadAttsToFc = async (atts: Att[], subscription: Subscription): Promise<string[]> => {
    try {
      let pfRes: R.FcMsgPresignFiles = await Api.fc.messagePresignFiles(atts, subscription.active ? 'uuid' : null);
      const items: AwsS3UploadItem[] = []; // todo - stop using "any"
      for (let i of pfRes.approvals.keys()) {
        items.push({ baseUrl: pfRes.approvals[i].base_url, fields: pfRes.approvals[i].fields, att: atts[i] });
      }
      await Api.aws.s3Upload(items, this.renderUploadProgress);
      let { admin_codes, confirmed } = await Api.fc.messageConfirmFiles(items.map(item => item.fields.key));
      if (!confirmed || confirmed.length !== items.length) {
        throw new Error('Atts did not upload properly, please try again');
      }
      for (let i of atts.keys()) {
        atts[i].url = pfRes.approvals[i].base_url + pfRes.approvals[i].fields.key;
      }
      return admin_codes;
    } catch (e) {
      if (Api.err.isAuthErr(e)) {
        throw e;
      } else if (Api.err.isNetErr(e)) {
        throw new ComposerNetworkError(e && typeof e === 'object' && e.message ? e.message : 'Some files failed to upload, please try again');
      } else {
        throw e;
      }
    }
  }

  private renderUploadProgress = (progress: number) => {
    if (this.attach.hasAtt()) {
      progress = Math.floor(progress);
      this.S.now('send_btn_span').text(`${this.BTN_SENDING} ${progress < 100 ? `${progress}%` : ''}`);
    }
  }

  private addUploadedFileLinksToMsgBody = (plaintext: string, atts: Att[]) => {
    plaintext += '\n\n';
    for (let att of atts) {
      const sizeMb = att.length / (1024 * 1024);
      const sizeText = sizeMb < 0.1 ? '' : ` ${(Math.round(sizeMb * 10) / 10)}MB`;
      const linkText = `Att: ${att.name} (${att.type})${sizeText}`;
      const fcData = Str.htmlAttrEncode({ size: att.length, type: att.type, name: att.name });
      plaintext += `<a href="${att.url}" class="cryptup_file" cryptup-data="${fcData}">${linkText}</a>\n`;
    }
    return plaintext;
  }

  private addReplyTokenToMsgBodyIfNeeded = async (recipients: string[], subject: string, plaintext: string, challenge: Pwd | null, subscription: Subscription): Promise<string> => {
    if (!challenge || !subscription.active) {
      return plaintext;
    }
    let response;
    try {
      response = await Api.fc.messageToken();
    } catch (msgTokenErr) {
      if (Api.err.isAuthErr(msgTokenErr)) {
        if (confirm('Your FlowCrypt account information is outdated, please review your account settings.')) {
          this.app.sendMsgToMainWin('subscribe_dialog', { source: 'authErr' });
        }
        throw new ComposerResetBtnTrigger();
      } else if (Api.err.isStandardErr(msgTokenErr, 'subscription')) {
        return plaintext;
      } else {
        throw new Error('There was an error sending this message. Please try again. Let me know at human@flowcrypt.com if this happens repeatedly.\n\nmessage/token: ' + msgTokenErr.message);
      }
    }
    return plaintext + '\n\n' + Ui.e('div', {
      'style': 'display: none;', 'class': 'cryptup_reply', 'cryptup-data': Str.htmlAttrEncode({
        sender: this.suppliedFrom || this.getSenderFromDom(),
        recipient: Value.arr.withoutVal(Value.arr.withoutVal(recipients, this.suppliedFrom || this.getSenderFromDom()), this.acctEmail),
        subject,
        token: response.token,
      })
    });
  }

  private encryptMsgAsOfDateIfSomeAreExpired = async (armoredPubkeys: string[]): Promise<Date | undefined> => {
    // todo - disallow in certain situations
    let usableUntil: number[] = [];
    let usableFrom: number[] = [];
    for (let armoredPubkey of armoredPubkeys) {
      let k = openpgp.key.readArmored(armoredPubkey).keys[0];
      let oneSecondBeforeExpiration = await Pgp.key.dateBeforeExpiration(k);
      usableFrom.push(k.getCreationTime().getTime());
      if (oneSecondBeforeExpiration !== null) { // key does expire
        usableUntil.push(oneSecondBeforeExpiration.getTime());
      }
    }
    if (!usableUntil.length) { // none of the keys expire
      return undefined;
    }
    if (Math.max(...usableUntil) > Date.now()) { // all keys either don't expire or expire in the future
      return undefined;
    }
    let usableTimeFrom = Math.max(...usableFrom);
    let usableTimeUntil = Math.min(...usableUntil);
    if (usableTimeFrom > usableTimeUntil) { // used public keys have no intersection of usable dates
      alert('The public key of one of your recipients has been expired for too long.\n\nPlease ask the recipient to send you an updated Public Key.');
      throw new ComposerResetBtnTrigger();
    }
    if (!confirm(Lang.compose.pubkeyExpiredConfirmCompose)) {
      throw new ComposerResetBtnTrigger();
    }
    return new Date(usableTimeUntil); // latest date none of the keys were expired
  }

  private doEncryptFormatSend = async (
    pubkeys: string[], pwd: Pwd | null, plaintext: string, atts: Att[], to: string[], subj: string, subs: Subscription, attAdminCodes: string[] = []
  ) => {
    let encryptAsOfDate = await this.encryptMsgAsOfDateIfSomeAreExpired(pubkeys);
    let encrypted = await Pgp.msg.encrypt(pubkeys, null, pwd, plaintext, undefined, true, encryptAsOfDate) as OpenPGP.EncryptArmorResult;
    let body: SendableMsgBody = { 'text/plain': encrypted.data };
    await this.app.storageContactUpdate(to, { last_use: Date.now() });
    this.S.now('send_btn_span').text(this.BTN_SENDING);
    if (pwd) {
      // this is used when sending encrypted messages to people without encryption plugin, the encrypted data goes through FlowCrypt and recipients get a link
      // admin_code stays locally and helps the sender extend life of the message or delete it
      let { short, admin_code } = await Api.fc.messageUpload(body['text/plain']!, subs.active ? 'uuid' : null);
      let storage = await Store.getAcct(this.acctEmail, ['outgoing_language']);
      body = this.formatPasswordProtectedEmail(short, body, pubkeys, storage.outgoing_language || 'EN');
      body = this.formatEmailTextFooter(body);
      await this.app.storageAddAdminCodes(short, admin_code, attAdminCodes);
      await this.doSendMsg(await Api.common.msg(this.acctEmail, this.suppliedFrom || this.getSenderFromDom(), to, subj, body, atts, this.threadId), plaintext);
    } else {
      body = this.formatEmailTextFooter(body);
      await this.doSendMsg(await Api.common.msg(this.acctEmail, this.suppliedFrom || this.getSenderFromDom(), to, subj, body, atts, this.threadId), plaintext);
    }
  }

  private doSendMsg = async (msg: SendableMsg, plaintext: string) => {
    for (let k of Object.keys(this.additionalMsgHeaders)) {
      msg.headers[k] = this.additionalMsgHeaders[k];
    }
    for (let a of msg.atts) {
      a.type = 'application/octet-stream'; // so that Enigmail+Thunderbird does not attempt to display without decrypting
    }
    if (this.S.cached('icon_pubkey').is('.active')) {
      msg.atts.push(Att.methods.keyinfoAsPubkeyAtt(await this.app.storageGetKey(this.acctEmail)));
    }
    let msgSentRes = await this.app.emailProviderMsgSend(msg, this.renderUploadProgress);
    const isSigned = this.S.cached('icon_sign').is('.active');
    this.app.sendMsgToMainWin('notification_show', { notification: 'Your ' + (isSigned ? 'signed' : 'encrypted') + ' ' + (this.isReplyBox ? 'reply' : 'message') + ' has been sent.' });
    await this.draftDelete();
    if (this.isReplyBox) {
      this.renderReplySuccess(msg, plaintext, msgSentRes.id);
    } else {
      this.app.closeMsg();
    }
  }

  private lookupPubkeyFromDbOrKeyserverAndUpdateDbIfneeded = async (email: string): Promise<Contact | "fail"> => {
    let [dbContact] = await this.app.storageContactGet([email]);
    if (dbContact && dbContact.has_pgp && dbContact.pubkey) {
      return dbContact;
    } else {
      try {
        let { results: [lookupResult] } = await Api.attester.lookupEmail([email]);
        if (lookupResult && lookupResult.email) {
          if (lookupResult.pubkey) {
            const parsed = openpgp.key.readArmored(lookupResult.pubkey);
            if (!parsed.keys[0]) {
              Catch.log('Dropping found but incompatible public key', { for: lookupResult.email, err: parsed.err ? ' * ' + parsed.err.join('\n * ') : null });
              lookupResult.pubkey = null;
            } else if ((await parsed.keys[0].getEncryptionKey()) === null) {
              Catch.log('Dropping found+parsed key because getEncryptionKeyPacket===null', { for: lookupResult.email, fingerprint: Pgp.key.fingerprint(parsed.keys[0]) });
              lookupResult.pubkey = null;
            }
          }
          let ksContact = this.app.storageContactObj(
            lookupResult.email,
            dbContact && dbContact.name ? dbContact.name : undefined,
            lookupResult.has_cryptup ? 'cryptup' : 'pgp',
            lookupResult.pubkey || undefined,
            lookupResult.attested || undefined,
            false,
            Date.now()
          );
          this.ksLookupsByEmail[lookupResult.email] = ksContact;
          await this.app.storageContactSave(ksContact);
          return ksContact;
        } else {
          return this.PUBKEY_LOOKUP_RESULT_FAIL;
        }
      } catch (e) {
        if (!Api.err.isNetErr(e) && !Api.err.isServerErr(e)) {
          Catch.handleException(e);
        }
        return this.PUBKEY_LOOKUP_RESULT_FAIL;
      }
    }
  }

  private evaluateRenderedRecipients = async () => {
    for (let emailEl of $('.recipients span').not('.working, .has_pgp, .no_pgp, .wrong, .attested, .failed, .expired').get()) {
      const email = Str.parseEmail($(emailEl).text()).email;
      if (Str.isEmailValid(email)) {
        this.S.now('send_btn_span').text(this.BTN_LOADING);
        this.setInputTextHeightManuallyIfNeeded();
        let pubkeyLookupRes = await this.lookupPubkeyFromDbOrKeyserverAndUpdateDbIfneeded(email);
        await this.renderPubkeyResult(emailEl, email, pubkeyLookupRes);
      } else {
        await this.renderPubkeyResult(emailEl, email, this.PUBKEY_LOOKUP_RESULT_WRONG);
      }
    }
    this.setInputTextHeightManuallyIfNeeded();
  }

  private getPwdValidationWarning = () => {
    if (!this.S.cached('input_password').val()) {
      return 'No password entered';
    }
  }

  private showMsgPwdUiAndColorBtn = () => {
    this.S.cached('password_or_pubkey').css('display', 'table-row');
    this.S.cached('password_or_pubkey').css('display', 'table-row');
    if (this.S.cached('input_password').val() || this.S.cached('input_password').is(':focus')) {
      this.S.cached('password_label').css('display', 'inline-block');
      this.S.cached('input_password').attr('placeholder', '');
    } else {
      this.S.cached('password_label').css('display', 'none');
      this.S.cached('input_password').attr('placeholder', 'one time password');
    }
    if (this.getPwdValidationWarning()) {
      this.S.cached('send_btn').removeClass('green').addClass('gray');
    } else {
      this.S.cached('send_btn').removeClass('gray').addClass('green');
    }
    if (this.S.cached('input_intro').is(':visible')) {
      this.S.cached('add_intro').css('display', 'none');
    } else {
      this.S.cached('add_intro').css('display', 'block');
    }
    this.setInputTextHeightManuallyIfNeeded();
  }

  /**
   * On Firefox, we have to manage textbox height manually. Only applies to composing new messages
   * (else ff will keep expanding body element beyond frame view)
   * A decade old firefox bug is the culprit: https://bugzilla.mozilla.org/show_bug.cgi?id=202081
   *
   * @param updateRefBodyHeight - set to true to take a new snapshot of intended html body height
   */
  private setInputTextHeightManuallyIfNeeded = (updateRefBodyHeight: boolean = false) => {
    if (!this.isReplyBox && Env.browser().name === 'firefox') {
      let cellHeightExceptText = 0;
      this.S.cached('all_cells_except_text').each(function () {
        let cell = $(this);
        cellHeightExceptText += cell.is(':visible') ? (cell.parent('tr').height() || 0) + 1 : 0; // add a 1px border height for each table row
      });
      if (updateRefBodyHeight || !this.refBodyHeight) {
        this.refBodyHeight = this.S.cached('body').height() || 605;
      }
      this.S.cached('input_text').css('height', this.refBodyHeight - cellHeightExceptText);
    }
  }

  private hideMsgPwdUi = () => {
    this.S.cached('password_or_pubkey').css('display', 'none');
    this.S.cached('input_password').val('');
    this.S.cached('add_intro').css('display', 'none');
    this.S.cached('input_intro').text('');
    this.S.cached('intro_container').css('display', 'none');
    this.setInputTextHeightManuallyIfNeeded();
  }

  private showHidePwdOrPubkeyContainerAndColorSendBtn = () => {
    this.resetSendBtn();
    this.S.cached('send_btn_note').text('');
    this.S.cached('send_btn').removeAttr('title');
    let wasPreviouslyVisible = this.S.cached('password_or_pubkey').css('display') === 'table-row';
    if (!$('.recipients span').length) {
      this.hideMsgPwdUi();
      this.S.cached('send_btn').removeClass('gray').addClass('green');
    } else if (this.S.cached('icon_sign').is('.active')) {
      this.S.cached('send_btn').removeClass('gray').addClass('green');
    } else if ($('.recipients span.no_pgp').length) {
      this.showMsgPwdUiAndColorBtn();
    } else if ($('.recipients span.failed, .recipients span.wrong').length) {
      this.S.now('send_btn_span').text(this.BTN_WRONG_ENTRY);
      this.S.cached('send_btn').attr('title', 'Notice the recipients marked in red: please remove them and try to enter them egain.');
      this.S.cached('send_btn').removeClass('green').addClass('gray');
    } else {
      this.hideMsgPwdUi();
      this.S.cached('send_btn').removeClass('gray').addClass('green');
    }
    if (this.isReplyBox) {
      if (!wasPreviouslyVisible && this.S.cached('password_or_pubkey').css('display') === 'table-row') {
        this.resizeReplyBox((this.S.cached('password_or_pubkey').first().height() || 66) + 20);
      } else {
        this.resizeReplyBox();
      }
    }
    this.setInputTextHeightManuallyIfNeeded();
  }

  private respondToInputHotkeys = (inputToKeydownEvent: KeyboardEvent) => {
    let value = this.S.cached('input_to').val();
    const keys = Env.keyCodes();
    if (!value && inputToKeydownEvent.which === keys.backspace) {
      $('.recipients span').last().remove();
    } else if (value && (inputToKeydownEvent.which === keys.enter || inputToKeydownEvent.which === keys.tab)) {
      this.S.cached('input_to').blur();
      if (this.S.cached('contacts').css('display') === 'block') {
        if (this.S.cached('contacts').find('.select_contact.hover').length) {
          this.S.cached('contacts').find('.select_contact.hover').click();
        } else {
          this.S.cached('contacts').find('.select_contact').first().click();
        }
      }
      this.S.cached('input_to').focus().blur();
      return false;
    }
  }

  resizeReplyBox = (addExtra: number = 0) => {
    if (this.isReplyBox) {
      this.S.cached('input_text').css('max-width', (this.S.cached('body').width()! - 20) + 'px'); // body should always be present
      let minHeight = 0;
      let currentHeight = 0;
      if (this.S.cached('compose_table').is(':visible')) {
        currentHeight = this.S.cached('compose_table').outerHeight() || 0;
        minHeight = 260;
      } else if (this.S.cached('reply_msg_successful').is(':visible')) {
        currentHeight = this.S.cached('reply_msg_successful').outerHeight() || 0;
      } else {
        currentHeight = this.S.cached('prompt').outerHeight() || 0;
      }
      if (currentHeight !== this.lastReplyBoxTableHeight && Math.abs(currentHeight - this.lastReplyBoxTableHeight) > 2) { // more then two pixel difference compared to last time
        this.lastReplyBoxTableHeight = currentHeight;
        this.app.sendMsgToMainWin('set_css', { selector: `iframe#${this.frameId}`, css: { height: `${(Math.max(minHeight, currentHeight) + addExtra)}px` } });
      }
    }
  }

  private appendForwardedMsg = (text: string) => {
    Xss.sanitizeAppend(this.S.cached('input_text'), `<br/><br/>Forwarded message:<br/><br/>&gt; ${text.replace(/(?:\r\n|\r|\n)/g, '&gt; ')}`);
    this.resizeReplyBox();
  }

  private retrieveDecryptAddForwardedMsg = async (msgId: string) => {
    let armoredMsg: string;
    try {
      armoredMsg = await this.app.emailProviderExtractArmoredBlock(msgId);
    } catch (e) {
      if (e.data) {
        Xss.sanitizeAppend(this.S.cached('input_text'), `<br/>\n<br/>\n<br/>\n${Xss.escape(e.data)}`);
      } else if (Api.err.isNetErr(e)) {
        // todo: retry
      } else if (Api.err.isAuthPopupNeeded(e)) {
        this.app.sendMsgToMainWin('notification_show_auth_popup_needed', { acctEmail: this.acctEmail });
      } else {
        Catch.handleException(e);
      }
      return;
    }
    let result = await Pgp.msg.decrypt(this.acctEmail, armoredMsg);
    if (result.success) {
      if (!Mime.resemblesMsg(result.content.text!)) {
        this.appendForwardedMsg(result.content.text!.replace(/\n/g, '<br>'));
      } else {
        let mimeDecoded = await Mime.decode(result.content.text!);
        if (typeof mimeDecoded.text !== 'undefined') {
          this.appendForwardedMsg(mimeDecoded.text.replace(/\n/g, '<br>'));
        } else if (typeof mimeDecoded.html !== 'undefined') {
          this.appendForwardedMsg(Xss.htmlSanitizeAndStripAllTags(mimeDecoded.html!, '<br>'));
        } else {
          this.appendForwardedMsg((result.content.text! || '').replace(/\n/g, '<br>')); // not sure about the replace, time will tell
        }
      }
    } else {
      Xss.sanitizeAppend(this.S.cached('input_text'), `<br/>\n<br/>\n<br/>\n${armoredMsg.replace(/\n/g, '<br/>\n')}`);
    }
  }

  private renderReplyMsgComposeTable = async (method: "forward" | "reply" = "reply") => {
    this.S.cached('prompt').css({ display: 'none' });
    this.S.cached('input_to').val(this.suppliedTo + (this.suppliedTo ? ',' : '')); // the comma causes the last email to be get evaluated
    await this.renderComposeTable();
    if (this.canReadEmails) {
      let determined = await this.app.emailProviderDetermineReplyMsgHeaderVariables();
      if (determined && determined.lastMsgId && determined.headers) {
        this.additionalMsgHeaders['In-Reply-To'] = determined.headers['In-Reply-To'];
        this.additionalMsgHeaders.References = determined.headers.References;
        if (method === 'forward') {
          this.suppliedSubject = 'Fwd: ' + this.suppliedSubject;
          await this.retrieveDecryptAddForwardedMsg(determined.lastMsgId);
        }
      }
    } else {
      Xss.sanitizeRender(this.S.cached('prompt'),
        `${Lang.compose.needReadAccessToReply}<br/><br/><br/>
        <div class="button green auth_settings">${Lang.compose.addMissingPermission}</div><br/><br/>
        Alternatively, <a href="#" class="new_message_button">compose a new secure message</a> to respond.<br/><br/>
      `);
      this.S.cached('prompt').attr('style', 'border:none !important');
      $('.auth_settings').click(() => this.app.sendMsgToBgScript('settings', { acctEmail: this.acctEmail, page: '/chrome/settings/modules/auth_denied.htm' }));
      $('.new_message_button').click(() => this.app.sendMsgToMainWin('open_new_message'));
    }
    this.resizeReplyBox();
    Catch.setHandledTimeout(() => this.app.sendMsgToMainWin('scroll_to_bottom_of_conversation'), 300);
  }

  private parseRenderRecipients = async () => {
    const inputTo = (this.S.cached('input_to').val() as string).toLowerCase();
    if (Value.is(',').in(inputTo)) {
      const emails = inputTo.split(',');
      for (let i = 0; i < emails.length - 1; i++) {
        Xss.sanitizeAppend(this.S.cached('input_to').siblings('.recipients'), `<span>${Xss.escape(emails[i])} ${Ui.spinner('green')}</span>`);
      }
    } else if (!this.S.cached('input_to').is(':focus') && inputTo) {
      Xss.sanitizeAppend(this.S.cached('input_to').siblings('.recipients'), `<span>${Xss.escape(inputTo)} ${Ui.spinner('green')}</span>`);
    } else {
      return;
    }
    this.S.cached('input_to').val('');
    this.resizeInputTo();
    await this.evaluateRenderedRecipients();
    this.setInputTextHeightManuallyIfNeeded();
  }

  private selectContact = (email: string, fromQuery: ProviderContactsQuery) => {
    const possiblyBogusRecipient = $('.recipients span.wrong').last();
    const possiblyBogusAddr = Str.parseEmail(possiblyBogusRecipient.text()).email;
    const q = Str.parseEmail(fromQuery.substring).email;
    if (possiblyBogusAddr === q || Value.is(q).in(possiblyBogusAddr)) {
      possiblyBogusRecipient.remove();
    }
    Catch.setHandledTimeout(async () => {
      if (!Value.is(email).in(this.getRecipientsFromDom())) {
        this.S.cached('input_to').val(Str.parseEmail(email).email);
        await this.parseRenderRecipients();
        this.S.cached('input_to').focus();
      }
    }, Value.int.lousyRandom(20, 100)); // desperate amount to remove duplicates. Better solution advisable.
    this.hideContacts();
  }

  private resizeInputTo = () => { // below both present in template
    this.S.cached('input_to').css('width', (Math.max(150, this.S.cached('input_to').parent().width()! - this.S.cached('input_to').siblings('.recipients').width()! - 50)) + 'px');
  }

  private removeReceiver = (element: HTMLElement) => {
    this.recipientsMissingMyKey = Value.arr.withoutVal(this.recipientsMissingMyKey, $(element).parent().text());
    $(element).parent().remove();
    this.resizeInputTo();
    this.showHidePwdOrPubkeyContainerAndColorSendBtn();
    this.updatePubkeyIcon();
  }

  private authContacts = async (acctEmail: string) => {
    let lastRecipient = $('.recipients span').last();
    this.S.cached('input_to').val(lastRecipient.text());
    lastRecipient.last().remove();
    let authRes = await Api.google.authPopup(acctEmail, this.tabId, false, Api.gmail.scope(['read']));
    if (authRes && authRes.success === true) {
      this.canReadEmails = true;
      await this.searchContacts();
    } else if (authRes && authRes.success === false && authRes.result === 'Denied' && authRes.error === 'access_denied') {
      alert('FlowCrypt needs this permission to search your contacts on Gmail. Without it, FlowCrypt will keep a separate contact list.');
    } else {
      alert(Lang.general.somethingWentWrongTryAgain);
    }
  }

  private renderSearchResultsLoadingDone = () => {
    this.S.cached('contacts').find('ul li.loading').remove();
    if (!this.S.cached('contacts').find('ul li').length) {
      this.hideContacts();
    }
  }

  private renderSearchRes = (contacts: Contact[], query: ProviderContactsQuery) => {
    const renderableContacts = contacts.slice();
    renderableContacts.sort((a, b) => (10 * (b.has_pgp - a.has_pgp)) + ((b.last_use || 0) - (a.last_use || 0) > 0 ? 1 : -1)); // have pgp on top, no pgp bottom. Sort each groups by last used
    renderableContacts.splice(8);
    if (renderableContacts.length > 0 || this.contactSearchInProgress) {
      let ulHtml = '';
      for (let contact of renderableContacts) {
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
      Xss.sanitizeRender(this.S.cached('contacts').find('ul'), ulHtml);
      this.S.cached('contacts').find('ul li.select_contact').click(Ui.event.prevent('double', (target: HTMLElement) => {
        let email = $(target).attr('email');
        if (email) {
          this.selectContact(Str.parseEmail(email).email, query);
        }
      }, this.handleErrs(`select contact`)));
      this.S.cached('contacts').find('ul li.select_contact').hover(function () { $(this).addClass('hover'); }, function () { $(this).removeClass('hover'); });
      this.S.cached('contacts').find('ul li.auth_contacts').click(Ui.event.handle(() => this.authContacts(this.acctEmail), this.handleErrs(`authorize contact search`)));
      this.S.cached('contacts').css({
        display: 'block',
        top: `${$('#compose > tbody > tr:first').height()! + this.S.cached('input_addresses_container_inner').height()! + 10}px`, // both are in the template
      });
    } else {
      this.hideContacts();
    }
  }

  private searchContacts = async (dbOnly = false) => {
    const query = { substring: Str.parseEmail(this.S.cached('input_to').val() as string).email };
    if (query.substring !== '') {
      let contacts = await this.app.storageContactSearch(query);
      if (dbOnly || !this.canReadEmails) {
        this.renderSearchRes(contacts, query);
      } else {
        this.contactSearchInProgress = true;
        this.renderSearchRes(contacts, query);
        this.app.emailEroviderSearchContacts(query.substring, contacts, async searchContactsRes => {
          if (searchContactsRes.new.length) {
            for (let contact of searchContactsRes.new) {
              let [inDb] = await this.app.storageContactGet([contact.email]);
              if (!inDb) {
                await this.app.storageContactSave(this.app.storageContactObj(
                  contact.email,
                  contact.name || undefined,
                  undefined,
                  undefined,
                  undefined,
                  true,
                  contact.date ? new Date(contact.date).getTime() : undefined,
                ));
              } else if (!inDb.name && contact.name) {
                const toUpdate = { name: contact.name };
                await this.app.storageContactUpdate(contact.email, toUpdate);
              }
            }
            await this.searchContacts(true);
          } else {
            this.renderSearchResultsLoadingDone();
            this.contactSearchInProgress = false;
          }
        });
      }
    } else {
      this.hideContacts(); // todo - show suggestions of most contacted ppl etc
    }
  }

  private hideContacts = () => {
    this.S.cached('contacts').css('display', 'none');
  }

  private updatePubkeyIcon = (include: boolean | null = null) => {
    if (include === null) { // decide if pubkey should be included
      if (!this.includePubkeyToggledManually) { // leave it as is if toggled manually before
        this.updatePubkeyIcon(Boolean(this.recipientsMissingMyKey.length) && !Value.is(this.suppliedFrom || this.getSenderFromDom()).in(this.myAddrsOnPks));
      }
    } else { // set icon to specific state
      if (include) {
        this.S.cached('icon_pubkey').addClass('active').attr('title', Lang.compose.includePubkeyIconTitleActive);
      } else {
        this.S.cached('icon_pubkey').removeClass('active').attr('title', Lang.compose.includePubkeyIconTitle);
      }
    }
  }

  updateFooterIcon = (include: boolean | null = null) => {
    if (include === null) { // decide if pubkey should be included
      this.updateFooterIcon(!!this.app.storageEmailFooterGet());
    } else { // set icon to specific state
      if (include) {
        this.S.cached('icon_footer').addClass('active');
      } else {
        this.S.cached('icon_footer').removeClass('active');
      }
    }
  }

  private toggleSignIcon = () => {
    if (!this.S.cached('icon_sign').is('.active')) {
      this.S.cached('icon_sign').addClass('active');
      this.S.cached('compose_table').addClass('sign');
      this.S.cached('title').text(Lang.compose.headerTitleComposeSign);
      this.S.cached('input_password').val('');
    } else {
      this.S.cached('icon_sign').removeClass('active');
      this.S.cached('compose_table').removeClass('sign');
      this.S.cached('title').text(Lang.compose.headerTitleComposeEncrypt);
    }
    if (Value.is(this.S.now('send_btn_span').text()).in([this.BTN_SIGN_AND_SEND, this.BTN_ENCRYPT_AND_SEND])) {
      this.resetSendBtn();
    }
    this.showHidePwdOrPubkeyContainerAndColorSendBtn();
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

  private renderPubkeyResult = async (emailEl: HTMLElement, email: string, contact: Contact | "fail" | "wrong") => {
    if ($('body#new_message').length) {
      if (typeof contact === 'object' && contact.has_pgp) {
        let sendingAddrOnPks = Value.is(this.suppliedFrom || this.getSenderFromDom()).in(this.myAddrsOnPks);
        let sendingAddrOnKeyserver = Value.is(this.suppliedFrom || this.getSenderFromDom()).in(this.myAddrsOnKeyserver);
        if ((contact.client === 'cryptup' && !sendingAddrOnKeyserver) || (contact.client !== 'cryptup' && !sendingAddrOnPks)) {
          // new message, and my key is not uploaded where the recipient would look for it
          if (await this.app.doesRecipientHaveMyPubkey(email) !== true) { // either don't know if they need pubkey (can_read_emails false), or they do need pubkey
            this.recipientsMissingMyKey.push(email);
          }
          this.updatePubkeyIcon();
        } else {
          this.updatePubkeyIcon();
        }
      } else {
        this.updatePubkeyIcon();
      }
    }
    $(emailEl).children('img, i').remove();
    // tslint:disable-next-line:max-line-length
    let contentHtml = '<img src="/img/svgs/close-icon.svg" alt="close" class="close-icon svg" /><img src="/img/svgs/close-icon-black.svg" alt="close" class="close-icon svg display_when_sign" />';
    Xss.sanitizeAppend(emailEl, contentHtml).find('img.close-icon').click(Ui.event.handle(target => this.removeReceiver(target), this.handleErrs('remove recipient')));
    if (contact === this.PUBKEY_LOOKUP_RESULT_FAIL) {
      $(emailEl).attr('title', 'Loading contact information failed, please try to add their email again.');
      $(emailEl).addClass("failed");
      Xss.sanitizeReplace($(emailEl).children('img:visible'), '<img src="/img/svgs/repeat-icon.svg" class="repeat-icon action_retry_pubkey_fetch">');
      $(emailEl).find('.action_retry_pubkey_fetch').click(Ui.event.handle(target => this.removeReceiver(target), this.handleErrs('remove recipient')));
    } else if (contact === this.PUBKEY_LOOKUP_RESULT_WRONG) {
      $(emailEl).attr('title', 'This email address looks misspelled. Please try again.');
      $(emailEl).addClass("wrong");
    } else if (contact.pubkey && await Pgp.key.usableButExpired(openpgp.key.readArmored(contact.pubkey).keys[0])) {
      $(emailEl).addClass("expired");
      Xss.sanitizePrepend(emailEl, '<img src="/img/svgs/expired-timer.svg" class="expired-time">');
      $(emailEl).attr('title', 'Does use encryption but their public key is expired. You should ask them to send you an updated public key.' + this.recipientKeyIdText(contact));
    } else if (contact.pubkey && contact.attested) {
      $(emailEl).addClass("attested");
      Xss.sanitizePrepend(emailEl, '<img src="/img/svgs/locked-icon.svg" />');
      $(emailEl).attr('title', 'Does use encryption, attested by CRYPTUP' + this.recipientKeyIdText(contact));
    } else if (contact.pubkey) {
      $(emailEl).addClass("has_pgp");
      Xss.sanitizePrepend(emailEl, '<img src="/img/svgs/locked-icon.svg" />');
      $(emailEl).attr('title', 'Does use encryption' + this.recipientKeyIdText(contact));
    } else {
      $(emailEl).addClass("no_pgp");
      Xss.sanitizePrepend(emailEl, '<img src="/img/svgs/locked-icon.svg" />');
      $(emailEl).attr('title', 'Could not verify their encryption setup. You can encrypt the message with a password below. Alternatively, add their pubkey.');
    }
    this.showHidePwdOrPubkeyContainerAndColorSendBtn();
  }

  private getRecipientsFromDom = (filter: "no_pgp" | null = null): string[] => {
    let selector;
    if (filter === 'no_pgp') {
      selector = '.recipients span.no_pgp';
    } else {
      selector = '.recipients span';
    }
    const recipients: string[] = [];
    $(selector).each(function () {
      recipients.push($(this).text().trim());
    });
    return recipients;
  }

  private getSenderFromDom = (): string => {
    if (this.S.now('input_from').length) {
      return String(this.S.now('input_from').val());
    } else {
      return this.acctEmail;
    }
  }

  private renderReplySuccess = (msg: SendableMsg, plaintext: string, msgId: string) => {
    let isSigned = this.S.cached('icon_sign').is('.active');
    this.app.renderReinsertReplyBox(msgId, msg.headers.To.split(',').map(a => Str.parseEmail(a).email));
    if (isSigned) {
      this.S.cached('replied_body').addClass('pgp_neutral').removeClass('pgp_secure');
    }
    this.S.cached('replied_body').css('width', ($('table#compose').width() || 500) - 30);
    this.S.cached('compose_table').css('display', 'none');
    this.S.cached('reply_msg_successful').find('div.replied_from').text(this.suppliedFrom);
    this.S.cached('reply_msg_successful').find('div.replied_to span').text(this.suppliedTo);
    Xss.sanitizeRender(this.S.cached('reply_msg_successful').find('div.replied_body'), Xss.escape(plaintext).replace(/\n/g, '<br>'));
    const emailFooter = this.app.storageEmailFooterGet();
    if (emailFooter) {
      const renderableEscapedEmailFooter = Xss.escape(emailFooter).replace(/\n/g, '<br>');
      if (isSigned) {
        Xss.sanitizeAppend(this.S.cached('replied_body'), `<br><br>${renderableEscapedEmailFooter}`);
      } else {
        Xss.sanitizeRender(this.S.cached('reply_msg_successful').find('.email_footer'), `<br> ${renderableEscapedEmailFooter}`);
      }
    }
    let t = new Date();
    let time = ((t.getHours() !== 12) ? (t.getHours() % 12) : 12) + ':' + (t.getMinutes() < 10 ? '0' : '') + t.getMinutes() + ((t.getHours() >= 12) ? ' PM ' : ' AM ') + '(0 minutes ago)';
    this.S.cached('reply_msg_successful').find('div.replied_time').text(time);
    this.S.cached('reply_msg_successful').css('display', 'block');
    if (msg.atts.length) {
      this.S.cached('replied_attachments').html(msg.atts.map(a => { // xss-safe-factory
        a.msgId = msgId;
        return this.app.factoryAtt(a);
      }).join('')).css('display', 'block');
    }
    this.resizeReplyBox();
  }

  private simulateCtrlV = (toPaste: string) => {
    const r = window.getSelection().getRangeAt(0);
    r.insertNode(r.createContextualFragment(toPaste));
  }

  private renderComposeTable = async () => {
    this.S.cached('compose_table').css('display', 'table');
    if (Env.browser().name === 'firefox') { // the padding cause issues in firefox where user cannot click on the message password
      this.S.cached('input_text').css({ 'padding-top': 0, 'padding-bottom': 0 });
    }
    this.S.cached('send_btn').click(Ui.event.prevent('double', () => this.extractProcessSendMsg()));
    this.S.cached('send_btn').keypress(Ui.enter(() => this.extractProcessSendMsg()));
    this.S.cached('input_to').keydown((ke: any) => this.respondToInputHotkeys(ke));
    this.S.cached('input_to').keyup(Ui.event.prevent('veryslowspree', () => this.searchContacts()));
    this.S.cached('input_to').blur(Ui.event.prevent('double', () => this.parseRenderRecipients().catch(Catch.rejection)));
    this.S.cached('input_text').keyup(() => this.S.cached('send_btn_note').text(''));
    this.S.cached('compose_table').click(Ui.event.handle(() => this.hideContacts(), this.handleErrs(`hide contact box`)));
    this.S.cached('input_addresses_container_inner').click(Ui.event.handle(() => {
      if (!this.S.cached('input_to').is(':focus')) {
        this.S.cached('input_to').focus();
      }
    }, this.handleErrs(`focus on recipient field`))).children().click(() => false);
    this.resizeInputTo();
    this.attach.initAttDialog('fineuploader', 'fineuploader_button');
    this.S.cached('input_to').focus();
    if (this.isReplyBox) {
      if (this.suppliedTo) {
        this.S.cached('input_text').focus();
        document.getElementById('input_text')!.focus(); // #input_text is in the template
        // Firefox will not always respond to initial automatic $input_text.blur()
        // Recipients may be left unrendered, as standard text, with a trailing comma
        await this.parseRenderRecipients(); // this will force firefox to render them on load
      }
      Catch.setHandledTimeout(() => { // delay automatic resizing until a second later
        $(window).resize(Ui.event.prevent('veryslowspree', () => this.resizeReplyBox()));
        this.S.cached('input_text').keyup(() => this.resizeReplyBox());
      }, 1000);
    } else {
      $('.close_new_message').click(Ui.event.handle(() => this.app.closeMsg(), this.handleErrs(`close message`)));
      let addresses = this.app.storageGetAddresses() as string[];
      if (addresses.length > 1) {
        let inputAddrContainer = $('#input_addresses_container');
        inputAddrContainer.addClass('show_send_from');
        let cogIcon = `<img id="input_from_settings" src="/img/svgs/settings-icon.svg" data-test="action-open-sending-address-settings" title="Settings">`;
        Xss.sanitizeAppend(inputAddrContainer, `<select id="input_from" tabindex="-1" data-test="input-from"></select>${cogIcon}`);
        inputAddrContainer.find('#input_from_settings').click(Ui.event.handle(() => this.app.renderSendingAddrDialog(), this.handleErrs(`open sending address dialog`)));
        let fmtOpt = (addr: string) => `<option value="${Xss.escape(addr)}">${Xss.escape(addr)}</option>`;
        Xss.sanitizeAppend(inputAddrContainer.find('#input_from'), addresses.map(fmtOpt).join('')).change(() => this.updatePubkeyIcon());
        if (Env.browser().name === 'firefox') {
          inputAddrContainer.find('#input_from_settings').css('margin-top', '20px');
        }
      }
      this.setInputTextHeightManuallyIfNeeded();
    }
  }

  private shouldSaveDraft = (msgBody: string) => {
    if (msgBody && msgBody !== this.lastDraft) {
      this.lastDraft = msgBody;
      return true;
    } else {
      return false;
    }
  }

  private formatPasswordProtectedEmail = (shortId: string, origBody: SendableMsgBody, armoredPubkeys: string[], lang: 'DE' | 'EN') => {
    const msgUrl = `${this.FC_WEB_URL}/${shortId}`;
    const a = `<a href="${Xss.escape(msgUrl)}" style="padding: 2px 6px; background: #2199e8; color: #fff; display: inline-block; text-decoration: none;">${Lang.compose.openMsg[lang]}</a>`;
    const intro = this.S.cached('input_intro').length ? this.extractAsText('input_intro') : '';
    const text = [];
    const html = [];
    if (intro) {
      text.push(intro + '\n');
      html.push(intro.replace(/\n/, '<br>') + '<br><br>');
    }
    text.push(Lang.compose.msgEncryptedText[lang] + msgUrl + '\n');
    html.push('<div class="cryptup_encrypted_message_replaceable">');
    html.push('<div style="opacity: 0;">' + Pgp.armor.headers('null').begin + '</div>');
    html.push(Lang.compose.msgEncryptedHtml[lang] + a + '<br><br>');
    html.push(Lang.compose.alternativelyCopyPaste[lang] + Xss.escape(msgUrl) + '<br><br><br>');
    const htmlFcWebUrlLink = '<a href="' + Xss.escape(this.FC_WEB_URL) + '" style="color: #999;">' + Xss.escape(this.FC_WEB_URL) + '</a>';
    if (armoredPubkeys.length > 1) { // only include the message in email if a pubkey-holding person is receiving it as well
      const htmlPgpMsg = origBody['text/html'] ? origBody['text/html'] : (origBody['text/plain'] || '').replace(this.FC_WEB_URL, htmlFcWebUrlLink).replace(/\n/g, '<br>\n');
      html.push('<div style="color: #999;">' + htmlPgpMsg + '</div>');
      text.push(origBody['text/plain']);
    }
    html.push('</div>');
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

  static defaultAppFunctions = (): ComposerAppFunctionsInterface => {
    return {
      sendMsgToMainWin: (channel: string, data: Dict<Serializable>) => null,
      canReadEmails: () => false,
      doesRecipientHaveMyPubkey: (theirEmail: string): Promise<boolean | undefined> => Promise.resolve(false),
      storageGetAddresses: () => [],
      storageGetAddressesPks: () => [],
      storageGetAddressesKeyserver: () => [],
      storageEmailFooterGet: () => null,
      storageEmailFooterSet: () => Promise.resolve(),
      storageGetHideMsgPassword: () => false,
      storageGetSubscription: () => Promise.resolve(new Subscription(null)),
      storageSetDraftMeta: () => Promise.resolve(),
      storageGetKey: () => { throw new Error('storage_get_key not implemented'); },
      storagePassphraseGet: () => Promise.resolve(null),
      storageAddAdminCodes: (shortId: string, msgAdminCode: string, attAdminCodes: string[]) => Promise.resolve(),
      storageContactGet: (email: string[]) => Promise.resolve([]),
      storageContactUpdate: (email: string[] | string, update: ContactUpdate) => Promise.resolve(),
      storageContactSave: (contact: Contact) => Promise.resolve(),
      storageContactSearch: (query: DbContactFilter) => Promise.resolve([]),
      storageContactObj: Store.dbContactObj,
      emailProviderDraftGet: (draftId: string) => Promise.resolve({ id: null as any as string, message: null as any as R.GmailMsg }),
      emailProviderDraftCreate: (mimeMsg: string) => Promise.reject(null),
      emailProviderDraftUpdate: (draftId: string, mimeMsg: string) => Promise.resolve({}),
      emailProviderDraftDelete: (draftId: string) => Promise.resolve({}),
      emailProviderMsgSend: (msg: SendableMsg, renderUploadProgress: ProgressCb) => Promise.reject({ message: 'not implemented' }),
      emailEroviderSearchContacts: (query: string, knownContacts: Contact[], multiCb: (r: any) => void) => multiCb({ new: [], all: [] }),
      emailProviderDetermineReplyMsgHeaderVariables: () => Promise.resolve(undefined),
      emailProviderExtractArmoredBlock: (msgId) => Promise.resolve(''),
      sendMsgToBgScript: (channel: string, data: Dict<Serializable>) => BrowserMsg.send(null, channel, data),
      renderReinsertReplyBox: (lastMsgId: string, recipients: string[]) => Promise.resolve(),
      renderFooterDialog: () => null,
      renderAddPubkeyDialog: (emails: string[]) => null,
      renderHelpDialog: () => null,
      renderSendingAddrDialog: () => null,
      closeMsg: () => null,
      factoryAtt: (att: Att) => `<div>${att.name}</div>`,
    };
  }

}
