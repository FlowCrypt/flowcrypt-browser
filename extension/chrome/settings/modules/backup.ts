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
import { KeyIdentity, KeyUtil, TypedKeyInfo } from '../../../js/common/core/crypto/key.js';

export class BackupView extends View {

  public readonly acctEmail: string;
  public readonly idToken: string | undefined;
  public readonly action: 'setup_automatic' | 'setup_manual' | 'backup_manual' | undefined;
  public readonly gmail: Gmail;
  public readonly parentTabId: string | undefined;
  public readonly keyIdentity: KeyIdentity | undefined; // the key identity supplied with URL params

  public readonly statusModule: BackupStatusModule;
  public readonly manualModule: BackupManualModule;
  public readonly automaticModule: BackupAutomaticModule;

  public emailProvider: EmailProvider = 'gmail';
  public orgRules!: OrgRules;
  public tabId!: string;
  public prvKeysToManuallyBackup: KeyIdentity[] = [];

  private readonly blocks = ['loading', 'module_status', 'module_manual'];

  constructor() {
    super();
    const uncheckedUrlParams = Url.parse(['acctEmail', 'parentTabId', 'action', 'idToken']);
    this.acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
    this.action = Assert.urlParamRequire.oneof(uncheckedUrlParams, 'action', ['setup_automatic', 'setup_manual', 'backup_manual', undefined]);
    if (this.action !== 'setup_automatic' && this.action !== 'setup_manual') {
      this.parentTabId = Assert.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');
    } else {
      this.idToken = Assert.urlParamRequire.string(uncheckedUrlParams, 'idToken');
    }
    {
      const id = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'id');
      const type = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'type');
      if (id && type === 'openpgp') {
        this.keyIdentity = { id, type };
      }
    }
    this.gmail = new Gmail(this.acctEmail);
    this.statusModule = new BackupStatusModule(this);
    this.manualModule = new BackupManualModule(this);
    this.automaticModule = new BackupAutomaticModule(this);
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
    } else {
      await this.preparePrvKeysBackupSelection();
      if (this.action === 'setup_manual') {
        $('#button-go-back').css('display', 'none');
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

  public setHandlers = () => {
    this.statusModule.setHandlers();
    this.manualModule.setHandlers();
  }

  private addKeyToBackup = (keyIdentity: KeyIdentity) => {
    if (!this.prvKeysToManuallyBackup.some(prvIdentity => KeyUtil.identityEquals(prvIdentity, keyIdentity))) {
      this.prvKeysToManuallyBackup.push(keyIdentity);
    }
  }

  private removeKeyToBackup = (keyIdentity: KeyIdentity) => {
    this.prvKeysToManuallyBackup.splice(this.prvKeysToManuallyBackup.findIndex(prvIdentity => KeyUtil.identityEquals(prvIdentity, keyIdentity)), 1);
  }

  private preparePrvKeysBackupSelection = async () => {
    const kinfos = await KeyStore.getTypedKeyInfos(this.acctEmail);
    if (this.keyIdentity && this.keyIdentity.type === 'openpgp' && kinfos.some(ki => KeyUtil.identityEquals(ki, this.keyIdentity!))) {
      // todo: error if not found ?
      this.addKeyToBackup({ id: this.keyIdentity.id, type: this.keyIdentity.type });
    } else if (kinfos.length > 1) {
      await this.renderPrvKeysBackupSelection(kinfos);
    } else if (kinfos.length === 1 && kinfos[0].type === 'openpgp') {
      this.addKeyToBackup({ id: kinfos[0].id, type: kinfos[0].type });
    }
  }

  private renderPrvKeysBackupSelection = async (kinfos: TypedKeyInfo[]) => {
    for (const ki of kinfos) {
      const email = Xss.escape(String(ki.emails![0]));
      const dom = `
      <div class="mb-20">
        <div class="details">
          <label>
            <p class="m-0">
            <input class="input_prvkey_backup_checkbox" type="checkbox" data-type="${ki.type}" data-id="${ki.id}" ${ki.type === 'openpgp' ? 'checked' : 'disabled'} />
            ${email}
            </p>
            <p class="m-0 prv_fingerprint"><span>${ki.type} - ${Str.spaced(ki.fingerprints[0])}</span></p>
          </label>
        </div>
      </div>
      `.trim();
      $('.key_backup_selection').append(dom); // xss-escaped
      if (ki.type === 'openpgp') {
        this.addKeyToBackup({ type: ki.type, id: ki.id });
      }
    }
    $('.input_prvkey_backup_checkbox').click(Ui.event.handle((target) => {
      const type = $(target).data('type') as string;
      if (type === 'openpgp') {
        const id = $(target).data('id') as string;
        if ($(target).prop('checked')) {
          this.addKeyToBackup({ type, id });
        } else {
          this.removeKeyToBackup({ type, id });
        }
      }
    }));
    $('#key_backup_selection_container').show();
  }
}

View.run(BackupView);
