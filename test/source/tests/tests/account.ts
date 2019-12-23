
import { TestWithNewBrowser, TestWithGlobalBrowser } from '../../test';
import { BrowserRecipe } from '../browser_recipe';
import * as ava from 'ava';
import { Util } from '../../util';
import { FlowCryptApi } from '../api';
import { TestVariant } from '../../util';
import { SetupPageRecipe } from '../page_recipe/setup-page-recipe';
import { GmailPageRecipe } from '../page_recipe/gmail-page-recipe';
import { ComposePageRecipe } from '../page_recipe/compose-page-recipe';
import { PageRecipe } from '../page_recipe/abstract-page-recipe';

// tslint:disable:no-blank-lines-func

export const defineConsumerAcctTests = (testVariant: TestVariant, testWithNewBrowser: TestWithNewBrowser, testWithSemaphoredGlobalBrowser: TestWithGlobalBrowser) => {

  if (testVariant === 'CONSUMER-LIVE-GMAIL') {

    // todo - make a helper method that forces account tests to run in sequence with Semaphore
    ava.default('[standalone] compose > large file > subscribe > trial > attach again', testWithNewBrowser(async (t, browser) => {
      // delete account
      const acct = "test.ci.trial@org.flowcrypt.com";
      await FlowCryptApi.hookCiAcctDelete(acct);
      // set up acct and open compose page
      const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acct);
      await SetupPageRecipe.recover(settingsPage, 'test.ci.trial', { hasRecoverMore: false });
      await browser.closeAllPages();
      const gmailPage = await BrowserRecipe.openGmailPageAndVerifyComposeBtnPresent(t, browser);
      await GmailPageRecipe.closeInitialSetupNotif(gmailPage);
      const composePage = await GmailPageRecipe.openSecureCompose(t, gmailPage, browser);
      await ComposePageRecipe.fillMsg(composePage, { to: 'human@flowcrypt.com' }, 'a large file to trigger trial');
      // add a large file
      let fileInput = await composePage.target.$('input[type=file]');
      await fileInput!.uploadFile('test/samples/large.jpg');
      await composePage.waitAndRespondToModal('confirm', 'confirm', 'The files are over 5 MB');
      // get a trial - already logged in
      const subscribePage = await GmailPageRecipe.getSubscribeDialog(t, gmailPage, browser);
      await subscribePage.waitAndClick('@action-get-trial', { delay: 1 });
      await PageRecipe.waitForModalAndRespond(subscribePage, 'info', { contentToCheck: 'Successfully upgraded to FlowCrypt Advanced', clickOn: 'confirm' });
      await gmailPage.waitTillGone('@dialog-subscribe', { timeout: 60 });
      await subscribePage.waitForSelTestState('closed');
      await subscribePage.close();
      // verify can add large file now
      await composePage.click('@input-body'); // focus on this tab before interacting with file upload
      fileInput = await composePage.target.$('input[type=file]');
      await fileInput!.uploadFile('test/samples/large.jpg');
      await Util.sleep(2); // give it a little time to make tests less brittle
      await ComposePageRecipe.sendAndClose(composePage);
      await gmailPage.waitTillGone('@container-new-message');
    }));

    ava.todo('compose > footer > subscribe > trial');

    ava.todo('settings > subscribe > trial');

    ava.todo('settings will recognize expired subscription');

    ava.todo('settings will recognize / sync subscription');

    ava.todo('settings > subscribe > expire > compose > large file > subscribe');

    ava.todo('settings > subscribe > expire > compose > footer > subscribe');

  } else {
    ava.default('compose > large file > public domain account (should not prompt to upgrade)', testWithSemaphoredGlobalBrowser('compatibility', async (t, browser) => {
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility');
      await ComposePageRecipe.fillMsg(composePage, { to: 'human@flowcrypt.com' }, 'a large file test (gmail account)');
      const fileInput = await composePage.target.$('input[type=file]');
      await fileInput!.uploadFile('test/samples/large.jpg');
      await Util.sleep(2);
      await ComposePageRecipe.sendAndClose(composePage);
    }));

  }
};
