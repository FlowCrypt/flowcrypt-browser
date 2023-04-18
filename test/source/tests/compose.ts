/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import test from 'ava';

import { BrowserHandle, Controllable, ControllableFrame, ControllablePage } from './../browser';
import { Config, Util } from './../util';
import { writeFileSync } from 'fs';
import { AvaContext } from './tooling';
import { ComposePageRecipe } from './page-recipe/compose-page-recipe';
import { Dict, EmailParts } from './../core/common';
import { GoogleData } from './../mock/google/google-data';
import { InboxPageRecipe } from './page-recipe/inbox-page-recipe';
import { OauthPageRecipe } from './page-recipe/oauth-page-recipe';
import { PageRecipe } from './page-recipe/abstract-page-recipe';
import { SettingsPageRecipe } from './page-recipe/settings-page-recipe';
import { TestVariant } from './../util';
import { TestWithBrowser } from './../test';
import { expect } from 'chai';
import { BrowserRecipe } from './tooling/browser-recipe';
import { SetupPageRecipe } from './page-recipe/setup-page-recipe';
import { testConstants } from './tooling/consts';
import { MsgUtil } from '../core/crypto/pgp/msg-util';
import { PubkeyInfoWithLastCheck } from '../core/crypto/key';
import { ElementHandle, Page } from 'puppeteer';
import { ConfigurationProvider, Status } from '../mock/lib/api';
import {
  expiredPubkey,
  hasPubKey,
  newerVersionOfExpiredPubkey,
  protonMailCompatKey,
  somePubkey,
  testMatchPubKey,
} from '../mock/attester/attester-key-constants';

export const defineComposeTests = (testVariant: TestVariant, testWithBrowser: TestWithBrowser) => {
  if (testVariant !== 'CONSUMER-LIVE-GMAIL') {
    test(
      'compose - send an encrypted message to a legacy pwd recipient and a pubkey recipient',
      testWithBrowser(async (t, browser) => {
        const acct = 'flowcrypt.compatibility@gmail.com';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'compatibility');
        const msgPwd = 'super hard password for the message';
        const subject = 'PWD and pubkey encrypted messages with flowcrypt.com/shared-tenant-fes';
        const expectedNumberOfPassedMessages = (await GoogleData.withInitializedData(acct)).searchMessagesBySubject(subject).length + 2;
        const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility');
        await ComposePageRecipe.selectFromOption(composePage, acct);
        await ComposePageRecipe.fillMsg(composePage, { to: 'test@email.com', cc: 'flowcrypt.compatibility@gmail.com' }, subject);
        await ComposePageRecipe.sendAndClose(composePage, { password: msgPwd });
        expect((await GoogleData.withInitializedData(acct)).searchMessagesBySubject(subject).length).to.equal(expectedNumberOfPassedMessages);
        // this test is using PwdAndPubkeyEncryptedMessagesWithFlowCryptComApiTestStrategy to check sent result based on subject "PWD and pubkey encrypted messages with flowcrypt.com/shared-tenant-fes"
      })
    );

    test(
      'compose - check for sender [flowcrypt.compatibility@gmail.com] from a password-protected email',
      testWithBrowser(async (t, browser) => {
        const senderEmail = 'flowcrypt.compatibility@gmail.com';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [senderEmail]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'compatibility');
        const msgPwd = 'super hard password for the message';
        const subject = 'PWD encrypted message with flowcrypt.com/shared-tenant-fes';
        const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility');
        await ComposePageRecipe.selectFromOption(composePage, senderEmail);
        await ComposePageRecipe.fillMsg(composePage, { to: 'test@email.com' }, subject);
        await ComposePageRecipe.sendAndClose(composePage, { password: msgPwd });
        // this test is using PwdEncryptedMessageWithFlowCryptComApiTestStrategy to check sent result based on subject "PWD encrypted message with flowcrypt.com/shared-tenant-fes"
      })
    );

    test(
      'compose - check for sender [flowcryptcompatibility@gmail.com] (alias) from a password-protected email',
      testWithBrowser(async (t, browser) => {
        const senderEmail = 'flowcrypt.compatibility@gmail.com';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              'flowcrypt.compatibility@gmail.com': {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'compatibility');
        const msgPwd = 'super hard password for the message';
        const subject = 'PWD encrypted message with flowcrypt.com/shared-tenant-fes';
        const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility');
        await ComposePageRecipe.selectFromOption(composePage, senderEmail);
        await ComposePageRecipe.fillMsg(composePage, { to: 'test@email.com' }, subject);
        await ComposePageRecipe.sendAndClose(composePage, { password: msgPwd });
        // this test is using PwdEncryptedMessageWithFlowCryptComApiTestStrategy to check sent result based on subject "PWD encrypted message with flowcrypt.com/shared-tenant-fes"
      })
    );

    test(
      'compose - check for sender [ci.tests.gmail@flowcrypt.test] from a password-protected email',
      testWithBrowser(async (t, browser) => {
        const senderEmail = 'ci.tests.gmail@flowcrypt.test';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [senderEmail]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
        const msgPwd = 'super hard password for the message';
        const subject = 'PWD encrypted message with flowcrypt.com/shared-tenant-fes';
        const composePage = await ComposePageRecipe.openStandalone(t, browser, senderEmail);
        await ComposePageRecipe.fillMsg(composePage, { to: 'test@email.com' }, subject);
        await ComposePageRecipe.sendAndClose(composePage, { password: msgPwd });
        // this test is using PwdEncryptedMessageWithFlowCryptComApiTestStrategy to check sent result based on subject "PWD encrypted message with flowcrypt.com/shared-tenant-fes"
      })
    );

    test(
      'compose - restore compose window size by clicking its header',
      testWithBrowser(async (t, browser) => {
        const acct = 'flowcrypt.compatibility@gmail.com';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'compatibility');
        const inboxPage = await browser.newExtensionInboxPage(t, 'flowcrypt.compatibility@gmail.com');
        const composeFrame = await InboxPageRecipe.openAndGetComposeFrame(inboxPage);
        const initialComposeFrameHeight = await inboxPage.getOuterHeight('iframe');
        await composeFrame.waitAll('#section_header');
        const composeFrameHeaderHeight = await composeFrame.getOuterHeight('#section_header');
        await composeFrame.waitAndClick('.minimize_compose_window');
        expect(await inboxPage.getOuterHeight('iframe')).to.eq(composeFrameHeaderHeight, 'compose box height failed to collapse');
        // restore compose frame by clicking the header
        await composeFrame.waitAndClick('@header-title');
        expect(await inboxPage.getOuterHeight('iframe')).to.eq(initialComposeFrameHeight);
      })
    );

    test(
      'compose - trying to send PWD encrypted message with pass phrase - should show err',
      testWithBrowser(async (t, browser) => {
        const acctEmail = 'ci.tests.gmail@flowcrypt.test';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acctEmail]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
        const msgPwd = Config.key('ci.tests.gmail').passphrase;
        const subject = 'PWD encrypted message with flowcrypt.com/shared-tenant-fes';
        const composePage = await ComposePageRecipe.openStandalone(t, browser, acctEmail);
        await ComposePageRecipe.fillMsg(composePage, { to: 'test@email.com' }, subject);
        await composePage.waitAndType('@input-password', msgPwd);
        await composePage.waitAndClick('@action-send', { delay: 1 });
        await PageRecipe.waitForModalAndRespond(composePage, 'error', {
          contentToCheck: 'Please do not use your private key pass phrase as a password for this message',
          clickOn: 'confirm',
        });
        // changing case should result in this error too
        await composePage.waitAndType('@input-password', msgPwd.toUpperCase());
        await composePage.waitAndClick('@action-send', { delay: 1 });
        await PageRecipe.waitForModalAndRespond(composePage, 'error', {
          contentToCheck: 'Please do not use your private key pass phrase as a password for this message',
          clickOn: 'confirm',
        });
        const forgottenPassphrase = 'this passphrase is forgotten';
        await SettingsPageRecipe.addKeyTest(t, browser, acctEmail, testConstants.testKeyMultipleSmimeCEA2D53BB9D24871, forgottenPassphrase, {}, false);
        const inboxPage = await browser.newExtensionInboxPage(t, acctEmail);
        await InboxPageRecipe.finishSessionOnInboxPage(inboxPage);
        await inboxPage.close();
        await composePage.waitAndType('@input-password', forgottenPassphrase);
        await composePage.waitAndClick('@action-send', { delay: 1 });
        await PageRecipe.waitForModalAndRespond(composePage, 'error', {
          contentToCheck: 'Please do not use your private key pass phrase as a password for this message',
          clickOn: 'confirm',
        });
      })
    );

    test(
      'user@key-manager-disabled-password-message.flowcrypt.test - disabled flowcrypt hosted password protected messages',
      testWithBrowser(async (t, browser) => {
        const acct = 'user@key-manager-disabled-password-message.flowcrypt.test';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {},
          },
        });
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acct);
        await SetupPageRecipe.autoSetupWithEKM(settingsPage);
        const composePage = await ComposePageRecipe.openStandalone(t, browser, acct);
        await ComposePageRecipe.fillMsg(composePage, { to: 'test@gmail.com' }, 'should disable flowcrypt hosted password protected message');
        await composePage.notPresent('@password-input-container');
        await composePage.waitAndClick('@action-send', { delay: 1 });
        await PageRecipe.waitForModalAndRespond(composePage, 'error', {
          contentToCheck: `Some recipients don't have encryption set up. Please import their public keys or ask them to install Flowcrypt.`,
          clickOn: 'confirm',
        });
      })
    );

    test(
      'compose - signed with entered pass phrase + will remember pass phrase in session',
      testWithBrowser(async (t, browser) => {
        const acctEmail = 'ci.tests.gmail@flowcrypt.test';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acctEmail]: {
                pubkey: somePubkey,
              },
              'human@flowcrypt.com': {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
        const k = Config.key('ci.tests.gmail');
        const settingsPage = await browser.newExtensionSettingsPage(t, acctEmail);
        await SettingsPageRecipe.forgetAllPassPhrasesInStorage(settingsPage, k.passphrase);
        const inboxPage = await browser.newExtensionInboxPage(t, acctEmail);
        const composeFrame = await InboxPageRecipe.openAndGetComposeFrame(inboxPage);
        await ComposePageRecipe.fillMsg(composeFrame, { to: 'human@flowcrypt.com' }, 'sign with entered pass phrase', undefined, {
          encrypt: false,
        });
        await composeFrame.waitAndClick('@action-send');
        await inboxPage.waitAll('@dialog-passphrase');
        const passphraseDialog = await inboxPage.getFrame(['passphrase.htm']);
        await passphraseDialog.waitForContent('@lost-pass-phrase', 'Lost pass phrase?');
        await passphraseDialog.waitAndType('@input-pass-phrase', k.passphrase);
        await passphraseDialog.waitAndClick('@action-confirm-pass-phrase-entry');
        await inboxPage.waitTillGone('@dialog-passphrase');
        await inboxPage.waitTillGone('@container-new-message'); // confirming pass phrase will auto-send the message
        // signed - done, now try to see if it remembered pp in session
        const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
        await ComposePageRecipe.fillMsg(composePage, { to: 'human@flowcrypt.com' }, 'signed message pp in session', undefined, {
          encrypt: false,
        });
        await ComposePageRecipe.sendAndClose(composePage);
        await settingsPage.close();
        await inboxPage.close();
      })
    );

    test(
      'compose - can load contact based on name',
      testWithBrowser(async (t, browser) => {
        const acctEmail = 'ci.tests.gmail@flowcrypt.test';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acctEmail]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
        // works on first search
        const composePage1 = await ComposePageRecipe.openStandalone(t, browser, 'compose');
        await composePage1.type('@input-to', 'human'); // test guessing of contacts
        await composePage1.waitAll(['@container-contacts', '@action-select-contact-name(Human at FlowCrypt)']);
        await composePage1.waitAll(['@container-contacts', '@action-select-contact-email(human@flowcrypt.com)']);
        await composePage1.ensureElementsCount('@action-select-contact-email(human@flowcrypt.com)', 1);
        // works on subsequent search
        const composePage2 = await ComposePageRecipe.openStandalone(t, browser, 'compose');
        await composePage2.type('@input-to', 'human'); // test guessing of contacts
        await composePage2.waitAll(['@container-contacts', '@action-select-contact-name(Human at FlowCrypt)']);
        await composePage2.waitAll(['@container-contacts', '@action-select-contact-email(human@flowcrypt.com)']);
        await composePage1.ensureElementsCount('@action-select-contact-email(human@flowcrypt.com)', 1);
      })
    );

    test(
      'compose - can load contact based on name different from email',
      testWithBrowser(async (t, browser) => {
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              'ci.tests.gmail@flowcrypt.test': {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
        // works on the first search
        const composePage1 = await ComposePageRecipe.openStandalone(t, browser, 'compose');
        await composePage1.type('@input-to', 'FirstName'); // test guessing of contacts when the name is not included in email address
        await composePage1.waitAll(['@container-contacts', '@action-select-contact-email(therecipient@theirdomain.com)']);
        // works on subsequent search
        const composePage2 = await ComposePageRecipe.openStandalone(t, browser, 'compose');
        await composePage2.type('@input-to', 'FirstName'); // test guessing of contacts when the name is not included in email address
        await composePage2.waitAll(['@container-contacts', '@action-select-contact-email(therecipient@theirdomain.com)']);
      })
    );

    test(
      'compose - should not show contacts for empty #input_to',
      testWithBrowser(async (t, browser) => {
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              'ci.tests.gmail@flowcrypt.test': {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
        // works on the first search
        const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
        await composePage.type('@input-to', 'FirstName'); // test guessing of contacts when the name is not included in email address
        await composePage.waitAll(['@container-contacts', '@action-select-contact-email(therecipient@theirdomain.com)']);
        // submit the first contact by Enter
        await composePage.page.keyboard.press('Enter');
        await composePage.waitForContent('@recipient_0', 'therecipient@theirdomain.com');
        // move focus away from #input_to
        await composePage.page.keyboard.press('Tab');
        // move focus back to #input_to
        await Util.shiftPress(composePage.page.keyboard, 'Tab');
        // should not show contacts again
        await composePage.notPresent('@container-contacts');
      })
    );

    test(
      `compose - can choose found contact`,
      testWithBrowser(async (t, browser) => {
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              'ci.tests.gmail@flowcrypt.test': {
                pubkey: somePubkey,
              },
              'human@flowcrypt.com': {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
        const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
        // composePage.enableDebugging('choose-contact');
        await composePage.type('@input-to', 'human'); // test loading of contacts
        await composePage.waitAll(['@container-contacts', '@action-select-contact-email(human@flowcrypt.com)'], {
          timeout: 30,
        });
        await composePage.waitAndClick('@action-select-contact-email(human@flowcrypt.com)', {
          retryErrs: true,
          confirmGone: true,
          delay: 0,
        });
        // todo - verify that the contact/pubkey is showing in green once clicked
        await composePage.waitAndClick('@input-subject');
        await composePage.type('@input-subject', `Automated puppeteer test: pubkey chosen by clicking found contact`);
        await composePage.type('@input-body', `This is an automated puppeteer test: pubkey chosen by clicking found contact`);
        await ComposePageRecipe.sendAndClose(composePage);
      })
    );

    test(
      `compose - recipients are properly ordered`,
      testWithBrowser(async (t, browser) => {
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              'ci.tests.gmail@flowcrypt.test': {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
        const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
        await composePage.page.setViewport({ width: 540, height: 606 });
        await ComposePageRecipe.fillMsg(composePage, { to: 'recip1@corp.co', cc: 'cc1@corp.co', bcc: 'bcc1@corp.co' }, 'recipients are properly ordered');
        await composePage.waitAndType(`@input-to`, 'recip2@corp.co');
        await composePage.waitAndType(`@input-bcc`, 'bcc2@corp.co');
        await composePage.waitAndFocus('@input-body');
        await composePage.waitTillGone('@spinner');
        const emailPreview = await composePage.waitAny('@recipients-preview');
        const recipients = await PageRecipe.getElementPropertyJson(emailPreview, 'textContent');
        expect(recipients).to.eq(['recip1@corp.co', 'recip2@corp.co', 'cc1@corp.co', 'bcc1@corp.co', '1 more'].join(''));
      })
    );

    test(
      `compose - auto include pubkey when our key is not available on Wkd`,
      testWithBrowser(async (t, browser) => {
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              'ci.tests.gmail@flowcrypt.test': {
                pubkey: somePubkey,
              },
              'flowcrypt.compatibility@gmail.com': {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
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
      })
    );

    test(
      `compose - auto include pubkey is inactive when our key is available on Wkd`,
      testWithBrowser(async (t, browser) => {
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {},
          },
        });
        const acct = `wkd@google.mock.localhost:${t.urls?.port}`;
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acct);
        await SetupPageRecipe.autoSetupWithEKM(settingsPage);
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
      })
    );

    test(
      `compose - freshly loaded pubkey`,
      testWithBrowser(async (t, browser) => {
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              'ci.tests.gmail@flowcrypt.test': {
                pubkey: somePubkey,
              },
              'human@flowcrypt.com': {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
        const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
        await ComposePageRecipe.fillMsg(composePage, { to: 'human@flowcrypt.com' }, 'freshly loaded pubkey');
        await ComposePageRecipe.sendAndClose(composePage);
      })
    );

    test(
      'compose - recipient pasted including name',
      testWithBrowser(async (t, browser) => {
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              'ci.tests.gmail@flowcrypt.test': {
                pubkey: somePubkey,
              },
              'human@flowcrypt.com': {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
        const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
        await ComposePageRecipe.fillMsg(composePage, { to: 'Human at Flowcrypt <Human@FlowCrypt.com>' }, 'recipient pasted including name');
        await ComposePageRecipe.sendAndClose(composePage);
      })
    );

    test(
      'compose - nopgp',
      testWithBrowser(async (t, browser) => {
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              'ci.tests.gmail@flowcrypt.test': {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
        const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
        await ComposePageRecipe.fillMsg(composePage, { to: 'human+nopgp@flowcrypt.com' }, 'unknown pubkey');
        await ComposePageRecipe.sendAndClose(composePage, { password: 'test-pass' });
      })
    );

    test(
      'compose - from alias',
      testWithBrowser(async (t, browser) => {
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              'flowcrypt.compatibility@gmail.com': {
                pubkey: somePubkey,
              },
              'human@flowcrypt.com': {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'compatibility');
        const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility');
        await ComposePageRecipe.selectFromOption(composePage, 'flowcryptcompatibility@gmail.com');
        await ComposePageRecipe.fillMsg(composePage, { to: 'human@flowcrypt.com' }, 'from alias');
        await ComposePageRecipe.sendAndClose(composePage);
      })
    );

    test(
      'compose - with attachments + nopgp',
      testWithBrowser(async (t, browser) => {
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              'ci.tests.gmail@flowcrypt.test': {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
        const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
        await ComposePageRecipe.fillMsg(composePage, { to: 'human+nopgp@flowcrypt.com' }, 'with files + nonppg');
        const fileInput = (await composePage.target.$('input[type=file]')) as ElementHandle<HTMLInputElement>;
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        await fileInput!.uploadFile('test/samples/small.txt', 'test/samples/small.png', 'test/samples/small.pdf');
        await ComposePageRecipe.sendAndClose(composePage, { password: 'test-pass', timeout: 90 });
        // the sent message is checked by PwdOnlyEncryptedWithAttachmentTestStrategy
      })
    );

    test(
      'compose - signed message',
      testWithBrowser(async (t, browser) => {
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              'ci.tests.gmail@flowcrypt.test': {
                pubkey: somePubkey,
              },
              'human@flowcrypt.com': {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
        const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
        await ComposePageRecipe.fillMsg(composePage, { to: 'human@flowcrypt.com' }, 'signed message', undefined, {
          encrypt: false,
        });
        await ComposePageRecipe.sendAndClose(composePage);
      })
    );

    test(
      'compose - settings - manually copied pubkey',
      testWithBrowser(async (t, browser) => {
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              'ci.tests.gmail@flowcrypt.test': {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
        const dbPage = await browser.newExtensionPage(t, 'chrome/dev/ci_unit_test.htm');
        // add a contact containing 2 pubkeys to the storage
        await dbPage.page.evaluate(
          async (pubkeys: string[]) => {
            for (const pubkey of pubkeys) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const key = await (window as any).KeyUtil.parse(pubkey);
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              await (window as any).ContactStore.update(undefined, 'tocopyfrom@example.test', { pubkey: key });
            }
          },
          [testConstants.abcddfTestComPubkey, testConstants.abcdefTestComPubkey]
        );
        const inboxPage = await browser.newExtensionInboxPage(t, 'ci.tests.gmail@flowcrypt.test');
        const composeFrame = await InboxPageRecipe.openAndGetComposeFrame(inboxPage);
        await ComposePageRecipe.fillMsg(composeFrame, { to: 'manualcopypgp@flowcrypt.com' }, 'manual copied key');
        await composeFrame.waitAndClick('@action-open-add-pubkey-dialog', { delay: 1 });
        await inboxPage.waitAll('@dialog-add-pubkey');
        const addPubkeyDialog = await inboxPage.getFrame(['add_pubkey.htm']);
        await addPubkeyDialog.waitAll('@input-select-copy-from');
        await Util.sleep(1);
        await addPubkeyDialog.selectOption('@input-select-copy-from', 'tocopyfrom@example.test');
        await addPubkeyDialog.waitTillGone(['@input-pubkey', '@manual-import-warning']);
        await addPubkeyDialog.selectOption('@input-select-copy-from', 'Copy from Contact');
        await addPubkeyDialog.waitAll(['@input-pubkey', '@manual-import-warning']);
        await addPubkeyDialog.selectOption('@input-select-copy-from', 'tocopyfrom@example.test');
        await addPubkeyDialog.waitTillGone(['@input-pubkey', '@manual-import-warning']);
        await addPubkeyDialog.waitAndClick('@action-add-pubkey');
        await inboxPage.waitTillGone('@dialog-add-pubkey');
        await composeFrame.waitAndClick('@action-send', { delay: 2 });
        await inboxPage.waitTillGone('@container-new-message');
        await inboxPage.close();
        // test the pubkeys we copied
        const contact = await dbPage.page.evaluate(async () => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return
          return await (window as any).ContactStore.getOneWithAllPubkeys(undefined, 'manualcopypgp@flowcrypt.com');
        });
        expect(contact.sortedPubkeys.length).to.equal(2);
        expect((contact.sortedPubkeys as PubkeyInfoWithLastCheck[]).map(pub => pub.pubkey.id)).to.include.members([
          '6CF53D2329C2A80828F499D375AA44AB8930F7E9',
          '3155F118B6E732B3638A1CE1608BCD797A23FB91',
        ]);
        await dbPage.close();
      })
    );

    test(
      'compose - keyboard - Ctrl+Enter sends message',
      testWithBrowser(async (t, browser) => {
        const acct = 'ci.tests.gmail@flowcrypt.test';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
        const inboxPage = await browser.newExtensionInboxPage(t, acct);
        const composeFrame = await InboxPageRecipe.openAndGetComposeFrame(inboxPage);
        await composeFrame.target.evaluateHandle(() =>
          (document.querySelector('#section_compose') as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true }))
        );
        await composeFrame.waitAndRespondToModal('error', 'confirm', 'Please add a recipient first');
      })
    );

    test(
      'compose - keyboard - Opening & changing composer send btn popover using keyboard',
      testWithBrowser(async (t, browser) => {
        const acct = 'ci.tests.gmail@flowcrypt.test';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
        const inboxPage = await browser.newExtensionInboxPage(t, acct);
        const composeFrame = await InboxPageRecipe.openAndGetComposeFrame(inboxPage);
        await composeFrame.waitAndFocus('@action-show-options-popover');
        await inboxPage.press('Enter');
        await inboxPage.press('ArrowDown', 3); // more arrow downs to ensure that active element selection loops
        await inboxPage.press('Enter');
        expect(await composeFrame.read('@action-send')).to.eq('Sign and Send');
      })
    );

    test(
      'compose - keyboard - Attaching file using keyboard',
      testWithBrowser(async (t, browser) => {
        const acct = 'ci.tests.gmail@flowcrypt.test';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
        const inboxPage = await browser.newExtensionInboxPage(t, acct);
        const composeFrame = await InboxPageRecipe.openAndGetComposeFrame(inboxPage);
        await composeFrame.waitAndFocus('@action-attach-files');
        // Set up the Promise *before* the file chooser is launched
        const fileChooser = inboxPage.page.waitForFileChooser();
        await Util.sleep(0.5); // waitForFileChooser() is flaky without this timeout, #3051
        await inboxPage.press('Enter');
        await fileChooser;
      })
    );

    test(
      'compose - reply - old gmail threadId fmt',
      testWithBrowser(async (t, browser) => {
        const acct = 'ci.tests.gmail@flowcrypt.test';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
        const appendUrl = 'skipClickPrompt=___cu_false___&ignoreDraft=___cu_false___&threadId=16841ce0ce5cb74d&replyMsgId=16841ce0ce5cb74d';
        const replyFrame = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', {
          appendUrl,
          skipValidation: true,
        });
        await replyFrame.waitAll(['#new_message', '@action-retry-by-reloading']);
        expect(await replyFrame.read('#new_message')).to.include('Cannot get reply data for the message you are replying to');
        await replyFrame.notPresent('@action-accept-reply-prompt');
      })
    );

    test(
      'compose - reply - thread id does not exist',
      testWithBrowser(async (t, browser) => {
        const acct = 'flowcrypt.compatibility@gmail.com';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'compatibility');
        const appendUrl = 'skipClickPrompt=___cu_false___&ignoreDraft=___cu_false___&threadId=16804894591b3a4b&replyMsgId=16804894591b3a4b';
        const replyFrame = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', {
          appendUrl,
          skipValidation: true,
        });
        await replyFrame.waitAll(['#new_message', '@action-retry-by-reloading']);
        expect(await replyFrame.read('#new_message')).to.include('Cannot get reply data for the message you are replying to');
        await replyFrame.notPresent('@action-accept-reply-prompt');
      })
    );

    test(
      'compose - quote - can load quote from encrypted/text email',
      testWithBrowser(async (t, browser) => {
        const acct = 'flowcrypt.compatibility@gmail.com';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'compatibility');
        const appendUrl = 'threadId=16b584ed95837510&skipClickPrompt=___cu_false___&ignoreDraft=___cu_false___&replyMsgId=16b584ed95837510';
        const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', {
          appendUrl,
          hasReplyPrompt: true,
        });
        await composePage.waitAndClick('@encrypted-reply', { delay: 5 });
        await clickTripleDotAndExpectQuoteToLoad(
          composePage,
          [
            'On 2019-06-14 at 23:24, flowcrypt.compatibility@gmail.com wrote:',
            '> This is some message',
            '>',
            '> and below is the quote',
            '>',
            '> > this is the quote',
            '> > still the quote',
            '> > third line',
            '> >> double quote',
            '> >> again double quote',
          ].join('\n')
        );
        await ComposePageRecipe.sendAndClose(composePage);
      })
    );

    test(
      'compose - quote - can load quote from plain/text email',
      testWithBrowser(async (t, browser) => {
        const acct = 'flowcrypt.compatibility@gmail.com';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'compatibility');
        const appendUrl = 'threadId=16402d6dc4342e7f&skipClickPrompt=___cu_false___&ignoreDraft=___cu_false___' + '&replyMsgId=16402d6dc4342e7f';
        const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', {
          appendUrl,
          hasReplyPrompt: true,
        });
        await composePage.waitAndClick('@encrypted-reply', { delay: 1 });
        await clickTripleDotAndExpectQuoteToLoad(
          composePage,
          ['On 2018-06-15 at 09:46, info@nvimp.com wrote:', '> cropping all except for the image below'].join('\n')
        );
      })
    );

    test(
      'compose - reply - can load quote from plain/html email',
      testWithBrowser(async (t, browser) => {
        const acct = 'flowcrypt.compatibility@gmail.com';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'compatibility');
        const appendUrl = 'threadId=16b36861a890bb26&skipClickPrompt=___cu_false___' + '&ignoreDraft=___cu_false___&replyMsgId=16b36861a890bb26';
        const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', {
          appendUrl,
          hasReplyPrompt: true,
        });
        await composePage.waitAndClick('@encrypted-reply', { delay: 1 });
        expect(await composePage.read('@input-body')).to.not.include('flowcrypt.compatibility test footer with an img');
        await clickTripleDotAndExpectQuoteToLoad(
          composePage,
          [
            'On 2019-06-08 at 09:57, human@flowcrypt.com wrote:',
            '> Used to fail on Android app',
            '>',
            '> ---------- Forwarded message ---------',
            '> From: Mozilla <Mozilla@e.mozilla.org>',
            '> Date: Thu, 6 Jun 2019, 17:22',
            '> Subject: Your misinformation questions ... answered.',
            '> To:  <tom@cryptup.org>',
          ].join('\n')
        );
      })
    );

    test(
      'compose - reply - can load quote from encrypted/html email',
      testWithBrowser(async (t, browser) => {
        const acct = 'flowcrypt.compatibility@gmail.com';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'compatibility');
        const appendUrl = 'threadId=1663a65bbd73ce1a&skipClickPrompt=___cu_false___&ignoreDraft=___cu_false___&replyMsgId=1663a65bbd73ce1a';
        const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', {
          appendUrl,
          hasReplyPrompt: true,
        });
        await composePage.waitAndClick('@encrypted-reply', { delay: 1 });
        await clickTripleDotAndExpectQuoteToLoad(
          composePage,
          [
            'On 2018-10-03 at 14:47, henry.electrum@gmail.com wrote:',
            '>',
            '> The following text is bold: this is bold',
            '>',
            '> The following text is red: this text is        red',
          ].join('\n')
        );
      })
    );

    for (const inputMethod of ['mouse', 'keyboard']) {
      test(
        `compose - reply - pass phrase dialog - dialog ok (${inputMethod})`,
        testWithBrowser(async (t, browser) => {
          const acct = 'flowcrypt.compatibility@gmail.com';
          t.mockApi!.configProvider = new ConfigurationProvider({
            attester: {
              pubkeyLookup: {
                [acct]: {
                  pubkey: somePubkey,
                },
              },
            },
          });
          await BrowserRecipe.setUpCommonAcct(t, browser, 'compatibility');
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
          await clickTripleDotAndExpectQuoteToLoad(
            replyFrame,
            [
              'On 2019-06-14 at 23:24, flowcrypt.compatibility@gmail.com wrote:',
              '> This is some message',
              '>',
              '> and below is the quote',
              '>',
              '> > this is the quote',
              '> > still the quote',
              '> > third line',
              '> >> double quote',
              '> >> again double quote',
            ].join('\n')
          );
        })
      );

      test(
        `compose - reply - pass phrase dialog - dialog cancel (${inputMethod})`,
        testWithBrowser(async (t, browser) => {
          const acct = 'flowcrypt.compatibility@gmail.com';
          t.mockApi!.configProvider = new ConfigurationProvider({
            attester: {
              pubkeyLookup: {
                [acct]: {
                  pubkey: somePubkey,
                },
              },
            },
          });
          await BrowserRecipe.setUpCommonAcct(t, browser, 'compatibility');
          const pp = Config.key('flowcrypt.compatibility.1pp1').passphrase;
          const { inboxPage, replyFrame } = await setRequirePassPhraseAndOpenRepliedMessage(t, browser, pp);
          // Get Passphrase dialog and cancel confirm passphrase
          await inboxPage.waitAll('@dialog-passphrase');
          await ComposePageRecipe.cancelPassphraseDialog(inboxPage, inputMethod);
          await replyFrame.waitAll(['@action-expand-quoted-text']);
          const inputBody = await replyFrame.read('@input-body');
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          expect(inputBody!.trim()).to.be.empty;
          await clickTripleDotAndExpectQuoteToLoad(
            replyFrame,
            ['On 2019-06-14 at 23:24, flowcrypt.compatibility@gmail.com wrote:', '>', '> (Skipping previous message quote)'].join('\n')
          );
        })
      );

      test(
        `compose - pass phrase dialog - dialog cancel (${inputMethod})`,
        testWithBrowser(async (t, browser) => {
          const k = Config.key('ci.tests.gmail');
          const acctEmail = 'ci.tests.gmail@flowcrypt.test';
          t.mockApi!.configProvider = new ConfigurationProvider({
            attester: {
              pubkeyLookup: {
                [acctEmail]: {
                  pubkey: somePubkey,
                },
              },
            },
          });
          await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
          const settingsPage = await browser.newExtensionSettingsPage(t, acctEmail);
          await SettingsPageRecipe.forgetAllPassPhrasesInStorage(settingsPage, k.passphrase);
          const inboxPage = await browser.newExtensionInboxPage(t, acctEmail);
          const composeFrame = await InboxPageRecipe.openAndGetComposeFrame(inboxPage);
          await ComposePageRecipe.fillMsg(composeFrame, { to: 'anyone@recipient.com' }, 'send signed-only message', undefined, {
            encrypt: false,
          });
          await composeFrame.waitAndClick('@action-send', { delay: 2 });
          const passphraseDialog = await inboxPage.getFrame(['passphrase.htm']);
          expect(passphraseDialog.frame.isDetached()).to.equal(false);
          await Util.sleep(0.5);
          expect(await composeFrame.read('@action-send')).to.eq('Signing...');
          await passphraseDialog.waitForContent('@passphrase-text', 'Enter FlowCrypt pass phrase to sign email');
          await ComposePageRecipe.cancelPassphraseDialog(inboxPage, inputMethod);
          await Util.sleep(0.5);
          await composeFrame.waitForContent('@action-send', 'Sign and Send');
        })
      );

      test(
        `compose - non-primary pass phrase dialog - dialog cancel (${inputMethod})`,
        testWithBrowser(async (t, browser) => {
          const k = Config.key('ci.tests.gmail');
          const acctEmail = 'ci.tests.gmail@flowcrypt.test';
          t.mockApi!.configProvider = new ConfigurationProvider({
            attester: {
              pubkeyLookup: {
                [acctEmail]: {
                  pubkey: somePubkey,
                },
              },
            },
          });
          await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
          const settingsPage = await browser.newExtensionSettingsPage(t, acctEmail);
          const forgottenPassphrase = "i'll have to re-enter it";
          await SettingsPageRecipe.addKeyTest(t, browser, acctEmail, testConstants.testKeyMultipleSmimeCEA2D53BB9D24871, forgottenPassphrase, {}, true);
          await SettingsPageRecipe.forgetAllPassPhrasesInStorage(settingsPage, k.passphrase);
          const inboxPage = await browser.newExtensionInboxPage(t, acctEmail);
          const composeFrame = await InboxPageRecipe.openAndGetComposeFrame(inboxPage);
          await ComposePageRecipe.fillMsg(composeFrame, { to: 'smime@recipient.com' }, 'S/MIME message', undefined);
          await ComposePageRecipe.pastePublicKeyManually(
            composeFrame,
            inboxPage,
            'smime@recipient.com',
            testConstants.testCertificateMultipleSmimeCEA2D53BB9D24871
          );
          await composeFrame.waitAndClick('@action-send', { delay: 2 });
          const passphraseDialog = await inboxPage.getFrame(['passphrase.htm']);
          expect(passphraseDialog.frame.isDetached()).to.equal(false);
          await composeFrame.waitForContent('@action-send', 'Loading...');
          await passphraseDialog.waitForContent('@passphrase-text', 'Enter FlowCrypt pass phrase to sign email');
          await passphraseDialog.waitForContent('@which-key', '47FB 0318 3E03 A8ED 44E3 BBFC CEA2 D53B B9D2 4871');
          await ComposePageRecipe.cancelPassphraseDialog(inboxPage, inputMethod);
          await composeFrame.waitForContent('@action-send', 'Encrypt, Sign and Send');
        })
      );
    } // end of tests per inputMethod

    test(
      `compose - signed and encrypted S/MIME message - pass phrase dialog`,
      testWithBrowser(async (t, browser) => {
        const k = Config.key('ci.tests.gmail');
        const acctEmail = 'ci.tests.gmail@flowcrypt.test';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acctEmail]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
        const settingsPage = await browser.newExtensionSettingsPage(t, acctEmail);
        const forgottenPassphrase = "i'll have to re-enter it";
        await SettingsPageRecipe.addKeyTest(t, browser, acctEmail, testConstants.testKeyMultipleSmimeCEA2D53BB9D24871, forgottenPassphrase, {}, true);
        await SettingsPageRecipe.forgetAllPassPhrasesInStorage(settingsPage, k.passphrase);
        const inboxPage = await browser.newExtensionInboxPage(t, acctEmail);
        const composeFrame = await InboxPageRecipe.openAndGetComposeFrame(inboxPage);
        await ComposePageRecipe.fillMsg(composeFrame, { to: 'smime@recipient.com' }, t.title, undefined);
        await ComposePageRecipe.pastePublicKeyManually(
          composeFrame,
          inboxPage,
          'smime@recipient.com',
          testConstants.testCertificateMultipleSmimeCEA2D53BB9D24871
        );
        await composeFrame.waitAndClick('@action-send', { delay: 2 });
        const passphraseDialog = await inboxPage.getFrame(['passphrase.htm']);
        expect(passphraseDialog.frame.isDetached()).to.equal(false);
        await passphraseDialog.waitForContent('@passphrase-text', 'Enter FlowCrypt pass phrase to sign email');
        await passphraseDialog.waitForContent('@which-key', '47FB 0318 3E03 A8ED 44E3 BBFC CEA2 D53B B9D2 4871');
        await passphraseDialog.waitAndType('@input-pass-phrase', forgottenPassphrase);
        await passphraseDialog.waitAndClick('@action-confirm-pass-phrase-entry');
        await inboxPage.waitTillGone('@container-new-message');
      })
    );

    test(
      'compose - reply - signed message',
      testWithBrowser(async (t, browser) => {
        const acct = 'flowcrypt.compatibility@gmail.com';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'compatibility');
        const appendUrl = 'threadId=15f7f5face7101db&skipClickPrompt=___cu_false___&ignoreDraft=___cu_false___&replyMsgId=15f7f5face7101db';
        const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', {
          appendUrl,
          hasReplyPrompt: true,
        });
        await composePage.notPresent('@action-accept-reply-all-prompt');
        await composePage.waitAndClick('@encrypted-reply', { delay: 1 });
        await composePage.waitAll('@action-send');
        await Util.sleep(0.5);
        expect(await composePage.read('@action-send')).to.eq('Sign and Send');
        await composePage.waitAndClick('@action-show-options-popover');
        await composePage.waitAll(['@action-toggle-sign', '@action-toggle-encrypt', '@icon-toggle-sign-tick']);
        await composePage.notPresent(['@icon-toggle-encrypt-tick']); // response to signed message should not be auto-encrypted
        await ComposePageRecipe.fillMsg(composePage, {}, undefined, undefined, {});
        await ComposePageRecipe.sendAndClose(composePage);
      })
    );

    test(
      'compose - forward - pgp/mime signed-only',
      testWithBrowser(async (t, browser) => {
        const acct = 'flowcrypt.compatibility@gmail.com';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'compatibility');
        const appendUrl = 'threadId=15f7fc2919788f03&skipClickPrompt=___cu_false___&ignoreDraft=___cu_false___&replyMsgId=15f7fc2919788f03';
        const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', {
          appendUrl,
          hasReplyPrompt: true,
        });
        await composePage.waitAndClick('@action-forward');
        await ComposePageRecipe.fillRecipients(composePage, { to: 'human@flowcrypt.com' });
        expect(await composePage.read('@input-body')).to.include('> This message will contain a separately attached file + signature.');
        await composePage.waitAny('.qq-file-id-0');
      })
    );

    test(
      'compose - standalone- hide/show btns after signing',
      testWithBrowser(async (t, browser) => {
        const acct = 'ci.tests.gmail@flowcrypt.test';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
        const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
        await ComposePageRecipe.fillMsg(composePage, { to: 'test.no.pgp@test.com' }, 'Signed Message', undefined, {
          encrypt: false,
        });
        expect(await composePage.isElementPresent('@add-intro')).to.be.true;
        expect(await composePage.isElementPresent('@password-or-pubkey-container')).to.be.true;
        await composePage.notPresent('@add-intro');
        await composePage.notPresent('@password-or-pubkey-container');
      })
    );

    test(
      'compose - show no contact found result if there are no contacts',
      testWithBrowser(async (t, browser) => {
        const acct = 'ci.tests.gmail@flowcrypt.test';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
        const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
        await ComposePageRecipe.showRecipientInput(composePage);
        const noContactSelectors = ['@no-contact-found'];
        if (testVariant === 'CONSUMER-MOCK') {
          noContactSelectors.push('@action-auth-with-contacts-scope'); // also check for "Enable..." button
        }
        await composePage.waitAndType('@input-to', 'ci.tests.gmail');
        await Util.sleep(3);
        await composePage.notPresent(noContactSelectors);
        await composePage.waitAndType('@input-to', 'aaaaaaaaaaa');
        await composePage.waitAll(noContactSelectors);
        await composePage.waitAndType('@input-to', 'ci.tests.gmail');
        await Util.sleep(3);
        await composePage.notPresent(noContactSelectors);
        await composePage.waitAndType('@input-to', 'aaaaaaaaaaa');
        await composePage.waitAll(noContactSelectors);
      })
    );

    test(
      'compose - CC&BCC new message',
      testWithBrowser(async (t, browser) => {
        const acct = 'ci.tests.gmail@flowcrypt.test';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
              'human@flowcrypt.com': {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
        const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
        await ComposePageRecipe.fillMsg(
          composePage,
          { to: 'human@flowcrypt.com', cc: 'human@flowcrypt.com', bcc: 'human@flowcrypt.com' },
          'Testing CC And BCC'
        );
        await ComposePageRecipe.sendAndClose(composePage);
      })
    );

    test(
      'compose - check recipient validation after user inputs incorrect recipient',
      testWithBrowser(async (t, browser) => {
        const acct = 'ci.tests.gmail@flowcrypt.test';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
        const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
        const correctButtonStatusTxt = 'Encrypt, Sign and Send';
        await ComposePageRecipe.showRecipientInput(composePage);
        await composePage.waitAll('@container-cc-bcc-buttons');
        await composePage.waitForContent('@action-send', correctButtonStatusTxt);
        await composePage.waitAndType(`@input-to`, 'aaaaa\n'); // First enter invalid recipient
        await composePage.waitForContent('@action-send', 'Re-enter recipient..');
        await composePage.press('Backspace'); // Delete invalid recipient
        await composePage.waitForContent('@action-send', correctButtonStatusTxt); // check if sent button status is correct
        await composePage.waitAndType(`@input-to`, 'mock.only.pubkey@flowcrypt.com\n'); // Now enter correct recipient and check if send button status is correct.
        await composePage.waitForContent('@action-send', correctButtonStatusTxt);
      })
    );

    test(
      'compose - check recipient is added correctly after deleting recipient',
      testWithBrowser(async (t, browser) => {
        const acct = 'ci.tests.gmail@flowcrypt.test';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
        // Background: Previously, when adding recipient a (correct recipient) and recipient b (unknown recipient),
        // then removing recipient a and adding recipient a again, the recipient input was not showing recipient status correctly.
        // https://github.com/FlowCrypt/flowcrypt-browser/issues/4241
        const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
        const unknownRecipient = 'unknown@flowcrypt.test';
        const correctRecipient = 'mock.only.pubkey@flowcrypt.com';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [correctRecipient]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await ComposePageRecipe.showRecipientInput(composePage);
        await composePage.waitAndType(`@input-to`, `${correctRecipient}\n`); // Enter correct recipient
        await composePage.waitAndType(`@input-to`, `${unknownRecipient}\n`); // enter unknown recipient
        await composePage.waitAndClick('@action-remove-mockonlypubkeyflowcryptcom-recipient'); // Now delete correct recipient
        await composePage.waitAndType(`@input-to`, `${correctRecipient}\n`); // add unknown recipient again
        await composePage.click('@input-subject');
        await composePage.waitForContent('.email_address.no_pgp', unknownRecipient); // Check if unknown email recipient correctly displays no_pgp status
        await composePage.waitForContent('.email_address.has_pgp', correctRecipient); // Check if mock recipient shows correct has_pgp status
      })
    );

    test(
      'compose - reply - CC&BCC test reply',
      testWithBrowser(async (t, browser) => {
        const acct = 'flowcrypt.compatibility@gmail.com';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'compatibility');
        const appendUrl = 'threadId=16ce2c965c75e5a6&skipClickPrompt=___cu_false___&ignoreDraft=___cu_false___&replyMsgId=16ce2c965c75e5a6';
        const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', {
          appendUrl,
          hasReplyPrompt: true,
        });
        await composePage.waitAndClick('@action-accept-reply-all-prompt', { delay: 2 });
        await ComposePageRecipe.fillMsg(composePage, { bcc: 'test@email.com' }, undefined, undefined, undefined);
        await expectRecipientElements(composePage, {
          to: [{ email: 'censored@email.com' }],
          cc: [{ email: 'censored@email.com' }],
          bcc: [{ email: 'test@email.com' }],
        });
        await Util.sleep(3);
        await ComposePageRecipe.sendAndClose(composePage, { password: 'test-pass' });
      })
    );

    test(
      'compose - expired can still send',
      testWithBrowser(async (t, browser) => {
        const acct = 'ci.tests.gmail@flowcrypt.test';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
        const expiredEmail = 'expired.on.attester@domain.com';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [expiredEmail]: {
                pubkey: expiredPubkey,
              },
            },
          },
        });
        const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
        await ComposePageRecipe.fillMsg(composePage, { to: expiredEmail }, 'Test Expired Email');
        const expandContainer = await composePage.waitAny('@action-show-container-cc-bcc-buttons');
        const recipient = await expandContainer.$('.email_preview span');
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        expect(await PageRecipe.getElementPropertyJson(recipient!, 'className')).to.include('expired');
        await composePage.waitAndClick('@action-send');
        await PageRecipe.waitForModalAndRespond(composePage, 'confirm', {
          contentToCheck: 'The public key of one of your recipients is expired.',
          clickOn: 'confirm',
          timeout: 40,
        });
        await composePage.waitForSelTestState('closed', 20); // succesfully sent
        await composePage.close();
      })
    );

    test(
      'compose - revoked OpenPGP key',
      testWithBrowser(async (t, browser) => {
        const acct = 'ci.tests.gmail@flowcrypt.test';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
        const dbPage = await browser.newExtensionPage(t, 'chrome/dev/ci_unit_test.htm');
        await dbPage.page.evaluate(async (pubkey: string) => {
          /* eslint-disable @typescript-eslint/no-explicit-any */
          const db = await (window as any).ContactStore.dbOpen();
          const opgpKeyRevoked = await (window as any).KeyUtil.parse(pubkey);
          await (window as any).ContactStore.update(db, 'revoked.pubkey@flowcrypt.com', { pubkey: opgpKeyRevoked });
          /* eslint-enable @typescript-eslint/no-explicit-any */
        }, testConstants.somerevokedValidNowRevoked);
        await dbPage.close();
        const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
        await ComposePageRecipe.fillMsg(composePage, { to: 'revoked.pubkey@flowcrypt.com' }, 'Test Revoked');
        const expandContainer = await composePage.waitAny('@action-show-container-cc-bcc-buttons');
        const recipient = await expandContainer.$('.email_preview span');
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        expect(await PageRecipe.getElementPropertyJson(recipient!, 'className')).to.include('revoked');
        await composePage.close();
      })
    );

    test(
      'compose - externally revoked key',
      testWithBrowser(async (t, browser) => {
        const acct = 'ci.tests.gmail@flowcrypt.test';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
        const dbPage = await browser.newExtensionPage(t, 'chrome/dev/ci_unit_test.htm');
        await dbPage.page.evaluate(async (pubkey: string) => {
          /* eslint-disable @typescript-eslint/no-explicit-any */
          const db = await (window as any).ContactStore.dbOpen();
          const opgpKeyOldAndValid = await (window as any).KeyUtil.parse(pubkey);
          await (window as any).ContactStore.update(db, 'not.revoked.pubkey@flowcrypt.com', {
            pubkey: opgpKeyOldAndValid,
          });
          await new Promise((resolve, reject) => {
            const tx = db.transaction(['revocations'], 'readwrite');
            (window as any).ContactStore.setTxHandlers(tx, resolve, reject);
            tx.objectStore('revocations').put({ fingerprint: opgpKeyOldAndValid.id + '-X509' });
          });
          /* eslint-enable @typescript-eslint/no-explicit-any */
        }, testConstants.somerevokedValid);
        await dbPage.close();
        const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
        await ComposePageRecipe.fillMsg(composePage, { to: 'not.revoked.pubkey@flowcrypt.com' }, 'Test Revoked');
        const expandContainer = await composePage.waitAny('@action-show-container-cc-bcc-buttons');
        const recipient = await expandContainer.$('.email_preview span');
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        expect(await PageRecipe.getElementPropertyJson(recipient!, 'className')).to.include('revoked');
        await composePage.close();
      })
    );

    test(
      'compose - nogpg and revoked recipients trigger both warnings',
      testWithBrowser(async (t, browser) => {
        const acct = 'ci.tests.gmail@flowcrypt.test';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
        const dbPage = await browser.newExtensionPage(t, 'chrome/dev/ci_unit_test.htm');
        await dbPage.page.evaluate(async (pubkey: string) => {
          /* eslint-disable @typescript-eslint/no-explicit-any */
          const db = await (window as any).ContactStore.dbOpen();
          const opgpKeyRevoked = await (window as any).KeyUtil.parse(pubkey);
          await (window as any).ContactStore.update(db, 'revoked.pubkey@flowcrypt.com', { pubkey: opgpKeyRevoked });
          /* eslint-enable @typescript-eslint/no-explicit-any */
        }, testConstants.somerevokedValidNowRevoked);
        await dbPage.close();
        const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
        await ComposePageRecipe.fillMsg(composePage, { to: 'revoked.pubkey@flowcrypt.com', cc: 'nopgp@missing.com' }, 'Test NoPGP and Revoked');
        await composePage.waitAll(['@warning-nopgp', '@warning-revoked']);
        await composePage.close();
      })
    );

    test(
      'compose - nogpg and non-revoked recipients trigger nopgp warning only',
      testWithBrowser(async (t, browser) => {
        const acct = 'ci.tests.gmail@flowcrypt.test';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
        const dbPage = await browser.newExtensionPage(t, 'chrome/dev/ci_unit_test.htm');
        await dbPage.page.evaluate(async (pubkey: string) => {
          /* eslint-disable @typescript-eslint/no-explicit-any */
          const db = await (window as any).ContactStore.dbOpen();
          const opgpKeyValid = await (window as any).KeyUtil.parse(pubkey);
          await (window as any).ContactStore.update(db, 'not.revoked.pubkey@flowcrypt.com', { pubkey: opgpKeyValid });
          /* eslint-enable @typescript-eslint/no-explicit-any */
        }, testConstants.somerevokedValid);
        await dbPage.close();
        const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
        await ComposePageRecipe.fillMsg(composePage, { to: 'not.revoked.pubkey@flowcrypt.com', cc: 'nopgp@missing.com' }, 'Test NoPGP and Non-Revoked');
        await composePage.waitAll('@warning-nopgp');
        await composePage.waitTillGone('@warning-revoked');
        await composePage.close();
      })
    );

    test(
      'compose - revoked recipients trigger revoked warning',
      testWithBrowser(async (t, browser) => {
        const acct = 'ci.tests.gmail@flowcrypt.test';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
        const dbPage = await browser.newExtensionPage(t, 'chrome/dev/ci_unit_test.htm');
        await dbPage.page.evaluate(async (pubkey: string) => {
          /* eslint-disable @typescript-eslint/no-explicit-any */
          const db = await (window as any).ContactStore.dbOpen();
          const opgpKeyRevoked = await (window as any).KeyUtil.parse(pubkey);
          await (window as any).ContactStore.update(db, 'revoked.pubkey@flowcrypt.com', { pubkey: opgpKeyRevoked });
          /* eslint-enable @typescript-eslint/no-explicit-any */
        }, testConstants.somerevokedValidNowRevoked);
        await dbPage.close();
        const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
        await ComposePageRecipe.fillMsg(composePage, { to: 'revoked.pubkey@flowcrypt.com' }, 'Test Revoked Only');
        await composePage.waitAll('@warning-revoked');
        await composePage.waitTillGone('@warning-nopgp');
        await composePage.close();
      })
    );

    test(
      'compose - good recipients trigger no warning',
      testWithBrowser(async (t, browser) => {
        const acct = 'ci.tests.gmail@flowcrypt.test';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
        const dbPage = await browser.newExtensionPage(t, 'chrome/dev/ci_unit_test.htm');
        await dbPage.page.evaluate(async (pubkey: string) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const db = await (window as any).ContactStore.dbOpen();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const opgpKeyValid = await (window as any).KeyUtil.parse(pubkey);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (window as any).ContactStore.update(db, 'not.revoked.pubkey@flowcrypt.com', { pubkey: opgpKeyValid });
        }, testConstants.somerevokedValid);
        await dbPage.close();
        const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
        await ComposePageRecipe.fillMsg(composePage, { to: 'not.revoked.pubkey@flowcrypt.com' }, 'Test Non-Revoked Only');
        await composePage.waitTillGone(['@warning-nopgp', '@warning-revoked']);
        await composePage.close();
      })
    );

    test(
      'compose - loading drafts - new message, rendering cc/bcc and check if cc/bcc btns are hidden',
      testWithBrowser(async (t, browser) => {
        const acct = 'flowcrypt.compatibility@gmail.com';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'compatibility');
        const appendUrl = 'draftId=draft-1';
        const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', { appendUrl });
        await expectRecipientElements(composePage, {
          to: [{ email: 'flowcryptcompatibility@gmail.com', name: 'First Last' }],
          cc: [{ email: 'flowcrypt.compatibility@gmail.com', name: 'First Last' }],
          bcc: [{ email: 'human@flowcrypt.com' }],
        });
        const subjectElem = await composePage.waitAny('@input-subject');
        expect(await PageRecipe.getElementPropertyJson(subjectElem, 'value')).to.equal('Test Draft - New Message');
        expect((await composePage.read('@input-body'))?.trim()).to.equal('Testing Drafts (Do not delete)');
        for (const elem of await composePage.target.$$('.container-cc-bcc-buttons > span')) {
          expect(await PageRecipe.getElementPropertyJson(elem, 'offsetHeight')).to.equal(0); // CC/BCC btn isn't visible
        }
      })
    );

    test(
      'compose - loading drafts - PKCS#7 encrypted draft',
      testWithBrowser(async (t, browser) => {
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {},
          },
        });
        const acctEmail = 'flowcrypt.test.key.imported@gmail.com';
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acctEmail);
        await SetupPageRecipe.setupSmimeAccount(settingsPage, {
          expired: true,
          title: 's/mime pkcs12 unprotected key',
          filePath: 'test/samples/smime/human-unprotected-PKCS12.p12',
          armored: null, // eslint-disable-line no-null/no-null
          passphrase: 'test pp to encrypt unprotected key',
          longid: null, // eslint-disable-line no-null/no-null
        });
        await settingsPage.close();
        const appendUrl = 'draftId=17c041fd27858466';
        const composePage = await ComposePageRecipe.openStandalone(t, browser, acctEmail, { appendUrl });
        await expectRecipientElements(composePage, { to: [{ email: 'smime@recipient.com' }] });
        const subjectElem = await composePage.waitAny('@input-subject');
        expect(await PageRecipe.getElementPropertyJson(subjectElem, 'value')).to.equal('Test S/MIME Encrypted Draft');
        expect((await composePage.read('@input-body'))?.trim()).to.equal('test text');
      })
    );

    test(
      'compose - loading drafts - PKCS#7 encrypted draft with forgotten non-primary pass phrase',
      testWithBrowser(async (t, browser) => {
        const acctEmail = 'flowcrypt.test.key.imported@gmail.com';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {},
          },
        });
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acctEmail);
        await SetupPageRecipe.manualEnter(
          settingsPage,
          'unused',
          {
            submitPubkey: false,
            usedPgpBefore: false,
            key: {
              title: '?',
              armored: testConstants.testKeyMultiple1b383d0334e38b28,
              passphrase: '1234',
              longid: '1b383d0334e38b28',
            },
          },
          { isSavePassphraseChecked: false, isSavePassphraseHidden: false }
        );
        const forgottenPassphrase = 'this passphrase is forgotten';
        await SettingsPageRecipe.addKeyTestEx(
          t,
          browser,
          acctEmail,
          { filePath: 'test/samples/smime/human-unprotected-PKCS12.p12' },
          forgottenPassphrase,
          {},
          false
        );
        const inboxPage = await browser.newPage(t, t.urls?.extensionInbox(acctEmail) + '&labelId=DRAFT&debug=___cu_true___');
        await InboxPageRecipe.finishSessionOnInboxPage(inboxPage);
        const inboxTabId = await PageRecipe.getTabId(inboxPage);
        // send message from a different tab
        await PageRecipe.sendMessage(settingsPage, {
          name: 'open_compose_window',
          data: { bm: { draftId: '17c041fd27858466' }, objUrls: {} },
          to: inboxTabId,
          uid: '2',
        });
        await inboxPage.waitAll('@container-new-message');
        await Util.sleep(0.5);
        const composeFrame = await inboxPage.getFrame(['compose.htm']);
        await composeFrame.waitAndClick('@action-open-passphrase-dialog');
        const passphraseDialog = await inboxPage.getFrame(['passphrase.htm']);
        await passphraseDialog.waitForSelTestState('ready');
        expect(await passphraseDialog.read('@passphrase-text')).to.equal('Enter FlowCrypt pass phrase to load a draft');
        const whichKeyText = await passphraseDialog.read('@which-key');
        expect(whichKeyText).to.include('9B5F CFF5 76A0 3249 5AFE 7780 5354 351B 39AB 3BC6');
        expect(whichKeyText).to.not.include('CB04 85FE 44FC 22FF 09AF 0DB3 1B38 3D03 34E3 8B28');
        await passphraseDialog.waitAndType('@input-pass-phrase', forgottenPassphrase);
        await passphraseDialog.waitAndClick('@action-confirm-pass-phrase-entry');
        await composeFrame.waitForContent('@input-body', 'test text');
        await inboxPage.close();
        await settingsPage.close();
      })
    );

    test(
      'compose - check reply to multiple recipients issue',
      testWithBrowser(async (t, browser) => {
        const acct = 'flowcrypt.compatibility@gmail.com';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'compatibility');
        const appendUrl = 'threadId=183ec175f060b2c2&skipClickPrompt=___cu_false___&replyMsgId=183ec175f060b2c2';
        const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', {
          appendUrl,
          hasReplyPrompt: true,
          skipClickPropt: true,
        });
        await composePage.waitAndClick('@encrypted-reply');
        await composePage.waitForContent('@recipients-preview', 'sender@domain.com');
        await composePage.waitAndClick('@action-show-container-cc-bcc-buttons');
        await expectRecipientElements(composePage, { to: [{ email: 'sender@domain.com' }] });
        await composePage.waitAndClick('@action-remove-senderdomaincom-recipient');
        await expectRecipientElements(composePage, { to: [] });
      })
    );

    test(
      'compose - change reply option while composing',
      testWithBrowser(async (t, browser) => {
        const acct = 'flowcrypt.compatibility@gmail.com';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'compatibility');
        const appendUrl = 'threadId=183ec175f060b2c2&skipClickPrompt=___cu_false___&replyMsgId=183ec175f060b2c2';
        const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', {
          appendUrl,
          hasReplyPrompt: true,
        });
        await composePage.waitAndClick('@action-accept-reply-all-prompt');
        await composePage.waitForContent('@recipients-preview', 'sender@domain.comtest@gmail.comtest2@gmail.comtest3@gmail.comtest4@gmail.comtest5@gmail.com');
        await composePage.waitAndClick('@action-show-reply-options-popover');
        await composePage.waitAndClick('@action-toggle-a_reply');
        await composePage.waitForContent('@recipients-preview', 'sender@domain.com');
        await composePage.waitAndClick('@action-show-reply-options-popover');
        await composePage.waitAndClick('@action-toggle-a_forward');
        await composePage.waitUntilFocused('@input-to');
        await expectRecipientElements(composePage, { to: [], cc: [], bcc: [] });
        await composePage.waitAndClick('@action-show-reply-options-popover');
        await composePage.waitAndClick('@action-toggle-a_reply_all');
        await composePage.waitForContent('@recipients-preview', 'sender@domain.comtest@gmail.comtest2@gmail.comtest3@gmail.comtest4@gmail.comtest5@gmail.com');
      })
    );

    test(
      'compose - hide reply all option button for signle recipient',
      testWithBrowser(async (t, browser) => {
        const acct = 'flowcrypt.compatibility@gmail.com';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'compatibility');
        const appendUrl = 'threadId=182263bf9f105adf&skipClickPrompt=___cu_false___&replyMsgId=182263bf9f105adf';
        const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', {
          appendUrl,
          hasReplyPrompt: true,
        });
        await composePage.waitAndClick('@encrypted-reply');
        await composePage.waitAndClick('@action-show-reply-options-popover');
        await composePage.notPresent('@action-toggle-a_reply_all');
      })
    );

    // todo: load a draft encrypted by non-first key, enetering passphrase for it
    test(
      'compose - loading drafts - reply',
      testWithBrowser(async (t, browser) => {
        const acct = 'flowcrypt.compatibility@gmail.com';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'compatibility');
        const appendUrl = 'threadId=16cfa9001baaac0a&skipClickPrompt=___cu_false___&ignoreDraft=___cu_false___&replyMsgId=16cfa9001baaac0a&draftId=draft-3';
        const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', {
          appendUrl,
          hasReplyPrompt: true,
          skipClickPropt: true,
        });
        await composePage.waitAndClick('@action-show-container-cc-bcc-buttons');
        await expectRecipientElements(composePage, {
          to: [{ email: 'flowcryptcompatibility@gmail.com', name: 'First Last' }],
        });
        expect(await composePage.read('@input-body')).to.include('Test Draft Reply (Do not delete, tests is using this draft)');
      })
    );

    test(
      'compose - key-mismatch - standalone - key mismatch loading',
      testWithBrowser(async (t, browser) => {
        const acct = 'flowcrypt.compatibility@gmail.com';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'compatibility');
        const params =
          'threadId=15f7f5630573be2d&skipClickPrompt=___cu_true___&ignoreDraft=___cu_true___&replyMsgId=15f7f5630573be2d&disableDraftSaving=___cu_true___&replyPubkeyMismatch=___cu_true___';
        const replyMismatchPage = await browser.newPage(
          t,
          'chrome/elements/compose.htm?account_email=flowcrypt.compatibility%40gmail.com&parent_tab_id=0&debug=___cu_true___&frameId=none&' + params
        );
        await replyMismatchPage.waitForSelTestState('ready');
        await Util.sleep(3);
        await expectRecipientElements(replyMismatchPage, { to: [{ email: 'censored@email.com' }], cc: [], bcc: [] });
        expect(await replyMismatchPage.read('@input-body')).to.include(
          'I was not able to read your encrypted message because it was encrypted for a wrong key.'
        );
        await replyMismatchPage.waitAll('.qq-upload-file');
        await ComposePageRecipe.sendAndClose(replyMismatchPage);
      })
    );

    test(
      'compose - reply all - TO/CC/BCC when replying all',
      testWithBrowser(async (t, browser) => {
        const acct = 'flowcrypt.compatibility@gmail.com';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'compatibility');
        const appendUrl = `threadId=16d6a6c2d6ae618f&skipClickPrompt=___cu_false___&ignoreDraft=___cu_false___&replyMsgId=16d6a6c2d6ae618f`;
        const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', {
          appendUrl,
          hasReplyPrompt: true,
        });
        await composePage.waitAndClick('@action-accept-reply-all-prompt');
        await composePage.waitForSelTestState('ready'); // continue when all recipients get evaluated
        await composePage.waitAndClick('@action-show-container-cc-bcc-buttons');
        for (const type of ['to', 'cc', 'bcc']) {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const container = (await composePage.waitAny(`@container-${type}`))!;
          const recipients = await container.$$('.recipients > span');
          expect(recipients.length).to.equal(2);
          for (const recipient of recipients) {
            const textContent = await PageRecipe.getElementPropertyJson(recipient, 'textContent');
            expect(textContent.trim()).to.include('@flowcrypt.com');
          }
        }
      })
    );

    test(
      'compose - send new plain message',
      testWithBrowser(async (t, browser) => {
        const acct = 'ci.tests.gmail@flowcrypt.test';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
        const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
        await ComposePageRecipe.fillMsg(composePage, { to: 'human@flowcrypt.com' }, 'New Plain Message', undefined, {
          encrypt: false,
          sign: false,
        });
        await ComposePageRecipe.sendAndClose(composePage);
      })
    );

    test(
      'compose - reply - signed message with attachment - can be downloaded after send',
      testWithBrowser(async (t, browser) => {
        const acct = 'flowcrypt.compatibility@gmail.com';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'compatibility');
        const appendUrl = 'threadId=15f7f5face7101db&skipClickPrompt=___cu_false___&ignoreDraft=___cu_false___&replyMsgId=15f7f5face7101db';
        const attachmentFilename = 'small.txt';
        const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', {
          appendUrl,
          hasReplyPrompt: true,
        });
        await composePage.waitAndClick('@encrypted-reply', { delay: 1 });
        await composePage.waitAll('@action-send');
        await Util.sleep(0.5);
        expect(await composePage.read('@action-send')).to.eq('Sign and Send');
        await composePage.waitAndClick('@action-show-options-popover');
        await composePage.waitAll(['@action-toggle-sign', '@action-toggle-encrypt', '@icon-toggle-sign-tick']);
        await composePage.notPresent(['@icon-toggle-encrypt-tick']); // response to signed message should not be auto-encrypted
        const fileInput = (await composePage.target.$('input[type=file]')) as ElementHandle<HTMLInputElement>;
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        await fileInput!.uploadFile(`test/samples/${attachmentFilename}`);
        await composePage.waitAndClick('@action-send', { delay: 1 });
        await composePage.waitForContent('@replied-to', 'to: censored@email.com');
        const attachment = await composePage.getFrame(['attachment.htm', `name=${attachmentFilename}`]);
        await attachment.waitForSelTestState('ready');
        const downloadedFiles = await composePage.awaitDownloadTriggeredByClicking(async () => {
          await attachment.click('#download');
        });
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        expect(downloadedFiles[attachmentFilename]!.toString()).to.equal(`small text file\nnot much here\nthis worked\n`);
        await composePage.close();
      })
    );

    test(
      'compose - enforce message signing when encrypting',
      testWithBrowser(async (t, browser) => {
        const acct = 'flowcrypt.compatibility@gmail.com';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'compatibility');
        const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility');
        await ComposePageRecipe.setPopoverToggle(composePage, 'sign', false);
        // Should still encryptSignSend because we enfore message signing when encrypting
        expect(await composePage.read('@action-send')).to.eq('Encrypt, Sign and Send');
        await ComposePageRecipe.setPopoverToggle(composePage, 'encrypt', false);
        expect(await composePage.read('@action-send')).to.eq('Sign and Send');
        await ComposePageRecipe.setPopoverToggle(composePage, 'sign', false);
        expect(await composePage.read('@action-send')).to.eq('Send plain');
        await ComposePageRecipe.setPopoverToggle(composePage, 'encrypt', true);
        // on "encrypt" clicking, if user is enabling "encrypt", it should also auto-enable "sign"
        expect(await composePage.read('@action-send')).to.eq('Encrypt, Sign and Send');
        await composePage.close();
      })
    );

    test(
      'compose - send btn should be disabled while encrypting/sending',
      testWithBrowser(async (t, browser) => {
        const acct = 'ci.tests.gmail@flowcrypt.test';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
              'human@flowcrypt.com': {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
        const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
        await ComposePageRecipe.fillMsg(composePage, { to: 'human@flowcrypt.com' }, undefined);
        await composePage.waitAndClick('@action-send', { delay: 1 });
        expect(await composePage.isDisabled('#send_btn')).to.be.true;
        expect(await composePage.isDisabled('#toggle_send_options')).to.be.true;
        await composePage.waitAndRespondToModal('confirm', 'cancel', 'Send without a subject?');
        expect(await composePage.isDisabled('#send_btn')).to.be.false;
        expect(await composePage.isDisabled('#toggle_send_options')).to.be.false;
      })
    );

    test(
      'compose - load contacts through API',
      testWithBrowser(async (t, browser) => {
        const acct = 'ci.tests.gmail@flowcrypt.test';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
        let composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
        await composePage.waitAndClick('@action-show-container-cc-bcc-buttons');
        await composePage.type('@input-to', 'contact');
        if (testVariant === 'CONSUMER-MOCK') {
          // consumer does not get Contacts scope automatically (may scare users when they install)
          // first search, did not yet receive contacts scope - should find no contacts
          await ComposePageRecipe.expectContactsResultEqual(composePage, ['No Contacts Found']);
          // allow contacts scope, and expect that it will find a contact
          const oauthPopup = await browser.newPageTriggeredBy(t, () => composePage.waitAndClick('@action-auth-with-contacts-scope'));
          await OauthPageRecipe.google(t, oauthPopup, 'ci.tests.gmail@flowcrypt.test', 'approve');
        }
        await Util.sleep(3);
        await ComposePageRecipe.expectContactsResultEqual(composePage, ['contact.test@flowcrypt.com']);
        // re-load the compose window, expect that it remembers scope was connected, and remembers the contact
        composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
        await composePage.waitAndClick('@action-show-container-cc-bcc-buttons');
        await composePage.type('@input-to', 'contact');
        await ComposePageRecipe.expectContactsResultEqual(composePage, ['contact.test@flowcrypt.com']);
        await composePage.notPresent('@action-auth-with-contacts-scope');
      })
    );

    test(
      'compose - delete recipients with keyboard',
      testWithBrowser(async (t, browser) => {
        const acct = 'flowcrypt.compatibility@gmail.com';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'compatibility');
        const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility');
        await ComposePageRecipe.fillRecipients(composePage, { to: 'human1@flowcrypt.com' });
        await composePage.waitAndType(`@input-to`, 'human2@flowcrypt.com');
        await composePage.press('Enter');
        await composePage.waitAndType(`@input-to`, 'human3@flowcrypt.com');
        await composePage.press('Enter');
        await expectRecipientElements(composePage, {
          to: [{ email: 'human1@flowcrypt.com' }, { email: 'human2@flowcrypt.com' }, { email: 'human3@flowcrypt.com' }],
        });
        // delete recipient with Backspace when #input_to is focued
        await composePage.press('Backspace');
        await expectRecipientElements(composePage, {
          to: [{ email: 'human1@flowcrypt.com' }, { email: 'human2@flowcrypt.com' }],
        });
        // delete recipient with Delete when it's focused
        await composePage.waitAndFocus('@recipient_0');
        await composePage.press('Delete');
        await expectRecipientElements(composePage, { to: [{ email: 'human2@flowcrypt.com' }] });
        // delete recipient with Backspace when it's focused
        await composePage.waitAndFocus('@recipient_1');
        await composePage.press('Backspace');
        await expectRecipientElements(composePage, { to: [] });
      })
    );

    test(
      'compose - enter recipient which is not in the contact list',
      testWithBrowser(async (t, browser) => {
        const acct = 'flowcrypt.compatibility@gmail.com';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'compatibility');
        const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility');
        await composePage.waitAndType(`@input-to`, 'unknown@flowcrypt.test');
        // for enterprise the 'No Contacts Found' popup won't be shown because Google is connected
        if (testVariant === 'CONSUMER-MOCK') {
          await composePage.waitForContent('@container-contacts', 'No Contacts Found');
        }
        await composePage.press('Enter');
        await composePage.waitTillGone('@container-contacts');
      })
    );

    test(
      'compose - new message, check signature',
      testWithBrowser(async (t, browser) => {
        const acct = 'flowcrypt.compatibility@gmail.com';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
              'human@flowcrypt.com': {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'compatibility');
        const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility');
        await ComposePageRecipe.fillRecipients(composePage, { to: 'human@flowcrypt.com' });
        await composePage.waitAndClick(`@action-send`);
        expect(await composePage.read('.swal2-html-container')).to.include('Send without a subject?');
        await composePage.waitAndClick('.swal2-cancel');
        await composePage.waitAndType('@input-subject', 'Testing new message with footer', { delay: 1 });
        await composePage.waitAndClick(`@action-send`);
        expect(await composePage.read('.swal2-html-container')).to.include('Send empty message?');
        await composePage.waitAndClick('.swal2-cancel');
        const footer = await composePage.read('@input-body');
        expect(footer).to.eq('\n\n\n--\nflowcrypt.compatibility test footer with an img');
        await composePage.waitAndClick(`@action-send`);
        expect(await composePage.read('.swal2-html-container')).to.include('Send empty message?');
        await composePage.waitAndClick('.swal2-cancel');
        await composePage.waitAndType('@input-body', 'New message\n' + footer, { delay: 1 });
        await ComposePageRecipe.sendAndClose(composePage);
      })
    );

    test(
      'compose - new message, Footer Mock Test',
      testWithBrowser(async (t, browser) => {
        const acct = 'flowcrypt.compatibility@gmail.com';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
              'human@flowcrypt.com': {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'compatibility');
        const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility');
        const footer = await composePage.read('@input-body');
        await ComposePageRecipe.fillMsg(composePage, { to: 'human@flowcrypt.com' }, 'Test Footer (Mock Test)\n' + footer, undefined, {});
        await ComposePageRecipe.sendAndClose(composePage);
      })
    );

    test(
      'compose - loading drafts - test tags in draft',
      testWithBrowser(async (t, browser) => {
        const acct = 'flowcrypt.compatibility@gmail.com';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'compatibility');
        const appendUrl = 'draftId=draft-0';
        const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', { appendUrl });
        expect(await composePage.read('@input-body')).to.include('hello<draft>here');
      })
    );

    test(
      'compose - compose - test minimizing/maximizing',
      testWithBrowser(async (t, browser) => {
        const acct = 'ci.tests.gmail@flowcrypt.test';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
        const inboxPage = await browser.newPage(t, 'chrome/settings/inbox/inbox.htm?acctEmail=ci.tests.gmail%40flowcrypt.test');
        await inboxPage.waitAndClick('@action-open-secure-compose-window');
        await inboxPage.waitAll(['@container-new-message']);
        const composeFrame = await inboxPage.getFrame(['compose.htm']);
        await composeFrame.waitForSelTestState('ready');
        const composeBody = await composeFrame.waitAny('body');
        const initialWidth = Number(await PageRecipe.getElementPropertyJson(composeBody, 'offsetWidth'));
        const initialHeight = Number(await PageRecipe.getElementPropertyJson(composeBody, 'offsetHeight'));
        await composeFrame.waitAndClick('.popout', { sleepWhenDone: 1 });
        expect(Number(await PageRecipe.getElementPropertyJson(composeBody, 'offsetWidth'))).to.be.greaterThan(
          initialWidth,
          'popout width greater than initial'
        );
        expect(Number(await PageRecipe.getElementPropertyJson(composeBody, 'offsetHeight'))).to.be.greaterThan(
          initialHeight,
          'popout weight greater than initial'
        );
        await composeFrame.waitAndClick('.popout', { sleepWhenDone: 1 });
        expect(Number(await PageRecipe.getElementPropertyJson(composeBody, 'offsetWidth'))).to.equal(initialWidth, 'width back to initial');
        expect(Number(await PageRecipe.getElementPropertyJson(composeBody, 'offsetHeight'))).to.equal(initialHeight, 'height back to initial');
        await composeFrame.waitAndClick('.minimize_compose_window', { sleepWhenDone: 1 });
        expect(Number(await PageRecipe.getElementPropertyJson(composeBody, 'offsetHeight'))).to.be.lessThan(initialHeight, 'minimized lower than initial');
        await composeFrame.waitAndClick('.minimize_compose_window', { sleepWhenDone: 1 });
        expect(Number(await PageRecipe.getElementPropertyJson(composeBody, 'offsetHeight'))).to.equal(initialHeight, 'back to initial after un-minimizing');
      })
    );

    test(
      'compose - saving and rendering a draft with image',
      testWithBrowser(async (t, browser) => {
        const acct = 'flowcrypt.compatibility@gmail.com';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'compatibility');
        const imgBase64 =
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAAnElEQVR42u3RAQ0AAAgDIE1u9FvDOahAVzLFGS1ECEKEIEQIQoQgRIgQIQgRghAhCBGCECEIQYgQhAhBiBCECEEIQoQgRAhChCBECEIQIgQhQhAiBCFCEIIQIQgRghAhCBGCEIQIQYgQhAhBiBCEIEQIQoQgRAhChCAEIUIQIgQhQhAiBCEIEYIQIQgRghAhCBEiRAhChCBECEK+W3uw+TnWoJc/AAAAAElFTkSuQmCC';
        let composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility');
        const subject = `saving and rendering a draft with image ${Util.lousyRandom()}`;
        await ComposePageRecipe.fillMsg(composePage, { to: 'human@flowcrypt.com' }, subject, undefined, {
          richtext: true,
        });
        await composePage.page.evaluate((src: string) => {
          $('[data-test=action-insert-image]').val(src).click();
        }, imgBase64);
        await ComposePageRecipe.waitWhenDraftIsSaved(composePage);
        await composePage.close();
        composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', {
          appendUrl: 'draftId=draft_with_image',
        });
        const body = await composePage.waitAny('@input-body');
        await composePage.waitAll('#input_text img');
        expect(await body.$eval('#input_text img', el => el.getAttribute('src'))).to.eq(imgBase64);
      })
    );

    test(
      'compose - leading tabs',
      testWithBrowser(async (t, browser) => {
        const acct = 'flowcrypt.compatibility@gmail.com';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'compatibility');
        const appendUrl = 'threadId=16b584ed95837510&skipClickPrompt=___cu_false___&ignoreDraft=___cu_false___&replyMsgId=16b584ed95837510';
        const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', {
          appendUrl,
          hasReplyPrompt: true,
        });
        await composePage.waitAndClick('@encrypted-reply', { delay: 5 });
        const bodyWithLeadingTabs = '\tline 1\n\t\tline 2';
        await ComposePageRecipe.fillMsg(composePage, {}, undefined, bodyWithLeadingTabs);
        await composePage.click('@action-send');
        await composePage.waitForContent('@container-reply-msg-successful', bodyWithLeadingTabs);
        await composePage.waitForContent('@replied-to', 'to: First Last <flowcrypt.compatibility@gmail.com>');
      })
    );

    test(
      'compose - RTL subject',
      testWithBrowser(async (t, browser) => {
        const acct = 'flowcrypt.compatibility@gmail.com';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'compatibility');
        const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility');
        await composePage.type('@input-subject', 'ش');
        expect(await composePage.attr('@input-subject', 'dir')).to.eq('rtl');
        await composePage.press('Backspace');
        expect(await composePage.attr('@input-subject', 'dir')).to.be.null;
        await composePage.type('@input-subject', 'a');
        expect(await composePage.attr('@input-subject', 'dir')).to.be.null;
      })
    );

    test(
      'compose - saving and rendering a draft with RTL text (plain text)',
      testWithBrowser(async (t, browser) => {
        const acct = 'flowcrypt.compatibility@gmail.com';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'compatibility');
        let composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility');
        const subject = `مرحبا RTL plain text`;
        await Util.sleep(5); // until #5037 is fixed
        await ComposePageRecipe.fillMsg(composePage, { to: 'human@flowcrypt.com' }, subject, 'مرحبا', {
          richtext: false,
        });
        await ComposePageRecipe.waitWhenDraftIsSaved(composePage);
        await composePage.close();
        composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', {
          appendUrl: 'draftId=draft_with_rtl_text_plain',
        });
        expect(await composePage.attr('@input-subject', 'dir')).to.eq('rtl');
        expect(await composePage.readHtml('@input-body')).to.include('<div dir="rtl">مرحبا<br></div>');
      })
    );

    test(
      'compose - saving and rendering a draft with RTL text (rich text)',
      testWithBrowser(async (t, browser) => {
        const acct = 'flowcrypt.compatibility@gmail.com';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'compatibility');
        let composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility');
        const subject = `مرحبا RTL rich text`;
        await Util.sleep(5); // until #5037 is fixed
        await ComposePageRecipe.fillMsg(composePage, { to: 'human@flowcrypt.com' }, subject, 'مرحبا', {
          richtext: true,
        });
        await ComposePageRecipe.waitWhenDraftIsSaved(composePage);
        await composePage.close();
        composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', {
          appendUrl: 'draftId=draft_with_rtl_text_rich',
        });
        expect(await composePage.readHtml('@input-body')).to.include('<div dir="rtl">مرحبا<br></div>');
      })
    );

    test(
      'compose - sending PGP/MIME encrypted message',
      testWithBrowser(async (t, browser) => {
        const acct = 'flowcrypt.compatibility@gmail.com';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'compatibility');
        const subject = `Test Sending Encrypted PGP/MIME Message`;
        const body = `This text is encrypted`;
        const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility');
        await ComposePageRecipe.fillMsg(composePage, { to: 'flowcrypt.compatibility@gmail.com' }, subject, body, {
          richtext: true,
          sign: true,
          encrypt: true,
        });
        await composePage.waitAndClick('@action-include-pubkey');
        expect(await composePage.hasClass('@action-include-pubkey', 'active')).to.be.true;
        await ComposePageRecipe.sendAndClose(composePage); // the sent message is checked by PgpEncryptedMessageWithoutAttachmentTestStrategy
      })
    );

    test(
      'compose - sending and rendering encrypted message with image',
      testWithBrowser(async (t, browser) => {
        const acct = 'flowcrypt.compatibility@gmail.com';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
              'human@flowcrypt.com': {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'compatibility');
        await sendImgAndVerifyPresentInSentMsg(t, browser, 'encrypt');
      })
    );

    test(
      'compose - sending and rendering signed message with image',
      testWithBrowser(async (t, browser) => {
        const acct = 'flowcrypt.compatibility@gmail.com';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'compatibility');
        await sendImgAndVerifyPresentInSentMsg(t, browser, 'sign');
      })
    );

    test(
      'compose - sending and rendering plain message with image',
      testWithBrowser(async (t, browser) => {
        const acct = 'flowcrypt.compatibility@gmail.com';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'compatibility');
        await sendImgAndVerifyPresentInSentMsg(t, browser, 'plain');
      })
    );

    test(
      'compose - sending a message encrypted with all keys of a recipient',
      testWithBrowser(async (t, browser) => {
        const acct = 'flowcrypt.compatibility@gmail.com';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'compatibility');
        const text = 'This message is encrypted with 2 keys of flowcrypt.compatibility';
        const subject = `Test Sending Multi-Encrypted Message With Test Text ${Util.lousyRandom()}`;
        const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility');
        await ComposePageRecipe.fillMsg(composePage, { to: acct }, subject, text, {
          sign: true,
          encrypt: true,
        });
        await ComposePageRecipe.sendAndClose(composePage);
        /* eslint-disable @typescript-eslint/no-non-null-assertion */
        // get sent msg from mock
        const sentMsg = (await GoogleData.withInitializedData(acct)).searchMessagesBySubject(subject)[0];
        const message = sentMsg.payload!.body!.data!;
        const encryptedData = message.match(/\-\-\-\-\-BEGIN PGP MESSAGE\-\-\-\-\-.*\-\-\-\-\-END PGP MESSAGE\-\-\-\-\-/s)![0];
        /* eslint-enable @typescript-eslint/no-non-null-assertion */
        const decrypted0 = await MsgUtil.decryptMessage({ kisWithPp: [], encryptedData, verificationPubs: [] });
        // decryption without a ki should fail
        expect(decrypted0.success).to.equal(false);
        // decryption with ki 1 should succeed
        const decrypted1 = await MsgUtil.decryptMessage({
          kisWithPp: await Config.getKeyInfo(['flowcrypt.compatibility.1pp1']),
          encryptedData,
          verificationPubs: [],
        });
        expect(decrypted1.success).to.equal(true);
        // decryption with ki 2 should succeed
        const decrypted2 = await MsgUtil.decryptMessage({
          kisWithPp: await Config.getKeyInfo(['flowcrypt.compatibility.2pp1']),
          encryptedData,
          verificationPubs: [],
        });
        expect(decrypted2.success).to.equal(true);
      })
    );

    test(
      'compose - sending and rendering message with U+10000 code points',
      testWithBrowser(async (t, browser) => {
        const acct = 'flowcrypt.compatibility@gmail.com';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
              'human@flowcrypt.com': {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'compatibility');
        const rainbow = '\ud83c\udf08';
        await sendTextAndVerifyPresentInSentMsg(t, browser, rainbow, { sign: true, encrypt: false });
        await sendTextAndVerifyPresentInSentMsg(t, browser, rainbow, { sign: false, encrypt: true });
        await sendTextAndVerifyPresentInSentMsg(t, browser, rainbow, { sign: true, encrypt: true });
      })
    );

    test(
      "compose - sent message should't have version and comment based on ClientConfiguration",
      testWithBrowser(async (t, browser) => {
        const acct = 'has.pub@client-configuration-test.flowcrypt.test';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            ldapRelay: {
              [acct]: {
                pubkey: hasPubKey,
              },
              'human@flowcrypt.com': {
                pubkey: somePubkey,
              },
            },
          },
        });
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acct);
        await SetupPageRecipe.manualEnter(
          settingsPage,
          'has.pub.client.configuration.test',
          { noPrvCreateClientConfiguration: true, enforceAttesterSubmitClientConfiguration: true },
          { isSavePassphraseChecked: false, isSavePassphraseHidden: false }
        );
        const subject = `Test Sending Message With Test Text and HIDE_ARMOR_META ClientConfiguration ${Util.lousyRandom()}`;
        const composePage = await ComposePageRecipe.openStandalone(t, browser, acct);
        await ComposePageRecipe.fillMsg(composePage, { to: 'human@flowcrypt.com' }, subject, undefined, { sign: true });
        await ComposePageRecipe.sendAndClose(composePage);
        /* eslint-disable @typescript-eslint/no-non-null-assertion */
        // get sent msg from mock
        const sentMsg = (await GoogleData.withInitializedData(acct)).searchMessagesBySubject(subject)[0];
        const message = sentMsg.payload!.body!.data!;
        /* eslint-enable @typescript-eslint/no-non-null-assertion */
        expect(message).to.include('-----BEGIN PGP MESSAGE-----');
        expect(message).to.include('-----END PGP MESSAGE-----');
        expect(message).to.not.include('Version');
        expect(message).to.not.include('Comment');
      })
    );

    test(
      'compose - multiple compose windows - opening, max 3, order, active',
      testWithBrowser(async (t, browser) => {
        const acct = 'ci.tests.gmail@flowcrypt.test';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
        const inboxPage = await browser.newExtensionInboxPage(t, acct);
        // open 3 compose windows
        await inboxPage.waitAndClick('@action-open-secure-compose-window', { sleepWhenDone: 1 });
        await inboxPage.waitAndClick('@action-open-secure-compose-window', { sleepWhenDone: 1 });
        await inboxPage.waitAndClick('@action-open-secure-compose-window', { sleepWhenDone: 1 });
        let secureComposeWindows = await inboxPage.target.$$('.secure_compose_window');
        expect(secureComposeWindows.length).to.equal(3);
        // try to open the 4th one
        await inboxPage.click('@action-open-secure-compose-window');
        await inboxPage.waitForContent('.ui-toast-title', 'Only 3 FlowCrypt windows can be opened at a time');
        // make sure the data-order attributes are correct
        expect(await PageRecipe.getElementAttribute(secureComposeWindows[0], 'data-order')).to.equal('1');
        expect(await PageRecipe.getElementAttribute(secureComposeWindows[1], 'data-order')).to.equal('2');
        expect(await PageRecipe.getElementAttribute(secureComposeWindows[2], 'data-order')).to.equal('3');
        // make sure the 3rd compose window is active, and the 2nd is previous_active
        expect(await inboxPage.hasClass('.secure_compose_window[data-order="1"]', 'active')).to.be.false;
        expect(await inboxPage.hasClass('.secure_compose_window[data-order="2"]', 'active')).to.be.false;
        expect(await inboxPage.hasClass('.secure_compose_window[data-order="3"]', 'active')).to.be.true;
        expect(await inboxPage.hasClass('.secure_compose_window[data-order="1"]', 'previous_active')).to.be.false;
        expect(await inboxPage.hasClass('.secure_compose_window[data-order="2"]', 'previous_active')).to.be.true;
        expect(await inboxPage.hasClass('.secure_compose_window[data-order="3"]', 'previous_active')).to.be.false;
        const framesUrls = await inboxPage.getFramesUrls(['compose.htm']);
        expect(framesUrls.length).to.equal(3);
        // focus the 1st one
        const firstFrameId = framesUrls[0].match(/frameId=.*?&/s)![0];
        const firstComposeFrame = await inboxPage.getFrame(['compose.htm', firstFrameId]);
        await inboxPage.waitAndFocus('iframe');
        await firstComposeFrame.waitAndFocus('@input-body');
        // make sure the 1st compose window is active, and the 3rd is previous_active
        expect(await inboxPage.hasClass('.secure_compose_window[data-order="1"]', 'active')).to.be.true;
        expect(await inboxPage.hasClass('.secure_compose_window[data-order="2"]', 'active')).to.be.false;
        expect(await inboxPage.hasClass('.secure_compose_window[data-order="3"]', 'active')).to.be.false;
        expect(await inboxPage.hasClass('.secure_compose_window[data-order="1"]', 'previous_active')).to.be.false;
        expect(await inboxPage.hasClass('.secure_compose_window[data-order="2"]', 'previous_active')).to.be.false;
        expect(await inboxPage.hasClass('.secure_compose_window[data-order="3"]', 'previous_active')).to.be.true;
        // close the 1st one and make sure the order is recalculated
        await firstComposeFrame.click('@action-close-new-message');
        secureComposeWindows = await inboxPage.target.$$('.secure_compose_window');
        expect(secureComposeWindows.length).to.equal(2);
        expect(await PageRecipe.getElementAttribute(secureComposeWindows[0], 'data-order')).to.equal('1');
        expect(await PageRecipe.getElementAttribute(secureComposeWindows[1], 'data-order')).to.equal('2');
      })
    );

    test.skip(
      'oversize attachment does not get erroneously added',
      testWithBrowser(async (t, browser) => {
        const acct = 'ci.tests.gmail@flowcrypt.test';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
        const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
        // big file will get canceled
        const fileInput = (await composePage.target.$('input[type=file]')) as ElementHandle<HTMLInputElement>;
        const localpath = 'test/samples/oversize.txt';
        writeFileSync(localpath, 'x'.repeat(30 * 1024 * 1024));
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        await fileInput!.uploadFile(localpath); // 30mb
        await composePage.waitAndRespondToModal('confirm', 'cancel', 'Combined attachment size is limited to 25 MB. The last file brings it to 30 MB.');
        await Util.sleep(1);
        await composePage.notPresent('.qq-upload-file-selector');
        // small file will get accepted
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        await fileInput!.uploadFile('test/samples/small.png');
        await composePage.waitForContent('.qq-upload-file-selector', 'small.png');
      })
    );

    test(
      'rendered reply - can preview attachment',
      testWithBrowser(async (t, browser) => {
        const threadId = '173fd7dbe2fec90c';
        const acctEmail = 'ci.tests.gmail@flowcrypt.test';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acctEmail]: {
                pubkey: somePubkey,
              },
              'flowcrypt.compatibility@gmail.com': {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
        const inboxPage = await browser.newExtensionPage(t, `chrome/settings/inbox/inbox.htm?acctEmail=${acctEmail}&threadId=${threadId}`);
        await inboxPage.waitAll('iframe');
        const replyFrame = await inboxPage.getFrame(['compose.htm']);
        await replyFrame.waitAndClick('@encrypted-reply');
        const fileInput = (await replyFrame.target.$('input[type=file]')) as ElementHandle<HTMLInputElement>;
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        await fileInput!.uploadFile('test/samples/small.png');
        await replyFrame.waitAndClick('@action-send');
        const attachment = await replyFrame.getFrame(['attachment.htm', 'name=small.png']);
        await attachment.waitForSelTestState('ready');
        await attachment.click('body');
        const attachmentPreviewImage = await inboxPage.getFrame(['attachment_preview.htm']);
        await attachmentPreviewImage.waitAll('#attachment-preview-container img.attachment-preview-img');
        await attachmentPreviewImage.waitForContent('@attachment-preview-filename', 'small.png');
      })
    );

    test(
      'check attachment after switch to forward',
      testWithBrowser(async (t, browser) => {
        const acct = 'flowcrypt.compatibility@gmail.com';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'compatibility');
        const appendUrl = 'threadId=18625ff9e8642033&skipClickPrompt=___cu_false___&replyMsgId=18625ff9e8642033';
        const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', {
          appendUrl,
          hasReplyPrompt: true,
        });
        await composePage.waitAndClick('@encrypted-reply');
        await composePage.waitAndClick('@action-show-reply-options-popover');
        await composePage.waitAndClick('@action-toggle-a_forward');
        // Check attachment is still present after switch to forward
        await composePage.waitForContent('.qq-upload-file', 'test.txt');
        await composePage.waitAndClick('@action-show-reply-options-popover');
        await composePage.waitAndClick('@action-toggle-a_reply');
        await composePage.notPresent('.qq-upload-file');
      })
    );

    test(
      'attachments - failed to decrypt',
      testWithBrowser(async (t, browser) => {
        const acct = 'flowcrypt.compatibility@gmail.com';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'compatibility');
        const inboxPage = await browser.newExtensionPage(
          t,
          `chrome/settings/inbox/inbox.htm?acctEmail=flowcrypt.compatibility@gmail.com&threadId=162ec58d70fe04ef`
        );
        const attachment = await inboxPage.getFrame(['attachment.htm', 'name=Screenshot_20180422_125217.png.asc']);
        await attachment.waitAndClick('@download-attachment');
        await attachment.waitAndClick('@decrypt-error-details');
        const decryptErrorDetails = await inboxPage.getFrame(['attachment_preview.htm']);
        await decryptErrorDetails.waitForContent('@error-details', 'Error: Session key decryption failed'); // stack
        await decryptErrorDetails.waitForContent('@error-details', '"type": "key_mismatch"'); // DecryptError
      })
    );

    test(
      'timeouts when searching WKD - used to never time out',
      testWithBrowser(async (t, browser) => {
        const acct = 'ci.tests.gmail@flowcrypt.test';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
        const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
        await ComposePageRecipe.fillMsg(composePage, { to: 'somewhere@mac.com' }, 'should show no pubkey within a few seconds');
        await composePage.waitForContent('.email_address.no_pgp', 'somewhere@mac.com');
        await composePage.waitAll('@input-password');
      })
    );

    test.todo('compose - reply - new gmail threadId fmt');

    test.todo('compose - reply - skip click prompt');

    test(
      'send signed S/MIME message',
      testWithBrowser(async (t, browser) => {
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {},
          },
        });
        const acctEmail = 'flowcrypt.test.key.imported@gmail.com';
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acctEmail);
        await SetupPageRecipe.setupSmimeAccount(settingsPage, {
          title: 's/mime pkcs12 unprotected key',
          filePath: 'test/samples/smime/test-unprotected-PKCS12.p12',
          armored: null, // eslint-disable-line no-null/no-null
          passphrase: 'test pp to encrypt unprotected key',
          longid: null, // eslint-disable-line no-null/no-null
        });
        await settingsPage.close();
        const composePage = await ComposePageRecipe.openStandalone(t, browser, acctEmail);
        await ComposePageRecipe.fillMsg(composePage, { to: 'smime@recipient.com' }, 'send signed S/MIME without attachment', undefined, {
          encrypt: false,
          sign: true,
        });
        await composePage.waitAndClick('@action-send', { delay: 2 });
        await composePage.waitForSelTestState('closed', 20); // succesfully sent
        await composePage.close();
      })
    );

    test(
      'send signed and encrypted S/MIME message',
      testWithBrowser(async (t, browser) => {
        const acctEmail = 'flowcrypt.compatibility@gmail.com';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acctEmail]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'compatibility');
        const passphrase = 'pa$$w0rd';
        await SettingsPageRecipe.addKeyTest(t, browser, acctEmail, testConstants.testKeyMultipleSmimeCEA2D53BB9D24871, passphrase, {}, false);
        const inboxPage = await browser.newExtensionInboxPage(t, acctEmail);
        const composeFrame = await InboxPageRecipe.openAndGetComposeFrame(inboxPage);
        await ComposePageRecipe.fillMsg(
          composeFrame,
          { to: 'smime@recipient.com' },
          'send signed and encrypted S/MIME message',
          'This text should be encrypted into PKCS#7 data'
        );
        await ComposePageRecipe.pastePublicKeyManually(
          composeFrame,
          inboxPage,
          'smime@recipient.com',
          testConstants.testCertificateMultipleSmimeCEA2D53BB9D24871
        );
        await composeFrame.waitAndClick('@action-send', { delay: 2 });
        await inboxPage.waitTillGone('@container-new-message');
      })
    );

    test(
      'send signed and encrypted S/MIME message entering a non-primary passphrase',
      testWithBrowser(async (t, browser) => {
        const acctEmail = 'flowcrypt.compatibility@gmail.com';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acctEmail]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'compatibility');
        const passphrase = 'pa$$w0rd';
        await SettingsPageRecipe.addKeyTest(t, browser, acctEmail, testConstants.testKeyMultipleSmimeCEA2D53BB9D24871, passphrase, {}, false);
        const inboxPage = await browser.newExtensionInboxPage(t, acctEmail);
        await InboxPageRecipe.finishSessionOnInboxPage(inboxPage);
        const composeFrame = await InboxPageRecipe.openAndGetComposeFrame(inboxPage);
        await ComposePageRecipe.fillMsg(
          composeFrame,
          { to: 'smime@recipient.com' },
          'send signed and encrypted S/MIME message',
          'This text should be encrypted into PKCS#7 data'
        );
        await ComposePageRecipe.pastePublicKeyManually(
          composeFrame,
          inboxPage,
          'smime@recipient.com',
          testConstants.testCertificateMultipleSmimeCEA2D53BB9D24871
        );
        await composeFrame.waitAndClick('@action-send', { delay: 2 });
        const passphraseDialog = await inboxPage.getFrame(['passphrase.htm']);
        await passphraseDialog.waitForContent('@which-key', '47FB 0318 3E03 A8ED 44E3 BBFC CEA2 D53B B9D2 4871');
        await passphraseDialog.waitAndType('@input-pass-phrase', passphrase);
        await passphraseDialog.waitAndClick('@action-confirm-pass-phrase-entry');
        await inboxPage.waitTillGone('@container-new-message');
      })
    );

    test(
      'send with single S/MIME cert',
      testWithBrowser(async (t, browser) => {
        const acct = 'ci.tests.gmail@flowcrypt.test';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
        const inboxPage = await browser.newExtensionInboxPage(t, acct);
        const composeFrame = await InboxPageRecipe.openAndGetComposeFrame(inboxPage);
        await ComposePageRecipe.fillMsg(composeFrame, { to: 'smime@recipient.com' }, t.title, 'This text should be encrypted into PKCS#7 data', {
          sign: false,
          encrypt: true,
        });
        await ComposePageRecipe.pastePublicKeyManually(
          composeFrame,
          inboxPage,
          'smime@recipient.com',
          testConstants.testCertificateMultipleSmimeCEA2D53BB9D24871
        );
        await composeFrame.waitAndClick('@action-send', { delay: 2 });
        await inboxPage.waitTillGone('@container-new-message');
      })
    );

    test(
      'send with several S/MIME certs',
      testWithBrowser(async (t, browser) => {
        const acct = 'ci.tests.gmail@flowcrypt.test';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
        const inboxPage = await browser.newExtensionInboxPage(t, acct);
        const composeFrame = await InboxPageRecipe.openAndGetComposeFrame(inboxPage);
        await ComposePageRecipe.fillMsg(
          composeFrame,
          { to: 'smime1@recipient.com', cc: 'smime2@recipient.com' },
          t.title,
          'This text should be encrypted into PKCS#7 data',
          { sign: false, encrypt: true }
        );
        await ComposePageRecipe.pastePublicKeyManually(composeFrame, inboxPage, 'smime1@recipient.com', testConstants.smimeCert);
        await ComposePageRecipe.pastePublicKeyManually(
          composeFrame,
          inboxPage,
          'smime2@recipient.com',
          testConstants.testCertificateMultipleSmimeCEA2D53BB9D24871
        );
        await composeFrame.waitAndClick('@action-send', { delay: 2 });
        await inboxPage.waitTillGone('@container-new-message');
      })
    );

    test(
      'send encrypted-only S/MIME message with attachment',
      testWithBrowser(async (t, browser) => {
        const acct = 'ci.tests.gmail@flowcrypt.test';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
        const inboxPage = await browser.newExtensionInboxPage(t, acct);
        const composeFrame = await InboxPageRecipe.openAndGetComposeFrame(inboxPage);
        await ComposePageRecipe.fillMsg(composeFrame, { to: 'smime.attachment@recipient.com' }, t.title, 'This text should be encrypted into PKCS#7 data', {
          sign: false,
          encrypt: true,
        });
        await ComposePageRecipe.pastePublicKeyManually(
          composeFrame,
          inboxPage,
          'smime.attachment@recipient.com',
          testConstants.testCertificateMultipleSmimeCEA2D53BB9D24871
        );
        const fileInput = (await composeFrame.target.$('input[type=file]')) as ElementHandle<HTMLInputElement>;
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        await fileInput!.uploadFile('test/samples/small.txt', 'test/samples/small.png', 'test/samples/small.pdf');
        // attachments in composer can be downloaded
        const downloadedFiles = await inboxPage.awaitDownloadTriggeredByClicking(async () => {
          await composeFrame.click('.qq-file-id-0');
        });
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        expect(downloadedFiles['small.txt']!.toString()).to.equal(`small text file\nnot much here\nthis worked\n`);
        await composeFrame.waitAndClick('@action-send', { delay: 2 });
        await inboxPage.waitTillGone('@container-new-message');
      })
    );

    test(
      'send signed and encrypted S/MIME message with attachment',
      testWithBrowser(async (t, browser) => {
        // todo - this is not yet looking for actual attachment in the result, just checks that it's s/mime message
        const acctEmail = 'ci.tests.gmail@flowcrypt.test';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acctEmail]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
        const passphrase = 'pa$$w0rd';
        await SettingsPageRecipe.addKeyTest(t, browser, acctEmail, testConstants.testKeyMultipleSmimeCEA2D53BB9D24871, passphrase, {}, false);
        const inboxPage = await browser.newExtensionInboxPage(t, acctEmail);
        const composeFrame = await InboxPageRecipe.openAndGetComposeFrame(inboxPage);
        await ComposePageRecipe.fillMsg(composeFrame, { to: 'smime.attachment@recipient.com' }, t.title);
        await ComposePageRecipe.pastePublicKeyManually(
          composeFrame,
          inboxPage,
          'smime.attachment@recipient.com',
          testConstants.testCertificateMultipleSmimeCEA2D53BB9D24871
        );
        const fileInput = (await composeFrame.target.$('input[type=file]')) as ElementHandle<HTMLInputElement>;
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        await fileInput!.uploadFile('test/samples/small.txt', 'test/samples/small.png', 'test/samples/small.pdf');
        // attachments in composer can be downloaded
        const downloadedFiles = await inboxPage.awaitDownloadTriggeredByClicking(async () => {
          await composeFrame.click('.qq-file-id-0');
        });
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        expect(downloadedFiles['small.txt']!.toString()).to.equal(`small text file\nnot much here\nthis worked\n`);
        await composeFrame.waitAndClick('@action-send', { delay: 2 });
        await inboxPage.waitTillGone('@container-new-message');
      })
    );

    test(
      'send with mixed S/MIME and PGP recipients - should show err',
      testWithBrowser(async (t, browser) => {
        const acct = 'ci.tests.gmail@flowcrypt.test';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
              'human@flowcrypt.com': {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
        const inboxPage = await browser.newExtensionInboxPage(t, acct);
        const composeFrame = await InboxPageRecipe.openAndGetComposeFrame(inboxPage);
        await ComposePageRecipe.fillMsg(composeFrame, { to: 'smime@recipient.com', cc: 'human@flowcrypt.com' }, t.title);
        await ComposePageRecipe.pastePublicKeyManually(composeFrame, inboxPage, 'smime@recipient.com', testConstants.smimeCert);
        await composeFrame.waitAndClick('@action-send', { delay: 2 });
        await PageRecipe.waitForModalAndRespond(composeFrame, 'error', {
          contentToCheck:
            'Failed to send message due to: Error: Cannot use mixed OpenPGP (human@flowcrypt.com) and S/MIME (smime@recipient.com) public keys yet.If you need to email S/MIME recipient, do not add any OpenPGP recipient at the same time.',
          timeout: 40,
        });
      })
    );

    test(
      'send with OpenPGP recipients as subset of S/MIME recipients',
      testWithBrowser(async (t, browser) => {
        const acctEmail = 'ci.tests.gmail@flowcrypt.test';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acctEmail]: {
                pubkey: somePubkey,
              },
              'human@flowcrypt.com': {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
        const inboxPage = await browser.newExtensionInboxPage(t, acctEmail);
        const composeFrame = await InboxPageRecipe.openAndGetComposeFrame(inboxPage);
        await ComposePageRecipe.fillMsg(
          composeFrame,
          { to: 'smime@recipient.com', cc: 'human@flowcrypt.com' },
          'send with several S/MIME certs with OpenPGP as subset',
          'This text should be encrypted into PKCS#7 data'
        );
        await ComposePageRecipe.pastePublicKeyManually(
          composeFrame,
          inboxPage,
          'smime@recipient.com',
          testConstants.testCertificateMultipleSmimeCEA2D53BB9D24871
        );
        await composeFrame.waitAndClick('@action-send', { delay: 2 });
        await PageRecipe.waitForModalAndRespond(composeFrame, 'error', {
          contentToCheck:
            'Failed to send message due to: Error: Cannot use mixed OpenPGP (human@flowcrypt.com) and S/MIME (smime@recipient.com) public keys yet.If you need to email S/MIME recipient, do not add any OpenPGP recipient at the same time.',
          timeout: 40,
          clickOn: 'confirm',
        });
        // adding an S/MIME certificate for human@flowcrypt.com will allow sending an S/MIME message
        await PageRecipe.addPubkey(t, browser, acctEmail, testConstants.smimeCert, 'human@flowcrypt.com');
        await composeFrame.waitAndClick('@action-send', { delay: 2 });
        await inboxPage.waitTillGone('@container-new-message');
      })
    );

    test(
      'send with S/MIME recipients as subset of OpenPGP recipients',
      testWithBrowser(async (t, browser) => {
        const acctEmail = 'ci.tests.gmail@flowcrypt.test';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acctEmail]: {
                pubkey: somePubkey,
              },
              'human@flowcrypt.com': {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
        const inboxPage = await browser.newExtensionInboxPage(t, acctEmail);
        const composeFrame = await InboxPageRecipe.openAndGetComposeFrame(inboxPage);
        await ComposePageRecipe.fillMsg(
          composeFrame,
          { to: 'smime@recipient.com', cc: 'human@flowcrypt.com' },
          t.title,
          'This text should be encrypted into OpenPGP message'
        );
        await ComposePageRecipe.pastePublicKeyManually(
          composeFrame,
          inboxPage,
          'smime@recipient.com',
          testConstants.testCertificateMultipleSmimeCEA2D53BB9D24871
        );
        await composeFrame.waitAndClick('@action-send', { delay: 2 });
        await PageRecipe.waitForModalAndRespond(composeFrame, 'error', {
          contentToCheck:
            'Failed to send message due to: Error: Cannot use mixed OpenPGP (human@flowcrypt.com) and S/MIME (smime@recipient.com) public keys yet.If you need to email S/MIME recipient, do not add any OpenPGP recipient at the same time.',
          timeout: 40,
          clickOn: 'confirm',
        });
        // adding an OpenPGP pubkey for smime@recipient.com will allow sending an OpenPGP message
        await PageRecipe.addPubkey(t, browser, acctEmail, testConstants.pubkey2864E326A5BE488A, 'smime@recipient.com');
        await composeFrame.waitAndClick('@action-send', { delay: 2 });
        await inboxPage.waitTillGone('@container-new-message');
      })
    );

    test(
      'send with broken S/MIME cert - err',
      testWithBrowser(async (t, browser) => {
        const acctEmail = 'ci.tests.gmail@flowcrypt.test';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acctEmail]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
        const inboxPage = await browser.newExtensionInboxPage(t, acctEmail);
        const composeFrame = await InboxPageRecipe.openAndGetComposeFrame(inboxPage);
        await ComposePageRecipe.fillMsg(composeFrame, { to: 'smime@recipient.com' }, t.title);
        const brokenCert = testConstants.smimeCert.split('\n');
        brokenCert.splice(5, 5); // remove 5th to 10th line from cert - make it useless
        const addPubkeyDialog = await ComposePageRecipe.pastePublicKeyManuallyNoClose(composeFrame, inboxPage, 'smime@recipient.com', brokenCert.join('\n'));
        await addPubkeyDialog.waitAndRespondToModal('error', 'confirm', 'Too few bytes to read ASN.1 value.');
      })
    );

    test(
      'send non-S/MIME cert - err',
      testWithBrowser(async (t, browser) => {
        const acctEmail = 'ci.tests.gmail@flowcrypt.test';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acctEmail]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
        const inboxPage = await browser.newExtensionInboxPage(t, acctEmail);
        const composeFrame = await InboxPageRecipe.openAndGetComposeFrame(inboxPage);
        await ComposePageRecipe.fillMsg(composeFrame, { to: 'smime@recipient.com' }, t.title);
        const httpsCert =
          '-----BEGIN CERTIFICATE-----\nMIIFZTCCBE2gAwIBAgISA/LOLnFAcrNSDjMi+PvkSbX1MA0GCSqGSIb3DQEBCwUA\nMEoxCzAJBgNVBAYTAlVTMRYwFAYDVQQKEw1MZXQncyBFbmNyeXB0MSMwIQYDVQQD\nExpMZXQncyBFbmNyeXB0IEF1dGhvcml0eSBYMzAeFw0yMDAzMTQxNTQ0NTVaFw0y\nMDA2MTIxNTQ0NTVaMBgxFjAUBgNVBAMTDWZsb3djcnlwdC5jb20wggEiMA0GCSqG\nSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDBYeT+zyJK4VrAtpBoxnzNrgPMkeJ3WBw3\nlZrO7GXsPUUQL/2uL3NfMwQ4qWqsiJStShaTQ0UX1MQCBgdOY/Ajr5xgyCz4aE0+\nQeReGy+qFyoGE9okVdF+/uJhFTOkK8goA4rDRN3MrSuWsivc/5/8Htd/M01JFAcU\nEblrPkSBtJp8IAtr+QD8etmMd05N0oQFNFT/T7QNrEdItCKSS6jMpprR4phr792K\niQh9MzhZ3O+QEM+UKpsL0dM9C6PD9jNFjFz3EDch/VFPbBlcBfWGvYnjBlqKjhYA\nLPUVPgIF4CVQ60EoOHk1ewyoAyydYyFXppUz1eDvemUhLMWuBJ2tAgMBAAGjggJ1\nMIICcTAOBgNVHQ8BAf8EBAMCBaAwHQYDVR0lBBYwFAYIKwYBBQUHAwEGCCsGAQUF\nBwMCMAwGA1UdEwEB/wQCMAAwHQYDVR0OBBYEFMr4ERxBRtKNI67oIkJHN2QSBptE\nMB8GA1UdIwQYMBaAFKhKamMEfd265tE5t6ZFZe/zqOyhMG8GCCsGAQUFBwEBBGMw\nYTAuBggrBgEFBQcwAYYiaHR0cDovL29jc3AuaW50LXgzLmxldHNlbmNyeXB0Lm9y\nZzAvBggrBgEFBQcwAoYjaHR0cDovL2NlcnQuaW50LXgzLmxldHNlbmNyeXB0Lm9y\nZy8wKQYDVR0RBCIwIIIPKi5mbG93Y3J5cHQuY29tgg1mbG93Y3J5cHQuY29tMEwG\nA1UdIARFMEMwCAYGZ4EMAQIBMDcGCysGAQQBgt8TAQEBMCgwJgYIKwYBBQUHAgEW\nGmh0dHA6Ly9jcHMubGV0c2VuY3J5cHQub3JnMIIBBgYKKwYBBAHWeQIEAgSB9wSB\n9ADyAHcAb1N2rDHwMRnYmQCkURX/dxUcEdkCwQApBo2yCJo32RMAAAFw2e8sLwAA\nBAMASDBGAiEA7Omcf4+uFphcbEq19r4GoWi7E1qvsJTykvgH342x1d4CIQDSCJZK\n3zsVSw8I1GVfnIr/drVhgn4TJgacXx6+gBzfXQB3ALIeBcyLos2KIE6HZvkruYol\nIGdr2vpw57JJUy3vi5BeAAABcNnvK/kAAAQDAEgwRgIhAP7BbIkG/mNclZAVqgA0\nomAB/6xMwbu1ZUsHNBMkZG+QAiEAmZWCVdUfmFs3b+zDEaAF7eFDnz7qbDa5q6M0\n98r8In0wDQYJKoZIhvcNAQELBQADggEBAFaUhUkxGkHc3lxozCbozM7ffAOcK5De\nJGoTtsXw/XmMACBIIqn2Aan+zvQdK/cWV9+dYu5tA/PHZwVbfKAU2x+Fizs7uDgs\nslg16un1/DP7bmi4Ih3KDVyznzgTwWPq9CmPMIeCXBSGvGN4xdfyIf7mKPSmsEB3\ngkM8HyE27e2u8B4f/R4W+sbqx0h5Y/Kv6NFqgQlatEY2HdAQDYYL21xO1ZjaUozP\nyfHQSJwGHp3/1Xdq5mIkV7w9xxhOn64FXp4S0spVCxT3er1EEUurq+lXjyeX4Dog\n1gy3r417NPqQWuBJcA/InSaS/GUyGghp+kuGfIDqVYfQqU1297nThEA=\n-----END CERTIFICATE-----\n';
        const addPubkeyDialog = await ComposePageRecipe.pastePublicKeyManuallyNoClose(composeFrame, inboxPage, 'smime@recipient.com', httpsCert);
        await addPubkeyDialog.waitAndRespondToModal('error', 'confirm', 'This S/MIME x.509 certificate has an invalid recipient email: flowcrypt.com');
      })
    );

    test(
      'cannot import expired key in secure compose',
      testWithBrowser(async (t, browser) => {
        const acctEmail = 'ci.tests.gmail@flowcrypt.test';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acctEmail]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
        const inboxPage = await browser.newExtensionInboxPage(t, acctEmail);
        const to = 'nopgp@recipient.com';
        const composeFrame = await InboxPageRecipe.openAndGetComposeFrame(inboxPage);
        await ComposePageRecipe.fillMsg(composeFrame, { to }, t.title);
        const expiredPubkey =
          '-----BEGIN PGP PUBLIC KEY BLOCK-----\r\nVersion: FlowCrypt Email Encryption 7.8.4\r\nComment: Seamlessly send and receive encrypted email\r\n\r\nxsBNBF8QJFgBCACdPi2i6uflsgNVvSw20eVaqOwEgwRAu1wrwB+s3UxFxsnE\r\nXBiJ6tvQU+NzNFLWjT5FwyTz8PM2lDnXz/j6nQGft+l/01l349u0L4WhTEES\r\nByPTOA1Wbs4YRbef1+T6tKklN8CKH93tBKRFTZXsMv0nLuEMmyxNgYHvNsnB\r\nGXlGQrrsJ5qVr10YZh+dXo8Ir4mXXE5tCrVH/AzDBK/cBZcUbBD7gmvnt+HF\r\nvuJYMRQ46/NR84S57Dwm5ZzER0PMQfnLYyjdKE4DEVtL84WVhGVqNhBqy1Z6\r\nl/wvSHnBvrXe1Vdm2YXT0pIahe9wJmrA2dixA8c+SczICn+QZAkBsAZRABEB\r\nAAHNKTxoYXMub2xkZXIua2V5Lm9uLmF0dGVzdGVyQHJlY2lwaWVudC5jb20+\r\nwsCTBBABCAAmBQJfECRYBQkAAAACBgsJBwgDAgQVCAoCBBYCAQACGQECGwMC\r\nHgEAIQkQHmLtbRWiWSEWIQSOx48EPOsCJJiv1HceYu1tFaJZIQewCACYWDJ5\r\n3sbGDvIwRlPiAQqTp4IvjrvLC+unX4OVyaqXPcTbCWkjjUcZci2aO5V59J+I\r\nfHkI7PVwheuEk4HjNBiPvSOy8BbwiGXYxkQX4Z4QZkcf6wCvd3rtwyICzhNh\r\njsehA4uaYStr0k0pxzHMWhpDeppzVL+yVnCoftiW9+9MuTFQ2ynQhBYp57yA\r\n6LGn9X91L7ACZvWMstBwTNkT2N2Vw7ngCnacweIj0LMje2wt6cKO1IMm0U4Q\r\nEkag9pqTf1DnyC/dkw7GB6kT5lP9wAdZNxtIgJwHQNidH+0gfJlTQ31LQp5T\r\njFa6LU+7XK8sprZG27TjQX9w7NVyYbkib3mGzsBNBF8QJFgBCACnVXFdNoKA\r\nTHN6W7ewu8CDaDEOxrUGckrTFSOLN0hkLrlrHRZg4/N0gZf/TdUynGJ6fkXq\r\n5ZDZWiPujAyjeTHhoUb3Oc0O9voX3TLRROduDxW6UAeurzXAiL/25qOp1TRr\r\nFhvllleg+fcZDNjPct4zyUxUW6NzWkHJ+XvNxq2fTH82n0RfPTyRoee/ymuR\r\nexRU4vfYF8XNo+aEDx00rwQFpl8ot20Qus6vKejo0SIyr0bS4oHBB3sYHrxt\r\nkfHLwiSfE27eW2pogta6JcH7w+OLGadoGxqGs1cYpbVhteDRUQ4nTov3JWt5\r\nVoNlXiaBdV3vRF52Q+UuUwylsbcplDeDABEBAAHCwHwEGAEIAA8FAl8QJFgF\r\nCQAAAAICGwwAIQkQHmLtbRWiWSEWIQSOx48EPOsCJJiv1HceYu1tFaJZIcYi\r\nB/wNq0UOV3d1aaFtx2ie2CYX5f7o9/emyN7HomW53DBXSAlj98R0MnKrUadU\r\noIXkUnJlGIyU9NjzWWZsdPMrlaU/tCvceO/wvc2K/pqjiQKjtfiA/mR+0dGf\r\ncVskq2WOiAfEuOcTAdrYmLeTs5r6RJueTb3qxUN7a9OWru+avuyJ7lDiOiNC\r\nMnhQ8xZy1zREApD1weSz9JEUOTkcNYFm/dm08g0QfKneqi5/ZvNmRlKNW/Nf\r\n9DCM/jCp1Nb33yNTC9n3HW8qMOd4pPfajDEtGivqi5aQGaZ+AbT6RTR4jD8q\r\n7GiOeV7wDbZXG0MYLM9kqW7znnDTAGHWvTw+HanlU23+\r\n=KVqr\r\n-----END PGP PUBLIC KEY BLOCK-----\r\n';
        const addPubkeyDialog = await ComposePageRecipe.pastePublicKeyManuallyNoClose(composeFrame, inboxPage, to, expiredPubkey);
        await addPubkeyDialog.waitAndRespondToModal(
          'warning',
          'confirm',
          'This public key is correctly formatted, but it cannot be used for encryption because it expired on 2020-07-16 09:56.'
        );
      })
    );

    // we test that list of public keys get refetched even if we already have a good key
    // useful when recipient now has a completely different public key
    test(
      'compose - list of pubkeys gets refetched in compose',
      testWithBrowser(async (t, browser) => {
        const acctEmail = 'ci.tests.gmail@flowcrypt.test';
        const recipientEmail = 'mock.only.pubkey@flowcrypt.com'; // has "somePubkey" on Attester
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acctEmail]: {
                pubkey: somePubkey,
              },
              [recipientEmail]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
        const validKey = protonMailCompatKey; // doesn't really matter which key we import, as long as different from "somePubkey"
        const settingsPage = await browser.newExtensionSettingsPage(t, acctEmail);
        const contactsFrame = await importKeyManuallyAndViewTheNewContact(settingsPage, recipientEmail, validKey, 'IMPORT KEY');
        await contactsFrame.waitForContent('@page-contacts', 'openpgp - active - AB8C F86E 3715 7C3F 290D 7200 7ED4 3D79 E961 7655');
        await contactsFrame.waitAndClick(`@action-show-pubkey-AB8CF86E37157C3F290D72007ED43D79E9617655-openpgp`, {
          confirmGone: true,
        });
        await contactsFrame.waitForContent('@container-pubkey-details', 'Fingerprint: AB8C F86E 3715 7C3F 290D 7200 7ED4 3D79 E961 7655');
        await contactsFrame.waitForContent('@container-pubkey-details', 'Users: flowcrypt.compatibility@protonmail.com');
        // now we want to see that compose page auto-fetches the other key too
        const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
        await ComposePageRecipe.fillMsg(composePage, { to: recipientEmail }, t.title);
        // could further test that the message below already gets encrypted with the new public keys
        //  - currently not tested
        await ComposePageRecipe.sendAndClose(composePage);
        // make sure that the contact got updated to include two keys now
        await contactsFrame.waitAndClick('@action-back-to-contact-list', { confirmGone: true });
        await contactsFrame.waitAndClick(`@action-show-email-${recipientEmail.replace(/[^a-z0-9]+/g, '')}`);
        // contains original key
        await contactsFrame.waitForContent('@page-contacts', 'openpgp - active - AB8C F86E 3715 7C3F 290D 7200 7ED4 3D79 E961 7655');
        // contains newly fetched key
        await contactsFrame.waitForContent('@page-contacts', 'openpgp - active - 8B8A 05A2 216E E6E4 C5EE 3D54 0D56 88EB F310 2BE7');
        await contactsFrame.waitAndClick(`@action-show-pubkey-8B8A05A2216EE6E4C5EE3D540D5688EBF3102BE7-openpgp`, {
          confirmGone: true,
        });
        await contactsFrame.waitForContent('@container-pubkey-details', 'Fingerprint: 8B8A 05A2 216E E6E4 C5EE 3D54 0D56 88EB F310 2BE7');
        await contactsFrame.waitForContent('@container-pubkey-details', 'Users: tom@bitoasis.net');
      })
    );

    // we test that expired key gets re-fetched to become active again
    test(
      'auto-refresh expired key if newer version of the same key available',
      testWithBrowser(async (t, browser) => {
        const acctEmail = 'ci.tests.gmail@flowcrypt.test';
        // add an expired key manually
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acctEmail]: {
                pubkey: somePubkey,
              },
              'auto.refresh.expired.key@recipient.com': {
                pubkey: newerVersionOfExpiredPubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
        const settingsPage = await browser.newExtensionSettingsPage(t, acctEmail);
        const { recipientEmail, contactsFrame } = await importExpiredKeyForAutoRefresh(settingsPage);
        // now we want to see that compose page auto-fetches an updated one
        const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
        await ComposePageRecipe.fillMsg(composePage, { to: recipientEmail }, t.title);
        const expandContainer = await composePage.waitAny('@action-show-container-cc-bcc-buttons');
        const recipient = await expandContainer.$('.email_preview span');
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        expect(await PageRecipe.getElementPropertyJson(recipient!, 'className')).to.not.include('expired'); // because auto-reloaded
        await ComposePageRecipe.sendAndClose(composePage);
        // make sure that the contact itself got updated
        await contactsFrame.waitAndClick('@action-back-to-contact-list', { confirmGone: true });
        await contactsFrame.waitAndClick(`@action-show-email-${recipientEmail.replace(/[^a-z0-9]+/g, '')}`);
        await contactsFrame.waitForContent('@page-contacts', 'openpgp - active - 6D3E 0986 7544 EE62 7F2E 928F BEE3 A42D 9A9C 8AC9');
        await contactsFrame.waitAndClick(`@action-show-pubkey-6D3E09867544EE627F2E928FBEE3A42D9A9C8AC9-openpgp`, {
          confirmGone: true,
        });
        await contactsFrame.waitForContent('@container-pubkey-details', 'Expired: no');
        await contactsFrame.waitForContent('@container-pubkey-details', 'Usable for encryption: true');
        await contactsFrame.waitForContent('@container-pubkey-details', 'Expiration: Does not expire');
      })
    );

    // we test that key re-fetching does not happen when attester is disabled
    test(
      "don't auto-refresh expired key if disallowed search on attester",
      testWithBrowser(async (t, browser) => {
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {},
          },
        });
        const acct = 'user@no-search-wildcard-domains-client-configuration.flowcrypt.test';
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acct);
        await SetupPageRecipe.manualEnter(settingsPage, 'flowcrypt.test.key.used.pgp');
        const { recipientEmail } = await importExpiredKeyForAutoRefresh(settingsPage);
        // now we want to see that compose page not fetching an updated one
        const composePage = await ComposePageRecipe.openStandalone(t, browser, acct);
        await ComposePageRecipe.fillMsg(composePage, { to: recipientEmail }, t.title);
        const expandContainer = await composePage.waitAny('@action-show-container-cc-bcc-buttons');
        const recipient = await expandContainer.$('.email_preview span');
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        expect(await PageRecipe.getElementPropertyJson(recipient!, 'className')).to.include('expired'); // should not auto-reload
      })
    );

    test(
      'recipient without pub key will turn green & hide password input view when manually updated in different window',
      testWithBrowser(async (t, browser) => {
        const acct = 'ci.tests.gmail@flowcrypt.test';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
        const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
        const recipientEmail = 'test-no-pub-key@domain.com';
        await ComposePageRecipe.fillMsg(composePage, { to: recipientEmail }, t.title);
        await composePage.waitForContent('.email_address.no_pgp', recipientEmail);
        await composePage.waitAny('@password-or-pubkey-container');
        // now open a pubkey frame and update the pubkey
        const pubkeyFrameUrl = `chrome/elements/pgp_pubkey.htm?frameId=none&armoredPubkey=${encodeURIComponent(
          somePubkey
        )}&acctEmail=flowcrypt.compatibility%40gmail.com&parentTabId=0`;
        const pubkeyFrame = await browser.newPage(t, pubkeyFrameUrl);
        await pubkeyFrame.waitAndType('.input_email', recipientEmail);
        await pubkeyFrame.waitForContent('@action-add-contact', 'IMPORT KEY');
        await pubkeyFrame.waitAndClick('@action-add-contact');
        await pubkeyFrame.waitForContent('@container-pgp-pubkey', `${recipientEmail} added`);
        await Util.sleep(1);
        await pubkeyFrame.close();
        await composePage.waitForContent('.email_address.has_pgp:not(.no_pgp)', recipientEmail);
        await composePage.waitAll('@password-or-pubkey-container', { visible: false });
      })
    );

    test(
      'attester client should understand more than one pub key',
      testWithBrowser(async (t, browser) => {
        const acct = 'ci.tests.gmail@flowcrypt.test';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
              'multiple.pub.key@flowcrypt.com': {
                pubkey: [somePubkey, protonMailCompatKey].join('\n'),
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
        const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
        const recipientEmail = 'multiple.pub.key@flowcrypt.com';
        await ComposePageRecipe.fillMsg(composePage, { to: recipientEmail }, t.title);
        await composePage.close();
        // Check if multiple keys are imported to multiple.pub.key@flowcrypt.com account
        const settingsPage = await browser.newExtensionSettingsPage(t, 'ci.tests.gmail@flowcrypt.test');
        await SettingsPageRecipe.toggleScreen(settingsPage, 'additional');
        const contactsFrame = await SettingsPageRecipe.awaitNewPageFrame(settingsPage, '@action-open-contacts-page', ['contacts.htm', 'placement=settings']);
        await contactsFrame.waitAll('@page-contacts');
        await contactsFrame.waitAndClick(`@action-show-email-${recipientEmail.replace(/[^a-z0-9]+/g, '')}`);
        // Check protonMailCompatKey key
        await contactsFrame.waitAndClick(`@action-show-pubkey-8B8A05A2216EE6E4C5EE3D540D5688EBF3102BE7-openpgp`, {
          confirmGone: true,
        });
        await contactsFrame.waitForContent('@container-pubkey-details', 'Fingerprint: 8B8A 05A2 216E E6E4 C5EE 3D54 0D56 88EB F310 2BE7');
        await contactsFrame.waitForContent('@container-pubkey-details', 'Users: tom@bitoasis.net');
        // Check somePubkey
        await contactsFrame.waitAndClick('@action-back-to-contact-list', { confirmGone: true });
        await contactsFrame.waitAndClick(`@action-show-email-${recipientEmail.replace(/[^a-z0-9]+/g, '')}`);
        await contactsFrame.waitAndClick(`@action-show-pubkey-AB8CF86E37157C3F290D72007ED43D79E9617655-openpgp`, {
          confirmGone: true,
        });
        await contactsFrame.waitForContent('@container-pubkey-details', 'Fingerprint: AB8C F86E 3715 7C3F 290D 7200 7ED4 3D79 E961 7655');
        await contactsFrame.waitForContent('@container-pubkey-details', 'Users: flowcrypt.compatibility@protonmail.com');
      })
    );

    test(
      'check attester ldap search',
      testWithBrowser(async (t, browser) => {
        const acct = 'ci.tests.gmail@flowcrypt.test';
        const recipients = {
          to: 'test.ldap.priority@gmail.com', // check if recipient-specific LDAP server results are priotized than flowcrypt pubkey server
          // check if we can get results from keyserver.pgp.com when no results are returned from flowcrypt key server and recipient-specific LDAP server
          // And check if it can handle multiple keys
          cc: 'test.ldap.keyserver.pgp@gmail.com',
          // check if flowcrypt keyserver results are priotized than keyserver.pgp.com results
          bcc: 'test.flowcrypt.pubkeyserver.priority@gmail.com',
        };
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
              [recipients.to]: {
                pubkey: somePubkey,
              },
              [recipients.bcc]: {
                pubkey: somePubkey,
              },
            },
            ldapRelay: {
              [recipients.to]: {
                pubkey: protonMailCompatKey,
              },
              [recipients.cc]: {
                pubkey: [protonMailCompatKey, testMatchPubKey].join('\n'),
                domainToCheck: 'keyserver.pgp.com',
              },
              [recipients.bcc]: {
                pubkey: protonMailCompatKey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
        const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
        await ComposePageRecipe.fillMsg(composePage, recipients, t.title);
        await composePage.close();
        const settingsPage = await browser.newExtensionSettingsPage(t, 'ci.tests.gmail@flowcrypt.test');
        await SettingsPageRecipe.toggleScreen(settingsPage, 'additional');
        const contactsFrame = await SettingsPageRecipe.awaitNewPageFrame(settingsPage, '@action-open-contacts-page', ['contacts.htm', 'placement=settings']);
        await contactsFrame.waitAll('@page-contacts');
        // Check test.ldap.priority@gmail.com
        await contactsFrame.waitAndClick(`@action-show-email-${recipients.to.replace(/[^a-z0-9]+/g, '')}`);
        await contactsFrame.waitAny(`@action-show-pubkey-AB8CF86E37157C3F290D72007ED43D79E9617655-openpgp`);
        // Check test.ldap.keyserver.pgp@gmail.com
        await contactsFrame.waitAndClick(`@action-show-email-${recipients.cc.replace(/[^a-z0-9]+/g, '')}`);
        await contactsFrame.waitAny(`@action-show-pubkey-AB8CF86E37157C3F290D72007ED43D79E9617655-openpgp`);
        await contactsFrame.waitAny(`@action-show-pubkey-3E3C9310CC969D00028DC98F7D3D56F9152646A8-openpgp`);
        // Check test.flowcrypt.pubkeyserver.priority@gmail.com
        await contactsFrame.waitAndClick(`@action-show-email-${recipients.bcc.replace(/[^a-z0-9]+/g, '')}`);
        await contactsFrame.waitAny(`@action-show-pubkey-AB8CF86E37157C3F290D72007ED43D79E9617655-openpgp`);
      })
    );

    test(
      'check attester ldap timeout',
      testWithBrowser(async (t, browser) => {
        const acct = 'ci.tests.gmail@flowcrypt.test';
        const recipients = { to: 'test.ldap.timeout@gmail.com', cc: 'test.flowcrypt.pubkey.timeout@gmail.com' };
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
              [recipients.to]: {
                pubkey: somePubkey,
              },
              [recipients.cc]: {
                returnError: {
                  code: Status.BAD_REQUEST,
                  message: 'Request timeout',
                },
              },
            },
            ldapRelay: {
              [recipients.to]: {
                returnError: {
                  code: Status.BAD_REQUEST,
                  message: 'Request timeout',
                },
              },
              [recipients.cc]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
        const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
        await ComposePageRecipe.fillMsg(composePage, recipients, t.title);
        await composePage.close();
        const settingsPage = await browser.newExtensionSettingsPage(t, 'ci.tests.gmail@flowcrypt.test');
        await SettingsPageRecipe.toggleScreen(settingsPage, 'additional');
        const contactsFrame = await SettingsPageRecipe.awaitNewPageFrame(settingsPage, '@action-open-contacts-page', ['contacts.htm', 'placement=settings']);
        await contactsFrame.waitAll('@page-contacts');
        // Check test.ldap.timeout@gmail.com
        await contactsFrame.waitAndClick(`@action-show-email-${recipients.to.replace(/[^a-z0-9]+/g, '')}`);
        await contactsFrame.waitAny(`@action-show-pubkey-8B8A05A2216EE6E4C5EE3D540D5688EBF3102BE7-openpgp`);
        // Check test.flowcrypt.pubkey.timeout@gmail.com
        await contactsFrame.waitAndClick(`@action-show-email-${recipients.cc.replace(/[^a-z0-9]+/g, '')}`);
        await contactsFrame.waitAny(`@action-show-pubkey-8B8A05A2216EE6E4C5EE3D540D5688EBF3102BE7-openpgp`);
      })
    );

    test(
      'allows to retry public key search when attester returns error',
      testWithBrowser(async (t, browser) => {
        const acct = 'ci.tests.gmail@flowcrypt.test';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
        const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
        const recipients = { to: 'attester.return.error@flowcrypt.test' };
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [recipients.to]: {
                returnError: { code: Status.SERVER_ERROR, message: 'Server error. Please try again' },
              },
            },
          },
        });
        await ComposePageRecipe.fillMsg(composePage, recipients, t.title);
        await ComposePageRecipe.showRecipientInput(composePage);
        await composePage.waitAndClick(`@action-retry-${recipients.to.replace(/[^a-z0-9]+/g, '')}-pubkey-fetch`);
      })
    );

    test(
      'do not auto-refresh key if older version of the same key available on attester',
      testWithBrowser(async (t, browser) => {
        const acct = 'ci.tests.gmail@flowcrypt.test';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
        const recipientEmail = 'has.older.key.on.attester@recipient.com';
        // add a newer expired key manually
        const settingsPage = await browser.newExtensionSettingsPage(t, acct);
        await SettingsPageRecipe.toggleScreen(settingsPage, 'additional');
        const contactsFrame = await SettingsPageRecipe.awaitNewPageFrame(settingsPage, '@action-open-contacts-page', ['contacts.htm', 'placement=settings']);
        await contactsFrame.waitAll('@page-contacts');
        await contactsFrame.waitAndClick('@action-show-import-public-keys-form', { confirmGone: true });
        await contactsFrame.waitAndType('@input-bulk-public-keys', testConstants.newHasOlderKeyOnAttester);
        await contactsFrame.waitAndClick('@action-show-parsed-public-keys', { confirmGone: true });
        await contactsFrame.waitAll('iframe');
        const pubkeyFrame = await contactsFrame.getFrame(['pgp_pubkey.htm']);
        await pubkeyFrame.waitForContent('@action-add-contact', 'IMPORT EXPIRED KEY');
        await pubkeyFrame.waitAndClick('@action-add-contact');
        await pubkeyFrame.waitForContent('@container-pgp-pubkey', `${recipientEmail} added`);
        await contactsFrame.waitAndClick('@action-back-to-contact-list', { confirmGone: true });
        await contactsFrame.waitAndClick(`@action-show-email-${recipientEmail.replace(/[^a-z0-9]+/g, '')}`);
        await contactsFrame.waitForContent('@page-contacts', 'openpgp - expired - 8EC7 8F04 3CEB 0224 98AF D477 1E62 ED6D 15A2 5921');
        await contactsFrame.waitAndClick(`@action-show-pubkey-8EC78F043CEB022498AFD4771E62ED6D15A25921-openpgp`, {
          confirmGone: true,
        });
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
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        expect(await PageRecipe.getElementPropertyJson(recipient!, 'className')).to.include('expired');
        await composePage.close();
        // make sure that the contact itself did NOT get updated, because the one on Attester is an older key
        await contactsFrame.waitAndClick('@action-back-to-contact-list', { confirmGone: true });
        await contactsFrame.waitAndClick(`@action-show-email-${recipientEmail.replace(/[^a-z0-9]+/g, '')}`);
        await contactsFrame.waitForContent('@page-contacts', 'openpgp - expired - 8EC7 8F04 3CEB 0224 98AF D477 1E62 ED6D 15A2 5921');
        await contactsFrame.waitAndClick(`@action-show-pubkey-8EC78F043CEB022498AFD4771E62ED6D15A25921-openpgp`, {
          confirmGone: true,
        });
        await contactsFrame.waitForContent('@container-pubkey-details', 'Fingerprint: 8EC7 8F04 3CEB 0224 98AF D477 1E62 ED6D 15A2 5921');
        await contactsFrame.waitForContent('@container-pubkey-details', 'Created on: Thu Jul 16 2020 09:56:40');
        await contactsFrame.waitForContent('@container-pubkey-details', 'Expiration: Thu Jul 16 2020 09:57:40');
        await contactsFrame.waitForContent('@container-pubkey-details', 'Expired: yes');
      })
    );

    test(
      'import S/MIME cert',
      testWithBrowser(async (t, browser) => {
        const acct = 'ci.tests.gmail@flowcrypt.test';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
        // the cert since expired, therefore test was updated to reflect that
        const recipientEmail = 'actalis@meta.33mail.com';
        // add S/MIME key manually
        const settingsPage = await browser.newExtensionSettingsPage(t, acct);
        await SettingsPageRecipe.toggleScreen(settingsPage, 'additional');
        const contactsFrame = await SettingsPageRecipe.awaitNewPageFrame(settingsPage, '@action-open-contacts-page', ['contacts.htm', 'placement=settings']);
        await contactsFrame.waitAll('@page-contacts');
        await contactsFrame.waitAndClick('@action-show-import-public-keys-form', { confirmGone: true });
        await contactsFrame.waitAndType('@input-bulk-public-keys', testConstants.expiredSmimeCert);
        await contactsFrame.waitAndClick('@action-show-parsed-public-keys', { confirmGone: true });
        await contactsFrame.waitAll('iframe');
        const pubkeyFrame = await contactsFrame.getFrame(['pgp_pubkey.htm']);
        await pubkeyFrame.waitForContent('@action-add-contact', 'IMPORT EXPIRED KEY');
        await pubkeyFrame.waitAndClick('@action-add-contact');
        await pubkeyFrame.waitForContent('@container-pgp-pubkey', `${recipientEmail} added`);
        await contactsFrame.waitAndClick('@action-back-to-contact-list', { confirmGone: true });
        await contactsFrame.waitAndClick(`@action-show-email-${recipientEmail.replace(/[^a-z0-9]+/g, '')}`);
        await contactsFrame.waitForContent('@page-contacts', 'x509 - expired - 16BB 4074 03A3 ADC5 5E1E 0E4A F93E EC8F B187 C923');
        await contactsFrame.waitAndClick(`@action-show-pubkey-16BB407403A3ADC55E1E0E4AF93EEC8FB187C923-x509`, {
          confirmGone: true,
        });
        await contactsFrame.waitForContent('@container-pubkey-details', 'Type: x509');
        await contactsFrame.waitForContent('@container-pubkey-details', 'Fingerprint: 16BB 4074 03A3 ADC5 5E1E 0E4A F93E EC8F B187 C923');
        await contactsFrame.waitForContent('@container-pubkey-details', `Users: ${recipientEmail}`);
        await contactsFrame.waitForContent('@container-pubkey-details', 'Created on: Mon Mar 23 2020');
        await contactsFrame.waitForContent('@container-pubkey-details', 'Expiration: Tue Mar 23 2021');
        await contactsFrame.waitForContent('@container-pubkey-details', 'Expired: yes');
        await contactsFrame.waitForContent('@container-pubkey-details', 'Usable for encryption: false');
        await contactsFrame.waitForContent('@container-pubkey-details', 'Usable for signing: false');
      })
    );

    test(
      'compose - reply - CC&BCC test forward',
      testWithBrowser(async (t, browser) => {
        const acct = 'flowcrypt.compatibility@gmail.com';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'compatibility');
        const appendUrl = 'threadId=16ce2c965c75e5a6&skipClickPrompt=___cu_false___&ignoreDraft=___cu_false___&replyMsgId=16ce2c965c75e5a6';
        const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', {
          appendUrl,
          hasReplyPrompt: true,
        });
        await composePage.waitAndClick('@action-forward', { delay: 2 });
        await composePage.waitAny('@input-to');
        await composePage.waitUntilFocused('@input-to');
        await expectRecipientElements(composePage, { to: [], cc: [], bcc: [] });
      })
    );

    test(
      'compose - reply - from === acctEmail',
      testWithBrowser(async (t, browser) => {
        const acct = 'flowcrypt.compatibility@gmail.com';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'compatibility');
        const appendUrl = 'threadId=17d02296bccd4c5c&skipClickPrompt=___cu_false___&ignoreDraft=___cu_false___&replyMsgId=17d02296bccd4c5c';
        const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', {
          appendUrl,
          hasReplyPrompt: true,
        });
        await composePage.waitAndClick('@encrypted-reply', { delay: 1 });
        await expectRecipientElements(composePage, {
          to: [{ email: 'flowcrypt.compatibility@gmail.com', name: 'First Last' }, { email: 'vladimir@flowcrypt.com' }],
          cc: [],
          bcc: [],
        });
      })
    );

    test(
      'compose - check reply for web portal messsage',
      testWithBrowser(async (t, browser) => {
        const acct = 'flowcrypt.compatibility@gmail.com';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'compatibility');
        const appendUrl =
          'threadId=1837a67086636d0c&skipClickPrompt=___cu_false___&ignoreDraft=___cu_false___&replyMsgId=1837a67803bad3ea&acctEmail=flowcrypt.compatibility%40gmail.com';
        const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', {
          appendUrl,
          hasReplyPrompt: true,
        });
        await composePage.waitAndClick('@encrypted-reply', { delay: 1 });
        await expectRecipientElements(composePage, { to: [{ email: 'ioanmo226@gmail.com' }] });
      })
    );

    test(
      'compose - reply - subject starts with Re:',
      testWithBrowser(async (t, browser) => {
        const acct = 'flowcrypt.compatibility@gmail.com';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'compatibility');
        const appendUrl = 'threadId=17d02296bccd4c5d&skipClickPrompt=___cu_false___&ignoreDraft=___cu_false___&replyMsgId=17d02296bccd4c5d';
        const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', {
          appendUrl,
          hasReplyPrompt: true,
        });
        await composePage.waitAndClick('@encrypted-reply', { delay: 1 });
        await expectRecipientElements(composePage, { to: [{ email: 'vladimir@flowcrypt.com' }], cc: [], bcc: [] });
      })
    );

    test(
      'compose - reply - from !== acctEmail',
      testWithBrowser(async (t, browser) => {
        const acct = 'flowcrypt.compatibility@gmail.com';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'compatibility');
        const appendUrl = 'threadId=17d02268f01c7e40&skipClickPrompt=___cu_false___&ignoreDraft=___cu_false___&replyMsgId=17d02268f01c7e40';
        const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', {
          appendUrl,
          hasReplyPrompt: true,
        });
        await composePage.waitAndClick('@encrypted-reply', { delay: 1 });
        await expectRecipientElements(composePage, { to: [{ email: 'limon.monte@gmail.com' }], cc: [], bcc: [] });
      })
    );

    test(
      'compose - reply all - from !== acctEmail',
      testWithBrowser(async (t, browser) => {
        const acct = 'flowcrypt.compatibility@gmail.com';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'compatibility');
        const appendUrl = 'threadId=17d02268f01c7e40&skipClickPrompt=___cu_false___&ignoreDraft=___cu_false___&replyMsgId=17d02268f01c7e40';
        const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', {
          appendUrl,
          hasReplyPrompt: true,
        });
        await composePage.waitAndClick('@action-accept-reply-all-prompt', { delay: 1 });
        await expectRecipientElements(composePage, {
          to: [{ email: 'limon.monte@gmail.com' }, { email: 'vladimir@flowcrypt.com' }],
          cc: [{ email: 'limon.monte@gmail.com' }],
          bcc: [],
        });
      })
    );

    test(
      'user@standardsubdomainfes.localhost:8001 - PWD encrypted message with FES web portal',
      testWithBrowser(async (t, browser) => {
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {},
          },
        });
        const port = t.urls?.port;
        const acct = `user@standardsubdomainfes.localhost:${port}`; // added port to trick extension into calling the mock
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acct);
        await SetupPageRecipe.manualEnter(
          settingsPage,
          'flowcrypt.test.key.used.pgp',
          { submitPubkey: false, usedPgpBefore: false },
          { isSavePassphraseChecked: false, isSavePassphraseHidden: false }
        );
        // add names to contacts
        const dbPage = await browser.newExtensionPage(t, 'chrome/dev/ci_unit_test.htm');
        await dbPage.page.evaluate(async () => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const db = await (window as any).ContactStore.dbOpen();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (window as any).ContactStore.update(db, 'to@example.com', { name: 'Mr To' });
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (window as any).ContactStore.update(db, 'bcc@example.com', { name: 'Mr Bcc' });
        });
        await dbPage.close();
        const subject = 'PWD encrypted message with FES - ID TOKEN';
        const composePage = await ComposePageRecipe.openStandalone(t, browser, `user@standardsubdomainfes.localhost:${port}`);
        await ComposePageRecipe.fillMsg(composePage, { to: 'to@example.com', bcc: 'bcc@example.com' }, subject);
        const fileInput = (await composePage.target.$('input[type=file]')) as ElementHandle<HTMLInputElement>;
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        await fileInput!.uploadFile('test/samples/small.txt');
        // lousy pwd
        await composePage.waitAndType('@input-password', 'lousy pwd');
        await composePage.checkElementColor('@input-password', 'rgb(209, 72, 54)'); // Check if password element color remains red (which means invalid password)
        await composePage.clickIfPresent('#expiration_note'); // Expiration note should stay
        await composePage.waitAndClick('@action-send', { delay: 1 });
        await composePage.waitAndRespondToModal('error', 'confirm', 'Please use password with the following properties');
        // good pwd
        await composePage.waitAndType('@input-password', 'gO0d-pwd');
        await composePage.checkElementColor('@input-password', 'rgb(49, 162, 23)'); // Password element color should turn into green (which means good password)
        await composePage.notPresent('#expiration_note'); // Expiration note should be hidden when password is good
        await composePage.waitAndClick('@action-send', { delay: 1 });
        await ComposePageRecipe.closed(composePage);
        const sentMsgs = (await GoogleData.withInitializedData(acct)).searchMessagesBySubject(subject);
        expect(sentMsgs.length).to.equal(2);
        // this test is using PwdEncryptedMessageWithFesIdTokenTestStrategy to check sent result based on subject "PWD encrypted message with FES - ID TOKEN"
        // also see '/api/v1/message' in customer-url-fes-endpoints.ts mock
      })
    );

    test(
      'user2@standardsubdomainfes.localhost:8001 - PWD encrypted message with FES - Reply rendering',
      testWithBrowser(async (t, browser) => {
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              'flowcrypt.compatibility@gmail.com': {
                pubkey: somePubkey,
              },
              'mock.only.pubkey@flowcrypt.com': {
                pubkey: somePubkey,
              },
            },
          },
        });
        const acct = `user2@standardsubdomainfes.localhost:${t.urls?.port}`; // added port to trick extension into calling the mock
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acct);
        await SetupPageRecipe.manualEnter(
          settingsPage,
          'flowcrypt.test.key.used.pgp',
          { submitPubkey: false, usedPgpBefore: false },
          { isSavePassphraseChecked: false, isSavePassphraseHidden: false }
        );
        const appendUrl = 'threadId=1803be2e506153d2&skipClickPrompt=___cu_false___&ignoreDraft=___cu_false___&replyMsgId=1803be3182d1937b';
        const composePage = await ComposePageRecipe.openStandalone(t, browser, acct, {
          appendUrl,
          hasReplyPrompt: true,
        });
        await composePage.waitAndClick('@action-accept-reply-all-prompt', { delay: 2 });
        // we should have 4 recipients, 2 green and 2 gray
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const container = (await composePage.waitAny('@container-to'))!;
        const recipients = await container.$$('.recipients > span');
        expect(recipients.length).to.equal(4);
        expect(await PageRecipe.getElementPropertyJson(recipients[0], 'textContent')).to.equal('sender@domain.com ');
        expect(await PageRecipe.getElementPropertyJson(recipients[0], 'className')).to.equal('no_pgp');
        expect(await PageRecipe.getElementPropertyJson(recipients[1], 'textContent')).to.equal('flowcrypt.compatibility@gmail.com ');
        expect(await PageRecipe.getElementPropertyJson(recipients[1], 'className')).to.equal('has_pgp');
        expect(await PageRecipe.getElementPropertyJson(recipients[2], 'textContent')).to.equal('to@example.com ');
        expect(await PageRecipe.getElementPropertyJson(recipients[2], 'className')).to.equal('no_pgp');
        expect(await PageRecipe.getElementPropertyJson(recipients[3], 'textContent')).to.equal('mock.only.pubkey@flowcrypt.com ');
        expect(await PageRecipe.getElementPropertyJson(recipients[3], 'className')).to.equal('has_pgp');
        const fileInput = (await composePage.target.$('input[type=file]')) as ElementHandle<HTMLInputElement>;
        /* eslint-disable @typescript-eslint/no-non-null-assertion */
        await fileInput!.uploadFile('test/samples/small.txt');
        await fileInput!.uploadFile('test/samples/small.pdf');
        await composePage.waitAndType('@input-password', 'gO0d-pwd');
        await composePage.waitAndClick('@action-send', { delay: 1 });
        // this test is using PwdEncryptedMessageWithFesReplyRenderingTestStrategy to check sent result based on subject "PWD encrypted message with FES - Reply rendering"
        // also see '/api/v1/message' in customer-url-fes-endpoints.ts mock
        const attachmentsContainer = (await composePage.waitAny('@replied-attachments'))!;
        /* eslint-enable @typescript-eslint/no-non-null-assertion */
        const attachments = await attachmentsContainer.$$('.pgp_attachment');
        expect(attachments.length).to.equal(2);
        await composePage.waitForContent(
          '@replied-to',
          'to: sender@domain.com, flowcrypt.compatibility@gmail.com, to@example.com, mock.only.pubkey@flowcrypt.com'
        );
        const sentMsgs = (await GoogleData.withInitializedData(acct)).getMessagesByThread('1803be2e506153d2');
        expect(sentMsgs.length).to.equal(4); // 1 original + 3 newly sent
        const attachmentFrames = (composePage.target as Page).frames();
        expect(attachmentFrames.length).to.equal(3); // 1 pgp block + 2 attachments
        expect(
          await Promise.all(
            attachmentFrames
              .filter(f => f.url().includes('attachment.htm'))
              .map(async frame => await PageRecipe.getElementPropertyJson(await new ControllableFrame(frame).waitAny('@attachment-name'), 'textContent'))
          )
        ).to.eql(['small.txt.pgp', 'small.pdf.pgp']);
      })
    );

    test(
      'compose - reply box correctly resizes recipients on opening',
      testWithBrowser(async (t, browser) => {
        const acct = 'ci.tests.gmail@flowcrypt.test';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acct]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'ci.tests.gmail');
        const msgId = 'demo-with-reply-to-10';
        const appendUrl = `threadId=${msgId}&skipClickPrompt=___cu_false___&ignoreDraft=___cu_false___&replyMsgId=${msgId}`;
        const composePage = await ComposePageRecipe.openStandalone(t, browser, acct, {
          appendUrl,
          hasReplyPrompt: true,
        });
        await composePage.waitAndClick('@action-accept-reply-all-prompt', { delay: 2 });
        await composePage.waitForContent('@recipients-preview', ' more');
        await Util.sleep(0.5);
        expect(await composePage.hasHorizontalScroll()).to.be.false;
      })
    );

    test(
      'user3@standardsubdomainfes.localhost:8001 - PWD encrypted message with FES web portal - pubkey recipient in bcc',
      testWithBrowser(async (t, browser) => {
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              'flowcrypt.compatibility@gmail.com': {
                pubkey: somePubkey,
              },
            },
          },
        });
        const acct = `user3@standardsubdomainfes.localhost:${t.urls?.port}`; // added port to trick extension into calling the mock
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acct);
        await SetupPageRecipe.manualEnter(
          settingsPage,
          'flowcrypt.test.key.used.pgp',
          { submitPubkey: false, usedPgpBefore: false },
          { isSavePassphraseChecked: false, isSavePassphraseHidden: false }
        );
        const subject = 'PWD encrypted message with FES - pubkey recipient in bcc';
        const composePage = await ComposePageRecipe.openStandalone(t, browser, acct);
        await ComposePageRecipe.fillMsg(composePage, { to: 'to@example.com', bcc: 'flowcrypt.compatibility@gmail.com' }, subject);
        await composePage.waitAndType('@input-password', 'gO0d-pwd');
        await composePage.waitAndClick('@action-send', { delay: 1 });
        await ComposePageRecipe.closed(composePage);
        const sentMsgs = (await GoogleData.withInitializedData(acct)).searchMessagesBySubject(subject);
        expect(sentMsgs.length).to.equal(2);
        // this test is using PwdEncryptedMessageWithFesPubkeyRecipientInBccTestStrategy to check sent result based on subject "PWD encrypted message with FES - pubkey recipient in bcc"
        // also see '/api/v1/message' in customer-url-fes-endpoints.ts mock
      })
    );

    test(
      'user4@standardsubdomainfes.localhost:8001 - PWD encrypted message with FES web portal - a send fails with gateway update error',
      testWithBrowser(async (t, browser) => {
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {},
          },
        });
        const acct = `user4@standardsubdomainfes.localhost:${t.urls?.port}`; // added port to trick extension into calling the mock
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acct);
        await SetupPageRecipe.manualEnter(
          settingsPage,
          'flowcrypt.test.key.used.pgp',
          { submitPubkey: false, usedPgpBefore: false },
          { isSavePassphraseChecked: false, isSavePassphraseHidden: false }
        );
        const subject = 'PWD encrypted message with FES web portal - a send fails with gateway update error - ' + testVariant;
        const expectedNumberOfPassedMessages = (await GoogleData.withInitializedData(acct)).searchMessagesBySubject(subject).length;
        const composePage = await ComposePageRecipe.openStandalone(t, browser, acct);
        await ComposePageRecipe.fillMsg(composePage, { to: 'gatewayfailure@example.com' }, subject);
        await composePage.waitAndType('@input-password', 'gO0d-pwd');
        await composePage.waitAndClick('@action-send', { delay: 1 });
        await composePage.waitForContent('.ui-toast-title', 'Failed to bind Gateway ID of the message:');
        await composePage.close();
        expect((await GoogleData.withInitializedData(acct)).searchMessagesBySubject(subject).length).to.equal(expectedNumberOfPassedMessages + 1);
        // this test is using PwdEncryptedMessageWithFesReplyGatewayErrorTestStrategy to check sent result based on subject "PWD encrypted message with FES web portal - a send fails with gateway update error"
        // also see '/api/v1/message' in customer-url-fes-endpoints.ts mock
      })
    );

    test(
      'first.key.revoked@key-manager-autoimport-no-prv-create.flowcrypt.test - selects valid own key when saving draft or sending',
      testWithBrowser(async (t, browser) => {
        const acct = 'first.key.revoked@key-manager-autoimport-no-prv-create.flowcrypt.test';
        const toRecipient = 'mock.only.pubkey@flowcrypt.com';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [toRecipient]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acct);
        await SetupPageRecipe.autoSetupWithEKM(settingsPage);
        const composePage = await ComposePageRecipe.openStandalone(t, browser, acct);
        await ComposePageRecipe.fillMsg(composePage, { to: 'mock.only.pubkey@flowcrypt.com' }, 'choose valid key');
        await ComposePageRecipe.noToastAppears(composePage); // no error saving draft
        await ComposePageRecipe.sendAndClose(composePage); // no error sending msg
      })
    );

    test(
      'revoked@key-manager-autoimport-no-prv-create.flowcrypt.test - shows modal not submitting to attester',
      testWithBrowser(async (t, browser) => {
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {},
          },
        });
        const acct = 'revoked@key-manager-autoimport-no-prv-create.flowcrypt.test';
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acct);
        await SetupPageRecipe.autoSetupWithEKM(settingsPage, {
          expectWarnModal: 'Public key not usable - not sumbitting to Attester',
        });
      })
    );

    test(
      'revoked@key-manager-autoimport-no-prv-create-no-attester-submit.flowcrypt.test - cannot draft or send msg',
      testWithBrowser(async (t, browser) => {
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {},
          },
        });
        const acct = 'revoked@key-manager-autoimport-no-prv-create-no-attester-submit.flowcrypt.test';
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acct);
        await SetupPageRecipe.autoSetupWithEKM(settingsPage);
        const composePage = await ComposePageRecipe.openStandalone(t, browser, acct);
        await Promise.all([
          ComposePageRecipe.fillMsg(composePage, { to: 'mock.only.pubkey@flowcrypt.com' }, 'no valid key'),
          ComposePageRecipe.waitForToastToAppearAndDisappear(composePage, 'Draft not saved: Error: Your account keys are revoked'),
        ]);
        await composePage.waitAndClick('@action-send', { delay: 1 });
        await PageRecipe.waitForModalAndRespond(composePage, 'warning', {
          contentToCheck: 'Failed to send message due to: Error: Your account keys are revoked',
          clickOn: 'confirm',
        });
      })
    );
  }
};

const sendImgAndVerifyPresentInSentMsg = async (t: AvaContext, browser: BrowserHandle, sendingType: 'encrypt' | 'sign' | 'plain') => {
  // send a message with image in it
  const imgBase64 =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAAnElEQVR42u3RAQ0AAAgDIE1u9FvDOahAVzLFGS1ECEKEIEQIQoQgRIgQIQgRghAhCBGCECEIQYgQhAhBiBCECEEIQoQgRAhChCBECEIQIgQhQhAiBCFCEIIQIQgRghAhCBGCEIQIQYgQhAhBiBCEIEQIQoQgRAhChCAEIUIQIgQhQhAiBCEIEYIQIQgRghAhCBEiRAhChCBECEK+W3uw+TnWoJc/AAAAAElFTkSuQmCC';
  const sendingTypeForHumans = sendingType === 'encrypt' ? 'Encrypted' : sendingType === 'sign' ? 'Signed' : 'Plain';
  const subject = `Test Sending ${sendingTypeForHumans} Message With Image ${Util.lousyRandom()}`;
  const body = `Test Sending ${sendingTypeForHumans} Message With Image ${Util.lousyRandom()}`;
  const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility');
  await ComposePageRecipe.fillMsg(composePage, { to: 'human@flowcrypt.com' }, subject, body, {
    richtext: true,
    sign: sendingType === 'sign',
    encrypt: sendingType === 'encrypt',
  });
  // the following is a temporary hack - currently not able to directly paste an image with puppeteer
  // instead we should find a way to load the image into clipboard, and paste it into textbox
  await composePage.page.evaluate((src: string) => {
    $('[data-test=action-insert-image]').val(src).click();
  }, imgBase64);
  await ComposePageRecipe.sendAndClose(composePage);
  // get sent msg id from mock
  const sentMsg = (await GoogleData.withInitializedData('flowcrypt.compatibility@gmail.com')).searchMessagesBySubject(subject)[0];
  if (sendingType === 'plain') {
    expect(sentMsg.payload?.body?.data).to.match(/<img src="cid:(.+)@flowcrypt">Test Sending Plain Message With Image/);
    return;
    // todo - this test case is a stop-gap. We need to implement rendering of such messages below,
    //   then let test plain messages with images in them (referenced by cid) just like other types of messages below
  }
  let url = `chrome/dev/ci_pgp_host_page.htm?frameId=none&msgId=${encodeURIComponent(
    sentMsg.id
  )}&senderEmail=flowcrypt.compatibility%40gmail.com&isOutgoing=___cu_false___&acctEmail=flowcrypt.compatibility%40gmail.com`;
  if (sendingType === 'sign') {
    url += '&signature=___cu_true___';
  }
  // open a page with the sent msg, investigate img
  const pgpHostPage = await browser.newPage(t, url);
  const pgpBlockPage = await pgpHostPage.getFrame(['pgp_block.htm']);
  const img = await pgpBlockPage.waitAny('body img');
  expect(await PageRecipe.getElementPropertyJson(img, 'src')).to.eq(imgBase64);
};

const sendTextAndVerifyPresentInSentMsg = async (
  t: AvaContext,
  browser: BrowserHandle,
  text: string,
  sendingOpt: { encrypt?: boolean; sign?: boolean; richtext?: boolean } = {}
) => {
  const subject = `Test Sending ${sendingOpt.sign ? 'Signed' : ''} ${
    sendingOpt.encrypt ? 'Encrypted' : ''
  } Message With Test Text ${text} ${Util.lousyRandom()}`;
  const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility');
  await ComposePageRecipe.fillMsg(composePage, { to: 'human@flowcrypt.com' }, subject, text, sendingOpt);
  await ComposePageRecipe.sendAndClose(composePage);
  /* eslint-disable @typescript-eslint/no-non-null-assertion */
  // get sent msg from mock
  const sentMsg = (await GoogleData.withInitializedData('flowcrypt.compatibility@gmail.com')).searchMessagesBySubject(subject)[0];
  const message = encodeURIComponent(sentMsg.payload!.body!.data!);
  /* eslint-enable @typescript-eslint/no-non-null-assertion */
  await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, {
    content: [text],
    unexpectedContent: [],
    params: `?frameId=none&msgId=${encodeURIComponent(
      sentMsg.id
    )}&senderEmail=flowcrypt.compatibility%40gmail.com&isOutgoing=___cu_false___&acctEmail=flowcrypt.compatibility%40gmail.com&message=${message}`,
  });
};

const setRequirePassPhraseAndOpenRepliedMessage = async (t: AvaContext, browser: BrowserHandle, passphrase: string) => {
  const settingsPage = await browser.newExtensionSettingsPage(t);
  await SettingsPageRecipe.forgetAllPassPhrasesInStorage(settingsPage, passphrase);
  // Open Message Page
  const inboxPage = await browser.newExtensionPage(t, `chrome/settings/inbox/inbox.htm?acctEmail=flowcrypt.compatibility@gmail.com&threadId=16b584ed95837510`);
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

export const expectRecipientElements = async (controllable: ControllablePage, expected: { to?: EmailParts[]; cc?: EmailParts[]; bcc?: EmailParts[] }) => {
  for (const type of ['to', 'cc', 'bcc']) {
    const expectedEmails: EmailParts[] | undefined = (expected as Dict<EmailParts[]>)[type] || undefined;
    if (expectedEmails) {
      const container = await controllable.waitAny(`@container-${type}`, { visible: undefined });
      const recipientElements = await container.$$('.recipients > span');
      expect(recipientElements.length).to.equal(expectedEmails.length);
      for (const recipientElement of recipientElements) {
        const emailElement = await recipientElement.$('.recipient-email');
        const nameElement = await recipientElement.$('.recipient-name');
        const email = emailElement ? await PageRecipe.getElementPropertyJson(emailElement, 'textContent') : undefined;
        const name = nameElement ? await PageRecipe.getElementPropertyJson(nameElement, 'textContent') : undefined;
        expect(expectedEmails).to.deep.include(name ? { email, name } : { email });
      }
    }
  }
};

const importKeyManuallyAndViewTheNewContact = async (settingsPage: ControllablePage, recipientEmail: string, pubkey: string, button: string) => {
  await SettingsPageRecipe.toggleScreen(settingsPage, 'additional');
  const contactsFrame = await SettingsPageRecipe.awaitNewPageFrame(settingsPage, '@action-open-contacts-page', ['contacts.htm', 'placement=settings']);
  await contactsFrame.waitAll('@page-contacts');
  await contactsFrame.waitAndClick('@action-show-import-public-keys-form', { confirmGone: true });
  await contactsFrame.waitAndType('@input-bulk-public-keys', pubkey);
  await contactsFrame.waitAndClick('@action-show-parsed-public-keys', { confirmGone: true });
  await contactsFrame.waitAll('iframe');
  const pubkeyFrame = await contactsFrame.getFrame(['pgp_pubkey.htm']);
  await pubkeyFrame.waitForContent('@action-add-contact', button);
  await pubkeyFrame.waitAndType('@input-email', recipientEmail);
  await pubkeyFrame.waitAndClick('@action-add-contact');
  await pubkeyFrame.waitForContent('@container-pgp-pubkey', `${recipientEmail} added`);
  await contactsFrame.waitAndClick('@action-back-to-contact-list', { confirmGone: true });
  await contactsFrame.waitAndClick(`@action-show-email-${recipientEmail.replace(/[^a-z0-9]+/g, '')}`);
  return contactsFrame;
};

const importExpiredKeyForAutoRefresh = async (settingsPage: ControllablePage) => {
  const expiredPublicKey =
    '-----BEGIN PGP PUBLIC KEY BLOCK-----\r\nVersion: FlowCrypt Email Encryption 7.8.4\r\nComment: Seamlessly send and receive encrypted email\r\n\r\nxsBNBF8PcdUBCADi8no6T4Bd9Ny5COpbheBuPWEyDOedT2EVeaPrfutB1D8i\r\nCP6Rf1cUvs/qNUX/O7HQHFpgFuW2uOY4OU5cvcrwmNpOxT3pPt2cavxJMdJo\r\nfwEvloY3OfY7MCqdAj5VUcFGMhubfV810V2n5pf2FFUNTirksT6muhviMymy\r\nuWZLdh0F4WxrXEon7k3y2dZ3mI4xsG+Djttb6hj3gNr8/zNQQnTmVjB0mmpO\r\nFcGUQLTTTYMngvVMkz8/sh38trqkVGuf/M81gkbr1egnfKfGz/4NT3qQLjin\r\nnA8In2cSFS/MipIV14gTfHQAICFIMsWuW/xkaXUqygvAnyFa2nAQdgELABEB\r\nAAHNKDxhdXRvLnJlZnJlc2guZXhwaXJlZC5rZXlAcmVjaXBpZW50LmNvbT7C\r\nwJMEEAEIACYFAl8PcdUFCQAAAAEGCwkHCAMCBBUICgIEFgIBAAIZAQIbAwIe\r\nAQAhCRC+46QtmpyKyRYhBG0+CYZ1RO5ify6Sj77jpC2anIrJIvQIALG8TGMN\r\nYB4CRouMJawNCLui6Fx4Ba1ipPTaqlJPybLoe6z/WVZwAA9CmbjkCIk683pp\r\nmGQ3GXv7f8Sdk7DqhEhfZ7JtAK/Uw2VZqqIryNrrB0WV3EUHsENCOlq0YJod\r\nLqtkqgl83lCNDIkeoQwq4IyrgC8wsPgF7YMpxxQLONJvChZxSdCDjnfX3kvO\r\nZsLYFiKnNlX6wyrKAQxWnxxYhglMf0GDDyh0AJ+vOQHJ9m+oeBnA1tJ5AZU5\r\naQHvRtyWBKkYaEhljhyWr3eu1JjK4mn7/W6Rszveso33987wtIoQ66GpGcX2\r\nmh7y217y/uXz4D3X5PUEBXIbhvAPty71bnTOwE0EXw9x1QEIALdJgAsQ0Jnv\r\nLXwAKoOammWlUQmracK89v1Yc4mFnImtHDHS3pGsbx3DbNGuiz5BhXCdoPDf\r\ngMxlGmJgShy9JAhrhWFXkvsjW/7aO4bM1wU486VPKXb7Av/dcrfHH0ASj4zj\r\n/TYAeubNoxQtxHgyb13LVCW1kh4Oe6s0ac/hKtxogwEvNFY3x+4yfloHH0Ik\r\n9sbLGk0gS03bPABDHMpYk346406f5TuP6UDzb9M90i2cFxbq26svyBzBZ0vY\r\nzfMRuNsm6an0+B/wS6NLYBqsRyxwwCTdrhYS512yBzCHDYJJX0o3OJNe85/0\r\nTqEBO1prgkh3QMfw13/Oxq8PuMsyJpUAEQEAAcLAfAQYAQgADwUCXw9x1QUJ\r\nAAAAAQIbDAAhCRC+46QtmpyKyRYhBG0+CYZ1RO5ify6Sj77jpC2anIrJARgH\r\n/1KV7JBOS2ZEtO95FrLYnIqI45rRpvT1XArpBPrYLuHtDBwgMcmpiMhhKIZC\r\nFlZkR1W88ENdSkr8Nx81nW+f9JWRR6HuSyom7kOfS2Gdbfwo3bgp48DWr7K8\r\nKV/HHGuqLqd8UfPyDpsBGNx0w7tRo+8vqUbhskquLAIahYCbhEIE8zgy0fBV\r\nhXKFe1FjuFUoW29iEm0tZWX0k2PT5r1owEgDe0g/X1AXgSQyfPRFVDwE3QNJ\r\n1np/Rmygq1C+DIW2cohJOc7tO4gbl11XolsfQ+FU+HewYXy8aAEbrTSRfsff\r\nMvK6tgT9BZ3kzjOxT5ou2SdvTa0eUk8k+zv8OnJJfXA=\r\n=LPeQ\r\n-----END PGP PUBLIC KEY BLOCK-----\r\n';
  const recipientEmail = 'auto.refresh.expired.key@recipient.com';
  const contactsFrame = await importKeyManuallyAndViewTheNewContact(settingsPage, recipientEmail, expiredPublicKey, 'IMPORT EXPIRED KEY');
  await contactsFrame.waitForContent('@page-contacts', 'openpgp - expired - 6D3E 0986 7544 EE62 7F2E 928F BEE3 A42D 9A9C 8AC9');
  await contactsFrame.waitAndClick(`@action-show-pubkey-6D3E09867544EE627F2E928FBEE3A42D9A9C8AC9-openpgp`, {
    confirmGone: true,
  });
  await contactsFrame.waitForContent('@container-pubkey-details', 'Type: openpgp');
  await contactsFrame.waitForContent('@container-pubkey-details', 'Fingerprint: 6D3E 0986 7544 EE62 7F2E 928F BEE3 A42D 9A9C 8AC9');
  await contactsFrame.waitForContent('@container-pubkey-details', `Users: ${recipientEmail}`);
  await contactsFrame.waitForContent('@container-pubkey-details', 'Created on: Wed Jul 15 2020 21:15:01');
  await contactsFrame.waitForContent('@container-pubkey-details', 'Expiration: Wed Jul 15 2020 21:15:02');
  await contactsFrame.waitForContent('@container-pubkey-details', 'Expired: yes');
  await contactsFrame.waitForContent('@container-pubkey-details', 'Usable for encryption: false');
  await contactsFrame.waitForContent('@container-pubkey-details', 'Usable for signing: false');
  return { recipientEmail, contactsFrame };
};
