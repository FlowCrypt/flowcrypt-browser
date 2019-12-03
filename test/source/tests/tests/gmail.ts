import { TestUrls } from './../../browser/test_urls';
import { TestWithNewBrowser, TestWithGlobalBrowser } from '../../test';
import { BrowserHandle, ControllablePage } from '../../browser';
import * as ava from 'ava';
import { expect } from 'chai';
import { BrowserRecipe } from '../browser_recipe';
import { GmailPageRecipe } from '../page_recipe';
import { TestVariant } from '../../util';
import { AvaContext } from '..';

/**
 * All tests that use mail.google.com or have to operate without a Gmail API mock should go here
 */

// tslint:disable:no-blank-lines-func

export const defineGmailTests = (testVariant: TestVariant, testWithNewBrowser: TestWithNewBrowser, testWithSemaphoredGlobalBrowser: TestWithGlobalBrowser) => {

  if (testVariant === 'CONSUMER-LIVE-GMAIL') {

    const pageHasReplyContainer = async (gmailPage: ControllablePage) => {
      const urls = await gmailPage.getFramesUrls(['/chrome/elements/compose.htm'], { sleep: 0 });
      expect(urls.length).to.equal(1);
    };

    const openGmailPage = async (t: AvaContext, browser: BrowserHandle, path: string): Promise<ControllablePage> => {
      const url = TestUrls.gmail(0, path);
      const gmialPage = await browser.newPage(t, url);
      await gmialPage.waitAll('@action-secure-compose');
      if (path) { // gmail does weird things with navigation sometimes, nudge it again
        await gmialPage.goto(url);
      }
      return gmialPage;
    };

    ava.default('[standalone] gmail setup prompt notification + hides when close clicked + reappears + setup link opens settings', testWithNewBrowser(async (t, browser) => {
      const settingsPage = await BrowserRecipe.openSettingsLoginButCloseOauthWindowBeforeGrantingPermission(t, browser, 'flowcrypt.compatibility@gmail.com');
      await settingsPage.close();
      let gmailPage = await BrowserRecipe.openGmailPage(t, browser);
      await gmailPage.waitAll(['@webmail-notification', '@notification-setup-action-open-settings', '@notification-setup-action-dismiss', '@notification-setup-action-close']);
      await gmailPage.waitAndClick('@notification-setup-action-close', { confirmGone: true });
      await gmailPage.close();
      gmailPage = await BrowserRecipe.openGmailPage(t, browser);
      await gmailPage.waitAll(['@webmail-notification', '@notification-setup-action-open-settings', '@notification-setup-action-dismiss', '@notification-setup-action-close']);
      const newSettingsPage = await browser.newPageTriggeredBy(t, () => gmailPage.waitAndClick('@notification-setup-action-open-settings'));
      await newSettingsPage.waitAll('@action-connect-to-gmail');
    }));

    ava.default('[standalone] gmail shows success notification after setup + goes away after click + does not re-appear', testWithNewBrowser(async (t, browser) => {
      await BrowserRecipe.setUpCommonAcct(t, browser, 'compatibility');
      let gmailPage = await BrowserRecipe.openGmailPage(t, browser);
      await gmailPage.waitAll(['@webmail-notification', '@notification-successfully-setup-action-close']);
      await gmailPage.waitAndClick('@notification-successfully-setup-action-close', { confirmGone: true });
      await gmailPage.close();
      gmailPage = await BrowserRecipe.openGmailPage(t, browser);
      await gmailPage.notPresent(['@webmail-notification', '@notification-setup-action-close', '@notification-successfully-setup-action-close']);
    }));

    ava.default('[standalone] gmail setup prompt notification shows up + dismiss hides it + does not reappear if dismissed', testWithNewBrowser(async (t, browser) => {
      await BrowserRecipe.openSettingsLoginButCloseOauthWindowBeforeGrantingPermission(t, browser, 'flowcrypt.compatibility@gmail.com');
      let gmailPage = await BrowserRecipe.openGmailPage(t, browser);
      await gmailPage.waitAll(['@webmail-notification', '@notification-setup-action-open-settings', '@notification-setup-action-dismiss', '@notification-setup-action-close']);
      await gmailPage.waitAndClick('@notification-setup-action-dismiss', { confirmGone: true });
      await gmailPage.close();
      gmailPage = await BrowserRecipe.openGmailPage(t, browser);
      await gmailPage.notPresent(['@webmail-notification', '@notification-setup-action-open-settings', '@notification-setup-action-dismiss', '@notification-setup-action-close']);
    }));

    ava.default('mail.google.com[global:compatibility] - compose window opens', testWithSemaphoredGlobalBrowser('compatibility', async (t, browser) => {
      const gmailPage = await BrowserRecipe.openGmailPageAndVerifyComposeBtnPresent(t, browser);
      const composePage = await GmailPageRecipe.openSecureCompose(t, gmailPage, browser);
    }));

    ava.default('mail.google.com[global:compatibility] - msg.asc message content renders', testWithSemaphoredGlobalBrowser('compatibility', async (t, browser) => {
      const gmailPage = await openGmailPage(t, browser, '/WhctKJTrdTXcmgcCRgXDpVnfjJNnjjLzSvcMDczxWPMsBTTfPxRDMrKCJClzDHtbXlhnwtV');
      const urls = await gmailPage.getFramesUrls(['/chrome/elements/pgp_block.htm'], { sleep: 10, appearIn: 20 });
      expect(urls.length).to.equal(1);
      await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, urls[0], ['This is a test, as requested by the Flowcrypt team', 'mutt + gnupg']);
      await pageHasReplyContainer(gmailPage);
    }));

    ava.default('mail.google.com[global:compatibility] - pubkey file gets rendered', testWithSemaphoredGlobalBrowser('compatibility', async (t, browser) => {
      const gmailPage = await openGmailPage(t, browser, '/WhctKJTrSJzzjsZVrGcLhhcDLKCJKVrrHNMDLqTMbSjRZZftfDQWbjDWWDsmrpJVHWDblwg');
      const urls = await gmailPage.getFramesUrls(['/chrome/elements/pgp_pubkey.htm'], { sleep: 10, appearIn: 20 });
      expect(urls.length).to.equal(1);
      await pageHasReplyContainer(gmailPage);
    }));

    ava.default('mail.google.com[global:compatibility] - pubkey gets rendered when using quoted-printable mime', testWithSemaphoredGlobalBrowser('compatibility', async (t, browser) => {
      const gmailPage = await openGmailPage(t, browser, '/WhctKJVRFztXGwvSbwcrbDshGTnLWMFvhwJmhqllRWwvpKnlpblQMXVZLTsKfWdPWKhPFBV');
      const urls = await gmailPage.getFramesUrls(['/chrome/elements/pgp_pubkey.htm'], { sleep: 10, appearIn: 20 });
      expect(urls.length).to.equal(1);
      await pageHasReplyContainer(gmailPage);
      const pubkeyPage = await browser.newPage(t, urls[0]);
      const content = await pubkeyPage.read('body');
      expect(content).to.contain('STONE NEED REMAIN SLIDE DEPOSIT BRICK');
    }));

    // const compose_frame = await gmail_page.get_frame(['compose.htm']);
    // Task.compose_fill_message(compose_frame, 'human@flowcrypt.com', 'message from gmail');
    // await compose_frame.wait_and_click('@action-send', {delay: 0.5});
    // await gmail_page.wait_till_gone('@container-new-message');
    // await gmail_page.wait_all('@webmail-notification'); // message sent
    // assert(await gmail_page.read('@webmail-notification'), 'Your encrypted message has been sent.', 'gmail notifiaction message');
    // await gmail_page.click('@webmail-notification');
    // await gmail_page.wait_till_gone('@webmail-notification');
    // log('tests:gmail:secure compose works from gmail + compose frame disappears + notification shows + notification disappears');

    // google inbox - need to hover over the button first
    // await gmail_page.goto('https://inbox.google.com');
    // await gmail_page.wait_and_click('@action-secure-compose', 1);
    // await gmail_page.wait('@container-new-message');
    // log('gmail:tests:secure compose button (inbox.google.com)');

  }
};
