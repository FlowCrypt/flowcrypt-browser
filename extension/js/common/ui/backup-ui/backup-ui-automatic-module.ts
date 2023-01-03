/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Lang } from '../../lang.js';
import { Settings } from '../../settings.js';
import { UnreportableError } from '../../platform/catch.js';
import { Ui } from '../../browser/ui.js';
import { ApiErr } from '../../api/shared/api-error.js';
import { GoogleAuth } from '../../api/email-provider/gmail/google-auth.js';
import { KeyStore } from '../../platform/store/key-store.js';
import { KeyStoreUtil } from '../../core/crypto/key-store-util.js';
import { BackupUi } from './backup-ui.js';
import { BackupUiModule } from './backup-ui-module.js';

export class BackupUiAutomaticModule extends BackupUiModule<BackupUi> {
  public simpleSetupAutoBackupRetryUntilSuccessful = async () => {
    try {
      await this.setupCreateSimpleAutomaticInboxBackup();
    } catch (e) {
      return await Settings.promptToRetry(
        e,
        Lang.setup.failedToBackUpKey,
        this.setupCreateSimpleAutomaticInboxBackup,
        Lang.general.contactIfNeedAssistance(!!this.ui.fesUrl)
      );
    }
  };

  private setupCreateSimpleAutomaticInboxBackup = async () => {
    const prvs = await KeyStoreUtil.parse(await KeyStore.getRequired(this.ui.acctEmail));
    if (prvs.find(prv => !prv.key.fullyEncrypted)) {
      await Ui.modal.warning('Key not protected with a pass phrase, skipping');
      throw new UnreportableError('Key not protected with a pass phrase, skipping');
    }
    try {
      await this.ui.manualModule.doBackupOnEmailProvider(prvs.map(prv => prv.keyInfo));
      await this.ui.onBackedUpFinished();
    } catch (e) {
      if (ApiErr.isAuthErr(e)) {
        await Ui.modal.info('Authorization Error. FlowCrypt needs to reconnect your Gmail account');
        const connectResult = await GoogleAuth.newAuthPopup({ acctEmail: this.ui.acctEmail });
        if (!connectResult.error) {
          await this.setupCreateSimpleAutomaticInboxBackup();
        } else {
          throw e;
        }
      }
    }
  };
}
