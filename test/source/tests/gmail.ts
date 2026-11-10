/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import test from 'ava';

import { connect } from 'puppeteer';
import { expect } from 'chai';
import { BrowserHandle } from './../browser/browser-handle';
import { Controllable, ControllableFrame, ControllablePage } from './../browser/controllable';
import { TIMEOUT_ELEMENT_APPEAR, TIMEOUT_PAGE_LOAD } from './../browser';
import { TestUrls } from './../browser/test-urls';
import { TestWithBrowser } from './../test';
import { TestVariant, Util } from './../util';
import { ComposePageRecipe } from './page-recipe/compose-page-recipe';
import { GmailPageRecipe } from './page-recipe/gmail-page-recipe';
import { SetupPageRecipe } from './page-recipe/setup-page-recipe';
import { AvaContext, minutes } from './tooling';
import { BrowserRecipe } from './tooling/browser-recipe';

/**
 * All tests that use mail.google.com or have to operate without a Gmail API mock should go here
 */

export type GmailCategory = 'inbox' | 'sent' | 'drafts' | 'spam' | 'trash'; // 'all';

export const defineGmailTests = (testVariant: TestVariant, testWithBrowser: TestWithBrowser) => {
  if (testVariant === 'CONSUMER-LIVE-GMAIL') {
    const pageHasSecureReplyContainer = async (
      t: AvaContext,
      browser: BrowserHandle,
      gmailPage: ControllablePage,
      {
        // Check if compose frame(secure reply frame) has reply prompt
        isReplyPromptAccepted,
        // Compose Frame(Secure reply container) index. Default is 0 because "secure reply compose container" is located higher than the other "reply or forward buttons" container
        composeFrameIndex,
        // Total compose frame count
        composeFrameCount,
        replyFrame,
      }: {
        isReplyPromptAccepted?: boolean;
        composeFrameIndex?: number;
        composeFrameCount?: number;
        replyFrame?: ControllableFrame;
      } = {}
    ) => {
      const urls = await gmailPage.getFramesUrls(['/chrome/elements/compose.htm'], { sleep: 0 });
      expect(urls.length).to.equal(composeFrameCount ?? 1);
      if (typeof isReplyPromptAccepted !== 'undefined') {
        const replyBox = replyFrame ?? (await gmailPage.getFrame([urls[composeFrameIndex ?? 0]]));
        if (isReplyPromptAccepted) {
          await replyBox.waitAll('@action-send');
          await replyBox.notPresent('@action-accept-reply-prompt');
        } else {
          await replyBox.waitAll('@action-accept-reply-prompt');
          await replyBox.notPresent('@action-send');
        }
      }
    };

    const createSecureDraft = async (
      t: AvaContext,
      browser: BrowserHandle,
      gmailPage: ControllablePage,
      content: string,
      params: { offline: boolean } = { offline: false }
    ) => {
      await GmailPageRecipe.dismissMobileNotificationsPrompt(gmailPage);
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
      await composeBox.click('@input-body');
      await Util.sleep(1);
      await composeBox.type('@input-body', content, true);
      if (params.offline) {
        await ComposePageRecipe.waitWhenDraftIsSavedLocally(composeBox);
        await (composeBox as ControllablePage).close();
      } else {
        await ComposePageRecipe.waitWhenDraftIsSaved(composeBox);
      }
    };

    const pageHasSecureDraft = async (gmailPage: ControllablePage, expectedContent?: string) => {
      const secureDraftFrame = await gmailPage.getFrame(['/chrome/elements/compose.htm', '&draftId='], { sleep: 2 });
      await Util.sleep(3);
      try {
        // Wait for the iframe content to load - @input-body must exist first
        await secureDraftFrame.waitAll('@input-body');
        if (expectedContent) {
          await secureDraftFrame.waitForContent('@input-body', expectedContent);
        }
      } catch (e) {
        gmailPage.t.log(`Selected draft frame at failure: ${secureDraftFrame.frame.url()} (detached: ${secureDraftFrame.frame.detached})`);
        throw e;
      }
      return secureDraftFrame;
    };

    const pageDoesNotHaveSecureReplyContainer = async (gmailPage: ControllablePage) => {
      const urls = await gmailPage.getFramesUrls(['/chrome/elements/compose.htm'], { sleep: 0 });
      expect(urls.length).to.equal(0);
    };

    const openGmailPage = async (t: AvaContext, browser: BrowserHandle, path?: string): Promise<ControllablePage> => {
      let url = TestUrls.gmail(0);
      if (path) {
        url = TestUrls.gmail(0, path, 'inbox');
      }
      const gmailPage = await browser.newPage(t, url);
      await GmailPageRecipe.dismissMobileNotificationsPrompt(gmailPage);
      return gmailPage;
    };

    const gotoGmailPage = async (gmailPage: ControllablePage, path: string, category: GmailCategory = 'inbox') => {
      const url = TestUrls.gmail(0, path, category);
      await Util.sleep(1);
      await gmailPage.goto(url);
      await GmailPageRecipe.dismissMobileNotificationsPrompt(gmailPage);
    };

    const replyAllConversation = {
      path: '/FMfcgzGtwgfMhWTlgRwwKWzRhqNZzwXz',
      subject: 'Encrypted message with 2 recipients for reply-all test',
    };
    const gotoGmailConversation = async (gmailPage: ControllablePage, { path, subject }: { path: string; subject: string }) => {
      await gmailPage.page.goto(TestUrls.gmail(0, path), { waitUntil: 'domcontentloaded', timeout: TIMEOUT_PAGE_LOAD * 1000 });
      await gmailPage.waitForContent('h2.hP', subject, TIMEOUT_PAGE_LOAD);
      await gmailPage.waitAll('@action-secure-compose', { timeout: TIMEOUT_PAGE_LOAD });
      await GmailPageRecipe.dismissMobileNotificationsPrompt(gmailPage);
    };

    const withReattachedGmailPage = async (browser: BrowserHandle, gmailPage: ControllablePage, action: (page: ControllablePage) => Promise<void>) => {
      // Attach after the extension iframe is present so Puppeteer can see its execution context.
      const attachedBrowser = await connect({
        browserWSEndpoint: browser.browser.wsEndpoint(),
        defaultViewport: gmailPage.page.viewport(),
        protocolTimeout: TIMEOUT_PAGE_LOAD * 1000,
      });
      try {
        const attachedPage = (await attachedBrowser.pages()).find(page => page.url() === gmailPage.page.url());
        if (!attachedPage) {
          throw new Error('Could not reattach to the Gmail tab');
        }
        await action(new ControllablePage(gmailPage.t, attachedPage));
      } finally {
        await attachedBrowser.disconnect();
      }
    };

    const replyIframe = 'iframe.reply_message[src*="/chrome/elements/compose.htm"]';
    const getEditableGmailReply = async (gmailPage: ControllablePage) => {
      const skipPrompt = '&skipClickPrompt=___cu_true___';
      await gmailPage.waitAll(`${replyIframe}[src*="${skipPrompt}"]`);
      return await gmailPage.getFrame(['/chrome/elements/compose.htm', skipPrompt], { sleep: 0 });
    };

    const messageMenu = '[aria-label="More message options"]';
    const clickGmailControl = async (gmailPage: ControllablePage, selector: string) => {
      await GmailPageRecipe.dismissMobileNotificationsPrompt(gmailPage);
      await gmailPage.target
        .locator(selector)
        .setVisibility('visible')
        .setTimeout(TIMEOUT_ELEMENT_APPEAR * 1000)
        .click();
    };

    test(
      'mail.google.com/chat',
      testWithBrowser(async (t, browser) => {
        const settingsPage = await BrowserRecipe.openSettingsLoginButCloseOauthWindowBeforeGrantingPermission(t, browser, 'ci.tests.gmail@flowcrypt.dev');
        await settingsPage.close();
        const googleChatPage = await BrowserRecipe.openGoogleChatPage(t, browser);
        await googleChatPage.notPresent(BrowserRecipe.oldAndNewComposeButtonSelectors); // compose button should not be injected
      })
    );

    // Rich text message sending fails. Seems to be a backend Gmail API issue, possibly related to message formatting
    // https://github.com/FlowCrypt/flowcrypt-browser/issues/5971
    test.skip(
      'mail.google.com - send rich-text encrypted message',
      testWithBrowser(
        async (t, browser) => {
          const acctEmail = 'ci.tests.gmail@flowcrypt.dev';
          await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
          const gmailPage = await BrowserRecipe.openGmailPageAndVerifyComposeBtnPresent(t, browser);
          const composePage = await GmailPageRecipe.openSecureComposeWithRichTextWorkaround(t, gmailPage, browser);
          const subject = `New Rich Text Message ${Util.lousyRandom()}`;
          await ComposePageRecipe.fillMsg(composePage, { to: acctEmail }, subject, undefined, {
            richtext: true,
          });
          await ComposePageRecipe.sendAndClose(composePage);
          await GmailPageRecipe.expandMainMenuIfNeeded(gmailPage);
          await gmailPage.waitAndClick('[aria-label^="Inbox"]');
          await gmailPage.waitAndClick('[role="row"]:first-of-type'); // click the first message
          await gmailPage.waitForContent('.nH h2.hP', `Automated puppeteer test: ${subject}`);
          const urls = await gmailPage.getFramesUrls(['/chrome/elements/pgp_block.htm'], { sleep: 1 });
          await GmailPageRecipe.deleteThread(gmailPage);
          expect(urls.length).to.eq(1);
        },
        undefined,
        minutes(6) // explicitly set timer-controlled timeout
      )
    );

    test(
      'mail.google.com - back button works in offline mode',
      testWithBrowser(async (t, browser) => {
        await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail', { cleanUpDrafts: false });
        const gmailPage = await openGmailPage(t, browser);
        await gotoGmailPage(gmailPage, '/FMfcgzGkbDWztBnnCgRHzjrvmFqLtcJD');
        const expectedMessage = { content: ['this should decrypt even offline'], signature: 'signed', encryption: 'encrypted' };
        await Util.sleep(5);
        await BrowserRecipe.pgpBlockCheck(t, await gmailPage.getFrame(['/chrome/elements/pgp_block.htm'], { sleep: 10, timeout: 25 }), expectedMessage);
        await gotoGmailPage(gmailPage, '/FMfcgzGkbDRNgcQxLmkhBCKVSFwkfdvV'); // plain convo
        await gmailPage.page.setOfflineMode(true); // go offline mode
        await gmailPage.page.goBack({ waitUntil: 'load' });
        await BrowserRecipe.pgpBlockCheck(t, await gmailPage.getFrame(['/chrome/elements/pgp_block.htm']), expectedMessage);
      })
    );

    test(
      'mail.google.com - attachments rendered correctly',
      testWithBrowser(async (t, browser) => {
        await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail', { cleanUpDrafts: false });
        const gmailPage = await openGmailPage(t, browser);
        await gotoGmailPage(gmailPage, '/FMfcgzGkbDXBWBWBfVKHssLtMqvDQSWN');
        // Check if rendering attachments coorectly
        await gmailPage.waitForContent('.aVW span:first-child', '36');
        const urls = await gmailPage.getFramesUrls(['/chrome/elements/attachment.htm']);
        expect(urls.length).to.equal(36);

        // simple attachments triggering processAttachments() keep "download all" button visible
        await gotoGmailPage(gmailPage, '/KtbxLvHkSWwbVHxgCbWNvXVKGjFgqMbGQq');
        await Util.sleep(5);
        await gmailPage.waitAll('iframe');
        await gmailPage.waitAll(['.pYTkkf-JX-ano'], { visible: true });

        // attachments which contain emoji in filename are rendered correctly
        await gotoGmailPage(gmailPage, '/FMfcgzGtwqFGhMwWtLRjkPJlQlZHSlrW');
        await Util.sleep(5);
        await gmailPage.waitAll('iframe');
        await gmailPage.waitAll(['.aZo'], { visible: false });
        const urls2 = await gmailPage.getFramesUrls(['/chrome/elements/attachment.htm']);
        expect(urls2.length).to.equal(2);
        expect(await gmailPage.waitForContent('.aVW span:first-child', '2'));
        expect(await gmailPage.waitForContent('.aVW span.a2H', '  •  Scanned by Gmail'));
        await gmailPage.close();
      })
    );

    test(
      'mail.google.com - msg.asc message content renders',
      testWithBrowser(async (t, browser) => {
        await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
        const gmailPage = await openGmailPage(t, browser);
        await gotoGmailPage(gmailPage, '/QgrcJHrtqfgLGKqwChjKsHKzZQpwRHMBqpG');
        await gmailPage.waitAll('@action-show-original-conversation');
        const urls = await gmailPage.getFramesUrls(['/chrome/elements/pgp_block.htm'], { sleep: 10, appearIn: 25 });
        expect(urls.length).to.equal(1);
        const pgpBlockFrame = await gmailPage.getFrame(['pgp_block.htm']);
        await BrowserRecipe.pgpBlockCheck(t, pgpBlockFrame, {
          content: ['test that content from msg.asc renders'],
          encryption: 'encrypted',
          signature: 'not signed',
        });
        await pageHasSecureReplyContainer(t, browser, gmailPage);
        expect(await gmailPage.isElementVisible('.aQH')).to.equal(false); // original attachment container(s) should be hidden
      })
    );

    test(
      'mail.google.com - Thunderbird HTML signed, plain signed, and signed + encrypted messages render correctly',
      testWithBrowser(
        async (t, browser) => {
          t.timeout(minutes(6)); // allow time for account setup and all three messages
          await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail', { cleanUpDrafts: false });
          for (const { format, path, encrypted } of [
            { format: 'HTML signed', path: '/FMfcgzGkbDZKPJrNLplXZhKfWwtgjrXt', encrypted: false },
            { format: 'plain signed', path: '/FMfcgzGkbDZKPKzSnGtGKZrPZSbTBNnB', encrypted: false },
            { format: 'signed + encrypted', path: '/FMfcgzGkbDZKPLBqWFzbgWqCrplTQdNz', encrypted: true },
          ]) {
            t.log(`Thunderbird message: ${format}`);
            const gmailPage = await openGmailPage(t, browser, path);
            const pgpBlockFrame = await gmailPage.getFrame(['/chrome/elements/pgp_block.htm'], { sleep: 0, timeout: 35 });
            await BrowserRecipe.pgpBlockCheck(t, pgpBlockFrame, {
              content: encrypted ? ['Encrypted Subject: [ci.test] Thunderbird html signed + encrypted', '1234'] : ['1234'],
              encryption: encrypted ? 'encrypted' : 'not encrypted',
              signature: 'signed',
            });
            await pageHasSecureReplyContainer(t, browser, gmailPage);
            await gmailPage.waitAll('iframe.pgp_block.publicKey');
            await withReattachedGmailPage(browser, gmailPage, async attachedPage => {
              const pubkeyFrame = await attachedPage.getFrame(['/chrome/elements/pgp_pubkey.htm'], { sleep: 0 });
              await pubkeyFrame.waitForContent('@container-pgp-pubkey', 'Fingerprint: 50B7 A032 B5E1 FBAB 24BA B205 B362 45FD AC2F BF3D');
            });
            if (!encrypted) {
              expect(await gmailPage.getFramesUrls(['/chrome/elements/pgp_block.htm'], { sleep: 0 })).to.have.length(1);
              await testMinimumElementHeight(gmailPage, '.pgp_block.signedDetached', 80);
              await testMinimumElementHeight(gmailPage, '.pgp_block.publicKey', 120);
            }
            expect(await gmailPage.isElementVisible('.aQH')).to.equal(false); // original attachment container(s) should be hidden
            await gmailPage.close();
          }
        },
        undefined,
        minutes(6)
      )
    );

    // draft-sensitive test
    test.serial(
      'mail.google.com - saving and rendering compose drafts when offline',
      testWithBrowser(
        async (t, browser) => {
          await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
          t.timeout(minutes(6)); // extend ava's timeout
          const gmailPage = await openGmailPage(t, browser);
          // create compose draft
          await gmailPage.waitAndClick('@action-secure-compose', { delay: 1 });
          await createSecureDraft(t, browser, gmailPage, 'compose draft 1', { offline: true });
          await gmailPage.waitAndClick('@action-secure-compose', { delay: 1 });
          await createSecureDraft(t, browser, gmailPage, 'compose draft 2', { offline: true });
          await gmailPage.reload({ timeout: TIMEOUT_PAGE_LOAD * 1000, waitUntil: 'load' });
          await GmailPageRecipe.expandMainMenuIfNeeded(gmailPage);
          await gmailPage.waitAndClick('[data-tooltip="Drafts"]');
          await gmailPage.waitForContent('#fc_offline_drafts', 'FlowCrypt offline drafts:');
          await gmailPage.ensureElementsCount('#fc_offline_drafts a', 2);
          await gmailPage.waitAndClick('#fc_offline_drafts a:first-of-type');
          // compose draft 2 should be first in list as drafts are sorted by date descending
          const draft = await pageHasSecureDraft(gmailPage, 'compose draft 2');
          await draft.type('@input-body', 'trigger saving a draft to the cloud', true);
          await ComposePageRecipe.waitWhenDraftIsSaved(draft);
          // after draft 2 is saved to the cloud, it should be removed from offline drafts
          await gmailPage.reload({ timeout: TIMEOUT_PAGE_LOAD * 1000, waitUntil: 'load' });
          await gmailPage.waitForContent('#fc_offline_drafts', 'FlowCrypt offline drafts:');
          await gmailPage.ensureElementsCount('#fc_offline_drafts a', 1);
          await gmailPage.waitAndClick('#fc_offline_drafts a');
          await pageHasSecureDraft(gmailPage, 'compose draft 1');
        },
        undefined,
        minutes(6) // explicitly set timer-controlled timeout
      )
    );

    // convo-sensitive, draft-sensitive test
    test.serial(
      'mail.google.com - secure reply btn, reply draft',
      testWithBrowser(
        async (t, browser) => {
          await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
          const gmailPage = await openGmailPage(t, browser);
          const threadId = '19ae97b85fe4f50e'; // 1st message -- thread id
          await gotoGmailPage(gmailPage, `/${threadId}`); // go to encrypted convo
          await GmailPageRecipe.trimConvo(gmailPage, threadId);
          await gmailPage.waitAndClick('@secure-reply-button');
          const replyBox = await gmailPage.getFrame(['/chrome/elements/compose.htm'], { sleep: 5 });
          await Util.sleep(3);
          expect(await replyBox.read('@recipients-preview')).to.equal('e2e.enterprise.test@flowcrypt.com');
          await createSecureDraft(t, browser, gmailPage, 'reply draft');
          await createSecureDraft(t, browser, gmailPage, 'offline reply draft', { offline: true });
          await gmailPage.reload({ timeout: TIMEOUT_PAGE_LOAD * 1000, waitUntil: 'domcontentloaded' }, true);
          await gmailPage.waitAll(`${replyIframe}[src*="&draftId="]`);
          await withReattachedGmailPage(browser, gmailPage, async attachedPage => {
            const restoredReply = await pageHasSecureDraft(attachedPage, 'offline reply draft');
            await GmailPageRecipe.dismissMobileNotificationsPrompt(attachedPage);
            await restoredReply.waitAndClick('@action-send', { confirmGone: true });
          });
          await Util.sleep(2);
          await gmailPage.reload({ timeout: TIMEOUT_PAGE_LOAD * 1000, waitUntil: 'load' }, true);
          await gmailPage.waitAndClick('.h7:last-child .ajz', { delay: 1 }); // the small triangle which toggles the message details
          await gmailPage.waitForContent('.h7:last-child .ajA', 'Re: [ci.test] secure reply btn, reply draft'); // make sure that the subject of the sent draft is corrent
          await GmailPageRecipe.trimConvo(gmailPage, threadId);
        },
        undefined,
        minutes(7) // this test often takes more than 5 minutes
      )
    );

    // draft-sensitive test
    test.serial(
      'mail.google.com - multiple compose windows, saving/opening compose draft',
      testWithBrowser(
        async (t, browser) => {
          await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
          t.timeout(minutes(4)); // extend ava's timeout
          const gmailPage = await openGmailPage(t, browser);
          // create compose draft
          await gmailPage.waitAndClick('@action-secure-compose', { delay: 1 });
          await createSecureDraft(t, browser, gmailPage, 'a compose draft');
          await gmailPage.reload({ timeout: TIMEOUT_PAGE_LOAD * 1000, waitUntil: 'load' });
          t.timeout(minutes(4)); // extend ava's timeout
          await gotoGmailPage(gmailPage, '', 'drafts'); // to go drafts section
          // open new compose window and saved draft
          await gmailPage.waitAndClick('@action-secure-compose', { delay: 1 });
          await gmailPage.waitAndClick('//*[text()="Draft"]');
          await Util.sleep(2);
          // verify that there are two compose windows: new compose window and secure draft
          const urls = await gmailPage.getFramesUrls(['/chrome/elements/compose.htm'], { sleep: 1 });
          expect(urls.length).to.equal(2);
          await pageHasSecureDraft(gmailPage, 'compose draft');
          // try to open 4 compose windows at the same time
          await gmailPage.waitAndClick('@action-secure-compose', { delay: 1 });
          await gmailPage.waitAndClick('@action-secure-compose', { delay: 1 });
          await gmailPage.waitForContent('.ui-toast-title', 'Only 3 FlowCrypt windows can be opened at a time');
        },
        undefined,
        minutes(6) // the test usually takes around 4 minutes
      )
    );

    test(
      'mail.google.com - plain message contains smart replies',
      testWithBrowser(async (t, browser) => {
        await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail', { cleanUpDrafts: false });
        const gmailPage = await openGmailPage(t, browser);
        await Util.sleep(1);
        await gotoGmailPage(gmailPage, '/FMfcgzGpHHKCrKRLptBSNwkpMxzkdcQc'); // plain convo with smart replies
        await gmailPage.waitForContent('.brb', 'Yes');
      })
    );

    test(
      'mail.google.com - plain reply to encrypted and signed messages',
      testWithBrowser(async (t, browser) => {
        await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
        let gmailPage = await openGmailPage(t, browser, '/FMfcgzGkbDRNgcQxLmkhBCKVSFwkfdvV'); // plain convo
        await clickGmailControl(gmailPage, 'div.adn [aria-label="Reply"]');
        await gmailPage.waitAll('[data-tooltip^="Send"]');
        await gmailPage.close();
        gmailPage = await openGmailPage(t, browser, '/181d226b4e69f172'); // go to encrypted convo
        await clickGmailControl(gmailPage, 'div.adn [aria-label="Reply"]');
        await gmailPage.waitTillGone('.reply_message');
        await gmailPage.waitAll('[data-tooltip^="Send"]'); // The Send button from the Standard reply box
        await gmailPage.waitForContent(
          '.reply_message_evaluated .error_notification',
          'The last message was encrypted, but you are composing a reply without encryption.'
        );
        await clickGmailControl(gmailPage, '[data-tooltip="Secure Reply"]');
        await gmailPage.waitAll('.reply_message');
        await pageHasSecureReplyContainer(t, browser, gmailPage, { isReplyPromptAccepted: true });
        await gmailPage.close();
        gmailPage = await browser.newPage(t);
        await gotoGmailConversation(gmailPage, { path: '/FMfcgzGkbDRNpjDdNvCrwzqvXspZZxvh', subject: '[ci.test] signed email' });
        await gmailPage.waitAll('iframe.pgp_block.signedMsg');
        t.log('Opening Gmail Reply on the signed message');
        await clickGmailControl(gmailPage, 'div.adn button[aria-label="Reply"]');
        await gmailPage.waitTillGone('.reply_message');
        await gmailPage.waitAll('[data-tooltip^="Send"]'); // The Send button from the Standard reply box
        await gmailPage.notPresent('.reply_message_evaluated .error_notification'); // should not show the warning about switching to encrypted reply
      })
    );

    // https://github.com/FlowCrypt/flowcrypt-browser/issues/5906
    test(
      'mail.google.com - older-message secure reply switching preserves quotes and expanded message menus show secure buttons',
      testWithBrowser(
        async (t, browser) => {
          await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
          const gmailPage = await openGmailPage(t, browser, '/FMfcgzGqRGfPBbNLWvfPvDbxnHBwkdGf'); // plain convo
          await gmailPage.waitAll('@action-secure-compose', { timeout: TIMEOUT_PAGE_LOAD });
          const messageSelector = '[role="listitem"] .adn.ads';
          const expandedMessage = async (index: number) => {
            const id = await gmailPage.target.$$eval(messageSelector, (messages, i) => messages.at(i)?.getAttribute('data-legacy-message-id'), index);
            if (!id) {
              throw new Error(`No Gmail message ID found at index ${index}`);
            }
            return `${messageSelector}[data-legacy-message-id="${id}"]`;
          };
          for (const switchControl of ['#switch_to_encrypted_reply', '[data-tooltip="Secure Reply"]']) {
            t.log(`Switch older-message reply using ${switchControl}`);
            await clickGmailControl(gmailPage, '[role="listitem"] .adf.ads'); // expand first message of thread
            await gmailPage.target.waitForFunction(
              selector => document.querySelectorAll(selector).length === 2,
              { timeout: TIMEOUT_ELEMENT_APPEAR * 1000 },
              messageSelector
            );
            const olderMessage = await expandedMessage(0);
            await clickGmailControl(gmailPage, `${olderMessage} [aria-label="Reply"]`);
            await gmailPage.waitAll('[data-tooltip^="Send"]'); // The Send button from the Standard reply box
            await gmailPage.waitForContent(
              '.reply_message_evaluated .error_notification',
              'The last message was encrypted, but you are composing a reply without encryption.'
            );

            await clickGmailControl(gmailPage, switchControl.startsWith('#') ? switchControl : `${olderMessage} ${switchControl}`);
            await gmailPage.waitAll('.reply_message');
            const replyBox = await gmailPage.getFrame(['/chrome/elements/compose.htm', '&skipClickPrompt=___cu_true___'], { sleep: 0 });
            await replyBox.waitAll('@input-body');
            await gmailPage.target.waitForFunction(() => document.querySelectorAll('iframe[src*="/chrome/elements/compose.htm"]').length === 2, {
              timeout: TIMEOUT_ELEMENT_APPEAR * 1000,
            });
            await pageHasSecureReplyContainer(t, browser, gmailPage, { isReplyPromptAccepted: true, composeFrameCount: 2, replyFrame: replyBox });
            if (switchControl === '#switch_to_encrypted_reply') {
              await replyBox.waitAll(['@action-expand-quoted-text']);
              await replyBox.waitAndClick('@action-expand-quoted-text', { delay: 0 });
              // Check if quoted message doesn't contain last message
              expect(await replyBox.read('@input-body')).to.not.contain(`Here's reply`);
            }

            // Finish deleting the draft before resetting the conversation for the next scenario.
            await replyBox.waitAndClick('.delete_draft', { delay: 0 });
            await replyBox.waitAll('@action-accept-reply-prompt');
            await gmailPage.reload({ timeout: TIMEOUT_PAGE_LOAD * 1000, waitUntil: 'load' });
            await gmailPage.waitAll('[role="listitem"] .adf.ads');
          }

          t.log('Secure reply buttons on newest and expanded older message menus');
          const checkSecureReplyMenu = async (message: string) => {
            await gmailPage.waitAll(`${message} iframe.pgp_block.encryptedMsg`);
            await GmailPageRecipe.dismissMobileNotificationsPrompt(gmailPage);
            const menu = `${message} ${messageMenu}`;
            await gmailPage.waitAndFocus(menu);
            await gmailPage.press('Enter');
            await gmailPage.waitAll(`${menu}[aria-expanded="true"]`);
            await gmailPage.waitAll('@action-reply-message-button');
            await gmailPage.press('Escape');
            await gmailPage.waitTillGone(`${menu}[aria-expanded="true"]`);
          };
          await gmailPage.waitAll(`${messageSelector} ${messageMenu}`);
          await checkSecureReplyMenu(await expandedMessage(-1));

          await clickGmailControl(gmailPage, '[role="listitem"] .adf.ads');
          await gmailPage.target.waitForFunction(
            selector => document.querySelectorAll(selector).length === 2,
            { timeout: TIMEOUT_ELEMENT_APPEAR * 1000 },
            messageSelector
          );
          await checkSecureReplyMenu(await expandedMessage(0));
        },
        undefined,
        minutes(6)
      )
    );

    test(
      'mail.google.com - plain reply with dot menu',
      testWithBrowser(async (t, browser) => {
        await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
        const gmailPage = await browser.newPage(t);
        await gotoGmailConversation(gmailPage, { path: '/FMfcgzGkbDRNgcQxLmkhBCKVSFwkfdvV', subject: '[ci.test] plain email' });
        await clickGmailControl(gmailPage, 'div.adn [aria-label="Reply"]');
        await gmailPage.waitAll('[data-tooltip^="Send"]');
        await gotoGmailConversation(gmailPage, replyAllConversation);
        await gmailPage.waitAll('iframe.pgp_block');
        await clickGmailControl(gmailPage, `.adn ${messageMenu}`);
        await clickGmailControl(gmailPage, 'li[data-action-type="24"]'); // click reply-all
        await gmailPage.waitAll('[data-tooltip^="Send"]'); // The Send button from the Standard reply box
        await gmailPage.waitForContent(
          '.reply_message_evaluated .error_notification',
          'The last message was encrypted, but you are composing a reply without encryption.'
        );
        await clickGmailControl(gmailPage, '[data-tooltip="Secure Reply"]');
        const replyBox = await getEditableGmailReply(gmailPage);
        await pageHasSecureReplyContainer(t, browser, gmailPage, { isReplyPromptAccepted: true, replyFrame: replyBox });
        await replyBox.waitForSelTestState('ready');
        expect(await replyBox.read('@recipients-preview')).to.equal(['flowcrypt.compatibility@gmail.com', 'e2e.enterprise.test@flowcrypt.com'].join(''));
      })
    );

    // https://github.com/FlowCrypt/flowcrypt-browser/issues/5933
    test(
      'mail.google.com - test reply all for password protected message',
      testWithBrowser(async (t, browser) => {
        await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail', { cleanUpDrafts: false });
        const gmailPage = await openGmailPage(t, browser);
        await gotoGmailPage(gmailPage, '/FMfcgzQZTMHNLflWQjRcSvWlMsKbLhpr');
        await gmailPage.waitAll('@action-secure-compose', { timeout: TIMEOUT_PAGE_LOAD });
        await clickGmailControl(gmailPage, `.adn ${messageMenu}`);
        await gmailPage.waitAll('.action_reply_all_message_button');
      })
    );

    test(
      'mail.google.com - switch to encrypted forward',
      testWithBrowser(
        async (t, browser) => {
          await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
          const gmailPage = await browser.newPage(t);
          await gotoGmailConversation(gmailPage, replyAllConversation);
          await gmailPage.waitAll('iframe.pgp_block');
          await clickGmailControl(gmailPage, `.adn ${messageMenu}`);
          await clickGmailControl(gmailPage, 'li[data-action-type="25"]'); // click forward
          await gmailPage.waitAll('[data-tooltip^="Send"]'); // The Send button from the Standard reply box
          await gmailPage.waitForContent(
            '.reply_message_evaluated .error_notification',
            'The last message was encrypted, but you are composing a message without encryption. Switch to encrypted compose'
          );
          await clickGmailControl(gmailPage, '#switch_to_encrypted_reply');
          const replyBox = await getEditableGmailReply(gmailPage);
          await replyBox.waitForContent('@input-body', '---------- Forwarded message ---------');
        },
        undefined,
        minutes(6)
      )
    );

    test(
      'mail.google.com - secure reply and forward in dot menu',
      testWithBrowser(async (t, browser) => {
        await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
        const gmailPage = await browser.newPage(t);
        await gotoGmailConversation(gmailPage, replyAllConversation);
        await gmailPage.waitAll(`${replyIframe}[src*="&skipClickPrompt=___cu_false___"]`);
        const gmailContextMenu = `[role="listitem"] .adn.ads ${messageMenu}`;
        for (const action of ['reply', 'reply-all', 'forward'] as const) {
          t.log(`Opening secure ${action} from the message menu`);
          const menuItem = `[data-test="action-${action}-message-button"]`;
          await clickGmailControl(gmailPage, gmailContextMenu);
          await clickGmailControl(gmailPage, menuItem);
          const replyOption = `a_${action.replace('-', '_')}`;
          const iframe = await gmailPage.waitAny(`${replyIframe}[src*="&skipClickPrompt=___cu_true___"][src*="&replyOption=${replyOption}&"]`);
          let composerUrl: string;
          try {
            await gmailPage.waitTillGone(menuItem);
            composerUrl = await iframe.evaluate(el => (el as HTMLIFrameElement).src);
          } finally {
            await iframe.dispose();
          }

          const embeddedComposer = await gmailPage.getFrame([composerUrl], { sleep: 0 });
          // Probe the frame independently of composer readiness. Only a stalled Puppeteer evaluation can trigger the workaround.
          const canReadFrame =
            !process.env.SEMAPHORE ||
            (await Promise.race([
              embeddedComposer.target.evaluate(() => true),
              new Promise<boolean>(resolve => setTimeout(() => resolve(false), TIMEOUT_ELEMENT_APPEAR * 1000).unref()),
            ]));
          if (!canReadFrame) {
            console.warn(`Reduced coverage for secure ${action}: Puppeteer could not read the embedded Gmail composer. Checking a fresh instance instead.`);
          }

          const fallbackPage = canReadFrame ? undefined : await browser.newPage(t, composerUrl);
          const composer = fallbackPage ?? embeddedComposer;
          try {
            await composer.waitUntilViewLoaded();
            await composer.waitAll(['@input-body', '@action-send']);
            if (action === 'reply-all') {
              await composer.waitForSelTestState('ready');
              const visibleRecipients = await composer.target.$$eval(
                '[data-test="recipients-preview"] .email_address',
                elements => elements.filter(element => element.checkVisibility({ visibilityProperty: true })).length
              );
              expect(visibleRecipients).to.equal(2);
            } else if (action === 'forward') {
              await composer.waitForContent('@input-body', '---------- Forwarded message ---------');
            }
          } finally {
            if (fallbackPage) {
              await fallbackPage.close();
              await gmailPage.page.bringToFront();
            }
          }
        }
      })
    );

    // convo-sensitive, draft-sensitive test
    test.serial(
      'mail.google.com - plain reply draft',
      testWithBrowser(
        async (t, browser) => {
          await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
          const threadId = '181d226b4e69f172'; // 1st message -- thread id
          const gmailPage = await openGmailPage(t, browser, `/${threadId}`);
          await GmailPageRecipe.trimConvo(gmailPage, threadId);
          await gmailPage.waitAndClick('div.adn [aria-label="Reply"]', { delay: 5 });
          t.timeout(minutes(2)); // extend ava's timeout
          await Util.sleep(5);
          await gmailPage.waitTillFocusIsIn('div[aria-label="Message Body"]', { timeout: 10 });
          await gmailPage.type('div[aria-label="Message Body"]', 'plain reply', true);
          await gmailPage.waitForContent('.oG.aOy', 'Draft saved');
          // sometimes "Page has unsaved data" alert is displayed here, auto-accept it
          await gmailPage.reload({ timeout: TIMEOUT_PAGE_LOAD * 1000, waitUntil: 'networkidle2' }, true);
          await gmailPage.waitForContent('div[aria-label="Message Body"]', 'plain reply', 30);
          await pageDoesNotHaveSecureReplyContainer(gmailPage);
          await gmailPage.click('[aria-label^="Discard draft"]');
        },
        undefined,
        minutes(5) // explicitly set timer-controlled timeout
      )
    );

    test(
      'mail.google.com - compatibility-key attachments: Outlook message and encrypted "message" attachment are recognized',
      testWithBrowser(async (t, browser) => {
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, 'ci.tests.gmail@flowcrypt.dev');
        await SetupPageRecipe.manualEnter(
          settingsPage,
          'flowcrypt.compatibility.1pp1',
          { submitPubkey: false, usedPgpBefore: true },
          { isSavePassphraseChecked: false, isSavePassphraseHidden: false }
        );
        const gmailPage = await openGmailPage(t, browser);
        t.log('Outlook encrypted message with attachment');
        await gotoGmailPage(gmailPage, '/FMfcgzGllVqqBbjHQQRDsSwcZBlMRzDr');
        await Util.sleep(5);
        await gmailPage.waitAll('iframe');
        expect(await gmailPage.isElementPresent('@container-attachments')).to.equal(false);
        await gmailPage.waitAll(['.pYTkkf-JX-ano'], { visible: false });
        expect(await gmailPage.isElementVisible('.aQH')).to.equal(false); // original attachment container(s) should be hidden

        t.log('Encrypted text inside "message" attachment');
        await gotoGmailPage(gmailPage, '/FMfcgzGrbHprlHvtTJscCJQpZcqrKQbg');
        await Util.sleep(5);
        await gmailPage.waitAll('iframe');
        expect(await gmailPage.isElementPresent('@container-attachments')).to.equal(false);
        await gmailPage.waitAll(['.pYTkkf-JX-ano'], { visible: false });
        await gmailPage.close();
      })
    );

    test(
      `mail.google.com - large clipped PGP/MIME messages render correctly, including a text/plain attachment`,
      testWithBrowser(async (t, browser) => {
        await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
        const gmailPage = await openGmailPage(t, browser);
        t.log('Regular clipped PGP/MIME message');
        await gotoGmailPage(gmailPage, '/FMfcgzGtxKSjjzhRZRRzddjMvJnpDRQf');
        const urls = await gmailPage.getFramesUrls(['/chrome/elements/pgp_block.htm'], { sleep: 10, appearIn: 25 });
        expect(urls.length).to.equal(1);
        const pgpBlockFrame = await gmailPage.getFrame(['pgp_block.htm']);
        await BrowserRecipe.pgpBlockCheck(t, pgpBlockFrame, {
          content: ['Check it'],
          encryption: 'encrypted',
          signature: 'signed',
        });
        await pageHasSecureReplyContainer(t, browser, gmailPage);

        // https://github.com/FlowCrypt/flowcrypt-browser/issues/6171
        t.log('Clipped PGP/MIME message with text/plain attachment');
        await gotoGmailPage(gmailPage, '/FMfcgzQfBspgLbfNnBHGtlBsFtcLGPsr');
        const attachmentUrls = await gmailPage.getFramesUrls(['/chrome/elements/pgp_block.htm'], { sleep: 10, appearIn: 25 });
        expect(attachmentUrls.length).to.equal(1);
        const attachmentPgpBlockFrame = await gmailPage.getFrame(['pgp_block.htm']);
        await BrowserRecipe.pgpBlockCheck(t, attachmentPgpBlockFrame, {
          content: ['Test large clipped message'],
          encryption: 'encrypted',
          signature: 'not signed',
        });
      })
    );

    test(
      `mail.google.com - render plain text for "message" attachment (which has plain text)`,
      testWithBrowser(async (t, browser) => {
        await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail', { cleanUpDrafts: false });
        const gmailPage = await openGmailPage(t, browser);
        await gotoGmailPage(gmailPage, '/FMfcgzGrbHrBdFGBXqpFZvSkcQpKkvrM');
        await Util.sleep(5);
        await gmailPage.waitForContent('.a3s', 'Plain message');
        expect(await gmailPage.isElementPresent('.aQH')).to.equal(true); // gmail attachment container
        // expect no pgp blocks
        const urls = await gmailPage.getFramesUrls(['/chrome/elements/pgp_block.htm']);
        expect(urls.length).to.equal(0);
      })
    );

    test(
      'mail.google.com - pubkey file gets rendered',
      testWithBrowser(async (t, browser) => {
        await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
        const gmailPage = await openGmailPage(t, browser);
        await gotoGmailPage(gmailPage, '/FMfcgzGkbDXBWCgTcMJlmBtfNxrbzTTn');
        const urls = await gmailPage.getFramesUrls(['/chrome/elements/pgp_pubkey.htm']);
        expect(urls.length).to.equal(1);
        await pageHasSecureReplyContainer(t, browser, gmailPage);
        expect(await gmailPage.isElementVisible('.aVW')).to.equal(false); // attachment label count should be hidden
        expect(await gmailPage.isElementVisible('.aQH')).to.equal(false); // original attachment container(s) should be hidden
      })
    );

    // uses live openpgpkey.flowcrypt.com WKD
    test(
      'can lookup public key from WKD directly',
      testWithBrowser(async (t, browser) => {
        const acctEmail = 'ci.tests.gmail@flowcrypt.dev';
        await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
        const composePage = await ComposePageRecipe.openStandalone(t, browser, acctEmail);
        await ComposePageRecipe.fillMsg(composePage, { to: 'demo@flowcrypt.com' }, 'should find pubkey from WKD directly');
        await composePage.waitForContent('.email_address.has_pgp', 'demo@flowcrypt.com');
        expect(await composePage.attr('.email_address.has_pgp', 'title')).to.contain('0997 7F6F 512C A5AD 76F0 C210 248B 60EB 6D04 4DF8 (openpgp)');
      })
    );

    // todo - missing equivalent sample at ci.tests.gmail
    // test('mail.google.com - pubkey gets rendered when using quoted-printable mime', testWithBrowser('compatibility', async (t, browser) => {
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
      const elHeight = Number(elStyle?.replace('height: ', '').replace('px;', ''));
      if (isNaN(elHeight)) {
        throw Error(`msgIframeHeight iNaN`);
      }
      expect(elHeight).to.be.above(min, 'Expected iframe height above 80px (in particular not expecting 60 or 30 which are defaults suggesting failure)');
    };
  }
};
