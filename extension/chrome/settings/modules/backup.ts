/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { BrowserMsg } from '../../../js/common/browser/browser-msg.js';
import { Url } from '../../../js/common/core/common.js';
import { Assert } from '../../../js/common/assert.js';
import { Gmail } from '../../../js/common/api/email-provider/gmail/gmail.js';
import { Rules } from '../../../js/common/rules.js';
import { View } from '../../../js/common/view.js';
import { Xss } from '../../../js/common/platform/xss.js';
import { BackupStatusModule } from './backup-status-module.js';
import { BackupManualActionModule as BackupManualModule } from './backup-manual-module.js';
import { BackupAutomaticModule } from './backup-automatic-module.js';
import { Lang } from '../../../js/common/lang.js';
import { AcctStore, EmailProvider } from '../../../js/common/platform/store/acct-store.js';

export class BackupView extends View {

  public readonly statusModule: BackupStatusModule;
  public readonly manualModule: BackupManualModule;
  public readonly automaticModule: BackupAutomaticModule;

  public readonly acctEmail: string;
  public emailProvider: EmailProvider = 'gmail';
  public rules!: Rules;
  public readonly action: 'setup_automatic' | 'setup_manual' | 'backup_manual' | undefined;
  public readonly gmail: Gmail;
  public readonly parentTabId: string | undefined;
  public tabId!: string;

  private blocks = ['loading', 'module_status', 'module_manual'];

  constructor() {
    super();
    const uncheckedUrlParams = Url.parse(['acctEmail', 'parentTabId', 'action']);
    this.acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
    this.action = Assert.urlParamRequire.oneof(uncheckedUrlParams, 'action', ['setup_automatic', 'setup_manual', 'backup_manual', undefined]);
    if (this.action !== 'setup_automatic' && this.action !== 'setup_manual') {
      this.parentTabId = Assert.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');
    }
    this.gmail = new Gmail(this.acctEmail);
    this.statusModule = new BackupStatusModule(this);
    this.manualModule = new BackupManualModule(this);
    this.automaticModule = new BackupAutomaticModule(this);
  }

  public render = async () => {
    this.tabId = await BrowserMsg.requiredTabId();
    this.rules = await Rules.newInstance(this.acctEmail);
    const storage = await AcctStore.getAcct(this.acctEmail, ['email_provider']);
    this.emailProvider = storage.email_provider || 'gmail';
    if (!this.rules.canBackupKeys()) {
      Xss.sanitizeRender('body', `<div class="line" style="margin-top: 100px;">${Lang.setup.keyBackupsNotAllowed}</div>`);
      return;
    }
    if (this.action === 'setup_automatic') {
      $('.back').css('display', 'none');
      await this.automaticModule.simpleSetupAutoBackupRetryUntilSuccessful();
    } else if (this.action === 'setup_manual') {
      $('.back').css('display', 'none');
      this.displayBlock('module_manual');
      $('h1').text('Back up your private key');
    } else if (this.action === 'backup_manual') {
      this.displayBlock('module_manual');
      $('h1').text('Back up your private key');
    } else { // action = view status
      $('.hide_if_backup_done').css('display', 'none');
      $('h1').text('Key Backups');
      this.displayBlock('loading');
      await this.statusModule.checkAndRenderBackupStatus();
    }
  }

  public renderBackupDone = async () => {
    if (this.action === 'setup_automatic' || this.action === 'setup_manual') {
      window.location.href = Url.create('/chrome/settings/setup.htm', { acctEmail: this.acctEmail, action: 'finalize' });
    } else {
      window.location.reload();
    }
  }

  public displayBlock = (showBlockName: string) => {
    for (const block of this.blocks) {
      $(`#${block}`).css('display', 'none');
    }
    $(`#${showBlockName}`).css('display', 'block');
  }

  public setHandlers = () => {
    this.statusModule.setHandlers();
    this.manualModule.setHandlers();
  }

}

View.run(BackupView);
