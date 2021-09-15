/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { ViewModule } from '../../../js/common/view-module.js';
import { Xss } from '../../../js/common/platform/xss.js';
import { BackupView } from './backup.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { ApiErr } from '../../../js/common/api/shared/api-error.js';
import { Browser } from '../../../js/common/browser/browser.js';
import { BrowserMsg } from '../../../js/common/browser/browser-msg.js';
import { Backups } from '../../../js/common/api/email-provider/email-provider-api.js';
import { ExtendedKeyInfo, KeyInfo } from '../../../js/common/core/crypto/key.js';
import { Str } from '../../../js/common/core/common.js';
import { KeyStore } from '../../../js/common/platform/store/key-store.js';
export class BackupStatusModule extends ViewModule<BackupView> {

  public setHandlers = () => { // is run after checkAndRenderBackupStatus, which renders (some of) these fields first
    $('#module_status .action_go_manual').click(this.view.setHandler(() => this.actionShowManualBackupHandler()));
    $('#module_status .action_go_add_key').click(this.view.setHandler(async () => await this.goTo('add_key.htm')));
  }

  public checkAndRenderBackupStatus = async () => {
    try {
      const backups = await this.view.gmail.fetchKeyBackups();
      this.view.displayBlock('module_status');
      this.renderBackupSummaryAndActionButtons(backups);
      this.renderBackupDetailsText(backups);
    } catch (e) {
      if (ApiErr.isNetErr(e)) {
        Xss.sanitizeRender('#content', `Could not check for backups: no internet. ${Ui.retryLink()}`);
      } else if (ApiErr.isAuthErr(e)) {
        if (this.view.parentTabId) {
          BrowserMsg.send.notificationShowAuthPopupNeeded(this.view.parentTabId, { acctEmail: this.view.acctEmail });
        }
        Xss.sanitizeRender('#content', `Could not check for backups: account needs to be re-connected. ${Ui.retryLink()}`);
      } else {
        ApiErr.reportIfSignificant(e);
        Xss.sanitizeRender('#content', `Could not check for backups: ${ApiErr.eli5(e)} (${String(e)}). ${Ui.retryLink()}`);
      }
    }
  }

  private renderBackupSummaryAndActionButtons = (backups: Backups) => {
    if (!backups.longids.backups.length) {
      $('.status_summary').text('No backups found on this account. If you lose your device, or it stops working, you will not be able to read your encrypted email.');
      Xss.sanitizeRender('#module_status .container', '<button class="button long green action_go_manual">BACK UP MY KEY</button>');
    } else if (backups.longids.importedNotBackedUp.length) {
      $('.status_summary').text('Some of your keys have not been backed up.');
      Xss.sanitizeRender('#module_status .container', '<button class="button long green action_go_manual">BACKUP ALL KEYS</button>');
    } else if (backups.longids.backupsNotImported.length) {
      $('.status_summary').text('Some of your backups have not been loaded. This may cause incoming encrypted email to not be readable.');
      Xss.sanitizeRender('#module_status .container', '<button class="button long green action_go_add_key">IMPORT MISSING BACKUPS</button>');
    } else {
      $('.status_summary').text('Your account keys are backed up and loaded correctly.');
      Xss.sanitizeRender('#module_status .container', '<button class="button long green action_go_manual">SEE BACKUP OPTIONS</button>');
    }
  }

  private renderBackupDetailsText = (backups: Backups) => {
    const detailLines = [
      `Backups total: ${this.describeBackupCounts(backups.longids.backups, backups.keyinfos.backups)}`,
      `Backups imported: ${backups.longids.backupsImported.length}`,
    ];
    if (backups.keyinfos.backupsNotImported.length) {
      detailLines.push(`Backups left to import: ${this.describeBackupCounts(backups.longids.backupsNotImported, backups.keyinfos.backupsNotImported)}`);
    }
    if (backups.keyinfos.importedNotBackedUp.length) {
      detailLines.push(`Keys missing backup: ${backups.keyinfos.importedNotBackedUp.length}`);
    }
    $('pre.status_details').text(detailLines.join('\n'));
  }

  private describeBackupCounts = (longids: string[], keyinfos: KeyInfo[]) => {
    let text = `${longids.length}`;
    if (keyinfos.length !== longids.length) {
      text += ` keys represented by ${Str.pluralize(keyinfos.length, 'backup')}`;
    }
    return text;
  }

  private actionShowManualBackupHandler = async () => {
    const primaryKeys = await KeyStore.getAllWithOptionalPassPhrase(this.view.acctEmail);
    if (primaryKeys.length > 1) {
      this.renderPrvKeysBackupSelection(primaryKeys);
    }
    this.view.displayBlock('module_manual');
    $('h1').text('Back up your private key');
  }

  private renderPrvKeysBackupSelection = (primaryKeys: ExtendedKeyInfo[]) => {
    for (const primaryKi of primaryKeys) {
      const dom = `
      <div class="mb-20">
        <div class="details">
          <label>
            <input class="input_prvkey_backup_checkbox" type="checkbox" data-emails="${primaryKi.emails}" data-fingerprint="${primaryKi.fingerprints}" />
            <div class="display_inline_block">
              <p class="m-0">Email: <span class="prv_email">${primaryKi.emails}</span> with fingerprint <span class="prv_fingerprint green">${primaryKi.fingerprints}</span></p>
            </div>
          </label>
        </div>
      </div>
      `.trim();
      $('.key_backup_selection').append(Xss.escape(dom)); // xss-escaped
    }
    $('.input_prvkey_backup_checkbox').click((event) => {
      const email = $(event.target).data('emails');
      const fingerprint = $(event.target).data('fingerprints');
      if ($(event.target).prop('checked')) {
        this.view.prvKeysToManuallyBackup.push({ 'email': email, 'fingerprints': fingerprint });
      } else {
        this.view.prvKeysToManuallyBackup.splice(this.view.prvKeysToManuallyBackup.findIndex(prvIdentity => prvIdentity.fingerprints === fingerprint), 1);
      }
    });
    $('#key_backup_selection_container').show();
  }

  private goTo = async (page: string) => {
    await Browser.openSettingsPage('index.htm', this.view.acctEmail, `/chrome/settings/modules/${page}`);
  }

}
