/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch } from '../../js/common/platform/catch.js';
import { Store, ContactUpdate, DbContactFilter, AccountStoreExtension, SendAsAlias } from '../../js/common/platform/store.js';
import { Str, Dict } from '../../js/common/core/common.js';
import { Att } from '../../js/common/core/att.js';
import { Ui, Env, JQS } from '../../js/common/browser.js';
import { Composer } from '../../js/common/composer.js';
import { Api, ProgressCb } from '../../js/common/api/api.js';
import { BrowserMsg, Bm } from '../../js/common/extension.js';
import { Google, GoogleAuth } from '../../js/common/api/google.js';
import { KeyInfo, Contact, Pgp, openpgp } from '../../js/common/core/pgp.js';
import { SendableMsg } from '../../js/common/api/email_provider_api.js';
import { Assert } from '../../js/common/assert.js';
import { XssSafeFactory } from '../../js/common/xss_safe_factory.js';
import { Xss } from '../../js/common/platform/xss.js';
import { Keyserver, PubkeySearchResult } from '../../js/common/api/keyserver.js';
import { PUBKEY_LOOKUP_RESULT_FAIL } from '../../js/common/composer/interfaces/composer-errors.js';
import { PubkeyResult } from '../../js/common/composer/interfaces/composer-types.js';

export type DeterminedMsgHeaders = {
  lastMsgId: string,
  headers: { 'In-Reply-To': string, 'References': string }
};

Catch.try(async () => {

  Ui.event.protect();

  const ksLookupsByEmail: { [key: string]: PubkeySearchResult | Contact } = {};

  const uncheckedUrlParams = Env.urlParams(['acctEmail', 'parentTabId', 'draftId', 'placement', 'frameId', 'threadId', 'skipClickPrompt', 'ignoreDraft', 'debug']);
  const acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
  const parentTabId = Assert.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');
  const frameId = Assert.urlParamRequire.string(uncheckedUrlParams, 'frameId');
  const skipClickPrompt = uncheckedUrlParams.skipClickPrompt === true;
  const ignoreDraft = uncheckedUrlParams.ignoreDraft === true;
  const placement = Assert.urlParamRequire.oneof(uncheckedUrlParams, 'placement', ['settings', 'gmail', undefined]);
  const disableDraftSaving = false;
  const debug = uncheckedUrlParams.debug === true;
  let draftId = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'draftId') || '';
  let threadId = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'threadId') || '';
  const isReplyBox = !!threadId;
  let passphraseInterval: number;

  const storage = await Store.getAcct(acctEmail, ['google_token_scopes', 'addresses', 'sendAs', 'addresses_keyserver', 'email_footer', 'email_provider',
    'hide_message_password', 'drafts_reply']);
  const scopes = {
    canReadEmails: GoogleAuth.hasReadScope(storage.google_token_scopes || []),
    canSearchContacts: GoogleAuth.hasReadContactsScope(storage.google_token_scopes || [])
  };
  const tabId = await BrowserMsg.requiredTabId();
  const factory = new XssSafeFactory(acctEmail, tabId);
  const storagePassphraseGet = async () => {
    const [primaryKi] = await Store.keysGet(acctEmail, ['primary']);
    if (!primaryKi) {
      return undefined; // flowcrypt just uninstalled or reset?
    }
    return await Store.passphraseGet(acctEmail, primaryKi.longid);
  };
  if (isReplyBox && threadId && !ignoreDraft && storage.drafts_reply && storage.drafts_reply[threadId]) {
    draftId = storage.drafts_reply[threadId]; // there may be a draft we want to load
  }
  const replyParams: { from: string, subject: string, to: string[], cc: string[], bcc: string[] } = { from: '', subject: '', to: [], cc: [], bcc: [] };
  if (threadId) {
    const fetchSuccess = await (async () => {
      Xss.sanitizePrepend('#new_message', Ui.e('div', { id: 'loader', html: 'Loading secure reply box..' + Ui.spinner('green') }));
      try {
        const thread = await Google.gmail.threadGet(acctEmail, threadId, 'metadata');
        const gmailMsg = await Google.gmail.msgGet(acctEmail, thread.messages[thread.messages.length - 1].id, 'metadata');
        const aliases = AccountStoreExtension.getEmailAliasesIncludingPrimary(acctEmail, storage.sendAs);
        Object.assign(replyParams, Google.determineReplyCorrespondents(acctEmail, aliases, gmailMsg));
        replyParams.subject = Google.gmail.findHeader(gmailMsg, 'subject') || '';
        threadId = gmailMsg.threadId ? gmailMsg.threadId : threadId;
      } catch (e) {
        if (Api.err.isAuthPopupNeeded(e)) {
          BrowserMsg.send.notificationShowAuthPopupNeeded(parentTabId, { acctEmail });
        } else if (Api.err.isSignificant(e)) {
          Catch.reportErr(e);
        }
        Xss.sanitizePrepend('#new_message', `<div>Cannot get a reply data for the message you are replying to. <a class="action_retry" href="#">Retry</a></div>`);
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
  const processedUrlParams = { acctEmail, draftId, threadId, ...replyParams, frameId, tabId, isReplyBox, skipClickPrompt, parentTabId, disableDraftSaving, debug };
  const storageGetKey = async (senderEmail: string): Promise<KeyInfo> => {
    const [primaryKi] = await Store.keysGet(acctEmail, ['primary']);
    Assert.abortAndRenderErrorIfKeyinfoEmpty(primaryKi);
    return primaryKi;
  };
  const storageContactGet = (email: string[]) => Store.dbContactGet(undefined, email);
  const checkKeyserverForNewerVersionOfKnownPubkeyIfNeeded = async (contact: Contact) => {
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
        const { pubkey: fetchedPubkey } = await Keyserver.lookupLongid(acctEmail, contact.longid);
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
  };
  const lookupPubkeyFromDbOrKeyserverAndUpdateDbIfneeded = async (email: string): Promise<Contact | "fail"> => {
    const [dbContact] = await storageContactGet([email]);
    if (dbContact && dbContact.has_pgp && dbContact.pubkey) {
      // Potentially check if pubkey was updated - async. By the time user finishes composing, newer version would have been updated in db.
      // If sender didn't pull a particular pubkey for a long time and it has since expired, but there actually is a newer version on attester, this may unnecessarily show "bad pubkey",
      //      -> until next time user tries to pull it. This could be fixed by attempting to fix up the rendered recipient inside the async function below.
      checkKeyserverForNewerVersionOfKnownPubkeyIfNeeded(dbContact).catch(Catch.reportErr);
      return dbContact;
    } else {
      try {
        const lookupResult = await Keyserver.lookupEmail(acctEmail, email);
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
          ksLookupsByEmail[email] = ksContact;
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
  };
  const closeMsg = () => {
    $('body').attr('data-test-state', 'closed'); // used by automated tests
    if (isReplyBox) {
      BrowserMsg.send.closeReplyMessage(parentTabId, { frameId, threadId: threadId! });
    } else if (placement === 'settings') {
      BrowserMsg.send.closePage(parentTabId);
    } else {
      BrowserMsg.send.closeNewMessage(parentTabId);
    }
  };
  const collectAllAvailablePublicKeys = async (acctEmail: string, recipients: string[]): Promise<{ armoredPubkeys: PubkeyResult[], emailsWithoutPubkeys: string[] }> => {
    const contacts = await storageContactGet(recipients);
    const { public: senderArmoredPubkey } = await storageGetKey(acctEmail);
    const armoredPubkeys = [{ pubkey: senderArmoredPubkey, email: acctEmail, isMine: true }];
    const emailsWithoutPubkeys = [];
    for (const i of contacts.keys()) {
      const contact = contacts[i];
      if (contact && contact.has_pgp && contact.pubkey) {
        armoredPubkeys.push({ pubkey: contact.pubkey, email: contact.email, isMine: false });
      } else if (contact && ksLookupsByEmail[contact.email] && ksLookupsByEmail[contact.email].pubkey) {
        armoredPubkeys.push({ pubkey: ksLookupsByEmail[contact.email].pubkey!, email: contact.email, isMine: false }); // checked !null right above. Null evaluates to false.
      } else {
        emailsWithoutPubkeys.push(recipients[i]);
      }
    }
    return { armoredPubkeys, emailsWithoutPubkeys };
  };
  const composer = new Composer({
    getScopes: () => scopes,
    doesRecipientHaveMyPubkey: async (theirEmailUnchecked: string): Promise<boolean | undefined> => {
      const theirEmail = Str.parseEmail(theirEmailUnchecked).email;
      if (!theirEmail) {
        return false;
      }
      const storage = await Store.getAcct(acctEmail, ['pubkey_sent_to']);
      if (storage.pubkey_sent_to && storage.pubkey_sent_to.includes(theirEmail)) {
        return true;
      }
      if (!scopes.canReadEmails) {
        return undefined;
      }
      const qSentPubkey = `is:sent to:${theirEmail} "BEGIN PGP PUBLIC KEY" "END PGP PUBLIC KEY"`;
      const qReceivedMsg = `from:${theirEmail} "BEGIN PGP MESSAGE" "END PGP MESSAGE"`;
      try {
        const response = await Google.gmail.msgList(acctEmail, `(${qSentPubkey}) OR (${qReceivedMsg})`, true);
        if (response.messages) {
          await Store.setAcct(acctEmail, { pubkey_sent_to: (storage.pubkey_sent_to || []).concat(theirEmail) });
          return true;
        } else {
          return false;
        }
      } catch (e) {
        if (Api.err.isAuthPopupNeeded(e)) {
          BrowserMsg.send.notificationShowAuthPopupNeeded(parentTabId, { acctEmail });
        } else if (!Api.err.isNetErr(e)) {
          Catch.reportErr(e);
        }
        return undefined;
      }
    },
    storageGetAddresses: () => {
      const arrayToSendAs = (arr: string[]): Dict<SendAsAlias> => {
        const result: Dict<SendAsAlias> = {}; // Temporary Solution
        for (let i = 0; i < arr.length; i++) {
          const alias: SendAsAlias = { isDefault: i === 0, isPrimary: arr[i] === acctEmail }; // before first element was default
          result[arr[i]] = alias;
        }
        return result;
      };
      return storage.sendAs || (storage.addresses && arrayToSendAs(storage.addresses));
    },
    storageGetAddressesKeyserver: () => storage.addresses_keyserver || [],
    storageEmailFooterGet: () => storage.email_footer || undefined,
    storageEmailFooterSet: async (footer: string | undefined) => {
      storage.email_footer = footer;
      await Store.setAcct(acctEmail, { email_footer: footer });
    },
    storageGetHideMsgPassword: () => !!storage.hide_message_password,
    storageGetSubscription: () => Store.subscription(),
    storageGetKey,
    storageSetDraftMeta: async (storeIfTrue: boolean, draftId: string, threadId: string, recipients: string[], subject: string) => {
      const draftStorage = await Store.getAcct(acctEmail, ['drafts_reply', 'drafts_compose']);
      if (threadId) { // it's a reply
        const drafts = draftStorage.drafts_reply || {};
        if (storeIfTrue) {
          drafts[threadId] = draftId;
        } else {
          delete drafts[threadId];
        }
        await Store.setAcct(acctEmail, { drafts_reply: drafts });
      } else { // it's a new message
        const drafts = draftStorage.drafts_compose || {};
        if (storeIfTrue) {
          drafts[draftId] = { recipients, subject, date: new Date().getTime() };
        } else {
          delete drafts[draftId];
        }
        await Store.setAcct(acctEmail, { drafts_compose: drafts });
      }
    },
    storagePassphraseGet,
    storageAddAdminCodes: async (shortId: string, msgAdminCode: string, attAdminCodes: string[]) => {
      const adminCodeStorage = await Store.getGlobal(['admin_codes']);
      adminCodeStorage.admin_codes = adminCodeStorage.admin_codes || {};
      adminCodeStorage.admin_codes[shortId] = {
        date: Date.now(),
        codes: [msgAdminCode].concat(attAdminCodes || []),
      };
      await Store.setGlobal(adminCodeStorage);
    },
    storageContactGet,
    storageContactUpdate: (email: string[] | string, update: ContactUpdate) => Store.dbContactUpdate(undefined, email, update),
    storageContactSave: (contact: Contact) => Store.dbContactSave(undefined, contact),
    storageContactSearch: (query: DbContactFilter) => Store.dbContactSearch(undefined, query),
    storageContactObj: Store.dbContactObj,
    emailProviderDraftGet: (draftId: string) => Google.gmail.draftGet(acctEmail, draftId, 'raw'),
    emailProviderDraftCreate: Google.gmail.draftCreate,
    emailProviderDraftUpdate: (draftId: string, mimeMsg: string) => Google.gmail.draftUpdate(acctEmail, draftId, mimeMsg),
    emailProviderDraftDelete: (draftId: string) => Google.gmail.draftDelete(acctEmail, draftId),
    emailProviderMsgSend: (message: SendableMsg, renderUploadProgress: ProgressCb) => Google.gmail.msgSend(acctEmail, message, renderUploadProgress),
    emailProviderDetermineReplyMsgHeaderVariables: async (progressCb?: ProgressCb): Promise<DeterminedMsgHeaders | undefined> => {
      try {
        const thread = await Google.gmail.threadGet(acctEmail, threadId, 'full', progressCb);
        const lastMsg = (thread.messages || []).reverse().find(m => !m.labelIds || !m.labelIds.includes('TRASH'));
        if (!lastMsg) {
          return;
        }
        const threadMsgIdLast = Google.gmail.findHeader(lastMsg, 'Message-ID') || '';
        const threadMsgRefsLast = Google.gmail.findHeader(lastMsg, 'In-Reply-To') || '';
        return { lastMsgId: lastMsg.id, headers: { 'In-Reply-To': threadMsgIdLast, 'References': threadMsgRefsLast + ' ' + threadMsgIdLast } };
      } catch (e) {
        if (Api.err.isAuthPopupNeeded(e)) {
          BrowserMsg.send.notificationShowAuthPopupNeeded(parentTabId, { acctEmail });
        } else if (Api.err.isNetErr(e)) {
          // todo: render retry
        } else if (Api.err.isNotFound(e)) {
          // todo: render as new message compose?
        } else {
          Catch.reportErr(e);
          // todo: render error
        }
      }
      return;
    },
    emailProviderExtractArmoredBlock: (msgId: string) => Google.gmail.extractArmoredBlock(acctEmail, msgId, 'full'),
    // sendMsgToMainWin: (channel: string, data: Dict<Serializable>) => BrowserMsg.send(parentTabId, channel, data),
    // sendMsgToBgScript: (channel: string, data: Dict<Serializable>) => BrowserMsg.send(null, channel, data),
    renderReinsertReplyBox: (lastMsgId: string, recipients: string[]) => {
      BrowserMsg.send.reinsertReplyBox(parentTabId, {
        acctEmail, myEmail: replyParams.from || acctEmail, subject: replyParams.subject,
        theirEmail: recipients, threadId, threadMsgId: lastMsgId
      });
    },
    renderFooterDialog: () => ($ as JQS).featherlight({ // tslint:disable:no-unsafe-any
      iframe: factory.srcAddFooterDialog('compose', parentTabId),
      iframeWidth: 490,
      iframeHeight: 230,
      variant: 'noscroll',
      afterContent: () => {
        const iframe = $('.featherlight.noscroll > .featherlight-content > iframe');
        iframe.attr('scrolling', 'no').focus();
        iframe.contents().find('textarea').focus();
      },
    }),
    renderAddPubkeyDialog: (emails: string[]) => {
      if (placement !== 'settings') {
        BrowserMsg.send.addPubkeyDialog(parentTabId, { emails });
      } else {
        ($ as JQS).featherlight({ iframe: factory.srcAddPubkeyDialog(emails, 'settings'), iframeWidth: 515, iframeHeight: $('body').height()! - 50 }); // body element is present
      }
    },
    renderHelpDialog: () => BrowserMsg.send.bg.settings({ acctEmail, page: '/chrome/settings/modules/help.htm' }),
    closeMsg,
    factoryAtt: (att: Att, isEncrypted: boolean) => factory.embeddedAtta(att, isEncrypted),
    whenMasterPassphraseEntered: (secondsTimeout?: number): Promise<string | undefined> => {
      return new Promise(resolve => {
        clearInterval(passphraseInterval);
        const timeoutAt = secondsTimeout ? Date.now() + secondsTimeout * 1000 : undefined;
        passphraseInterval = Catch.setHandledInterval(async () => {
          const passphrase = await storagePassphraseGet();
          if (typeof passphrase !== 'undefined') {
            clearInterval(passphraseInterval);
            resolve(passphrase);
          } else if (timeoutAt && Date.now() > timeoutAt) {
            clearInterval(passphraseInterval);
            resolve(undefined);
          }
        }, 1000);
      });
    },
    lookupPubkeyFromDbOrKeyserverAndUpdateDbIfneeded,
    collectAllAvailablePublicKeys
  }, processedUrlParams, await Store.subscription());

  BrowserMsg.addListener('close_dialog', async () => {
    $('.featherlight.featherlight-iframe').remove();
  });
  BrowserMsg.addListener('set_footer', async ({ footer }: Bm.SetFooter) => {
    storage.email_footer = footer;
    composer.updateFooterIcon();
    $('.featherlight.featherlight-iframe').remove();
  });
  BrowserMsg.addListener('passphrase_entry', async ({ entered }: Bm.PassphraseEntry) => {
    if (!entered) {
      clearInterval(passphraseInterval);
      composer.resetSendBtn();
    }
  });
  BrowserMsg.listen(tabId);

  if (!isReplyBox) { // don't want to deal with resizing the frame
    await Assert.abortAndRenderErrOnUnprotectedKey(acctEmail);
  }

  openpgp.initWorker({ path: '/lib/openpgp.worker.js' });
})();
