/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Lang } from '../../../js/common/lang.js';
import { ViewModule } from '../../../js/common/view-module.js';
import { BackupView } from './backup.js';
import { Settings } from '../../../js/common/settings.js';
import { Store } from '../../../js/common/platform/store.js';
import { UnreportableError } from '../../../js/common/platform/catch.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { ApiErr } from '../../../js/common/api/error/api-error.js';
import { PgpKey } from '../../../js/common/core/pgp-key.js';
import { Assert } from '../../../js/common/assert.js';
import { GoogleAuth } from '../../../js/common/api/google-auth.js';

export class BackupSetupActionModule extends ViewModule<BackupView> {

  public setHandlers = () => { // is run after renderSetupAction

  }

  public renderSetupAction = async (setupSimple: boolean | undefined) => {
    $('.back').css('display', 'none');
    if (setupSimple) {
      try {
        await this.setupCreateSimpleAutomaticInboxBackup();
      } catch (e) {
        return await Settings.promptToRetry('REQUIRED', e, Lang.setup.failedToBackUpKey, this.setupCreateSimpleAutomaticInboxBackup);
      }
    } else {
      this.view.displayBlock('module_manual');
      $('h1').text('Back up your private key');
    }
  }

  public setupCreateSimpleAutomaticInboxBackup = async () => {
    const [primaryKi] = await Store.keysGet(this.view.acctEmail, ['primary']);
    if (!(await PgpKey.read(primaryKi.private)).isFullyEncrypted()) {
      await Ui.modal.warning('Key not protected with a pass phrase, skipping');
      throw new UnreportableError('Key not protected with a pass phrase, skipping');
    }
    Assert.abortAndRenderErrorIfKeyinfoEmpty(primaryKi);
    try {
      await this.view.manualActionModule.doBackupOnEmailProvider(primaryKi.private);
      await this.view.writeBackupDoneAndRender(false, 'inbox');
    } catch (e) {
      if (ApiErr.isAuthPopupNeeded(e)) {
        await Ui.modal.info("Authorization Error. FlowCrypt needs to reconnect your Gmail account");
        const connectResult = await GoogleAuth.newAuthPopup({ acctEmail: this.view.acctEmail });
        if (!connectResult.error) {
          await this.setupCreateSimpleAutomaticInboxBackup();
        } else {
          throw e;
        }
      }
    }
  }

}
