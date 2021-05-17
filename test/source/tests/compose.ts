/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import * as ava from 'ava';
import { Page } from 'puppeteer';

import { BrowserHandle, Controllable, ControllablePage, ControllableFrame } from './../browser';
import { Config, Util } from './../util';
import { writeFileSync } from 'fs';
import { AvaContext } from './tooling';
import { ComposePageRecipe } from './page-recipe/compose-page-recipe';
import { Dict } from './../core/common';
import { GoogleData } from './../mock/google/google-data';
import { InboxPageRecipe } from './page-recipe/inbox-page-recipe';
import { OauthPageRecipe } from './page-recipe/oauth-page-recipe';
import { PageRecipe } from './page-recipe/abstract-page-recipe';
import { SettingsPageRecipe } from './page-recipe/settings-page-recipe';
import { somePubkey } from './../mock/attester/attester-endpoints';
import { TestUrls } from './../browser/test-urls';
import { TestVariant } from './../util';
import { TestWithBrowser } from './../test';
import { expect } from "chai";
import { BrowserRecipe } from './tooling/browser-recipe';
import { SetupPageRecipe } from './page-recipe/setup-page-recipe';
import { testConstants } from './tooling/consts';

// tslint:disable:no-blank-lines-func
// tslint:disable:no-unused-expression
/* eslint-disable max-len */

export const defineComposeTests = (testVariant: TestVariant, testWithBrowser: TestWithBrowser) => {

  if (testVariant !== 'CONSUMER-LIVE-GMAIL') {

    ava.default('compose - toggle minimized state by clicking compose window header', testWithBrowser('compatibility', async (t, browser) => {
      const inboxPage = await browser.newPage(t, TestUrls.extensionInbox('flowcrypt.compatibility@gmail.com'));
      const composeFrame = await InboxPageRecipe.openAndGetComposeFrame(inboxPage);
      const initialComposeFrameHeight = await inboxPage.getOuterHeight('iframe');
      await composeFrame.waitAll('#section_header');
      const composeFrameHeaderHeight = await composeFrame.getOuterHeight('#section_header');
      await Util.sleep(4); // todo - should be fixed, caused by `$('body').attr('data-test-state', 'ready');` baing called in two differing situations
      // mimimize compose frame
      await composeFrame.waitAndClick('@header-title');
      expect(await inboxPage.getOuterHeight('iframe')).to.eq(composeFrameHeaderHeight, 'compose box height failed to collapse');
      // restore compose frame
      await composeFrame.waitAndClick('@header-title');
      expect(await inboxPage.getOuterHeight('iframe')).to.eq(initialComposeFrameHeight);
    }));

    ava.default('compose - signed with entered pass phrase + will remember pass phrase in session', testWithBrowser('ci.tests.gmail', async (t, browser) => {
      const k = Config.key('ci.tests.gmail');
      const settingsPage = await browser.newPage(t, TestUrls.extensionSettings('ci.tests.gmail@flowcrypt.test'));
      await SettingsPageRecipe.forgetAllPassPhrasesInStorage(settingsPage, k.passphrase);
      const inboxPage = await browser.newPage(t, TestUrls.extensionInbox('ci.tests.gmail@flowcrypt.test'));
      const composeFrame = await InboxPageRecipe.openAndGetComposeFrame(inboxPage);
      await ComposePageRecipe.fillMsg(composeFrame, { to: 'human@flowcrypt.com' }, 'sign with entered pass phrase', { encrypt: false });
      await composeFrame.waitAndClick('@action-send');
      await inboxPage.waitAll('@dialog-passphrase');
      const passphraseDialog = await inboxPage.getFrame(['passphrase.htm']);
      await passphraseDialog.waitAndType('@input-pass-phrase', k.passphrase);
      await passphraseDialog.waitAndClick('@action-confirm-pass-phrase-entry');
      await inboxPage.waitTillGone('@dialog-passphrase');
      await inboxPage.waitTillGone('@container-new-message'); // confirming pass phrase will auto-send the message
      // signed - done, now try to see if it remembered pp in session
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
      await ComposePageRecipe.fillMsg(composePage, { to: 'human@flowcrypt.com' }, 'signed message pp in session', { encrypt: false });
      await ComposePageRecipe.sendAndClose(composePage);
      await settingsPage.close();
      await inboxPage.close();
    }));

    ava.default('compose - can load contact based on name', testWithBrowser('ci.tests.gmail', async (t, browser) => {
      // works on first search
      const composePage1 = await ComposePageRecipe.openStandalone(t, browser, 'compose');
      await composePage1.type('@input-to', 'human'); // test guessing of contacts
      await composePage1.waitAll(['@container-contacts', '@action-select-contact-name(Human at FlowCrypt)']);
      await composePage1.waitAll(['@container-contacts', '@action-select-contact-email(human@flowcrypt.com)']);
      // works on subsequent search
      const composePage2 = await ComposePageRecipe.openStandalone(t, browser, 'compose');
      await composePage2.type('@input-to', 'human'); // test guessing of contacts
      await composePage2.waitAll(['@container-contacts', '@action-select-contact-name(Human at FlowCrypt)']);
      await composePage2.waitAll(['@container-contacts', '@action-select-contact-email(human@flowcrypt.com)']);
    }));

    ava.default('compose - can load contact based on name different from email', testWithBrowser('ci.tests.gmail', async (t, browser) => {
      // works on the first search
      const composePage1 = await ComposePageRecipe.openStandalone(t, browser, 'compose');
      await composePage1.type('@input-to', 'FirstName'); // test guessing of contacts when the name is not included in email address
      await composePage1.waitAll(['@container-contacts', '@action-select-contact-email(therecipient@theirdomain.com)']);
      // works on subsequent search
      const composePage2 = await ComposePageRecipe.openStandalone(t, browser, 'compose');
      await composePage2.type('@input-to', 'FirstName'); // test guessing of contacts when the name is not included in email address
      await composePage2.waitAll(['@container-contacts', '@action-select-contact-email(therecipient@theirdomain.com)']);
    }));

    ava.default(`compose - can choose found contact`, testWithBrowser('ci.tests.gmail', async (t, browser) => {
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
      // composePage.enable_debugging('choose-contact');
      await composePage.type('@input-to', 'human'); // test loading of contacts
      await composePage.waitAll(['@container-contacts', '@action-select-contact-email(human@flowcrypt.com)'], { timeout: 30 });
      await composePage.waitAndClick('@action-select-contact-email(human@flowcrypt.com)', { retryErrs: true, confirmGone: true, delay: 0 });
      // todo - verify that the contact/pubkey is showing in green once clicked
      await composePage.waitAndClick('@input-subject');
      await composePage.type('@input-subject', `Automated puppeteer test: pubkey chosen by clicking found contact`);
      await composePage.type('@input-body', `This is an automated puppeteer test: pubkey chosen by clicking found contact`);
      await ComposePageRecipe.sendAndClose(composePage);
    }));

    ava.default(`compose - recipients are properly ordered`, testWithBrowser('ci.tests.gmail', async (t, browser) => {
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
      await composePage.page.setViewport({ width: 540, height: 606 });
      await ComposePageRecipe.fillMsg(composePage, { to: 'recip1@corp.co', cc: 'сс1@corp.co', bcc: 'bсс1@corp.co' }, 'recipients are properly ordered');
      await composePage.waitAndType(`@input-to`, 'recip2@corp.co');
      await composePage.waitAndType(`@input-bcc`, 'bcc2@corp.co');
      await composePage.waitAndFocus('@input-body');
      await composePage.waitTillGone('@spinner');
      const emailPreview = await composePage.waitAny('@recipients-preview');
      const recipients = await PageRecipe.getElementPropertyJson(emailPreview, 'textContent');
      expect(recipients).to.eq(['recip1@corp.co', 'recip2@corp.co', 'сс1@corp.co', 'bсс1@corp.co', '1 more'].join(''));
    }));

    ava.default(`compose - auto include pubkey when our key is not available on Wkd`, testWithBrowser('ci.tests.gmail', async (t, browser) => {
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
      await composePage.page.setViewport({ width: 540, height: 606 });
      await ComposePageRecipe.fillMsg(composePage, { to: 'flowcrypt.compatibility@gmail.com' }, 'testing auto include pubkey');
      await composePage.waitTillGone('@spinner');
      await Util.sleep(3); // wait for the Wkd lookup to complete
      expect(await composePage.hasClass('@action-include-pubkey', 'active')).to.be.false;
      await composePage.waitAndType(`@input-to`, 'some.unknown@unknown.com');
      await composePage.waitAndFocus('@input-body');
      await composePage.waitTillGone('@spinner');
      await Util.sleep(3); // allow some time to search for messages
      expect(await composePage.hasClass('@action-include-pubkey', 'active')).to.be.true;
    }));

    ava.default(`compose - auto include pubkey is inactive when our key is available on Wkd`, testWithBrowser(undefined, async (t, browser) => {
      const acct = 'wkd@google.mock.flowcryptlocal.test:8001';
      const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acct);
      await SetupPageRecipe.autoKeygen(settingsPage);
      const composePage = await ComposePageRecipe.openStandalone(t, browser, acct);
      await composePage.page.setViewport({ width: 540, height: 606 });
      await ComposePageRecipe.fillMsg(composePage, { to: 'ci.tests.gmail@flowcrypt.test' }, 'testing auto include pubkey');
      await composePage.waitTillGone('@spinner');
      await Util.sleep(3); // wait for the Wkd lookup to complete
      expect(await composePage.hasClass('@action-include-pubkey', 'active')).to.be.false;
      await composePage.waitAndType('@input-to', 'some.unknown@unknown.com');
      await composePage.waitAndFocus('@input-body');
      await composePage.waitTillGone('@spinner');
      await Util.sleep(3); // allow some time to search for messages
      expect(await composePage.hasClass('@action-include-pubkey', 'active')).to.be.false;
    }));

    ava.default(`compose - freshly loaded pubkey`, testWithBrowser('ci.tests.gmail', async (t, browser) => {
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
      await ComposePageRecipe.fillMsg(composePage, { to: 'human@flowcrypt.com' }, 'freshly loaded pubkey');
      await ComposePageRecipe.sendAndClose(composePage);
    }));

    ava.default('compose - recipient pasted including name', testWithBrowser('ci.tests.gmail', async (t, browser) => {
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
      await ComposePageRecipe.fillMsg(composePage, { to: 'Human at Flowcrypt <Human@FlowCrypt.com>' }, 'recipient pasted including name');
      await ComposePageRecipe.sendAndClose(composePage);
    }));

    ava.default('compose - nopgp', testWithBrowser('ci.tests.gmail', async (t, browser) => {
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
      await ComposePageRecipe.fillMsg(composePage, { to: 'human+nopgp@flowcrypt.com' }, 'unknown pubkey');
      await ComposePageRecipe.sendAndClose(composePage, { password: 'test-pass' });
    }));

    ava.default('compose - from alias', testWithBrowser('compatibility', async (t, browser) => {
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility');
      await composePage.selectOption('@input-from', 'flowcryptcompatibility@gmail.com');
      await ComposePageRecipe.fillMsg(composePage, { to: 'human@flowcrypt.com' }, 'from alias');
      await ComposePageRecipe.sendAndClose(composePage);
    }));

    ava.default('compose - with attachments + nopgp', testWithBrowser('ci.tests.gmail', async (t, browser) => {
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
      await ComposePageRecipe.fillMsg(composePage, { to: 'human+nopgp@flowcrypt.com' }, 'with files + nonppg');
      const fileInput = await composePage.target.$('input[type=file]');
      await fileInput!.uploadFile('test/samples/small.txt', 'test/samples/small.png', 'test/samples/small.pdf');
      await ComposePageRecipe.sendAndClose(composePage, { password: 'test-pass', timeout: 90 });
    }));

    ava.default('compose - signed message', testWithBrowser('ci.tests.gmail', async (t, browser) => {
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
      await ComposePageRecipe.fillMsg(composePage, { to: 'human@flowcrypt.com' }, 'signed message', { encrypt: false });
      await ComposePageRecipe.sendAndClose(composePage);
    }));

    ava.default('compose - settings - manually copied pubkey', testWithBrowser('ci.tests.gmail', async (t, browser) => {
      const inboxPage = await browser.newPage(t, TestUrls.extensionInbox('ci.tests.gmail@flowcrypt.test'));
      let composeFrame = await InboxPageRecipe.openAndGetComposeFrame(inboxPage);
      await ComposePageRecipe.fillMsg(composeFrame, { to: 'human@flowcrypt.com' }, 'just to load - will close this page');
      await Util.sleep(2); // todo: should wait until actually loaded
      await composeFrame.waitAndClick('@action-close-new-message');
      await inboxPage.waitTillGone('@container-new-message');
      composeFrame = await InboxPageRecipe.openAndGetComposeFrame(inboxPage);
      await ComposePageRecipe.fillMsg(composeFrame, { to: 'human+manualcopypgp@flowcrypt.com' }, 'manual copied key');
      await composeFrame.waitAndClick('@action-open-add-pubkey-dialog', { delay: 1 });
      await inboxPage.waitAll('@dialog-add-pubkey');
      const addPubkeyDialog = await inboxPage.getFrame(['add_pubkey.htm']);
      await addPubkeyDialog.waitAll('@input-select-copy-from');
      await Util.sleep(1);
      await addPubkeyDialog.selectOption('@input-select-copy-from', 'human@flowcrypt.com');
      await Util.sleep(1);
      await addPubkeyDialog.waitAndClick('@action-add-pubkey');
      await inboxPage.waitTillGone('@dialog-add-pubkey');
      await composeFrame.waitAndClick('@action-send', { delay: 2 });
      await inboxPage.waitTillGone('@container-new-message');
    }));

    ava.default('compose - keyboard - Ctrl+Enter sends message', testWithBrowser('ci.tests.gmail', async (t, browser) => {
      const inboxPage = await browser.newPage(t, TestUrls.extensionInbox('ci.tests.gmail@flowcrypt.test'));
      const composeFrame = await InboxPageRecipe.openAndGetComposeFrame(inboxPage);
      await composeFrame.target.evaluateHandle(() => (document.querySelector('#section_compose') as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true })));
      await composeFrame.waitAndRespondToModal('error', 'confirm', 'Please add a recipient first');
    }));

    ava.default('compose - keyboard - Opening & changing composer send btn popover using keyboard', testWithBrowser('ci.tests.gmail', async (t, browser) => {
      const inboxPage = await browser.newPage(t, TestUrls.extensionInbox('ci.tests.gmail@flowcrypt.test'));
      const composeFrame = await InboxPageRecipe.openAndGetComposeFrame(inboxPage);
      await composeFrame.waitAndFocus('@action-show-options-popover');
      await inboxPage.press('Enter');
      await inboxPage.press('ArrowDown', 3); // more arrow downs to ensure that active element selection loops
      await inboxPage.press('Enter');
      expect(await composeFrame.read('@action-send')).to.eq('Sign and Send');
    }));

    ava.default('compose - keyboard - Attaching file using keyboard', testWithBrowser('ci.tests.gmail', async (t, browser) => {
      const inboxPage = await browser.newPage(t, TestUrls.extensionInbox('ci.tests.gmail@flowcrypt.test'));
      const composeFrame = await InboxPageRecipe.openAndGetComposeFrame(inboxPage);
      await composeFrame.waitAndFocus('@action-attach-files');
      // Set up the Promise *before* the file chooser is launched
      const fileChooser = inboxPage.page.waitForFileChooser();
      await Util.sleep(0.5); // waitForFileChooser() is flaky without this timeout, #3051
      await inboxPage.press('Enter');
      await fileChooser;
    }));

    ava.default('compose - reply - old gmail threadId fmt', testWithBrowser('compatibility', async (t, browser) => {
      const appendUrl = 'skipClickPrompt=___cu_false___&ignoreDraft=___cu_false___&threadId=16841ce0ce5cb74d&replyMsgId=16841ce0ce5cb74d';
      const replyFrame = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', { appendUrl, skipValidation: true });
      await replyFrame.waitAll(['#new_message', '@action-retry-by-reloading']);
      expect(await replyFrame.read('#new_message')).to.include('Cannot get reply data for the message you are replying to');
      await replyFrame.notPresent('@action-accept-reply-prompt');
    }));

    ava.default('compose - reply - thread id does not exist', testWithBrowser('compatibility', async (t, browser) => {
      const appendUrl = 'skipClickPrompt=___cu_false___&ignoreDraft=___cu_false___&threadId=16804894591b3a4b&replyMsgId=16804894591b3a4b';
      const replyFrame = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', { appendUrl, skipValidation: true, });
      await replyFrame.waitAll(['#new_message', '@action-retry-by-reloading']);
      expect(await replyFrame.read('#new_message')).to.include('Cannot get reply data for the message you are replying to');
      await replyFrame.notPresent('@action-accept-reply-prompt');
    }));

    ava.default('compose - quote - can load quote from encrypted/text email', testWithBrowser('compatibility', async (t, browser) => {
      const appendUrl = 'threadId=16b584ed95837510&skipClickPrompt=___cu_false___&ignoreDraft=___cu_false___&replyMsgId=16b584ed95837510';
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', { appendUrl, hasReplyPrompt: true });
      await composePage.waitAndClick('@encrypted-reply', { delay: 5 });
      await clickTripleDotAndExpectQuoteToLoad(composePage, [
        'On 2019-06-14 at 23:24, flowcrypt.compatibility@gmail.com wrote:',
        '> This is some message',
        '>',
        '> and below is the quote',
        '>',
        '> > this is the quote',
        '> > still the quote',
        '> > third line',
        '> >> double quote',
        '> >> again double quote'
      ].join('\n'));
      await ComposePageRecipe.sendAndClose(composePage);
    }));

    ava.default('compose - quote - can load quote from plain/text email', testWithBrowser('compatibility', async (t, browser) => {
      const appendUrl = 'threadId=16402d6dc4342e7f&skipClickPrompt=___cu_false___&ignoreDraft=___cu_false___' +
        '&replyMsgId=16402d6dc4342e7f';
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', { appendUrl, hasReplyPrompt: true });
      await composePage.waitAndClick('@encrypted-reply', { delay: 1 });
      await clickTripleDotAndExpectQuoteToLoad(composePage, [
        'On 2018-06-15 at 09:46, info@nvimp.com wrote:',
        '> cropping all except for the image below'
      ].join('\n'));
    }));

    ava.default('compose - reply - can load quote from plain/html email', testWithBrowser('compatibility', async (t, browser) => {
      const appendUrl = 'threadId=16b36861a890bb26&skipClickPrompt=___cu_false___' +
        '&ignoreDraft=___cu_false___&replyMsgId=16b36861a890bb26';
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', { appendUrl, hasReplyPrompt: true });
      await composePage.waitAndClick('@encrypted-reply', { delay: 1 });
      expect(await composePage.read('@input-body')).to.not.include('flowcrypt.compatibility test footer with an img');
      await clickTripleDotAndExpectQuoteToLoad(composePage, [
        'On 2019-06-08 at 09:57, human@flowcrypt.com wrote:',
        '> Used to fail on Android app',
        '>',
        '> ---------- Forwarded message ---------',
        '> From: Mozilla <Mozilla@e.mozilla.org>',
        '> Date: Thu, 6 Jun 2019, 17:22',
        '> Subject: Your misinformation questions ... answered.',
        '> To: <tom@cryptup.org>'
      ].join('\n'));
    }));

    ava.default('compose - reply - can load quote from encrypted/html email', testWithBrowser('compatibility', async (t, browser) => {
      const appendUrl = 'threadId=1663a65bbd73ce1a&skipClickPrompt=___cu_false___&ignoreDraft=___cu_false___&replyMsgId=1663a65bbd73ce1a';
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', { appendUrl, hasReplyPrompt: true });
      await composePage.waitAndClick('@encrypted-reply', { delay: 1 });
      await clickTripleDotAndExpectQuoteToLoad(composePage, [
        'On 2018-10-03 at 14:47, henry.electrum@gmail.com wrote:',
        '> The following text is bold: this is bold',
        '>',
        '> The following text is red: this text is red'
      ].join('\n'));
    }));

    for (const inputMethod of ['mouse', 'keyboard']) {
      ava.default(`compose - reply - pass phrase dialog - dialog ok (${inputMethod})`, testWithBrowser('compatibility', async (t, browser) => {
        const pp = Config.key('flowcrypt.compatibility.1pp1').passphrase;
        const { inboxPage, replyFrame } = await setRequirePassPhraseAndOpenRepliedMessage(t, browser, pp);
        // Get Passphrase dialog and write confirm passphrase
        await inboxPage.waitAll('@dialog-passphrase');
        const passPhraseFrame = await inboxPage.getFrame(['passphrase.htm']);
        await passPhraseFrame.waitAndType('@input-pass-phrase', pp);
        if (inputMethod === 'mouse') {
          await passPhraseFrame.waitAndClick('@action-confirm-pass-phrase-entry');
        } else if (inputMethod === 'keyboard') {
          await inboxPage.press('Enter');
        }
        await inboxPage.waitTillGone('@dialog');
        // Then we can try to run base test
        await clickTripleDotAndExpectQuoteToLoad(replyFrame, [
          'On 2019-06-14 at 23:24, flowcrypt.compatibility@gmail.com wrote:',
          '> This is some message',
          '>',
          '> and below is the quote',
          '>',
          '> > this is the quote',
          '> > still the quote',
          '> > third line',
          '> >> double quote',
          '> >> again double quote'
        ].join('\n'));
      }));

      ava.default(`compose - reply - pass phrase dialog - dialog cancel (${inputMethod})`, testWithBrowser('compatibility', async (t, browser) => {
        const pp = Config.key('flowcrypt.compatibility.1pp1').passphrase;
        const { inboxPage, replyFrame } = await setRequirePassPhraseAndOpenRepliedMessage(t, browser, pp);
        // Get Passphrase dialog and cancel confirm passphrase
        await inboxPage.waitAll('@dialog-passphrase');
        const passPhraseFrame = await inboxPage.getFrame(['passphrase.htm']);
        if (inputMethod === 'mouse') {
          await passPhraseFrame.waitAndClick('@action-cancel-pass-phrase-entry');
        } else if (inputMethod === 'keyboard') {
          await inboxPage.press('Escape');
        }
        await inboxPage.waitTillGone('@dialog');
        await replyFrame.waitAll(['@action-expand-quoted-text']);
        const inputBody = await replyFrame.read('@input-body');
        expect(inputBody.trim()).to.be.empty;
        await clickTripleDotAndExpectQuoteToLoad(replyFrame, [
          'On 2019-06-14 at 23:24, flowcrypt.compatibility@gmail.com wrote:',
          '> (Skipping previous message quote)'
        ].join('\n'));
      }));
    }

    ava.default('compose - reply - signed message', testWithBrowser('compatibility', async (t, browser) => {
      const appendUrl = 'threadId=15f7f5face7101db&skipClickPrompt=___cu_false___&ignoreDraft=___cu_false___&replyMsgId=15f7f5face7101db';
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', { appendUrl, hasReplyPrompt: true });
      await composePage.notPresent('@action-accept-reply-all-prompt');
      await composePage.waitAndClick('@encrypted-reply', { delay: 1 });
      await composePage.waitAll('@action-send');
      await Util.sleep(0.5);
      expect(await composePage.read('@action-send')).to.eq('Sign and Send');
      await composePage.waitAndClick('@action-show-options-popover');
      await composePage.waitAll(['@action-toggle-sign', '@action-toggle-encrypt', '@icon-toggle-sign-tick']);
      await composePage.notPresent(['@icon-toggle-encrypt-tick']); // response to signed message should not be auto-encrypted
      await ComposePageRecipe.fillMsg(composePage, {}, undefined, {}, 'reply');
      await ComposePageRecipe.sendAndClose(composePage);
    }));

    ava.default('compose - forward - pgp/mime signed-only', testWithBrowser('compatibility', async (t, browser) => {
      const appendUrl = 'threadId=15f7fc2919788f03&skipClickPrompt=___cu_false___&ignoreDraft=___cu_false___&replyMsgId=15f7fc2919788f03';
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', { appendUrl, hasReplyPrompt: true });
      await composePage.waitAndClick('@action-forward');
      await ComposePageRecipe.fillRecipients(composePage, { to: 'human@flowcrypt.com' }, 'forward');
      expect(await composePage.read('@input-body')).to.include('> This message will contain a separately attached file + signature.');
      await composePage.waitAny('.qq-file-id-0');
    }));

    ava.default('compose - standalone- hide/show btns after signing', testWithBrowser('ci.tests.gmail', async (t, browser) => {
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
      await ComposePageRecipe.fillMsg(composePage, { to: 'test.no.pgp@test.com' }, 'Signed Message', { encrypt: false });
      expect(await composePage.isElementPresent('@add-intro')).to.be.true;
      expect(await composePage.isElementPresent('@password-or-pubkey-container')).to.be.true;
      await composePage.notPresent('@add-intro');
      await composePage.notPresent('@password-or-pubkey-container');
    }));

    ava.default('compose - CC&BCC new message', testWithBrowser('ci.tests.gmail', async (t, browser) => {
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
      await ComposePageRecipe.fillMsg(composePage, { to: 'human@flowcrypt.com', cc: 'human@flowcrypt.com', bcc: 'human@flowcrypt.com' }, 'Testing CC And BCC');
      await ComposePageRecipe.sendAndClose(composePage);
    }));

    ava.default('compose - reply - CC&BCC test reply', testWithBrowser('compatibility', async (t, browser) => {
      const appendUrl = 'threadId=16ce2c965c75e5a6&skipClickPrompt=___cu_false___&ignoreDraft=___cu_false___&replyMsgId=16ce2c965c75e5a6';
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', { appendUrl, hasReplyPrompt: true });
      await composePage.waitAndClick('@action-accept-reply-all-prompt', { delay: 2 });
      await ComposePageRecipe.fillMsg(composePage, { bcc: "test@email.com" }, undefined, undefined, 'reply');
      await expectRecipientElements(composePage, { to: ['censored@email.com'], cc: ['censored@email.com'], bcc: ['test@email.com'] });
      await Util.sleep(3);
      await ComposePageRecipe.sendAndClose(composePage, { password: 'test-pass' });
    }));

    ava.default('compose - expired can still send', testWithBrowser('ci.tests.gmail', async (t, browser) => {
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
      await ComposePageRecipe.fillMsg(composePage, { to: 'expired.on.attester@domain.com' }, 'Test Expired Email');
      const expandContainer = await composePage.waitAny('@action-show-container-cc-bcc-buttons');
      const recipient = await expandContainer.$('.email_preview span');
      expect(await PageRecipe.getElementPropertyJson(recipient!, 'className')).to.include('expired');
      await composePage.waitAndClick('@action-send');
      await PageRecipe.waitForModalAndRespond(composePage, 'confirm', { contentToCheck: 'The public key of one of your recipients is expired.', clickOn: 'confirm', timeout: 40 });
      await composePage.waitForSelTestState('closed', 20); // succesfully sent
      await composePage.close();
    }));

    ava.default('compose - loading drafts - new message, rendering cc/bcc and check if cc/bcc btns are hidden',
      testWithBrowser('compatibility', async (t, browser) => {
        const appendUrl = 'draftId=draft-1';
        const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', { appendUrl });
        await expectRecipientElements(composePage, { to: ['flowcryptcompatibility@gmail.com'], cc: ['flowcrypt.compatibility@gmail.com'], bcc: ['human@flowcrypt.com'] });
        const subjectElem = await composePage.waitAny('@input-subject');
        expect(await PageRecipe.getElementPropertyJson(subjectElem, 'value')).to.equal('Test Draft - New Message');
        expect((await composePage.read('@input-body')).trim()).to.equal('Testing Drafts (Do not delete)');
        for (const elem of await composePage.target.$$('.container-cc-bcc-buttons > span')) {
          expect(await PageRecipe.getElementPropertyJson(elem, 'offsetHeight')).to.equal(0); // CC/BCC btn isn't visible
        }
      }));

    ava.default('compose - loading drafts - reply', testWithBrowser('compatibility', async (t, browser) => {
      const appendUrl = 'threadId=16cfa9001baaac0a&skipClickPrompt=___cu_false___&ignoreDraft=___cu_false___&replyMsgId=16cfa9001baaac0a';
      const initialScript = () => {
        chrome.storage.local.set({ 'cryptup_flowcryptcompatibilitygmailcom_drafts_reply': { '16cfa9001baaac0a': 'draft-3' } });
      };
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', { appendUrl, hasReplyPrompt: true, skipClickPropt: true, initialScript });
      await composePage.waitAndClick('@action-show-container-cc-bcc-buttons');
      await expectRecipientElements(composePage, { to: ['flowcryptcompatibility@gmail.com'] });
      expect(await composePage.read('@input-body')).to.include('Test Draft Reply (Do not delete, tests is using this draft)');
    }));

    ava.default('compose - key-mismatch - standalone - key mismatch loading', testWithBrowser('compatibility', async (t, browser) => {
      const params = 'threadId=15f7f5630573be2d&skipClickPrompt=___cu_true___&ignoreDraft=___cu_true___&replyMsgId=15f7f5630573be2d&disableDraftSaving=___cu_true___&replyPubkeyMismatch=___cu_true___';
      const replyMismatchPage = await browser.newPage(t, 'chrome/elements/compose.htm?account_email=flowcrypt.compatibility%40gmail.com&parent_tab_id=0&debug=___cu_true___&frameId=none&' + params);
      await replyMismatchPage.waitForSelTestState('ready');
      await Util.sleep(3);
      await expectRecipientElements(replyMismatchPage, { to: ['censored@email.com'], cc: [], bcc: [] });
      expect(await replyMismatchPage.read('@input-body')).to.include('I was not able to read your encrypted message because it was encrypted for a wrong key.');
      await replyMismatchPage.waitAll('.qq-upload-file');
      await ComposePageRecipe.sendAndClose(replyMismatchPage);
    }));

    ava.default('compose - reply all - TO/CC/BCC when replying all', testWithBrowser('compatibility', async (t, browser) => {
      const appendUrl = `threadId=16d6a6c2d6ae618f&skipClickPrompt=___cu_false___&ignoreDraft=___cu_false___&replyMsgId=16d6a6c2d6ae618f`;
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', { appendUrl, hasReplyPrompt: true });
      await composePage.waitAndClick('@action-accept-reply-all-prompt');
      await composePage.waitForSelTestState('ready'); // continue when all recipients get evaluated
      await composePage.waitAndClick('@action-show-container-cc-bcc-buttons');
      for (const type of ['to', 'cc', 'bcc']) {
        const container = (await composePage.waitAny(`@container-${type}`))!;
        const recipients = await container.$$('.recipients > span');
        expect(recipients.length).to.equal(2);
        for (const recipient of recipients) {
          const textContent = await PageRecipe.getElementPropertyJson(recipient, 'textContent');
          expect(textContent.trim()).to.include('@flowcrypt.com');
        }
      }
    }));

    ava.default('compose - send new plain message', testWithBrowser('ci.tests.gmail', async (t, browser) => {
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
      await ComposePageRecipe.fillMsg(composePage, { to: 'human@flowcrypt.com' }, 'New Plain Message', { encrypt: false, sign: false });
      await ComposePageRecipe.sendAndClose(composePage);
    }));

    ava.default('compose - reply - signed message with attachment - can be downloaded after send', testWithBrowser('compatibility', async (t, browser) => {
      const appendUrl = 'threadId=15f7f5face7101db&skipClickPrompt=___cu_false___&ignoreDraft=___cu_false___&replyMsgId=15f7f5face7101db';
      const attachmentFilename = 'small.txt';
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', { appendUrl, hasReplyPrompt: true });
      await composePage.waitAndClick('@encrypted-reply', { delay: 1 });
      await composePage.waitAll('@action-send');
      await Util.sleep(0.5);
      expect(await composePage.read('@action-send')).to.eq('Sign and Send');
      await composePage.waitAndClick('@action-show-options-popover');
      await composePage.waitAll(['@action-toggle-sign', '@action-toggle-encrypt', '@icon-toggle-sign-tick']);
      await composePage.notPresent(['@icon-toggle-encrypt-tick']); // response to signed message should not be auto-encrypted
      const fileInput = await composePage.target.$('input[type=file]');
      await fileInput!.uploadFile(`test/samples/${attachmentFilename}`);
      await composePage.waitAndClick('@action-send', { delay: 1 });
      const attachment = await composePage.getFrame(['attachment.htm', `name=${attachmentFilename}`]);
      await attachment.waitForSelTestState('ready');
      const fileText = await composePage.awaitDownloadTriggeredByClicking(async () => {
        await attachment.click('#download');
      });
      expect(fileText.toString()).to.equal(`small text file\nnot much here\nthis worked\n`);
      await composePage.close();
    }));

    ava.default('compose - send btn should be disabled while encrypting/sending', testWithBrowser('ci.tests.gmail', async (t, browser) => {
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
      await ComposePageRecipe.fillMsg(composePage, { to: 'human@flowcrypt.com' }, '');
      await composePage.waitAndClick('@action-send', { delay: 1 });
      expect(await composePage.isDisabled('#send_btn')).to.be.true;
      await composePage.waitAndRespondToModal('confirm', 'cancel', 'Send without a subject?');
      expect(await composePage.isDisabled('#send_btn')).to.be.false;
    }));

    ava.default('compose - load contacts through API', testWithBrowser('ci.tests.gmail', async (t, browser) => {
      let composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
      await composePage.waitAndClick('@action-show-container-cc-bcc-buttons');
      await composePage.type('@input-to', 'contact');
      if (testVariant === 'CONSUMER-MOCK') {
        // consumer does not get Contacts scope automatically (may scare users when they install)
        // first search, did not yet receive contacts scope - should find no contacts
        await expectContactsResultEqual(composePage, ['No Contacts Found']);
        // allow contacts scope, and expect that it will find a contact
        const oauthPopup = await browser.newPageTriggeredBy(t, () => composePage.waitAndClick('@action-auth-with-contacts-scope'));
        await OauthPageRecipe.google(t, oauthPopup, 'ci.tests.gmail@flowcrypt.test', 'approve');
      }
      await expectContactsResultEqual(composePage, ['contact.test@flowcrypt.com']);
      // re-load the compose window, expect that it remembers scope was connected, and remembers the contact
      composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
      await composePage.waitAndClick('@action-show-container-cc-bcc-buttons');
      await composePage.type('@input-to', 'contact');
      await expectContactsResultEqual(composePage, ['contact.test@flowcrypt.com']);
      await composePage.notPresent('@action-auth-with-contacts-scope');
    }));

    ava.default('compose - load contacts - contacts should be properly ordered', testWithBrowser('ci.tests.gmail', async (t, browser) => {
      const inboxPage = await browser.newPage(t, TestUrls.extensionInbox('ci.tests.gmail@flowcrypt.test'));
      let composeFrame = await InboxPageRecipe.openAndGetComposeFrame(inboxPage);
      await composeFrame.type('@input-to', 'testsearchorder');
      if (testVariant === 'CONSUMER-MOCK') {
        // allow contacts scope, and expect that it will find contacts
        const oauthPopup = await browser.newPageTriggeredBy(t, () => composeFrame.waitAndClick('@action-auth-with-contacts-scope'));
        await OauthPageRecipe.google(t, oauthPopup, 'ci.tests.gmail@flowcrypt.test', 'approve');
      }
      await expectContactsResultEqual(composeFrame, [
        'testsearchorder1@flowcrypt.com',
        'testsearchorder2@flowcrypt.com',
        'testsearchorder3@flowcrypt.com',
        'testsearchorder4@flowcrypt.com',
        'testsearchorder5@flowcrypt.com',
        'testsearchorder6@flowcrypt.com',
        'testsearchorder7@flowcrypt.com',
        'testsearchorder8@flowcrypt.com',
      ]);
      await composeFrame.waitAndClick('@action-close-new-message');
      await inboxPage.waitTillGone('@container-new-message');
      // add key + send
      composeFrame = await InboxPageRecipe.openAndGetComposeFrame(inboxPage);
      await ComposePageRecipe.fillMsg(composeFrame, { to: 'testsearchorder3@flowcrypt.com' }, t.title);
      await pastePublicKeyManually(composeFrame, inboxPage, 'testsearchorder3@flowcrypt.com', testConstants.smimeCert);
      await composeFrame.waitAndClick('@action-send', { delay: 1 });
      await composeFrame.waitAndClick('.swal2-cancel');
      await composeFrame.waitAndClick('@action-close-new-message');
      await inboxPage.waitTillGone('@container-new-message');
      // add key
      composeFrame = await InboxPageRecipe.openAndGetComposeFrame(inboxPage);
      await ComposePageRecipe.fillMsg(composeFrame, { to: 'testsearchorder9@flowcrypt.com' }, t.title);
      await pastePublicKeyManually(composeFrame, inboxPage, 'testsearchorder9@flowcrypt.com', testConstants.smimeCert);
      await composeFrame.waitAndClick('@action-close-new-message');
      await inboxPage.waitTillGone('@container-new-message');
      // send
      composeFrame = await InboxPageRecipe.openAndGetComposeFrame(inboxPage);
      await ComposePageRecipe.fillMsg(composeFrame, { to: 'testsearchorder5@flowcrypt.com' }, t.title);
      await composeFrame.waitAndType('@input-password', 'test-pass');
      await composeFrame.waitAndClick('@action-send', { delay: 1 });
      await composeFrame.waitAndClick('.swal2-cancel');
      await composeFrame.waitAndClick('@action-close-new-message');
      await inboxPage.waitTillGone('@container-new-message');
      // check that contacts are ordered according to hasPgp and lastUse
      composeFrame = await InboxPageRecipe.openAndGetComposeFrame(inboxPage);
      await composeFrame.type('@input-to', 'testsearchorder');
      await expectContactsResultEqual(composeFrame, [
        'testsearchorder3@flowcrypt.com', // hasPgp + lastUse
        'testsearchorder9@flowcrypt.com', // hasPgp
        'testsearchorder5@flowcrypt.com', // lastUse
        'testsearchorder1@flowcrypt.com',
        'testsearchorder2@flowcrypt.com',
        'testsearchorder4@flowcrypt.com',
        'testsearchorder6@flowcrypt.com',
        'testsearchorder7@flowcrypt.com',
      ]);
    }));

    ava.default('compose - delete recipients with keyboard', testWithBrowser('compatibility', async (t, browser) => {
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility');
      await ComposePageRecipe.fillRecipients(composePage, { to: 'human1@flowcrypt.com' }, 'new');
      await composePage.waitAndType(`@input-to`, 'human2@flowcrypt.com');
      await composePage.press('Enter');
      await composePage.waitAndType(`@input-to`, 'human3@flowcrypt.com');
      await composePage.press('Enter');
      await expectRecipientElements(composePage, { to: ['human1@flowcrypt.com', 'human2@flowcrypt.com', 'human3@flowcrypt.com'] });
      // delete recipient with Backspace when #input_to is focued
      await composePage.press('Backspace');
      await expectRecipientElements(composePage, { to: ['human1@flowcrypt.com', 'human2@flowcrypt.com'] });
      // delete recipient with Delete when it's focused
      await composePage.waitAndFocus('@recipient_0');
      await composePage.press('Delete');
      await expectRecipientElements(composePage, { to: ['human2@flowcrypt.com'] });
      // delete recipient with Backspace when it's focused
      await composePage.waitAndFocus('@recipient_1');
      await composePage.press('Backspace');
      await expectRecipientElements(composePage, { to: [] });
    }));

    ava.default('compose - new message, open footer', testWithBrowser('compatibility', async (t, browser) => {
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility');
      await ComposePageRecipe.fillRecipients(composePage, { to: 'human@flowcrypt.com' }, 'new');
      await composePage.waitAndClick(`@action-send`);
      expect(await composePage.read('.swal2-html-container')).to.include('Send without a subject?');
      await composePage.waitAndClick('.swal2-cancel');
      await composePage.waitAndType('@input-subject', 'Testing new message with footer', { delay: 1 });
      await composePage.waitAndClick(`@action-send`);
      expect(await composePage.read('#swal2-html-container')).to.include('Send empty message?');
      await composePage.waitAndClick('.swal2-cancel');
      await composePage.waitAndClick('@action-expand-quoted-text', { delay: 1 });
      const footer = await composePage.read('@input-body');
      expect(footer).to.eq('\n\n\n--\nflowcrypt.compatibility test footer with an img');
      await composePage.waitAndClick(`@action-send`);
      expect(await composePage.read('#swal2-html-container')).to.include('Send empty message?');
      await composePage.waitAndClick('.swal2-cancel');
      await composePage.waitAndType('@input-body', 'New message\n' + footer, { delay: 1 });
      await ComposePageRecipe.sendAndClose(composePage);
    }));

    ava.default('compose - new message, Footer Mock Test', testWithBrowser('compatibility', async (t, browser) => {
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility');
      await ComposePageRecipe.fillMsg(composePage, { to: 'human@flowcrypt.com' }, 'Test Footer (Mock Test)', {}, 'new');
      await ComposePageRecipe.sendAndClose(composePage);
    }));

    ava.default('compose - loading drafts - test tags in draft', testWithBrowser('compatibility', async (t, browser) => {
      const appendUrl = 'draftId=draft-0';
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', { appendUrl });
      expect(await composePage.read('@input-body')).to.include('hello<draft>here');
    }));

    ava.default('compose - compose - test minimizing/maximizing', testWithBrowser('ci.tests.gmail', async (t, browser) => {
      const inboxPage = await browser.newPage(t, 'chrome/settings/inbox/inbox.htm?acctEmail=ci.tests.gmail%40flowcrypt.test');
      await inboxPage.waitAndClick('@action-open-secure-compose-window');
      await inboxPage.waitAll(['@container-new-message']);
      const composeFrame = await inboxPage.getFrame(['compose.htm']);
      await composeFrame.waitForSelTestState('ready');
      const composeBody = await composeFrame.waitAny('body');
      const initialWidth = Number(await PageRecipe.getElementPropertyJson(composeBody, 'offsetWidth'));
      const initialHeight = Number(await PageRecipe.getElementPropertyJson(composeBody, 'offsetHeight'));
      await composeFrame.waitAndClick('.popout', { sleepWhenDone: 1 });
      expect(Number(await PageRecipe.getElementPropertyJson(composeBody, 'offsetWidth'))).to.be.greaterThan(initialWidth, 'popout width greater than initial');
      expect(Number(await PageRecipe.getElementPropertyJson(composeBody, 'offsetHeight'))).to.be.greaterThan(initialHeight, 'popout weight greater than initial');
      await composeFrame.waitAndClick('.popout', { sleepWhenDone: 1 });
      expect(Number(await PageRecipe.getElementPropertyJson(composeBody, 'offsetWidth'))).to.equal(initialWidth, 'width back to initial');
      expect(Number(await PageRecipe.getElementPropertyJson(composeBody, 'offsetHeight'))).to.equal(initialHeight, 'height back to initial');
      await composeFrame.waitAndClick('.minimize_new_message', { sleepWhenDone: 1 });
      expect(Number(await PageRecipe.getElementPropertyJson(composeBody, 'offsetHeight'))).to.be.lessThan(initialHeight, 'minimized lower than initial');
      await composeFrame.waitAndClick('.minimize_new_message', { sleepWhenDone: 1 });
      expect(Number(await PageRecipe.getElementPropertyJson(composeBody, 'offsetHeight'))).to.equal(initialHeight, 'back to initial after un-minimizing');
    }));

    ava.default('compose - saving and rendering a draft with image', testWithBrowser('compatibility', async (t, browser) => {
      const imgBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAAnElEQVR42u3RAQ0AAAgDIE1u9FvDOahAVzLFGS1ECEKEIEQIQoQgRIgQIQgRghAhCBGCECEIQYgQhAhBiBCECEEIQoQgRAhChCBECEIQIgQhQhAiBCFCEIIQIQgRghAhCBGCEIQIQYgQhAhBiBCEIEQIQoQgRAhChCAEIUIQIgQhQhAiBCEIEYIQIQgRghAhCBEiRAhChCBECEK+W3uw+TnWoJc/AAAAAElFTkSuQmCC';
      let composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility');
      const subject = `saving and rendering a draft with image ${Util.lousyRandom()}`;
      await ComposePageRecipe.fillMsg(composePage, { to: 'human@flowcrypt.com' }, subject, { 'richtext': true });
      await composePage.page.evaluate((src: string) => { $('[data-test=action-insert-image]').val(src).click(); }, imgBase64);
      await ComposePageRecipe.waitWhenDraftIsSaved(composePage);
      await composePage.close();
      composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', { appendUrl: 'draftId=draft_with_image' });
      const body = await composePage.waitAny('@input-body');
      await composePage.waitAll('#input_text img');
      expect(await body.$eval('#input_text img', el => el.getAttribute('src'))).to.eq(imgBase64);
    }));

    ava.default('compose - saving and rendering a draft when offline', testWithBrowser('compatibility', async (t, browser) => {
      let composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility');
      await (composePage.target as Page).setOfflineMode(true); // go offline mode
      await ComposePageRecipe.fillMsg(composePage, { to: 'human@flowcrypt.com' }, 'offline test', {});
      expect(await composePage.read('@action-send')).to.eq('Re-enter recipient..'); // ensure offline mode
      await composePage.type('@input-body', `This is a test of saving a draft when offline`);
      await ComposePageRecipe.waitWhenDraftIsSavedLocally(composePage);
      await composePage.close();
      composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility');
      expect(await composePage.value('@input-subject')).to.match(/offline test/);
      await composePage.waitForContent('@input-body', 'This is a test of saving a draft when offline');
    }));

    ava.default('compose - RTL subject', testWithBrowser('compatibility', async (t, browser) => {
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility');
      await composePage.type('@input-subject', 'ش');
      expect(await composePage.attr('@input-subject', 'dir')).to.eq('rtl');
      await composePage.press('Backspace');
      expect(await composePage.attr('@input-subject', 'dir')).to.be.null;
      await composePage.type('@input-subject', 'a');
      expect(await composePage.attr('@input-subject', 'dir')).to.be.null;
    }));

    ava.default('compose - saving and rendering a draft with RTL text (plain text)', testWithBrowser('compatibility', async (t, browser) => {
      let composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility');
      const subject = `مرحبا RTL plain text`;
      await ComposePageRecipe.fillMsg(composePage, { to: 'human@flowcrypt.com' }, subject, { richtext: false });
      await ComposePageRecipe.waitWhenDraftIsSaved(composePage);
      await composePage.close();
      composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', { appendUrl: 'draftId=draft_with_rtl_text_plain' });
      expect(await composePage.attr('@input-subject', 'dir')).to.eq('rtl');
      expect(await composePage.readHtml('@input-body')).to.include('<div dir="rtl">مرحبا<br></div>');
    }));

    ava.default('compose - saving and rendering a draft with RTL text (rich text)', testWithBrowser('compatibility', async (t, browser) => {
      let composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility');
      const subject = `مرحبا RTL rich text`;
      await ComposePageRecipe.fillMsg(composePage, { to: 'human@flowcrypt.com' }, subject, { richtext: true });
      await ComposePageRecipe.waitWhenDraftIsSaved(composePage);
      await composePage.close();
      composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', { appendUrl: 'draftId=draft_with_rtl_text_rich' });
      expect(await composePage.readHtml('@input-body')).to.include('<div dir="rtl">مرحبا<br></div>');
    }));

    ava.default('compose - sending and rendering encrypted message with image', testWithBrowser('compatibility', async (t, browser) => {
      await sendImgAndVerifyPresentInSentMsg(t, browser, 'encrypt');
    }));

    ava.default('compose - sending and rendering signed message with image', testWithBrowser('compatibility', async (t, browser) => {
      await sendImgAndVerifyPresentInSentMsg(t, browser, 'sign');
    }));

    ava.default('compose - sending and rendering plain message with image', testWithBrowser('compatibility', async (t, browser) => {
      await sendImgAndVerifyPresentInSentMsg(t, browser, 'plain');
    }));

    ava.default('compose - sending and rendering message with U+10000 code points', testWithBrowser('compatibility', async (t, browser) => {
      const rainbow = '\ud83c\udf08';
      await sendTextAndVerifyPresentInSentMsg(t, browser, rainbow, { sign: true, encrypt: false });
      await sendTextAndVerifyPresentInSentMsg(t, browser, rainbow, { sign: false, encrypt: true });
      await sendTextAndVerifyPresentInSentMsg(t, browser, rainbow, { sign: true, encrypt: true });
    }));

    ava.default('compose - sent message should\'t have version and comment based on OrgRules', testWithBrowser(undefined, async (t, browser) => {
      const acct = 'has.pub@org-rules-test.flowcrypt.test';
      const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acct);
      await SetupPageRecipe.manualEnter(settingsPage, 'has.pub.orgrulestest', { noPrvCreateOrgRule: true, enforceAttesterSubmitOrgRule: true });
      const subject = `Test Sending Message With Test Text and HIDE_ARMOR_META OrgRule ${Util.lousyRandom()}`;
      const composePage = await ComposePageRecipe.openStandalone(t, browser, acct);
      await ComposePageRecipe.fillMsg(composePage, { to: 'human@flowcrypt.com' }, subject, { sign: true });
      await composePage.waitAndType('@input-body', 'any text', { delay: 1 });
      await ComposePageRecipe.sendAndClose(composePage);
      // get sent msg from mock
      const sentMsg = (await GoogleData.withInitializedData(acct)).getMessageBySubject(subject)!;
      const message = sentMsg.payload!.body!.data!;
      expect(message).to.include('-----BEGIN PGP MESSAGE-----');
      expect(message).to.include('-----END PGP MESSAGE-----');
      expect(message).to.not.include('Version');
      expect(message).to.not.include('Comment');
    }));

    ava.default.skip('oversize attachment does not get erroneously added', testWithBrowser('ci.tests.gmail', async (t, browser) => {
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
      // big file will get canceled
      const fileInput = await composePage.target.$('input[type=file]');
      const localpath = 'test/samples/oversize.txt';
      await writeFileSync(localpath, 'x'.repeat(30 * 1024 * 1024));
      await fileInput!.uploadFile(localpath); // 30mb
      await composePage.waitAndRespondToModal('confirm', 'cancel', 'Combined attachment size is limited to 25 MB. The last file brings it to 30 MB.');
      await Util.sleep(1);
      await composePage.notPresent('.qq-upload-file-selector');
      // small file will get accepted
      await fileInput!.uploadFile('test/samples/small.png');
      await composePage.waitForContent('.qq-upload-file-selector', 'small.png');
    }));

    ava.default('rendered reply - can preview attachment', testWithBrowser('ci.tests.gmail', async (t, browser) => {
      const threadId = '173fd7dbe2fec90c';
      const acctEmail = 'ci.tests.gmail@flowcrypt.test';
      const inboxPage = await browser.newPage(t, TestUrls.extension(`chrome/settings/inbox/inbox.htm?acctEmail=${acctEmail}&threadId=${threadId}`));
      await inboxPage.waitAll('iframe');
      const replyFrame = await inboxPage.getFrame(['compose.htm']);
      await replyFrame.waitAndClick('@encrypted-reply');
      const fileInput = await replyFrame.target.$('input[type=file]');
      await fileInput!.uploadFile('test/samples/small.png');
      await replyFrame.waitAndClick('@action-send');
      const attachment = await replyFrame.getFrame(['attachment.htm', 'name=small.png']);
      await attachment.waitForSelTestState('ready');
      await attachment.click('body');
      const attachmentPreviewImage = await inboxPage.getFrame(['attachment_preview.htm']);
      await attachmentPreviewImage.waitAll('#attachment-preview-container img.attachment-preview-img');
    }));

    ava.default('attachments - failed to decrypt', testWithBrowser('compatibility', async (t, browser) => {
      const inboxPage = await browser.newPage(t, TestUrls.extension(`chrome/settings/inbox/inbox.htm?acctEmail=flowcrypt.compatibility@gmail.com&threadId=162ec58d70fe04ef`));
      const attachment = await inboxPage.getFrame(['attachment.htm']);
      await attachment.waitAndClick('@download-attachment');
      await attachment.waitAndClick('@decrypt-error-details');
      const decryptErrorDetails = await inboxPage.getFrame(['attachment_preview.htm']);
      await decryptErrorDetails.waitForContent('@error-details', 'Error: Session key decryption failed'); // stack
      await decryptErrorDetails.waitForContent('@error-details', '"type": "key_mismatch"'); // DecryptError
    }));

    ava.default('can lookup public key from FlowCrypt Email Key Manager', testWithBrowser(undefined, async (t, browser) => {
      const acct = 'get.key@key-manager-autogen.flowcrypt.test';
      const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acct);
      await SetupPageRecipe.autoKeygen(settingsPage);
      const composePage = await ComposePageRecipe.openStandalone(t, browser, acct);
      await ComposePageRecipe.fillMsg(composePage, { to: 'find.public.key@key-manager-autogen.flowcrypt.test' }, 'should find pubkey from key manager');
      await composePage.waitForContent('.email_address.has_pgp', 'find.public.key@key-manager-autogen.flowcrypt.test');
      expect(await composePage.attr('.email_address.has_pgp', 'title')).to.contain('00B0 1158 0796 9D75');
    }));

    ava.default('can lookup public key from WKD directly', testWithBrowser('ci.tests.gmail', async (t, browser) => {
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
      await ComposePageRecipe.fillMsg(composePage, { to: 'test-wkd@metacode.biz' }, 'should find pubkey from WKD directly');
      await composePage.waitForContent('.email_address.has_pgp', 'test-wkd@metacode.biz');
      expect(await composePage.attr('.email_address.has_pgp', 'title')).to.contain('5B7A BE66 0D5C 62A6 07FE 2448 716B 1776 4E3F CACA');
    }));

    ava.default('timeouts when searching WKD - used to never time out', testWithBrowser('ci.tests.gmail', async (t, browser) => {
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
      await ComposePageRecipe.fillMsg(composePage, { to: 'somewhere@mac.com' }, 'should show no pubkey within a few seconds');
      await composePage.waitForContent('.email_address.no_pgp', 'somewhere@mac.com');
      await composePage.waitAll('@input-password');
    }));

    ava.todo('compose - reply - new gmail threadId fmt');

    ava.todo('compose - reply - skip click prompt');

    ava.default('send with single S/MIME cert', testWithBrowser('ci.tests.gmail', async (t, browser) => {
      const inboxPage = await browser.newPage(t, TestUrls.extensionInbox('ci.tests.gmail@flowcrypt.test'));
      const composeFrame = await InboxPageRecipe.openAndGetComposeFrame(inboxPage);
      await ComposePageRecipe.fillMsg(composeFrame, { to: 'smime@recipient.com' }, t.title);
      await pastePublicKeyManually(composeFrame, inboxPage, 'smime@recipient.com', testConstants.smimeCert);
      await composeFrame.waitAndClick('@action-send', { delay: 2 });
      await inboxPage.waitTillGone('@container-new-message');
    }));

    ava.default('send with several S/MIME certs', testWithBrowser('ci.tests.gmail', async (t, browser) => {
      const inboxPage = await browser.newPage(t, TestUrls.extensionInbox('ci.tests.gmail@flowcrypt.test'));
      const composeFrame = await InboxPageRecipe.openAndGetComposeFrame(inboxPage);
      await ComposePageRecipe.fillMsg(composeFrame, { to: 'smime1@recipient.com', cc: 'smime2@recipient.com' }, t.title);
      await pastePublicKeyManually(composeFrame, inboxPage, 'smime1@recipient.com', testConstants.smimeCert);
      await pastePublicKeyManually(composeFrame, inboxPage, 'smime2@recipient.com', testConstants.smimeCert);
      await composeFrame.waitAndClick('@action-send', { delay: 2 });
      await inboxPage.waitTillGone('@container-new-message');
    }));

    ava.default('send with S/MIME attachment', testWithBrowser('ci.tests.gmail', async (t, browser) => {
      // todo - this is not yet looking for actual attachment in the result, just checks that it's s/mime message
      const inboxPage = await browser.newPage(t, TestUrls.extensionInbox('ci.tests.gmail@flowcrypt.test'));
      const composeFrame = await InboxPageRecipe.openAndGetComposeFrame(inboxPage);
      await ComposePageRecipe.fillMsg(composeFrame, { to: 'smime.attachment@recipient.com' }, t.title);
      await pastePublicKeyManually(composeFrame, inboxPage, 'smime.attachment@recipient.com', testConstants.smimeCert);
      const fileInput = await composeFrame.target.$('input[type=file]');
      await fileInput!.uploadFile('test/samples/small.txt', 'test/samples/small.png', 'test/samples/small.pdf');
      await composeFrame.waitAndClick('@action-send', { delay: 2 });
      await inboxPage.waitTillGone('@container-new-message');
    }));

    ava.default('send with mixed S/MIME and PGP recipients - should show err', testWithBrowser('ci.tests.gmail', async (t, browser) => {
      const inboxPage = await browser.newPage(t, TestUrls.extensionInbox('ci.tests.gmail@flowcrypt.test'));
      const composeFrame = await InboxPageRecipe.openAndGetComposeFrame(inboxPage);
      await ComposePageRecipe.fillMsg(composeFrame, { to: 'smime@recipient.com', cc: 'human@flowcrypt.com' }, t.title);
      await pastePublicKeyManually(composeFrame, inboxPage, 'smime@recipient.com', testConstants.smimeCert);
      await composeFrame.waitAndClick('@action-send', { delay: 2 });
      await PageRecipe.waitForModalAndRespond(composeFrame, 'error', {
        contentToCheck: 'Failed to send message due to: Error: Cannot use mixed OpenPGP (human@flowcrypt.com) and S/MIME (smime@recipient.com) public keys yet.If you need to email S/MIME recipient, do not add any OpenPGP recipient at the same time.',
        timeout: 40
      });
    }));

    ava.default('send with broken S/MIME cert - err', testWithBrowser('ci.tests.gmail', async (t, browser) => {
      const inboxPage = await browser.newPage(t, TestUrls.extensionInbox('ci.tests.gmail@flowcrypt.test'));
      const composeFrame = await InboxPageRecipe.openAndGetComposeFrame(inboxPage);
      await ComposePageRecipe.fillMsg(composeFrame, { to: 'smime@recipient.com' }, t.title);
      const brokenCert = testConstants.smimeCert.split('\n');
      brokenCert.splice(5, 5); // remove 5th to 10th line from cert - make it useless
      const addPubkeyDialog = await pastePublicKeyManuallyNoClose(composeFrame, inboxPage, 'smime@recipient.com', brokenCert.join('\n'));
      await addPubkeyDialog.waitAndRespondToModal('error', 'confirm', 'Too few bytes to read ASN.1 value.');
    }));

    ava.default('send non-S/MIME cert - err', testWithBrowser('ci.tests.gmail', async (t, browser) => {
      const inboxPage = await browser.newPage(t, TestUrls.extensionInbox('ci.tests.gmail@flowcrypt.test'));
      const composeFrame = await InboxPageRecipe.openAndGetComposeFrame(inboxPage);
      await ComposePageRecipe.fillMsg(composeFrame, { to: 'smime@recipient.com' }, t.title);
      const httpsCert = '-----BEGIN CERTIFICATE-----\nMIIFZTCCBE2gAwIBAgISA/LOLnFAcrNSDjMi+PvkSbX1MA0GCSqGSIb3DQEBCwUA\nMEoxCzAJBgNVBAYTAlVTMRYwFAYDVQQKEw1MZXQncyBFbmNyeXB0MSMwIQYDVQQD\nExpMZXQncyBFbmNyeXB0IEF1dGhvcml0eSBYMzAeFw0yMDAzMTQxNTQ0NTVaFw0y\nMDA2MTIxNTQ0NTVaMBgxFjAUBgNVBAMTDWZsb3djcnlwdC5jb20wggEiMA0GCSqG\nSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDBYeT+zyJK4VrAtpBoxnzNrgPMkeJ3WBw3\nlZrO7GXsPUUQL/2uL3NfMwQ4qWqsiJStShaTQ0UX1MQCBgdOY/Ajr5xgyCz4aE0+\nQeReGy+qFyoGE9okVdF+/uJhFTOkK8goA4rDRN3MrSuWsivc/5/8Htd/M01JFAcU\nEblrPkSBtJp8IAtr+QD8etmMd05N0oQFNFT/T7QNrEdItCKSS6jMpprR4phr792K\niQh9MzhZ3O+QEM+UKpsL0dM9C6PD9jNFjFz3EDch/VFPbBlcBfWGvYnjBlqKjhYA\nLPUVPgIF4CVQ60EoOHk1ewyoAyydYyFXppUz1eDvemUhLMWuBJ2tAgMBAAGjggJ1\nMIICcTAOBgNVHQ8BAf8EBAMCBaAwHQYDVR0lBBYwFAYIKwYBBQUHAwEGCCsGAQUF\nBwMCMAwGA1UdEwEB/wQCMAAwHQYDVR0OBBYEFMr4ERxBRtKNI67oIkJHN2QSBptE\nMB8GA1UdIwQYMBaAFKhKamMEfd265tE5t6ZFZe/zqOyhMG8GCCsGAQUFBwEBBGMw\nYTAuBggrBgEFBQcwAYYiaHR0cDovL29jc3AuaW50LXgzLmxldHNlbmNyeXB0Lm9y\nZzAvBggrBgEFBQcwAoYjaHR0cDovL2NlcnQuaW50LXgzLmxldHNlbmNyeXB0Lm9y\nZy8wKQYDVR0RBCIwIIIPKi5mbG93Y3J5cHQuY29tgg1mbG93Y3J5cHQuY29tMEwG\nA1UdIARFMEMwCAYGZ4EMAQIBMDcGCysGAQQBgt8TAQEBMCgwJgYIKwYBBQUHAgEW\nGmh0dHA6Ly9jcHMubGV0c2VuY3J5cHQub3JnMIIBBgYKKwYBBAHWeQIEAgSB9wSB\n9ADyAHcAb1N2rDHwMRnYmQCkURX/dxUcEdkCwQApBo2yCJo32RMAAAFw2e8sLwAA\nBAMASDBGAiEA7Omcf4+uFphcbEq19r4GoWi7E1qvsJTykvgH342x1d4CIQDSCJZK\n3zsVSw8I1GVfnIr/drVhgn4TJgacXx6+gBzfXQB3ALIeBcyLos2KIE6HZvkruYol\nIGdr2vpw57JJUy3vi5BeAAABcNnvK/kAAAQDAEgwRgIhAP7BbIkG/mNclZAVqgA0\nomAB/6xMwbu1ZUsHNBMkZG+QAiEAmZWCVdUfmFs3b+zDEaAF7eFDnz7qbDa5q6M0\n98r8In0wDQYJKoZIhvcNAQELBQADggEBAFaUhUkxGkHc3lxozCbozM7ffAOcK5De\nJGoTtsXw/XmMACBIIqn2Aan+zvQdK/cWV9+dYu5tA/PHZwVbfKAU2x+Fizs7uDgs\nslg16un1/DP7bmi4Ih3KDVyznzgTwWPq9CmPMIeCXBSGvGN4xdfyIf7mKPSmsEB3\ngkM8HyE27e2u8B4f/R4W+sbqx0h5Y/Kv6NFqgQlatEY2HdAQDYYL21xO1ZjaUozP\nyfHQSJwGHp3/1Xdq5mIkV7w9xxhOn64FXp4S0spVCxT3er1EEUurq+lXjyeX4Dog\n1gy3r417NPqQWuBJcA/InSaS/GUyGghp+kuGfIDqVYfQqU1297nThEA=\n-----END CERTIFICATE-----\n';
      const addPubkeyDialog = await pastePublicKeyManuallyNoClose(composeFrame, inboxPage, 'smime@recipient.com', httpsCert);
      await addPubkeyDialog.waitAndRespondToModal('error', 'confirm', 'This S/MIME x.509 certificate has an invalid recipient email: flowcrypt.com');
    }));

    ava.default('cannot import expired key in secure compose', testWithBrowser('ci.tests.gmail', async (t, browser) => {
      const inboxPage = await browser.newPage(t, TestUrls.extensionInbox('ci.tests.gmail@flowcrypt.test'));
      const to = 'nopgp@recipient.com';
      const composeFrame = await InboxPageRecipe.openAndGetComposeFrame(inboxPage);
      await ComposePageRecipe.fillMsg(composeFrame, { to }, t.title);
      const expiredPubkey = '-----BEGIN PGP PUBLIC KEY BLOCK-----\r\nVersion: FlowCrypt Email Encryption 7.8.4\r\nComment: Seamlessly send and receive encrypted email\r\n\r\nxsBNBF8QJFgBCACdPi2i6uflsgNVvSw20eVaqOwEgwRAu1wrwB+s3UxFxsnE\r\nXBiJ6tvQU+NzNFLWjT5FwyTz8PM2lDnXz/j6nQGft+l/01l349u0L4WhTEES\r\nByPTOA1Wbs4YRbef1+T6tKklN8CKH93tBKRFTZXsMv0nLuEMmyxNgYHvNsnB\r\nGXlGQrrsJ5qVr10YZh+dXo8Ir4mXXE5tCrVH/AzDBK/cBZcUbBD7gmvnt+HF\r\nvuJYMRQ46/NR84S57Dwm5ZzER0PMQfnLYyjdKE4DEVtL84WVhGVqNhBqy1Z6\r\nl/wvSHnBvrXe1Vdm2YXT0pIahe9wJmrA2dixA8c+SczICn+QZAkBsAZRABEB\r\nAAHNKTxoYXMub2xkZXIua2V5Lm9uLmF0dGVzdGVyQHJlY2lwaWVudC5jb20+\r\nwsCTBBABCAAmBQJfECRYBQkAAAACBgsJBwgDAgQVCAoCBBYCAQACGQECGwMC\r\nHgEAIQkQHmLtbRWiWSEWIQSOx48EPOsCJJiv1HceYu1tFaJZIQewCACYWDJ5\r\n3sbGDvIwRlPiAQqTp4IvjrvLC+unX4OVyaqXPcTbCWkjjUcZci2aO5V59J+I\r\nfHkI7PVwheuEk4HjNBiPvSOy8BbwiGXYxkQX4Z4QZkcf6wCvd3rtwyICzhNh\r\njsehA4uaYStr0k0pxzHMWhpDeppzVL+yVnCoftiW9+9MuTFQ2ynQhBYp57yA\r\n6LGn9X91L7ACZvWMstBwTNkT2N2Vw7ngCnacweIj0LMje2wt6cKO1IMm0U4Q\r\nEkag9pqTf1DnyC/dkw7GB6kT5lP9wAdZNxtIgJwHQNidH+0gfJlTQ31LQp5T\r\njFa6LU+7XK8sprZG27TjQX9w7NVyYbkib3mGzsBNBF8QJFgBCACnVXFdNoKA\r\nTHN6W7ewu8CDaDEOxrUGckrTFSOLN0hkLrlrHRZg4/N0gZf/TdUynGJ6fkXq\r\n5ZDZWiPujAyjeTHhoUb3Oc0O9voX3TLRROduDxW6UAeurzXAiL/25qOp1TRr\r\nFhvllleg+fcZDNjPct4zyUxUW6NzWkHJ+XvNxq2fTH82n0RfPTyRoee/ymuR\r\nexRU4vfYF8XNo+aEDx00rwQFpl8ot20Qus6vKejo0SIyr0bS4oHBB3sYHrxt\r\nkfHLwiSfE27eW2pogta6JcH7w+OLGadoGxqGs1cYpbVhteDRUQ4nTov3JWt5\r\nVoNlXiaBdV3vRF52Q+UuUwylsbcplDeDABEBAAHCwHwEGAEIAA8FAl8QJFgF\r\nCQAAAAICGwwAIQkQHmLtbRWiWSEWIQSOx48EPOsCJJiv1HceYu1tFaJZIcYi\r\nB/wNq0UOV3d1aaFtx2ie2CYX5f7o9/emyN7HomW53DBXSAlj98R0MnKrUadU\r\noIXkUnJlGIyU9NjzWWZsdPMrlaU/tCvceO/wvc2K/pqjiQKjtfiA/mR+0dGf\r\ncVskq2WOiAfEuOcTAdrYmLeTs5r6RJueTb3qxUN7a9OWru+avuyJ7lDiOiNC\r\nMnhQ8xZy1zREApD1weSz9JEUOTkcNYFm/dm08g0QfKneqi5/ZvNmRlKNW/Nf\r\n9DCM/jCp1Nb33yNTC9n3HW8qMOd4pPfajDEtGivqi5aQGaZ+AbT6RTR4jD8q\r\n7GiOeV7wDbZXG0MYLM9kqW7znnDTAGHWvTw+HanlU23+\r\n=KVqr\r\n-----END PGP PUBLIC KEY BLOCK-----\r\n';
      const addPubkeyDialog = await pastePublicKeyManuallyNoClose(composeFrame, inboxPage, to, expiredPubkey);
      await addPubkeyDialog.waitAndRespondToModal('warning', 'confirm', 'This public key is correctly formatted, but it cannot be used for encryption because it expired on 2020-07-16 09:56.');
    }));

    ava.default('auto-refresh expired key if newer version of the same key available', testWithBrowser('ci.tests.gmail', async (t, browser) => {
      const expiredPublicKey = '-----BEGIN PGP PUBLIC KEY BLOCK-----\r\nVersion: FlowCrypt Email Encryption 7.8.4\r\nComment: Seamlessly send and receive encrypted email\r\n\r\nxsBNBF8PcdUBCADi8no6T4Bd9Ny5COpbheBuPWEyDOedT2EVeaPrfutB1D8i\r\nCP6Rf1cUvs/qNUX/O7HQHFpgFuW2uOY4OU5cvcrwmNpOxT3pPt2cavxJMdJo\r\nfwEvloY3OfY7MCqdAj5VUcFGMhubfV810V2n5pf2FFUNTirksT6muhviMymy\r\nuWZLdh0F4WxrXEon7k3y2dZ3mI4xsG+Djttb6hj3gNr8/zNQQnTmVjB0mmpO\r\nFcGUQLTTTYMngvVMkz8/sh38trqkVGuf/M81gkbr1egnfKfGz/4NT3qQLjin\r\nnA8In2cSFS/MipIV14gTfHQAICFIMsWuW/xkaXUqygvAnyFa2nAQdgELABEB\r\nAAHNKDxhdXRvLnJlZnJlc2guZXhwaXJlZC5rZXlAcmVjaXBpZW50LmNvbT7C\r\nwJMEEAEIACYFAl8PcdUFCQAAAAEGCwkHCAMCBBUICgIEFgIBAAIZAQIbAwIe\r\nAQAhCRC+46QtmpyKyRYhBG0+CYZ1RO5ify6Sj77jpC2anIrJIvQIALG8TGMN\r\nYB4CRouMJawNCLui6Fx4Ba1ipPTaqlJPybLoe6z/WVZwAA9CmbjkCIk683pp\r\nmGQ3GXv7f8Sdk7DqhEhfZ7JtAK/Uw2VZqqIryNrrB0WV3EUHsENCOlq0YJod\r\nLqtkqgl83lCNDIkeoQwq4IyrgC8wsPgF7YMpxxQLONJvChZxSdCDjnfX3kvO\r\nZsLYFiKnNlX6wyrKAQxWnxxYhglMf0GDDyh0AJ+vOQHJ9m+oeBnA1tJ5AZU5\r\naQHvRtyWBKkYaEhljhyWr3eu1JjK4mn7/W6Rszveso33987wtIoQ66GpGcX2\r\nmh7y217y/uXz4D3X5PUEBXIbhvAPty71bnTOwE0EXw9x1QEIALdJgAsQ0Jnv\r\nLXwAKoOammWlUQmracK89v1Yc4mFnImtHDHS3pGsbx3DbNGuiz5BhXCdoPDf\r\ngMxlGmJgShy9JAhrhWFXkvsjW/7aO4bM1wU486VPKXb7Av/dcrfHH0ASj4zj\r\n/TYAeubNoxQtxHgyb13LVCW1kh4Oe6s0ac/hKtxogwEvNFY3x+4yfloHH0Ik\r\n9sbLGk0gS03bPABDHMpYk346406f5TuP6UDzb9M90i2cFxbq26svyBzBZ0vY\r\nzfMRuNsm6an0+B/wS6NLYBqsRyxwwCTdrhYS512yBzCHDYJJX0o3OJNe85/0\r\nTqEBO1prgkh3QMfw13/Oxq8PuMsyJpUAEQEAAcLAfAQYAQgADwUCXw9x1QUJ\r\nAAAAAQIbDAAhCRC+46QtmpyKyRYhBG0+CYZ1RO5ify6Sj77jpC2anIrJARgH\r\n/1KV7JBOS2ZEtO95FrLYnIqI45rRpvT1XArpBPrYLuHtDBwgMcmpiMhhKIZC\r\nFlZkR1W88ENdSkr8Nx81nW+f9JWRR6HuSyom7kOfS2Gdbfwo3bgp48DWr7K8\r\nKV/HHGuqLqd8UfPyDpsBGNx0w7tRo+8vqUbhskquLAIahYCbhEIE8zgy0fBV\r\nhXKFe1FjuFUoW29iEm0tZWX0k2PT5r1owEgDe0g/X1AXgSQyfPRFVDwE3QNJ\r\n1np/Rmygq1C+DIW2cohJOc7tO4gbl11XolsfQ+FU+HewYXy8aAEbrTSRfsff\r\nMvK6tgT9BZ3kzjOxT5ou2SdvTa0eUk8k+zv8OnJJfXA=\r\n=LPeQ\r\n-----END PGP PUBLIC KEY BLOCK-----\r\n';
      const recipientEmail = 'auto.refresh.expired.key@recipient.com';
      // add an expired key manually
      const settingsPage = await browser.newPage(t, TestUrls.extensionSettings('ci.tests.gmail@flowcrypt.test'));
      await SettingsPageRecipe.toggleScreen(settingsPage, 'additional');
      const contactsFrame = await SettingsPageRecipe.awaitNewPageFrame(settingsPage, '@action-open-contacts-page', ['contacts.htm', 'placement=settings']);
      await contactsFrame.waitAll('@page-contacts');
      await contactsFrame.waitAndClick('@action-show-import-public-keys-form', { confirmGone: true });
      await contactsFrame.waitAndType('@input-bulk-public-keys', expiredPublicKey);
      await contactsFrame.waitAndClick('@action-show-parsed-public-keys', { confirmGone: true });
      await contactsFrame.waitAll('iframe');
      const pubkeyFrame = await contactsFrame.getFrame(['pgp_pubkey.htm']);
      await pubkeyFrame.waitForContent('@action-add-contact', 'IMPORT EXPIRED KEY');
      await pubkeyFrame.waitAndClick('@action-add-contact');
      await pubkeyFrame.waitForContent('@container-pgp-pubkey', `${recipientEmail} added`);
      await contactsFrame.waitAndClick('@action-back-to-contact-list', { confirmGone: true });
      await contactsFrame.waitAndClick(`@action-show-pubkey-${recipientEmail.replace(/[^a-z0-9]+/g, '')}`, { confirmGone: true });
      await contactsFrame.waitForContent('@container-pubkey-details', 'Type: openpgp');
      await contactsFrame.waitForContent('@container-pubkey-details', 'Fingerprint: 6D3E 0986 7544 EE62 7F2E 928F BEE3 A42D 9A9C 8AC9');
      await contactsFrame.waitForContent('@container-pubkey-details', `Users: ${recipientEmail}`);
      await contactsFrame.waitForContent('@container-pubkey-details', 'Created on: Wed Jul 15 2020 21:15:01');
      await contactsFrame.waitForContent('@container-pubkey-details', 'Expiration: Wed Jul 15 2020 21:15:02');
      await contactsFrame.waitForContent('@container-pubkey-details', 'Expired: yes');
      await contactsFrame.waitForContent('@container-pubkey-details', 'Usable for encryption: false');
      await contactsFrame.waitForContent('@container-pubkey-details', 'Usable for signing: false');
      // now we want to see that compose page auto-fetches an updated one
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
      await ComposePageRecipe.fillMsg(composePage, { to: recipientEmail }, t.title);
      const expandContainer = await composePage.waitAny('@action-show-container-cc-bcc-buttons');
      const recipient = await expandContainer.$('.email_preview span');
      expect(await PageRecipe.getElementPropertyJson(recipient!, 'className')).to.not.include('expired'); // because auto-reloaded
      await ComposePageRecipe.sendAndClose(composePage);
      // make sure that the contact itself got updated
      await contactsFrame.waitAndClick('@action-back-to-contact-list', { confirmGone: true });
      await contactsFrame.waitAndClick(`@action-show-pubkey-${recipientEmail.replace(/[^a-z0-9]+/g, '')}`, { confirmGone: true });
      await contactsFrame.waitForContent('@container-pubkey-details', 'Expired: no');
      await contactsFrame.waitForContent('@container-pubkey-details', 'Usable for encryption: true');
      await contactsFrame.waitForContent('@container-pubkey-details', 'Expiration: Does not expire');
    }));

    ava.default('expired key will turn green when manually updated in different window', testWithBrowser('ci.tests.gmail', async (t, browser) => {
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
      const recipientEmail = 'expired.on.attester@domain.com';
      await ComposePageRecipe.fillMsg(composePage, { to: recipientEmail }, t.title);
      await composePage.waitForContent('.email_address.expired', recipientEmail);
      // now open a pubkey frame and update the pubkey
      const pubkeyFrameUrl = `chrome/elements/pgp_pubkey.htm?frameId=none&armoredPubkey=${encodeURIComponent(somePubkey)}&acctEmail=flowcrypt.compatibility%40gmail.com&parentTabId=0`;
      const pubkeyFrame = await browser.newPage(t, pubkeyFrameUrl);
      await pubkeyFrame.waitAndType('.input_email', recipientEmail);
      await pubkeyFrame.waitForContent('@action-add-contact', 'UPDATE KEY');
      await pubkeyFrame.waitAndClick('@action-add-contact');
      await pubkeyFrame.waitForContent('@container-pgp-pubkey', `${recipientEmail} added`);
      await Util.sleep(1);
      await pubkeyFrame.close();
      await composePage.waitForContent('.email_address.has_pgp:not(.expired)', recipientEmail);
    }));

    ava.default('do not auto-refresh key if older version of the same key available on attester', testWithBrowser('ci.tests.gmail', async (t, browser) => {
      const newerExpiredKey = '-----BEGIN PGP PUBLIC KEY BLOCK-----\r\nVersion: FlowCrypt Email Encryption 7.8.4\r\nComment: Seamlessly send and receive encrypted email\r\n\r\nxsBNBF8QJFgBCACdPi2i6uflsgNVvSw20eVaqOwEgwRAu1wrwB+s3UxFxsnE\r\nXBiJ6tvQU+NzNFLWjT5FwyTz8PM2lDnXz/j6nQGft+l/01l349u0L4WhTEES\r\nByPTOA1Wbs4YRbef1+T6tKklN8CKH93tBKRFTZXsMv0nLuEMmyxNgYHvNsnB\r\nGXlGQrrsJ5qVr10YZh+dXo8Ir4mXXE5tCrVH/AzDBK/cBZcUbBD7gmvnt+HF\r\nvuJYMRQ46/NR84S57Dwm5ZzER0PMQfnLYyjdKE4DEVtL84WVhGVqNhBqy1Z6\r\nl/wvSHnBvrXe1Vdm2YXT0pIahe9wJmrA2dixA8c+SczICn+QZAkBsAZRABEB\r\nAAHNKTxoYXMub2xkZXIua2V5Lm9uLmF0dGVzdGVyQHJlY2lwaWVudC5jb20+\r\nwsCTBBABCAAmBQJfECR2BQkAAAA8BgsJBwgDAgQVCAoCBBYCAQACGQECGwMC\r\nHgEAIQkQHmLtbRWiWSEWIQSOx48EPOsCJJiv1HceYu1tFaJZIZ4CB/4hCFJw\r\nustsTLQNCBJMAoBtjGPDohnsaMImmDPw8P1TyIidDlgnKqpzBhF29X0LiJIf\r\n5EUDiWMb3O5j+jXOR7kF1UJkj64eW5/GOuN+O15CIRLRWCEJ3mv3H9b/Bzgt\r\njzWg1qf4c8GIaU+R4nJKbrvoX8GT2mnntLnTCDxZvSb9vfgBNXLleeI33xvX\r\nEHtOnb1zYb9SH6YKWRKAYD7zihPdIDnbbgUMTAahHGjZqPm0R/MoBK0ra1QY\r\njJA9SZIWInTjDQimfbsMbFXwyufVwBYoEn6qZuRFBts/8/gd83l51fu+JfO8\r\nG90LSQQUGJXwsAa/CaDUI6WlN1Xyv3+D+avUzsBNBF8QJFgBCACnVXFdNoKA\r\nTHN6W7ewu8CDaDEOxrUGckrTFSOLN0hkLrlrHRZg4/N0gZf/TdUynGJ6fkXq\r\n5ZDZWiPujAyjeTHhoUb3Oc0O9voX3TLRROduDxW6UAeurzXAiL/25qOp1TRr\r\nFhvllleg+fcZDNjPct4zyUxUW6NzWkHJ+XvNxq2fTH82n0RfPTyRoee/ymuR\r\nexRU4vfYF8XNo+aEDx00rwQFpl8ot20Qus6vKejo0SIyr0bS4oHBB3sYHrxt\r\nkfHLwiSfE27eW2pogta6JcH7w+OLGadoGxqGs1cYpbVhteDRUQ4nTov3JWt5\r\nVoNlXiaBdV3vRF52Q+UuUwylsbcplDeDABEBAAHCwHwEGAEIAA8FAl8QJHYF\r\nCQAAADwCGwwAIQkQHmLtbRWiWSEWIQSOx48EPOsCJJiv1HceYu1tFaJZIQ2b\r\nCACYF7lF3mnvgduu0l5USNRsu7ZkkgK0qKvUaoyPvD80bg/kze7XP+Eg3Bad\r\n6kakLW/jZhQO5S4qDPLhjLLhsbdXWBcoKctfLAYLfBE5mQfC7sU5ufQ615JM\r\njcomkXMxStmcTzulV49H9U0AfKOuO9TYKYudm+iMXz3b5aVY4Db4SBChr+t8\r\nFhsuaDOcy4mCstA4HJjhVDWuGoUSwxbxUOyYb8YioxHi+CgRWnuf/chGEPHv\r\nmp+d37nWzm561RPm8+YfLI+Ps/OcsYogXm/RZNirn08XSaCuRBwwIiDasHTi\r\nlTjK+SO789oXkNajtP6A8FbrkF6HlNBgpaYB10Y4qfW5\r\n=aZpf\r\n-----END PGP PUBLIC KEY BLOCK-----\r\n';
      const recipientEmail = 'has.older.key.on.attester@recipient.com';
      // add a newer expired key manually
      const settingsPage = await browser.newPage(t, TestUrls.extensionSettings('ci.tests.gmail@flowcrypt.test'));
      await SettingsPageRecipe.toggleScreen(settingsPage, 'additional');
      const contactsFrame = await SettingsPageRecipe.awaitNewPageFrame(settingsPage, '@action-open-contacts-page', ['contacts.htm', 'placement=settings']);
      await contactsFrame.waitAll('@page-contacts');
      await contactsFrame.waitAndClick('@action-show-import-public-keys-form', { confirmGone: true });
      await contactsFrame.waitAndType('@input-bulk-public-keys', newerExpiredKey);
      await contactsFrame.waitAndClick('@action-show-parsed-public-keys', { confirmGone: true });
      await contactsFrame.waitAll('iframe');
      const pubkeyFrame = await contactsFrame.getFrame(['pgp_pubkey.htm']);
      await pubkeyFrame.waitForContent('@action-add-contact', 'IMPORT EXPIRED KEY');
      await pubkeyFrame.waitAndClick('@action-add-contact');
      await pubkeyFrame.waitForContent('@container-pgp-pubkey', `${recipientEmail} added`);
      await contactsFrame.waitAndClick('@action-back-to-contact-list', { confirmGone: true });
      await contactsFrame.waitAndClick(`@action-show-pubkey-${recipientEmail.replace(/[^a-z0-9]+/g, '')}`, { confirmGone: true });
      await contactsFrame.waitForContent('@container-pubkey-details', 'Type: openpgp');
      await contactsFrame.waitForContent('@container-pubkey-details', 'Fingerprint: 8EC7 8F04 3CEB 0224 98AF D477 1E62 ED6D 15A2 5921');
      await contactsFrame.waitForContent('@container-pubkey-details', `Users: ${recipientEmail}`);
      await contactsFrame.waitForContent('@container-pubkey-details', 'Created on: Thu Jul 16 2020 09:56:40');
      await contactsFrame.waitForContent('@container-pubkey-details', 'Expiration: Thu Jul 16 2020 09:57:40');
      await contactsFrame.waitForContent('@container-pubkey-details', 'Last signature: Thu Jul 16 2020 09:57:10');
      await contactsFrame.waitForContent('@container-pubkey-details', 'Expired: yes');
      await contactsFrame.waitForContent('@container-pubkey-details', 'Usable for encryption: false');
      await contactsFrame.waitForContent('@container-pubkey-details', 'Usable for signing: false');
      // now we want to see that compose page auto-fetches an updated one
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
      await ComposePageRecipe.fillMsg(composePage, { to: recipientEmail }, t.title);
      const expandContainer = await composePage.waitAny('@action-show-container-cc-bcc-buttons');
      const recipient = await expandContainer.$('.email_preview span');
      expect(await PageRecipe.getElementPropertyJson(recipient!, 'className')).to.include('expired');
      await composePage.close();
      // make sure that the contact itself did NOT get updated, because the one on Attester is an older key
      await contactsFrame.waitAndClick('@action-back-to-contact-list', { confirmGone: true });
      await contactsFrame.waitAndClick(`@action-show-pubkey-${recipientEmail.replace(/[^a-z0-9]+/g, '')}`, { confirmGone: true });
      await contactsFrame.waitForContent('@container-pubkey-details', 'Fingerprint: 8EC7 8F04 3CEB 0224 98AF D477 1E62 ED6D 15A2 5921');
      await contactsFrame.waitForContent('@container-pubkey-details', 'Created on: Thu Jul 16 2020 09:56:40');
      await contactsFrame.waitForContent('@container-pubkey-details', 'Expiration: Thu Jul 16 2020 09:57:40');
      await contactsFrame.waitForContent('@container-pubkey-details', 'Expired: yes');
    }));

    ava.default('import S/MIME cert', testWithBrowser('ci.tests.gmail', async (t, browser) => {
      // the cert since expired, therefore test was updated to reflect that
      const recipientEmail = 'actalis@meta.33mail.com';
      // add S/MIME key manually
      const settingsPage = await browser.newPage(t, TestUrls.extensionSettings('ci.tests.gmail@flowcrypt.test'));
      await SettingsPageRecipe.toggleScreen(settingsPage, 'additional');
      const contactsFrame = await SettingsPageRecipe.awaitNewPageFrame(settingsPage, '@action-open-contacts-page', ['contacts.htm', 'placement=settings']);
      await contactsFrame.waitAll('@page-contacts');
      await contactsFrame.waitAndClick('@action-show-import-public-keys-form', { confirmGone: true });
      await contactsFrame.waitAndType('@input-bulk-public-keys', testConstants.smimeCert);
      await contactsFrame.waitAndClick('@action-show-parsed-public-keys', { confirmGone: true });
      await contactsFrame.waitAll('iframe');
      const pubkeyFrame = await contactsFrame.getFrame(['pgp_pubkey.htm']);
      await pubkeyFrame.waitForContent('@action-add-contact', 'IMPORT EXPIRED KEY');
      await pubkeyFrame.waitAndClick('@action-add-contact');
      await pubkeyFrame.waitForContent('@container-pgp-pubkey', `${recipientEmail} added`);
      await contactsFrame.waitAndClick('@action-back-to-contact-list', { confirmGone: true });
      await contactsFrame.waitAndClick(`@action-show-pubkey-${recipientEmail.replace(/[^a-z0-9]+/g, '')}`, { confirmGone: true });
      await contactsFrame.waitForContent('@container-pubkey-details', 'Type: x509');
      await contactsFrame.waitForContent('@container-pubkey-details', 'Fingerprint: 16BB 4074 03A3 ADC5 5E1E 0E4A F93E EC8F B187 C923');
      await contactsFrame.waitForContent('@container-pubkey-details', `Users: ${recipientEmail}`);
      await contactsFrame.waitForContent('@container-pubkey-details', 'Created on: Mon Mar 23 2020');
      await contactsFrame.waitForContent('@container-pubkey-details', 'Expiration: Tue Mar 23 2021');
      await contactsFrame.waitForContent('@container-pubkey-details', 'Expired: yes');
      await contactsFrame.waitForContent('@container-pubkey-details', 'Usable for encryption: true');
      await contactsFrame.waitForContent('@container-pubkey-details', 'Usable for signing: true');
    }));

    ava.default('compose - reply - CC&BCC test forward', testWithBrowser('compatibility', async (t, browser) => {
      const appendUrl = 'threadId=16ce2c965c75e5a6&skipClickPrompt=___cu_false___&ignoreDraft=___cu_false___&replyMsgId=16ce2c965c75e5a6';
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', { appendUrl, hasReplyPrompt: true });
      await composePage.waitAndClick('@action-forward', { delay: 2 });
      await composePage.waitAny('@input-to');
      await composePage.waitUntilFocused('@input-to');
      await expectRecipientElements(composePage, { to: [], cc: [], bcc: [] });
    }));

  }

};

const pastePublicKeyManuallyNoClose = async (composeFrame: ControllableFrame, inboxPage: ControllablePage, recipient: string, pub: string) => {
  await Util.sleep(1); // todo: should wait until recipient actually loaded
  await composeFrame.waitForContent('.email_address.no_pgp', recipient);
  await composeFrame.waitAndClick('@action-open-add-pubkey-dialog', { delay: 1 });
  await inboxPage.waitAll('@dialog-add-pubkey');
  const addPubkeyDialog = await inboxPage.getFrame(['add_pubkey.htm']);
  await addPubkeyDialog.waitAndType('@input-pubkey', pub);
  await Util.sleep(1);
  await addPubkeyDialog.waitAndClick('@action-add-pubkey');
  return addPubkeyDialog;
};

const pastePublicKeyManually = async (composeFrame: ControllableFrame, inboxPage: ControllablePage, recipient: string, pub: string) => {
  await pastePublicKeyManuallyNoClose(composeFrame, inboxPage, recipient, pub);
  await inboxPage.waitTillGone('@dialog-add-pubkey');
};

const sendImgAndVerifyPresentInSentMsg = async (t: AvaContext, browser: BrowserHandle, sendingType: 'encrypt' | 'sign' | 'plain') => {
  // send a message with image in it
  const imgBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAAnElEQVR42u3RAQ0AAAgDIE1u9FvDOahAVzLFGS1ECEKEIEQIQoQgRIgQIQgRghAhCBGCECEIQYgQhAhBiBCECEEIQoQgRAhChCBECEIQIgQhQhAiBCFCEIIQIQgRghAhCBGCEIQIQYgQhAhBiBCEIEQIQoQgRAhChCAEIUIQIgQhQhAiBCEIEYIQIQgRghAhCBEiRAhChCBECEK+W3uw+TnWoJc/AAAAAElFTkSuQmCC';
  const sendingTypeForHumans = sendingType === 'encrypt' ? 'Encrypted' : (sendingType === 'sign' ? 'Signed' : 'Plain');
  const subject = `Test Sending ${sendingTypeForHumans} Message With Image ${Util.lousyRandom()}`;
  const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility');
  await ComposePageRecipe.fillMsg(composePage, { to: 'human@flowcrypt.com' }, subject, { richtext: true, sign: sendingType === 'sign', encrypt: sendingType === 'encrypt' });
  // the following is a temporary hack - currently not able to directly paste an image with puppeteer
  // instead we should find a way to load the image into clipboard, and paste it into textbox
  await composePage.page.evaluate((src: string) => { $('[data-test=action-insert-image]').val(src).click(); }, imgBase64);
  await ComposePageRecipe.sendAndClose(composePage);
  // get sent msg id from mock
  const sentMsg = (await GoogleData.withInitializedData('flowcrypt.compatibility@gmail.com')).getMessageBySubject(subject)!;
  if (sendingType === 'plain') {
    expect(sentMsg.payload?.body?.data).to.match(/<img src="cid:(.+)@flowcrypt">This is an automated puppeteer test: Test Sending Plain Message With Image/);
    return;
    // todo - this test case is a stop-gap. We need to implement rendering of such messages below,
    //   then let test plain messages with images in them (referenced by cid) just like other types of messages below
  }
  let url = `chrome/dev/ci_pgp_host_page.htm?frameId=none&msgId=${encodeURIComponent(sentMsg.id)}&senderEmail=flowcrypt.compatibility%40gmail.com&isOutgoing=___cu_false___&acctEmail=flowcrypt.compatibility%40gmail.com`;
  if (sendingType === 'sign') {
    url += '&signature=___cu_true___';
  }
  // open a page with the sent msg, investigate img
  const pgpHostPage = await browser.newPage(t, url);
  const pgpBlockPage = await pgpHostPage.getFrame(['pgp_block.htm']);
  await pgpBlockPage.waitAll('.image_src_link');
  expect(await pgpBlockPage.read('.image_src_link')).to.contain('show image');
  await pgpBlockPage.waitAndClick('.image_src_link');
  await pgpBlockPage.waitTillGone('.image_src_link');
  const img = await pgpBlockPage.waitAny('body img');
  expect(await PageRecipe.getElementPropertyJson(img, 'src')).to.eq(imgBase64);
};

const sendTextAndVerifyPresentInSentMsg = async (t: AvaContext,
  browser: BrowserHandle,
  text: string,
  sendingOpt: { encrypt?: boolean, sign?: boolean, richtext?: boolean } = {}
) => {
  const subject = `Test Sending ${sendingOpt.sign ? 'Signed' : ''} ${sendingOpt.encrypt ? 'Encrypted' : ''} Message With Test Text ${text} ${Util.lousyRandom()}`;
  const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility');
  await ComposePageRecipe.fillMsg(composePage, { to: 'human@flowcrypt.com' }, subject, sendingOpt);
  await composePage.waitAndType('@input-body', text, { delay: 1 });
  expect(await composePage.read('@input-body')).to.include(text);
  await ComposePageRecipe.sendAndClose(composePage);
  // get sent msg from mock
  const sentMsg = (await GoogleData.withInitializedData('flowcrypt.compatibility@gmail.com')).getMessageBySubject(subject)!;
  const message = encodeURIComponent(sentMsg.payload!.body!.data!);
  await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, {
    content: [text],
    unexpectedContent: [],
    params: `?frameId=none&msgId=${encodeURIComponent(sentMsg.id)}&senderEmail=flowcrypt.compatibility%40gmail.com&isOutgoing=___cu_false___&acctEmail=flowcrypt.compatibility%40gmail.com&message=${message}`
  });
};

const setRequirePassPhraseAndOpenRepliedMessage = async (t: AvaContext, browser: BrowserHandle, passpharase: string) => {
  const settingsPage = await browser.newPage(t, TestUrls.extensionSettings());
  await SettingsPageRecipe.forgetAllPassPhrasesInStorage(settingsPage, passpharase);
  // Open Message Page
  const inboxPage = await browser.newPage(t, TestUrls.extension(`chrome/settings/inbox/inbox.htm?acctEmail=flowcrypt.compatibility@gmail.com&threadId=16b584ed95837510`));
  await inboxPage.waitAll('iframe');
  // Get Reply Window (Composer) and click on reply button.
  const replyFrame = await inboxPage.getFrame(['compose.htm']);
  await replyFrame.waitAndClick('@encrypted-reply');

  return { inboxPage, replyFrame };
};

const clickTripleDotAndExpectQuoteToLoad = async (composePage: Controllable, textToInclude: string) => {
  await composePage.waitAll(['@action-expand-quoted-text']);
  await Util.sleep(2); // wait for quote to be loaded and button activated
  expect(await composePage.read('@input-body')).to.not.include(textToInclude);
  await composePage.waitAndClick('@action-expand-quoted-text');
  await composePage.waitTillGone(['@action-expand-quoted-text']);
  expect(await composePage.read('@input-body')).to.include(textToInclude);
};

export const expectRecipientElements = async (controllable: ControllablePage, expected: { to?: string[], cc?: string[], bcc?: string[] }) => {
  for (const type of ['to', 'cc', 'bcc']) {
    const expectedEmails: string[] | undefined = (expected as Dict<string[]>)[type] || undefined; // tslint:disable-line:no-unsafe-any
    if (expectedEmails) {
      const container = await controllable.waitAny(`@container-${type}`, { visible: false });
      const recipientElements = await container.$$('.recipients > span');
      expect(recipientElements.length).to.equal(expectedEmails.length);
      for (const recipientElement of recipientElements) {
        const textContent = await PageRecipe.getElementPropertyJson(recipientElement, 'textContent');
        expect(expectedEmails).to.include(textContent.trim());
      }
    }
  }
};

const expectContactsResultEqual = async (composePage: ControllablePage | ControllableFrame, emails: string[]) => {
  await composePage.waitAny('@container-contacts');
  await Util.sleep(0.5);
  await composePage.waitTillGone('@container-contacts-loading');
  await Util.sleep(0.5);
  const contacts = await composePage.waitAny('@container-contacts');
  const contactsList = await contacts.$$('li');
  for (const index in contactsList) { // tslint:disable-line:forin
    expect(await PageRecipe.getElementPropertyJson(contactsList[index], 'textContent')).to.equal(emails[index]);
  }
};
