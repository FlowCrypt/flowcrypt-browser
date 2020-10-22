/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Assert } from '../../../js/common/assert.js';
import { BrowserMsg } from '../../../js/common/browser/browser-msg.js';
import { Url } from '../../../js/common/core/common.js';
import { View } from '../../../js/common/view.js';

View.run(class AuthDeniedView extends View {
  private readonly acctEmail: string | undefined;
  private readonly parentTabId: string;

  constructor() {
    super();
    const uncheckedUrlParams = Url.parse(['acctEmail', 'parentTabId']);
    this.acctEmail = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'acctEmail');
    this.parentTabId = Assert.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');
  }

  public render = async () => {
    $('.display_if_rendered_as_subpage').css('display', 'block');
  }

  public setHandlers = () => {
    $('.action_auth_proceed').click(this.setHandler(() => BrowserMsg.send.openGoogleAuthDialog(this.parentTabId, { acctEmail: this.acctEmail })));
    $('.close_page').click(this.setHandler(() => BrowserMsg.send.closePage(this.parentTabId)));
  }

});
