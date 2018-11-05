/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store, Subscription, Serializable } from '../../js/common/store.js';
import { Dict } from './../../js/common/common.js';
import { Att } from '../../js/common/att.js';
import { Xss, Ui, Env } from '../../js/common/browser.js';
import { Composer } from './../../js/common/composer.js';
import { Api } from '../../js/common/api.js';
import { BrowserMsg } from '../../js/common/extension.js';
import { Catch } from '../../js/common/catch.js';
import { FlatHeaders } from '../../js/common/mime.js';

Catch.try(async () => {

  Ui.event.protect();

  const urlParams = Env.urlParams(['acctEmail', 'from', 'to', 'subject', 'frameId', 'threadId', 'threadMsgId', 'parentTabId', 'skipClickPrompt', 'ignoreDraft']);
  const acctEmail = Env.urlParamRequire.string(urlParams, 'acctEmail');
  const parentTabId = Env.urlParamRequire.string(urlParams, 'parentTabId');
  const to = urlParams.to ? String(urlParams.to).split(',') : [];

  const [primaryKi] = await Store.keysGet(acctEmail, ['primary']);

  const att = Att.keyinfoAsPubkeyAtt(primaryKi);
  let additionalMsgHeaders: FlatHeaders;

  const appFunctions = Composer.defaultAppFunctions();
  appFunctions.sendMsgToMainWin = (channel: string, data: Dict<Serializable>) => BrowserMsg.send(parentTabId, channel, data);
  const composer = new Composer(appFunctions, { isReplyBox: true, frameId: urlParams.frameId, disable_draft_saving: true }, new Subscription(null));

  const sendBtnText = 'Send Response';

  for (const recipient of to) {
    Xss.sanitizeAppend('.recipients', Ui.e('span', { text: recipient }));
  }

  // render
  $('.pubkey_file_name').text(att.name);
  composer.resizeReplyBox();
  BrowserMsg.send(parentTabId, 'scroll_to_bottom_of_conversation');
  $('#input_text').focus();

  // determine reply headers
  try {
    const thread = await Api.gmail.threadGet(acctEmail, urlParams.threadId as string, 'full');
    if (thread.messages && thread.messages.length > 0) {
      const threadMsgIdLast = Api.gmail.findHeader(thread.messages[thread.messages.length - 1], 'Message-ID') || '';
      const threadMsgRefsLast = Api.gmail.findHeader(thread.messages[thread.messages.length - 1], 'In-Reply-To') || '';
      additionalMsgHeaders = { 'In-Reply-To': threadMsgIdLast, 'References': threadMsgRefsLast + ' ' + threadMsgIdLast };
    }
  } catch (e) {
    if (Api.err.isAuthPopupNeeded(e)) {
      BrowserMsg.send(parentTabId, 'notification_show_auth_popup_needed', { acctEmail });
    } else if (Api.err.isNetErr(e)) {
      // todo - render retry button
    } else {
      Catch.handleException(e);
      // todo - render error
    }
  }

  // send
  $('#send_btn').click(Ui.event.prevent('double', async target => {
    $(target).text('sending..');
    const body = { 'text/plain': $('#input_text').get(0).innerText };
    const message = await Api.common.msg(acctEmail, urlParams.from as string, to, urlParams.subject as string, body, [att], urlParams.threadId as string);
    for (const k of Object.keys(additionalMsgHeaders)) {
      message.headers[k] = additionalMsgHeaders[k];
    }
    try {
      await Api.gmail.msgSend(acctEmail, message);
      BrowserMsg.send(parentTabId, 'notification_show', { notification: 'Message sent.' });
      Xss.sanitizeReplace('#compose', 'Message sent. The other person should use this information to send a new message.');
    } catch (e) {
      if (Api.err.isAuthPopupNeeded(e)) {
        $(target).text(sendBtnText);
        BrowserMsg.send(parentTabId, 'notification_show_auth_popup_needed', { acctEmail });
        alert('Google account permission needed, please re-connect account and try again.');
      } else if (Api.err.isNetErr(e)) {
        $(target).text(sendBtnText);
        alert('No internet connection, please try again.');
      } else {
        Catch.handleException(e);
        $(target).text(sendBtnText);
        alert('There was an error sending, please try again.');
      }
    }
  }));

})();
