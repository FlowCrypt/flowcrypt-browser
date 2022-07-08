/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Assert } from '../../../js/common/assert.js';
import { BrowserMsg } from '../../../js/common/browser/browser-msg.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { Url } from '../../../js/common/core/common.js';
import { Settings } from '../../../js/common/settings.js';
import { BackupUi, BackupUiActionType } from '../../../js/common/ui/backup-ui.js';
import { View } from '../../../js/common/view.js';

export class BackupView extends BackupUi {

  constructor() {
    super();
    const uncheckedUrlParams = Url.parse(['acctEmail', 'parentTabId', 'idToken', 'id', 'type']);
    const acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
    const action = Assert.urlParamRequire.oneof(uncheckedUrlParams, 'action', ['backup_manual', undefined]);
    const parentTabId = Assert.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');
    const keyIdentityId = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'id');
    const keyIdentityFamily = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'type');
    void this.initialize(acctEmail, action as BackupUiActionType, parentTabId, keyIdentityId, keyIdentityFamily);
  }

  public renderBackupDone = async (backedUpCount: number) => {
    if (backedUpCount > 0) {
      const pluralOrSingle = backedUpCount > 1 ? "keys have" : "key has";
      await Ui.modal.info(`Your private ${pluralOrSingle} been successfully backed up`);
      if (this.parentTabId) {
        BrowserMsg.send.closePage(this.parentTabId);
      }
    } else if (this.parentTabId) { // should be always true as setup_manual is excluded by this point
      Settings.redirectSubPage(this.acctEmail, this.parentTabId, '/chrome/settings/modules/backup.htm');
    }
  };

  public render = async () => {
    // defined as needed will be rendered with renderBackupView function
  };

  public setHandlers = async () => {
    // defined as needed
  };
}
View.run(BackupView);
