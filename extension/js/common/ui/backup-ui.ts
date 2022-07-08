/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { BackupAutomaticModule } from '../../../chrome/settings/modules/backup-automatic-module.js';
import { BackupStatusModule } from '../../../chrome/settings/modules/backup-status-module.js';
import { BackupManualActionModule as BackupManualModule } from '../../../chrome/settings/modules/backup-manual-module.js';
import { Gmail } from '../api/email-provider/gmail/gmail.js';
import { View } from '../view.js';
import { AcctStore, EmailProvider } from '../platform/store/acct-store.js';
import { BrowserMsg } from '../browser/browser-msg.js';
import { ClientConfiguration } from '../client-configuration.js';
import { Xss } from '../platform/xss.js';
import { KeyIdentity, KeyInfoWithIdentity, KeyUtil } from '../core/crypto/key.js';
import { KeyStore } from '../platform/store/key-store.js';
import { Ui } from '../browser/ui.js';
import { Str } from '../core/common.js';
import { Lang } from '../lang.js';

export type BackupUiActionType = 'setup_automatic' | 'setup_manual' | 'backup_manual' | undefined;
export abstract class BackupUi extends View {

  public parentTabId: string | undefined; // the master page to interact (settings/index.htm)
  public acctEmail!: string;
  public gmail!: Gmail;
  public statusModule!: BackupStatusModule;
  public manualModule!: BackupManualModule;
  public automaticModule!: BackupAutomaticModule;
  public emailProvider: EmailProvider = 'gmail';
  public tabId!: string;
  public clientConfiguration!: ClientConfiguration;
  public fesUrl?: string;
  public identityOfKeysToManuallyBackup: KeyIdentity[] = [];
  public backupAction: BackupUiActionType;
  private keyIdentity: KeyIdentity | undefined; // the key identity supplied with URL params
  private readonly blocks = ['loading', 'module_status', 'module_manual'];

  constructor() {
    super();
  }

  public async initialize(
    acctEmail: string,
    backupAction: BackupUiActionType,
    parentTabId: string | undefined,
    keyIdentityId: string | undefined,
    keyIdentityFamily: string | undefined
  ) {
    this.acctEmail = acctEmail;
    this.backupAction = backupAction;
    this.parentTabId = parentTabId;
    if (keyIdentityId && keyIdentityFamily === 'openpgp') {
      this.keyIdentity = { id: keyIdentityId, family: keyIdentityFamily };
    }
    const htmlUrl = '/chrome/elements/shared/backup.template.htm';
    $('#backup-template-container').html(await (await fetch(htmlUrl)).text());
    this.gmail = new Gmail(this.acctEmail);
    this.statusModule = new BackupStatusModule(this);
    this.manualModule = new BackupManualModule(this);
    this.automaticModule = new BackupAutomaticModule(this);
    await this.renderBackupView();
    this.setBackupHandlers();
  }

  public renderBackupView = async () => {
    this.tabId = await BrowserMsg.requiredTabId();
    this.clientConfiguration = await ClientConfiguration.newInstance(this.acctEmail);
    const storage = await AcctStore.get(this.acctEmail, ['email_provider', 'fesUrl']);
    this.fesUrl = storage.fesUrl;
    this.emailProvider = storage.email_provider || 'gmail';
    if (!this.clientConfiguration.canBackupKeys()) {
      Xss.sanitizeRender('body', `<div class="line" style="margin-top: 100px;">${Lang.setup.keyBackupsNotAllowed}</div>`);
      return;
    }
    if (this.backupAction === 'setup_automatic') {
      $('#button-go-back').css('display', 'none');
      await this.automaticModule.simpleSetupAutoBackupRetryUntilSuccessful();
    } else {
      await this.preparePrvKeysBackupSelection();
      if (this.backupAction === 'setup_manual') {
        $('#button-go-back').css('display', 'none');
        this.displayBackupBlock('module_manual');
        $('h1').text('Back up your private key');
      } else if (this.backupAction === 'backup_manual') {
        this.displayBackupBlock('module_manual');
        $('h1').text('Back up your private key');
      } else { // action = view status
        $('.hide_if_backup_done').css('display', 'none');
        $('h1').text('Key Backups');
        this.displayBackupBlock('loading');
        await this.statusModule.checkAndRenderBackupStatus();
      }
    }
  };

  public render(): Promise<void> {
    throw new Error('should be implemented');
  }

  public setHandlers(): void | Promise<void> {
    throw new Error('should be implemented');
  }

  public abstract renderBackupDone(backedUpCount: number): Promise<void>;

  public displayBackupBlock = (showBlockName: string) => {
    for (const block of this.blocks) {
      $(`#${block}`).css('display', 'none');
    }
    $(`#${showBlockName}`).css('display', 'block');
  };

  public setBackupHandlers = () => {
    this.statusModule.setHandlers();
    this.manualModule.setHandlers();
  };

  private addKeyToBackup = (keyIdentity: KeyIdentity) => {
    if (!this.identityOfKeysToManuallyBackup.some(prvIdentity => KeyUtil.identityEquals(prvIdentity, keyIdentity))) {
      this.identityOfKeysToManuallyBackup.push(keyIdentity);
    }
  };

  private removeKeyToBackup = (keyIdentity: KeyIdentity) => {
    this.identityOfKeysToManuallyBackup.splice(this.identityOfKeysToManuallyBackup.findIndex(prvIdentity => KeyUtil.identityEquals(prvIdentity, keyIdentity)), 1);
  };

  private preparePrvKeysBackupSelection = async () => {
    const kinfos = await KeyStore.get(this.acctEmail);
    if (this.keyIdentity && this.keyIdentity.family === 'openpgp' && kinfos.some(ki => KeyUtil.identityEquals(ki, this.keyIdentity!))) {
      // todo: error if not found ?
      this.addKeyToBackup({ id: this.keyIdentity.id, family: this.keyIdentity.family });
    } else if (kinfos.length > 1) {
      await this.renderPrvKeysBackupSelection(kinfos);
    } else if (kinfos.length === 1 && kinfos[0].family === 'openpgp') {
      this.addKeyToBackup({ id: kinfos[0].id, family: kinfos[0].family });
    }
  };

  private renderPrvKeysBackupSelection = async (kinfos: KeyInfoWithIdentity[]) => {
    for (const ki of kinfos) {
      const email = Xss.escape(String(ki.emails![0]));
      const dom = `
      <div class="mb-20">
        <div class="details">
          <label>
            <p class="m-0">
            <input class="input_prvkey_backup_checkbox" type="checkbox" data-type="${ki.family}" data-id="${ki.id}" ${ki.family === 'openpgp' ? 'checked' : 'disabled'} />
            ${email}
            </p>
            <p class="m-0 prv_fingerprint"><span>${ki.family} - ${Str.spaced(ki.fingerprints[0])}</span></p>
          </label>
        </div>
      </div>
      `.trim();
      $('.key_backup_selection').append(dom); // xss-escaped
      if (ki.family === 'openpgp') {
        this.addKeyToBackup({ family: ki.family, id: ki.id });
      }
    }
    $('.input_prvkey_backup_checkbox').click(Ui.event.handle((target) => {
      const family = $(target).data('type') as string;
      if (family === 'openpgp') {
        const id = $(target).data('id') as string;
        if ($(target).prop('checked')) {
          this.addKeyToBackup({ family, id });
        } else {
          this.removeKeyToBackup({ family, id });
        }
      }
    }));
    $('#key_backup_selection_container').show();
  };
}