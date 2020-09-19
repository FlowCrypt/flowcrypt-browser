/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import * as ava from 'ava';

import { Config, Util } from '../../util';
import { TestWithBrowser, internalTestState } from '../../test';

import { BrowserRecipe } from '../browser-recipe';
import { InboxPageRecipe } from '../page-recipe/inbox-page-recipe';
import { SettingsPageRecipe } from '../page-recipe/settings-page-recipe';
import { TestUrls } from '../../browser/test-urls';
import { TestVariant } from '../../util';
import { expect } from 'chai';

// tslint:disable:no-blank-lines-func

export let defineSettingsTests = (testVariant: TestVariant, testWithBrowser: TestWithBrowser) => {

  if (testVariant !== 'CONSUMER-LIVE-GMAIL') {

    ava.default('settings - my own emails show as contacts', testWithBrowser('compatibility', async (t, browser) => {
      const settingsPage = await browser.newPage(t, TestUrls.extensionSettings('flowcrypt.compatibility@gmail.com'));
      await SettingsPageRecipe.toggleScreen(settingsPage, 'additional');
      const comtactsFrame = await SettingsPageRecipe.awaitNewPageFrame(settingsPage, '@action-open-contacts-page', ['contacts.htm', 'placement=settings']);
      await comtactsFrame.waitAll('@page-contacts');
      await Util.sleep(1);
      expect(await comtactsFrame.read('@page-contacts')).to.contain('flowcrypt.compatibility@gmail.com');
      expect(await comtactsFrame.read('@page-contacts')).to.contain('flowcryptcompatibility@gmail.com');
      await SettingsPageRecipe.closeDialog(settingsPage);
      await SettingsPageRecipe.toggleScreen(settingsPage, 'basic');
    }));

    ava.default('settings - attester shows my emails', testWithBrowser('compatibility', async (t, browser) => {
      const settingsPage = await browser.newPage(t, TestUrls.extensionSettings('flowcrypt.compatibility@gmail.com'));
      await SettingsPageRecipe.toggleScreen(settingsPage, 'additional');
      const attesterFrame = await SettingsPageRecipe.awaitNewPageFrame(settingsPage, '@action-open-attester-page', ['keyserver.htm', 'placement=settings']);
      await attesterFrame.waitAll('@page-attester');
      await Util.sleep(1);
      await attesterFrame.waitTillGone('@spinner');
      await attesterFrame.waitForContent('@page-attester', 'flowcrypt.compatibility@gmail.com');
      await attesterFrame.waitForContent('@page-attester', 'flowcryptcompatibility@gmail.com');
      await SettingsPageRecipe.closeDialog(settingsPage);
      await SettingsPageRecipe.toggleScreen(settingsPage, 'basic');
    }));

    ava.default('settings - verify key presense 1pp1', testWithBrowser('compatibility', async (t, browser) => {
      const settingsPage = await browser.newPage(t, TestUrls.extensionSettings('flowcrypt.compatibility@gmail.com'));
      await SettingsPageRecipe.verifyMyKeyPage(settingsPage, 'flowcrypt.compatibility.1pp1', 'button');
    }));

    ava.default('settings - test pass phrase', testWithBrowser('compatibility', async (t, browser) => {
      const settingsPage = await browser.newPage(t, TestUrls.extensionSettings('flowcrypt.compatibility@gmail.com'));
      await SettingsPageRecipe.passphraseTest(settingsPage, Config.key('flowcrypt.wrong.passphrase').passphrase, false);
      await SettingsPageRecipe.passphraseTest(settingsPage, Config.key('flowcrypt.compatibility.1pp1').passphrase, true);
    }));

    ava.todo('settings - verify 2pp1 key presense');
    // await tests.settings_my_key_tests(settingsPage, 'flowcrypt.compatibility.2pp1', 'link');

    ava.default('settings - feedback form', testWithBrowser('compatibility', async (t, browser) => {
      const settingsPage = await browser.newPage(t, TestUrls.extensionSettings('flowcrypt.compatibility@gmail.com'));
      await settingsPage.waitAndClick('@action-open-modules-help');
      await settingsPage.waitAll('@dialog');
      const helpFrame = await settingsPage.getFrame(['help.htm']);
      await helpFrame.waitAndType('@input-feedback-message', 'automated puppeteer test: help form from settings footer');
      await helpFrame.waitAndClick('@action-feedback-send');
      await helpFrame.waitAndRespondToModal('info', 'confirm', 'Message sent!');
    }));

    ava.default('settings - view contact public key', testWithBrowser('compatibility', async (t, browser) => {
      const settingsPage = await browser.newPage(t, TestUrls.extensionSettings('flowcrypt.compatibility@gmail.com'));
      await SettingsPageRecipe.toggleScreen(settingsPage, 'additional');
      const contactsFrame = await SettingsPageRecipe.awaitNewPageFrame(settingsPage, '@action-open-contacts-page', ['contacts.htm', 'placement=settings']);
      await contactsFrame.waitAll('@page-contacts');
      await Util.sleep(1);
      await contactsFrame.waitAndClick('@action-show-pubkey-flowcryptcompatibilitygmailcom', { confirmGone: true });
      await Util.sleep(1);
      expect(await contactsFrame.read('@page-contacts')).to.contain('flowcrypt.compatibility@gmail.com');
      expect(await contactsFrame.read('@page-contacts')).to.contain('7FDE 6855 48AE A788');
      expect(await contactsFrame.read('@page-contacts')).to.contain('-----BEGIN PGP PUBLIC KEY BLOCK-----');
      await contactsFrame.waitAndClick('@action-back-to-contact-list', { confirmGone: true });
      await Util.sleep(1);
      expect(await contactsFrame.read('@page-contacts')).to.contain('flowcrypt.compatibility@gmail.com');
      expect(await contactsFrame.read('@page-contacts')).to.contain('flowcryptcompatibility@gmail.com');
      await SettingsPageRecipe.closeDialog(settingsPage);
      await SettingsPageRecipe.toggleScreen(settingsPage, 'basic');
    }));

    ava.default('settings - my key page - primary + secondary', testWithBrowser('compatibility', async (t, browser) => {
      const settingsPage = await browser.newPage(t, TestUrls.extensionSettings('flowcrypt.compatibility@gmail.com'));
      await SettingsPageRecipe.verifyMyKeyPage(settingsPage, 'flowcrypt.compatibility.1pp1', 'link', 0);
      await SettingsPageRecipe.verifyMyKeyPage(settingsPage, 'flowcrypt.compatibility.2pp1', 'link', 1);
    }));

    ava.todo('settings - edit contact public key');

    ava.default('settings - change passphrase - current in local storage', testWithBrowser(undefined, async (t, browser) => {
      const { acctEmail, settingsPage } = await BrowserRecipe.setUpFcPpChangeAcct(t, browser);
      const newPp = `temp ci test pp: ${Util.lousyRandom()}`;
      await SettingsPageRecipe.changePassphrase(settingsPage, undefined, newPp); // change pp and test
      await InboxPageRecipe.checkDecryptMsg(t, browser, { acctEmail, threadId: '16819bec18d4e011', expectedContent: 'changed correctly if this can be decrypted' });
    }));

    ava.default('settings - change passphrase - current in session known', testWithBrowser(undefined, async (t, browser) => {
      const { acctEmail, k, settingsPage } = await BrowserRecipe.setUpFcPpChangeAcct(t, browser);
      const newPp = `temp ci test pp: ${Util.lousyRandom()}`;
      await SettingsPageRecipe.forgetAllPassPhrasesInStorage(settingsPage, k.passphrase);
      // decrypt msg and enter pp so that it's remembered in session
      await InboxPageRecipe.checkDecryptMsg(t, browser, { acctEmail, threadId: '16819bec18d4e011', expectedContent: 'changed correctly if this can be decrypted', enterPp: k.passphrase });
      // change pp - should not ask for pp because already in session
      await SettingsPageRecipe.changePassphrase(settingsPage, undefined, newPp);
      // now it will remember the pass phrase so decrypts without asking
      await InboxPageRecipe.checkDecryptMsg(t, browser, { acctEmail, threadId: '16819bec18d4e011', expectedContent: 'changed correctly if this can be decrypted' });
      // test decrypt - should ask for new pass phrase
      await InboxPageRecipe.checkDecryptMsg(t, browser, {
        acctEmail, threadId: '16819bec18d4e011',
        expectedContent: 'changed correctly if this can be decrypted', enterPp: newPp, finishCurrentSession: true
      });
    }));

    ava.default('settings - change passphrase - current in session unknown', testWithBrowser(undefined, async (t, browser) => {
      const { acctEmail, k, settingsPage } = await BrowserRecipe.setUpFcPpChangeAcct(t, browser);
      const newPp = `temp ci test pp: ${Util.lousyRandom()}`;
      await SettingsPageRecipe.forgetAllPassPhrasesInStorage(settingsPage, k.passphrase);
      // pp wiped after switching to session - should be needed to change pp
      await SettingsPageRecipe.changePassphrase(settingsPage, k.passphrase, newPp);
      // now it will remember the pass phrase so decrypts without asking
      await InboxPageRecipe.checkDecryptMsg(t, browser, { acctEmail, threadId: '16819bec18d4e011', expectedContent: 'changed correctly if this can be decrypted' });
      // test decrypt - should ask for new pass phrase
      await InboxPageRecipe.checkDecryptMsg(t, browser, {
        acctEmail, threadId: '16819bec18d4e011',
        expectedContent: 'changed correctly if this can be decrypted', enterPp: newPp, finishCurrentSession: true
      });
    }));

    ava.default('settings - Catch.reportErr reports an error', testWithBrowser('compatibility', async (t, browser) => {

      const settingsPage = await browser.newPage(t, TestUrls.extensionSettings('flowcrypt.compatibility@gmail.com'));
      await SettingsPageRecipe.toggleScreen(settingsPage, 'additional');
      const experimentalFrame = await SettingsPageRecipe.awaitNewPageFrame(settingsPage, '@action-open-module-experimental', ['experimental.htm']);
      await experimentalFrame.waitAndClick('@action-throw-err'); // mock tests will verify that err was reported to mock backend in `test.ts`
      internalTestState.expectiIntentionalErrReport = true;
    }));

    ava.default('settings - attachment previews are rendered according to their types', testWithBrowser('compatibility', async (t, browser) => {
      const inboxPage = await browser.newPage(t, TestUrls.extension(`chrome/settings/inbox/inbox.htm?acctEmail=flowcrypt.compatibility@gmail.com&threadId=1729eee9493eb76a`));
      // image
      const attachmentImage = await inboxPage.getFrame(['attachment.htm', 'name=tiny-face.png']);
      await attachmentImage.waitForSelTestState('ready');
      await attachmentImage.click('body');
      const attachmentPreviewImage = await inboxPage.getFrame(['attachment_preview.htm']);
      await attachmentPreviewImage.waitAll('#attachment-preview-container img.attachment-preview-img');
      await inboxPage.press('Escape');
      // text
      const attachmentText = await inboxPage.getFrame(['attachment.htm', 'name=small.txt']);
      await attachmentText.waitForSelTestState('ready');
      await attachmentText.click('body');
      const attachmentPreviewText = await inboxPage.getFrame(['attachment_preview.htm']);
      await attachmentPreviewText.waitForContent('#attachment-preview-container .attachment-preview-txt', 'small text file');
      await inboxPage.press('Escape');
      // no preview
      const attachmentOther = await inboxPage.getFrame(['attachment.htm', 'name=small.pdf']);
      await attachmentOther.waitForSelTestState('ready');
      await attachmentOther.click('body');
      const attachmentPreviewOther = await inboxPage.getFrame(['attachment_preview.htm']);
      await attachmentPreviewOther.waitForContent('#attachment-preview-container .attachment-preview-unavailable', 'No preview available');
      await attachmentPreviewOther.waitAll('#attachment-preview-container .attachment-preview-unavailable #attachment-preview-download');
    }));

    ava.default('settings - pgp/mime preview and download attachment', testWithBrowser('compatibility', async (t, browser) => {
      const inboxPage = await browser.newPage(t, TestUrls.extension(`chrome/settings/inbox/inbox.htm?acctEmail=flowcrypt.compatibility@gmail.com&threadId=16e8b01f136c3d28`));
      const pgpBlockFrame = await inboxPage.getFrame(['pgp_block.htm']);
      // check if download is awailable
      await pgpBlockFrame.waitAll('.download-attachment');
      // and preview
      await pgpBlockFrame.waitAndClick('.preview-attachment');
      const attachmentPreviewImage = await inboxPage.getFrame(['attachment_preview.htm']);
      await attachmentPreviewImage.waitAll('#attachment-preview-container img.attachment-preview-img');
    }));

    ava.todo('settings - change passphrase - mismatch curent pp');

    ava.todo('settings - change passphrase - mismatch new pp');

  }

};
