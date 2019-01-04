import { TestWithBrowser, TestWithGlobalBrowser } from '..';
import { ComposePageRecipe, SettingsPageRecipe } from '../page_recipe';
import { BrowserRecipe } from '../browser_recipe';
import { Url } from '../../browser';
import * as ava from 'ava';
import { Util, Config } from '../../util';

export const defineComposeTests = (testWithNewBrowser: TestWithBrowser, testWithSemaphoredGlobalBrowser: TestWithGlobalBrowser) => {

  ava.test('compose - standalone - can set and remember default send address', testWithNewBrowser(async (browser, t) => {
    await BrowserRecipe.setUpFcCompatAcct(browser);
    let composePage = await ComposePageRecipe.openStandalone(browser);
    await ComposePageRecipe.changeDefSendingAddr(composePage, 'flowcrypt.compatibility@gmail.com');
    await composePage.close();
    composePage = await ComposePageRecipe.openStandalone(browser);
    let currentlySelectedFrom = await composePage.value('@input-from');
    if (currentlySelectedFrom !== 'flowcrypt.compatibility@gmail.com') {
      throw new Error('did not remember selected from addr: flowcrypt.compatibility@gmail.com');
    }
    await ComposePageRecipe.changeDefSendingAddr(composePage, 'flowcryptcompatibility@gmail.com');
    await composePage.close();
    composePage = await ComposePageRecipe.openStandalone(browser);
    currentlySelectedFrom = await composePage.value('@input-from');
    if (currentlySelectedFrom !== 'flowcryptcompatibility@gmail.com') {
      throw new Error('did not remember selected from addr: flowcryptcompatibility@gmail.com');
    }
    await ComposePageRecipe.changeDefSendingAddr(composePage, 'flowcrypt.compatibility@gmail.com');
    await composePage.close();
  }));

  ava.test('compose - standalone - signed with entered pass phrase + will remember pass phrase in session', testWithNewBrowser(async (browser, t) => {
    const k = Config.key('flowcrypt.compatibility.1pp1');
    await BrowserRecipe.setUpFcCompatAcct(browser);
    const settingsPage = await browser.newPage(Url.extensionSettings('flowcrypt.compatibility@gmail.com'));
    await SettingsPageRecipe.changePassphraseRequirement(settingsPage, k.passphrase, 'session');
    const composeFrame = await ComposePageRecipe.openInSettings(settingsPage);
    await ComposePageRecipe.fillMsg(composeFrame, 'human@flowcrypt.com', 'sign with entered pass phrase');
    await composeFrame.waitAndClick('@action-switch-to-sign', { delay: 0.5 });
    await composeFrame.waitAndClick('@action-send');
    const passphraseDialog = await settingsPage.getFrame(['passphrase.htm']);
    await passphraseDialog.waitAndType('@input-pass-phrase', k.passphrase);
    await passphraseDialog.waitAndClick('@action-confirm-pass-phrase-entry'); // confirming pass phrase will send the message
    await settingsPage.waitTillGone('@dialog'); // however the @dialog would not go away - so that is a (weak but sufficient) telling sign
    // signed - done, now try to see if it remembered pp in session
    const composePage = await ComposePageRecipe.openStandalone(browser);
    await ComposePageRecipe.fillMsg(composePage, 'human@flowcrypt.com', 'signed message pp in session');
    await composePage.click('@action-switch-to-sign'); // should remember pass phrase in session from previous entry
    await ComposePageRecipe.sendAndClose(composePage);
    await settingsPage.close();
  }));

  ava.test('compose - standalone - can load contact based on name', testWithNewBrowser(async (browser, t) => {
    await BrowserRecipe.setUpFcCompatAcct(browser);
    const composePage = await ComposePageRecipe.openStandalone(browser);
    await composePage.type('@input-to', 'human'); // test loading of contacts
    await composePage.waitAll(['@container-contacts', '@action-select-contact(human@flowcrypt.com)']);
  }));

  ava.test(`compose - standalone - can choose found contact`, testWithNewBrowser(async (browser, t) => {
    await BrowserRecipe.setUpFcCompatAcct(browser);
    const composePage = await ComposePageRecipe.openStandalone(browser);
    // composePage.enable_debugging('choose-contact');
    await composePage.type('@input-to', 'human'); // test loading of contacts
    await composePage.waitAll(['@container-contacts', '@action-select-contact(human@flowcrypt.com)'], { timeout: 30 });
    await composePage.waitAndClick('@action-select-contact(human@flowcrypt.com)', { retryErrs: true, confirmGone: true, delay: 0 });
    // todo - verify that the contact/pubkey is showing in green once clicked
    await composePage.click('@input-subject');
    await composePage.type('@input-subject', `Automated puppeteer test: pubkey chosen by clicking found contact`);
    await composePage.type('@input-body', `This is an automated puppeteer test: pubkey chosen by clicking found contact`);
    await ComposePageRecipe.sendAndClose(composePage);
  }));

  ava.test('compose - standalone - freshly loaded pubkey', testWithNewBrowser(async (browser, t) => {
    await BrowserRecipe.setUpFcCompatAcct(browser);
    const composePage = await ComposePageRecipe.openStandalone(browser);
    await ComposePageRecipe.fillMsg(composePage, 'human@flowcrypt.com', 'freshly loaded pubkey');
    await ComposePageRecipe.sendAndClose(composePage);
  }));

  ava.test('compose - standalone - recipient pasted including name', testWithNewBrowser(async (browser, t) => {
    await BrowserRecipe.setUpFcCompatAcct(browser);
    const composePage = await ComposePageRecipe.openStandalone(browser);
    await ComposePageRecipe.fillMsg(composePage, 'Human at Flowcrypt <Human@FlowCrypt.com>', 'recipient pasted including name');
    await ComposePageRecipe.sendAndClose(composePage);
  }));

  ava.test('compose[global] - standalone - nopgp', testWithSemaphoredGlobalBrowser('compatibility', async (browser, t) => {
    const composePage = await ComposePageRecipe.openStandalone(browser);
    await ComposePageRecipe.fillMsg(composePage, 'human+nopgp@flowcrypt.com', 'unknown pubkey');
    await ComposePageRecipe.sendAndClose(composePage, 'test-pass');
  }));

  ava.test('compose[global] - standalone - from alias', testWithSemaphoredGlobalBrowser('compatibility', async (browser, t) => {
    const composePage = await ComposePageRecipe.openStandalone(browser);
    await composePage.selectOption('@input-from', 'flowcryptcompatibility@gmail.com');
    await ComposePageRecipe.fillMsg(composePage, 'human@flowcrypt.com', 'from alias');
    await ComposePageRecipe.sendAndClose(composePage);
  }));

  ava.test('compose[global] - standalone - with attachments', testWithSemaphoredGlobalBrowser('compatibility', async (browser, t) => {
    const composePage = await ComposePageRecipe.openStandalone(browser);
    await ComposePageRecipe.fillMsg(composePage, 'human@flowcrypt.com', 'with files');
    const fileInput = await composePage.target.$('input[type=file]');
    await fileInput!.uploadFile('test/samples/small.txt', 'test/samples/small.png', 'test/samples/small.pdf');
    await ComposePageRecipe.sendAndClose(composePage);
  }));

  ava.test('compose[global] - standalone - with attachments + nopgp', testWithSemaphoredGlobalBrowser('compatibility', async (browser, t) => {
    const composePage = await ComposePageRecipe.openStandalone(browser);
    await ComposePageRecipe.fillMsg(composePage, 'human+nopgp@flowcrypt.com', 'with files + nonppg');
    const fileInput = await composePage.target.$('input[type=file]');
    await fileInput!.uploadFile('test/samples/small.txt', 'test/samples/small.png', 'test/samples/small.pdf');
    await ComposePageRecipe.sendAndClose(composePage, 'test-pass', 90);
  }));

  ava.test('compose[global] - signed message', testWithSemaphoredGlobalBrowser('compatibility', async (browser, t) => {
    const composePage = await ComposePageRecipe.openStandalone(browser);
    await ComposePageRecipe.fillMsg(composePage, 'human@flowcrypt.com', 'signed message');
    await composePage.click('@action-switch-to-sign');
    await ComposePageRecipe.sendAndClose(composePage);
  }));

  ava.test('compose[global] - settings - manually copied pubkey', testWithSemaphoredGlobalBrowser('compatibility', async (browser, t) => {
    let settingsPage = await browser.newPage(Url.extensionSettings('flowcrypt.compatibility@gmail.com'));
    let composeFrame = await ComposePageRecipe.openInSettings(settingsPage);
    await ComposePageRecipe.fillMsg(composeFrame, 'human@flowcrypt.com', 'just to load - will close this page');
    await Util.sleep(1); // todo: should wait until actually loaded
    await settingsPage.close();
    settingsPage = await browser.newPage(Url.extensionSettings('flowcrypt.compatibility@gmail.com'));
    composeFrame = await ComposePageRecipe.openInSettings(settingsPage);
    await ComposePageRecipe.fillMsg(composeFrame, 'human+manualcopypgp@flowcrypt.com', 'manual copied key');
    await composeFrame.waitAndClick('@action-open-add-pubkey-dialog', { delay: 1 });
    await composeFrame.waitAll('@dialog');
    const addPubkeyDialog = await composeFrame.getFrame(['add_pubkey.htm']);
    await addPubkeyDialog.waitAll('@input-select-copy-from');
    await addPubkeyDialog.selectOption('@input-select-copy-from', 'human@flowcrypt.com');
    await addPubkeyDialog.waitAndClick('@action-add-pubkey');
    await composeFrame.waitTillGone('@dialog');
    await composeFrame.waitAndClick('@action-send', { delay: 2 });
    await settingsPage.waitTillGone('@dialog');
  }));

  ava.test.failing('compose[global] - reply - old gmail threadId fmt', testWithSemaphoredGlobalBrowser('compatibility', async (browser, t) => {
    // todo - this is failing because the thread we are replying to is gone. This is an interesting test case of its own
    const appendUrl = 'isReplyBox=___cu_true___&skipClickPrompt=___cu_false___&ignoreDraft=___cu_false___' +
      '&to=human%40flowcrypt.com&from=flowcrypt.compatibility%40gmail.com&subject=Re%3A%20Automated%20puppeteer%20test%3A%20reply' +
      '&threadId=16804894591b3a4b&threadMsgId=16804894591b3a4b';
    const replyFrame = await ComposePageRecipe.openStandalone(browser, { appendUrl, hasReplyPrompt: true });
    await replyFrame.waitAndClick('@action-accept-reply-prompt', { delay: 1 });
    await replyFrame.waitAndType('@input-body', `This is an automated puppeteer test: reply`, { delay: 1 });
    await Util.sleep(3); // todo: should wait until actually loaded
    await ComposePageRecipe.sendAndClose(replyFrame);
  }));

  ava.test.todo('compose[global] - reply - new gmail threadId fmt');

  ava.test.todo('compose[global] - reply - skip click prompt');

};
