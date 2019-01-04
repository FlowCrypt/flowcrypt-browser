import { TestWithBrowser, TestWithGlobalBrowser } from '..';
import { SettingsPageRecipe } from '../page_recipe';
import { Url } from '../../browser';
import * as ava from 'ava';
import { Util, Config } from '../../util';
import { expect } from 'chai';

export let defineSettingsTests = (testWithNewBrowser: TestWithBrowser, testWithSemaphoredGlobalBrowser: TestWithGlobalBrowser) => {

  ava.test('settings[global] - my own emails show as contacts', testWithSemaphoredGlobalBrowser('compatibility', async (browser, t) => {
    const settingsPage = await browser.newPage(Url.extensionSettings('flowcrypt.compatibility@gmail.com'));
    await SettingsPageRecipe.toggleScreen(settingsPage, 'additional');
    const comtactsFrame = await SettingsPageRecipe.awaitNewPageFrame(settingsPage, '@action-open-contacts-page', ['contacts.htm', 'placement=settings']);
    await comtactsFrame.waitAll('@page-contacts');
    await Util.sleep(1);
    expect(await comtactsFrame.read('@page-contacts')).to.contain('flowcrypt.compatibility@gmail.com');
    expect(await comtactsFrame.read('@page-contacts')).to.contain('flowcryptcompatibility@gmail.com');
    await SettingsPageRecipe.closeDialog(settingsPage);
    await SettingsPageRecipe.toggleScreen(settingsPage, 'basic');
  }));

  ava.test('settings[global] - attester shows my emails', testWithSemaphoredGlobalBrowser('compatibility', async (browser, t) => {
    const settingsPage = await browser.newPage(Url.extensionSettings('flowcrypt.compatibility@gmail.com'));
    await SettingsPageRecipe.toggleScreen(settingsPage, 'additional');
    const attesterFrame = await SettingsPageRecipe.awaitNewPageFrame(settingsPage, '@action-open-attester-page', ['keyserver.htm', 'placement=settings']);
    await attesterFrame.waitAll('@page-attester');
    await Util.sleep(1);
    await attesterFrame.waitTillGone('@spinner');
    await Util.sleep(1);
    expect(await attesterFrame.read('@page-attester')).to.contain('flowcrypt.compatibility@gmail.com');
    expect(await attesterFrame.read('@page-attester')).to.contain('flowcryptcompatibility@gmail.com');
    await SettingsPageRecipe.closeDialog(settingsPage);
    await SettingsPageRecipe.toggleScreen(settingsPage, 'basic');
  }));

  ava.test('settings[global] - verify key presense 1pp1', testWithSemaphoredGlobalBrowser('compatibility', async (browser, t) => {
    const settingsPage = await browser.newPage(Url.extensionSettings('flowcrypt.compatibility@gmail.com'));
    await SettingsPageRecipe.verifyMyKeyPage(settingsPage, 'flowcrypt.compatibility.1pp1', 'button');
  }));

  ava.test('settings[global] - test pass phrase', testWithSemaphoredGlobalBrowser('compatibility', async (browser, t) => {
    const settingsPage = await browser.newPage(Url.extensionSettings('flowcrypt.compatibility@gmail.com'));
    await SettingsPageRecipe.passphraseTest(settingsPage, Config.key('flowcrypt.wrong.passphrase').passphrase, false);
    await SettingsPageRecipe.passphraseTest(settingsPage, Config.key('flowcrypt.compatibility.1pp1').passphrase, true);
  }));

  ava.test.todo('settings - verify 2pp1 key presense');
  // await tests.settings_my_key_tests(settingsPage, 'flowcrypt.compatibility.2pp1', 'link');

  ava.test('settings[global] - feedback form', testWithSemaphoredGlobalBrowser('compatibility', async (browser, t) => {
    const settingsPage = await browser.newPage(Url.extensionSettings('flowcrypt.compatibility@gmail.com'));
    await settingsPage.waitAndClick('@action-open-modules-help');
    await settingsPage.waitAll('@dialog');
    const helpFrame = await settingsPage.getFrame(['help.htm']);
    await helpFrame.waitAndType('@input-feedback-message', 'automated puppeteer test: help form from settings footer');
    const dialog = await settingsPage.triggerAndWaitNewAlert(() => helpFrame.waitAndClick('@action-feedback-send'));
    await dialog.accept();
  }));

  ava.test('settings[global] - view contact public key', testWithSemaphoredGlobalBrowser('compatibility', async (browser, t) => {
    const settingsPage = await browser.newPage(Url.extensionSettings('flowcrypt.compatibility@gmail.com'));
    await SettingsPageRecipe.toggleScreen(settingsPage, 'additional');
    const contactsFrame = await SettingsPageRecipe.awaitNewPageFrame(settingsPage, '@action-open-contacts-page', ['contacts.htm', 'placement=settings']);
    await contactsFrame.waitAll('@page-contacts');
    await Util.sleep(1);
    await contactsFrame.waitAndClick('@action-show-pubkey', { confirmGone: true });
    await Util.sleep(1);
    expect(await contactsFrame.read('@page-contacts')).to.contain('flowcrypt.compatibility@gmail.com');
    expect(await contactsFrame.read('@page-contacts')).to.contain('LEMON VIABLE BEST MULE TUNA COUNTRY');
    expect(await contactsFrame.read('@page-contacts')).to.contain('5520CACE2CB61EA713E5B0057FDE685548AEA788');
    expect(await contactsFrame.read('@page-contacts')).to.contain('-----BEGIN PGP PUBLIC KEY BLOCK-----');
    await contactsFrame.waitAndClick('@action-back-to-contact-list', { confirmGone: true });
    await Util.sleep(1);
    expect(await contactsFrame.read('@page-contacts')).to.contain('flowcrypt.compatibility@gmail.com');
    expect(await contactsFrame.read('@page-contacts')).to.contain('flowcryptcompatibility@gmail.com');
    await SettingsPageRecipe.closeDialog(settingsPage);
    await SettingsPageRecipe.toggleScreen(settingsPage, 'basic');
  }));

  ava.test('settings[global] - my key page - primary + secondary', testWithSemaphoredGlobalBrowser('compatibility', async (browser, t) => {
    const settingsPage = await browser.newPage(Url.extensionSettings('flowcrypt.compatibility@gmail.com'));
    await SettingsPageRecipe.verifyMyKeyPage(settingsPage, 'flowcrypt.compatibility.1pp1', 'link', 0);
    await SettingsPageRecipe.verifyMyKeyPage(settingsPage, 'flowcrypt.compatibility.2pp1', 'link', 1);
  }));

  ava.test.todo('settings - edit contact public key');

  ava.test.todo('settings - change passphrase - in local storage');

  ava.test.todo('settings - change passphrase - in session');

  ava.test.todo('settings - change passphrase - unknown');

  /**
   * input-current-pp
   * data-test="action-confirm-current-pp"
   * input-new-pp
   * action-show-confirm-new-pp
   * input-confirm-new-pp
   * action-confirm-new-pp
   */

};
