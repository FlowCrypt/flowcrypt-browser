/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch } from '../../js/common/platform/catch.js';
import { Store, ContactUpdate, DbContactFilter, AccountStoreExtension, SendAsAlias, Scopes, AccountStore } from '../../js/common/platform/store.js';
import { Str, Dict } from '../../js/common/core/common.js';
import { Att } from '../../js/common/core/att.js';
import { Ui, JQS } from '../../js/common/browser.js';
import { Composer } from '../../js/common/composer/composer.js';
import { Api, ProgressCb, ChunkedCb } from '../../js/common/api/api.js';
import { BrowserMsg, Bm } from '../../js/common/extension.js';
import { Google } from '../../js/common/api/google.js';
import { KeyInfo, Contact, Pgp, openpgp } from '../../js/common/core/pgp.js';
import { SendableMsg } from '../../js/common/api/email_provider_api.js';
import { Assert } from '../../js/common/assert.js';
import { XssSafeFactory } from '../../js/common/xss_safe_factory.js';
import { Xss } from '../../js/common/platform/xss.js';
import { Keyserver, PubkeySearchResult } from '../../js/common/api/keyserver.js';
import { CollectPubkeysResult } from '../../js/common/composer/interfaces/composer-types.js';
import { PUBKEY_LOOKUP_RESULT_FAIL } from '../../js/common/composer/composer-errs.js';
import { Backend } from '../../js/common/api/backend.js';
import { Url } from '../../js/common/core/common.js';
import { View } from '../../js/common/view.js';

export type DeterminedMsgHeaders = {
  lastMsgId: string,
  headers: { 'In-Reply-To': string, 'References': string }
};

View.run(class ComposeView extends View {

  private ksLookupsByEmail: { [key: string]: PubkeySearchResult | Contact } = {};
  private passphraseInterval: number | undefined;
  private readonly acctEmail: string;
  private readonly parentTabId: string;
  private readonly frameId: string;
  private readonly skipClickPrompt: boolean;
  private readonly ignoreDraft: boolean;
  private readonly removeAfterClose: boolean;
  private readonly placement: 'settings' | 'gmail' | undefined;
  private readonly disableDraftSaving: boolean;
  private readonly debug: boolean;
  private readonly isReplyBox: boolean;
  private readonly replyMsgId: string;
  private draftId: string;
  private threadId: string = '';

  private scopes: Scopes | undefined;
  private factory: XssSafeFactory | undefined;
  private tabId: string | undefined;
  private storage: AccountStore | undefined;
  private replyParams: { from: string, subject: string, to: string[], cc: string[], bcc: string[] } = { from: '', subject: '', to: [], cc: [], bcc: [] };

  constructor() {
    super();
    Ui.event.protect();
    const uncheckedUrlParams = Url.parse(['acctEmail', 'parentTabId', 'draftId', 'placement', 'frameId',
      'replyMsgId', 'skipClickPrompt', 'ignoreDraft', 'debug', 'removeAfterClose']);
    this.acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
    this.parentTabId = Assert.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');
    this.frameId = Assert.urlParamRequire.string(uncheckedUrlParams, 'frameId');
    this.skipClickPrompt = uncheckedUrlParams.skipClickPrompt === true;
    this.ignoreDraft = uncheckedUrlParams.ignoreDraft === true;
    this.removeAfterClose = uncheckedUrlParams.removeAfterClose === true;
    this.placement = Assert.urlParamRequire.oneof(uncheckedUrlParams, 'placement', ['settings', 'gmail', undefined]);
    this.disableDraftSaving = false;
    this.debug = uncheckedUrlParams.debug === true;
    this.draftId = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'draftId') || '';
    this.replyMsgId = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'replyMsgId') || '';
    this.isReplyBox = !!this.replyMsgId;
    openpgp.initWorker({ path: '/lib/openpgp.worker.js' });
  }

  async render() {
    this.storage = await Store.getAcct(this.acctEmail, ['google_token_scopes', 'addresses', 'sendAs', 'email_provider',
      'hide_message_password', 'drafts_reply']);
    this.tabId = await BrowserMsg.requiredTabId();
    this.factory = new XssSafeFactory(this.acctEmail, this.tabId);
    if (this.replyMsgId) {
      const fetchSuccess = await (async () => {
        Xss.sanitizePrepend('#new_message', Ui.e('div', { id: 'loader', html: 'Loading secure reply box..' + Ui.spinner('green') }));
        try {
          const gmailMsg = await Google.gmail.msgGet(this.acctEmail, this.replyMsgId!, 'metadata');
          const aliases = AccountStoreExtension.getEmailAliasesIncludingPrimary(this.acctEmail, this.storageGetAddresses());
          Object.assign(this.replyParams, Google.determineReplyCorrespondents(this.acctEmail, aliases, gmailMsg));
          this.replyParams.subject = Google.gmail.findHeader(gmailMsg, 'subject') || '';
          this.threadId = gmailMsg.threadId || '';
        } catch (e) {
          if (Api.err.isAuthPopupNeeded(e)) {
            BrowserMsg.send.notificationShowAuthPopupNeeded(this.parentTabId, { acctEmail: this.acctEmail });
          } else if (Api.err.isSignificant(e)) {
            Catch.reportErr(e);
          }
          Xss.sanitizePrepend('#new_message', `<div>Cannot get reply data for the message you are replying to. <a class="action_retry" href="#">Retry</a></div>`);
          $('.action_retry').on('click', Ui.event.handle(async (elem) => {
            location.reload();
          }));
          return false;
        } finally {
          $('#loader').remove();
        }
        return true;
      })();
      if (!fetchSuccess) {
        return;
      }
    }
    if (this.isReplyBox && this.threadId && !this.ignoreDraft && this.storage.drafts_reply && this.storage.drafts_reply[this.threadId]) {
      this.draftId = this.storage.drafts_reply[this.threadId]; // there may be a draft we want to load
    }
    Backend.getSubscriptionWithoutLogin(this.acctEmail).catch(Api.err.reportIfSignificant); // updates storage
    if (!this.isReplyBox) { // don't want to deal with resizing the frame
      await Assert.abortAndRenderErrOnUnprotectedKey(this.acctEmail);
    }
    this.scopes = await Store.getScopes(this.acctEmail);
  }

  setHandlers() {
    const processedUrlParams = {
      acctEmail: this.acctEmail, draftId: this.draftId, threadId: this.threadId, replyMsgId: this.replyMsgId, ...this.replyParams, frameId: this.frameId,
      tabId: this.tabId!, isReplyBox: this.isReplyBox, skipClickPrompt: this.skipClickPrompt, parentTabId: this.parentTabId,
      disableDraftSaving: this.disableDraftSaving, debug: this.debug, removeAfterClose: this.removeAfterClose
    };
    const composer = new Composer({
      doesRecipientHaveMyPubkey: (email: string) => this.doesRecipientHaveMyPubkey(email),
      storageGetAddresses: () => this.storageGetAddresses(),
      storageGetHideMsgPassword: () => !!this.storage!.hide_message_password,
      storageGetSubscription: () => Store.subscription(this.acctEmail),
      storageGetKey: (acctEmail: string, senderEmail: string) => this.storageGetKey(acctEmail, senderEmail),
      storageSetDraftMeta: (store: boolean, draftId: string, threadId: string, recipients: string[], subj: string) => this.storageSetDraftMeta(store, draftId, threadId, recipients, subj),
      storagePassphraseGet: (senderKi: KeyInfo | undefined) => this.storagePassphraseGet(senderKi),
      storageAddAdminCodes: (shortId: string, codes: string[]) => this.storageAddAdminCodes(shortId, codes),
      storageContactGet: (emails: string[]) => Store.dbContactGet(undefined, emails),
      storageContactUpdate: (email: string[] | string, update: ContactUpdate) => Store.dbContactUpdate(undefined, email, update),
      storageContactSave: (contact: Contact) => Store.dbContactSave(undefined, contact),
      storageContactSearch: (query: DbContactFilter) => Store.dbContactSearch(undefined, query),
      storageContactObj: Store.dbContactObj,
      emailProviderDraftGet: (draftId: string) => Google.gmail.draftGet(this.acctEmail, draftId, 'raw'),
      emailProviderDraftCreate: Google.gmail.draftCreate,
      emailProviderDraftUpdate: (draftId: string, mimeMsg: string) => Google.gmail.draftUpdate(this.acctEmail, draftId, mimeMsg),
      emailProviderDraftDelete: (draftId: string) => Google.gmail.draftDelete(this.acctEmail, draftId),
      emailProviderMsgSend: (message: SendableMsg, renderUploadProgress: ProgressCb) => Google.gmail.msgSend(this.acctEmail, message, renderUploadProgress),
      emailProviderGuessContactsFromSentEmails: (query: string, knownContacts: Contact[], multiCb: ChunkedCb) => this.emailProviderGuessContactsFromSentEmails(query, knownContacts, multiCb),
      emailProviderExtractArmoredBlock: (msgId: string) => Google.gmail.extractArmoredBlock(this.acctEmail, msgId, 'full'),
      renderReinsertReplyBox: (msgId: string) => this.renderReinsertReplyBox(msgId),
      renderAddPubkeyDialog: (emails: string[]) => this.renderAddPubkeyDialog(emails),
      renderHelpDialog: () => BrowserMsg.send.bg.settings({ acctEmail: this.acctEmail, page: '/chrome/settings/modules/help.htm' }),
      closeMsg: () => this.closeMsg(),
      factoryAtt: (att: Att, isEncrypted: boolean) => this.factory!.embeddedAtta(att, isEncrypted),
      whenMasterPassphraseEntered: (secondsTimeout?: number) => this.whenMasterPassphraseEntered(secondsTimeout),
      lookupPubkeyFromDbOrKeyserverAndUpdateDbIfneeded: (email: string) => this.lookupPubkeyFromDbOrKeyserverAndUpdateDbIfneeded(email),
      collectAllAvailablePublicKeys: (senderEmail: string, senderKi: KeyInfo, recipients: string[]) => this.collectAllAvailablePublicKeys(senderEmail, senderKi, recipients),
      updateSendAs: (sendAs: Dict<SendAsAlias>) => { this.storage!.sendAs = sendAs; }
    }, processedUrlParams, this.scopes!);
    BrowserMsg.addListener('close_dialog', async () => {
      $('.featherlight.featherlight-iframe').remove();
    });
    BrowserMsg.addListener('passphrase_entry', async ({ entered }: Bm.PassphraseEntry) => {
      if (!entered) {
        clearInterval(this.passphraseInterval);
        composer.sendBtn.resetSendBtn();
      }
    });
    BrowserMsg.listen(this.tabId!);
  }

  private whenMasterPassphraseEntered(secondsTimeout?: number): Promise<string | undefined> {
    return new Promise(resolve => {
      clearInterval(this.passphraseInterval);
      const timeoutAt = secondsTimeout ? Date.now() + secondsTimeout * 1000 : undefined;
      this.passphraseInterval = Catch.setHandledInterval(async () => {
        const passphrase = await this.storagePassphraseGet();
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

  private renderReinsertReplyBox(msgId: string) {
    BrowserMsg.send.reinsertReplyBox(this.parentTabId, { replyMsgId: msgId });
  }

  private renderAddPubkeyDialog(emails: string[]) {
    if (this.placement !== 'settings') {
      BrowserMsg.send.addPubkeyDialog(this.parentTabId, { emails });
    } else {
      ($ as JQS).featherlight({ iframe: this.factory!.srcAddPubkeyDialog(emails, 'settings'), iframeWidth: 515, iframeHeight: $('body').height()! - 50 }); // body element is present
    }
  }

  private async storageGetKey(acctEmail: string, senderEmail: string): Promise<KeyInfo> {
    const keys = await Store.keysGet(acctEmail);
    let result = await this.chooseMyPublicKeyBySenderEmail(keys, senderEmail);
    if (!result) {
      result = keys.find(ki => ki.primary);
      Assert.abortAndRenderErrorIfKeyinfoEmpty(result);
    }
    return result!;
  }

  private async storageSetDraftMeta(storeIfTrue: boolean, draftId: string, threadId: string, recipients: string[], subject: string) {
    const draftStorage = await Store.getAcct(this.acctEmail, ['drafts_reply', 'drafts_compose']);
    if (threadId) { // it's a reply
      const drafts = draftStorage.drafts_reply || {};
      if (storeIfTrue) {
        drafts[threadId] = draftId;
      } else {
        delete drafts[threadId];
      }
      await Store.setAcct(this.acctEmail, { drafts_reply: drafts });
    } else { // it's a new message
      const drafts = draftStorage.drafts_compose || {};
      if (storeIfTrue) {
        drafts[draftId] = { recipients, subject, date: new Date().getTime() };
      } else {
        delete drafts[draftId];
      }
      await Store.setAcct(this.acctEmail, { drafts_compose: drafts });
    }
  }

  private async storageAddAdminCodes(shortId: string, codes: string[]) {
    const adminCodeStorage = await Store.getGlobal(['admin_codes']);
    adminCodeStorage.admin_codes = adminCodeStorage.admin_codes || {};
    adminCodeStorage.admin_codes[shortId] = { date: Date.now(), codes };
    await Store.setGlobal(adminCodeStorage);
  }

  private async doesRecipientHaveMyPubkey(theirEmailUnchecked: string): Promise<boolean | undefined> {
    const theirEmail = Str.parseEmail(theirEmailUnchecked).email;
    if (!theirEmail) {
      return false;
    }
    const storage = await Store.getAcct(this.acctEmail, ['pubkey_sent_to']);
    if (storage.pubkey_sent_to && storage.pubkey_sent_to.includes(theirEmail)) {
      return true;
    }
    if (!this.scopes!.read && !this.scopes!.modify) {
      return undefined; // cannot read email
    }
    const qSentPubkey = `is:sent to:${theirEmail} "BEGIN PGP PUBLIC KEY" "END PGP PUBLIC KEY"`;
    const qReceivedMsg = `from:${theirEmail} "BEGIN PGP MESSAGE" "END PGP MESSAGE"`;
    try {
      const response = await Google.gmail.msgList(this.acctEmail, `(${qSentPubkey}) OR (${qReceivedMsg})`, true);
      if (response.messages) {
        await Store.setAcct(this.acctEmail, { pubkey_sent_to: (storage.pubkey_sent_to || []).concat(theirEmail) });
        return true;
      } else {
        return false;
      }
    } catch (e) {
      if (Api.err.isAuthPopupNeeded(e)) {
        BrowserMsg.send.notificationShowAuthPopupNeeded(this.parentTabId, { acctEmail: this.acctEmail });
      } else if (!Api.err.isNetErr(e)) {
        Catch.reportErr(e);
      }
      return undefined;
    }
  }

  private closeMsg() {
    $('body').attr('data-test-state', 'closed'); // used by automated tests
    if (this.isReplyBox) {
      BrowserMsg.send.closeReplyMessage(this.parentTabId, { frameId: this.frameId });
    } else if (this.placement === 'settings') {
      BrowserMsg.send.closePage(this.parentTabId);
    } else {
      BrowserMsg.send.closeNewMessage(this.parentTabId);
    }
  }

  private async collectAllAvailablePublicKeys(senderEmail: string, senderKi: KeyInfo, recipients: string[]): Promise<CollectPubkeysResult> {
    const contacts = await Store.dbContactGet(undefined, recipients);
    const armoredPubkeys = [{ pubkey: senderKi.public, email: senderEmail, isMine: true }];
    const emailsWithoutPubkeys = [];
    for (const i of contacts.keys()) {
      const contact = contacts[i];
      if (contact && contact.has_pgp && contact.pubkey) {
        armoredPubkeys.push({ pubkey: contact.pubkey, email: contact.email, isMine: false });
      } else if (contact && this.ksLookupsByEmail[contact.email] && this.ksLookupsByEmail[contact.email].pubkey) {
        armoredPubkeys.push({ pubkey: this.ksLookupsByEmail[contact.email].pubkey!, email: contact.email, isMine: false }); // checked !null right above. Null evaluates to false.
      } else {
        emailsWithoutPubkeys.push(recipients[i]);
      }
    }
    return { armoredPubkeys, emailsWithoutPubkeys };
  }

  private async chooseMyPublicKeyBySenderEmail(keys: KeyInfo[], email: string) {
    for (const key of keys) {
      const parsedkey = await Pgp.key.read(key.public);
      if (parsedkey.users.find(u => !!u.userId && u.userId.userid.toLowerCase().includes(email.toLowerCase()))) {
        return key;
      }
    }
    return undefined;
  }

  private async storagePassphraseGet(senderKi?: KeyInfo) {
    if (!senderKi) {
      [senderKi] = await Store.keysGet(this.acctEmail, ['primary']);
      Assert.abortAndRenderErrorIfKeyinfoEmpty(senderKi);
    }
    return await Store.passphraseGet(this.acctEmail, senderKi.longid);
  }

  private storageGetAddresses() {
    const arrayToSendAs = (arr: string[]): Dict<SendAsAlias> => {
      const result: Dict<SendAsAlias> = {}; // Temporary Solution
      for (let i = 0; i < arr.length; i++) {
        const alias: SendAsAlias = { isDefault: i === 0, isPrimary: arr[i] === this.acctEmail }; // before first element was default
        result[arr[i]] = alias;
      }
      if (arr.length) {
        Store.setAcct(this.acctEmail, { sendAs: result }).catch(Catch.reportErr);
      }
      return result;
    };
    return this.storage!.sendAs || (this.storage!.addresses && arrayToSendAs(this.storage!.addresses));
  }

  private async lookupPubkeyFromDbOrKeyserverAndUpdateDbIfneeded(email: string): Promise<Contact | "fail"> {
    const [dbContact] = await Store.dbContactGet(undefined, [email]);
    if (dbContact && dbContact.has_pgp && dbContact.pubkey) {
      // Potentially check if pubkey was updated - async. By the time user finishes composing, newer version would have been updated in db.
      // If sender didn't pull a particular pubkey for a long time and it has since expired, but there actually is a newer version on attester, this may unnecessarily show "bad pubkey",
      //      -> until next time user tries to pull it. This could be fixed by attempting to fix up the rendered recipient inside the async function below.
      this.checkKeyserverForNewerVersionOfKnownPubkeyIfNeeded(dbContact).catch(Catch.reportErr);
      return dbContact;
    } else {
      try {
        const lookupResult = await Keyserver.lookupEmail(this.acctEmail, email);
        if (lookupResult && email) {
          if (lookupResult.pubkey) {
            const parsed = await openpgp.key.readArmored(lookupResult.pubkey);
            const key = parsed.keys[0];
            if (!key) {
              Catch.log('Dropping found but incompatible public key', { for: email, err: parsed.err ? ' * ' + parsed.err.join('\n * ') : undefined });
              lookupResult.pubkey = null; // tslint:disable-line:no-null-keyword
            } else if (! await Pgp.key.usable(lookupResult.pubkey) && ! await Pgp.key.expired(key)) { // Not to skip expired keys
              Catch.log('Dropping found+parsed key because getEncryptionKeyPacket===null', { for: email, fingerprint: await Pgp.key.fingerprint(parsed.keys[0]) });
              lookupResult.pubkey = null; // tslint:disable-line:no-null-keyword
            }
          }
          const ksContact = await Store.dbContactObj({
            email,
            name: dbContact && dbContact.name ? dbContact.name : undefined,
            client: lookupResult.pgpClient === 'flowcrypt' ? 'cryptup' : 'pgp', // todo - clean up as "flowcrypt|pgp-other'. Already in storage, fixing involves migration
            pubkey: lookupResult.pubkey,
            lastUse: Date.now(),
            lastCheck: Date.now(),
          });
          this.ksLookupsByEmail[email] = ksContact;
          await Store.dbContactSave(undefined, ksContact);
          return ksContact;
        } else {
          return PUBKEY_LOOKUP_RESULT_FAIL;
        }
      } catch (e) {
        if (!Api.err.isNetErr(e) && !Api.err.isServerErr(e)) {
          Catch.reportErr(e);
        }
        return PUBKEY_LOOKUP_RESULT_FAIL;
      }
    }
  }

  private emailProviderGuessContactsFromSentEmails(query: string, knownContacts: Contact[], multiCb: ChunkedCb) {
    Google.gmail.searchContacts(this.acctEmail, query, knownContacts, multiCb).catch(e => {
      if (Api.err.isAuthPopupNeeded(e)) {
        BrowserMsg.send.notificationShowAuthPopupNeeded(this.parentTabId, { acctEmail: this.acctEmail });
      } else if (Api.err.isNetErr(e)) {
        Ui.toast(`Network erroc - cannot search contacts`).catch(Catch.reportErr);
      } else if (Api.err.isMailOrAcctDisabledOrPolicy(e)) {
        Ui.toast(`Cannot search contacts - account disabled or forbidden by admin policy`).catch(Catch.reportErr);
      } else {
        Catch.reportErr(e);
        Ui.toast(`Error searching contacts: ${Api.err.eli5(e)}`).catch(Catch.reportErr);
      }
    });
  }

  private async checkKeyserverForNewerVersionOfKnownPubkeyIfNeeded(contact: Contact) {
    try {
      if (!contact.pubkey || !contact.longid) {
        return;
      }
      if (!contact.pubkey_last_sig) {
        const lastSig = await Pgp.key.lastSig(await Pgp.key.read(contact.pubkey));
        contact.pubkey_last_sig = lastSig;
        await Store.dbContactUpdate(undefined, contact.email, { pubkey_last_sig: lastSig });
      }
      if (!contact.pubkey_last_check || new Date(contact.pubkey_last_check).getTime() < Date.now() - (1000 * 60 * 60 * 24 * 7)) { // last update > 7 days ago, or never
        const { pubkey: fetchedPubkey } = await Keyserver.lookupLongid(this.acctEmail, contact.longid);
        if (fetchedPubkey) {
          const fetchedLastSig = await Pgp.key.lastSig(await Pgp.key.read(fetchedPubkey));
          if (fetchedLastSig > contact.pubkey_last_sig) { // fetched pubkey has newer signature, update
            console.info(`Updating key ${contact.longid} for ${contact.email}: newer signature found: ${new Date(fetchedLastSig)} (old ${new Date(contact.pubkey_last_sig)})`);
            await Store.dbContactUpdate(undefined, contact.email, { pubkey: fetchedPubkey, pubkey_last_sig: fetchedLastSig, pubkey_last_check: Date.now() });
            return;
          }
        }
        // we checked for newer key and it did not result in updating the key, don't check again for another week
        await Store.dbContactUpdate(undefined, contact.email, { pubkey_last_check: Date.now() });
      }
    } catch (e) {
      if (Api.err.isSignificant(e)) {
        throw e; // insignificant (temporary) errors ignored
      }
    }
  }

});
