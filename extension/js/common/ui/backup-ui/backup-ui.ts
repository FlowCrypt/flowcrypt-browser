/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { BackupUiAutomaticModule } from './backup-ui-automatic-module.js';
import { BackupUiStatusModule } from './backup-ui-status-module.js';
import { BackupUiManualActionModule as BackupUiManualModule } from './backup-ui-manual-module.js';
import { Gmail } from '../../api/email-provider/gmail/gmail.js';
import { AcctStore, EmailProvider } from '../../platform/store/acct-store.js';
import { BrowserMsg } from '../../browser/browser-msg.js';
import { ClientConfiguration } from '../../client-configuration.js';
import { Xss } from '../../platform/xss.js';
import { KeyIdentity, KeyInfoWithIdentity, KeyUtil } from '../../core/crypto/key.js';
import { KeyStore } from '../../platform/store/key-store.js';
import { BrowserEventErrHandler, PreventableEventName, Ui } from '../../browser/ui.js';
import { Str } from '../../core/common.js';
import { Lang } from '../../lang.js';

interface BackupUiOptions {
  acctEmail: string;
  action: BackupUiActionType;
  parentTabId?: string;
  keyIdentity?: KeyIdentity;
  onBackedUpFinished: (backedUpCount: number) => Promise<void>;
}
export type BackupUiActionType = 'setup_automatic' | 'setup_manual' | 'backup_manual' | undefined;
export class BackupUi {
  public parentTabId: string | undefined; // the master page to interact (settings/index.htm)
  public acctEmail!: string;
  public gmail!: Gmail;
  public statusModule!: BackupUiStatusModule;
  public manualModule!: BackupUiManualModule;
  public automaticModule!: BackupUiAutomaticModule;
  public emailProvider: EmailProvider = 'gmail';
  public tabId!: string;
  public clientConfiguration!: ClientConfiguration;
  public fesUrl?: string;
  public identityOfKeysToManuallyBackup: KeyIdentity[] = [];
  public action: BackupUiActionType;
  public onBackedUpFinished!: (backedUpCount?: number) => Promise<void>;
  private keyIdentity: KeyIdentity | undefined; // the key identity supplied with URL params
  private readonly blocks = ['loading', 'module_status', 'module_manual'];

  public initialize = async (options: BackupUiOptions) => {
    this.acctEmail = options.acctEmail;
    this.action = options.action;
    this.parentTabId = options.parentTabId;
    this.keyIdentity = options.keyIdentity;
    this.onBackedUpFinished = options.onBackedUpFinished;
    const htmlUrl = '/chrome/elements/shared/backup.template.htm';
    const sanitized = Xss.htmlSanitize(await (await fetch(htmlUrl)).text());
    Xss.setElementContentDANGEROUSLY($('#backup-template-container').get(0) as Element, sanitized); // xss-sanitized
    this.gmail = new Gmail(this.acctEmail);
    this.statusModule = new BackupUiStatusModule(this);
    this.manualModule = new BackupUiManualModule(this);
    this.automaticModule = new BackupUiAutomaticModule(this);
    await this.renderBackupView();
    this.setBackupHandlers();
  };

  public setHandler = (cb: (e: HTMLElement, event: JQuery.Event) => void | Promise<void>, errHandlers?: BrowserEventErrHandler) => {
    return Ui.event.handle(cb, errHandlers, this);
  };

  public setHandlerPrevent = (
    evName: PreventableEventName,
    cb: (el: HTMLElement, event: Event, resetTimer: () => void) => void | Promise<void>,
    errHandlers?: BrowserEventErrHandler
  ) => {
    return Ui.event.prevent(evName, cb, errHandlers, this);
  };

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
    if (this.action === 'setup_automatic') {
      $('#button-go-back').css('display', 'none');
      await this.automaticModule.simpleSetupAutoBackupRetryUntilSuccessful();
    } else {
      await this.preparePrvKeysBackupSelection();
      if (this.action === 'setup_manual') {
        $('#button-go-back').css('display', 'none');
        this.displayBackupBlock('module_manual');
        $('h1').text('Back up your private key');
      } else if (this.action === 'backup_manual') {
        this.displayBackupBlock('module_manual');
        $('h1').text('Back up your private key');
      } else {
        // action = view status
        $('.hide_if_backup_done').css('display', 'none');
        $('h1').text('Key Backups');
        this.displayBackupBlock('loading');
        await this.statusModule.checkAndRenderBackupStatus();
      }
    }
  };

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
    this.identityOfKeysToManuallyBackup.splice(
      this.identityOfKeysToManuallyBackup.findIndex(prvIdentity => KeyUtil.identityEquals(prvIdentity, keyIdentity)),
      1
    );
  };

  private preparePrvKeysBackupSelection = async () => {
    const kinfos = await KeyStore.get(this.acctEmail);
    if (
      this.keyIdentity &&
      this.keyIdentity.family === 'openpgp' &&
      kinfos.some(ki => KeyUtil.identityEquals(ki, this.keyIdentity!)) // eslint-disable-line @typescript-eslint/no-non-null-assertion
    ) {
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
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const email = Xss.escape(String(ki.emails![0]));
      const dom = `
      <div class="mb-20">
        <div class="details">
          <label>
            <p class="m-0">
            <input class="input_prvkey_backup_checkbox" type="checkbox" data-type="${ki.family}" data-id="${ki.id}" ${
        ki.family === 'openpgp' ? 'checked' : 'disabled'
      } />
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
    $('.input_prvkey_backup_checkbox').on(
      'click',
      Ui.event.handle(target => {
        const family = $(target).data('type') as string;
        if (family === 'openpgp') {
          const id = $(target).data('id') as string;
          if ($(target).prop('checked')) {
            this.addKeyToBackup({ family, id });
          } else {
            this.removeKeyToBackup({ family, id });
          }
        }
      })
    );
    $('#key_backup_selection_container').show();
  };
}
