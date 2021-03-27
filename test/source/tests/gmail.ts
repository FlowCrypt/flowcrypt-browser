/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import * as ava from 'ava';

import { BrowserHandle, ControllablePage } from './../browser';
import { TestVariant, Util } from './../util';
import { AvaContext } from './tooling';
import { BrowserRecipe } from './tooling/browser-recipe';
import { ComposePageRecipe } from './page-recipe/compose-page-recipe';
import { GmailPageRecipe } from './page-recipe/gmail-page-recipe';
import { SettingsPageRecipe } from './page-recipe/settings-page-recipe';
import { TestUrls } from './../browser/test-urls';
import { TestWithBrowser } from './../test';
import { expect } from 'chai';
import { OauthPageRecipe } from './page-recipe/oauth-page-recipe';

/**
 * All tests that use mail.google.com or have to operate without a Gmail API mock should go here
 */

// tslint:disable:no-blank-lines-func

export const defineGmailTests = (testVariant: TestVariant, testWithBrowser: TestWithBrowser) => {

  if (testVariant === 'CONSUMER-LIVE-GMAIL') {

    const pageHasSecureReplyContainer = async (t: AvaContext, browser: BrowserHandle, gmailPage: ControllablePage, { isReplyPromptAccepted }: { isReplyPromptAccepted?: boolean } = {}) => {
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

    const pageHasSecureDraft = async (t: AvaContext, browser: BrowserHandle, gmailPage: ControllablePage, expectedContent?: string) => {
      await gmailPage.waitAll('iframe');
      const urls = await gmailPage.getFramesUrls(['/chrome/elements/compose.htm']);
      expect(urls.length).to.equal(1);
      const replyBox = await browser.newPage(t, urls[0]);
      if (expectedContent) {
        await replyBox.waitForContent('@input-body', expectedContent);
      } else {
        await replyBox.waitAll('@input-body');
      }
      return replyBox;
    };

    const pageDoesNotHaveSecureReplyContainer = async (gmailPage: ControllablePage) => {
      const urls = await gmailPage.getFramesUrls(['/chrome/elements/compose.htm'], { sleep: 0 });
      expect(urls.length).to.equal(0);
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
      const settingsPage = await BrowserRecipe.openSettingsLoginButCloseOauthWindowBeforeGrantingPermission(t, browser, 'ci.tests.gmail@flowcrypt.dev');
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

    ava.default('mail.google.com - success notif after setup, click hides it, does not re-appear + offers to reauth', testWithBrowser('ci.tests.gmail', async (t, browser) => {
      const acct = 'ci.tests.gmail@flowcrypt.dev';
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
      gmailPage = await BrowserRecipe.openGmailPage(t, browser);
      await gmailPage.waitAndClick('@action-secure-compose');
      await gmailPage.waitAll(['@webmail-notification', '@action-reconnect-account']);
      await Util.sleep(1);
      expect(await gmailPage.read('@webmail-notification')).to.contain('Please reconnect FlowCrypt to your Gmail Account.');
      const oauthPopup = await browser.newPageTriggeredBy(t, () => gmailPage.waitAndClick('@action-reconnect-account'));
      await OauthPageRecipe.google(t, oauthPopup, acct, 'approve');
      await gmailPage.waitAll(['@webmail-notification']);
      await Util.sleep(1);
      expect(await gmailPage.read('@webmail-notification')).to.contain('Connected successfully. You may need to reload the tab.');
      await gmailPage.close();
      // reload and test that it has no more notifications
      gmailPage = await BrowserRecipe.openGmailPage(t, browser);
      await gmailPage.waitAndClick('@action-secure-compose');
      await Util.sleep(10);
      await gmailPage.notPresent(['@webmail-notification']);
    }));

    ava.default('mail.google.com - setup prompt notification shows up + dismiss hides it + does not reappear if dismissed', testWithBrowser(undefined, async (t, browser) => {
      await BrowserRecipe.openSettingsLoginButCloseOauthWindowBeforeGrantingPermission(t, browser, 'ci.tests.gmail@flowcrypt.dev');
      let gmailPage = await BrowserRecipe.openGmailPage(t, browser);
      await gmailPage.waitAll(['@webmail-notification', '@notification-setup-action-open-settings', '@notification-setup-action-dismiss', '@notification-setup-action-close']);
      await gmailPage.waitAndClick('@notification-setup-action-dismiss', { confirmGone: true });
      await gmailPage.close();
      gmailPage = await BrowserRecipe.openGmailPage(t, browser);
      await gmailPage.notPresent(['@webmail-notification', '@notification-setup-action-open-settings', '@notification-setup-action-dismiss', '@notification-setup-action-close']);
    }));

    ava.default('mail.google.com - send rich-text encrypted message', testWithBrowser('ci.tests.gmail', async (t, browser) => {
      const gmailPage = await BrowserRecipe.openGmailPageAndVerifyComposeBtnPresent(t, browser);
      const composePage = await GmailPageRecipe.openSecureCompose(t, gmailPage, browser);
      const subject = `New Rich Text Message ${Util.lousyRandom()}`;
      await ComposePageRecipe.fillMsg(composePage, { to: 'ci.tests.gmail@flowcrypt.dev' }, subject, { richtext: true });
      await ComposePageRecipe.sendAndClose(composePage);
      await gmailPage.waitAndClick('[aria-label^="Inbox"]');
      await gmailPage.waitAndClick('[role="row"]'); // click the first message
      await gmailPage.waitForContent('.nH.if h2', `Automated puppeteer test: ${subject}`);
      const urls = await gmailPage.getFramesUrls(['/chrome/elements/pgp_block.htm'], { sleep: 1 });
      await GmailPageRecipe.deleteMessage(gmailPage);
      expect(urls.length).to.eq(1);
    }));

    ava.default('mail.google.com - decrypt message in offline mode', testWithBrowser('ci.tests.gmail', async (t, browser) => {
      const gmailPage = await BrowserRecipe.openGmailPage(t, browser);
      await gmailPage.type('[aria-label="Search mail"]', 'encrypted email for offline decrypt');
      await gmailPage.press('Enter'); // submit search
      await Util.sleep(2); // wait for search results
      await gmailPage.page.setOfflineMode(true); // go offline mode
      await gmailPage.press('Enter'); // open the message
      // TODO(@limonte): use the commented line below instead of opening pgp block in a new tab
      // once https://github.com/puppeteer/puppeteer/issues/2548 is resolved
      // const pgpBlockPage = await gmailPage.getFrame(['pgp_block.htm']);
      const urls = await gmailPage.getFramesUrls(['/chrome/elements/pgp_block.htm'], { sleep: 1 });
      const pgpBlockPage = await browser.newPage(t);
      await pgpBlockPage.page.setOfflineMode(true); // go offline mode
      await pgpBlockPage.page.goto(urls[0]);
      await pgpBlockPage.waitForContent('@pgp-block-content', 'this should decrypt even offline');
    }));

    ava.default('mail.google.com - msg.asc message content renders', testWithBrowser('ci.tests.gmail', async (t, browser) => {
      const gmailPage = await openGmailPage(t, browser, '/QgrcJHsTjVVKpcZSxSPxWWhHVCCZWpMQCVQ');
      const urls = await gmailPage.getFramesUrls(['/chrome/elements/pgp_block.htm'], { sleep: 10, appearIn: 20 });
      expect(urls.length).to.equal(1);
      const params = urls[0].split('/chrome/elements/pgp_block.htm')[1];
      await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, { params, content: ['test that content from msg.asc renders'] });
      await pageHasSecureReplyContainer(t, browser, gmailPage);
    }));

    ava.default('mail.google.com - Thunderbird signature [html] is recognized', testWithBrowser('ci.tests.gmail', async (t, browser) => {
      const gmailPage = await openGmailPage(t, browser, '/FMfcgxwKjBRGVhcgRwklplhBCCKgSdfk');
      const urls = await gmailPage.getFramesUrls(['/chrome/elements/pgp_block.htm'], { sleep: 10, appearIn: 20 });
      expect(urls.length).to.equal(1);
      const url = urls[0].split('/chrome/elements/pgp_block.htm')[1];
      const signature = ['Dhartley@Verdoncollege.School.Nz', 'matching signature'];
      await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, { params: url, content: ['1234'], signature });
      await pageHasSecureReplyContainer(t, browser, gmailPage);
    }));

    ava.default('mail.google.com - pubkey gets rendered on new Thunderbird signature [html] + correct height', testWithBrowser('ci.tests.gmail', async (t, browser) => {
      const gmailPage = await openGmailPage(t, browser, '/FMfcgxwKjBRGVhcgRwklplhBCCKgSdfk');
      const urls = await gmailPage.getFramesUrls(['/chrome/elements/pgp_pubkey.htm'], { sleep: 10, appearIn: 20 });
      expect(urls.length).to.equal(1);
      await pageHasSecureReplyContainer(t, browser, gmailPage);
      await testMinimumElementHeight(gmailPage, '.pgp_block.signedMsg', 120);
      await testMinimumElementHeight(gmailPage, '.pgp_block.publicKey', 120);
      const pubkeyPage = await browser.newPage(t, urls[0]);
      await pubkeyPage.waitForContent('@container-pgp-pubkey', 'Fingerprint: DC26 454A FB71 D18E ABBA D73D 1C7E 6D3C 5563 A941');
    }));

    ava.default('mail.google.com - Thunderbird signature [plain] is recognized + correct height', testWithBrowser('ci.tests.gmail', async (t, browser) => {
      const gmailPage = await openGmailPage(t, browser, '/FMfcgxwKjBTWTbDjXSJVjDjKlWJGbWQd');
      const urls = await gmailPage.getFramesUrls(['/chrome/elements/pgp_block.htm'], { sleep: 10, appearIn: 20 });
      expect(urls.length).to.equal(1);
      await testMinimumElementHeight(gmailPage, '.pgp_block.signedMsg', 120);
      await testMinimumElementHeight(gmailPage, '.pgp_block.publicKey', 120);
      const url = urls[0].split('/chrome/elements/pgp_block.htm')[1];
      const signature = ['Dhartley@Verdoncollege.School.Nz', 'matching signature'];
      await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, { params: url, content: ['1234'], signature });
      await pageHasSecureReplyContainer(t, browser, gmailPage);
    }));

    ava.default('mail.google.com - pubkey gets rendered on new Thunderbird signature [plain]', testWithBrowser('ci.tests.gmail', async (t, browser) => {
      const gmailPage = await openGmailPage(t, browser, '/FMfcgxwKjBTWTbDjXSJVjDjKlWJGbWQd');
      const urls = await gmailPage.getFramesUrls(['/chrome/elements/pgp_pubkey.htm'], { sleep: 10, appearIn: 20 });
      expect(urls.length).to.equal(1);
      await pageHasSecureReplyContainer(t, browser, gmailPage);
      const pubkeyPage = await browser.newPage(t, urls[0]);
      await pubkeyPage.waitForContent('@container-pgp-pubkey', 'Fingerprint: DC26 454A FB71 D18E ABBA D73D 1C7E 6D3C 5563 A941');
    }));

    ava.default('mail.google.com - pubkey gets rendered with new signed and encrypted Thunderbird signature', testWithBrowser('ci.tests.gmail', async (t, browser) => {
      const gmailPage = await openGmailPage(t, browser, '/FMfcgxwKjKvbtvZqhhqKGLQFkBmsvVjt');
      const urls = await gmailPage.getFramesUrls(['/chrome/elements/pgp_pubkey.htm'], { sleep: 10, appearIn: 20 });
      expect(urls.length).to.equal(1);
      await pageHasSecureReplyContainer(t, browser, gmailPage);
      const pubkeyPage = await browser.newPage(t, urls[0]);
      await pubkeyPage.waitForContent('@container-pgp-pubkey', 'Fingerprint: DCB2 74D2 4683 145E B053 BC0B 48E4 74A0 926B AE86');
    }));

    // flaky test
    ava.default.skip('mail.google.com - secure reply btn, reply draft', testWithBrowser('ci.tests.gmail', async (t, browser) => {
      const gmailPage = await openGmailPage(t, browser, '/FMfcgxwJXVGtMJwQTZmBDlspVWDvsnnL'); // encrypted convo
      await Util.sleep(5);
      await pageHasSecureReplyContainer(t, browser, gmailPage, { isReplyPromptAccepted: false });
      await gmailPage.waitAndClick('@secure-reply-button');
      await Util.sleep(3);
      await gmailPage.page.keyboard.type('hey there');
      await Util.sleep(5);
      await gmailPage.page.reload();
      await Util.sleep(3);
      const replyBox = await pageHasSecureDraft(t, browser, gmailPage, 'hey there');
      await replyBox.waitAndClick('@action-send');
      await Util.sleep(5);
      await replyBox.close();
      await gmailPage.page.reload();
      await gmailPage.waitAndClick('.h7:last-child .ajz', { delay: 1 }); // the small triangle which toggles the message details
      await gmailPage.waitForContent('.h7:last-child .ajA', 'Re: [ci.test] encrypted email for reply render'); // make sure that the subject of the sent draft is corrent
      await GmailPageRecipe.deleteLastReply(gmailPage);
    }));

    ava.default('mail.google.com - plain reply to encrypted and signed messages', testWithBrowser('ci.tests.gmail', async (t, browser) => {
      const gmailPage = await openGmailPage(t, browser, '/KtbxLvgswQbRmwVxNgDrtvttRPRBtMwKvq'); // plain convo
      await Util.sleep(1);
      await gmailPage.waitAndClick('[data-tooltip="Reply"]');
      await gmailPage.goto(TestUrls.gmail(0, '/FMfcgxwJXVGtMJwQTZmBDlspVWDvsnnL')); // encrypted convo
      await Util.sleep(1);
      await gmailPage.waitAndClick('[data-tooltip="Reply"]');
      await Util.sleep(5);
      await pageDoesNotHaveSecureReplyContainer(gmailPage);
      await gmailPage.waitAll('[data-tooltip^="Send"]'); // The Send button from the Standard reply box
      await gmailPage.waitForContent('.reply_message_evaluated .error_notification', 'The last message was encrypted, but you are composing a reply without encryption.');
      await gmailPage.waitAndClick('[data-tooltip="Secure Reply"]'); // Switch to encrypted reply
      await Util.sleep(5);
      await pageHasSecureReplyContainer(t, browser, gmailPage, { isReplyPromptAccepted: false });
      await gmailPage.goto(TestUrls.gmail(0, '/FMfcgxwJXVGtMMLhrwhNcLBMCbFtpMhQ')); // signed convo
      await Util.sleep(1);
      await gmailPage.waitAndClick('[data-tooltip="Reply"]');
      await pageDoesNotHaveSecureReplyContainer(gmailPage);
      await gmailPage.notPresent('.reply_message_evaluated .error_notification'); // should not show the warning about switching to encrypted reply
    }));

    ava.default('mail.google.com - plain reply draft', testWithBrowser('ci.tests.gmail', async (t, browser) => {
      const gmailPage = await openGmailPage(t, browser, '/FMfcgxwJXVGtMNSCdRMcmZVWkwpxqFdF'); // encrypted convo
      await gmailPage.waitAndClick('[data-tooltip="Reply"]');
      await Util.sleep(5);
      await gmailPage.type('div[aria-label="Message Body"]', 'plain reply', true);
      await gmailPage.goto(TestUrls.gmail(0, '')); // go to Inbox
      await Util.sleep(1);
      await gmailPage.goto(TestUrls.gmail(0, '/FMfcgxwJXVGtMNSCdRMcmZVWkwpxqFdF')); // go back to convo with plain reply
      await pageDoesNotHaveSecureReplyContainer(gmailPage);
      await gmailPage.waitForContent('div[aria-label="Message Body"]', 'plain reply');
      await gmailPage.click('[aria-label^="Discard draft"]');
    }));

    ava.default('mail.google.com - pubkey file gets rendered', testWithBrowser('ci.tests.gmail', async (t, browser) => {
      const gmailPage = await openGmailPage(t, browser, '/FMfcgxwJXVGtMNSfLJNxtJFfwbcjprpq');
      const urls = await gmailPage.getFramesUrls(['/chrome/elements/pgp_pubkey.htm'], { sleep: 10, appearIn: 20 });
      expect(urls.length).to.equal(1);
      await pageHasSecureReplyContainer(t, browser, gmailPage);
    }));

    // ava.default('mail.google.com - reauth after uuid change', testWithBrowser('ci.tests.gmail', async (t, browser) => {
    //   const acct = 'ci.tests.gmail@flowcrypt.dev';
    //   const settingsPage = await browser.newPage(t, TestUrls.extensionSettings(acct));
    //   await SettingsPageRecipe.toggleScreen(settingsPage, 'additional');
    //   const experimentalFrame = await SettingsPageRecipe.awaitNewPageFrame(settingsPage, '@action-open-module-experimental', ['experimental.htm']);
    //   await experimentalFrame.waitAndClick('@action-regenerate-uuid');
    //   await Util.sleep(2);
    //   const oauthPopup = await browser.newPageTriggeredBy(t, () => PageRecipe.waitForModalAndRespond(settingsPage, 'confirm',
    //     { contentToCheck: 'Please log in with FlowCrypt to continue', clickOn: 'confirm' }));
    //   await OauthPageRecipe.google(t, oauthPopup, acct, 'login');
    //   await settingsPage.close();
    //   // load gmail and test that it has no notifications
    //   const gmailPage = await BrowserRecipe.openGmailPage(t, browser);
    //   await gmailPage.waitAndClick('@action-secure-compose');
    //   await Util.sleep(10);
    //   await gmailPage.notPresent(['@webmail-notification']);
    // }));

    // todo - missing equivalent sample at ci.tests.gmail
    // ava.default('mail.google.com - pubkey gets rendered when using quoted-printable mime', testWithBrowser('compatibility', async (t, browser) => {
    //   const gmailPage = await openGmailPage(t, browser, '/WhctKJVRFztXGwvSbwcrbDshGTnLWMFvhwJmhqllRWwvpKnlpblQMXVZLTsKfWdPWKhPFBV');
    //   const urls = await gmailPage.getFramesUrls(['/chrome/elements/pgp_pubkey.htm'], { sleep: 10, appearIn: 20 });
    //   expect(urls.length).to.equal(1);
    //   await pageHasSecureReplyContainer(t, browser, gmailPage);
    //   const pubkeyPage = await browser.newPage(t, urls[0]);
    //   const content = await pubkeyPage.read('body');
    //   expect(content).to.contain('Fingerprint: 7A2E 4FFD 34BC 4AED 0F54 4199 D652 7AD6 65C3 B0DD');
    // }));

    const testMinimumElementHeight = async (page: ControllablePage, selector: string, min: number) => {
      // testing https://github.com/FlowCrypt/flowcrypt-browser/issues/3519
      const elStyle = await page.target.$eval(selector, el => el.getAttribute('style')); // 'height: 289.162px;'
      const elHeight = Number(elStyle!.replace('height: ', '').replace('px;', ''));
      if (isNaN(elHeight)) {
        throw Error(`msgIframeHeight iNaN`);
      }
      expect(elHeight).to.be.above(min, 'Expected iframe height above 80px (in particular not expecting 60 or 30 which are defaults suggesting failure)');
      console.log(`${selector} real height ${elHeight}`);
    };

  }
};
