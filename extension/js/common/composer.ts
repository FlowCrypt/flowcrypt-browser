/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch, UnreportableError } from './platform/catch.js';
import { Store, Subscription, ContactUpdate } from './platform/store.js';
import { Lang } from './lang.js';
import { Value, Str } from './core/common.js';
import { Att } from './core/att.js';
import { BrowserMsg, Extension, BrowserWidnow } from './extension.js';
import { Pgp, Pwd, FormatError, Contact, KeyInfo, PgpMsg } from './core/pgp.js';
import { Api, R, ProgressCb, ProviderContactsQuery, PubkeySearchResult, SendableMsg, AwsS3UploadItem, ChunkedCb, AjaxError } from './api/api.js';
import { Ui, Xss, AttUI, BrowserEventErrorHandler, Env } from './browser.js';
import { Mime, SendableMsgBody } from './core/mime.js';
import { GoogleAuth } from './api/google.js';
import { Buf } from './core/buf.js';

const rnd = Str.sloppyRandom();

declare const openpgp: typeof OpenPGP;

interface ComposerAppFunctionsInterface {
  canReadEmails: () => boolean;
  doesRecipientHaveMyPubkey: (email: string) => Promise<boolean | undefined>;
  storageGetAddresses: () => string[];
  storageGetAddressesPks: () => string[];
  storageGetAddressesKeyserver: () => string[];
  storageEmailFooterGet: () => string | undefined;
  storageEmailFooterSet: (footer?: string) => Promise<void>;
  storageGetHideMsgPassword: () => boolean;
  storageGetSubscription: () => Promise<Subscription>;
  storageGetKey: (senderEmail: string) => Promise<KeyInfo>;
  storageSetDraftMeta: (storeIfTrue: boolean, draftId: string, threadId: string, recipients?: string[], subject?: string) => Promise<void>;
  storagePassphraseGet: () => Promise<string | undefined>;
  storageAddAdminCodes: (shortId: string, msgAdminCode: string, attAdminCodes: string[]) => Promise<void>;
  storageContactGet: (email: string[]) => Promise<(Contact | undefined)[]>;
  storageContactUpdate: (email: string | string[], update: ContactUpdate) => Promise<void>;
  storageContactSave: (contact: Contact) => Promise<void>;
  storageContactSearch: (query: ProviderContactsQuery) => Promise<Contact[]>;
  storageContactObj: (email: string, name?: string, client?: string, pubkey?: string, attested?: boolean, pendingLookup?: boolean, lastUse?: number) => Promise<Contact>;
  emailProviderDraftGet: (draftId: string) => Promise<R.GmailDraftGet | undefined>;
  emailProviderDraftCreate: (acctEmail: string, mimeMsg: string, threadId?: string) => Promise<R.GmailDraftCreate>;
  emailProviderDraftUpdate: (draftId: string, mimeMsg: string) => Promise<R.GmailDraftUpdate>;
  emailProviderDraftDelete: (draftId: string) => Promise<R.GmailDraftDelete>;
  emailProviderMsgSend: (msg: SendableMsg, renderUploadProgress: ProgressCb) => Promise<R.GmailMsgSend>;
  emailEroviderSearchContacts: (query: string, knownContacts: Contact[], multiCb: ChunkedCb) => void;
  emailProviderDetermineReplyMsgHeaderVariables: () => Promise<undefined | { lastMsgId: string, headers: { 'In-Reply-To': string, 'References': string } }>;
  emailProviderExtractArmoredBlock: (msgId: string) => Promise<string>;
  renderFooterDialog: () => void;
  renderAddPubkeyDialog: (emails: string[]) => void;
  renderReinsertReplyBox: (lastMsgId: string, recipients: string[]) => void;
  renderHelpDialog: () => void;
  renderSendingAddrDialog: () => void;
  factoryAtt: (att: Att, isEncrypted: boolean) => string;
  closeMsg: () => void;
}

export class ComposerUserError extends Error { }
class ComposerNotReadyError extends ComposerUserError { }
class ComposerResetBtnTrigger extends Error { }
export type ComposerUrlParams = {
  disableDraftSaving: boolean;
  isReplyBox: boolean;
  tabId: string;
  acctEmail: string;
  threadId: string;
  draftId: string;
  subject: string;
  from: string | undefined;
  to: string[];
  frameId: string;
  parentTabId: string;
  skipClickPrompt: boolean;
};

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
  private BTN_READY_TEXTS = [this.BTN_ENCRYPT_AND_SEND, this.BTN_SIGN_AND_SEND];
  private BTN_WRONG_ENTRY = 'Re-enter recipient..';
  private BTN_LOADING = 'Loading..';
  private BTN_SENDING = 'Sending..';
  private FC_WEB_URL = 'https://flowcrypt.com'; // todo - should use Api.url()

  private lastDraft = '';
  private canReadEmails: boolean;
  private lastReplyBoxTableHeight = 0;
  private contactSearchInProgress = false;
  private addedPubkeyDbLookupInterval?: number;
  private saveDraftInterval?: number;
  private currentlySavingDraft = false;
  private passphraseInterval?: number;
  private includePubkeyToggledManually = false;
  private myAddrsOnPks: string[] = [];
  private myAddrsOnKeyserver: string[] = [];
  private recipientsMissingMyKey: string[] = [];
  private ksLookupsByEmail: { [key: string]: PubkeySearchResult | Contact } = {};
  private additionalMsgHeaders: { [key: string]: string } = {};
  private btnUpdateTimeout?: number;
  private refBodyHeight?: number;
  private v: ComposerUrlParams;

  constructor(appFunctions: ComposerAppFunctionsInterface, urlParams: ComposerUrlParams, initSubs: Subscription) {
    this.attach = new AttUI(() => this.getMaxAttSizeAndOversizeNotice());
    this.app = appFunctions;
    this.v = urlParams;
    if (!this.v.disableDraftSaving) {
      this.saveDraftInterval = Catch.setHandledInterval(() => this.draftSave(), this.SAVE_DRAFT_FREQUENCY);
    }
    this.myAddrsOnPks = this.app.storageGetAddressesPks() || [];
    this.myAddrsOnKeyserver = this.app.storageGetAddressesKeyserver() || [];
    this.canReadEmails = this.app.canReadEmails();
    if (initSubs.active) {
      this.updateFooterIcon();
    } else if (this.app.storageEmailFooterGet()) { // footer set but subscription not active - subscription expired
      this.app.storageEmailFooterSet(undefined).catch(Catch.handleErr);
      BrowserMsg.send.notificationShow(this.v.parentTabId, {
        notification: `${Lang.account.fcSubscriptionEndedNoFooter} <a href="#" class="subscribe">renew</a> <a href="#" class="close">close</a>`,
      });
    }
    if (this.app.storageGetHideMsgPassword()) {
      this.S.cached('input_password').attr('type', 'password');
    }
    this.initComposeBox().catch(Catch.handleErr);
    this.initActions();
  }

  private getMaxAttSizeAndOversizeNotice = async () => {
    const subscription = await this.app.storageGetSubscription();
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
              BrowserMsg.send.subscribeDialog(this.v.parentTabId, {});
            }
          }
        },
      };
    } else {
      const allowHugeAtts = ['94658c9c332a11f20b1e45c092e6e98a1e34c953', 'b092dcecf277c9b3502e20c93b9386ec7759443a', '9fbbe6720a6e6c8fc30243dc8ff0a06cbfa4630e'];
      const sizeMb = (subscription.method !== 'trial' && Value.is(await Pgp.hash.sha1UtfStr(this.v.acctEmail)).in(allowHugeAtts)) ? 200 : 25;
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
      authPopup: () => BrowserMsg.send.notificationShowAuthPopupNeeded(this.v.parentTabId, { acctEmail: this.v.acctEmail }),
      auth: () => {
        if (confirm(`Could not ${couldNotDoWhat}.\nYour FlowCrypt account information is outdated, please review your account settings.`)) {
          BrowserMsg.send.subscribeDialog(this.v.parentTabId, { isAuthErr: true });
        }
      },
      other: (e: any) => {
        if (e instanceof Error) {
          e.stack = (e.stack || '') + `\n\n[compose action: ${couldNotDoWhat}]`;
        } else if (typeof e === 'object' && e && typeof (e as any).stack === 'undefined') {
          try {
            (e as any).stack = `[compose action: ${couldNotDoWhat}]`;
          } catch (e) {
            // no need
          }
        }
        Catch.handleErr(e);
        alert(`Could not ${couldNotDoWhat} (unknown error). If this repeats, please contact human@flowcrypt.com.\n\n(${String(e)})`);
      },
    };
  }

  private initActions = () => {
    this.S.cached('icon_pubkey').attr('title', Lang.compose.includePubkeyIconTitle);
    this.S.cached('input_password').keyup(Ui.event.prevent('spree', () => this.showHidePwdOrPubkeyContainerAndColorSendBtn()));
    this.S.cached('input_password').focus(() => this.showHidePwdOrPubkeyContainerAndColorSendBtn());
    this.S.cached('input_password').blur(() => this.showHidePwdOrPubkeyContainerAndColorSendBtn());
    this.S.cached('add_their_pubkey').click(Ui.event.handle(() => {
      const noPgpEmails = this.getRecipientsFromDom('no_pgp');
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
      const clipboardHtmlData = e.clipboardData.getData('text/html');
      if (clipboardHtmlData) {
        e.preventDefault();
        e.stopPropagation();
        const sanitized = Xss.htmlSanitizeAndStripAllTags(clipboardHtmlData, '<br>');
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

  private initComposeBox = async () => {
    if (this.v.isReplyBox) {
      this.S.cached('header').remove();
      this.S.cached('subject').remove();
      this.S.cached('contacts').css('top', '39px');
      this.S.cached('compose_table').css({ 'border-bottom': '1px solid #cfcfcf', 'border-top': '1px solid #cfcfcf' });
      this.S.cached('input_text').css('overflow-y', 'hidden');
    }
    if (this.v.draftId) {
      await this.initialDraftLoad();
    } else {
      if (this.v.isReplyBox) {
        if (this.v.skipClickPrompt) {
          await this.renderReplyMsgComposeTable();
        } else {
          $('#reply_click_area,#a_reply,#a_reply_all,#a_forward').click(Ui.event.handle(async target => {
            if ($(target).attr('id') === 'a_reply') {
              this.v.to = [this.v.to[0]];
            } else if ($(target).attr('id') === 'a_forward') {
              this.v.to = [];
            }
            await this.renderReplyMsgComposeTable((($(target).attr('id') || '').replace('a_', '') || 'reply') as 'reply' | 'forward');
          }, this.handleErrs(`activate repply box`)));
        }
      }
    }
    if (this.v.isReplyBox) {
      if (!this.v.skipClickPrompt && !this.v.draftId) {
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
    if (this.v.isReplyBox) {
      Xss.sanitizeRender(this.S.cached('prompt'), `Loading draft.. ${Ui.spinner('green')}`);
    }
    const abortAndRenderReplyMsgComposeTableIfIsReplyBox = async (reason: string) => {
      console.info(`Google.gmail.initialDraftLoad: ${reason}`);
      if (this.v.isReplyBox) {
        await this.renderReplyMsgComposeTable();
      }
    };
    try {
      const draftGetRes = await this.app.emailProviderDraftGet(this.v.draftId);
      if (!draftGetRes) {
        return abortAndRenderReplyMsgComposeTableIfIsReplyBox('!draftGetRes');
      }
      const parsedMsg = await Mime.decode(Buf.fromBase64UrlStr(draftGetRes.message.raw!));
      const armored = Pgp.armor.clip(parsedMsg.text || Xss.htmlSanitizeAndStripAllTags(parsedMsg.html || '', '\n') || '');
      if (!armored) {
        return abortAndRenderReplyMsgComposeTableIfIsReplyBox('!armored');
      }
      this.S.cached('input_subject').val(String(parsedMsg.headers.subject) || '');
      await this.decryptAndRenderDraft(armored, parsedMsg);
    } catch (e) {
      if (Api.err.isNetErr(e)) {
        Xss.sanitizeRender('body', `Failed to load draft. ${Ui.retryLink()}`);
      } else if (Api.err.isAuthPopupNeeded(e)) {
        BrowserMsg.send.notificationShowAuthPopupNeeded(this.v.parentTabId, { acctEmail: this.v.acctEmail });
        Xss.sanitizeRender('body', `Failed to load draft - FlowCrypt needs to be re-connected to Gmail. ${Ui.retryLink()}`);
      } else if (this.v.isReplyBox && Api.err.isNotFound(e)) {
        Catch.log('about to reload reply_message automatically: get draft 404', this.v.acctEmail);
        await Ui.time.sleep(500);
        await this.app.storageSetDraftMeta(false, this.v.draftId, this.v.threadId);
        console.info('Above red message means that there used to be a draft, but was since deleted. (not an error)');
        window.location.reload();
      } else {
        Catch.handleErr(e);
        return abortAndRenderReplyMsgComposeTableIfIsReplyBox('exception');
      }
    }
  }

  private resetSendBtn = (delay?: number) => {
    const btnText = this.S.cached('icon_sign').is('.active') ? this.BTN_SIGN_AND_SEND : this.BTN_ENCRYPT_AND_SEND;
    const doReset = () => Xss.sanitizeRender(this.S.cached('send_btn'), `<i class=""></i><span tabindex="4">${btnText}</span>`);
    if (typeof this.btnUpdateTimeout !== 'undefined') {
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

  private draftSave = async (forceSave: boolean = false): Promise<void> => {
    if (this.shouldSaveDraft(this.S.cached('input_text').text()) || forceSave) {
      this.currentlySavingDraft = true;
      try {
        this.S.cached('send_btn_note').text('Saving');
        const primaryKi = await this.app.storageGetKey(this.v.acctEmail);
        const encrypted = await PgpMsg.encrypt({ pubkeys: [primaryKi.public], data: Buf.fromUtfStr(this.extractAsText('input_text')), armor: true }) as OpenPGP.EncryptArmorResult;
        let body: string;
        if (this.v.threadId) { // reply draft
          body = `[cryptup:link:draft_reply:${this.v.threadId}]\n\n${encrypted.data}`;
        } else if (this.v.draftId) { // new message compose draft with known draftid
          body = `[cryptup:link:draft_compose:${this.v.draftId}]\n\n${encrypted.data}`;
        } else { // new message compose draft where draftId is not yet known
          body = encrypted.data;
        }
        const subject = String(this.S.cached('input_subject').val() || this.v.subject || 'FlowCrypt draft');
        const to = this.getRecipientsFromDom().filter(Str.isEmailValid); // else google complains https://github.com/FlowCrypt/flowcrypt-browser/issues/1370
        const mimeMsg = await Mime.encode(body, { To: to, From: this.getSender(), Subject: subject }, []);
        if (!this.v.draftId) {
          const { id } = await this.app.emailProviderDraftCreate(this.v.acctEmail, mimeMsg, this.v.threadId);
          this.S.cached('send_btn_note').text('Saved');
          this.v.draftId = id;
          await this.app.storageSetDraftMeta(true, id, this.v.threadId, to, String(this.S.cached('input_subject').val()));
          // recursing one more time, because we need the draft_id we get from this reply in the message itself
          // essentially everytime we save draft for the first time, we have to save it twice
          // currentlySavingDraft will remain true for now
          await this.draftSave(true); // forceSave = true
        } else {
          await this.app.emailProviderDraftUpdate(this.v.draftId, mimeMsg);
          this.S.cached('send_btn_note').text('Saved');
        }
      } catch (e) {
        if (Api.err.isNetErr(e)) {
          this.S.cached('send_btn_note').text('Not saved (network)');
        } else if (Api.err.isAuthPopupNeeded(e)) {
          BrowserMsg.send.notificationShowAuthPopupNeeded(this.v.parentTabId, { acctEmail: this.v.acctEmail });
          this.S.cached('send_btn_note').text('Not saved (reconnect)');
        } else if (e instanceof Error && e.message.indexOf('Could not find valid key packet for encryption in key') !== -1) {
          this.S.cached('send_btn_note').text('Not saved (bad key)');
        } else if (this.v.draftId && (Api.err.isNotFound(e) || (e instanceof AjaxError && e.status === 400 && e.responseText.indexOf('Message not a draft') !== -1))) {
          // not found - updating draft that was since deleted
          // not a draft - updating draft that was since sent as a message (in another window), and is not a draft anymore
          this.v.draftId = ''; // forget there was a draftId - next step will create a new draftId
          await this.draftSave(true); // forceSave=true to not skip
        } else if (!this.v.draftId && Api.err.isNotFound(e)) {
          // not found - creating draft on a thread that does not exist
          this.v.threadId = ''; // forget there was a threadId
          await this.draftSave(true); // forceSave=true to not skip
        } else {
          Catch.handleErr(e);
          this.S.cached('send_btn_note').text('Not saved (error)');
        }
      }
      this.currentlySavingDraft = false;
    }
  }

  private draftDelete = async () => {
    clearInterval(this.saveDraftInterval);
    await Ui.time.wait(() => !this.currentlySavingDraft ? true : undefined);
    if (this.v.draftId) {
      await this.app.storageSetDraftMeta(false, this.v.draftId, this.v.threadId);
      try {
        await this.app.emailProviderDraftDelete(this.v.draftId);
      } catch (e) {
        if (Api.err.isAuthPopupNeeded(e)) {
          BrowserMsg.send.notificationShowAuthPopupNeeded(this.v.parentTabId, { acctEmail: this.v.acctEmail });
        } else if (!Api.err.isNetErr(e)) {
          Catch.handleErr(e);
        }
      }
    }
  }

  private decryptAndRenderDraft = async (encryptedArmoredDraft: string, headers: { from?: string; to: string[] }) => {
    const passphrase = await this.app.storagePassphraseGet();
    if (typeof passphrase !== 'undefined') {
      const result = await PgpMsg.decrypt({ kisWithPp: await Store.keysGetAllWithPassphrases(this.v.acctEmail), encryptedData: Buf.fromUtfStr(encryptedArmoredDraft) });
      if (result.success) {
        this.S.cached('prompt').css({ display: 'none' });
        Xss.sanitizeRender(this.S.cached('input_text'), await Xss.htmlSanitizeKeepBasicTags(result.content.toUtfStr().replace(/\n/g, '<br>')));
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
      if (this.v.isReplyBox) {
        await this.renderReplyMsgComposeTable();
      }
    } else {
      const promptText = `Waiting for <a href="#" class="action_open_passphrase_dialog">pass phrase</a> to open draft..`;
      if (this.v.isReplyBox) {
        Xss.sanitizeRender(this.S.cached('prompt'), promptText).css({ display: 'block' });
        this.resizeReplyBox();
      } else {
        Xss.sanitizeRender(this.S.cached('prompt'), `${promptText}<br><br><a href="#" class="action_close">close</a>`).css({ display: 'block', height: '100%' });
      }
      this.S.cached('prompt').find('a.action_open_passphrase_dialog').click(Ui.event.handle(() => {
        BrowserMsg.send.passphraseDialog(this.v.parentTabId, { type: 'draft', longids: ['primary'] });
      }));
      this.S.cached('prompt').find('a.action_close').click(Ui.event.handle(() => this.app.closeMsg()));
      await this.whenMasterPassphraseEntered();
      await this.decryptAndRenderDraft(encryptedArmoredDraft, headers);
    }
  }

  private whenMasterPassphraseEntered = (secondsTimeout?: number): Promise<string | undefined> => {
    return new Promise(resolve => {
      clearInterval(this.passphraseInterval);
      const timeoutAt = secondsTimeout ? Date.now() + secondsTimeout * 1000 : undefined;
      this.passphraseInterval = Catch.setHandledInterval(async () => {
        const passphrase = await this.app.storagePassphraseGet();
        if (typeof passphrase !== 'undefined') {
          clearInterval(this.passphraseInterval);
          resolve(passphrase);
        } else if (timeoutAt && Date.now() > timeoutAt) {
          clearInterval(this.passphraseInterval);
          resolve(undefined);
        }
      }, 1000);
    });
  }

  private collectAllAvailablePublicKeys = async (acctEmail: string, recipients: string[]): Promise<{ armoredPubkeys: string[], emailsWithoutPubkeys: string[] }> => {
    const contacts = await this.app.storageContactGet(recipients);
    const { public: armoredPublicKey } = await this.app.storageGetKey(acctEmail);
    const armoredPubkeys = [armoredPublicKey];
    const emailsWithoutPubkeys = [];
    for (const i of contacts.keys()) {
      const contact = contacts[i];
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
    if (Value.is(this.S.now('send_btn_span').text().trim()).in(this.BTN_READY_TEXTS) && recipients && recipients.length) {
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

  private throwIfFormValsInvalid = (recipients: string[], emailsWithoutPubkeys: string[], subject: string, plaintext: string, challenge?: Pwd) => {
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

  private handleSendErr(e: any) {
    if (Api.err.isNetErr(e)) {
      alert('Could not send message due to network error. Please check your internet connection and try again.');
    } else if (Api.err.isAuthPopupNeeded(e)) {
      BrowserMsg.send.notificationShowAuthPopupNeeded(this.v.parentTabId, { acctEmail: this.v.acctEmail });
      alert('Could not send message because FlowCrypt needs to be re-connected to google account.');
    } else if (Api.err.isAuthErr(e)) {
      if (confirm('Your FlowCrypt account information is outdated, please review your account settings.')) {
        BrowserMsg.send.subscribeDialog(this.v.parentTabId, { isAuthErr: true });
      }
    } else if (Api.err.isReqTooLarge(e)) {
      alert(`Could not send: message or attachments too large.`);
    } else if (Api.err.isBadReq(e)) {
      const errMsg = e.parseErrResMsg('google');
      if (errMsg === e.STD_ERR_MSGS.GOOGLE_INVALID_TO_HEADER || errMsg === e.STD_ERR_MSGS.GOOGLE_RECIPIENT_ADDRESS_REQUIRED) {
        alert('Error from google: Invalid recipients\n\nPlease remove recipients, add them back and re-send the message.');
      } else {
        if (confirm(`Google returned an error when sending message. Please help us improve FlowCrypt by reporting the error to us.`)) {
          const page = '/chrome/settings/modules/help.htm';
          const pageUrlParams = { bugReport: Extension.prepareBugReport(`composer: send: bad request (errMsg: ${errMsg})`, {}, e) };
          BrowserMsg.send.bg.settings({ acctEmail: this.v.acctEmail, page, pageUrlParams });
        }
      }
    } else if (e instanceof ComposerUserError) {
      alert(`Could not send message: ${String(e)}`);
    } else {
      if (!(e instanceof ComposerResetBtnTrigger || e instanceof UnreportableError || e instanceof ComposerNotReadyError)) {
        Catch.handleErr(e);
        alert(`Failed to send message due to: ${String(e)}`);
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
      const subject = this.v.subject || String($('#input_subject').val()); // replies have subject in url params
      const plaintext = this.extractAsText('input_text');
      this.throwIfFormNotReady(recipients);
      this.S.now('send_btn_span').text('Loading');
      Xss.sanitizeRender(this.S.now('send_btn_i'), Ui.spinner('white'));
      this.S.cached('send_btn_note').text('');
      const subscription = await this.app.storageGetSubscription();
      const { armoredPubkeys, emailsWithoutPubkeys } = await this.collectAllAvailablePublicKeys(this.v.acctEmail, recipients);
      const pwd = emailsWithoutPubkeys.length ? { answer: String(this.S.cached('input_password').val()) } : undefined;
      this.throwIfFormValsInvalid(recipients, emailsWithoutPubkeys, subject, plaintext, pwd);
      if (this.S.cached('icon_sign').is('.active')) {
        await this.signSend(recipients, armoredPubkeys, subject, plaintext, pwd, subscription);
      } else {
        await this.encryptSend(recipients, armoredPubkeys, subject, plaintext, pwd, subscription);
      }
    } catch (e) {
      this.handleSendErr(e);
    }
  }

  private encryptSend = async (recipients: string[], armoredPubkeys: string[], subject: string, plaintext: string, pwd: Pwd | undefined, subscription: Subscription) => {
    this.S.now('send_btn_span').text('Encrypting');
    plaintext = await this.addReplyTokenToMsgBodyIfNeeded(recipients, subject, plaintext, pwd, subscription);
    const atts = await this.attach.collectEncryptAtts(armoredPubkeys, pwd);
    if (atts.length && pwd) { // these will be password encrypted attachments
      this.btnUpdateTimeout = Catch.setHandledTimeout(() => this.S.now('send_btn_span').text(this.BTN_SENDING), 500);
      const attAdminCodes = await this.uploadAttsToFc(atts, subscription);
      plaintext = this.addUploadedFileLinksToMsgBody(plaintext, atts);
      await this.doEncryptFmtSend(armoredPubkeys, pwd, plaintext, [], recipients, subject, subscription, attAdminCodes);
    } else {
      await this.doEncryptFmtSend(armoredPubkeys, pwd, plaintext, atts, recipients, subject, subscription);
    }
  }

  private signSend = async (recipients: string[], armoredPubkeys: string[], subject: string, plaintext: string, pwd: Pwd | undefined, subscription: Subscription) => {
    this.S.now('send_btn_span').text('Signing');
    const [primaryKi] = await Store.keysGet(this.v.acctEmail, ['primary']);
    if (primaryKi) {
      const { keys: [prv] } = await openpgp.key.readArmored(primaryKi.private);
      const passphrase = await this.app.storagePassphraseGet();
      if (typeof passphrase === 'undefined' && !prv.isDecrypted()) {
        BrowserMsg.send.passphraseDialog(this.v.parentTabId, { type: 'sign', longids: ['primary'] });
        if ((typeof await this.whenMasterPassphraseEntered(60)) !== 'undefined') { // pass phrase entered
          await this.signSend(recipients, armoredPubkeys, subject, plaintext, pwd, subscription);
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
        // then please const me know. Eagerly waiting! In the meanwhile..
        plaintext = (window as BrowserWidnow)['emailjs-mime-codec'].foldLines(plaintext, 76, true); // tslint:disable-line:no-unsafe-any

        // Gmail will also remove trailing spaces on the end of each line in transit, causing signatures that don't match
        // Removing them here will prevent Gmail from screwing up the signature
        plaintext = plaintext.split('\n').map(l => l.replace(/\s+$/g, '')).join('\n').trim();

        if (!prv.isDecrypted()) {
          await Pgp.key.decrypt(prv, [passphrase!]); // checked !== undefined above
        }
        const signedData = await PgpMsg.sign(prv, this.formatEmailTextFooter({ 'text/plain': plaintext })['text/plain'] || '');
        const atts = await this.attach.collectAtts(); // todo - not signing attachments
        this.app.storageContactUpdate(recipients, { last_use: Date.now() }).catch(Catch.handleErr);
        this.S.now('send_btn_span').text(this.BTN_SENDING);
        const body = { 'text/plain': signedData };
        await this.doSendMsg(await Api.common.msg(this.v.acctEmail, this.getSender(), recipients, subject, body, atts, this.v.threadId), plaintext);
      }
    } else {
      alert('Cannot sign the message because your plugin is not correctly set up. Email human@flowcrypt.com if this persists.');
      this.resetSendBtn();
    }
  }

  private uploadAttsToFc = async (atts: Att[], subscription: Subscription): Promise<string[]> => {
    const pfRes: R.FcMsgPresignFiles = await Api.fc.messagePresignFiles(atts, subscription.active ? 'uuid' : undefined);
    const items: AwsS3UploadItem[] = [];
    for (const i of pfRes.approvals.keys()) {
      items.push({ baseUrl: pfRes.approvals[i].base_url, fields: pfRes.approvals[i].fields, att: atts[i] });
    }
    await Api.aws.s3Upload(items, this.renderUploadProgress);
    const { admin_codes, confirmed } = await Api.fc.messageConfirmFiles(items.map(item => item.fields.key));
    if (!confirmed || confirmed.length !== items.length) {
      throw new Error('Attachments did not upload properly, please try again');
    }
    for (const i of atts.keys()) {
      atts[i].url = pfRes.approvals[i].base_url + pfRes.approvals[i].fields.key;
    }
    return admin_codes;
  }

  private renderUploadProgress = (progress: number) => {
    if (this.attach.hasAtt()) {
      progress = Math.floor(progress);
      this.S.now('send_btn_span').text(`${this.BTN_SENDING} ${progress < 100 ? `${progress}%` : ''}`);
    }
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

  private addReplyTokenToMsgBodyIfNeeded = async (recipients: string[], subject: string, plaintext: string, challenge: Pwd | undefined, subscription: Subscription): Promise<string> => {
    if (!challenge || !subscription.active) {
      return plaintext;
    }
    let response;
    try {
      response = await Api.fc.messageToken();
    } catch (msgTokenErr) {
      if (Api.err.isAuthErr(msgTokenErr)) {
        if (confirm('Your FlowCrypt account information is outdated, please review your account settings.')) {
          BrowserMsg.send.subscribeDialog(this.v.parentTabId, { isAuthErr: true });
        }
        throw new ComposerResetBtnTrigger();
      } else if (Api.err.isStandardErr(msgTokenErr, 'subscription')) {
        return plaintext;
      } else {
        throw Catch.rewrapErr(msgTokenErr, 'There was a token error sending this message. Please try again. Let me know at human@flowcrypt.com if this happens repeatedly.');
      }
    }
    return plaintext + '\n\n' + Ui.e('div', {
      'style': 'display: none;', 'class': 'cryptup_reply', 'cryptup-data': Str.htmlAttrEncode({
        sender: this.getSender(),
        recipient: Value.arr.withoutVal(Value.arr.withoutVal(recipients, this.getSender()), this.v.acctEmail),
        subject,
        token: response.token,
      })
    });
  }

  private encryptMsgAsOfDateIfSomeAreExpired = async (armoredPubkeys: string[]): Promise<Date | undefined> => {
    // todo - disallow in certain situations
    const usableUntil: number[] = [];
    const usableFrom: number[] = [];
    for (const armoredPubkey of armoredPubkeys) {
      const { keys: [pub] } = await openpgp.key.readArmored(armoredPubkey);
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
    const usableTimeFrom = Math.max(...usableFrom);
    const usableTimeUntil = Math.min(...usableUntil);
    if (usableTimeFrom > usableTimeUntil) { // used public keys have no intersection of usable dates
      alert('The public key of one of your recipients has been expired for too long.\n\nPlease ask the recipient to send you an updated Public Key.');
      throw new ComposerResetBtnTrigger();
    }
    if (!confirm(Lang.compose.pubkeyExpiredConfirmCompose)) {
      throw new ComposerResetBtnTrigger();
    }
    return new Date(usableTimeUntil); // latest date none of the keys were expired
  }

  private doEncryptFmtSend = async (pubkeys: string[], pwd: Pwd | undefined, text: string, atts: Att[], to: string[], subj: string, subs: Subscription, attAdminCodes: string[] = []) => {
    const encryptAsOfDate = await this.encryptMsgAsOfDateIfSomeAreExpired(pubkeys);
    const encrypted = await PgpMsg.encrypt({ pubkeys, pwd, data: Buf.fromUtfStr(text), armor: true, date: encryptAsOfDate }) as OpenPGP.EncryptArmorResult;
    let encryptedBody: SendableMsgBody = { 'text/plain': encrypted.data };
    await this.app.storageContactUpdate(to, { last_use: Date.now() });
    this.S.now('send_btn_span').text(this.BTN_SENDING);
    if (pwd) {
      // this is used when sending encrypted messages to people without encryption plugin, the encrypted data goes through FlowCrypt and recipients get a link
      // admin_code stays locally and helps the sender extend life of the message or delete it
      const { short, admin_code } = await Api.fc.messageUpload(encryptedBody['text/plain']!, subs.active ? 'uuid' : undefined);
      const storage = await Store.getAcct(this.v.acctEmail, ['outgoing_language']);
      encryptedBody = this.fmtPwdProtectedEmail(short, encryptedBody, pubkeys, atts, storage.outgoing_language || 'EN');
      encryptedBody = this.formatEmailTextFooter(encryptedBody);
      await this.app.storageAddAdminCodes(short, admin_code, attAdminCodes);
      await this.doSendMsg(await Api.common.msg(this.v.acctEmail, this.getSender(), to, subj, encryptedBody, atts, this.v.threadId), text);
    } else {
      encryptedBody = this.formatEmailTextFooter(encryptedBody);
      await this.doSendMsg(await Api.common.msg(this.v.acctEmail, this.getSender(), to, subj, encryptedBody, atts, this.v.threadId), text);
    }
  }

  private doSendMsg = async (msg: SendableMsg, plaintext: string) => {
    for (const k of Object.keys(this.additionalMsgHeaders)) {
      msg.headers[k] = this.additionalMsgHeaders[k];
    }
    for (const a of msg.atts) {
      a.type = 'application/octet-stream'; // so that Enigmail+Thunderbird does not attempt to display without decrypting
    }
    if (this.S.cached('icon_pubkey').is('.active')) {
      msg.atts.push(Att.keyinfoAsPubkeyAtt(await this.app.storageGetKey(this.v.acctEmail)));
    }
    let msgSentRes: R.GmailMsgSend;
    try {
      msgSentRes = await this.app.emailProviderMsgSend(msg, this.renderUploadProgress);
    } catch (e) {
      if (msg.thread && Api.err.isNotFound(e) && this.v.threadId) { // cannot send msg because threadId not found - eg user since deleted it
        msg.thread = undefined;
        msgSentRes = await this.app.emailProviderMsgSend(msg, this.renderUploadProgress);
      } else {
        throw e;
      }
    }
    const isSigned = this.S.cached('icon_sign').is('.active');
    BrowserMsg.send.notificationShow(this.v.parentTabId, { notification: `Your ${isSigned ? 'signed' : 'encrypted'} ${this.v.isReplyBox ? 'reply' : 'message'} has been sent.` });
    await this.draftDelete();
    if (this.v.isReplyBox) {
      this.renderReplySuccess(msg, plaintext, msgSentRes.id);
    } else {
      this.app.closeMsg();
    }
  }

  private lookupPubkeyFromDbOrKeyserverAndUpdateDbIfneeded = async (email: string): Promise<Contact | "fail"> => {
    console.log(`[${rnd}] lookupPubkeyFromDbOrKeyserverAndUpdateDbIfneeded.0`);
    const [dbContact] = await this.app.storageContactGet([email]);
    if (dbContact && dbContact.has_pgp && dbContact.pubkey) {
      return dbContact;
    } else {
      try {
        console.log(`[${rnd}] lookupPubkeyFromDbOrKeyserverAndUpdateDbIfneeded.1`);
        const { results: [lookupResult] } = await Api.attester.lookupEmail([email]);
        console.log(`[${rnd}] lookupPubkeyFromDbOrKeyserverAndUpdateDbIfneeded.2`);
        if (lookupResult && lookupResult.email) {
          if (lookupResult.pubkey) {
            const parsed = await openpgp.key.readArmored(lookupResult.pubkey);
            if (!parsed.keys[0]) {
              Catch.log('Dropping found but incompatible public key', { for: lookupResult.email, err: parsed.err ? ' * ' + parsed.err.join('\n * ') : undefined });
              lookupResult.pubkey = null; // tslint:disable-line:no-null-keyword
            } else if (! await parsed.keys[0].getEncryptionKey()) {
              Catch.log('Dropping found+parsed key because getEncryptionKeyPacket===null', { for: lookupResult.email, fingerprint: await Pgp.key.fingerprint(parsed.keys[0]) });
              lookupResult.pubkey = null; // tslint:disable-line:no-null-keyword
            }
          }
          const ksContact = await this.app.storageContactObj(
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
          Catch.handleErr(e);
        }
        return this.PUBKEY_LOOKUP_RESULT_FAIL;
      }
    }
  }

  private evaluateRenderedRecipients = async () => {
    console.log(`[${rnd}] evaluateRenderedRecipients`);
    for (const emailEl of $('.recipients span').not('.working, .has_pgp, .no_pgp, .wrong, .attested, .failed, .expired').get()) {
      console.log(`[${rnd}] evaluateRenderedRecipients.emailEl(${String(emailEl)})`);
      const email = Str.parseEmail($(emailEl).text()).email;
      console.log(`[${rnd}] evaluateRenderedRecipients.email(${email})`);
      if (Str.isEmailValid(email)) {
        this.S.now('send_btn_span').text(this.BTN_LOADING);
        this.setInputTextHeightManuallyIfNeeded();
        const pubkeyLookupRes = await this.lookupPubkeyFromDbOrKeyserverAndUpdateDbIfneeded(email);
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
    return;
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
    if (!this.v.isReplyBox && Catch.browser().name === 'firefox') {
      let cellHeightExceptText = 0;
      this.S.cached('all_cells_except_text').each(function () {
        const cell = $(this);
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
    const wasPreviouslyVisible = this.S.cached('password_or_pubkey').css('display') === 'table-row';
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
    if (this.v.isReplyBox) {
      if (!wasPreviouslyVisible && this.S.cached('password_or_pubkey').css('display') === 'table-row') {
        this.resizeReplyBox((this.S.cached('password_or_pubkey').first().height() || 66) + 20);
      } else {
        this.resizeReplyBox();
      }
    }
    this.setInputTextHeightManuallyIfNeeded();
  }

  private respondToInputHotkeys = (inputToKeydownEvent: JQuery.Event<HTMLElement, null>) => {
    console.log(`[${rnd}] respondToInputHotkeys`);
    const value = this.S.cached('input_to').val();
    console.log(`[${rnd}] respondToInputHotkeys.value(${value})`);
    const keys = Env.keyCodes();
    if (!value && inputToKeydownEvent.which === keys.backspace) {
      console.log(`[${rnd}] respondToInputHotkeys.value:del`);
      $('.recipients span').last().remove();
      this.showHidePwdOrPubkeyContainerAndColorSendBtn();
    } else if (value && (inputToKeydownEvent.which === keys.enter || inputToKeydownEvent.which === keys.tab)) {
      console.log(`[${rnd}] respondToInputHotkeys.value:enter|tab`);
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
    console.log(`[${rnd}] respondToInputHotkeys.value:none`);
    return;
  }

  resizeReplyBox = (addExtra: number = 0) => {
    if (this.v.isReplyBox) {
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
        BrowserMsg.send.setCss(this.v.parentTabId, { selector: `iframe#${this.v.frameId}`, css: { height: `${(Math.max(minHeight, currentHeight) + addExtra)}px` } });
      }
    }
  }

  private appendForwardedMsg = (textBytes: Buf) => {
    Xss.sanitizeAppend(this.S.cached('input_text'), `<br/><br/>Forwarded message:<br/><br/>&gt; ${textBytes.toUtfStr().replace(/\n/g, '<br>').replace(/(?:\r\n|\r|\n)/g, '&gt; ')}`);
    this.resizeReplyBox();
  }

  private retrieveDecryptAddForwardedMsg = async (msgId: string) => {
    let armoredMsg: string;
    try {
      armoredMsg = await this.app.emailProviderExtractArmoredBlock(msgId);
    } catch (e) {
      if (e instanceof FormatError) {
        Xss.sanitizeAppend(this.S.cached('input_text'), `<br/>\n<br/>\n<br/>\n${Xss.escape(e.data)}`);
      } else if (Api.err.isNetErr(e)) {
        // todo: retry
      } else if (Api.err.isAuthPopupNeeded(e)) {
        BrowserMsg.send.notificationShowAuthPopupNeeded(this.v.parentTabId, { acctEmail: this.v.acctEmail });
      } else {
        Catch.handleErr(e);
      }
      return;
    }
    const result = await PgpMsg.decrypt({ kisWithPp: await Store.keysGetAllWithPassphrases(this.v.acctEmail), encryptedData: Buf.fromUtfStr(armoredMsg) });
    if (result.success) {
      if (!Mime.resemblesMsg(result.content)) {
        this.appendForwardedMsg(result.content);
      } else {
        const mimeDecoded = await Mime.decode(result.content);
        if (typeof mimeDecoded.text !== 'undefined') {
          this.appendForwardedMsg(result.content);
        } else if (typeof mimeDecoded.html !== 'undefined') {
          this.appendForwardedMsg(Buf.fromUtfStr(Xss.htmlSanitizeAndStripAllTags(mimeDecoded.html!, '\n')));
        } else {
          this.appendForwardedMsg(result.content);
        }
      }
    } else {
      Xss.sanitizeAppend(this.S.cached('input_text'), `<br/>\n<br/>\n<br/>\n${armoredMsg.replace(/\n/g, '<br/>\n')}`);
    }
  }

  private renderReplyMsgComposeTable = async (method: "forward" | "reply" = "reply") => {
    this.S.cached('prompt').css({ display: 'none' });
    this.S.cached('input_to').val(this.v.to.join(',') + (this.v.to.length ? ',' : '')); // the comma causes the last email to be get evaluated
    await this.renderComposeTable();
    if (this.canReadEmails) {
      const determined = await this.app.emailProviderDetermineReplyMsgHeaderVariables();
      if (determined && determined.lastMsgId && determined.headers) {
        this.additionalMsgHeaders['In-Reply-To'] = determined.headers['In-Reply-To'];
        this.additionalMsgHeaders.References = determined.headers.References;
        if (method === 'forward') {
          this.v.subject = 'Fwd: ' + this.v.subject;
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
      $('.auth_settings').click(() => BrowserMsg.send.bg.settings({ acctEmail: this.v.acctEmail, page: '/chrome/settings/modules/auth_denied.htm' }));
      $('.new_message_button').click(() => BrowserMsg.send.openNewMessage(this.v.parentTabId));
    }
    this.resizeReplyBox();
    Catch.setHandledTimeout(() => BrowserMsg.send.scrollToBottomOfConversation(this.v.parentTabId), 300);
  }

  private parseRenderRecipients = async () => {
    console.log(`[${rnd}] parseRenderRecipients`);
    const inputTo = String(this.S.cached('input_to').val()).toLowerCase();
    console.log(`[${rnd}] parseRenderRecipients.inputTo(${String(inputTo)})`);
    if (Value.is(',').in(inputTo) || (!this.S.cached('input_to').is(':focus') && inputTo)) {
      console.log(`[${rnd}] parseRenderRecipients.2`);
      for (const rawRecipientAddrInput of inputTo.split(',')) {
        console.log(`[${rnd}] parseRenderRecipients.3`);
        if (!rawRecipientAddrInput) {
          console.log(`[${rnd}] parseRenderRecipients.4`);
          continue; // users or scripts may append `,` to trigger evaluation - causes last entry to be "empty" - should be skipped
        }
        console.log(`[${rnd}] parseRenderRecipients.5`);
        const { email } = Str.parseEmail(rawRecipientAddrInput); // raw may be `Human at Flowcrypt <Human@FlowCrypt.com>` but we only want `human@flowcrypt.com`
        Xss.sanitizeAppend(this.S.cached('input_to').siblings('.recipients'), `<span>${Xss.escape(email)} ${Ui.spinner('green')}</span>`);
      }
    } else {
      return;
    }
    console.log(`[${rnd}] parseRenderRecipients.4`);
    this.S.cached('input_to').val('');
    console.log(`[${rnd}] parseRenderRecipients.5`);
    this.resizeInputTo();
    console.log(`[${rnd}] parseRenderRecipients.6`);
    await this.evaluateRenderedRecipients();
    console.log(`[${rnd}] parseRenderRecipients.7`);
    this.setInputTextHeightManuallyIfNeeded();
  }

  private selectContact = async (email: string, fromQuery: ProviderContactsQuery) => {
    console.log(`[${rnd}] selectContact 1`);
    const possiblyBogusRecipient = $('.recipients span.wrong').last();
    const possiblyBogusAddr = Str.parseEmail(possiblyBogusRecipient.text()).email;
    console.log(`[${rnd}] selectContact 2`);
    const q = Str.parseEmail(fromQuery.substring).email;
    if (possiblyBogusAddr === q || Value.is(q).in(possiblyBogusAddr)) {
      possiblyBogusRecipient.remove();
    }
    if (!Value.is(email).in(this.getRecipientsFromDom())) {
      this.S.cached('input_to').val(Str.parseEmail(email).email);
      console.log(`[${rnd}] selectContact -> parseRenderRecipients start`);
      await this.parseRenderRecipients();
      console.log(`[${rnd}] selectContact -> parseRenderRecipients done`);
    }
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
    const lastRecipient = $('.recipients span').last();
    this.S.cached('input_to').val(lastRecipient.text());
    lastRecipient.last().remove();
    const authRes = await GoogleAuth.newAuthPopup({ acctEmail, scopes: GoogleAuth.defaultScopes('contacts') });
    if (authRes.result === 'Success') {
      this.canReadEmails = true;
      await this.searchContacts();
    } else if (authRes.result === 'Denied' || authRes.result === 'Closed') {
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
      Xss.sanitizeRender(this.S.cached('contacts').find('ul'), ulHtml);
      this.S.cached('contacts').find('ul li.select_contact').click(Ui.event.prevent('double', async (target: HTMLElement) => {
        const email = $(target).attr('email');
        if (email) {
          await this.selectContact(Str.parseEmail(email).email, query);
        }
      }, this.handleErrs(`select contact`)));
      this.S.cached('contacts').find('ul li.select_contact').hover(function () { $(this).addClass('hover'); }, function () { $(this).removeClass('hover'); });
      this.S.cached('contacts').find('ul li.auth_contacts').click(Ui.event.handle(() => this.authContacts(this.v.acctEmail), this.handleErrs(`authorize contact search`)));
      this.S.cached('contacts').css({
        display: 'block',
        top: `${$('#compose > tbody > tr:first').height()! + this.S.cached('input_addresses_container_inner').height()! + 10}px`, // both are in the template
      });
    } else {
      this.hideContacts();
    }
  }

  private searchContacts = async (dbOnly = false) => {
    console.log(`[${rnd}] searchContacts`);
    const query = { substring: Str.parseEmail(String(this.S.cached('input_to').val())).email };
    console.log(`[${rnd}] searchContacts.query(${JSON.stringify(query)})`);
    if (query.substring !== '') {
      const contacts = await this.app.storageContactSearch(query);
      if (dbOnly || !this.canReadEmails) {
        console.log(`[${rnd}] searchContacts 1`);
        this.renderSearchRes(contacts, query);
      } else {
        console.log(`[${rnd}] searchContacts 2`);
        this.contactSearchInProgress = true;
        this.renderSearchRes(contacts, query);
        console.log(`[${rnd}] searchContacts 3`);
        this.app.emailEroviderSearchContacts(query.substring, contacts, async searchContactsRes => {
          console.log(`[${rnd}] searchContacts 4`);
          if (searchContactsRes.new.length) {
            for (const contact of searchContactsRes.new) {
              const [inDb] = await this.app.storageContactGet([contact.email]);
              console.log(`[${rnd}] searchContacts 5`);
              if (!inDb) {
                await this.app.storageContactSave(await this.app.storageContactObj(
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
                console.log(`[${rnd}] searchContacts 6`);
              }
            }
            console.log(`[${rnd}] searchContacts 7`);
            await this.searchContacts(true);
            console.log(`[${rnd}] searchContacts 8`);
          } else {
            console.log(`[${rnd}] searchContacts 9`);
            this.renderSearchResultsLoadingDone();
            this.contactSearchInProgress = false;
          }
        });
      }
    } else {
      this.hideContacts(); // todo - show suggestions of most contacted ppl etc
      console.log(`[${rnd}] searchContacts 10`);
    }
  }

  private hideContacts = () => {
    this.S.cached('contacts').css('display', 'none');
  }

  private updatePubkeyIcon = (include?: boolean) => {
    if (typeof include === 'undefined') { // decide if pubkey should be included
      if (!this.includePubkeyToggledManually) { // leave it as is if toggled manually before
        this.updatePubkeyIcon(Boolean(this.recipientsMissingMyKey.length) && !Value.is(this.getSender()).in(this.myAddrsOnPks));
      }
    } else { // set icon to specific state
      if (include) {
        this.S.cached('icon_pubkey').addClass('active').attr('title', Lang.compose.includePubkeyIconTitleActive);
      } else {
        this.S.cached('icon_pubkey').removeClass('active').attr('title', Lang.compose.includePubkeyIconTitle);
      }
    }
  }

  updateFooterIcon = (include?: boolean) => {
    if (typeof include === 'undefined') { // decide if pubkey should be included
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
    console.log(`[${rnd}] renderPubkeyResult.emailEl(${String(emailEl)})`);
    console.log(`[${rnd}] renderPubkeyResult.email(${email})`);
    console.log(`[${rnd}] renderPubkeyResult.contact(${JSON.stringify(contact)})`);
    if ($('body#new_message').length) {
      if (typeof contact === 'object' && contact.has_pgp) {
        const sendingAddrOnPks = Value.is(this.getSender()).in(this.myAddrsOnPks);
        const sendingAddrOnKeyserver = Value.is(this.getSender()).in(this.myAddrsOnKeyserver);
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
    const contentHtml = '<img src="/img/svgs/close-icon.svg" alt="close" class="close-icon svg" /><img src="/img/svgs/close-icon-black.svg" alt="close" class="close-icon svg display_when_sign" />';
    Xss.sanitizeAppend(emailEl, contentHtml).find('img.close-icon').click(Ui.event.handle(target => this.removeReceiver(target), this.handleErrs('remove recipient')));
    if (contact === this.PUBKEY_LOOKUP_RESULT_FAIL) {
      $(emailEl).attr('title', 'Loading contact information failed, please try to add their email again.');
      $(emailEl).addClass("failed");
      Xss.sanitizeReplace($(emailEl).children('img:visible'), '<img src="/img/svgs/repeat-icon.svg" class="repeat-icon action_retry_pubkey_fetch">');
      $(emailEl).find('.action_retry_pubkey_fetch').click(Ui.event.handle(target => this.removeReceiver(target), this.handleErrs('remove recipient')));
    } else if (contact === this.PUBKEY_LOOKUP_RESULT_WRONG) {
      $(emailEl).attr('title', 'This email address looks misspelled. Please try again.');
      $(emailEl).addClass("wrong");
    } else if (contact.pubkey && await Pgp.key.usableButExpired((await openpgp.key.readArmored(contact.pubkey)).keys[0])) {
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

  private getRecipientsFromDom = (filter?: "no_pgp"): string[] => {
    let selector;
    if (filter === 'no_pgp') {
      selector = '.recipients span.no_pgp';
    } else {
      selector = '.recipients span';
    }
    const recipients: string[] = [];
    for (const recipientEl of $(selector).get()) {
      recipients.push($(recipientEl).text().trim());
    }
    return recipients;
  }

  private getSender = (): string => {
    if (this.v.from) {
      return this.v.from;
    }
    if (this.S.now('input_from').length) {
      return String(this.S.now('input_from').val());
    }
    return this.v.acctEmail;
  }

  private renderReplySuccess = (msg: SendableMsg, plaintext: string, msgId: string) => {
    const isSigned = this.S.cached('icon_sign').is('.active');
    this.app.renderReinsertReplyBox(msgId, msg.headers.To.split(',').map(a => Str.parseEmail(a).email));
    if (isSigned) {
      this.S.cached('replied_body').addClass('pgp_neutral').removeClass('pgp_secure');
    }
    this.S.cached('replied_body').css('width', ($('table#compose').width() || 500) - 30);
    this.S.cached('compose_table').css('display', 'none');
    this.S.cached('reply_msg_successful').find('div.replied_from').text(this.getSender());
    this.S.cached('reply_msg_successful').find('div.replied_to span').text(this.v.to.join(','));
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
    const t = new Date();
    const time = ((t.getHours() !== 12) ? (t.getHours() % 12) : 12) + ':' + (t.getMinutes() < 10 ? '0' : '') + t.getMinutes() + ((t.getHours() >= 12) ? ' PM ' : ' AM ') + '(0 minutes ago)';
    this.S.cached('reply_msg_successful').find('div.replied_time').text(time);
    this.S.cached('reply_msg_successful').css('display', 'block');
    if (msg.atts.length) {
      this.S.cached('replied_attachments').html(msg.atts.map(a => { // xss-safe-factory
        a.msgId = msgId;
        return this.app.factoryAtt(a, true);
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
    if (Catch.browser().name === 'firefox') { // the padding cause issues in firefox where user cannot click on the message password
      this.S.cached('input_text').css({ 'padding-top': 0, 'padding-bottom': 0 });
    }
    this.S.cached('send_btn').click(Ui.event.prevent('double', () => this.extractProcessSendMsg()));
    this.S.cached('send_btn').keypress(Ui.enter(() => this.extractProcessSendMsg()));
    this.S.cached('input_to').keydown(ke => this.respondToInputHotkeys(ke));
    this.S.cached('input_to').keyup(Ui.event.prevent('veryslowspree', () => this.searchContacts()));
    this.S.cached('input_to').blur(Ui.event.prevent('double', async () => {
      console.log(`[${rnd}] input_to.blur -> parseRenderRecipients start`);
      await this.parseRenderRecipients();
      console.log(`[${rnd}] input_to.blur -> parseRenderRecipients done`);
    }));
    this.S.cached('input_text').keyup(() => this.S.cached('send_btn_note').text(''));
    this.S.cached('compose_table').click(Ui.event.handle(() => this.hideContacts(), this.handleErrs(`hide contact box`)));
    this.S.cached('input_addresses_container_inner').click(Ui.event.handle(() => {
      if (!this.S.cached('input_to').is(':focus')) {
        console.log(`[${rnd}] input_addresses_container_inner.clickk -> calling input_to.focus() when input_to.val(${this.S.cached('input_to').val()})`);
        this.S.cached('input_to').focus();
      }
    }, this.handleErrs(`focus on recipient field`))).children().click(() => false);
    this.resizeInputTo();
    this.attach.initAttDialog('fineuploader', 'fineuploader_button');
    if (!String(this.S.cached('input_to').val()).length) {
      // focus on recipients, but only if empty (user has not started typing yet)
      // this is particularly important to skip if CI tests are already typing the recipient in
      console.log(`[${rnd}] renderComposeTable -> calling input_to.focus() when input_to.val(${this.S.cached('input_to').val()})`);
      this.S.cached('input_to').focus();
    }
    if (this.v.isReplyBox) {
      if (this.v.to.length) {
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
      const addresses = this.app.storageGetAddresses();
      if (addresses.length > 1) {
        const inputAddrContainer = $('#input_addresses_container');
        inputAddrContainer.addClass('show_send_from');
        const cogIcon = `<img id="input_from_settings" src="/img/svgs/settings-icon.svg" data-test="action-open-sending-address-settings" title="Settings">`;
        Xss.sanitizeAppend(inputAddrContainer, `<select id="input_from" tabindex="-1" data-test="input-from"></select>${cogIcon}`);
        inputAddrContainer.find('#input_from_settings').click(Ui.event.handle(() => this.app.renderSendingAddrDialog(), this.handleErrs(`open sending address dialog`)));
        const fmtOpt = (addr: string) => `<option value="${Xss.escape(addr)}">${Xss.escape(addr)}</option>`;
        Xss.sanitizeAppend(inputAddrContainer.find('#input_from'), addresses.map(fmtOpt).join('')).change(() => this.updatePubkeyIcon());
        if (Catch.browser().name === 'firefox') {
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

  private fmtPwdProtectedEmail = (shortId: string, encryptedBody: SendableMsgBody, armoredPubkeys: string[], atts: Att[], lang: 'DE' | 'EN') => {
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

  static defaultAppFunctions = (): ComposerAppFunctionsInterface => {
    return {
      canReadEmails: () => false,
      doesRecipientHaveMyPubkey: (): Promise<boolean | undefined> => Promise.resolve(false),
      storageGetAddresses: () => [],
      storageGetAddressesPks: () => [],
      storageGetAddressesKeyserver: () => [],
      storageEmailFooterGet: () => undefined,
      storageEmailFooterSet: () => Promise.resolve(),
      storageGetHideMsgPassword: () => false,
      storageGetSubscription: () => Promise.resolve(new Subscription(undefined)),
      storageSetDraftMeta: () => Promise.resolve(),
      storageGetKey: () => { throw new Error('storage_get_key not implemented'); },
      storagePassphraseGet: () => Promise.resolve(undefined),
      storageAddAdminCodes: () => Promise.resolve(),
      storageContactGet: () => Promise.resolve([]),
      storageContactUpdate: () => Promise.resolve(),
      storageContactSave: () => Promise.resolve(),
      storageContactSearch: () => Promise.resolve([]),
      storageContactObj: Store.dbContactObj,
      emailProviderDraftGet: () => Promise.resolve(undefined),
      emailProviderDraftCreate: () => Promise.reject(undefined),
      emailProviderDraftUpdate: () => Promise.resolve({}),
      emailProviderDraftDelete: () => Promise.resolve({}),
      emailProviderMsgSend: () => Promise.reject({ message: 'not implemented' }),
      emailEroviderSearchContacts: (query, knownContacts, multiCb) => multiCb({ new: [], all: [] }),
      emailProviderDetermineReplyMsgHeaderVariables: () => Promise.resolve(undefined),
      emailProviderExtractArmoredBlock: () => Promise.resolve(''),
      renderReinsertReplyBox: () => Promise.resolve(),
      renderFooterDialog: () => undefined,
      renderAddPubkeyDialog: () => undefined,
      renderHelpDialog: () => undefined,
      renderSendingAddrDialog: () => undefined,
      closeMsg: () => undefined,
      factoryAtt: (att) => `<div>${att.name}</div>`,
    };
  }

}
