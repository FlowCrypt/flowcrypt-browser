/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { Config, Util } from '../../util';
import { BrowserHandle, ControllableFrame, ControllablePage } from '../../browser';

import { PageRecipe } from './abstract-page-recipe';
import { assert, expect } from 'chai';
import { Str } from '../../core/common';
import { AvaContext } from '../tooling';
import { TestUrls } from '../../browser/test-urls';
import { Xss } from '../../platform/xss';
import { Key, KeyUtil } from '../../core/crypto/key';
import { readFileSync } from 'fs';

export type SavePassphraseChecks = {
  isSavePassphraseHidden?: boolean | undefined,
  isSavePassphraseChecked?: boolean | undefined
};

export class SettingsPageRecipe extends PageRecipe {

  public static ready = async (settingsPage: ControllablePage) => {
    await settingsPage.waitAll('@page-settings');
    await settingsPage.waitForSelTestState('ready');
  };

  public static toggleScreen = async (settingsPage: ControllablePage, to: "basic" | "additional") => {
    await SettingsPageRecipe.ready(settingsPage);
    await Util.sleep(0.5);
    await settingsPage.waitAndClick(to === 'basic' ? '@action-toggle-screen-basic' : '@action-toggle-screen-additional'); // switch
    await Util.sleep(0.5);
    await settingsPage.waitAll(to === 'basic' ? '@action-toggle-screen-additional' : '@action-toggle-screen-basic'); // wait for opposite button to show up
    await Util.sleep(0.5);
  };

  public static closeDialog = async (settingsPage: ControllablePage) => {
    await settingsPage.waitAndClick('@dialog-close', { delay: 3 });
    await settingsPage.waitTillGone('@dialog');
  };

  public static awaitNewPageFrame = async (settingsPage: ControllablePage, actionBtnSel: string, frameUrlFilter: string[]): Promise<ControllableFrame> => {
    await SettingsPageRecipe.ready(settingsPage);
    await settingsPage.waitAndClick(actionBtnSel);
    await settingsPage.waitAll('@dialog');
    return await settingsPage.getFrame(frameUrlFilter);
  };

  public static swithAcct = async (settingsPage: ControllablePage, acctEmail: string) => {
    await SettingsPageRecipe.ready(settingsPage);
    await settingsPage.waitAndClick('@action-toggle-accounts-menu');
    await settingsPage.waitAndClick(`@action-switch-to-account(${acctEmail})`);
  };

  public static changePassphrase = async (settingsPage: ControllablePage, currentPp: string | undefined, newPp: string) => {
    await SettingsPageRecipe.ready(settingsPage);
    const securityFrame = await SettingsPageRecipe.awaitNewPageFrame(settingsPage, '@action-open-security-page', ['security.htm', 'placement=settings']);
    await securityFrame.waitAndClick('@action-change-passphrase-begin', { delay: 1 });
    if (currentPp) {
      await securityFrame.waitAndType('@input-current-pp', currentPp, { delay: 1 });
      await securityFrame.waitAndClick('@action-confirm-current-pp', { delay: 1 });
    }
    await securityFrame.waitAndType('@input-new-pp', newPp, { delay: 1 });
    await securityFrame.waitAndClick('@action-show-confirm-new-pp', { delay: 1 });
    await securityFrame.waitAndType('@input-confirm-new-pp', newPp, { delay: 1 });
    await securityFrame.waitAndClick('@action-confirm-new-pp', { delay: 1 });
    await securityFrame.waitAndRespondToModal('info', 'confirm', 'Now that you changed your pass phrase, you should back up your key');
    await securityFrame.waitAll('@container-backup-dialog'); // offers a new backup
    await securityFrame.waitAndClick('@input-backup-step3manual-file');
    await securityFrame.waitAndClick('@action-backup-step3manual-continue');
    await securityFrame.waitAndRespondToModal('info', 'confirm', 'Downloading private key backup file');
    await securityFrame.waitAndRespondToModal('info', 'confirm', 'Your private key has been successfully backed up');
  };

  public static forgetAllPassPhrasesInStorage = async (settingsPage: ControllablePage, passphrase: string) => {
    await SettingsPageRecipe.ready(settingsPage);
    const securityFrame = await SettingsPageRecipe.awaitNewPageFrame(settingsPage, '@action-open-security-page', ['security.htm', 'placement=settings']);
    await securityFrame.waitAndClick('@action-forget-pp');
    await securityFrame.waitAndType('@input-confirm-pass-phrase', passphrase);
    await securityFrame.waitAndClick('@action-confirm-pass-phrase-requirement-change');
    await SettingsPageRecipe.closeDialog(settingsPage);
  };

  public static verifyMyKeyPage = async (settingsPage: ControllablePage, expectedKeyName: string, trigger: "button" | "link", linkIndex?: number) => {
    await SettingsPageRecipe.ready(settingsPage);
    await SettingsPageRecipe.toggleScreen(settingsPage, 'additional');
    const myKeyFrame = await SettingsPageRecipe.awaitNewPageFrame(settingsPage,
      trigger === 'button' ? '@action-open-pubkey-page' : `@action-show-key-${linkIndex}`, ['my_key.htm', 'placement=settings']);
    await Util.sleep(1);
    const k = Config.key(expectedKeyName);
    await myKeyFrame.waitAll('@content-fingerprint');
    if (!k.longid) {
      throw new Error(`Missing key longid for tests: ${expectedKeyName}`);
    }
    expect(await myKeyFrame.read('@content-fingerprint')).to.contain(Str.spaced(k.longid));
    await SettingsPageRecipe.closeDialog(settingsPage);
    await SettingsPageRecipe.toggleScreen(settingsPage, 'basic');
  };

  public static passphraseTest = async (settingsPage: ControllablePage, passphrase: string, expectMatch: boolean) => {
    await SettingsPageRecipe.ready(settingsPage);
    const securityFrame = await SettingsPageRecipe.awaitNewPageFrame(settingsPage, '@action-open-security-page', ['security.htm', 'placement=settings']);
    await securityFrame.waitAndClick('@action-test-passphrase-begin');
    await securityFrame.waitAndType('@input-test-passphrase', passphrase);
    await securityFrame.waitAndClick('@action-test-passphrase', { delay: 0.5 });
    if (expectMatch) {
      await securityFrame.waitAndClick('@action-test-passphrase-successful-close');
    } else {
      await securityFrame.waitAndRespondToModal('warning', 'confirm', 'not match');
      await SettingsPageRecipe.closeDialog(settingsPage);
    }
    await settingsPage.waitTillGone('@dialog');
  };

  public static addKeyTest = async (
    t: AvaContext,
    browser: BrowserHandle,
    acctEmail: string,
    armoredPrvKey: string,
    passphrase: string,
    checks: SavePassphraseChecks = {},
    savePassphrase = true
  ) => {
    return await SettingsPageRecipe.addKeyTestEx(t, browser, acctEmail, { armoredPrvKey }, passphrase, checks, savePassphrase);
  };

  public static addKeyTestEx = async (
    t: AvaContext,
    browser: BrowserHandle,
    acctEmail: string,
    prvKey: { armoredPrvKey?: string, filePath?: string },
    passphrase: string,
    checks: SavePassphraseChecks = {},
    savePassphrase = true
  ) => {
    const addPrvPage = await browser.newPage(t, `/chrome/settings/modules/add_key.htm?acctEmail=${Xss.escape(acctEmail)}&parent_tab_id=0`);
    let key: Key | undefined;
    if (prvKey.armoredPrvKey) {
      await addPrvPage.waitAndClick('@source-paste');
      await addPrvPage.waitAndType('@input-armored-key', prvKey.armoredPrvKey);
      key = await KeyUtil.parse(prvKey.armoredPrvKey);
    } else if (prvKey.filePath) {
      const [fileChooser] = await Promise.all([
        addPrvPage.page.waitForFileChooser(),
        addPrvPage.waitAndClick('@source-file', { retryErrs: true })]);
      await fileChooser.accept([prvKey.filePath]);
      [key] = (await KeyUtil.readBinary(readFileSync(prvKey.filePath))).keys;
    } else {
      assert(false);
    }
    const fp = Str.spaced(Xss.escape(key!.id));
    await addPrvPage.waitAndClick('#toggle_input_passphrase');
    await addPrvPage.waitAndType('#input_passphrase', passphrase);
    if (checks.isSavePassphraseHidden !== undefined) {
      expect(await addPrvPage.hasClass('@input-save-passphrase-label', 'hidden')).to.equal(checks.isSavePassphraseHidden);
    }
    if (checks.isSavePassphraseChecked !== undefined) {
      expect(await addPrvPage.isChecked('@input-save-passphrase')).to.equal(checks.isSavePassphraseChecked);
    }
    if (!savePassphrase) {
      await addPrvPage.click('@input-save-passphrase-label');
    }
    await addPrvPage.waitAndClick('.action_add_private_key', { delay: 1 });
    await addPrvPage.waitTillGone('.swal2-container'); // dialog closed
    await Util.sleep(1);
    await addPrvPage.close();
    await Util.sleep(1);
    const settingsPage = await browser.newPage(t, TestUrls.extensionSettings(acctEmail));
    await SettingsPageRecipe.toggleScreen(settingsPage, 'additional');
    await settingsPage.waitForContent('@container-settings-keys-list', fp); // confirm key successfully loaded
    await settingsPage.close();
  };
}
