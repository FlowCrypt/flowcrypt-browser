/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { ViewModule } from '../../../js/common/view-module.js';
import { Xss } from '../../../js/common/platform/xss.js';
import { BackupView } from './backup.js';
import { Assert } from '../../../js/common/assert.js';
import { Attachment } from '../../../js/common/core/attachment.js';
import { SendableMsg } from '../../../js/common/api/email-provider/sendable-msg.js';
import { GMAIL_RECOVERY_EMAIL_SUBJECTS } from '../../../js/common/core/const.js';
import { KeyInfo, KeyUtil } from '../../../js/common/core/crypto/key.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { ApiErr } from '../../../js/common/api/shared/api-error.js';
import { BrowserMsg, Bm } from '../../../js/common/browser/browser-msg.js';
import { Catch } from '../../../js/common/platform/catch.js';
import { Browser } from '../../../js/common/browser/browser.js';
import { Url, PromiseCancellation } from '../../../js/common/core/common.js';
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
    const emailAtts = [this.asBackupFile(armoredKey)];
    const headers = { from: this.view.acctEmail, recipients: { to: [this.view.acctEmail] }, subject: GMAIL_RECOVERY_EMAIL_SUBJECTS[0] };
    const msg = await SendableMsg.createPlain(this.view.acctEmail, headers, { 'text/html': emailMsg }, emailAtts);
    if (this.view.emailProvider === 'gmail') {
      return await this.view.gmail.msgSend(msg);
    } else {
      throw Error(`Backup method not implemented for ${this.view.emailProvider}`);
    }
  }

  private actionManualBackupHandler = async () => {
    const selected = $('input[type=radio][name=input_backup_choice]:checked').val();
    const primaryKi = await KeyStore.getFirst(this.view.acctEmail);
    Assert.abortAndRenderErrorIfKeyinfoEmpty(primaryKi);
    if (! await this.isPrivateKeyEncrypted(primaryKi)) {
      await Ui.modal.error('Sorry, cannot back up private key because it\'s not protected with a pass phrase.');
      return;
    }
    if (selected === 'inbox') {
      await this.backupOnEmailProviderAndUpdateUi(primaryKi);
    } else if (selected === 'file') {
      await this.backupAsFile(primaryKi);
    } else if (selected === 'print') {
      await this.backupByBrint();
    } else {
      await this.backupRefused();
    }
  }

  private asBackupFile = (armoredKey: string) => {
    return new Attachment({ name: `flowcrypt-backup-${this.view.acctEmail.replace(/[^A-Za-z0-9]+/g, '')}.key`, type: 'application/pgp-keys', data: Buf.fromUtfStr(armoredKey) });
  }

  private backupOnEmailProviderAndUpdateUi = async (primaryKi: KeyInfo) => {
    const pp = await PassphraseStore.get(this.view.acctEmail, primaryKi.fingerprints[0]);
    if (!this.view.parentTabId) {
      await Ui.modal.error(`Missing parentTabId. Please restart your browser and try again.`);
      return;
    }
    if (!pp) {
      BrowserMsg.send.passphraseDialog(this.view.parentTabId, { type: 'backup', longids: [primaryKi.longid] });
      if (! await PassphraseStore.waitUntilPassphraseChanged(this.view.acctEmail, [primaryKi.longid], 1000, this.ppChangedPromiseCancellation)) {
        return;
      }
      await this.backupOnEmailProviderAndUpdateUi(primaryKi);
      return;
    }
    if (!this.isPassPhraseStrongEnough(primaryKi, pp)) {
      await Ui.modal.warning('Your key is not protected with strong pass phrase.\n\nYou should change your pass phrase.');
      window.location.href = Url.create('/chrome/settings/modules/change_passphrase.htm', { acctEmail: this.view.acctEmail, parentTabId: this.view.parentTabId });
      return;
    }
    const origBtnText = this.proceedBtn.text();
    Xss.sanitizeRender(this.proceedBtn, Ui.spinner('white'));
    try {
      await this.doBackupOnEmailProvider(primaryKi.private);
    } catch (e) {
      if (ApiErr.isNetErr(e)) {
        return await Ui.modal.warning('Need internet connection to finish. Please click the button again to retry.');
      } else if (ApiErr.isAuthErr(e)) {
        BrowserMsg.send.notificationShowAuthPopupNeeded(this.view.parentTabId, { acctEmail: this.view.acctEmail });
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

  private backupAsFile = async (primaryKi: KeyInfo) => { // todo - add a non-encrypted download option
    const attachment = this.asBackupFile(primaryKi.private);
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

  private isPassPhraseStrongEnough = async (ki: KeyInfo, passphrase: string) => {
    const prv = await KeyUtil.parse(ki.private);
    if (!prv.fullyEncrypted) {
      return false;
    }
    if (!passphrase) {
      const pp = prompt('Please enter your pass phrase:');
      if (!pp) {
        return false;
      }
      if (await KeyUtil.decrypt(prv, pp) !== true) {
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
