/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { Config, TestKeyInfoWithFilepath, Util } from '../../util';

import { ControllablePage } from '../../browser';
import { PageRecipe } from './abstract-page-recipe';
import { SavePassphraseChecks, SettingsPageRecipe } from './settings-page-recipe';
import { expect } from 'chai';

type ManualEnterOpts = {
  usedPgpBefore?: boolean,
  savePassphrase?: boolean,
  submitPubkey?: boolean,
  fixKey?: boolean,
  naked?: boolean,
  genPp?: boolean,
  simulateRetryOffline?: boolean,
  noPrvCreateOrgRule?: boolean,
  enforceAttesterSubmitOrgRule?: boolean,
  noPubSubmitRule?: boolean,
  fillOnly?: boolean,
  isInvalidKey?: boolean | undefined,
  checkEmailAliasIfPresent?: boolean,
  key?: { title: string, passphrase: string, armored: string | null, longid: string | null, filePath?: string }
};

type CreateKeyOpts = {
  key?: { passphrase: string },
  usedPgpBefore?: boolean,
  submitPubkey?: boolean,
  enforcedAlgo?: string | boolean,
  selectKeyAlgo?: string,
  skipForPassphrase?: boolean,
  pageEvaluator?: () => void
};

export class SetupPageRecipe extends PageRecipe {

  public static createKey = async (
    settingsPage: ControllablePage,
    keyTitle: string,
    backup: 'none' | 'email' | 'file' | 'disabled',
    { usedPgpBefore = false, submitPubkey = false, enforcedAlgo = false, selectKeyAlgo = '', skipForPassphrase = false, pageEvaluator, key }: CreateKeyOpts = {},
    checks: SavePassphraseChecks = {}
  ) => {
    await SetupPageRecipe.createBegin(settingsPage, keyTitle, { key, usedPgpBefore, skipForPassphrase });
    if (enforcedAlgo) {
      expect(await settingsPage.value('@input-step2bmanualcreate-key-type')).to.equal(enforcedAlgo);
      expect(await settingsPage.isDisabled('@input-step2bmanualcreate-key-type')).to.equal(true);
    }
    if (selectKeyAlgo) {
      await settingsPage.selectOption('@input-step2bmanualcreate-key-type', selectKeyAlgo);
    }
    if (backup === 'disabled') { // user not given a backup choice due to NO_PRV_BACKUP OrgRule
      await settingsPage.notPresent('@input-step2bmanualcreate-backup-inbox');
    } else { // uncheck - because want to choose backup manually
      await settingsPage.waitAndClick('@input-step2bmanualcreate-backup-inbox');
    }
    if (!submitPubkey && await settingsPage.isElementPresent('@input-step2bmanualcreate-submit-pubkey')) {
      await settingsPage.waitAndClick('@input-step2bmanualcreate-submit-pubkey'); // uncheck
    }
    if (pageEvaluator !== undefined) {
      pageEvaluator();
    }
    if (checks.isSavePassphraseHidden !== undefined) {
      expect(await settingsPage.hasClass('@input-step2bmanualcreate-save-passphrase-label', 'hidden')).to.equal(checks.isSavePassphraseHidden);
    }
    if (checks.isSavePassphraseChecked !== undefined) {
      expect(await settingsPage.isChecked('@input-step2bmanualcreate-save-passphrase')).to.equal(checks.isSavePassphraseChecked);
    }
    await settingsPage.waitAndClick('@input-step2bmanualcreate-create-and-save');
    await settingsPage.waitAndRespondToModal('confirm-checkbox', 'confirm', 'Please write down your pass phrase');
    if (backup === 'none') {
      await settingsPage.waitAll('@input-backup-step3manual-no-backup', { timeout: 90 });
      await settingsPage.waitAndClick('@input-backup-step3manual-no-backup');
    } else if (backup === 'email') {
      throw new Error('tests.setup_manual_create options.backup=email not implemented');
    } else if (backup === 'file') {
      await settingsPage.waitAndClick('@input-backup-step3manual-file');
    } else if (backup !== 'disabled') {
      throw new Error(`Unknown backup method: ${backup}`);
    }
    if (backup !== 'disabled') {
      await settingsPage.waitAndClick('@action-backup-step3manual-continue');
      if (backup === 'file') { // explicit wait first with longer timeout - keygen can take a while, particularly with other tests in parallel
        await settingsPage.waitAll('@ui-modal-info', { timeout: 60 });
        await settingsPage.waitAndRespondToModal('info', 'confirm', 'Downloading private key backup file');
      }
    }
    await settingsPage.waitAll('@action-step4done-account-settings', { timeout: 60 }); // create key timeout
    await settingsPage.waitAndClick('@action-step4done-account-settings');
    await SettingsPageRecipe.ready(settingsPage);
  };

  public static async manualEnter(
    settingsPage: ControllablePage,
    keyTitle: string,
    {
      usedPgpBefore = false,
      savePassphrase = false,
      submitPubkey = false,
      fixKey = false,
      naked = false,
      genPp = false,
      simulateRetryOffline = false,
      noPrvCreateOrgRule = false,
      enforceAttesterSubmitOrgRule = false,
      fillOnly = false,
      noPubSubmitRule = false,
      key,
      isInvalidKey = false,
    }: ManualEnterOpts = {},
    checks: SavePassphraseChecks = {}
  ) {
    if (!noPrvCreateOrgRule) {
      if (usedPgpBefore) {
        await settingsPage.waitAndClick('@action-step0foundkey-choose-manual-enter', { timeout: 30, retryErrs: true });
      } else {
        await settingsPage.waitAndClick('@action-step1easyormanual-choose-manual-enter', { timeout: 30, retryErrs: true });
      }
    }
    key = key || Config.key(keyTitle);
    if (!key) {
      throw new Error(`missing key to import with title ${keyTitle}`);
    } else if (key.armored) { // pasted directly into the input
      await settingsPage.waitAndClick('@input-step2bmanualenter-source-paste', { retryErrs: true });
      await settingsPage.waitAndType('@input-step2bmanualenter-ascii-key', key.armored);
    } else if (key.filePath) { // inputted as a file
      const [fileChooser] = await Promise.all([
        settingsPage.page.waitForFileChooser(),
        settingsPage.waitAndClick('@input-step2bmanualenter-file', { retryErrs: true })]);
      await fileChooser.accept([key.filePath]);
      await Util.sleep(1);
      if (isInvalidKey) {
        await settingsPage.waitAndRespondToModal('error', 'confirm', 'Not able to read this key. Make sure it is a valid PGP private key.');
        return;
      }
    } else {
      throw new Error('dont know how to import test key because missing both "armored" and "filePath"');
    }
    await settingsPage.waitAndClick('@input-step2bmanualenter-passphrase'); // blur ascii key input
    if (noPrvCreateOrgRule) { // NO_PRV_CREATE cannot use the back button, so that they cannot select another setup method
      await settingsPage.notPresent('@action-setup-go-back');
    }
    if (checks.isSavePassphraseHidden !== undefined) {
      expect(await settingsPage.hasClass('@input-step2bmanualenter-save-passphrase-label', 'hidden')).to.equal(checks.isSavePassphraseHidden);
    }
    if (savePassphrase) {
      await settingsPage.waitAndClick('@input-step2bmanualenter-save-passphrase');
    } else if (checks.isSavePassphraseChecked !== undefined) {
      expect(await settingsPage.isChecked('@input-step2bmanualenter-save-passphrase')).to.equal(checks.isSavePassphraseChecked);
    }
    if (!naked) {
      await Util.sleep(1);
      await settingsPage.notPresent('@action-step2bmanualenter-new-random-passphrase');
      await settingsPage.waitAndType('@input-step2bmanualenter-passphrase', key.passphrase);
      await Util.sleep(1);
    } else {
      await settingsPage.waitAndClick('@input-step2bmanualenter-passphrase');
      await settingsPage.waitAll('@action-step2bmanualenter-new-random-passphrase', { visible: true });
      if (genPp) {
        await settingsPage.waitAndClick('@action-step2bmanualenter-new-random-passphrase');
        await Util.sleep(1);
        const generatedPp = await settingsPage.value('@input-step2bmanualenter-passphrase');
        if (!/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(generatedPp)) {
          throw new Error(`Import naked key page did not generate proper pass phrase, instead got: ${generatedPp}`);
        }
        const ppValidationExpect = 'GREAT (time to crack: centuries)';
        const ppValidationResult = await settingsPage.read('@container-password-feedback', true);
        if (!ppValidationResult.includes(ppValidationExpect)) {
          throw new Error(`Incorrect Passphrase validation result, expected '${ppValidationExpect}' but got ${ppValidationResult}`);
        }
      } else {
        await settingsPage.waitAndType('@input-step2bmanualenter-passphrase', key.passphrase);
      }
    }
    if (enforceAttesterSubmitOrgRule || noPubSubmitRule) {
      await settingsPage.notPresent('@input-step2bmanualenter-submit-pubkey');
    } else {
      await settingsPage.waitAll('@input-step2bmanualenter-submit-pubkey');
      if (!submitPubkey) {
        await settingsPage.waitAndClick('@input-step2bmanualenter-submit-pubkey'); // uncheck
      }
    }
    await settingsPage.waitAll('@input-step2bmanualenter-save');
    if (fillOnly) {
      return;
    }
    try {
      if (simulateRetryOffline) {
        await settingsPage.page.setOfflineMode(true); // offline mode
      }
      await settingsPage.waitAndClick('@input-step2bmanualenter-save', { delay: 1 });
      if (fixKey) {
        await settingsPage.waitAll('@input-compatibility-fix-expire-years', { timeout: 30 });
        await settingsPage.selectOption('@input-compatibility-fix-expire-years', '1');
        await settingsPage.waitAndClick('@action-fix-and-import-key');
      }
      if (simulateRetryOffline) {
        await settingsPage.waitAll(['@action-overlay-retry', '@container-overlay-prompt-text', '@action-show-overlay-details'], { timeout: fixKey ? 45 : 20 });
        await Util.sleep(0.5);
        expect(await settingsPage.read('@container-overlay-prompt-text')).to.contain('Network connection issue');
        await settingsPage.click('@action-show-overlay-details');
        await settingsPage.waitAll('@container-overlay-details');
        await Util.sleep(0.5);
        expect(await settingsPage.read('@container-overlay-details')).to.contain('Error stack');
        expect(await settingsPage.read('@container-overlay-details')).to.contain('censored:idToken');
        await settingsPage.page.setOfflineMode(false); // back online
        await settingsPage.click('@action-overlay-retry');
        // after retry, the rest should continue as usual below
      }
      await settingsPage.waitAll('@action-step4done-account-settings', { timeout: fixKey ? 90 : 20 });
      await settingsPage.waitAndClick('@action-step4done-account-settings');
      await SettingsPageRecipe.ready(settingsPage);
    } finally {
      await settingsPage.page.setOfflineMode(false); // in case this tab is reused for other tests (which it shouldn't)
    }
  }

  // eslint-disable-next-line max-len
  public static recover = async (settingsPage: ControllablePage, keyTitle: string, { wrongPp = false, clickRecoverMore = false, hasRecoverMore = false, alreadyRecovered = false }: { wrongPp?: boolean, clickRecoverMore?: boolean, hasRecoverMore?: boolean, alreadyRecovered?: boolean } = {}) => {
    const k = Config.key(keyTitle);
    await settingsPage.waitAll('@input-recovery-pass-phrase', { timeout: 40 }); // can sometimes be slow
    await settingsPage.waitAndType('@input-recovery-pass-phrase', k.passphrase);
    await Util.sleep(1); // wait for button to color
    await settingsPage.waitAndClick('@action-recover-account');
    if (wrongPp) {
      await settingsPage.waitAndRespondToModal('warning', 'confirm', 'not match');
    } else if (alreadyRecovered) {
      await settingsPage.waitAndRespondToModal('warning', 'confirm', 'matches a key that was already recovered');
    } else {
      await settingsPage.waitAny(['@action-step4more-account-settings', '@action-step4done-account-settings'], { timeout: 60 });
      if (hasRecoverMore) {
        await settingsPage.waitAll(['@action-step4more-account-settings', '@action-step4more-recover-remaining']);
        if (clickRecoverMore) {
          await settingsPage.waitAndClick('@action-step4more-recover-remaining');
        } else {
          await settingsPage.waitAndClick('@action-step4more-account-settings');
          await SettingsPageRecipe.ready(settingsPage);
        }
      } else {
        await settingsPage.waitAll('@action-step4done-account-settings');
        if (clickRecoverMore) {
          throw new Error('Invalid options chosen: has_recover_more: false, click_recover_more: true');
        } else {
          await settingsPage.waitAndClick('@action-step4done-account-settings');
          await SettingsPageRecipe.ready(settingsPage);
        }
      }
    }
  };

  public static autoSetupWithEKM = async (settingsPage: ControllablePage, { expectErr, enterPp }: {
    expectErr?: { title: string, text: string },
    enterPp?: { passphrase: string, checks?: SavePassphraseChecks }
  } = {}): Promise<void> => {
    if (enterPp) {
      await Util.sleep(3);
      await settingsPage.waitAndType('@input-step2ekm-passphrase-1', enterPp.passphrase);
      await settingsPage.waitAndType('@input-step2ekm-passphrase-2', enterPp.passphrase);
      await settingsPage.waitForContent('@ekm-setup-user-notify', 'Your keys are managed with your organization\'s Email Key Manager.');
      if (enterPp.checks?.isSavePassphraseHidden !== undefined) {
        expect(await settingsPage.hasClass('@input-step2ekm-save-passphrase-label', 'hidden')).to.equal(enterPp.checks.isSavePassphraseHidden);
      }
      if (enterPp.checks?.isSavePassphraseChecked !== undefined) {
        expect(await settingsPage.isChecked('@input-step2ekm-save-passphrase')).to.equal(enterPp.checks.isSavePassphraseChecked);
      }
      await settingsPage.waitAndClick('@input-step2ekm-continue');
    }
    if (expectErr) {
      await settingsPage.waitAll(['@container-err-title', '@container-err-text', '@action-retry-by-reloading']);
      expect(await settingsPage.read('@container-err-title')).to.contain(expectErr.title);
      expect(await settingsPage.read('@container-err-text')).to.contain(expectErr.text);
    } else {
      await settingsPage.waitAndClick('@action-step4done-account-settings', { retryErrs: true });
      await SettingsPageRecipe.ready(settingsPage);
    }
  };

  public static setupSmimeAccount = async (settingsPage: ControllablePage, key: TestKeyInfoWithFilepath) => {
    await SetupPageRecipe.manualEnter(settingsPage, key.title, { fillOnly: true, submitPubkey: false, usedPgpBefore: false, key });
    await settingsPage.waitAndClick('@input-step2bmanualenter-save', { delay: 1 });
    await Util.sleep(1);
    await settingsPage.waitAndRespondToModal('confirm', 'confirm', 'Using S/MIME as the only key on account is experimental.');
    await settingsPage.waitAndClick('@action-step4done-account-settings', { delay: 1 });
    await SettingsPageRecipe.ready(settingsPage);
  };

  // eslint-disable-next-line max-len
  private static createBegin = async (settingsPage: ControllablePage, keyTitle: string, { key, usedPgpBefore = false, skipForPassphrase = false }: { key?: { passphrase: string }, usedPgpBefore?: boolean, skipForPassphrase?: boolean } = {}) => {
    const k = key || Config.key(keyTitle);
    if (usedPgpBefore) {
      await settingsPage.waitAndClick('@action-step0foundkey-choose-manual-create', { timeout: 30 });
    } else {
      if (skipForPassphrase) {
        await settingsPage.waitAndClick('#lost_pass_phrase');
        await settingsPage.waitAndClick('.action_skip_recovery');
        await settingsPage.waitAndRespondToModal('confirm', 'confirm', 'Your account will be set up for encryption again, but your previous encrypted emails will be unreadable.');
        await settingsPage.waitAndClick('@action-step1easyormanual-choose-manual-create', { timeout: 30, retryErrs: true });
      } else {
        await settingsPage.waitAndClick('@action-step1easyormanual-choose-manual-create', { timeout: 30, retryErrs: true });
      }
    }
    await settingsPage.waitAndType('@input-step2bmanualcreate-passphrase-1', k.passphrase);
    await settingsPage.waitAndType('@input-step2bmanualcreate-passphrase-2', k.passphrase);
  };

}
