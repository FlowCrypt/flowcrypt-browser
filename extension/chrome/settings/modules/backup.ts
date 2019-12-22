/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch, UnreportableError } from '../../../js/common/platform/catch.js';
import { Store, KeyBackupMethod, EmailProvider } from '../../../js/common/platform/store.js';
import { Value, Url, PromiseCancellation } from '../../../js/common/core/common.js';
import { Att } from '../../../js/common/core/att.js';
import { Browser } from '../../../js/common/browser/browser.js';
import { BrowserMsg, Bm } from '../../../js/common/browser/browser-msg.js';
import { Rules } from '../../../js/common/rules.js';
import { Lang } from '../../../js/common/lang.js';
import { Settings } from '../../../js/common/settings.js';
import { GoogleAuth } from '../../../js/common/api/google-auth.js';
import { Buf } from '../../../js/common/core/buf.js';
import { GMAIL_RECOVERY_EMAIL_SUBJECTS } from '../../../js/common/core/const.js';
import { Assert } from '../../../js/common/assert.js';
import { initPassphraseToggle } from '../../../js/common/ui/passphrase_ui.js';
import { Xss } from '../../../js/common/platform/xss.js';
import { View } from '../../../js/common/view.js';
import { KeyImportUi } from './../../../js/common/ui/key_import_ui.js';
import { Gmail } from '../../../js/common/api/email_provider/gmail/gmail.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { ApiErr } from '../../../js/common/api/error/api-error.js';
import { PgpKey, KeyInfo } from '../../../js/common/core/pgp-key.js';

View.run(class BackupView extends View {
  private readonly gmail: Gmail;

  private acctEmail: string;
  private parentTabId: string | undefined;
  private tabId!: string;
  private action: string | undefined;
  private keyImportUi = new KeyImportUi({});
  private emailProvider: EmailProvider = 'gmail';
  private ppChangedPromiseCancellation: PromiseCancellation = { cancel: false };

  private blocks = ['loading', 'step_0_status', 'step_1_password', 'step_2_confirm', 'step_3_automatic_backup_retry', 'step_3_manual'];

  constructor() {
    super();
    const uncheckedUrlParams = Url.parse(['acctEmail', 'parentTabId', 'action']);
    this.acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
    this.action = Assert.urlParamRequire.oneof(uncheckedUrlParams, 'action', ['setup', 'passphrase_change_gmail_backup', 'options', undefined]);
    if (this.action !== 'setup') {
      this.parentTabId = Assert.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');
    }
    this.gmail = new Gmail(this.acctEmail);
  }

  render = async () => {
    this.tabId = await BrowserMsg.requiredTabId();
    const storage = await Store.getAcct(this.acctEmail, ['setup_simple', 'email_provider']);
    this.emailProvider = storage.email_provider || 'gmail';
    const rules = await Rules.newInstance(this.acctEmail);
    if (!rules.canBackupKeys()) {
      Xss.sanitizeRender('body', `<div class="line" style="margin-top: 100px;">${Lang.setup.keyBackupsNotAllowed}</div>`);
      return;
    }
    await initPassphraseToggle(['password', 'password2']);
    this.keyImportUi.renderPassPhraseStrengthValidationInput($('#password'), $('.action_password'));
    if (this.action === 'setup') {
      await this.renderSetupAction(storage.setup_simple);
    } else if (this.action === 'passphrase_change_gmail_backup') {
      await this.renderChangedPassPhraseGmailBackup(storage.setup_simple);
    } else if (this.action === 'options') {
      this.displayBlock('step_3_manual');
      $('h1').text('Back up your private key');
    } else {
      $('.hide_if_backup_done').css('display', 'none');
      $('h1').text('Key Backups');
      this.displayBlock('loading');
      await this.checkAndRenderBackupStatus();
    }
  }

  setHandlers = () => {
    $('.action_password').click(this.setHandler(el => this.actionEnterPassPhraseHandler(el)));
    $('.action_reset_password').click(this.setHandler(el => this.actionResetPassPhraseEntryHandler()));
    $('.action_backup').click(this.setHandlerPrevent('double', el => this.actionBackupHandler(el)));
    $('.action_manual_backup').click(this.setHandlerPrevent('double', el => this.actionManualBackupHandler()));
    $('.action_skip_backup').click(this.setHandler(el => this.actionSkipBackupHandler()));
    $('#step_3_manual input[name=input_backup_choice]').click(this.setHandler(el => this.actionSelectBackupMethodHandler(el)));
    $('.action_go_manual').click(this.setHandler(el => this.actionShowManualBackupHandler()));
    $('.action_proceed_default_backup_choice').click(this.setHandler(el => this.actionProceedDefaultBackupChoice()));
    $('.action_go_auth_denied').click(this.setHandler(() => BrowserMsg.send.bg.settings({ acctEmail: this.acctEmail, page: '/chrome/settings/modules/auth_denied.htm' })));
    $('.auth_reconnect').click(this.setHandler(el => this.actionAuthReconnectHandler()));
    $('.reload').click(() => window.location.reload());
    $("#password2").keydown(this.setEnterHandlerThatClicks('.action_backup'));
    BrowserMsg.addListener('passphrase_entry', async ({ entered }: Bm.PassphraseEntry) => {
      if (!entered) {
        this.ppChangedPromiseCancellation.cancel = true; // update original object which is monitored by a promise
        this.ppChangedPromiseCancellation = { cancel: false }; // set to a new, not yet used object
      }
    });
    BrowserMsg.listen(this.tabId);
  }

  // --- PRIVATE

  private renderSetupAction = async (setupSimple: boolean | undefined) => {
    $('.back').css('display', 'none');
    $('.action_skip_backup').parent().css('display', 'none');
    if (setupSimple) {
      try {
        await this.setupCreateSimpleAutomaticInboxBackup();
      } catch (e) {
        return await Settings.promptToRetry('REQUIRED', e, Lang.setup.failedToBackUpKey, this.setupCreateSimpleAutomaticInboxBackup);
      }
    } else {
      this.displayBlock('step_3_manual');
      $('h1').text('Back up your private key');
    }
  }

  private renderChangedPassPhraseGmailBackup = async (setupSimple: boolean | undefined) => {
    if (setupSimple) {
      this.displayBlock('loading');
      const [primaryKi] = await Store.keysGet(this.acctEmail, ['primary']);
      Assert.abortAndRenderErrorIfKeyinfoEmpty(primaryKi);
      try {
        await this.doBackupOnEmailProvider(primaryKi.private);
        $('#content').text('Pass phrase changed. You will find a new backup in your inbox.');
      } catch (e) {
        if (ApiErr.isNetErr(e)) {
          Xss.sanitizeRender('#content', 'Connection failed, please <a href="#" class="reload">try again</a>');
        } else if (ApiErr.isAuthPopupNeeded(e)) {
          Xss.sanitizeRender('#content', 'Need to reconnect to Google to save backup: <a href="#" class="auth_reconnect">reconnect now</a>');
        } else {
          Xss.sanitizeRender('#content', `Unknown error: ${String(e)}<br><a href="#" class="reload">try again</a>`);
          Catch.reportErr(e);
        }
      }
    } else { // should never happen on this action. Just in case.
      this.displayBlock('step_3_manual');
      $('h1').text('Back up your private key');
    }
  }

  private actionAuthReconnectHandler = async () => {
    await GoogleAuth.newAuthPopup({ acctEmail: this.acctEmail });
    window.location.reload();
  }

  private actionProceedDefaultBackupChoice = async () => {
    this.displayBlock('step_1_password');
    $('h1').text('Set Backup Pass Phrase');
  }

  private actionShowManualBackupHandler = async () => {
    this.displayBlock('step_3_manual');
    $('h1').text('Back up your private key');
  }

  private actionEnterPassPhraseHandler = async (target: HTMLElement) => {
    if ($(target).hasClass('green')) {
      this.displayBlock('step_2_confirm');
    } else {
      await Ui.modal.warning('Please select a stronger pass phrase. Combinations of 4 to 5 uncommon words are the best.');
    }
  }

  private actionResetPassPhraseEntryHandler = async () => {
    $('#password').val('').keyup();
    $('#password2').val('');
    this.displayBlock('step_1_password');
    $('#password').focus();
  }

  private actionBackupHandler = async (target: HTMLElement) => {
    const newPassphrase = String($('#password').val());
    if (newPassphrase !== $('#password2').val()) {
      await Ui.modal.warning('The two pass phrases do not match, please try again.');
      $('#password2').val('');
      $('#password2').focus();
    } else {
      const btnText = $(target).text();
      Xss.sanitizeRender(target, Ui.spinner('white'));
      const [primaryKi] = await Store.keysGet(this.acctEmail, ['primary']);
      Assert.abortAndRenderErrorIfKeyinfoEmpty(primaryKi);
      const prv = await PgpKey.read(primaryKi.private);
      await PgpKey.encrypt(prv, newPassphrase);
      await Store.passphraseSave('local', this.acctEmail, primaryKi.longid, newPassphrase);
      await Store.keysAdd(this.acctEmail, prv.armor());
      try {
        await this.doBackupOnEmailProvider(prv.armor());
      } catch (e) {
        if (ApiErr.isNetErr(e)) {
          await Ui.modal.warning('Need internet connection to finish. Please click the button again to retry.');
        } else if (this.parentTabId && ApiErr.isAuthPopupNeeded(e)) {
          BrowserMsg.send.notificationShowAuthPopupNeeded(this.parentTabId, { acctEmail: this.acctEmail });
          await Ui.modal.warning('Account needs to be re-connected first. Please try later.');
        } else {
          Catch.reportErr(e);
          await Ui.modal.error(`Error happened, please try again (${String(e)})`);
        }
        $(target).text(btnText);
        return;
      }
      await this.writeBackupDoneAndRender(false, 'inbox');
    }
  }

  private actionManualBackupHandler = async () => {
    const selected = $('input[type=radio][name=input_backup_choice]:checked').val();
    const [primaryKi] = await Store.keysGet(this.acctEmail, ['primary']);
    Assert.abortAndRenderErrorIfKeyinfoEmpty(primaryKi);
    if (!await this.isPrivateKeyEncrypted(primaryKi)) {
      await Ui.modal.error('Sorry, cannot back up private key because it\'s not protected with a pass phrase.');
      return;
    }
    if (selected === 'inbox') {
      await this.backupOnEmailProviderAndUpdateUi(primaryKi);
    } else if (selected === 'file') {
      await this.backupAsFile(primaryKi);
    } else if (selected === 'print') {
      await this.backupByBrint(primaryKi);
    } else {
      await this.backupRefused(primaryKi);
    }
  }

  private actionSkipBackupHandler = async () => {
    if (this.action === 'setup') {
      await Store.setAcct(this.acctEmail, { key_backup_prompt: false });
      window.location.href = Url.create('/chrome/settings/setup.htm', { acctEmail: this.acctEmail });
    } else {
      if (this.parentTabId) {
        BrowserMsg.send.closePage(this.parentTabId);
      } else {
        Catch.report(`backup.ts: missing parentTabId for ${this.action}`);
      }
    }
  }

  private actionSelectBackupMethodHandler = (target: HTMLElement) => {
    if ($(target).val() === 'inbox') {
      $('.action_manual_backup').text('back up as email');
      $('.action_manual_backup').removeClass('red').addClass('green');
    } else if ($(target).val() === 'file') {
      $('.action_manual_backup').text('back up as a file');
      $('.action_manual_backup').removeClass('red').addClass('green');
    } else if ($(target).val() === 'print') {
      $('.action_manual_backup').text('back up on paper');
      $('.action_manual_backup').removeClass('red').addClass('green');
    } else {
      $('.action_manual_backup').text('try my luck');
      $('.action_manual_backup').removeClass('green').addClass('red');
    }
  }

  private displayBlock = (name: string) => {
    for (const block of this.blocks) {
      $('#' + block).css('display', 'none');
    }
    $('#' + name).css('display', 'block');
  }

  private checkAndRenderBackupStatus = async () => {
    const storage = await Store.getAcct(this.acctEmail, ['setup_simple', 'key_backup_method', 'email_provider']);
    const scopes = await Store.getScopes(this.acctEmail);
    if (this.emailProvider === 'gmail' && (scopes.read || scopes.modify)) {
      let keys;
      try {
        keys = await this.gmail.fetchKeyBackups();
      } catch (e) {
        if (ApiErr.isNetErr(e)) {
          Xss.sanitizeRender('#content', `Could not check for backups: no internet. ${Ui.retryLink()}`);
        } else if (ApiErr.isAuthPopupNeeded(e)) {
          if (this.parentTabId) {
            BrowserMsg.send.notificationShowAuthPopupNeeded(this.parentTabId, { acctEmail: this.acctEmail });
          }
          Xss.sanitizeRender('#content', `Could not check for backups: account needs to be re-connected. ${Ui.retryLink()}`);
        } else {
          ApiErr.reportIfSignificant(e);
          Xss.sanitizeRender('#content', `Could not check for backups: ${ApiErr.eli5(e)} (${String(e)}). ${Ui.retryLink()}`);
        }
        return;
      }
      this.displayBlock('step_0_status');
      if (keys?.length) {
        $('.status_summary').text('Backups found: ' + keys.length + '. Your account is backed up correctly in your email inbox.');
        Xss.sanitizeRender('#step_0_status .container', '<button class="button long green action_go_manual">SEE MORE BACKUP OPTIONS</button>');
      } else if (storage.key_backup_method) {
        if (storage.key_backup_method === 'file') {
          $('.status_summary').text('You have previously backed up your key into a file.');
          Xss.sanitizeRender('#step_0_status .container', '<button class="button long green action_go_manual">SEE OTHER BACKUP OPTIONS</button>');
        } else if (storage.key_backup_method === 'print') {
          $('.status_summary').text('You have previously backed up your key by printing it.');
          Xss.sanitizeRender('#step_0_status .container', '<button class="button long green action_go_manual">SEE OTHER BACKUP OPTIONS</button>');
        } else { // inbox or other methods
          $('.status_summary').text('There are no backups on this account. If you lose your device, or it stops working, you will not be able to read your encrypted email.');
          Xss.sanitizeRender('#step_0_status .container', '<button class="button long green action_go_manual">SEE BACKUP OPTIONS</button>');
        }
      } else {
        if (storage.setup_simple) {
          $('.status_summary').text('No backups found on this account. You can store a backup of your key in email inbox. Your key will be protected by a pass phrase of your choice.');
          Xss.sanitizeRender('#step_0_status .container',
            `<button class="button long green action_proceed_default_backup_choice">BACK UP MY KEY</button><br><br><br>
            <a href="#" class="action_go_manual">See more advanced backup options</a>`);
        } else {
          $('.status_summary').text('No backups found on this account. If you lose your device, or it stops working, you will not be able to read your encrypted email.');
          Xss.sanitizeRender('#step_0_status .container', '<button class="button long green action_go_manual">BACK UP MY KEY</button>');
        }
      }
    } else { // gmail read permission not granted - cannot check for backups
      this.displayBlock('step_0_status');
      $('.status_summary').text('FlowCrypt cannot check your backups.');
      const pemissionsBtnIfGmail = this.emailProvider === 'gmail' ?
        '<button class="button long green action_go_auth_denied">SEE PERMISSIONS</button>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;' : '';
      Xss.sanitizeRender('#step_0_status .container', `${pemissionsBtnIfGmail}<button class="button long gray action_go_manual">SEE BACKUP OPTIONS</button>`);
    }
  }

  private isPrivateKeyEncrypted = async (ki: KeyInfo) => {
    const prv = await PgpKey.read(ki.private);
    if (await PgpKey.decrypt(prv, '', undefined, 'OK-IF-ALREADY-DECRYPTED') === true) {
      return false;
    }
    return prv.isFullyEncrypted();
  }

  private asBackupFile = (armoredKey: string) => {
    return new Att({ name: `flowcrypt-backup-${this.acctEmail.replace(/[^A-Za-z0-9]+/g, '')}.key`, type: 'application/pgp-keys', data: Buf.fromUtfStr(armoredKey) });
  }

  private doBackupOnEmailProvider = async (armoredKey: string) => {
    const emailMsg = String(await $.get({ url: '/chrome/emails/email_intro.template.htm', dataType: 'html' }));
    const emailAtts = [this.asBackupFile(armoredKey)];
    const msg = await this.gmail.createMsgObj(this.acctEmail, { to: [this.acctEmail] }, GMAIL_RECOVERY_EMAIL_SUBJECTS[0], { 'text/html': emailMsg }, emailAtts);
    if (this.emailProvider === 'gmail') {
      return await this.gmail.msgSend(msg);
    } else {
      throw Error(`Backup method not implemented for ${this.emailProvider}`);
    }
  }

  private backupOnEmailProviderAndUpdateUi = async (primaryKi: KeyInfo) => {
    const pp = await Store.passphraseGet(this.acctEmail, primaryKi.longid);
    if (!this.parentTabId) {
      await Ui.modal.error(`Missing parentTabId. Please restart your browser and try again.`);
      return;
    }
    if (!pp) {
      BrowserMsg.send.passphraseDialog(this.parentTabId, { type: 'backup', longids: [primaryKi.longid] });
      if (! await Store.waitUntilPassphraseChanged(this.acctEmail, [primaryKi.longid], 1000, this.ppChangedPromiseCancellation)) {
        return;
      }
      await this.backupOnEmailProviderAndUpdateUi(primaryKi);
      return;
    }
    if (!this.isPassPhraseStrongEnough(primaryKi, pp) && await Ui.modal.confirm('Your key is not protected with strong pass phrase, would you like to change pass phrase now?')) {
      window.location.href = Url.create('/chrome/settings/modules/change_passphrase.htm', { acctEmail: this.acctEmail, parentTabId: this.parentTabId });
      return;
    }
    const btn = $('.action_manual_backup');
    const origBtnText = btn.text();
    Xss.sanitizeRender(btn, Ui.spinner('white'));
    try {
      await this.doBackupOnEmailProvider(primaryKi.private);
    } catch (e) {
      if (ApiErr.isNetErr(e)) {
        return await Ui.modal.warning('Need internet connection to finish. Please click the button again to retry.');
      } else if (ApiErr.isAuthPopupNeeded(e)) {
        BrowserMsg.send.notificationShowAuthPopupNeeded(this.parentTabId, { acctEmail: this.acctEmail });
        return await Ui.modal.warning('Account needs to be re-connected first. Please try later.');
      } else {
        Catch.reportErr(e);
        return await Ui.modal.error(`Error happened: ${String(e)}`);
      }
    } finally {
      btn.text(origBtnText);
    }
    await this.writeBackupDoneAndRender(false, 'inbox');
  }

  private backupAsFile = async (primaryKi: KeyInfo) => { // todo - add a non-encrypted download option
    const attachment = this.asBackupFile(primaryKi.private);
    Browser.saveToDownloads(attachment);
    await Ui.modal.info('Downloading private key backup file..');
    await this.writeBackupDoneAndRender(false, 'file');
  }

  private backupByBrint = async (primaryKi: KeyInfo) => { // todo - implement + add a non-encrypted print option
    throw new Error('not implemented');
  }

  private backupRefused = async (ki: KeyInfo) => {
    await this.writeBackupDoneAndRender(Value.int.getFutureTimestampInMonths(3), 'none');
  }

  private writeBackupDoneAndRender = async (prompt: number | false, method: KeyBackupMethod) => {
    await Store.setAcct(this.acctEmail, { key_backup_prompt: prompt, key_backup_method: method });
    if (this.action === 'setup') {
      window.location.href = Url.create('/chrome/settings/setup.htm', { acctEmail: this.acctEmail, action: 'finalize' });
    } else {
      window.location.reload();
    }
  }

  private isPassPhraseStrongEnough = async (ki: KeyInfo, passphrase: string) => {
    const prv = await PgpKey.read(ki.private);
    if (!prv.isFullyEncrypted()) {
      return false;
    }
    if (!passphrase) {
      const pp = prompt('Please enter your pass phrase:');
      if (!pp) {
        return false;
      }
      if (await PgpKey.decrypt(prv, pp) !== true) {
        await Ui.modal.warning('Pass phrase did not match, please try again.');
        return false;
      }
      passphrase = pp;
    }
    if (Settings.evalPasswordStrength(passphrase).word.pass === true) {
      return true;
    }
    await Ui.modal.warning('Please change your pass phrase first.\n\nIt\'s too weak for this backup method.');
    return false;
  }

  private setupCreateSimpleAutomaticInboxBackup = async () => {
    const [primaryKi] = await Store.keysGet(this.acctEmail, ['primary']);
    if (!(await PgpKey.read(primaryKi.private)).isFullyEncrypted()) {
      await Ui.modal.warning('Key not protected with a pass phrase, skipping');
      throw new UnreportableError('Key not protected with a pass phrase, skipping');
    }
    Assert.abortAndRenderErrorIfKeyinfoEmpty(primaryKi);
    try {
      await this.doBackupOnEmailProvider(primaryKi.private);
      await this.writeBackupDoneAndRender(false, 'inbox');
    } catch (e) {
      if (ApiErr.isAuthPopupNeeded(e)) {
        await Ui.modal.info("Authorization Error. FlowCrypt needs to reconnect your Gmail account");
        const connectResult = await GoogleAuth.newAuthPopup({ acctEmail: this.acctEmail });
        if (!connectResult.error) {
          await this.setupCreateSimpleAutomaticInboxBackup();
        } else {
          throw e;
        }
      }
    }
  }

});
