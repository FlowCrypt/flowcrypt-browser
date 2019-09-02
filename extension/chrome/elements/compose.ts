/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch } from '../../js/common/platform/catch.js';
import { Store, ContactUpdate, DbContactFilter } from '../../js/common/platform/store.js';
import { Str } from '../../js/common/core/common.js';
import { Att } from '../../js/common/core/att.js';
import { Ui, Env, JQS } from '../../js/common/browser.js';
import { Composer } from '../../js/common/composer.js';
import { Api, ProgressCb, ChunkedCb } from '../../js/common/api/api.js';
import { BrowserMsg, Bm } from '../../js/common/extension.js';
import { Google, GoogleAuth } from '../../js/common/api/google.js';
import { KeyInfo, Contact, Pgp, openpgp } from '../../js/common/core/pgp.js';
import { SendableMsg } from '../../js/common/api/email_provider_api.js';
import { Assert } from '../../js/common/assert.js';
import { XssSafeFactory } from '../../js/common/xss_safe_factory.js';
import { Xss } from '../../js/common/platform/xss.js';
import { Keyserver, PubkeySearchResult } from '../../js/common/api/keyserver.js';
import { PUBKEY_LOOKUP_RESULT_FAIL } from '../../js/common/composer/interfaces/composer-errors.js';

export type DeterminedMsgHeaders = {
  lastMsgId: string,
  headers: { 'In-Reply-To': string, 'References': string }
};

Catch.try(async () => {

  Ui.event.protect();

  const ksLookupsByEmail: { [key: string]: PubkeySearchResult | Contact } = {};

  const uncheckedUrlParams = Env.urlParams(['acctEmail', 'parentTabId', 'draftId', 'placement', 'frameId', 'isReplyBox', 'from', 'to', 'subject', 'threadId', 'threadMsgId',
    'skipClickPrompt', 'ignoreDraft', 'debug']);
  const acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
  const parentTabId = Assert.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');
  const frameId = Assert.urlParamRequire.string(uncheckedUrlParams, 'frameId');
  const isReplyBox = uncheckedUrlParams.isReplyBox === true;
  const skipClickPrompt = uncheckedUrlParams.skipClickPrompt === true;
  const ignoreDraft = uncheckedUrlParams.ignoreDraft === true;
  const placement = Assert.urlParamRequire.oneof(uncheckedUrlParams, 'placement', ['settings', 'gmail', undefined]);
  const disableDraftSaving = false;
  const debug = uncheckedUrlParams.debug === true;
  let draftId = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'draftId') || '';
  let threadId = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'threadId') || '';
  // todo - stop getting these 3 below from url params and stop parsing them from dom https://github.com/FlowCrypt/flowcrypt-browser/issues/1493
  let from = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'from');
  let to = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'to') ? Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'to')!.split(',') : [];
  let cc: string[] = [];
  let bcc: string[] = [];
  let subject = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'subject') || '';
  let passphraseInterval: number;

  const storage = await Store.getAcct(acctEmail, ['google_token_scopes', 'addresses', 'addresses_keyserver', 'email_footer', 'email_provider',
    'hide_message_password', 'drafts_reply']);
  const canReadEmail = GoogleAuth.hasReadScope(storage.google_token_scopes || []);
  const tabId = await BrowserMsg.requiredTabId();
  const factory = new XssSafeFactory(acctEmail, tabId);
  const storagePassphraseGet = async () => {
    const [primaryKi] = await Store.keysGet(acctEmail, ['primary']);
    if (!primaryKi) {
      return undefined; // flowcrypt just uninstalled or reset?
    }
    return await Store.passphraseGet(acctEmail, primaryKi.longid);
  };

  await (async () => { // attempt to recover missing params
    if (!isReplyBox || !threadId) {
      return; // either not a reply box, or reply box & has all needed params
    }
    Xss.sanitizePrepend('#new_message', Ui.e('div', { id: 'loader', html: 'Loading secure reply box..' + Ui.spinner('green') }));
    let gmailMsg;
    try {
      const thread = await Google.gmail.threadGet(acctEmail, threadId, 'metadata');
      gmailMsg = await Google.gmail.msgGet(acctEmail, thread.messages[thread.messages.length - 1].id, 'metadata');
    } catch (e) {
      if (Api.err.isAuthPopupNeeded(e)) {
        BrowserMsg.send.notificationShowAuthPopupNeeded(parentTabId, { acctEmail });
      } else if (Api.err.isInsufficientPermission(e)) {
        console.info(`skipping attempt to recover missing params due to insufficient permission`);
      } else if (Api.err.isSignificant(e)) {
        Catch.reportErr(e);
      }
      // notFound errors will also get down here, and cause a blank reply form to be rendered
      $('#loader').remove();
      return;
    }
    if (gmailMsg.threadId) {
      threadId = gmailMsg.threadId;
    }
    const reply = Google.determineReplyCorrespondents(acctEmail, storage.addresses || [], gmailMsg);
    to = reply.to;
    from = reply.from;
    cc = reply.cc;
    bcc = reply.bcc;
    subject = Google.gmail.findHeader(gmailMsg, 'subject') || '';
    $('#loader').remove();
  })();

  if (isReplyBox && threadId && !ignoreDraft && storage.drafts_reply && storage.drafts_reply[threadId]) {
    draftId = storage.drafts_reply[threadId]; // there may be a draft we want to load
  }

  const processedUrlParams = { acctEmail, draftId, threadId, subject, from, to, cc, bcc, frameId, tabId, isReplyBox, skipClickPrompt, parentTabId, disableDraftSaving, debug };
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
            if (!parsed.keys[0]) {
              Catch.log('Dropping found but incompatible public key', { for: email, err: parsed.err ? ' * ' + parsed.err.join('\n * ') : undefined });
              lookupResult.pubkey = null; // tslint:disable-line:no-null-keyword
            } else if (! await parsed.keys[0].getEncryptionKey()) {
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
  const collectAllAvailablePublicKeys = async (acctEmail: string, recipients: string[]) => {
    const contacts = await storageContactGet(recipients);
    const { public: armoredPublicKey } = await storageGetKey(acctEmail);
    const armoredPubkeys = [armoredPublicKey];
    const emailsWithoutPubkeys = [];
    for (const i of contacts.keys()) {
      const contact = contacts[i];
      if (contact && contact.has_pgp && contact.pubkey) {
        armoredPubkeys.push(contact.pubkey);
      } else if (contact && ksLookupsByEmail[contact.email] && ksLookupsByEmail[contact.email].pubkey) {
        armoredPubkeys.push(ksLookupsByEmail[contact.email].pubkey!); // checked !null right above. Null evaluates to false.
      } else {
        emailsWithoutPubkeys.push(recipients[i]);
      }
    }
    return { armoredPubkeys, emailsWithoutPubkeys };
  };
  const composer = new Composer({
    canReadEmails: () => canReadEmail,
    doesRecipientHaveMyPubkey: async (theirEmailUnchecked: string): Promise<boolean | undefined> => {
      const theirEmail = Str.parseEmail(theirEmailUnchecked).email;
      if (!theirEmail) {
        return false;
      }
      const storage = await Store.getAcct(acctEmail, ['pubkey_sent_to']);
      if (storage.pubkey_sent_to && storage.pubkey_sent_to.includes(theirEmail)) {
        return true;
      }
      if (!canReadEmail) {
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
    storageGetAddresses: () => storage.addresses || [acctEmail],
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
    emailEroviderSearchContacts: (query: string, knownContacts: Contact[], multiCb: ChunkedCb) => {
      Google.gmail.searchContacts(acctEmail, query, knownContacts, multiCb).catch(e => {
        if (Api.err.isAuthPopupNeeded(e)) {
          BrowserMsg.send.notificationShowAuthPopupNeeded(parentTabId, { acctEmail });
        } else if (Api.err.isNetErr(e)) {
          // todo: render network error
        } else {
          Catch.reportErr(e);
          // todo: render error
        }
      });
    },
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
      BrowserMsg.send.reinsertReplyBox(parentTabId, { acctEmail, myEmail: from || acctEmail, subject, theirEmail: recipients, threadId, threadMsgId: lastMsgId });
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
    renderSendingAddrDialog: () => ($ as JQS).featherlight({ iframe: factory.srcSendingAddrDialog('compose'), iframeWidth: 490, iframeHeight: 500 }),
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
