/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store, Subscription } from '../../js/common/platform/store.js';
import { Att } from '../../js/common/core/att.js';
import { Ui, Env } from '../../js/common/browser.js';
import { Composer } from '../../js/common/composer.js';
import { Api } from '../../js/common/api/api.js';
import { BrowserMsg } from '../../js/common/extension.js';
import { Catch } from '../../js/common/platform/catch.js';
import { Google } from '../../js/common/api/google.js';
import { Assert } from '../../js/common/assert.js';
import { Xss } from '../../js/common/platform/xss.js';
import { ComposerAppFunctionsInterface } from '../../js/common/composer/interfaces/composer-app-functions.js';

Catch.try(async () => {

  Ui.event.protect();

  const uncheckedUrlParams = Env.urlParams(['acctEmail', 'from', 'to', 'subject', 'frameId', 'threadId', 'threadMsgId', 'parentTabId', 'skipClickPrompt', 'ignoreDraft', 'debug']);
  const acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
  const parentTabId = Assert.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');
  const from = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'from') || acctEmail;
  const frameId = Assert.urlParamRequire.string(uncheckedUrlParams, 'frameId');
  const threadId = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'threadId') || '';
  const threadMsgId = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'threadMsgId') || '';
  const debug = uncheckedUrlParams.debug === true;
  const [primaryKi] = await Store.keysGet(acctEmail, ['primary']);
  let to = uncheckedUrlParams.to ? String(uncheckedUrlParams.to).split(',') : [];
  let subject = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'subject') || '';

  const att = Att.keyinfoAsPubkeyAtt(primaryKi);
  const appFunctions: ComposerAppFunctionsInterface = {
    getScopes: () => ({
      email: false, openid: false, profile: false, compose: false,
      modify: false, readContacts: false, gmail: false, read: false
    }),
    doesRecipientHaveMyPubkey: (): Promise<boolean | undefined> => Promise.resolve(false),
    storageGetAddresses: () => undefined,
    storageGetAddressesKeyserver: () => [],
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
    emailProviderGuessContactsFromSentEmails: (query, knownContacts, multiCb) => multiCb({ new: [], all: [] }),
    emailProviderExtractArmoredBlock: () => Promise.resolve(''),
    renderReinsertReplyBox: () => Promise.resolve(),
    renderAddPubkeyDialog: () => undefined,
    renderHelpDialog: () => undefined,
    closeMsg: () => undefined,
    factoryAtt: (att) => `<div>${Xss.escape(att.name)}</div>`,
    whenMasterPassphraseEntered: () => Promise.resolve(undefined),
    collectAllAvailablePublicKeys: () => Promise.reject(undefined),
    lookupPubkeyFromDbOrKeyserverAndUpdateDbIfneeded: () => Promise.reject(undefined)
  };
  await (async () => {
    if (!threadId) {
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
    const reply = Google.determineReplyCorrespondents(acctEmail, [acctEmail], gmailMsg);
    to = reply.to;
    subject = 'Re: ' + Google.gmail.findHeader(gmailMsg, 'subject') || '';
    $('#loader').remove();
  })();
  const tabId = await BrowserMsg.requiredTabId();
  const processedUrlParams = {
    acctEmail, draftId: '', threadId, threadMsgId, subject, from, to, cc: [], bcc: [], frameId, tabId, debug,
    isReplyBox: true, skipClickPrompt: false, // do not skip, would cause errors. This page is using custom template w/o a prompt
    parentTabId, disableDraftSaving: true
  };
  const composer = new Composer(appFunctions, processedUrlParams);

  const sendBtnText = 'Send Response';

  const renderInitial = async () => {
    for (const recipient of to) {
      Xss.sanitizeAppend('.email_preview', Ui.e('span', { class: 'email_address display_when_sign', text: recipient }));
    }
    $('.pubkey_file_name').text(att.name);
    composer.resizeComposeBox();
    BrowserMsg.send.scrollToElement(parentTabId, { selector: `#${frameId}` });
    $('#input_text').focus();

    Catch.setHandledTimeout(() => {
      $(window).resize(Ui.event.prevent('veryslowspree', () => composer.resizeComposeBox()));
      $('#input_text').keyup(Ui.event.prevent('slowspree', () => composer.resizeComposeBox()));
    }, 1000);
  };

  const determineReplyHeaders = async () => {
    const thread = await Google.gmail.threadGet(acctEmail, threadId, 'full');
    if (thread.messages && thread.messages.length > 0) {
      const threadMsgIdLast = Google.gmail.findHeader(thread.messages[thread.messages.length - 1], 'Message-ID') || '';
      const threadMsgRefsLast = Google.gmail.findHeader(thread.messages[thread.messages.length - 1], 'In-Reply-To') || '';
      return { 'In-Reply-To': threadMsgIdLast, 'References': threadMsgRefsLast + ' ' + threadMsgIdLast };
    }
    return { 'In-Reply-To': '', 'References': '' };
  };

  // TODO: Test this method before merging
  $('#send_btn').off().click(Ui.event.prevent('double', async target => {
    $(target).text('sending..');
    const body = { 'text/plain': $('#input_text').get(0).innerText };
    const message = await Google.createMsgObj(acctEmail, from, { to }, subject, body, [att], threadId);
    const replyHeaders = await determineReplyHeaders();
    message.headers['In-Reply-To'] = replyHeaders['In-Reply-To'];
    message.headers.References = replyHeaders.References;
    try {
      await Google.gmail.msgSend(acctEmail, message);
      BrowserMsg.send.notificationShow(parentTabId, { notification: 'Message sent' });
      Xss.sanitizeReplace('#compose', '<div data-test="container-reply-msg-successful">Message sent. The other person should use this information to send a new message.</div>');
    } catch (e) {
      if (Api.err.isAuthPopupNeeded(e)) {
        $(target).text(sendBtnText);
        BrowserMsg.send.notificationShowAuthPopupNeeded(parentTabId, { acctEmail });
        await Ui.modal.warning('Google account permission needed, please re-connect account and try again.');
      } else if (Api.err.isNetErr(e)) {
        $(target).text(sendBtnText);
        await Ui.modal.error('No internet connection, please try again.');
      } else {
        Catch.reportErr(e);
        $(target).text(sendBtnText);
        await Ui.modal.error(`${Api.err.eli5(e)}\n\nPlease try again.`);
      }
    }
  }));

  await renderInitial();

})();
