/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Xss } from '../../platform/xss.js';
import { Attachment } from '../../core/attachment.js';
import { SendableMsg } from '../../api/email-provider/sendable-msg.js';
import { GMAIL_RECOVERY_EMAIL_SUBJECTS } from '../../core/const.js';
import { KeyUtil, KeyInfoWithIdentity } from '../../core/crypto/key.js';
import { Ui } from '../../browser/ui.js';
import { ApiErr } from '../../api/shared/api-error.js';
import { BrowserMsg, Bm } from '../../browser/browser-msg.js';
import { Catch } from '../../platform/catch.js';
import { Browser } from '../../browser/browser.js';
import { PromiseCancellation, Value } from '../../core/common.js';
import { Settings } from '../../settings.js';
import { Buf } from '../../core/buf.js';
import { PassphraseStore } from '../../platform/store/passphrase-store.js';
import { KeyStore } from '../../platform/store/key-store.js';
import { BackupUi } from './backup-ui.js';
import { BackupUiModule } from './backup-ui-module.js';

const differentPassphrasesError = `Your keys are protected with different pass phrases.\n\nBacking them up together isn't supported yet.`;
export class BackupUiManualActionModule extends BackupUiModule<BackupUi> {
  private ppChangedPromiseCancellation: PromiseCancellation = { cancel: false };
  private readonly proceedBtn = $('#module_manual .action_manual_backup');

  public constructor(ui: BackupUi) {
    super(ui);
    BrowserMsg.addListener('passphrase_entry', async ({ entered }: Bm.PassphraseEntry) => {
      if (!entered) {
        this.ppChangedPromiseCancellation.cancel = true; // update original object which is monitored by a promise
        this.ppChangedPromiseCancellation = { cancel: false }; // set to a new, not yet used object
      }
    });
    BrowserMsg.listen(this.ui.tabId);
  }

  public setHandlers = () => {
    $('#module_manual input[name=input_backup_choice]').on(
      'click',
      this.ui.setHandler(el => this.actionSelectBackupMethodHandler(el))
    );
    this.proceedBtn.on(
      'click',
      this.ui.setHandlerPrevent('double', () => this.actionManualBackupHandler())
    );
  };

  public doBackupOnEmailProvider = async (encryptedPrvs: KeyInfoWithIdentity[]) => {
    const emailMsg = String(await $.get({ url: '/chrome/emails/email_intro.template.htm', dataType: 'html' }));
    const emailAttachments = encryptedPrvs.map(prv => this.asBackupFile(prv));
    const headers = {
      from: this.ui.acctEmail,
      recipients: { to: [{ email: this.ui.acctEmail }] },
      subject: GMAIL_RECOVERY_EMAIL_SUBJECTS[0],
    };
    const msg = await SendableMsg.createPlain(this.ui.acctEmail, headers, { 'text/html': emailMsg }, emailAttachments);
    if (this.ui.emailProvider === 'gmail') {
      return await this.ui.gmail.msgSend(msg);
    } else {
      throw Error(`Backup method not implemented for ${this.ui.emailProvider}`);
    }
  };

  private actionManualBackupHandler = async () => {
    const selected = $('input[type=radio][name=input_backup_choice]:checked').val();
    if (!this.ui.identityOfKeysToManuallyBackup.length) {
      await Ui.modal.error('No keys are selected to back up! Please select a key to continue.');
      return;
    }
    const keyInfosToBackup = KeyUtil.filterKeysByIdentity(await KeyStore.get(this.ui.acctEmail), this.ui.identityOfKeysToManuallyBackup);
    if (!keyInfosToBackup.length) {
      await Ui.modal.error('Sorry, could not extract these keys from storage. Please restart your browser and try again.');
      return;
    }
    if (selected === 'inbox' || selected === 'file') {
      // in setup_manual we don't have passphrase-related message handlers, so limit the checks
      for (const ki of keyInfosToBackup) {
        if (!(await this.isPrivateKeyEncrypted(ki))) {
          // todo: this check can also be moved to encryptForBackup method when we solve the same passphrase issue (#4060)
          await Ui.modal.error("Sorry, cannot back up private key because it's not protected with a pass phrase.");
          return;
        }
      }
      const checkStrength = selected === 'inbox' && this.ui.action !== 'setup_manual';
      const encryptedArmoredPrvs = await this.encryptForBackup(keyInfosToBackup, { checkStrength });
      if (!encryptedArmoredPrvs) {
        return; // error modal was already rendered inside encryptForBackup
      }
      if (selected === 'inbox') {
        if (!(await this.backupOnEmailProviderAndUpdateUi(encryptedArmoredPrvs))) {
          return; // some error occured, message displayed, can retry, no reload needed
        }
      } else {
        await this.backupAsFiles(encryptedArmoredPrvs);
      }
      await this.ui.onBackedUpFinished(keyInfosToBackup.length);
    } else if (selected === 'print') {
      await this.backupByBrint();
    } else {
      await this.backupRefused();
    }
  };

  private asBackupFile = (prv: KeyInfoWithIdentity) => {
    return new Attachment({
      name: `flowcrypt-backup-${this.ui.acctEmail.replace(/[^A-Za-z0-9]+/g, '')}-${prv.id}.asc`,
      type: 'application/pgp-keys',
      data: Buf.fromUtfStr(prv.private),
    });
  };

  private encryptForBackup = async (keyInfos: KeyInfoWithIdentity[], checks: { checkStrength: boolean }): Promise<KeyInfoWithIdentity[] | undefined> => {
    const kisWithPp = await Promise.all(
      keyInfos.map(async ki => {
        const passphrase = await PassphraseStore.get(this.ui.acctEmail, ki);
        // test that the key can actually be decrypted with the passphrase provided
        const mismatch = passphrase && !(await KeyUtil.decrypt(await KeyUtil.parse(ki.private), passphrase));
        return { ...ki, mismatch, passphrase: mismatch ? undefined : passphrase };
      })
    );
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const distinctPassphrases = Value.arr.unique(kisWithPp.filter(ki => ki.passphrase).map(ki => ki.passphrase!));
    if (distinctPassphrases.length > 1) {
      await Ui.modal.error(differentPassphrasesError);
      return undefined;
    }
    if (checks.checkStrength && distinctPassphrases[0] && !Settings.evalPasswordStrength(distinctPassphrases[0]).word.pass) {
      await Ui.modal.warning("Please change your pass phrase first.\n\nIt's too weak for this backup method.");
      // Actually, until #956 is resolved, we can only modify the pass phrase of the first key
      if (this.ui.parentTabId && kisWithPp[0].passphrase === distinctPassphrases[0]) {
        Settings.redirectSubPage(this.ui.acctEmail, this.ui.parentTabId, '/chrome/settings/modules/change_passphrase.htm');
      }
      return undefined;
    }
    if (distinctPassphrases.length === 1) {
      // trying to apply the known pass phrase
      for (const ki of kisWithPp.filter(ki => !ki.passphrase)) {
        if (await KeyUtil.decrypt(await KeyUtil.parse(ki.private), distinctPassphrases[0])) {
          ki.passphrase = distinctPassphrases[0];
        }
      }
    }
    const kisMissingPp = kisWithPp.filter(ki => !ki.passphrase);
    if (kisMissingPp.length) {
      if (distinctPassphrases.length >= 1) {
        await Ui.modal.error(differentPassphrasesError);
        return undefined;
      }
      // todo: reset invalid pass phrases (mismatch === true)?
      const longids = kisMissingPp.map(ki => ki.longid);
      if (this.ui.parentTabId) {
        BrowserMsg.send.passphraseDialog(this.ui.parentTabId, { type: 'backup', longids });
        if (!(await PassphraseStore.waitUntilPassphraseChanged(this.ui.acctEmail, longids, 1000, this.ppChangedPromiseCancellation))) {
          return undefined;
        }
      } else {
        await Ui.modal.error(`Sorry, can't back up private key because its pass phrase can't be extracted. Please restart your browser and try again.`);
        return undefined;
      }
      // re-start the function recursively with newly discovered pass phrases
      // todo: #4059 however, this code is never actually executed, because our backup frame gets wiped out by the passphrase frame
      return await this.encryptForBackup(keyInfos, checks);
    }
    return keyInfos;
  };

  private backupOnEmailProviderAndUpdateUi = async (encryptedPrvs: KeyInfoWithIdentity[]): Promise<boolean> => {
    const origBtnText = this.proceedBtn.text();
    Xss.sanitizeRender(this.proceedBtn, Ui.spinner('white'));
    try {
      await this.doBackupOnEmailProvider(encryptedPrvs);
      return true;
    } catch (e) {
      if (ApiErr.isNetErr(e)) {
        await Ui.modal.warning('Need internet connection to finish. Please click the button again to retry.');
      } else if (ApiErr.isAuthErr(e)) {
        if (this.ui.parentTabId) {
          BrowserMsg.send.notificationShowAuthPopupNeeded(this.ui.parentTabId, { acctEmail: this.ui.acctEmail });
        }
        await Ui.modal.warning('Account needs to be re-connected first. Please try later.');
      } else {
        Catch.reportErr(e);
        await Ui.modal.error(`Error happened: ${String(e)}`);
      }
      return false;
    } finally {
      this.proceedBtn.text(origBtnText);
    }
  };

  private backupAsFiles = async (encryptedPrvs: KeyInfoWithIdentity[]) => {
    // todo - add a non-encrypted download option
    for (const encryptedArmoredPrv of encryptedPrvs) {
      const attachment = this.asBackupFile(encryptedArmoredPrv);
      Browser.saveToDownloads(attachment);
    }
    await Ui.modal.info('Downloading private key backup file..');
  };

  private backupByBrint = async () => {
    // todo - implement + add a non-encrypted print option
    throw new Error('not implemented');
  };

  private backupRefused = async () => {
    await this.ui.onBackedUpFinished(0);
  };

  private isPrivateKeyEncrypted = async (ki: KeyInfoWithIdentity) => {
    const prv = await KeyUtil.parse(ki.private);
    if ((await KeyUtil.decrypt(prv, '', undefined, 'OK-IF-ALREADY-DECRYPTED')) === true) {
      return false;
    }
    return prv.fullyEncrypted;
  };

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
  };
}
