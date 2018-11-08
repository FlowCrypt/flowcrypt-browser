/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Str } from '../../../js/common/common.js';
import { Xss, Ui, Env } from '../../../js/common/browser.js';
import { BrowserMsg } from '../../../js/common/extension.js';
import { Api } from '../../../js/common/api.js';
import { Catch } from '../../../js/common/catch.js';

Catch.try(async () => {

  const urlParams = Env.urlParams(['acctEmail', 'parentTabId', 'bugReport']);
  const acctEmail = urlParams.acctEmail as string | undefined;
  const parentTabId = Env.urlParamRequire.string(urlParams, 'parentTabId');
  const bugReport = urlParams.bugReport as string | undefined;

  if (acctEmail) {
    $('#input_email').val(acctEmail).attr('disabled', 'disabled');
  }

  if (bugReport) {
    $('h2').text('Submit Bug Report to FlowCrypt');
    $('.line.info').text('Please describe in detail what were you doing. Does this happen repeatedly?');
    $('#input_text').val(`\n\n\n--------- BUG REPORT ----------\n${bugReport}`);
  }

  $('.action_send_feedback').click(Ui.event.handle(async target => {
    let myEmail = acctEmail;
    if (!myEmail) {
      if (Str.isEmailValid($('#input_email').val() as string)) {
        myEmail = $('#input_email').val() as string;
      } else {
        alert('Please enter valid email - so that we can get back to you.');
        return;
      }
    }
    const origBtnText = $(target).text();
    Xss.sanitizeRender(target, Ui.spinner('white'));
    await Ui.delay(50); // give spinner time to load
    const msg = $('#input_text').val() + '\n\n\nFlowCrypt ' + Catch.browser().name + ' ' + Catch.version();
    try {
      const r = await Api.fc.helpFeedback(myEmail, msg);
      if (r.sent) {
        $(target).text('sent!');
        alert(`Message sent! You will find your response in ${myEmail}, check your email later. Thanks!`);
        BrowserMsg.send.closePage(parentTabId);
      } else {
        $(target).text(origBtnText);
        alert('There was an error sending message. Our direct email is human@flowcrypt.com');
      }
    } catch (e) {
      if (!Api.err.isNetErr(e)) {
        Catch.handleException(e);
      }
      $(target).text(origBtnText);
      alert('There was an error sending message. Our direct email is human@flowcrypt.com');
    }
  }));

})();
