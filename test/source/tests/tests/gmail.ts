import * as ava from 'ava';

import { BrowserHandle, ControllablePage } from '../../browser';
import { TestVariant, Util } from '../../util';
import { TestWithGlobalBrowser, TestWithNewBrowser } from '../../test';

import { AvaContext } from '..';
import { BrowserRecipe } from '../browser_recipe';
import { GmailPageRecipe } from '../page_recipe/gmail-page-recipe';
import { OauthPageRecipe } from '../page_recipe/oauth-page-recipe';
import { SettingsPageRecipe } from '../page_recipe/settings-page-recipe';
import { TestUrls } from './../../browser/test_urls';
import { expect } from 'chai';

/**
 * All tests that use mail.google.com or have to operate without a Gmail API mock should go here
 */

// tslint:disable:no-blank-lines-func

export const defineGmailTests = (testVariant: TestVariant, testWithNewBrowser: TestWithNewBrowser, testWithSemaphoredGlobalBrowser: TestWithGlobalBrowser) => {

  if (testVariant === 'CONSUMER-LIVE-GMAIL') {

    const pageHasReplyContainer = async (t: AvaContext, browser: BrowserHandle, gmailPage: ControllablePage, { isReplyPromptAccepted }: { isReplyPromptAccepted?: boolean } = {}) => {
      const urls = await gmailPage.getFramesUrls(['/chrome/elements/compose.htm'], { sleep: 0 });
      expect(urls.length).to.equal(1);
      if (typeof isReplyPromptAccepted !== 'undefined') {
        const replyBox = await browser.newPage(t, urls[0]);
        if (isReplyPromptAccepted) {
          await replyBox.waitAll('@action-send');
          await replyBox.notPresent('@action-accept-reply-prompt');
        } else {
          await replyBox.waitAll('@action-accept-reply-prompt');
          await replyBox.notPresent('@action-send');
        }
        await replyBox.close();
      }
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

    ava.default('mail.google.com[standalone] setup prompt notification + hides when close clicked + reappears + setup link opens settings', testWithNewBrowser(async (t, browser) => {
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

    ava.default('mail.google.com[standalone] success notification after setup, click hides it, does not re-appear + can re-connect', testWithNewBrowser(async (t, browser) => {
      const acct = 'flowcrypt.compatibility@gmail.com';
      await BrowserRecipe.setUpCommonAcct(t, browser, 'compatibility');
      let gmailPage = await BrowserRecipe.openGmailPage(t, browser);
      await gmailPage.waitAll(['@webmail-notification', '@notification-successfully-setup-action-close']);
      await gmailPage.waitAndClick('@notification-successfully-setup-action-close', { confirmGone: true });
      await gmailPage.close();
      gmailPage = await BrowserRecipe.openGmailPage(t, browser);
      await gmailPage.notPresent(['@webmail-notification', '@notification-setup-action-close', '@notification-successfully-setup-action-close']);
      await gmailPage.close();
      // below test that can re-auth after lost access (simulating situation when user changed password on google)
      for (const wipeTokenBtnSelector of ['@action-wipe-google-refresh-token', '@action-wipe-google-access-token']) {
        const settingsPage = await browser.newPage(t, TestUrls.extensionSettings(acct));
        await SettingsPageRecipe.toggleScreen(settingsPage, 'additional');
        const experimentalFrame = await SettingsPageRecipe.awaitNewPageFrame(settingsPage, '@action-open-module-experimental', ['experimental.htm']);
        await experimentalFrame.waitAndClick(wipeTokenBtnSelector);
      }
      // any message with pgp attachment will do because it will need to make a request to google
      const gmailMsgWithAtt = `https://mail.google.com/mail/u/${acct}/#inbox/WhctKHTCGjFCdWqLhrdswHHkHLlvfzTxXGNlZLsCqkMPhZWNfHDBtpDlDmPBgMfjbMwwsSb`;
      gmailPage = await browser.newPage(t, gmailMsgWithAtt);
      await gmailPage.waitAll(['@webmail-notification', '@action-reconnect-account']);
      await Util.sleep(1);
      expect(await gmailPage.read('@webmail-notification')).to.contain('Please reconnect FlowCrypt to your Gmail Account.');
      const oauthPopup = await browser.newPageTriggeredBy(t, () => gmailPage.waitAndClick('@action-reconnect-account'), acct);
      await OauthPageRecipe.google(t, oauthPopup, acct, 'approve');
      await gmailPage.waitAll(['@webmail-notification']);
      await Util.sleep(1);
      expect(await gmailPage.read('@webmail-notification')).to.contain('Connected successfully. You may need to reload the tab.');
      await gmailPage.close();
      // reload and test that message frame shows, and no more notifications
      gmailPage = await browser.newPage(t, gmailMsgWithAtt);
      const urls = await gmailPage.getFramesUrls(['/chrome/elements/pgp_block.htm'], { sleep: 10, appearIn: 20 });
      expect(urls.length).to.equal(1);
      await gmailPage.notPresent(['@webmail-notification']);
    }));

    ava.default('mail.google.com[standalone] setup prompt notification shows up + dismiss hides it + does not reappear if dismissed', testWithNewBrowser(async (t, browser) => {
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
      await pageHasReplyContainer(t, browser, gmailPage);
    }));

    ava.default('mail.google.com[global:compatibility] - secure reply btn accepts reply prompt', testWithSemaphoredGlobalBrowser('compatibility', async (t, browser) => {
      const gmailPage = await openGmailPage(t, browser, '/WhctKJTrdTXcmgcCRgXDpVnfjJNnjjLzSvcMDczxWPMsBTTfPxRDMrKCJClzDHtbXlhnwtV'); // encrypted convo
      await Util.sleep(5);
      await pageHasReplyContainer(t, browser, gmailPage, { isReplyPromptAccepted: false });
      await gmailPage.waitAndClick('@secure-reply-button');
      await Util.sleep(10);
      await pageHasReplyContainer(t, browser, gmailPage, { isReplyPromptAccepted: true });
    }));

    ava.default('mail.google.com[global:compatibility] - pubkey file gets rendered', testWithSemaphoredGlobalBrowser('compatibility', async (t, browser) => {
      const gmailPage = await openGmailPage(t, browser, '/WhctKJTrSJzzjsZVrGcLhhcDLKCJKVrrHNMDLqTMbSjRZZftfDQWbjDWWDsmrpJVHWDblwg');
      const urls = await gmailPage.getFramesUrls(['/chrome/elements/pgp_pubkey.htm'], { sleep: 10, appearIn: 20 });
      expect(urls.length).to.equal(1);
      await pageHasReplyContainer(t, browser, gmailPage);
    }));

    ava.default('mail.google.com[global:compatibility] - pubkey gets rendered when using quoted-printable mime', testWithSemaphoredGlobalBrowser('compatibility', async (t, browser) => {
      const gmailPage = await openGmailPage(t, browser, '/WhctKJVRFztXGwvSbwcrbDshGTnLWMFvhwJmhqllRWwvpKnlpblQMXVZLTsKfWdPWKhPFBV');
      const urls = await gmailPage.getFramesUrls(['/chrome/elements/pgp_pubkey.htm'], { sleep: 10, appearIn: 20 });
      expect(urls.length).to.equal(1);
      await pageHasReplyContainer(t, browser, gmailPage);
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
