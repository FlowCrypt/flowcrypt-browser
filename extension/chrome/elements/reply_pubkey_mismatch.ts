/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store, Subscription } from '../../js/common/platform/store.js';
import { Att } from '../../js/common/core/att.js';
import { Xss, Ui, Env } from '../../js/common/browser.js';
import { Composer } from '../../js/common/composer.js';
import { Api } from '../../js/common/api/api.js';
import { BrowserMsg } from '../../js/common/extension.js';
import { Catch } from '../../js/common/platform/catch.js';
import { Google } from '../../js/common/api/google.js';

Catch.try(async () => {

  Ui.event.protect();

  const uncheckedUrlParams = Env.urlParams(['acctEmail', 'from', 'to', 'subject', 'frameId', 'threadId', 'threadMsgId', 'parentTabId', 'skipClickPrompt', 'ignoreDraft', 'debug']);
  const acctEmail = Env.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
  const parentTabId = Env.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');
  const from = Env.urlParamRequire.optionalString(uncheckedUrlParams, 'from') || acctEmail;
  const subject = Env.urlParamRequire.optionalString(uncheckedUrlParams, 'subject') || '';
  const frameId = Env.urlParamRequire.string(uncheckedUrlParams, 'frameId');
  const threadId = Env.urlParamRequire.optionalString(uncheckedUrlParams, 'threadId') || '';
  const to = uncheckedUrlParams.to ? String(uncheckedUrlParams.to).split(',') : [];
  const debug = uncheckedUrlParams.debug === true;

  const [primaryKi] = await Store.keysGet(acctEmail, ['primary']);

  const att = Att.keyinfoAsPubkeyAtt(primaryKi);
  const appFunctions = Composer.defaultAppFunctions();
  const tabId = await BrowserMsg.requiredTabId();
  const processedUrlParams = {
    acctEmail, draftId: '', threadId, subject, from, to, frameId, tabId, debug,
    isReplyBox: true, skipClickPrompt: false, // do not skip, would cause errors. This page is using custom template w/o a prompt
    parentTabId, disableDraftSaving: true
  };
  const composer = new Composer(appFunctions, processedUrlParams, new Subscription(undefined));

  const sendBtnText = 'Send Response';

  const renderInitial = async () => {
    for (const recipient of to) {
      Xss.sanitizeAppend('.recipients', Ui.e('span', { text: recipient }));
    }
    $('.pubkey_file_name').text(att.name);
    composer.resizeReplyBox();
    BrowserMsg.send.scrollToBottomOfConversation(parentTabId);
    $('#input_text').focus();
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

  $('#send_btn').off().click(Ui.event.prevent('double', async target => {
    $(target).text('sending..');
    const body = { 'text/plain': $('#input_text').get(0).innerText };
    const message = await Api.common.msg(acctEmail, from, to, subject, body, [att], threadId);
    const replyHeaders = await determineReplyHeaders();
    message.headers['In-Reply-To'] = replyHeaders['In-Reply-To'];
    message.headers.References = replyHeaders.References;
    try {
      await Google.gmail.msgSend(acctEmail, message);
      BrowserMsg.send.notificationShow(parentTabId, { notification: 'Message sent' });
      Xss.sanitizeReplace('#compose', 'Message sent. The other person should use this information to send a new message.');
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
