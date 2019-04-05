/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { VERSION } from '../../../js/common/core/const.js';
import { Catch } from '../../../js/common/platform/catch.js';
import { Str } from '../../../js/common/core/common.js';
import { Xss, Ui, Env } from '../../../js/common/browser.js';
import { BrowserMsg } from '../../../js/common/extension.js';
import { Api } from '../../../js/common/api/api.js';

Catch.try(async () => {

  const uncheckedUrlParams = Env.urlParams(['acctEmail', 'parentTabId', 'bugReport']);
  const acctEmail = Env.urlParamRequire.optionalString(uncheckedUrlParams, 'acctEmail');
  const parentTabId = Env.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');
  const bugReport = Env.urlParamRequire.optionalString(uncheckedUrlParams, 'bugReport');

  if (acctEmail) {
    $('#input_email').val(acctEmail).attr('disabled', 'disabled');
  }

  if (bugReport) {
    $('h2').text('Submit Bug Report to FlowCrypt');
    $('.line.info').text('Please describe in detail what were you doing. Does this happen repeatedly?');
    $('#input_text').val(`\n\n\n--------- BUG REPORT ----------\n${bugReport}`);
  }

  $('.action_send_feedback').click(Ui.event.handle(async target => {
    const textVal = $('#input_text').val();
    const emailVal = String($('#input_email').val());
    if (!Str.isEmailValid(emailVal)) {
      $('#input_email').removeAttr('disabled').focus();
      await Ui.modal.warning('Please enter valid email - so that we can get back to you.');
      return;
    }
    if (!textVal) {
      $('#input_text').focus();
      await Ui.modal.warning('Message should not be empty.');
      return;
    }
    const origBtnText = $(target).text();
    Xss.sanitizeRender(target, Ui.spinner('white'));
    await Ui.delay(50); // give spinner time to load
    try {
      const { sent } = await Api.fc.helpFeedback(emailVal, `${textVal}\n\n\nFlowCrypt ${Catch.browser().name} ${VERSION}`);
      if (sent) {
        $(target).text('sent!');
        await Ui.modal.info(`Message sent! You will find your response in ${emailVal}, check your email later.`);
        BrowserMsg.send.closePage(parentTabId);
      } else {
        $(target).text(origBtnText);
        await Ui.modal.error('There was an error sending message. Our direct email is human@flowcrypt.com');
      }
    } catch (e) {
      if (Api.err.isSignificant(e)) {
        Catch.reportErr(e);
      }
      $(target).text(origBtnText);
      await Ui.modal.error(`There was an error sending message. Our direct email is human@flowcrypt.com\n\n${Api.err.eli5(e)}`);
    }
  }));

})();
