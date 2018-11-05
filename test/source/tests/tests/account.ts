
import { TestWithBrowser, TestWithGlobalBrowser } from '..';
import { PageRecipe, ComposePageRecipe, SetupPageRecipe, GmailPageRecipe } from '../page_recipe';
import { BrowserRecipe } from '../browser_recipe';
import { Url, Semaphore } from '../../browser';
import { FlowCryptApi } from '../api';
import * as ava from 'ava';
import { Util, Config } from '../../util';
import { expect } from 'chai';

export let defineAcctTests = (testWithNewBrowser: TestWithBrowser, testWithSemaphoredGlobalBrowser: TestWithGlobalBrowser) => {

  ava.test('compose > large file > subscribe > trial > attach again', testWithSemaphoredGlobalBrowser('trial', async (browser, t) => {
    // set up acct and open compose page
    let settingsPage = await BrowserRecipe.openSettingsLoginApprove(browser, Config.secrets.ci_dev_account);
    await SetupPageRecipe.recover(settingsPage, 'flowcrypt.test.trial', { hasRecoverMore: false });
    await browser.closeAllPages();
    let gmailPage = await BrowserRecipe.openGmailPageAndVerifyComposeBtnPresent(browser);
    await GmailPageRecipe.closeInitialSetupNotif(gmailPage);
    let composePage = await GmailPageRecipe.openSecureCompose(gmailPage, browser);
    await ComposePageRecipe.fillMsg(composePage, 'human@flowcrypt.com', 'a large file to trigger trial');
    // add a large file
    let fileInput = await composePage.target.$('input[type=file]');
    let subscriptionNeededAlert = await composePage.triggerAndWaitNewAlert(async () => await fileInput!.uploadFile('test/samples/large.jpg'));
    expect(await subscriptionNeededAlert.message()).contains('The files are over 5 MB');
    await subscriptionNeededAlert.accept();
    // get a trial
    let subscribePage = await GmailPageRecipe.getSubscribeDialog(gmailPage, browser);
    let subscribedAlert = await composePage.triggerAndWaitNewAlert(async () => await subscribePage.waitAndClick('@action-get-trial', { delay: 1 }));
    expect(await subscribedAlert.message()).contains('now you can add your file again');
    await subscribedAlert.accept();
    await subscribePage.close();
    // verify can add large file now
    await gmailPage.waitTillGone('@dialog-subscribe');
    await gmailPage.waitAll('@webmail-notification');
    expect(await gmailPage.read('@webmail-notification')).contains('Successfully upgraded to FlowCrypt Advanced');
    await composePage.click('@input-body'); // focus on this tab before interacting with file upload
    fileInput = await composePage.target.$('input[type=file]');
    await fileInput!.uploadFile('test/samples/large.jpg');
    await ComposePageRecipe.sendAndClose(composePage);
    await gmailPage.waitTillGone('@container-new-message');
  }));

  ava.test.todo('compose > footer > subscribe > trial');

  ava.test.todo('settings > subscribe > trial');

  ava.test.todo('settings will recognize expired subscription');

  ava.test.todo('settings will recognize / sync subscription');

  ava.test.todo('settings > subscribe > expire > compose > large file > subscribe');

  ava.test.todo('settings > subscribe > expire > compose > footer > subscribe');

};
