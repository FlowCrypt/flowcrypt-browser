/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store, KeyInfo, ContactUpdate, Contact, DbContactFilter } from '../../js/common/store.js';
import { Value, Str } from './../../js/common/common.js';
import { Att } from '../../js/common/att.js';
import { Xss, Ui, XssSafeFactory, Env, JQS } from '../../js/common/browser.js';
import { Composer, ComposerUserError } from '../../js/common/composer.js';
import { Api, ProgressCb, SendableMsg, ChunkedCb } from '../../js/common/api/api.js';
import { BrowserMsg, Bm } from '../../js/common/extension.js';
import { Catch } from '../../js/common/catch.js';
import { Google, GoogleAuth } from '../../js/common/api/google.js';

Catch.try(async () => {

  Ui.event.protect();

  const urlParams = Env.urlParams(['acctEmail', 'parentTabId', 'draftId', 'placement', 'frameId', 'isReplyBox', 'from', 'to', 'subject', 'threadId', 'threadMsgId',
    'skipClickPrompt', 'ignoreDraft']);
  const acctEmail = Env.urlParamRequire.string(urlParams, 'acctEmail');
  const parentTabId = Env.urlParamRequire.string(urlParams, 'parentTabId');
  const frameId = Env.urlParamRequire.string(urlParams, 'frameId');
  const threadMsgId = Env.urlParamRequire.optionalString(urlParams, 'threadMsgId') || '';
  const isReplyBox = urlParams.isReplyBox === true;
  const skipClickPrompt = urlParams.skipClickPrompt === true;
  const ignoreDraft = urlParams.ignoreDraft === true;
  const placement = Env.urlParamRequire.oneof(urlParams, 'placement', ['settings', 'gmail', undefined]);
  const disableDraftSaving = false;
  let draftId = Env.urlParamRequire.optionalString(urlParams, 'draftId') || '';
  let from = Env.urlParamRequire.optionalString(urlParams, 'from') || acctEmail;
  let to = Env.urlParamRequire.optionalString(urlParams, 'to') ? Env.urlParamRequire.optionalString(urlParams, 'to')!.split(',') : [];
  let threadId = Env.urlParamRequire.optionalString(urlParams, 'threadId') || '';
  let subject = Env.urlParamRequire.optionalString(urlParams, 'subject') || '';

  const subscriptionWhenPageWasOpened = await Store.subscription();
  const storage = await Store.getAcct(acctEmail, [
    'google_token_scopes', 'addresses', 'addresses_pks', 'addresses_keyserver', 'email_footer', 'email_provider', 'hide_message_password', 'drafts_reply'
  ]);

  await (async () => { // attempt to recover missing params
    if (!isReplyBox || (threadId && threadId !== threadMsgId && to.length && from && subject)) {
      return; // either not a reply box, or reply box & has all needed params
    }
    Xss.sanitizePrepend('#new_message', Ui.e('div', { id: 'loader', html: 'Loading secure reply box..' + Ui.spinner('green') }));
    let gmailMsg;
    try {
      gmailMsg = await Google.gmail.msgGet(acctEmail, threadMsgId, 'metadata');
    } catch (e) {
      if (Api.err.isAuthPopupNeeded(e)) {
        BrowserMsg.send.notificationShowAuthPopupNeeded(parentTabId, { acctEmail });
      } else if (Api.err.isSignificant(e)) {
        Catch.handleErr(e);
      }
      threadId = threadId || threadMsgId;
      console.info('FlowCrypt: Substituting threadId: could cause issues. Value:' + String(threadId));
      $('#loader').remove();
      return;
    }
    if (gmailMsg.threadId) {
      threadId = gmailMsg.threadId;
    }
    const reply = Api.common.replyCorrespondents(acctEmail, storage.addresses || [], Google.gmail.findHeader(gmailMsg, 'from'), (Google.gmail.findHeader(gmailMsg, 'to') || '').split(','));
    if (!to.length) {
      to = reply.to;
    }
    if (!from) {
      from = reply.from;
    }
    if (!subject) {
      subject = Google.gmail.findHeader(gmailMsg, 'subject') || '';
    }
    $('#loader').remove();
  })();

  const tabId = await BrowserMsg.requiredTabId();

  const canReadEmail = GoogleAuth.hasScope(storage.google_token_scopes as string[], 'read');
  const factory = new XssSafeFactory(acctEmail, tabId);
  if (isReplyBox && threadId && !ignoreDraft && storage.drafts_reply && storage.drafts_reply[threadId]) {
    // there may be a draft we want to load
    draftId = storage.drafts_reply[threadId];
  }

  const processedUrlParams = { acctEmail, draftId, threadId, subject, from, to, frameId, tabId, isReplyBox, skipClickPrompt, parentTabId, disableDraftSaving };

  const closeMsg = () => {
    $('body').attr('data-test-state', 'closed');  // used by automated tests
    if (isReplyBox) {
      BrowserMsg.send.closeReplyMessage(parentTabId, { frameId, threadId: threadId! });
    } else if (placement === 'settings') {
      BrowserMsg.send.closePage(parentTabId);
    } else {
      BrowserMsg.send.closeNewMessage(parentTabId);
    }
  };

  const composer = new Composer({
    canReadEmails: () => canReadEmail,
    doesRecipientHaveMyPubkey: async (theirEmail: string): Promise<boolean | undefined> => {
      theirEmail = Str.parseEmail(theirEmail).email;
      if (!Str.isEmailValid(theirEmail)) {
        return false;
      }
      const storage = await Store.getAcct(acctEmail, ['pubkey_sent_to']);
      if (Value.is(theirEmail).in(storage.pubkey_sent_to || [])) {
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
          Catch.handleErr(e);
        }
        return undefined;
      }
    },
    storageGetAddresses: () => storage.addresses || [acctEmail],
    storageGetAddressesPks: () => storage.addresses_pks || [],
    storageGetAddressesKeyserver: () => storage.addresses_keyserver || [],
    storageEmailFooterGet: () => storage.email_footer || null,
    storageEmailFooterSet: async (footer: string | null) => {
      storage.email_footer = footer;
      await Store.setAcct(acctEmail, { email_footer: footer });
    },
    storageGetHideMsgPassword: () => !!storage.hide_message_password,
    storageGetSubscription: () => Store.subscription(),
    storageGetKey: async (senderEmail: string): Promise<KeyInfo> => {
      const [primaryKi] = await Store.keysGet(acctEmail, ['primary']);
      if (primaryKi) {
        return primaryKi;
      } else {
        throw new ComposerUserError('FlowCrypt is not properly set up. No Public Key found in storage.');
      }
    },
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
    storagePassphraseGet: async () => {
      const [primaryKi] = await Store.keysGet(acctEmail, ['primary']);
      if (primaryKi === null) {
        return null; // flowcrypt just uninstalled or reset?
      }
      return await Store.passphraseGet(acctEmail, primaryKi.longid);
    },
    storageAddAdminCodes: async (shortId: string, msgAdminCode: string, attAdminCodes: string[]) => {
      const adminCodeStorage = await Store.getGlobal(['admin_codes']);
      adminCodeStorage.admin_codes = adminCodeStorage.admin_codes || {};
      adminCodeStorage.admin_codes[shortId] = {
        date: Date.now(),
        codes: [msgAdminCode].concat(attAdminCodes || []),
      };
      await Store.setGlobal(adminCodeStorage);
    },
    storageContactGet: (email: string[]) => Store.dbContactGet(null, email),
    storageContactUpdate: (email: string[] | string, update: ContactUpdate) => Store.dbContactUpdate(null, email, update),
    storageContactSave: (contact: Contact) => Store.dbContactSave(null, contact),
    storageContactSearch: (query: DbContactFilter) => Store.dbContactSearch(null, query),
    storageContactObj: Store.dbContactObj,
    emailProviderDraftGet: (draftId: string) => Google.gmail.draftGet(acctEmail, draftId, 'raw'),
    emailProviderDraftCreate: (mimeMsg: string) => Google.gmail.draftCreate(acctEmail, mimeMsg, threadId),
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
          Catch.handleErr(e);
          // todo: render error
        }
      });
    },
    emailProviderDetermineReplyMsgHeaderVariables: async () => {
      try {
        const thread = await Google.gmail.threadGet(acctEmail, threadId, 'full');
        if (thread.messages && thread.messages.length > 0) {
          const threadMsgIdLast = Google.gmail.findHeader(thread.messages[thread.messages.length - 1], 'Message-ID') || '';
          const threadMsgRefsLast = Google.gmail.findHeader(thread.messages[thread.messages.length - 1], 'In-Reply-To') || '';
          return { lastMsgId: thread.messages[thread.messages.length - 1].id, headers: { 'In-Reply-To': threadMsgIdLast, 'References': threadMsgRefsLast + ' ' + threadMsgIdLast } };
        } else {
          return;
        }
      } catch (e) {
        if (Api.err.isAuthPopupNeeded(e)) {
          BrowserMsg.send.notificationShowAuthPopupNeeded(parentTabId, { acctEmail });
        } else if (Api.err.isNetErr(e)) {
          // todo: render retry
        } else {
          Catch.handleErr(e);
          // todo: render error
        }
      }
      return;
    },
    emailProviderExtractArmoredBlock: (msgId: string) => Google.gmail.extractArmoredBlock(acctEmail, msgId, 'full'),
    // sendMsgToMainWin: (channel: string, data: Dict<Serializable>) => BrowserMsg.send(parentTabId, channel, data),
    // sendMsgToBgScript: (channel: string, data: Dict<Serializable>) => BrowserMsg.send(null, channel, data),
    renderReinsertReplyBox: (lastMsgId: string, recipients: string[]) => {
      BrowserMsg.send.reinsertReplyBox(parentTabId, { acctEmail, myEmail: from, subject, theirEmail: recipients, threadId, threadMsgId: lastMsgId });
    },
    renderFooterDialog: () => ($ as JQS).featherlight({ // tslint:disable:no-unsafe-any
      iframe: factory.srcAddFooterDialog('compose'), iframeWidth: 490, iframeHeight: 230, variant: 'noscroll', afterContent: () => {
        $('.featherlight.noscroll > .featherlight-content > iframe').attr('scrolling', 'no');
      }
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
    factoryAtt: (att: Att) => factory.embeddedAtta(att),
  }, processedUrlParams, subscriptionWhenPageWasOpened);

  BrowserMsg.addListener('close_dialog', () => {
    $('.featherlight.featherlight-iframe').remove();
  });
  BrowserMsg.addListener('set_footer', ({ footer }: Bm.SetFooter) => {
    storage.email_footer = footer;
    composer.updateFooterIcon();
    $('.featherlight.featherlight-iframe').remove();
  });
  BrowserMsg.addListener('show_subscribe_dialog', composer.showSubscribeDialogAndWaitForRes);
  BrowserMsg.addListener('subscribe_result', ({ active }: Bm.SubscribeResult) => {
    if (active && !subscriptionWhenPageWasOpened.active) {
      subscriptionWhenPageWasOpened.active = active;
    }
    composer.processSubscribeRes({ active });
  });
  BrowserMsg.addListener('passphrase_entry', ({ entered }: Bm.PassphraseEntry) => composer.passphraseEntry(!!entered));
  BrowserMsg.listen(tabId);

  if (!isReplyBox) { // don't want to deal with resizing the frame
    await Ui.abortAndRenderErrOnUnprotectedKey(acctEmail);
  }

})();
