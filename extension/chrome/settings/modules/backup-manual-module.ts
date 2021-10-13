/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { ViewModule } from '../../../js/common/view-module.js';
import { Xss } from '../../../js/common/platform/xss.js';
import { BackupView } from './backup.js';
import { Attachment } from '../../../js/common/core/attachment.js';
import { SendableMsg } from '../../../js/common/api/email-provider/sendable-msg.js';
import { GMAIL_RECOVERY_EMAIL_SUBJECTS } from '../../../js/common/core/const.js';
import { KeyInfo, KeyUtil, TypedKeyInfo } from '../../../js/common/core/crypto/key.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { ApiErr } from '../../../js/common/api/shared/api-error.js';
import { BrowserMsg, Bm } from '../../../js/common/browser/browser-msg.js';
import { Catch } from '../../../js/common/platform/catch.js';
import { Browser } from '../../../js/common/browser/browser.js';
import { Url, PromiseCancellation, Value } from '../../../js/common/core/common.js';
import { Settings } from '../../../js/common/settings.js';
import { Buf } from '../../../js/common/core/buf.js';
import { PassphraseStore } from '../../../js/common/platform/store/passphrase-store.js';
import { KeyStore } from '../../../js/common/platform/store/key-store.js';

export class BackupManualActionModule extends ViewModule<BackupView> {
  private ppChangedPromiseCancellation: PromiseCancellation = { cancel: false };
  private readonly proceedBtn = $('#module_manual .action_manual_backup');

  constructor(view: BackupView) {
    super(view);
    BrowserMsg.addListener('passphrase_entry', async ({ entered }: Bm.PassphraseEntry) => {
      if (!entered) {
        this.ppChangedPromiseCancellation.cancel = true; // update original object which is monitored by a promise
        this.ppChangedPromiseCancellation = { cancel: false }; // set to a new, not yet used object
      }
    });
    BrowserMsg.listen(this.view.tabId);
  }

  public setHandlers = () => {
    $('#module_manual input[name=input_backup_choice]').click(this.view.setHandler(el => this.actionSelectBackupMethodHandler(el)));
    this.proceedBtn.click(this.view.setHandlerPrevent('double', () => this.actionManualBackupHandler()));
  }

  public doBackupOnEmailProvider = async (armoredKey: string) => {
    const emailMsg = String(await $.get({ url: '/chrome/emails/email_intro.template.htm', dataType: 'html' }));
    const emailAttachments = [this.asBackupFile(armoredKey)];
    const headers = { from: this.view.acctEmail, recipients: { to: [this.view.acctEmail] }, subject: GMAIL_RECOVERY_EMAIL_SUBJECTS[0] };
    const msg = await SendableMsg.createPlain(this.view.acctEmail, headers, { 'text/html': emailMsg }, emailAttachments);
    if (this.view.emailProvider === 'gmail') {
      return await this.view.gmail.msgSend(msg);
    } else {
      throw Error(`Backup method not implemented for ${this.view.emailProvider}`);
    }
  }

  private actionManualBackupHandler = async () => {
    const selected = $('input[type=radio][name=input_backup_choice]:checked').val();
    if (this.view.prvKeysToManuallyBackup.length <= 0 && (selected === 'inbox' || selected === 'file')) {
      await Ui.modal.error('No keys selected to backup! Please select a key to continue.');
      return;
    }
    const kinfos = await KeyStore.getTypedKeyInfos(this.view.acctEmail, this.view.prvKeysToManuallyBackup);
    for (const ki of kinfos) {
      if (! await this.isPrivateKeyEncrypted(ki)) {
        await Ui.modal.error('Sorry, cannot back up private key because it\'s not protected with a pass phrase.');
        return;
      }
    }
    if (selected === 'inbox' || selected === 'file') {
      const encrypted = await this.encryptForBackup(kinfos, { strength: selected === 'inbox' });
      if (encrypted) {
        if (selected === 'inbox') {
          await this.backupOnEmailProviderAndUpdateUi(encrypted);
        } else {
          await this.backupAsFile(encrypted);
        }
      }
    } else if (selected === 'print') {
      await this.backupByBrint();
    } else {
      await this.backupRefused();
    }
  }

  private asBackupFile = (armoredKey: string) => {
    return new Attachment({ name: `flowcrypt-backup-${this.view.acctEmail.replace(/[^A-Za-z0-9]+/g, '')}.asc`, type: 'application/pgp-keys', data: Buf.fromUtfStr(armoredKey) });
  }

  private encryptForBackup = async (kinfos: TypedKeyInfo[], checks: { strength: boolean }): Promise<string | undefined> => {
    const kisWithPp = await Promise.all(kinfos.map(async (ki) => {
      const passphrase = await PassphraseStore.getByKeyIdentity(this.view.acctEmail, ki);
      // test that the key can actually be decrypted with the passphrase provided
      const mismatch = passphrase && !await KeyUtil.decrypt(await KeyUtil.parse(ki.private), passphrase);
      return { ...ki, mismatch, passphrase: mismatch ? undefined : passphrase };
    }));
    const distinctPassphrases = Value.arr.unique(kisWithPp.filter(ki => ki.passphrase).map(ki => ki.passphrase!));
    if (distinctPassphrases.length > 1) {
      await Ui.modal.error('Your keys are protected with different pass phrases.\n\nThis is not supported yet.');
      return undefined;
    }
    if (checks.strength && distinctPassphrases[0] && !(Settings.evalPasswordStrength(distinctPassphrases[0]).word.pass)) {
      await Ui.modal.warning('Please change your pass phrase first.\n\nIt\'s too weak for this backup method.');
      if (this.view.parentTabId !== undefined) {
        window.location.href = Url.create('/chrome/settings/modules/change_passphrase.htm', { acctEmail: this.view.acctEmail, parentTabId: this.view.parentTabId });
      }
      return undefined;
    }
    const kisMissingPp = kisWithPp.filter(ki => !ki.passphrase);
    if (kisMissingPp.length) {
      // todo: try to apply the known pass phrase?
      // todo: reset invalid pass phrases (mismatch === true)?
      const longids = kisMissingPp.map(ki => ki.longid);
      if (!this.view.parentTabId) {
        await Ui.modal.error(`Missing parentTabId. Please restart your browser and try again.`);
        return undefined;
      }
      BrowserMsg.send.passphraseDialog(this.view.parentTabId, { type: 'backup', longids });
      if (! await PassphraseStore.waitUntilPassphraseChanged(this.view.acctEmail, longids, 1000, this.ppChangedPromiseCancellation)) {
        return undefined;
      }
      return await this.encryptForBackup(kinfos, checks);
    }
    return kinfos.map(ki => ki.private).join('\n'); // todo: remove extra \n ?
  }

  private backupOnEmailProviderAndUpdateUi = async (data: string): Promise<void> => {
    const origBtnText = this.proceedBtn.text();
    Xss.sanitizeRender(this.proceedBtn, Ui.spinner('white'));
    try {
      await this.doBackupOnEmailProvider(data);
    } catch (e) {
      if (ApiErr.isNetErr(e)) {
        return await Ui.modal.warning('Need internet connection to finish. Please click the button again to retry.');
      } else if (ApiErr.isAuthErr(e)) {
        if (this.view.parentTabId !== undefined) {
          BrowserMsg.send.notificationShowAuthPopupNeeded(this.view.parentTabId, { acctEmail: this.view.acctEmail });
        }
        return await Ui.modal.warning('Account needs to be re-connected first. Please try later.');
      } else {
        Catch.reportErr(e);
        return await Ui.modal.error(`Error happened: ${String(e)}`);
      }
    } finally {
      this.proceedBtn.text(origBtnText);
    }
    await this.view.renderBackupDone();
  }

  private backupAsFile = async (data: string) => { // todo - add a non-encrypted download option
    const attachment = this.asBackupFile(data);
    Browser.saveToDownloads(attachment);
    await Ui.modal.info('Downloading private key backup file..');
    await this.view.renderBackupDone();
  }

  private backupByBrint = async () => { // todo - implement + add a non-encrypted print option
    throw new Error('not implemented');
  }

  private backupRefused = async () => {
    await this.view.renderBackupDone(false);
  }

  private isPrivateKeyEncrypted = async (ki: KeyInfo) => {
    const prv = await KeyUtil.parse(ki.private);
    if (await KeyUtil.decrypt(prv, '', undefined, 'OK-IF-ALREADY-DECRYPTED') === true) {
      return false;
    }
    return prv.fullyEncrypted;
  }

  private actionSelectBackupMethodHandler = (target: HTMLElement) => {
    if ($(target).val() === 'inbox') {
      this.proceedBtn.text('back up as email');
      this.proceedBtn.removeClass('red').addClass('green');
    } else if ($(target).val() === 'file') {
      this.proceedBtn.text('back up as a file');
      this.proceedBtn.removeClass('red').addClass('green');
    } else if ($(target).val() === 'print') {
      this.proceedBtn.text('back up on paper');
      this.proceedBtn.removeClass('red').addClass('green');
    } else {
      this.proceedBtn.text('try my luck');
      this.proceedBtn.removeClass('green').addClass('red');
    }
  }

}
