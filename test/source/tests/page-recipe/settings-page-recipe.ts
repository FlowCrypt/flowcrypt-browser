/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { Config, Util } from '../../util';
import { ControllableFrame, ControllablePage } from '../../browser';

import { PageRecipe } from './abstract-page-recipe';
import { expect } from 'chai';
import { Str } from '../../core/common';

export class SettingsPageRecipe extends PageRecipe {

  public static ready = async (settingsPage: ControllablePage) => {
    await settingsPage.waitAll('@page-settings');
    await settingsPage.waitForSelTestState('ready');
  }

  public static toggleScreen = async (settingsPage: ControllablePage, to: "basic" | "additional") => {
    await SettingsPageRecipe.ready(settingsPage);
    await Util.sleep(0.5);
    await settingsPage.waitAndClick(to === 'basic' ? '@action-toggle-screen-basic' : '@action-toggle-screen-additional'); // switch
    await Util.sleep(0.5);
    await settingsPage.waitAll(to === 'basic' ? '@action-toggle-screen-additional' : '@action-toggle-screen-basic'); // wait for opposite button to show up
    await Util.sleep(0.5);
  }

  public static closeDialog = async (settingsPage: ControllablePage) => {
    await settingsPage.waitAndClick('@dialog-close', { delay: 3 });
    await settingsPage.waitTillGone('@dialog');
  }

  public static awaitNewPageFrame = async (settingsPage: ControllablePage, actionBtnSel: string, frameUrlFilter: string[]): Promise<ControllableFrame> => {
    await SettingsPageRecipe.ready(settingsPage);
    await settingsPage.waitAndClick(actionBtnSel);
    await settingsPage.waitAll('@dialog');
    return await settingsPage.getFrame(frameUrlFilter);
  }

  public static swithAcct = async (settingsPage: ControllablePage, acctEmail: string) => {
    await SettingsPageRecipe.ready(settingsPage);
    await settingsPage.waitAndClick('@action-toggle-accounts-menu');
    await settingsPage.waitAndClick(`@action-switch-to-account(${acctEmail})`);
  }

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
    await Util.sleep(3);
    await SettingsPageRecipe.closeDialog(settingsPage);
  }

  public static forgetAllPassPhrasesInStorage = async (settingsPage: ControllablePage, passphrase: string) => {
    await SettingsPageRecipe.ready(settingsPage);
    const securityFrame = await SettingsPageRecipe.awaitNewPageFrame(settingsPage, '@action-open-security-page', ['security.htm', 'placement=settings']);
    await securityFrame.waitAndClick('@action-forget-pp');
    await securityFrame.waitAndType('@input-confirm-pass-phrase', passphrase);
    await securityFrame.waitAndClick('@action-confirm-pass-phrase-requirement-change');
    await SettingsPageRecipe.closeDialog(settingsPage);
  }

  public static verifyMyKeyPage = async (settingsPage: ControllablePage, expectedKeyName: string, trigger: "button" | "link", linkIndex?: number) => {
    await SettingsPageRecipe.ready(settingsPage);
    await SettingsPageRecipe.toggleScreen(settingsPage, 'additional');
    const myKeyFrame = await SettingsPageRecipe.awaitNewPageFrame(settingsPage,
      trigger === 'button' ? '@action-open-pubkey-page' : `@action-show-key-${linkIndex}`, ['my_key.htm', 'placement=settings']);
    await Util.sleep(1);
    const k = Config.key(expectedKeyName);
    await myKeyFrame.waitAll('@content-longid');
    if (!k.longid) {
      throw new Error(`Missing key longid for tests: ${expectedKeyName}`);
    }
    expect(await myKeyFrame.read('@content-longid')).to.equal(Str.spaced(k.longid));
    await SettingsPageRecipe.closeDialog(settingsPage);
    await SettingsPageRecipe.toggleScreen(settingsPage, 'basic');
  }

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
  }

}
