import { TestWithBrowser, TestWithGlobalBrowser } from '..';
import { SettingsPageRecipe, SetupPageRecipe, InboxPageRecipe } from '../page_recipe';
import { Url } from '../../browser';
import * as ava from 'ava';
import { Util, Config } from '../../util';
import { expect } from 'chai';
import { BrowserRecipe } from '../browser_recipe';

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

  ava.test('settings - change passphrase - current in local storage', testWithNewBrowser(async (browser, t) => {
    const { acctEmail, settingsPage } = await BrowserRecipe.setUpFcPpChangeAcct(browser);
    const newPp = `temp ci test pp: ${Util.lousyRandom()}`;
    await SettingsPageRecipe.changePassphrase(settingsPage, undefined, newPp); // change pp and test
    await InboxPageRecipe.checkDecryptMsg(browser, { acctEmail, threadId: '16819bec18d4e011', expectedContent: 'changed correctly if this can be decrypted' });
  }));

  ava.test('settings - change passphrase - current in session known', testWithNewBrowser(async (browser, t) => {
    const { acctEmail, k, settingsPage } = await BrowserRecipe.setUpFcPpChangeAcct(browser);
    const newPp = `temp ci test pp: ${Util.lousyRandom()}`;
    await SettingsPageRecipe.changePassphraseRequirement(settingsPage, k.passphrase, 'session');
    // decrypt msg and enter pp so that it's remembered in session
    await InboxPageRecipe.checkDecryptMsg(browser, { acctEmail, threadId: '16819bec18d4e011', expectedContent: 'changed correctly if this can be decrypted', enterPp: k.passphrase });
    // change pp - should not ask for pp because already in session
    await SettingsPageRecipe.changePassphrase(settingsPage, undefined, newPp);
    // now it will remember the pass phrase so decrypts without asking
    await InboxPageRecipe.checkDecryptMsg(browser, { acctEmail, threadId: '16819bec18d4e011', expectedContent: 'changed correctly if this can be decrypted' });
    // make it forget pass phrase by switching requirement to storage then back to session
    await SettingsPageRecipe.changePassphraseRequirement(settingsPage, newPp, 'storage');
    await SettingsPageRecipe.changePassphraseRequirement(settingsPage, newPp, 'session');
    // test decrypt - should ask for new pass phrase
    await InboxPageRecipe.checkDecryptMsg(browser, { acctEmail, threadId: '16819bec18d4e011', expectedContent: 'changed correctly if this can be decrypted', enterPp: newPp });
  }));

  ava.test('settings - change passphrase - current in session unknown', testWithNewBrowser(async (browser, t) => {
    const { acctEmail, k, settingsPage } = await BrowserRecipe.setUpFcPpChangeAcct(browser);
    const newPp = `temp ci test pp: ${Util.lousyRandom()}`;
    await SettingsPageRecipe.changePassphraseRequirement(settingsPage, k.passphrase, 'session');
    // pp wiped after switching to session - should be needed to change pp
    await SettingsPageRecipe.changePassphrase(settingsPage, k.passphrase, newPp);
    // now it will remember the pass phrase so decrypts without asking
    await InboxPageRecipe.checkDecryptMsg(browser, { acctEmail, threadId: '16819bec18d4e011', expectedContent: 'changed correctly if this can be decrypted' });
    // make it forget pass phrase by switching requirement to storage then back to session
    await SettingsPageRecipe.changePassphraseRequirement(settingsPage, newPp, 'storage');
    await SettingsPageRecipe.changePassphraseRequirement(settingsPage, newPp, 'session');
    // test decrypt - should ask for new pass phrase
    await InboxPageRecipe.checkDecryptMsg(browser, { acctEmail, threadId: '16819bec18d4e011', expectedContent: 'changed correctly if this can be decrypted', enterPp: newPp });
  }));

  ava.test.todo('settings - change passphrase - mismatch curent pp');

  ava.test.todo('settings - change passphrase - mismatch new pp');

};
