
import { TestWithNewBrowser, TestWithGlobalBrowser } from '../../test';
import { ComposePageRecipe, SetupPageRecipe, GmailPageRecipe } from '../page_recipe';
import { BrowserRecipe } from '../browser_recipe';
import * as ava from 'ava';
import { Config, Util } from '../../util';
import { expect } from 'chai';
import { FlowCryptApi } from '../api';
import { TestVariant } from '../../util';

// tslint:disable:no-blank-lines-func

export const defineConsumerAcctTests = (testVariant: TestVariant, testWithNewBrowser: TestWithNewBrowser, testWithSemaphoredGlobalBrowser: TestWithGlobalBrowser) => {

  if (testVariant === 'CONSUMER-LIVE-GMAIL') {

    // todo - make a helper method that forces account tests to run in sequence with Semaphore
    ava.test('[standalone] compose > large file > subscribe > trial > attach again', testWithNewBrowser(async (t, browser) => {
      // delete account
      await FlowCryptApi.hookCiAcctDelete(Config.secrets.ci_dev_account);
      // set up acct and open compose page
      const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, Config.secrets.ci_dev_account);
      await SetupPageRecipe.recover(settingsPage, 'flowcrypt.test.trial', { hasRecoverMore: false });
      await browser.closeAllPages();
      const gmailPage = await BrowserRecipe.openGmailPageAndVerifyComposeBtnPresent(t, browser);
      await GmailPageRecipe.closeInitialSetupNotif(gmailPage);
      const composePage = await GmailPageRecipe.openSecureCompose(t, gmailPage, browser);
      await ComposePageRecipe.fillMsg(composePage, 'human@flowcrypt.com', 'a large file to trigger trial');
      // add a large file
      let fileInput = await composePage.target.$('input[type=file]');
      await fileInput!.uploadFile('test/samples/large.jpg');
      await composePage.waitAndRespondToModal('confirm', 'confirm', 'The files are over 5 MB');
      // get a trial
      const subscribePage = await GmailPageRecipe.getSubscribeDialog(t, gmailPage, browser);
      await subscribePage.waitAndClick('@action-get-trial', { delay: 1 });
      await gmailPage.waitTillGone('@dialog-subscribe', { timeout: 60 });
      await gmailPage.waitAll('@webmail-notification');
      expect(await gmailPage.read('@webmail-notification')).contains('Successfully upgraded to FlowCrypt Advanced');
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

    ava.test.todo('compose > footer > subscribe > trial');

    ava.test.todo('settings > subscribe > trial');

    ava.test.todo('settings will recognize expired subscription');

    ava.test.todo('settings will recognize / sync subscription');

    ava.test.todo('settings > subscribe > expire > compose > large file > subscribe');

    ava.test.todo('settings > subscribe > expire > compose > footer > subscribe');

  }

};
