/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Assert } from '../../../js/common/assert.js';
import { BrowserMsg } from '../../../js/common/browser/browser-msg.js';
import { GoogleAuth } from '../../../js/common/api/google-auth.js';
import { Store } from '../../../js/common/platform/store.js';
import { Url } from '../../../js/common/core/common.js';
import { View } from '../../../js/common/view.js';

View.run(class AuthDeniedView extends View {
  private readonly acctEmail: string | undefined;
  private readonly parentTabId: string;
  private readonly emailProvider: string;

  constructor() {
    super();
    const uncheckedUrlParams = Url.parse(['acctEmail', 'parentTabId', 'emailProvider']);
    this.acctEmail = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'acctEmail');
    this.parentTabId = Assert.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');
    this.emailProvider = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'emailProvider') || 'gmail';
  }

  public render = async () => {
    if (!this.acctEmail) {
      this.renderSetupDone(false);
    } else {
      const { setup_done } = await Store.getAcct(this.acctEmail!, ['setup_done']);
      this.renderSetupDone(!!setup_done);
    }
    $('.hidable').not(`.${this.emailProvider}`).css('display', 'none');
    if (this.emailProvider === 'outlook') {
      $('.permission_send').text('Manage drafts and send emails');
      $('.permission_read').text('Read messages');
    } else { // gmail
      $('.permission_send').text('Manage drafts and send emails');
      $('.permission_read').text('Read messages');
    }
  }

  public setHandlers = () => {
    $('.action_auth_proceed').click(this.setHandler(() => BrowserMsg.send.openGoogleAuthDialog(this.parentTabId, { acctEmail: this.acctEmail })));
    $('.auth_action_limited').click(this.setHandler(() => BrowserMsg.send.openGoogleAuthDialog(this.parentTabId,
      { acctEmail: this.acctEmail, scopes: GoogleAuth.defaultScopes('compose_only') })));
    $('.close_page').click(this.setHandler(() => BrowserMsg.send.closePage(this.parentTabId)));
  }

  private renderSetupDone = (setupDone: boolean) => {
    if (setupDone) {
      $('.show_if_setup_done').css('display', 'block');
    } else {
      $('.show_if_setup_not_done').css('display', 'block');
    }
  }
});
