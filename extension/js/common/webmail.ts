/* © 2016-2019 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store } from './platform/store.js';
import { Injector } from './inject.js';

export class WebmailCommon {
  private acctEmail: string;
  private injector: Injector;

  constructor(acctEmail: string, injector: Injector) {
    this.acctEmail = acctEmail;
    this.injector = injector;
  }

  public addOrRemoveEndSessionBtnIfNeeded = async () => {
    const finishSessionBtn = $('.action_finish_session');
    if ((await Store.getKeysCurrentlyInSession(this.acctEmail)).length) {
      if (!finishSessionBtn.length) {
        await this.injector.insertEndSessionBtn(this.acctEmail);
      }
    } else {
      if (finishSessionBtn.length) {
        finishSessionBtn.remove();
      }
    }
  }
}
