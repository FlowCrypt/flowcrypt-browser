/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Str, Url } from '../../../js/common/core/common.js';

import { ApiErr } from '../../../js/common/api/error/api-error.js';
import { Assert } from '../../../js/common/assert.js';
import { Backend } from '../../../js/common/api/backend.js';
import { BrowserMsg } from '../../../js/common/browser/browser-msg.js';
import { Catch } from '../../../js/common/platform/catch.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { VERSION } from '../../../js/common/core/const.js';
import { View } from '../../../js/common/view.js';
import { Xss } from '../../../js/common/platform/xss.js';

View.run(class HelpView extends View {

  private acctEmail: string | undefined;
  private parentTabId: string;
  private bugReport: string | undefined;

  constructor() {
    super();
    const uncheckedUrlParams = Url.parse(['acctEmail', 'parentTabId', 'bugReport']);
    this.acctEmail = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'acctEmail');
    this.parentTabId = Assert.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');
    this.bugReport = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'bugReport');
  }

  public render = async () => {
    if (this.acctEmail) {
      $('#input_email').val(this.acctEmail).attr('disabled', 'disabled');
    }
    if (this.bugReport) {
      $('h2').text('Submit Bug Report to FlowCrypt');
      $('.line.info').text('Please describe in detail what were you doing. Does this happen repeatedly?');
      $('#input_text').val(`\n\n\n--------- BUG REPORT ----------\n${this.bugReport}`);
    }
  }

  public setHandlers = () => {
    $('.action_send_feedback').click(this.setHandler(el => this.sendFeedbackHandler(el)));
  }

  // --- PRIVATE

  private sendFeedbackHandler = async (target: HTMLElement) => {
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
      const { sent } = await Backend.helpFeedback(emailVal, `${textVal}\n\n\nFlowCrypt ${Catch.browser().name} ${VERSION}`);
      if (sent) {
        $(target).text('sent!');
        await Ui.modal.info(`Message sent! You will find your response in ${emailVal}, check your email later.`);
        BrowserMsg.send.closePage(this.parentTabId);
      } else {
        $(target).text(origBtnText);
        await Ui.modal.error('There was an error sending message. Our direct email is human@flowcrypt.com');
      }
    } catch (e) {
      ApiErr.reportIfSignificant(e);
      $(target).text(origBtnText);
      await Ui.modal.error(`There was an error sending message. Our direct email is human@flowcrypt.com\n\n${ApiErr.eli5(e)}`);
    }
  }

});
