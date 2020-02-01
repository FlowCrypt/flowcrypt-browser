/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { ViewModule } from '../../../js/common/view-module.js';
import { Xss } from '../../../js/common/platform/xss.js';
import { BackupView } from './backup.js';
import { Store } from '../../../js/common/platform/store.js';
import { Assert } from '../../../js/common/assert.js';
import { ApiErr } from '../../../js/common/api/error/api-error.js';
import { Catch } from '../../../js/common/platform/catch.js';
import { GoogleAuth } from '../../../js/common/api/google-auth.js';

export class BackupChangePpActionModule extends ViewModule<BackupView> {

  public setHandlers = () => {
    $('#content .action_change_pp_reload').click(() => window.location.reload());
    $('#content .auth_reconnect').click(this.view.setHandler(el => this.actionAuthReconnectHandler()));
  }

  public renderChangedPassPhraseGmailBackup = async (setupSimple: boolean | undefined) => {
    if (setupSimple) {
      this.view.displayBlock('loading');
      const [primaryKi] = await Store.keysGet(this.view.acctEmail, ['primary']);
      Assert.abortAndRenderErrorIfKeyinfoEmpty(primaryKi);
      try {
        await this.view.manualActionModule.doBackupOnEmailProvider(primaryKi.private);
        $('#content').text('Pass phrase changed. You will find a new backup in your inbox.');
      } catch (e) {
        if (ApiErr.isNetErr(e)) {
          Xss.sanitizeRender('#content', 'Connection failed, please <a href="#" class="action_change_pp_reload">try again</a>');
        } else if (ApiErr.isAuthPopupNeeded(e)) {
          Xss.sanitizeRender('#content', 'Need to reconnect to Google to save backup: <a href="#" class="auth_reconnect">reconnect now</a>');
        } else {
          Xss.sanitizeRender('#content', `Unknown error: ${String(e)}<br><a href="#" class="action_change_pp_reload">try again</a>`);
          Catch.reportErr(e);
        }
      }
    } else { // should never happen on this action. Just in case.
      this.view.displayBlock('module_manual');
      $('h1').text('Back up your private key');
    }
  }

  private actionAuthReconnectHandler = async () => {
    await GoogleAuth.newAuthPopup({ acctEmail: this.view.acctEmail });
    window.location.reload();
  }

}
