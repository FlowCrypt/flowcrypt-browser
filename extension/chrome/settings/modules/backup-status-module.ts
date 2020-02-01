/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { ViewModule } from '../../../js/common/view-module.js';
import { Xss } from '../../../js/common/platform/xss.js';
import { BackupView } from './backup.js';
import { Store } from '../../../js/common/platform/store.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { ApiErr } from '../../../js/common/api/error/api-error.js';
import { BrowserMsg } from '../../../js/common/browser/browser-msg.js';

export class BackupStatusModule extends ViewModule<BackupView> {

  public setHandlers = () => { // is run after checkAndRenderBackupStatus, which renders (some of) these fields first
    $('#module_status .action_go_manual').click(this.view.setHandler(el => this.actionShowManualBackupHandler()));
    $('#module_status .action_go_auth_denied').click(this.view.setHandler(() => BrowserMsg.send.bg.settings({
      acctEmail: this.view.acctEmail, page: '/chrome/settings/modules/auth_denied.htm'
    })));
  }

  public checkAndRenderBackupStatus = async () => {
    const storage = await Store.getAcct(this.view.acctEmail, ['key_backup_method', 'email_provider']);
    const scopes = await Store.getScopes(this.view.acctEmail);
    if (this.view.emailProvider === 'gmail' && (scopes.read || scopes.modify)) {
      let keys;
      try {
        keys = await this.view.gmail.fetchKeyBackups();
      } catch (e) {
        if (ApiErr.isNetErr(e)) {
          Xss.sanitizeRender('#content', `Could not check for backups: no internet. ${Ui.retryLink()}`);
        } else if (ApiErr.isAuthPopupNeeded(e)) {
          if (this.view.parentTabId) {
            BrowserMsg.send.notificationShowAuthPopupNeeded(this.view.parentTabId, { acctEmail: this.view.acctEmail });
          }
          Xss.sanitizeRender('#content', `Could not check for backups: account needs to be re-connected. ${Ui.retryLink()}`);
        } else {
          ApiErr.reportIfSignificant(e);
          Xss.sanitizeRender('#content', `Could not check for backups: ${ApiErr.eli5(e)} (${String(e)}). ${Ui.retryLink()}`);
        }
        return;
      }
      this.view.displayBlock('module_status');
      if (keys?.length) {
        $('.status_summary').text('Backups found: ' + keys.length + '. Your account is backed up correctly in your email inbox.');
        Xss.sanitizeRender('#module_status .container', '<button class="button long green action_go_manual">SEE MORE BACKUP OPTIONS</button>');
      } else if (storage.key_backup_method) {
        if (storage.key_backup_method === 'file') {
          $('.status_summary').text('You have previously backed up your key into a file.');
          Xss.sanitizeRender('#module_status .container', '<button class="button long green action_go_manual">SEE OTHER BACKUP OPTIONS</button>');
        } else if (storage.key_backup_method === 'print') {
          $('.status_summary').text('You have previously backed up your key by printing it.');
          Xss.sanitizeRender('#module_status .container', '<button class="button long green action_go_manual">SEE OTHER BACKUP OPTIONS</button>');
        } else { // inbox or other methods
          $('.status_summary').text('There are no backups on this account. If you lose your device, or it stops working, you will not be able to read your encrypted email.');
          Xss.sanitizeRender('#module_status .container', '<button class="button long green action_go_manual">SEE BACKUP OPTIONS</button>');
        }
      } else {
        $('.status_summary').text('No backups found on this account. If you lose your device, or it stops working, you will not be able to read your encrypted email.');
        Xss.sanitizeRender('#module_status .container', '<button class="button long green action_go_manual">BACK UP MY KEY</button>');
      }
    } else { // gmail read permission not granted - cannot check for backups
      this.view.displayBlock('module_status');
      $('.status_summary').text('FlowCrypt cannot check your backups.');
      const pemissionsBtnIfGmail = this.view.emailProvider === 'gmail' ?
        '<button class="button long green action_go_auth_denied">SEE PERMISSIONS</button>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;' : '';
      Xss.sanitizeRender('#module_status .container', `${pemissionsBtnIfGmail}<button class="button long gray action_go_manual">SEE BACKUP OPTIONS</button>`);
    }
  }

  private actionShowManualBackupHandler = async () => {
    this.view.displayBlock('module_manual');
    $('h1').text('Back up your private key');
  }

}
