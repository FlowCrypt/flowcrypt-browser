/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import * as ava from 'ava';

import { BrowserHandle, ControllablePage } from './../browser';
import { Controllable } from './../browser/controllable';
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
import { SetupPageRecipe } from './page-recipe/setup-page-recipe';

/**
 * All tests that use mail.google.com or have to operate without a Gmail API mock should go here
 */

export type GmailCategory = 'inbox' | 'sent' | 'drafts' | 'spam' | 'trash';

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

    const createSecureDraft = async (t: AvaContext, browser: BrowserHandle, gmailPage: ControllablePage, content: string, params: { offline: boolean } = { offline: false }) => {
      let composeBox: Controllable | undefined;
      if (params.offline) {
        // TODO(@limonte): for some reason iframe is able to save the draft to the cloud even
        // after gmailPage.page.setOfflineMode(true) is called. Probably, the puppeteer issue, revisit.
        // const composeBoxFrame = await gmailPage.getFrame(['/chrome/elements/compose.htm']);
        const urls = await gmailPage.getFramesUrls(['/chrome/elements/compose.htm'], { sleep: 1 });
        composeBox = await browser.newPage(t, urls[0]);
        await composeBox.page.setOfflineMode(true); // go offline mode
      } else {
        composeBox = await gmailPage.getFrame(['/chrome/elements/compose.htm']);
      }
      await Util.sleep(5); // the draft isn't being saved if start typing without this delay
      await composeBox.type('@input-body', content, true);
      if (params.offline) {
        await ComposePageRecipe.waitWhenDraftIsSavedLocally(composeBox);
        await (composeBox as ControllablePage).close();
      } else {
        await ComposePageRecipe.waitWhenDraftIsSaved(composeBox);
      }
    };

    const pageHasSecureDraft = async (gmailPage: ControllablePage, expectedContent?: string) => {
      const secureDraftFrame = await gmailPage.getFrame(['/chrome/elements/compose.htm', '&draftId=']);
      if (expectedContent) {
        await secureDraftFrame.waitForContent('@input-body', expectedContent);
      } else {
        await secureDraftFrame.waitAll('@input-body');
      }
      return secureDraftFrame;
    };

    const pageDoesNotHaveSecureReplyContainer = async (gmailPage: ControllablePage) => {
      const urls = await gmailPage.getFramesUrls(['/chrome/elements/compose.htm'], { sleep: 0 });
      expect(urls.length).to.equal(0);
    };

    const openGmailPage = async (t: AvaContext, browser: BrowserHandle): Promise<ControllablePage> => {
      const url = TestUrls.gmail(0);
      return await browser.newPage(t, url);
    };

    const gotoGmailPage = async (gmailPage: ControllablePage, path: string, category: GmailCategory = 'inbox') => {
      const url = TestUrls.gmail(0, path, category);
      await Util.sleep(0.5);
      await gmailPage.goto(url);
    };

    ava.default('mail.google.com - setup prompt notif + hides when close clicked + reappears + setup link opens settings', testWithBrowser(undefined, async (t, browser) => {
      const settingsPage = await BrowserRecipe.openSettingsLoginButCloseOauthWindowBeforeGrantingPermission(t, browser, 'ci.tests.gmail@flowcrypt.dev');
      await settingsPage.close();
      let gmailPage = await BrowserRecipe.openGmailPage(t, browser, undefined, false);
      await gmailPage.waitAll(['@webmail-notification', '@notification-setup-action-open-settings', '@notification-setup-action-dismiss', '@notification-setup-action-close']);
      await gmailPage.waitAndClick('@notification-setup-action-close', { confirmGone: true });
      await gmailPage.close();
      gmailPage = await BrowserRecipe.openGmailPage(t, browser, undefined, false);
      await gmailPage.waitAll(['@webmail-notification', '@notification-setup-action-open-settings', '@notification-setup-action-dismiss', '@notification-setup-action-close']);
      const newSettingsPage = await browser.newPageTriggeredBy(t, () => gmailPage.waitAndClick('@notification-setup-action-open-settings'));
      await newSettingsPage.waitAll('@action-connect-to-gmail');
    }));

    ava.default('mail.google.com/chat', testWithBrowser(undefined, async (t, browser) => {
      const settingsPage = await BrowserRecipe.openSettingsLoginButCloseOauthWindowBeforeGrantingPermission(t, browser, 'ci.tests.gmail@flowcrypt.dev');
      await settingsPage.close();
      const googleChatPage = await BrowserRecipe.openGoogleChatPage(t, browser);
      await googleChatPage.notPresent('div.z0[class*="_destroyable"]'); // compose button should not be injected
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
      let gmailPage = await BrowserRecipe.openGmailPage(t, browser, undefined, false);
      await gmailPage.waitAll(['@webmail-notification', '@notification-setup-action-open-settings', '@notification-setup-action-dismiss', '@notification-setup-action-close']);
      await gmailPage.waitAndClick('@notification-setup-action-dismiss', { confirmGone: true });
      await gmailPage.close();
      gmailPage = await BrowserRecipe.openGmailPage(t, browser, undefined, false);
      await gmailPage.notPresent(['@webmail-notification', '@notification-setup-action-open-settings', '@notification-setup-action-dismiss', '@notification-setup-action-close']);
    }));

    ava.default('mail.google.com - send rich-text encrypted message', testWithBrowser('ci.tests.gmail', async (t, browser) => {
      const gmailPage = await BrowserRecipe.openGmailPageAndVerifyComposeBtnPresent(t, browser);
      const composePage = await GmailPageRecipe.openSecureCompose(t, gmailPage, browser);
      const subject = `New Rich Text Message ${Util.lousyRandom()}`;
      await ComposePageRecipe.fillMsg(composePage, { to: 'ci.tests.gmail@flowcrypt.dev' }, subject, undefined, { richtext: true });
      await ComposePageRecipe.sendAndClose(composePage);
      await gmailPage.waitAndClick('[aria-label^="Inbox"]');
      await gmailPage.waitAndClick('[role="row"]'); // click the first message
      await gmailPage.waitForContent('.nH.if h2', `Automated puppeteer test: ${subject}`);
      const urls = await gmailPage.getFramesUrls(['/chrome/elements/pgp_block.htm'], { sleep: 1 });
      await GmailPageRecipe.deleteThread(gmailPage);
      expect(urls.length).to.eq(1);
    }));

    ava.default('mail.google.com - decrypt message in offline mode', testWithBrowser('ci.tests.gmail', async (t, browser) => {
      const gmailPage = await BrowserRecipe.openGmailPage(t, browser);
      await gmailPage.type('[aria-label^="Search"]', 'encrypted email for offline decrypt');
      await gmailPage.press('Enter'); // submit search
      await Util.sleep(2); // wait for search results
      await gmailPage.page.setOfflineMode(true); // go offline mode
      await gmailPage.press('Enter'); // open the message
      const pgpBlockFrame = await gmailPage.getFrame(['pgp_block.htm']);
      await gmailPage.page.setOfflineMode(true); // go offline mode
      await pgpBlockFrame.frame.goto(await pgpBlockFrame.frame.url()); // reload the frame
      await pgpBlockFrame.waitForContent('@pgp-block-content', 'this should decrypt even offline');
    }));

    ava.default('mail.google.com - rendering attachmnents', testWithBrowser('ci.tests.gmail', async (t, browser) => {
      const gmailPage = await openGmailPage(t, browser);
      await gotoGmailPage(gmailPage, '/FMfcgzGkbDXBWBWBfVKHssLtMqvDQSWN');
      await gmailPage.waitForContent('.aVW', '36 Attachments');
      const urls = await gmailPage.getFramesUrls(['/chrome/elements/attachment.htm']);
      expect(urls.length).to.equal(36);
    }));

    ava.default('mail.google.com - msg.asc message content renders', testWithBrowser('ci.tests.gmail', async (t, browser) => {
      const gmailPage = await openGmailPage(t, browser);
      await gotoGmailPage(gmailPage, '/QgrcJHrtqfgLGKqwChjKsHKzZQpwRHMBqpG');
      const urls = await gmailPage.getFramesUrls(['/chrome/elements/pgp_block.htm'], { sleep: 10, appearIn: 20 });
      expect(urls.length).to.equal(1);
      const params = urls[0].split('/chrome/elements/pgp_block.htm')[1];
      await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, {
        params,
        content: ['test that content from msg.asc renders'],
        encryption: 'encrypted',
        signature: 'not signed'
      });
      await pageHasSecureReplyContainer(t, browser, gmailPage);
    }));

    ava.default('mail.google.com - Thunderbird signature [html] is recognized', testWithBrowser('ci.tests.gmail', async (t, browser) => {
      const gmailPage = await openGmailPage(t, browser);
      await gotoGmailPage(gmailPage, '/FMfcgzGkbDZKPJrNLplXZhKfWwtgjrXt');
      // validate pgp_block.htm is rendered
      const pgpBlockUrls = await gmailPage.getFramesUrls(['/chrome/elements/pgp_block.htm'], { sleep: 10, appearIn: 20 });
      expect(pgpBlockUrls.length).to.equal(1);
      const url = pgpBlockUrls[0].split('/chrome/elements/pgp_block.htm')[1];
      await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, { params: url, content: ['1234'], encryption: 'not encrypted', signature: 'signed' });
      await pageHasSecureReplyContainer(t, browser, gmailPage);
      await testMinimumElementHeight(gmailPage, '.pgp_block.signedMsg', 80);
      await testMinimumElementHeight(gmailPage, '.pgp_block.publicKey', 120);
      const pubkeyPage = await gmailPage.getFrame(['/chrome/elements/pgp_pubkey.htm']);
      await pubkeyPage.waitForContent('@container-pgp-pubkey', 'Fingerprint: 50B7 A032 B5E1 FBAB 24BA B205 B362 45FD AC2F BF3D');
    }));

    ava.default('mail.google.com - Thunderbird signature [plain] is recognized + correct height', testWithBrowser('ci.tests.gmail', async (t, browser) => {
      const gmailPage = await openGmailPage(t, browser);
      await gotoGmailPage(gmailPage, '/FMfcgzGkbDZKPKzSnGtGKZrPZSbTBNnB');
      // validate pgp_block.htm is rendered
      const pgpBlockUrls = await gmailPage.getFramesUrls(['/chrome/elements/pgp_block.htm'], { sleep: 10, appearIn: 20 });
      expect(pgpBlockUrls.length).to.equal(1);
      await testMinimumElementHeight(gmailPage, '.pgp_block.signedMsg', 80);
      await testMinimumElementHeight(gmailPage, '.pgp_block.publicKey', 120);
      const url = pgpBlockUrls[0].split('/chrome/elements/pgp_block.htm')[1];
      await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, { params: url, content: ['1234'], encryption: 'not encrypted', signature: 'signed' });
      await pageHasSecureReplyContainer(t, browser, gmailPage);
      const pubkeyPage = await gmailPage.getFrame(['/chrome/elements/pgp_pubkey.htm']);
      await pubkeyPage.waitForContent('@container-pgp-pubkey', 'Fingerprint: 50B7 A032 B5E1 FBAB 24BA B205 B362 45FD AC2F BF3D');
    }));

    ava.default('mail.google.com - pubkey gets rendered with new signed and encrypted Thunderbird signature', testWithBrowser('ci.tests.gmail', async (t, browser) => {
      const gmailPage = await openGmailPage(t, browser);
      await gotoGmailPage(gmailPage, '/FMfcgzGkbDZKPLBqWFzbgWqCrplTQdNz');
      const pgpBlockUrls = await gmailPage.getFramesUrls(['/chrome/elements/pgp_block.htm'], { sleep: 10, appearIn: 20 });
      const url = pgpBlockUrls[0].split('/chrome/elements/pgp_block.htm')[1];
      await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, {
        params: url,
        content: ['Encrypted Subject: [ci.test] Thunderbird html signed + encrypted', '1234'],
        encryption: 'encrypted',
        signature: 'not signed'
      });
      await pageHasSecureReplyContainer(t, browser, gmailPage);
      const pubkeyPage = await gmailPage.getFrame(['/chrome/elements/pgp_pubkey.htm']);
      await pubkeyPage.waitForContent('@container-pgp-pubkey', 'Fingerprint: 50B7 A032 B5E1 FBAB 24BA B205 B362 45FD AC2F BF3D');
    }));

    ava.default('mail.google.com - saving and rendering compose drafts when offline', testWithBrowser('ci.tests.gmail', async (t, browser) => {
      const gmailPage = await openGmailPage(t, browser);
      // create compose draft
      await gmailPage.waitAndClick('@action-secure-compose', { delay: 1 });
      await createSecureDraft(t, browser, gmailPage, 'compose draft 1', { offline: true });
      await gmailPage.waitAndClick('@action-secure-compose', { delay: 1 });
      await createSecureDraft(t, browser, gmailPage, 'compose draft 2', { offline: true });
      await gmailPage.page.reload();
      await gmailPage.waitAndClick('[data-tooltip="Drafts"]');
      await gmailPage.waitForContent('#fc_offline_drafts', 'FlowCrypt offline drafts:');
      await gmailPage.ensureElementsCount('#fc_offline_drafts a', 2);
      await gmailPage.waitAndClick('#fc_offline_drafts a');
      // compose draft 2 should be first in list as drafts are sorted by date descending
      const draft = await pageHasSecureDraft(gmailPage, 'compose draft 2');
      await Util.sleep(5); // the draft isn't being saved if start typing without this delay
      await draft.type('@input-body', 'trigger saving a draft to the cloud', true);
      await ComposePageRecipe.waitWhenDraftIsSaved(draft);
      // after draft 2 is saved to the cloud, it should be removed from offline drafts
      await gmailPage.page.reload();
      await gmailPage.waitForContent('#fc_offline_drafts', 'FlowCrypt offline drafts:');
      await gmailPage.ensureElementsCount('#fc_offline_drafts a', 1);
      await gmailPage.waitAndClick('#fc_offline_drafts a');
      await pageHasSecureDraft(gmailPage, 'compose draft 1');
    }));

    ava.default('mail.google.com - secure reply btn, reply draft', testWithBrowser('ci.tests.gmail', async (t, browser) => {
      const gmailPage = await openGmailPage(t, browser);
      await gotoGmailPage(gmailPage, '/FMfcgzGlkjjNRwQmqlKJbTKMsKqGLHZC'); // to go encrypted convo
      // Gmail has 100 emails per thread limit, so if there are 98 deleted messages + 1 initial message,
      // the draft number 100 won't be saved. Therefore, we need to delete forever trashed messages from this thread.
      if (await gmailPage.isElementPresent('//*[text()="delete forever"]')) {
        await gmailPage.click('//*[text()="delete forever"]');
      }
      await gmailPage.waitAndClick('@secure-reply-button');
      let replyBox = await gmailPage.getFrame(['/chrome/elements/compose.htm'], { sleep: 3 });
      expect(await replyBox.read('@recipients-preview')).to.equal('limon.monte@gmail.com');
      await createSecureDraft(t, browser, gmailPage, 'reply draft');
      await createSecureDraft(t, browser, gmailPage, 'offline reply draft', { offline: true });
      await gmailPage.page.reload({ waitUntil: 'networkidle2' });
      replyBox = await pageHasSecureDraft(gmailPage, 'offline reply draft');
      // await replyBox.waitAndClick('@action-send'); doesn't work for some reason, use keyboard instead
      await gmailPage.page.keyboard.press('Tab');
      await gmailPage.page.keyboard.press('Enter');
      await replyBox.waitTillGone('@action-send');
      await gmailPage.page.reload({ waitUntil: 'networkidle2' });
      await gmailPage.waitAndClick('.h7:last-child .ajz', { delay: 1 }); // the small triangle which toggles the message details
      await gmailPage.waitForContent('.h7:last-child .ajA', 'Re: [ci.test] encrypted email for reply render'); // make sure that the subject of the sent draft is corrent
      await GmailPageRecipe.deleteLastReply(gmailPage);
    }));

    ava.default('mail.google.com - multiple compose windows, saving/opening compose draft', testWithBrowser('ci.tests.gmail', async (t, browser) => {
      const gmailPage = await openGmailPage(t, browser);
      // create compose draft
      await gmailPage.waitAndClick('@action-secure-compose', { delay: 1 });
      await createSecureDraft(t, browser, gmailPage, 'a compose draft');
      await gmailPage.page.reload();
      await gotoGmailPage(gmailPage, '', 'drafts'); // to go drafts section
      // open new compose window and saved draft
      await gmailPage.waitAndClick('@action-secure-compose', { delay: 1 });
      await gmailPage.waitAndClick('//*[text()="Draft"]');
      await gmailPage.waitAndClick('[class^="open_draft_"]', { delay: 1 });
      // veryfy that there are two compose windows: new compose window and secure draft
      const urls = await gmailPage.getFramesUrls(['/chrome/elements/compose.htm'], { sleep: 1 });
      expect(urls.length).to.equal(2);
      await pageHasSecureDraft(gmailPage, 'compose draft');
      // try to open 4 compose windows at the same time
      await gmailPage.waitAndClick('@action-secure-compose', { delay: 1 });
      await gmailPage.waitAndClick('@action-secure-compose', { delay: 1 });
      await gmailPage.waitForContent('.ui-toast-title', 'Only 3 FlowCrypt windows can be opened at a time');
    }));

    ava.default('mail.google.com - plain reply to encrypted and signed messages', testWithBrowser('ci.tests.gmail', async (t, browser) => {
      const gmailPage = await openGmailPage(t, browser);
      await gotoGmailPage(gmailPage, '/FMfcgzGkbDRNgcQxLmkhBCKVSFwkfdvV'); // plain convo
      await gmailPage.waitAndClick('[data-tooltip="Reply"]', { delay: 1 });
      await gotoGmailPage(gmailPage, '/FMfcgzGlkjjNRwQmqlKJbTKMsKqGLHZC'); // to go encrypted convo
      await gmailPage.waitAndClick('[data-tooltip="Reply"]', { delay: 1 });
      await gmailPage.waitTillGone('.reply_message');
      await gmailPage.waitAll('[data-tooltip^="Send"]'); // The Send button from the Standard reply box
      await gmailPage.waitForContent('.reply_message_evaluated .error_notification', 'The last message was encrypted, but you are composing a reply without encryption.');
      await gmailPage.waitAndClick('[data-tooltip="Secure Reply"]'); // Switch to encrypted reply
      await gmailPage.waitAll('.reply_message');
      await pageHasSecureReplyContainer(t, browser, gmailPage, { isReplyPromptAccepted: false });
      await gotoGmailPage(gmailPage, '/FMfcgzGkbDRNpjDdNvCrwzqvXspZZxvh'); // go to signed convo
      await gmailPage.waitAndClick('[data-tooltip="Reply"]', { delay: 1 });
      await gmailPage.waitTillGone('.reply_message');
      await gmailPage.waitAll('[data-tooltip^="Send"]'); // The Send button from the Standard reply box
      await gmailPage.notPresent('.reply_message_evaluated .error_notification'); // should not show the warning about switching to encrypted reply
    }));

    ava.default('mail.google.com - plain reply draft', testWithBrowser('ci.tests.gmail', async (t, browser) => {
      const gmailPage = await openGmailPage(t, browser);
      await gotoGmailPage(gmailPage, '/FMfcgzGlkjjNRwQmqlKJbTKMsKqGLHZC'); // go to encrypted convo
      await gmailPage.waitAndClick('[data-tooltip="Reply"]');
      await gmailPage.waitTillFocusIsIn('div[aria-label="Message Body"]');
      await gmailPage.type('div[aria-label="Message Body"]', 'plain reply', true);
      await gmailPage.waitForContent('.oG.aOy', 'Draft saved');
      await gmailPage.page.reload({ waitUntil: 'networkidle2' });
      await pageDoesNotHaveSecureReplyContainer(gmailPage);
      await gmailPage.waitForContent('div[aria-label="Message Body"]', 'plain reply', 30);
      await gmailPage.click('[aria-label^="Discard draft"]');
    }));

    ava.default('mail.google.com - Outlook encrypted message with attachment is recognized', testWithBrowser(undefined, async (t, browser) => {
      const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, 'ci.tests.gmail@flowcrypt.dev');
      await SetupPageRecipe.manualEnter(settingsPage, 'flowcrypt.compatibility.1pp1', { submitPubkey: false, usedPgpBefore: true, },
        { isSavePassphraseChecked: false, isSavePassphraseHidden: false });
      const gmailPage = await openGmailPage(t, browser);
      await gotoGmailPage(gmailPage, '/FMfcgzGllVqqBbjHQQRDsSwcZBlMRzDr');
      await Util.sleep(5);
      await gmailPage.waitAll('iframe');
      expect(await gmailPage.isElementPresent('@container-attachments')).to.equal(false);
      await gmailPage.waitAll(['.aZi'], { visible: false });
      await gmailPage.close();
    }));

    ava.default(`mail.google.com - simple attachments triggering processAttachments() keep "download all" button visible`, testWithBrowser('ci.tests.gmail', async (t, browser) => {
      const gmailPage = await openGmailPage(t, browser);
      await gotoGmailPage(gmailPage, '/KtbxLvHkSWwbVHxgCbWNvXVKGjFgqMbGQq');
      await Util.sleep(5);
      await gmailPage.waitAll('iframe');
      await gmailPage.waitAll(['.aZi'], { visible: true });
      await gmailPage.close();
    }));

    ava.default('mail.google.com - pubkey file gets rendered', testWithBrowser('ci.tests.gmail', async (t, browser) => {
      const gmailPage = await openGmailPage(t, browser);
      await gotoGmailPage(gmailPage, '/FMfcgzGkbDXBWCgTcMJlmBtfNxrbzTTn');
      const urls = await gmailPage.getFramesUrls(['/chrome/elements/pgp_pubkey.htm']);
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
    };

  }
};
