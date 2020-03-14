/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import * as ava from 'ava';

import { BrowserHandle, ControllablePage } from '../../browser';
import { TestVariant, Util } from '../../util';
import { AvaContext } from '..';
import { BrowserRecipe } from '../browser-recipe';
import { GmailPageRecipe } from '../page-recipe/gmail-page-recipe';
import { SettingsPageRecipe } from '../page-recipe/settings-page-recipe';
import { TestUrls } from '../../browser/test-urls';
import { TestWithBrowser } from '../../test';
import { expect } from 'chai';

/**
 * All tests that use mail.google.com or have to operate without a Gmail API mock should go here
 */

// tslint:disable:no-blank-lines-func

export const defineGmailTests = (testVariant: TestVariant, testWithBrowser: TestWithBrowser) => {

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

    const pageDoesNotHaveReplyContainer = async (gmailPage: ControllablePage) => {
      const urls = await gmailPage.getFramesUrls(['/chrome/elements/compose.htm'], { sleep: 0 });
      expect(urls).to.be.empty;
    };

    const openGmailPage = async (t: AvaContext, browser: BrowserHandle, path: string): Promise<ControllablePage> => {
      const url = TestUrls.gmail(0, path);
      const gmailPage = await browser.newPage(t, url);
      await gmailPage.waitAll('@action-secure-compose');
      if (path) { // gmail does weird things with navigation sometimes, nudge it again
        await gmailPage.goto(url);
      }
      return gmailPage;
    };

    ava.default('mail.google.com - setup prompt notif + hides when close clicked + reappears + setup link opens settings', testWithBrowser(undefined, async (t, browser) => {
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

    ava.default('mail.google.com - success notif after setup, click hides it, does not re-appear + offers to reauth', testWithBrowser('compatibility', async (t, browser) => {
      const acct = 'flowcrypt.compatibility@gmail.com';
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
        await Util.sleep(2);
        await settingsPage.close();
      }
      const settingsPage = await browser.newPage(t, TestUrls.extensionSettings(acct));
      await settingsPage.waitAndRespondToModal('confirm', 'cancel', 'FlowCrypt must be re-connected to your Google account.');
      // *** these tests below are very flaky in CI environment, Google will want to re-authenticate the user for whatever reason
      // // opening secure compose should trigger an api call which causes a reconnect notification
      // gmailPage = await BrowserRecipe.openGmailPage(t, browser);
      // await gmailPage.waitAndClick('@action-secure-compose');
      // await gmailPage.waitAll(['@webmail-notification', '@action-reconnect-account']);
      // await Util.sleep(1);
      // expect(await gmailPage.read('@webmail-notification')).to.contain('Please reconnect FlowCrypt to your Gmail Account.');
      // const oauthPopup = await browser.newPageTriggeredBy(t, () => gmailPage.waitAndClick('@action-reconnect-account'), acct);
      // await OauthPageRecipe.google(t, oauthPopup, acct, 'approve');
      // await gmailPage.waitAll(['@webmail-notification']);
      // await Util.sleep(1);
      // expect(await gmailPage.read('@webmail-notification')).to.contain('Connected successfully. You may need to reload the tab.');
      // await gmailPage.close();
      // // reload and test that it has no more notifications
      // gmailPage = await BrowserRecipe.openGmailPage(t, browser);
      // await gmailPage.waitAndClick('@action-secure-compose');
      // await Util.sleep(10);
      // await gmailPage.notPresent(['@webmail-notification']);
    }));

    ava.default('mail.google.com - setup prompt notification shows up + dismiss hides it + does not reappear if dismissed', testWithBrowser(undefined, async (t, browser) => {
      await BrowserRecipe.openSettingsLoginButCloseOauthWindowBeforeGrantingPermission(t, browser, 'flowcrypt.compatibility@gmail.com');
      let gmailPage = await BrowserRecipe.openGmailPage(t, browser);
      await gmailPage.waitAll(['@webmail-notification', '@notification-setup-action-open-settings', '@notification-setup-action-dismiss', '@notification-setup-action-close']);
      await gmailPage.waitAndClick('@notification-setup-action-dismiss', { confirmGone: true });
      await gmailPage.close();
      gmailPage = await BrowserRecipe.openGmailPage(t, browser);
      await gmailPage.notPresent(['@webmail-notification', '@notification-setup-action-open-settings', '@notification-setup-action-dismiss', '@notification-setup-action-close']);
    }));

    ava.default('mail.google.com - compose window opens', testWithBrowser('compatibility', async (t, browser) => {
      const gmailPage = await BrowserRecipe.openGmailPageAndVerifyComposeBtnPresent(t, browser);
      const composePage = await GmailPageRecipe.openSecureCompose(t, gmailPage, browser);
    }));

    ava.default('mail.google.com - decrypt message in offline mode', testWithBrowser('compatibility', async (t, browser) => {
      const gmailPage = await BrowserRecipe.openGmailPage(t, browser);
      await gmailPage.type('[aria-label="Search mail"]', 'encrypted + signed with gpg');
      await gmailPage.press('Enter'); // submit search
      await gmailPage.page.waitFor(1000); // wait for search results
      await gmailPage.page.setOfflineMode(true); // go offline mode
      await gmailPage.press('Enter'); // open the message
      // TODO(@limonte): use the commented line below instead of opening pgp block in a new tab
      // once https://github.com/puppeteer/puppeteer/issues/2548 is resolved
      // const pgpBlockPage = await gmailPage.getFrame(['pgp_block.htm']);
      const urls = await gmailPage.getFramesUrls(['/chrome/elements/pgp_block.htm'], { sleep: 1 });
      const pgpBlockPage = await browser.newPage(t);
      await pgpBlockPage.page.setOfflineMode(true); // go offline mode
      await pgpBlockPage.page.goto(urls[0]);
      await pgpBlockPage.waitForContent('@pgp-block-content', 'this was encrypted with gpg');
    }));

    ava.default('mail.google.com - msg.asc message content renders', testWithBrowser('compatibility', async (t, browser) => {
      const gmailPage = await openGmailPage(t, browser, '/WhctKJTrdTXcmgcCRgXDpVnfjJNnjjLzSvcMDczxWPMsBTTfPxRDMrKCJClzDHtbXlhnwtV');
      const urls = await gmailPage.getFramesUrls(['/chrome/elements/pgp_block.htm'], { sleep: 10, appearIn: 20 });
      expect(urls.length).to.equal(1);
      const params = urls[0].split('/chrome/elements/pgp_block.htm')[1];
      await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, {
        params,
        content: ['This is a test, as requested by the Flowcrypt team', 'mutt + gnupg']
      });
      await pageHasReplyContainer(t, browser, gmailPage);
    }));

    ava.default('mail.google.com - secure reply btn accepts reply prompt', testWithBrowser('compatibility', async (t, browser) => {
      const gmailPage = await openGmailPage(t, browser, '/WhctKJTrdTXcmgcCRgXDpVnfjJNnjjLzSvcMDczxWPMsBTTfPxRDMrKCJClzDHtbXlhnwtV'); // encrypted convo
      await Util.sleep(5);
      await pageHasReplyContainer(t, browser, gmailPage, { isReplyPromptAccepted: false });
      await gmailPage.waitAndClick('@secure-reply-button');
      await Util.sleep(10);
      await pageHasReplyContainer(t, browser, gmailPage, { isReplyPromptAccepted: true });
    }));

    ava.default.only('mail.google.com - plain reply to encrypted message', testWithBrowser('compatibility', async (t, browser) => {
      const gmailPage = await openGmailPage(t, browser, '/WhctKJTrdTXcmgcCRgXDpVnfjJNnjjLzSvcMDczxWPMsBTTfPxRDMrKCJClzDHtbXlhnwtV'); // encrypted convo
      await gmailPage.waitAndClick('[data-tooltip="Reply"]');
      await Util.sleep(5);
      await pageDoesNotHaveReplyContainer(gmailPage);
      await gmailPage.waitAll('[data-tooltip^="Send"]'); // The Send button from the Standard reply box
    }));

    ava.default('mail.google.com - pubkey file gets rendered', testWithBrowser('compatibility', async (t, browser) => {
      const gmailPage = await openGmailPage(t, browser, '/WhctKJTrSJzzjsZVrGcLhhcDLKCJKVrrHNMDLqTMbSjRZZftfDQWbjDWWDsmrpJVHWDblwg');
      const urls = await gmailPage.getFramesUrls(['/chrome/elements/pgp_pubkey.htm'], { sleep: 10, appearIn: 20 });
      expect(urls.length).to.equal(1);
      await pageHasReplyContainer(t, browser, gmailPage);
    }));

    ava.default('mail.google.com - pubkey gets rendered when using quoted-printable mime', testWithBrowser('compatibility', async (t, browser) => {
      const gmailPage = await openGmailPage(t, browser, '/WhctKJVRFztXGwvSbwcrbDshGTnLWMFvhwJmhqllRWwvpKnlpblQMXVZLTsKfWdPWKhPFBV');
      const urls = await gmailPage.getFramesUrls(['/chrome/elements/pgp_pubkey.htm'], { sleep: 10, appearIn: 20 });
      expect(urls.length).to.equal(1);
      await pageHasReplyContainer(t, browser, gmailPage);
      const pubkeyPage = await browser.newPage(t, urls[0]);
      const content = await pubkeyPage.read('body');
      expect(content).to.contain('Fingerprint: 7A2E 4FFD 34BC 4AED 0F54 4199 D652 7AD6 65C3 B0DD');
    }));

  }
};
