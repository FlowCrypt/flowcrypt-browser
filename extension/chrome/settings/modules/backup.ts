/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { BrowserMsg } from '../../../js/common/browser/browser-msg.js';
import { Str, Url } from '../../../js/common/core/common.js';
import { Assert } from '../../../js/common/assert.js';
import { Gmail } from '../../../js/common/api/email-provider/gmail/gmail.js';
import { OrgRules } from '../../../js/common/org-rules.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { View } from '../../../js/common/view.js';
import { Xss } from '../../../js/common/platform/xss.js';
import { BackupStatusModule } from './backup-status-module.js';
import { BackupManualActionModule as BackupManualModule } from './backup-manual-module.js';
import { BackupAutomaticModule } from './backup-automatic-module.js';
import { Lang } from '../../../js/common/lang.js';
import { AcctStore, EmailProvider } from '../../../js/common/platform/store/acct-store.js';
import { KeyStore } from '../../../js/common/platform/store/key-store.js';
import { ExtendedKeyInfo, KeyIdentity, KeyUtil } from '../../../js/common/core/crypto/key.js';

export class BackupView extends View {

  public readonly acctEmail: string;
  public readonly idToken: string | undefined;
  public readonly action: 'setup_automatic' | 'setup_manual' | 'backup_manual' | undefined;
  public readonly gmail: Gmail;
  public readonly parentTabId: string | undefined;

  public readonly statusModule: BackupStatusModule;
  public readonly manualModule: BackupManualModule;
  public readonly automaticModule: BackupAutomaticModule;

  public emailProvider: EmailProvider = 'gmail';
  public orgRules!: OrgRules;
  public tabId!: string;
  public prvKeysToManuallyBackup: KeyIdentity[];

  private readonly blocks = ['loading', 'module_status', 'module_manual'];

  constructor() {
    super();
    this.prvKeysToManuallyBackup = [];
    const uncheckedUrlParams = Url.parse(['acctEmail', 'parentTabId', 'action', 'idToken']);
    this.acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
    this.action = Assert.urlParamRequire.oneof(uncheckedUrlParams, 'action', ['setup_automatic', 'setup_manual', 'backup_manual', undefined]);
    if (this.action !== 'setup_automatic' && this.action !== 'setup_manual') {
      this.parentTabId = Assert.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');
    } else {
      this.idToken = Assert.urlParamRequire.string(uncheckedUrlParams, 'idToken');
    }
    this.gmail = new Gmail(this.acctEmail);
    this.statusModule = new BackupStatusModule(this);
    this.manualModule = new BackupManualModule(this);
    this.automaticModule = new BackupAutomaticModule(this);
    this.prvKeysToManuallyBackup = [];
  }

  public render = async () => {
    this.tabId = await BrowserMsg.requiredTabId();
    this.orgRules = await OrgRules.newInstance(this.acctEmail);
    const storage = await AcctStore.get(this.acctEmail, ['email_provider']);
    this.emailProvider = storage.email_provider || 'gmail';
    if (!this.orgRules.canBackupKeys()) {
      Xss.sanitizeRender('body', `<div class="line" style="margin-top: 100px;">${Lang.setup.keyBackupsNotAllowed}</div>`);
      return;
    }
    if (this.action === 'setup_automatic') {
      $('#button-go-back').css('display', 'none');
      await this.automaticModule.simpleSetupAutoBackupRetryUntilSuccessful();
    } else if (this.action === 'setup_manual') {
      $('#button-go-back').css('display', 'none');
      this.displayBlock('module_manual');
      $('h1').text('Back up your private key');
    } else if (this.action === 'backup_manual') {
      await this.preparePrvKeysBackupSelection();
      this.displayBlock('module_manual');
      $('h1').text('Back up your private key');
    } else { // action = view status
      $('.hide_if_backup_done').css('display', 'none');
      $('h1').text('Key Backups');
      this.displayBlock('loading');
      await this.statusModule.checkAndRenderBackupStatus();
    }
  }

  public renderBackupDone = async (backedUp = true) => {
    if (this.action === 'setup_automatic' || this.action === 'setup_manual') {
      window.location.href = Url.create('/chrome/settings/setup.htm', { acctEmail: this.acctEmail, action: 'finalize', idToken: this.idToken });
    } else if (backedUp) {
      await Ui.modal.info('Your private key has been successfully backed up');
      BrowserMsg.send.closePage(this.parentTabId as string);
    } else {
      window.location.href = Url.create('/chrome/settings/modules/backup.htm', { acctEmail: this.acctEmail, parentTabId: this.parentTabId as string });
    }
  }

  public displayBlock = (showBlockName: string) => {
    for (const block of this.blocks) {
      $(`#${block}`).css('display', 'none');
    }
    $(`#${showBlockName}`).css('display', 'block');
  }

  public setHandlers = async () => {
    this.statusModule.setHandlers();
    this.manualModule.setHandlers();
  }

  private addKeyToBackup = (prvKeyIdentity: KeyIdentity) => {
    this.prvKeysToManuallyBackup.push(prvKeyIdentity);
  }

  private removeKeyToBackup = (fingerprints: string[]) => {
    this.prvKeysToManuallyBackup.splice(this.prvKeysToManuallyBackup.findIndex(prvIdentity => prvIdentity.fingerprints === fingerprints), 1);
  }
  private preparePrvKeysBackupSelection = async () => {
    const primaryKeys = await KeyStore.getAllWithOptionalPassPhrase(this.acctEmail);
    if (primaryKeys.length > 1) {
      await this.renderPrvKeysBackupSelection(primaryKeys);
    } else {
      this.addKeyToBackup({ 'email': String(primaryKeys[0].emails), 'fingerprints': primaryKeys[0].fingerprints });
    }
  }

  private renderPrvKeysBackupSelection = async (primaryKeys: ExtendedKeyInfo[]) => {
    for (const primaryKi of primaryKeys) {
      const email = Xss.escape(String(primaryKi.emails![0]));
      const fingerprints = primaryKi.fingerprints;
      const keyType = (await KeyUtil.parse(primaryKi.private)).type;
      const dom = `
      <div class="mb-20">
        <div class="details">
          <label>
            <p class="m-0">
            <input class="input_prvkey_backup_checkbox" type="checkbox" data-emails="${email}" data-fingerprints="${fingerprints}" ${keyType === 'x509' ? 'disabled' : 'checked'} />
            ${email}
            </p>
            <p class="m-0 prv_fingerprint"><span>${keyType} - ${Str.spaced(fingerprints[0])}</span></p>
          </label>
        </div>
      </div>
      `.trim();
      $('.key_backup_selection').append(dom); // xss-escaped
      if (keyType !== 'x509') {
        this.addKeyToBackup({ email, fingerprints });
      }
    }
    $('.input_prvkey_backup_checkbox').click((event) => {
      const email = String($(event.target).data('emails')).trim();
      const fingerprints = String($(event.target).data('fingerprints')).split(',');
      if ($(event.target).prop('checked') && !this.prvKeysToManuallyBackup.includes({ email, fingerprints })) {
        this.addKeyToBackup({ email, fingerprints });
      } else {
        this.removeKeyToBackup(fingerprints);
      }
    });
    $('#key_backup_selection_container').show();
  }
}

View.run(BackupView);
