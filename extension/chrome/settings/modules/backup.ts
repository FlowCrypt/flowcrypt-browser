/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Assert } from '../../../js/common/assert.js';
import { BrowserMsg } from '../../../js/common/browser/browser-msg.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { Url } from '../../../js/common/core/common.js';
import { KeyIdentity } from '../../../js/common/core/crypto/key.js';
import { Settings } from '../../../js/common/settings.js';
import { BackupUi, BackupUiActionType } from '../../../js/common/ui/backup-ui/backup-ui.js';
import { View } from '../../../js/common/view.js';

export class BackupView extends View {

  private readonly backupUi: BackupUi;

  constructor() {
    super();
    const uncheckedUrlParams = Url.parse(['acctEmail', 'parentTabId', 'action', 'idToken', 'id', 'type']);
    const acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
    const action = Assert.urlParamRequire.oneof(uncheckedUrlParams, 'action', ['backup_manual', undefined]);
    const parentTabId = Assert.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');
    const keyIdentityId = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'id');
    const keyIdentityFamily = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'type');
    let keyIdentity: KeyIdentity | undefined;
    if (keyIdentityId && keyIdentityFamily === 'openpgp') {
      keyIdentity = { id: keyIdentityId, family: keyIdentityFamily };
    }
    this.backupUi = new BackupUi();
    void this.backupUi.initialize({
      acctEmail,
      action: action as BackupUiActionType,
      parentTabId,
      keyIdentity,
      onBackedUpFinished: async (backedUpCount: number) => {
        if (backedUpCount > 0) {
          const pluralOrSingle = backedUpCount > 1 ? "keys have" : "key has";
          await Ui.modal.info(`Your private ${pluralOrSingle} been successfully backed up`);
          BrowserMsg.send.closePage(parentTabId);
        } else {
          Settings.redirectSubPage(acctEmail, parentTabId, '/chrome/settings/modules/backup.htm');
        }
      }
    });
  }

  public render = async () => {
    // defined as needed will be rendered with BackupUi
  };

  public setHandlers = async () => {
    // defined as needed
  };
}
View.run(BackupView);
