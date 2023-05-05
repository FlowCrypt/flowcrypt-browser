/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Str, Url } from '../../../js/common/core/common.js';

import { ApiErr } from '../../../js/common/api/shared/api-error.js';
import { Assert } from '../../../js/common/assert.js';
import { BrowserMsg } from '../../../js/common/browser/browser-msg.js';
import { Catch } from '../../../js/common/platform/catch.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { SHARED_TENANT_API_HOST, VERSION } from '../../../js/common/core/const.js';
import { View } from '../../../js/common/view.js';
import { Xss } from '../../../js/common/platform/xss.js';
import { Lang } from '../../../js/common/lang.js';
import { isCustomerUrlFesUsed } from '../../../js/common/helpers.js';
import { ExternalService } from '../../../js/common/api/account-servers/external-service.js';

View.run(
  class HelpView extends View {
    private acctEmail: string | undefined;
    private parentTabId: string;
    private bugReport: string | undefined;
    private readonly externalService: ExternalService | undefined;

    public constructor() {
      super();
      const uncheckedUrlParams = Url.parse(['acctEmail', 'parentTabId', 'bugReport']);
      this.acctEmail = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'acctEmail');
      this.parentTabId = Assert.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');
      this.bugReport = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'bugReport');
      if (this.acctEmail) {
        this.externalService = new ExternalService(this.acctEmail);
        this.externalService.url = SHARED_TENANT_API_HOST;
      }
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
    };

    public setHandlers = () => {
      $('.action_send_feedback').on(
        'click',
        this.setHandler(el => this.sendFeedbackHandler(el))
      );
    };

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
        const res = await this.externalService?.helpFeedback(emailVal, `${textVal}\n\n\nFlowCrypt ${Catch.browser().name} ${VERSION}`);
        if (res?.sent) {
          $(target).text('sent!');
          await Ui.modal.info(`Message sent! You will find your response in ${emailVal}, check your email later.`);
          BrowserMsg.send.closePage(this.parentTabId);
        } else {
          $(target).text(origBtnText);
          await Ui.modal.error(
            `There was an error sending message. ${Lang.general.contactForSupportSentence(await isCustomerUrlFesUsed(this.acctEmail || ''))}`
          );
        }
      } catch (e) {
        ApiErr.reportIfSignificant(e);
        $(target).text(origBtnText);
        await Ui.modal.error(
          `There was an error sending message. ${Lang.general.contactForSupportSentence(await isCustomerUrlFesUsed(this.acctEmail || ''))}\n\n${ApiErr.eli5(e)}`
        );
      }
    };
  }
);
