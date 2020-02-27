/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { Config, Util } from '../../util';

import { ControllablePage } from '../../browser';
import { PageRecipe } from './abstract-page-recipe';
import { SettingsPageRecipe } from './settings-page-recipe';
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
};

export class SetupPageRecipe extends PageRecipe {

  // public static setup_create_simple = async (settingsPage: ControllablePage, key_title: string, {used_pgp_before=false}: {used_pgp_before?: boolean}={}) => {
  //   await PageRecipe.setup_create_begin(settingsPage, key_title, {used_pgp_before});
  //   await settingsPage.wait_and_click('@input-step2bmanualcreate-create-and-save');
  //   await settingsPage.wait_and_click('@action-backup-....');
  //   // todo
  //   await settingsPage.wait_and_click('@action-step4done-account-settings');
  // }

  // eslint-disable-next-line max-len
  public static createAdvanced = async (settingsPage: ControllablePage, keyTitle: string, backup: "none" | "email" | "file", { usedPgpBefore = false, submitPubkey = false }: { usedPgpBefore?: boolean, submitPubkey?: boolean } = {}) => {
    await SetupPageRecipe.createBegin(settingsPage, keyTitle, { usedPgpBefore });
    await settingsPage.waitAndClick('@input-step2bmanualcreate-backup-inbox'); // uncheck
    if (!submitPubkey) {
      await settingsPage.waitAndClick('@input-step2bmanualcreate-submit-pubkey'); // uncheck
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
    }
    await settingsPage.waitAndClick('@action-backup-step3manual-continue');
    if (backup === 'file') {
      await settingsPage.waitAll('@ui-modal-info', { timeout: 60 }); // explicit wait first with longer timeout - creating key can take a while
      await settingsPage.waitAndRespondToModal('info', 'confirm', 'Downloading private key backup file');
    }
    await settingsPage.waitAll('@action-step4done-account-settings', { timeout: 60 }); // create key timeout
    await settingsPage.waitAndClick('@action-step4done-account-settings');
    await SettingsPageRecipe.ready(settingsPage);
  }

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
    }: ManualEnterOpts = {}
  ) {
    const k = Config.key(keyTitle);
    if (!noPrvCreateOrgRule) {
      if (usedPgpBefore) {
        await settingsPage.waitAndClick('@action-step0foundkey-choose-manual-enter', { retryErrs: true });
      } else {
        await settingsPage.waitAndClick('@action-step1easyormanual-choose-manual-enter', { retryErrs: true });
      }
    }
    await settingsPage.waitAndClick('@input-step2bmanualenter-source-paste');
    await settingsPage.waitAndType('@input-step2bmanualenter-ascii-key', k.armored || '');
    await settingsPage.waitAndClick('@input-step2bmanualenter-passphrase'); // blur ascii key input
    if (noPrvCreateOrgRule) { // NO_PRV_CREATE cannot use the back button, so that they cannot select another setup method
      await settingsPage.notPresent('@action-setup-go-back');
    }
    if (savePassphrase) {
      await settingsPage.waitAndClick('@input-step2bmanualenter-save-passphrase');
    }
    if (!naked) {
      await Util.sleep(1);
      await settingsPage.notPresent('@action-step2bmanualenter-new-random-passphrase');
      await settingsPage.waitAndType('@input-step2bmanualenter-passphrase', k.passphrase);
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
        await settingsPage.waitAndType('@input-step2bmanualenter-passphrase', k.passphrase);
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
        await settingsPage.waitAll('@input-compatibility-fix-expire-years');
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
  }

  public static autoKeygen = async (settingsPage: ControllablePage): Promise<void> => {
    await settingsPage.waitAndClick('@action-step4done-account-settings');
    await SettingsPageRecipe.ready(settingsPage);
  }

  private static createBegin = async (settingsPage: ControllablePage, keyTitle: string, { usedPgpBefore = false }: { usedPgpBefore?: boolean } = {}) => {
    const k = Config.key(keyTitle);
    if (usedPgpBefore) {
      await settingsPage.waitAndClick('@action-step0foundkey-choose-manual-create');
    } else {
      await settingsPage.waitAndClick('@action-step1easyormanual-choose-manual-create');
    }
    await settingsPage.waitAndType('@input-step2bmanualcreate-passphrase-1', k.passphrase);
    await settingsPage.waitAndType('@input-step2bmanualcreate-passphrase-2', k.passphrase);
  }

}
