/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store, Subscription, KeyInfo, ContactUpdate, Serializable, Contact, DbContactFilter } from '../../js/common/store.js';
import { Catch, Env, Value, Str, Dict, JQS } from './../../js/common/common.js';
import { Att } from '../../js/common/att.js';
import { Xss, Ui, XssSafeFactory } from '../../js/common/browser.js';
import { Composer, ComposerUserError } from '../../js/common/composer.js';

import { Api, ProgressCb, SendableMsg } from '../../js/common/api.js';
import { BrowserMsg } from '../../js/common/extension.js';

Catch.try(async () => {

  Ui.event.protect();

  let urlParams = Env.urlParams(['acctEmail', 'parentTabId', 'draftId', 'placement', 'frameId', 'isReplyBox', 'from', 'to', 'subject', 'threadId', 'threadMsgId', 'skipClickPrompt', 'ignoreDraft']);
  let acctEmail = Env.urlParamRequire.string(urlParams, 'acctEmail');
  let parentTabId = Env.urlParamRequire.string(urlParams, 'parentTabId');

  let subscriptionWhenPageWasOpened = await Store.subscription();
  const storageKeys = ['google_token_scopes', 'addresses', 'addresses_pks', 'addresses_keyserver', 'email_footer', 'email_provider', 'hide_message_password', 'drafts_reply'];
  let storage = await Store.getAcct(acctEmail, storageKeys);

  await (async () => { // attempt to recover missing params
    if (!urlParams.isReplyBox || (urlParams.threadId && urlParams.threadId !== urlParams.threadMsgId && urlParams.to && urlParams.from && urlParams.subject)) {
      return; // either not a reply box, or reply box & has all needed params
    }
    Xss.sanitizePrepend('#new_message', Ui.e('div', {id: 'loader', html: 'Loading secure reply box..' + Ui.spinner('green')}));
    let gmailMsg;
    try {
      gmailMsg = await Api.gmail.msgGet(acctEmail, urlParams.threadMsgId as string, 'metadata');
    } catch(e) {
      if(Api.err.isAuthPopupNeeded(e)) {
        BrowserMsg.send(parentTabId, 'notification_show_auth_popup_needed', {acctEmail});
      }
      if (!urlParams.from) {
        urlParams.from = acctEmail;
      }
      if (!urlParams.subject) {
        urlParams.subject = '';
      }
      urlParams.threadId = urlParams.threadId || urlParams.threadMsgId as string;
      console.info('FlowCrypt: Substituting threadId: could cause issues. Value:' + String(urlParams.threadId));
      $('#loader').remove();
      return;
    }
    urlParams.threadId = gmailMsg.threadId;
    let reply = Api.common.replyCorrespondents(acctEmail, storage.addresses || [], Api.gmail.findHeader(gmailMsg, 'from'), (Api.gmail.findHeader(gmailMsg, 'to') || '').split(','));
    if (!urlParams.to) {
      urlParams.to = reply.to.join(',');
    }
    if (!urlParams.from) {
      urlParams.from = reply.from;
    }
    if (!urlParams.subject) {
      urlParams.subject = Api.gmail.findHeader(gmailMsg, 'subject');
    }
    $('#loader').remove();
  })();

  let tabId = await BrowserMsg.requiredTabId();

  const canReadEmail = Api.gmail.hasScope(storage.google_token_scopes as string[], 'read');
  const factory = new XssSafeFactory(acctEmail, tabId);
  if (urlParams.isReplyBox && urlParams.threadId && !urlParams.ignoreDraft && storage.drafts_reply && storage.drafts_reply[urlParams.threadId as string]) { // there may be a draft we want to load
    urlParams.draft_id = storage.drafts_reply[urlParams.threadId as string];
  }

  let closeMsg = () => {
    $('body').attr('data-test-state', 'closed');  // used by automated tests
    if (urlParams.isReplyBox) {
      BrowserMsg.send(parentTabId, 'close_reply_message', {frameId: urlParams.frameId, threadId: urlParams.threadId});
    } else if (urlParams.placement === 'settings') {
      BrowserMsg.send(parentTabId, 'close_page');
    } else {
      BrowserMsg.send(parentTabId, 'close_new_message');
    }
  };

  let composer = new Composer({
    canReadEmails: () => canReadEmail,
    doesRecipientHaveMyPubkey: async (their_email: string): Promise<boolean|undefined> => {
      their_email = Str.parseEmail(their_email).email;
      if(!their_email) {
        return false;
      }
      let storage = await Store.getAcct(acctEmail, ['pubkey_sent_to']);
      if (Value.is(their_email).in(storage.pubkey_sent_to || [])) {
        return true;
      }
      if (!canReadEmail) {
        return undefined;
      }
      const qSentPubkey = `is:sent to:${their_email} "BEGIN PGP PUBLIC KEY" "END PGP PUBLIC KEY"`;
      const qReceivedMsg = `from:${their_email} "BEGIN PGP MESSAGE" "END PGP MESSAGE"`;
      try {
        let response = await Api.gmail.msgList(acctEmail, `(${qSentPubkey}) OR (${qReceivedMsg})`, true);
        if (response.messages) {
          await Store.set(acctEmail, {pubkey_sent_to: (storage.pubkey_sent_to || []).concat(their_email)});
          return true;
        } else {
          return false;
        }
      } catch(e) {
        if(Api.err.isAuthPopupNeeded(e)) {
          BrowserMsg.send(parentTabId, 'notification_show_auth_popup_needed', {acctEmail});
        } else if(!Api.err.isNetErr(e)) {
          Catch.handleException(e);
        }
        return undefined;
      }
    },
    storageGetAddresses: () => storage.addresses || [acctEmail],
    storageGetAddressesPks: () => storage.addresses_pks || [],
    storageGetAddressesKeyserver: () => storage.addresses_keyserver || [],
    storageEmailFooterGet: () => storage.email_footer || null,
    storageEmailFooterSet: async (footer: string|null) => {
      storage.email_footer = footer;
      await Store.set(acctEmail, {email_footer: footer});
    },
    storageGetHideMsgPassword: () => !!storage.hide_message_password,
    storageGetSubscription: () => Store.subscription(),
    storageGetKey: async (sender_email: string): Promise<KeyInfo> => {
      let [primaryKi] = await Store.keysGet(acctEmail, ['primary']);
      if (primaryKi) {
        return primaryKi;
      } else {
        throw new ComposerUserError('FlowCrypt is not properly set up. No Public Key found in storage.');
      }
    },
    storageSetDraftMeta: async (storeIfTrue: boolean, draftId: string, threadId: string, recipients: string[], subject: string) => {
      let draftStorage = await Store.getAcct(acctEmail, ['drafts_reply', 'drafts_compose']);
      if (threadId) { // it's a reply
        let drafts = draftStorage.drafts_reply || {};
        if (storeIfTrue) {
          drafts[threadId] = draftId;
        } else {
          delete drafts[threadId];
        }
        await Store.set(acctEmail, {drafts_reply: drafts});
      } else { // it's a new message
        let drafts = draftStorage.drafts_compose || {};
        drafts = draftStorage.drafts_compose || {};
        if (storeIfTrue) {
          drafts[draftId] = {recipients, subject, date: new Date().getTime()};
        } else {
          delete drafts[draftId];
        }
        await Store.set(acctEmail, {drafts_compose: drafts});
      }
    },
    storagePassphraseGet: async () => {
      let [primaryKi] = await Store.keysGet(acctEmail, ['primary']);
      if (primaryKi === null) {
        return null; // flowcrypt just uninstalled or reset?
      }
      return await Store.passphraseGet(acctEmail, primaryKi.longid);
    },
    storageAddAdminCodes: async (shortId: string, msgAdminCode: string, attAdminCodes: string[]) => {
      let adminCodeStorage = await Store.getGlobal(['admin_codes']);
      adminCodeStorage.admin_codes = adminCodeStorage.admin_codes || {};
      adminCodeStorage.admin_codes[shortId] = {
        date: Date.now(),
        codes: [msgAdminCode].concat(attAdminCodes || []),
      };
      await Store.set(null, adminCodeStorage);
    },
    storageContactGet: (email: string[]) => Store.dbContactGet(null, email),
    storageContactUpdate: (email: string[]|string, update: ContactUpdate) => Store.dbContactUpdate(null, email, update),
    storageContactSave: (contact: Contact) => Store.dbContactSave(null, contact),
    storageContactSearch: (query: DbContactFilter) => Store.dbContactSearch(null, query),
    storageContactObj: Store.dbContactObj,
    emailProviderDraftGet: (draftId: string) => Api.gmail.draftGet(acctEmail, draftId, 'raw'),
    emailProviderDraftCreate: (mimeMsg: string) => Api.gmail.draftCreate(acctEmail, mimeMsg, urlParams.threadId as string),
    emailProviderDraftUpdate: (draftId: string, mimeMsg: string) => Api.gmail.draftUpdate(acctEmail, draftId, mimeMsg),
    emailProviderDraftDelete: (draftId: string) => Api.gmail.draftDelete(acctEmail, draftId),
    emailProviderMsgSend: (message: SendableMsg, renderUploadProgress: ProgressCb) => Api.gmail.msgSend(acctEmail, message, renderUploadProgress),
    emailEroviderSearchContacts: (query: string, knownContacts: Contact[], multiCb: any) => { // todo remove the any
      Api.gmail.searchContacts(acctEmail, query, knownContacts, multiCb).catch(e => {
        if(Api.err.isAuthPopupNeeded(e)) {
          BrowserMsg.send(parentTabId, 'notification_show_auth_popup_needed', {acctEmail});
        } else if (Api.err.isNetErr(e)) {
          // todo: render network error
        } else {
          Catch.handleException(e);
          // todo: render error
        }
      });
    },
    emailProviderDetermineReplyMsgHeaderVariables: async () => {
      try {
        let thread = await Api.gmail.threadGet(acctEmail, urlParams.threadId as string, 'full');
        if (thread.messages && thread.messages.length > 0) {
          let threadMsgIdLast = Api.gmail.findHeader(thread.messages[thread.messages.length - 1], 'Message-ID') || '';
          let threadMsgRefsLast = Api.gmail.findHeader(thread.messages[thread.messages.length - 1], 'In-Reply-To') || '';
          return {lastMsgId: thread.messages[thread.messages.length - 1].id, headers: { 'In-Reply-To': threadMsgIdLast, 'References': threadMsgRefsLast + ' ' + threadMsgIdLast }};
        } else {
          return;
        }
      } catch (e) {
        if(Api.err.isAuthPopupNeeded(e)) {
          BrowserMsg.send(parentTabId, 'notification_show_auth_popup_needed', {acctEmail});
        } else if (Api.err.isNetErr(e)) {
          // todo: render retry
        } else {
          Catch.handleException(e);
          // todo: render error
        }
      }
    },
    emailProviderExtractArmoredBlock: (msgId: string) => Api.gmail.extractArmoredBlock(acctEmail, msgId, 'full'),
    sendMsgToMainWin: (channel: string, data: Dict<Serializable>) => BrowserMsg.send(parentTabId, channel, data),
    sendMsgToBgScript: (channel: string, data: Dict<Serializable>) => BrowserMsg.send(null, channel, data),
    renderReinsertReplyBox: (lastMsgId: string, recipients: string[]) => {
      BrowserMsg.send(parentTabId, 'reinsert_reply_box', {
        acctEmail,
        myEmail: urlParams.from,
        subject: urlParams.subject,
        theirEmail: recipients.join(','),
        threadId: urlParams.threadId,
        threadMsgId: lastMsgId,
      });
    },
    renderFooterDialog: () => ($ as JQS).featherlight({iframe: factory.srcAddFooterDialog('compose'), iframeWidth: 490, iframeHeight: 230, variant: 'noscroll', afterContent: () => {
      $('.featherlight.noscroll > .featherlight-content > iframe').attr('scrolling', 'no');
    }}),
    renderAddPubkeyDialog: (emails: string[]) => {
      if (urlParams.placement !== 'settings') {
        BrowserMsg.send(parentTabId, 'add_pubkey_dialog', {emails});
      } else {
        ($ as JQS).featherlight({iframe: factory.srcAddPubkeyDialog(emails, 'settings'), iframeWidth: 515, iframeHeight: $('body').height()! - 50}); // body element is present
      }
    },
    renderHelpDialog: () => BrowserMsg.send(null, 'settings', { acctEmail, page: '/chrome/settings/modules/help.htm' }),
    renderSendingAddrDialog: () => ($ as JQS).featherlight({iframe: factory.srcSendingAddrDialog('compose'), iframeWidth: 490, iframeHeight: 500}),
    closeMsg,
    factoryAtt: (att: Att) => factory.embeddedAtta(att),
  }, {
    acctEmail,
    draftId: urlParams.draftId,
    threadId: urlParams.threadId,
    subject: urlParams.subject,
    from: urlParams.from,
    to: urlParams.to,
    frameId: urlParams.frameId,
    tabId,
    isReplyBox: urlParams.isReplyBox,
    skipClickPrompt: urlParams.skipClickPrompt,
  }, subscriptionWhenPageWasOpened);

  BrowserMsg.listen({
    close_dialog: (data, sender, respond) => {
      $('.featherlight.featherlight-iframe').remove();
    },
    set_footer: (data: {footer: string|null}, sender, respond) => {
      storage.email_footer = data.footer;
      composer.updateFooterIcon();
      $('.featherlight.featherlight-iframe').remove();
    },
    subscribe: composer.showSubscribeDialogAndWaitForRes,
    subscribe_result: (newSubscription: Subscription) => {
      if (newSubscription.active && !subscriptionWhenPageWasOpened.active) {
        subscriptionWhenPageWasOpened.active = newSubscription.active;
      }
      composer.processSubscribeRes(newSubscription);
    },
    passphrase_entry: (data) => {
      composer.passphraseEntry(data && data.entered);
    },
  }, tabId || undefined);

  if(!urlParams.isReplyBox) { // don't want to deal with resizing the frame
    await Ui.abortAndRenderErrOnUnprotectedKey(acctEmail);
  }

})();
