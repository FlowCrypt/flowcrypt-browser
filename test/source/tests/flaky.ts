/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import test from 'ava';
import { expect } from 'chai';

import { Config, TestVariant, Util } from './../util';

import { BrowserRecipe } from './tooling/browser-recipe';
import { ComposePageRecipe } from './page-recipe/compose-page-recipe';
import { PageRecipe } from './page-recipe/abstract-page-recipe';
import { SettingsPageRecipe } from './page-recipe/settings-page-recipe';
import { TestWithBrowser } from './../test';
import { InboxPageRecipe } from './page-recipe/inbox-page-recipe';
import { OauthPageRecipe } from './page-recipe/oauth-page-recipe';
import { testConstants } from './tooling/consts';
import { SetupPageRecipe } from './page-recipe/setup-page-recipe';
import { KeyUtil } from '../core/crypto/key';
import { ElementHandle, Frame, Page } from 'puppeteer';
import { expectRecipientElements } from './compose';
import { GoogleData } from '../mock/google/google-data';
import { ControllableFrame } from '../browser/controllable';
import { ConfigurationProvider } from '../mock/lib/api';
import { somePubkey } from '../mock/attester/attester-key-constants';

// these tests are run serially, one after another, because they are somewhat more sensitive to parallel testing
// eg if they are very cpu-sensitive (create key tests)

export const defineFlakyTests = (testVariant: TestVariant, testWithBrowser: TestWithBrowser) => {
  if (testVariant !== 'CONSUMER-LIVE-GMAIL') {
    test(
      'compose - own key expired - update and retry',
      testWithBrowser(async (t, browser) => {
        const acctEmail = 'flowcrypt.test.key.new.manual@gmail.com';
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
        const expiredKey = testConstants.expiredPrv;
        const validKey =
          '-----BEGIN PGP PRIVATE KEY BLOCK-----\nVersion: FlowCrypt 7.0.1 Gmail Encryption\nComment: Seamlessly send and receive encrypted email\n\n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\nGw==\n=18AI\n-----END PGP PRIVATE KEY BLOCK-----';
        // Setup Expired key
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acctEmail);
        await settingsPage.waitAndClick('@action-step0foundkey-choose-manual-enter');
        await settingsPage.waitAndClick('@input-step2bmanualenter-source-paste');
        await settingsPage.type('@input-step2bmanualenter-ascii-key', expiredKey);
        await settingsPage.type('@input-step2bmanualenter-passphrase', 'qweasd');
        await settingsPage.waitAndClick('@input-step2bmanualenter-save');
        await SettingsPageRecipe.waitForModalAndRespond(settingsPage, 'confirm', {
          contentToCheck: 'You are importing a key that is expired.',
          clickOn: 'confirm',
        });
        await SettingsPageRecipe.waitForModalAndRespond(settingsPage, 'warning', {
          contentToCheck: 'Public key not usable - not sumbitting to Attester',
          clickOn: 'confirm',
        });
        await settingsPage.waitAndClick('@action-step4done-account-settings');
        // Try To send message with expired key
        let composePage = await ComposePageRecipe.openStandalone(t, browser, acctEmail);
        await ComposePageRecipe.fillMsg(composePage, { to: 'human@flowcrypt.com' }, 'Own Key Expired');
        await composePage.waitAndClick('@action-send');
        await ComposePageRecipe.waitForModalAndRespond(composePage, 'warning', {
          contentToCheck: 'Failed to send message due to: Error: Your account keys are expired',
          timeout: 45,
          clickOn: 'confirm',
        });
        await composePage.close();
        await SettingsPageRecipe.toggleScreen(settingsPage, 'additional');
        await settingsPage.waitAndClick('@action-show-key-0');
        const urls = await settingsPage.getFramesUrls(['my_key.htm'], { appearIn: 5 });
        await settingsPage.close();
        // Updating the key to valid one
        const updatePrvPage = await browser.newPage(t, urls[0]);
        await updatePrvPage.waitAndClick('@action-update-prv');
        await updatePrvPage.waitAndType('@input-prv-key', validKey);
        await updatePrvPage.type('@input-passphrase', 'qweasd');
        await updatePrvPage.waitAndClick('@action-update-key');
        await PageRecipe.waitForModalAndRespond(updatePrvPage, 'confirm', { clickOn: 'confirm' });
        await updatePrvPage.close();
        // Try send message again
        composePage = await ComposePageRecipe.openStandalone(t, browser, acctEmail);
        await ComposePageRecipe.fillMsg(composePage, { to: 'human@flowcrypt.com' }, 'Own Key Expired no more');
        await ComposePageRecipe.sendAndClose(composePage);
      })
    );

    test(
      'setup - create key - with backup to inbox',
      testWithBrowser(async (t, browser) => {
        const acctEmail = 'flowcrypt.test.key.new.manual@gmail.com';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acctEmail]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acctEmail);
        await SetupPageRecipe.createKey(
          settingsPage,
          'flowcrypt.test.key.used.pgp',
          'email',
          { submitPubkey: true, usedPgpBefore: true },
          { isSavePassphraseChecked: false, isSavePassphraseHidden: false }
        );
      })
    );

    test(
      'setup - create key - choose no backup',
      testWithBrowser(async (t, browser) => {
        const acctEmail = 'flowcrypt.test.key.new.manual@gmail.com';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acctEmail]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acctEmail);
        await SetupPageRecipe.createKey(
          settingsPage,
          'flowcrypt.test.key.used.pgp',
          'none',
          { submitPubkey: false, usedPgpBefore: true },
          { isSavePassphraseChecked: false, isSavePassphraseHidden: false }
        );
      })
    );

    test(
      'setup - create key - backup as file - submit pubkey',
      testWithBrowser(async (t, browser) => {
        const acctEmail = 'flowcrypt.test.key.new.manual@gmail.com';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acctEmail]: {
                pubkey: somePubkey,
              },
            },
          },
        });
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acctEmail);
        await SetupPageRecipe.createKey(
          settingsPage,
          'flowcrypt.test.key.used.pgp',
          'file',
          { submitPubkey: true, usedPgpBefore: true },
          { isSavePassphraseChecked: false, isSavePassphraseHidden: false }
        );
      })
    );

    test(
      'create@prv-create-no-prv-backup.flowcrypt.test - create key allowed but backups not',
      testWithBrowser(async (t, browser) => {
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {},
          },
        });
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, 'setup@prv-create-no-prv-backup.flowcrypt.test');
        await SetupPageRecipe.createKey(
          settingsPage,
          'flowcrypt.test.key.used.pgp',
          'disabled',
          { submitPubkey: false, usedPgpBefore: false, enforcedAlgo: 'rsa2048' },
          { isSavePassphraseChecked: false, isSavePassphraseHidden: false }
        );
      })
    );

    test(
      'compose - reply all - from === acctEmail',
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
        await composePage.waitAndClick('@action-accept-reply-all-prompt', { delay: 1 });
        await expectRecipientElements(composePage, {
          to: [{ email: acct, name: 'First Last' }, { email: 'vladimir@flowcrypt.com' }],
          cc: [{ email: 'limon.monte@gmail.com' }],
          bcc: [{ email: 'sweetalert2@gmail.com' }],
        });
        await composePage.waitAndType('@input-password', 'gO0d-pwd');
        await composePage.waitAndClick('@action-send', { delay: 1 });
        // test rendering of recipients after successful sending
        await composePage.waitForContent('@replied-to', 'to: First Last <flowcrypt.compatibility@gmail.com>, vladimir@flowcrypt.com');
        await composePage.waitForContent('@replied-cc', 'cc: limon.monte@gmail.com');
        await composePage.waitForContent('@replied-bcc', 'bcc: sweetalert2@gmail.com');
      })
    );

    test(
      'user@no-submit-client-configuration.flowcrypt.test - do not submit to attester on key generation',
      testWithBrowser(async (t, browser) => {
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {},
          },
        });
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, 'user@no-submit-client-configuration.flowcrypt.test');
        await SetupPageRecipe.createKey(
          settingsPage,
          'unused',
          'none',
          { key: { passphrase: 'long enough to suit requirements' }, usedPgpBefore: false },
          { isSavePassphraseChecked: false, isSavePassphraseHidden: false }
        );
        await settingsPage.notPresent('.swal2-container');
        await settingsPage.close();
      })
    );

    test(
      'settings - generate rsa3072 key',
      testWithBrowser(async (t, browser) => {
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {},
          },
        });
        const acctEmail = 'user@no-submit-client-configuration.flowcrypt.test';
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acctEmail);
        await SetupPageRecipe.createKey(settingsPage, 'unused', 'none', {
          selectKeyAlgo: 'rsa3072',
          key: { passphrase: 'long enough to suit requirements' },
        });
        await SettingsPageRecipe.toggleScreen(settingsPage, 'additional');
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const fingerprint = (await settingsPage.read('.good', true))!.split(' ').join('');
        const myKeyFrame = await browser.newPage(
          t,
          `chrome/settings/modules/my_key.htm?placement=settings&parentTabId=60%3A0&acctEmail=${acctEmail}&fingerprint=${fingerprint}`
        );
        const downloadedFiles = await myKeyFrame.awaitDownloadTriggeredByClicking('@action-download-prv');
        // const longid = OpenPGPKey.fingerprintToLongid(fingerprint);
        const longid = fingerprint.substring(fingerprint.length - 16);
        const fileName = `flowcrypt-backup-usernosubmitclientconfigurationflowcrypttest-0x${longid}.asc`;
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const key = await KeyUtil.parse(downloadedFiles[fileName]!.toString());
        expect(key.algo.bits).to.equal(3072);
        expect(key.algo.algorithm).to.equal('rsaEncryptSign');
        await myKeyFrame.close();
        await settingsPage.close();
      })
    );

    test(
      'user4@standardsubdomainfes.localhost:8001 - PWD encrypted message with FES web portal - some sends fail with BadRequest error',
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
        const port = t.urls?.port;
        const acct = `user4@standardsubdomainfes.localhost:${port}`; // added port to trick extension into calling the mock
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acct);
        await SetupPageRecipe.manualEnter(
          settingsPage,
          'flowcrypt.test.key.used.pgp',
          { submitPubkey: false, usedPgpBefore: false },
          { isSavePassphraseChecked: false, isSavePassphraseHidden: false }
        );
        // add a name to one of the contacts
        const dbPage = await browser.newExtensionPage(t, 'chrome/dev/ci_unit_test.htm');
        await dbPage.page.evaluate(async () => {
          /* eslint-disable @typescript-eslint/no-explicit-any */
          const db = await (window as any).ContactStore.dbOpen();
          await (window as any).ContactStore.update(db, 'cc@example.com', { name: 'Mr Cc' });
          /* eslint-enable @typescript-eslint/no-explicit-any */
        });
        await dbPage.close();
        const subject = 'PWD encrypted message with FES web portal - some sends fail with BadRequest error - ' + testVariant;
        let expectedNumberOfPassedMessages = (await GoogleData.withInitializedData(acct)).searchMessagesBySubject(subject).length;
        // 1. vague Gmail error with partial success
        let composePage = await ComposePageRecipe.openStandalone(t, browser, `user4@standardsubdomainfes.localhost:${port}`);
        await ComposePageRecipe.fillMsg(composePage, { to: 'to@example.com', cc: 'cc@example.com', bcc: 'flowcrypt.compatibility@gmail.com' }, subject);
        await composePage.waitAndType('@input-password', 'gO0d-pwd');
        await composePage.waitAndClick('@action-send', { delay: 1 });
        await composePage.waitAndRespondToModal(
          'confirm',
          'cancel',
          'Messages to some recipients were sent successfully, while messages to flowcrypt.compatibility@gmail.com, Mr Cc <cc@example.com> ' +
            'encountered error(s) from Gmail. Please help us improve FlowCrypt by reporting the error to us.'
        );
        await composePage.close();
        expect((await GoogleData.withInitializedData(acct)).searchMessagesBySubject(subject).length).to.equal(++expectedNumberOfPassedMessages);
        // 2. vague Gmail error with all failures
        composePage = await ComposePageRecipe.openStandalone(t, browser, `user4@standardsubdomainfes.localhost:${port}`);
        await ComposePageRecipe.fillMsg(composePage, { cc: 'cc@example.com', bcc: 'flowcrypt.compatibility@gmail.com' }, subject);
        await composePage.waitAndType('@input-password', 'gO0d-pwd');
        await composePage.waitAndClick('@action-send', { delay: 1 });
        await composePage.waitAndRespondToModal(
          'confirm',
          'cancel',
          'Google returned an error when sending message. ' + 'Please help us improve FlowCrypt by reporting the error to us.'
        );
        await composePage.close();
        expect((await GoogleData.withInitializedData(acct)).searchMessagesBySubject(subject).length).to.equal(expectedNumberOfPassedMessages); // + 0 messages
        // 3. "invalid To" Gmail error with partial success
        composePage = await ComposePageRecipe.openStandalone(t, browser, `user4@standardsubdomainfes.localhost:${port}`);
        await ComposePageRecipe.fillMsg(composePage, { to: 'invalid@example.com', cc: 'to@example.com' }, subject);
        await composePage.waitAndType('@input-password', 'gO0d-pwd');
        await composePage.waitAndClick('@action-send', { delay: 1 });
        await composePage.waitAndRespondToModal(
          'error',
          'confirm',
          'Messages to some recipients were sent successfully, while messages to invalid@example.com ' +
            'encountered error(s) from Gmail: Invalid recipients\n\nPlease remove recipients, add them back and re-send the message.'
        );
        await composePage.close();
        expect((await GoogleData.withInitializedData(acct)).searchMessagesBySubject(subject).length).to.equal(++expectedNumberOfPassedMessages);
        // 4. "invalid To" Gmail error with all failures
        composePage = await ComposePageRecipe.openStandalone(t, browser, `user4@standardsubdomainfes.localhost:${port}`);
        await ComposePageRecipe.fillMsg(composePage, { to: 'invalid@example.com', cc: 'cc@example.com' }, subject);
        await composePage.waitAndType('@input-password', 'gO0d-pwd');
        await composePage.waitAndClick('@action-send', { delay: 1 });
        await composePage.waitAndRespondToModal(
          'error',
          'confirm',
          'Error from google: Invalid recipients\n\nPlease remove recipients, add them back and re-send the message.'
        );
        await composePage.close();
        expect((await GoogleData.withInitializedData(acct)).searchMessagesBySubject(subject).length).to.equal(expectedNumberOfPassedMessages); // + 0 messages
        // 5. "RequestTimeout" error with partial success
        composePage = await ComposePageRecipe.openStandalone(t, browser, `user4@standardsubdomainfes.localhost:${port}`);
        await ComposePageRecipe.fillMsg(composePage, { to: 'timeout@example.com', cc: 'to@example.com' }, subject);
        await composePage.waitAndType('@input-password', 'gO0d-pwd');
        await composePage.waitAndClick('@action-send', { delay: 1 });
        await composePage.waitAndRespondToModal(
          'error',
          'confirm',
          'Messages to some recipients were sent successfully, while messages to timeout@example.com ' +
            'encountered network errors. Please check your internet connection and try again.'
        );
        await composePage.close();
        expect((await GoogleData.withInitializedData(acct)).searchMessagesBySubject(subject).length).to.equal(++expectedNumberOfPassedMessages);
        // 6. "RequestTimeout" error with all failures
        composePage = await ComposePageRecipe.openStandalone(t, browser, `user4@standardsubdomainfes.localhost:${port}`);
        await ComposePageRecipe.fillMsg(composePage, { to: 'timeout@example.com', cc: 'cc@example.com' }, subject);
        await composePage.waitAndType('@input-password', 'gO0d-pwd');
        await composePage.waitAndClick('@action-send', { delay: 1 });
        await composePage.waitAndRespondToModal(
          'error',
          'confirm',
          'Could not send message due to network error. Please check your internet connection and try again. ' +
            '(This may also be caused by missing extension permissions).'
        );
        await composePage.close();
        expect((await GoogleData.withInitializedData(acct)).searchMessagesBySubject(subject).length).to.equal(expectedNumberOfPassedMessages); // + 0 messages
        // this test is using PwdEncryptedMessageWithFesReplyBadRequestTestStrategy to check sent result based on subject
        // "PWD encrypted message with FES web portal - some sends fail with BadRequest error"
        // also see '/api/v1/message' in customer-url-fes-endpoints.ts mock
      })
    );

    test(
      'user@forbid-storing-passphrase-client-configuration.flowcrypt.test - do not store passphrase',
      testWithBrowser(async (t, browser) => {
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              'human@flowcrypt.com': {
                pubkey: somePubkey,
              },
            },
          },
        });
        const acctEmail = 'user@forbid-storing-passphrase-client-configuration.flowcrypt.test';
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acctEmail);
        const passphrase = 'long enough to suit requirements';
        await SetupPageRecipe.createKey(
          settingsPage,
          'unused',
          'none',
          { key: { passphrase }, usedPgpBefore: false },
          { isSavePassphraseHidden: true, isSavePassphraseChecked: false }
        );
        await settingsPage.notPresent('.swal2-container');
        const inboxPage = await browser.newExtensionInboxPage(t, acctEmail);
        await InboxPageRecipe.finishSessionOnInboxPage(inboxPage);
        const composeFrame = await InboxPageRecipe.openAndGetComposeFrame(inboxPage);
        await ComposePageRecipe.fillMsg(composeFrame, { to: 'human@flowcrypt.com' }, 'should not send as pass phrase is not known', undefined, {
          encrypt: false,
        });
        await composeFrame.waitAndClick('@action-send');
        await inboxPage.waitAll('@dialog-passphrase');
        const passphraseDialog = await inboxPage.getFrame(['passphrase.htm']);
        await passphraseDialog.waitForContent('@lost-pass-phrase-with-ekm', 'Ask your IT staff for help if you lost your pass phrase.');
        expect(await passphraseDialog.hasClass('@forget-pass-phrase-label', 'hidden')).to.equal(true);
        expect(await passphraseDialog.isChecked('@forget-pass-phrase-checkbox')).to.equal(true);
        await inboxPage.close();
        await settingsPage.close();
      })
    );

    test(
      'standalone - different send from, new signed message, verification in mock',
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
        const key = Config.key('flowcryptcompatibility.from.address');
        await SettingsPageRecipe.addKeyTest(
          t,
          browser,
          acct,
          key.armored!, // eslint-disable-line @typescript-eslint/no-non-null-assertion
          key.passphrase!, // eslint-disable-line @typescript-eslint/no-non-null-assertion
          { isSavePassphraseChecked: true, isSavePassphraseHidden: false }
        );
        const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility');
        await ComposePageRecipe.selectFromOption(composePage, 'flowcryptcompatibility@gmail.com');
        await ComposePageRecipe.fillMsg(composePage, { to: 'human@flowcrypt.com' }, 'New Signed Message (Mock Test)', undefined, {
          encrypt: false,
        });
        await ComposePageRecipe.sendAndClose(composePage);
      })
    );

    test(
      'compose - test compose after reconnect account',
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
        await Util.wipeGoogleTokensUsingExperimentalSettingsPage(t, browser, acct);
        await ComposePageRecipe.showRecipientInput(composePage);
        const subject = 'PWD encrypted message after reconnect account';
        await ComposePageRecipe.fillMsg(composePage, { to: 'test@email.com' }, subject);
        await composePage.waitAndType('@input-password', 'gO0d-pwd');
        await composePage.waitAndClick('@action-send', { delay: 1 });
        const oauthPopup = await browser.newPageTriggeredBy(t, () =>
          composePage.waitAndRespondToModal('confirm', 'confirm', 'Please log in with FlowCrypt to continue')
        );
        await OauthPageRecipe.google(t, oauthPopup, acct, 'approve');
        await ComposePageRecipe.closed(composePage);
        expect((await GoogleData.withInitializedData(acct)).searchMessagesBySubject(subject).length).to.equal(1);
      })
    );

    test(
      'with attachments + shows progress %',
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
        await ComposePageRecipe.fillMsg(composePage, { to: 'human@flowcrypt.com' }, 'with files');
        const fileInput = (await composePage.target.$('input[type=file]')) as ElementHandle<HTMLInputElement>;
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        await fileInput!.uploadFile('test/samples/small.txt', 'test/samples/small.png', 'test/samples/small.pdf', 'test/samples/large.jpg');
        await ComposePageRecipe.sendAndClose(composePage, { expectProgress: true, timeout: 120 });
      })
    );

    test(
      'compose > large file > public domain account (should not prompt to upgrade)',
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
        await ComposePageRecipe.fillMsg(composePage, { to: 'human@flowcrypt.com' }, 'a large file test (gmail account)');
        const fileInput = (await composePage.target.$('input[type=file]')) as ElementHandle<HTMLInputElement>;
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        await fileInput!.uploadFile('test/samples/large.jpg');
        await Util.sleep(2);
        await ComposePageRecipe.sendAndClose(composePage, { timeout: 60, expectProgress: true });
      })
    );

    test(
      'compose - PWD encrypted message with flowcrypt.com/shared-tenant-fes',
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
        const subject = 'PWD encrypted message with flowcrypt.com/shared-tenant-fes';
        const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility');
        await ComposePageRecipe.fillMsg(composePage, { to: 'test@email.com' }, subject);
        const fileInput = (await composePage.target.$('input[type=file]')) as ElementHandle<HTMLInputElement>;
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        await fileInput!.uploadFile('test/samples/small.txt');
        await ComposePageRecipe.sendAndClose(composePage, { password: msgPwd });
        // this test is using PwdEncryptedMessageWithFlowCryptComApiTestStrategy to check sent result based on subject "PWD encrypted message with flowcrypt.com/shared-tenant-fes"
      })
    );

    test(
      'compose - load contacts - contacts should be properly ordered',
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
        let composeFrame = await InboxPageRecipe.openAndGetComposeFrame(inboxPage);
        await composeFrame.type('@input-to', 'testsearchorder');
        if (testVariant === 'CONSUMER-MOCK') {
          // allow contacts scope, and expect that it will find contacts
          const oauthPopup = await browser.newPageTriggeredBy(t, () => composeFrame.waitAndClick('@action-auth-with-contacts-scope'));
          await OauthPageRecipe.google(t, oauthPopup, acct, 'approve');
        }
        await ComposePageRecipe.expectContactsResultEqual(composeFrame, [
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
        await ComposePageRecipe.pastePublicKeyManually(composeFrame, inboxPage, 'testsearchorder3@flowcrypt.com', testConstants.smimeCert);
        await composeFrame.waitAndClick('@action-send', { delay: 1 });
        await composeFrame.waitAndClick('.swal2-cancel');
        await composeFrame.waitAndClick('@action-close-new-message');
        await inboxPage.waitTillGone('@container-new-message');
        // add key
        composeFrame = await InboxPageRecipe.openAndGetComposeFrame(inboxPage);
        await ComposePageRecipe.fillMsg(composeFrame, { to: 'testsearchorder9@flowcrypt.com' }, t.title);
        await ComposePageRecipe.pastePublicKeyManually(composeFrame, inboxPage, 'testsearchorder9@flowcrypt.com', testConstants.smimeCert);
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
        await ComposePageRecipe.expectContactsResultEqual(composeFrame, [
          'testsearchorder3@flowcrypt.com', // hasPgp + lastUse
          'testsearchorder9@flowcrypt.com', // hasPgp
          'testsearchorder5@flowcrypt.com', // lastUse
          'testsearchorder1@flowcrypt.com',
          'testsearchorder2@flowcrypt.com',
          'testsearchorder4@flowcrypt.com',
          'testsearchorder6@flowcrypt.com',
          'testsearchorder7@flowcrypt.com',
        ]);
      })
    );
    test(
      'decrypt - entering pass phrase should unlock all keys that match the pass phrase',
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
        await SettingsPageRecipe.addKeyTest(t, browser, acctEmail, testConstants.testkey17AD7D07, passphrase, {}, false);
        await SettingsPageRecipe.addKeyTest(t, browser, acctEmail, testConstants.testkey0389D3A7, passphrase, {}, false);
        await SettingsPageRecipe.addKeyTest(t, browser, acctEmail, testConstants.testKeyMultipleSmimeCEA2D53BB9D24871, passphrase, {}, false);
        const inboxPage = await browser.newExtensionInboxPage(t, acctEmail);
        await InboxPageRecipe.finishSessionOnInboxPage(inboxPage);
        await InboxPageRecipe.checkDecryptMsg(t, browser, {
          acctEmail,
          threadId: '17c0e50966d7877c',
          expectedContent: '1st key of of 2 keys with the same passphrase',
          enterPp: {
            passphrase,
            isForgetPpChecked: true,
            isForgetPpHidden: false,
          },
        });
        await InboxPageRecipe.checkDecryptMsg(t, browser, {
          acctEmail,
          threadId: '17c0e55caaa4abb3',
          expectedContent: '2nd key of of 2 keys with the same passphrase',
          // passphrase for the 2nd key should not be needed because it's the same as for the 1st key
        });
        // as decrypted s/mime messages are not rendered yet (#4070), let's test signing instead
        const composeFrame = await InboxPageRecipe.openAndGetComposeFrame(inboxPage);
        await ComposePageRecipe.fillMsg(composeFrame, { to: 'smime@recipient.com' }, 'send signed and encrypted S/MIME without attachment');
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
    test.skip(
      'decrypt - benchmark decryption of 50 pgp messages',
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
        /* sample to generate the key and messages
        const passphrase = 'some pass for testing';
        const keypair = await OpenPGPKey.create([{ name: 'Test', email: 'rsa4096@flowcrypt.test' }], 'rsa4096', passphrase, 0);
        const pubkeys = [await KeyUtil.parse(keypair.public)];
        let textData = keypair.public + '\n\n\n\n';
        for (let i = 0; i < 50; i++) {
          const data = Buf.fromUtfStr(`This is a message sample #${i}`);
          const encrypted = await MsgUtil.encryptMessage({
            pubkeys,
            data,
            armor: true,
          });
          textData += Buf.with(encrypted.data).toUtfStr();
          textData += '\n\n\n\n';
        }
        */
        const rsa4096 = `-----BEGIN PGP PRIVATE KEY BLOCK-----
Version: FlowCrypt Email Encryption
Comment: Seamlessly send and receive encrypted email

xcaGBGP3mG0BEACizIARiiu/94lklk+OVeR9Or26yb2FNTOIQl0xQx5pMBkr
J0sDIj4MGk5ZpALUnxbWCGCFZJHvufwY1Wye6ImhU4Bcw07i2Hj5wYXuvQDX
uDtcFywoMtpOFQOAK7Tbkikupk5W9BmK5JXuVpO5KTVOekuB1qtl7TXoTW73
VdZ/cRMEwevyG04L+3wgsoTa14qZe+vx0Tk9ZDhGN8UmyFvIMsxdOTbzc2sk
HN5yG5xkXbtNc+rublpaoO+h32ZDuD0KePsRlDNxPPFZNIKnzFfay3T/DN4p
8V8bbKgTfWLPcnQ/F7jfiLFzoHqKrmzb6jzvQUTkowStMnJiO1KWHDlW9Db1
GvyCuYTuoKPEmYSITD5r/Y/eqSrV1ehxV9sXgaXZ5VCa/MxHFrxWflxq9S3k
3EKOTagdQu9Vo4YKsE4r9PdIo9bbJxjzjvcbTo7cUwkioOU40RVxHJ7TTMMd
wsvjntzoLqyVohsMlqERq1S4QhzXlLqkCAqOTipzcns+C9TpLOKtZp6QAL8/
yvn1xdWZZ8s8jby7mzIyeS1F8axsiAYA7ljmsc9yjtOtU2vNdu40jMYdaHLf
6ws/uwwBZEETDS1eDhJfPS8FUS11HFjzTWJ8u49YJz2FIS8SzGoIR9HQD015
Mfk5iDWff4LMZuHa/li2tEUMimgXjiSRUQ9GMQARAQAB/gkDCAw4VMpfTDwC
4Ns1DZnyQ3jcz9/2e0ID/GYglL6uoM7EZps7TR+hg2uvfE9Y6N2mTp3CUAIA
lR24SAkxieyHtdY6UoeNeb7rsrUw48YSiC0QwKtWItJYL7Evnb7JpN1SuA8A
ugkohJqZ4s2DZY24wpwCalfUBxoosxvjn1c6n6b5WBgIUSrdfugMEBhMqeuN
eTiPC0VrAa78QLTEimurKuxn0pQ9SaM31Y0jUMRPIlDz0M1rrHNj1LXIJfLd
weY3zIvcERzmi4BiwRtzXPD/ciqBK1wRhEEXP3A+dLuqfBSPJDLcPgVJXk3t
qLz+e4uGcFzFKmaptUbUvm/h3k2OFNWooYPfD1ONdz18Iwx+/Z9ZI71ixBgp
2fqiItRBn5oeZ2PDoESaGb6Lw5Xkbsl9OUxFnQMfb95ReZjExBtZR/7hgL3X
H4wNOtK3in+Lg+BIvUqqB8s0z8Dovo2Vcw/TG2ZgbzNVYsXabeWbBC6AEo/P
uItiu9Q2psynIkLPPnV4aveBIxmcq5MQgCDyuf8HEOg0t+fdu/u0MqoJqoHg
zv3vvya9CNLqT6MPPcRwTZL0A7J/O0wJlIJQr5KWByoGlseeyFZN47Clfc2O
FZRyELsHoJzn9+xpQUpcx4p1IRQnEikdDCMqku+uQMV+9pKHG7GgTHUhsmTt
X7VAOf2YIW4uNP/x4BUTNOrFrD5pVnDfv2nT3OoS5QCROOKEwRNj6CBjf4c7
nJGpzo+gBqy1Q1L01Fxqt6v1kTYkS2MhXO/2soV4m2iiF5+xXIo+LgzeBhW1
KE2MWXmalwDxyjwu28pVT8Qe+gKkLvoTpOvN+aQl4+3EV6RB9OvlU7U/g82m
xYF9/b9t08vvq7if42mjksc3FxrEHcTzKdyxRO4IX0FG8fMrF9cJxsP04Ml2
SWODPnNXHpf72ARjavz0zjdsMh+KpPjPNdgtJ6G2wdpb3HwxzRrQp/f4lRmU
9qzHECQfaW7kO4Vtkj8wW//VT9S04b66bD0T67ew8//dJ12V39yJ4bFxxLPf
vmtiG0vd6wWyMUvR21RMFo9zlpcPIHIDVaslZHmnABv67uWDCl3r8mZ5kEtr
JWKdE/5FeTILDQo7mkhJgCo8Y0fTZePDyYNBzz7m6jja3MUiLq45B6wzEPDd
4YQHcdRx4SoEZrc7gzm/+2ABEc39YX3wi7Jwh8vc4RlCULlrfMgz2H+/ABRP
V7fVI4uqEbaVkWsMx3qF4B88wnL9DVWkBSF50TvMPdBAEvsUQrmr1VEzv9dZ
1lkWrrW6U0tgOp9LDWz38mnGeQ2eHcWHtpiVCFW09NypZ1/ue3u7+qbmSkSP
NhzpjqSOsJDb6W8160G27uG3AU9eDzSjxsTTByOcug+UNZtIUI9a+/DDWhjN
o+RqKo3Pm81J+nASPqTv2fel3HdUKcv3RAnHIDvTPtGghs7J5www77/w7CCG
JbYAtUDss09CMfMMVt8U/SO82+rPJ+GSoP0wxs6aBkbu5k200+pQA3y3KdUh
AXQSMMf/zzDRjbvVC3tzGOi06Bwjkk7YkkshppPO/7u11lpgOjOAqzH8jgc9
D1ikN78ZsfqoZF6VyMdnT+FOwIerTCUgPJXCbNbnUEv5X6ca+O+n38NnxN1f
3AS+fM2x3pVdbTo9kQHjb6e6wsSPFPrDYl34FnfEgb86fmZdO7TN0fgMWew0
zDRtKmhl5XHE+MozfDFIxh+lHMTJEEA4b5L9Y4knTS+U5cjYt8Mv8UC+0PS4
ZJHnaOopoCntcMptJInfOeiWCJ7NHVRlc3QgPHJzYTQwOTZAZmxvd2NyeXB0
LnRlc3Q+wsGKBBABCAA+BQJj95htBAsJBwgJEP5fEhRygzu9AxUICgQWAAIB
AhkBAhsDAh4BFiEENOKSqgp2KwNl6T5d/l8SFHKDO70AAIsSD/4nu7DapkTU
0NkWcXaCypVcRJkwEZY9QSSQSIxeI5ryZkFo0QKxRF8FLusfxyn3ktr5mR4I
ZyCnQ/rgDupyWJhdWauDNIx3mPLtCUEJ2rLmlr6Wli/hlSjTK0V9y/hhILkH
i0CZoshNYGPWhOrAojen4q4stO4vT1yJ2e65HpFr2wWf7ZTM5KwOvhb2ztHf
kO81NWFJVjp9ZRNyd6KWSg6epWiLgpQeR+8IBDnbRWdezAh6zcMqjjd2/kf7
OqJfzHSUgk8iQJDC7rxkN+FYRnQn+NUuNHD0W+lszrjBXnh1UUMy2xorjjx2
B5AFIX95rJIsrTbH9U3Bk6GWcO5IdAI7hS1SlkOFeIaVsdlxQ4I/o1dVA4AO
Y46E52m/xQW1EsjsUGuxXX/vXCjuXuNMvm7xOe+H2HxpztfyxAWz1fhT6vLX
a2IyFb2kwljORG4z1ACoycUFndhY4HabX6ILVxVG25aB6/1BnQ/JbsiSV5sY
Z0HGYA1VBck1UUS9aNYgtbuBfhlsZbrmQVmZLYmEJ5BqKToPlSIcmqwnZk9p
oVvND2p2LCdKtAP8WhJx4KpDjkabWC9F4RK7U1eBcVdKF9GpfnBcTRiLgHho
MhMLSa8TQ8Sjep3KJiBigTemM1h4xGjOdRgYqiZi6OPSLWZFbKg46h0Dy4fF
dhJjxZeuhUnwzsfGhgRj95htARAAp5CS1zrO4WcWnPwHt4GugMU0bvmOJMjD
PCTGdmNuOMAwQB4vU929s19ozk3dJkoy4vxx3sxahhqiKuMbe0aIqut/GTYY
mcVtzpREHXOC6juCLvv4Cb5DqnES9p+RN4wp1Tg6WYJpk9olseeuG00w5rKf
FL7Xb2/gOo/yaaxZUABit0LH37MonDNkGQsSEs1xfhLNp7eRoAEfI8kDPPPp
qLP0Mw8n9yfijLAcucholixNvXGOCLUcHSw1ZCIZnF4T+0TAQyVEHbeATFNY
++eQBGe9EFHC35e5tLHj3XbpbxWR9Ttt4kKi0TOuL6s3m8h3Y5q6UfBP1KaH
VBY46l1DPf4jNXQsefCZpEVCVPcDrwIQ0vNR/MSJTE53aWh2M6bNVU9zuSqP
4jlvKMspGwF4XONAHT+Ezb5sA1zAuPUfyPxFtlSz5n6bC5PmjUhnBWhdNEgR
Na6cHjO1PUcZzyUWLVmSJNUSsevhJZvvqbhGXVc7QxrkOTZwQ0R2lWVzCn69
R4S5bX9vtzsPmTFCGWeV27g94D4009QUDbs/BeCrH69flT9wiwMmtFMl3p8f
tpdmq8XnerIlQoiYerhQQfcJ1A1ywR7OA6dpG7V1ZIDSCQwEjuHAwjs6hbDM
e4S+z3DX6yWjXu622cp0LcOWGbLUGBGI3ZrkA6+f36sm6GcrRHMAEQEAAf4J
AwhOJVhHCZJpGeDchCUld/YJPA3Zpxb84W+OuDKYOurHZ4JUUEzMPNvuQ0+K
r+vxUBTfG4IfJa6N9lIfRi0RW3I7YkUkSesmCjtL25xKtduU7sYtJzRe3Tyk
ke3EQviSXHPPqf2rfxiOKoewkgXxtb4hl+09FkzoTV5+oyL28efzOsxhk+WX
8+G9/kj+JxHnMGI7/tXdZmzJw6qCCve51/IbvI0J58mTFySnlcp5HxHwGJhV
rca8bu9In4e7ksHLZzGe5mcYKMx1QCw2EkvangeWgHxFsI36sGTNbSzjKCC8
O/E+mmyeFWXWPF1LoCpwxhI//b+B7vFSWOcDHYwx1ZmIvNJLiQye/xx++g6J
FN8Yoa+2+ycMv+vN63Q9BkrmNbJ27RWKpcLqYy2NkycgZxvs9wjmgfWrA+7X
l8wCIx3n3tLR5l7inbwrstDad+PMncqKB4IdUPLgACCxZ9t1JphxY4sDL1Iy
BLZedk12a6XZYvLOoNb4c1CKB5ohWoB1Wdn9t2fVXpQ83plnU0Qev5xF5U7F
ikOjJmnt+onbbkRtKDSOiqdqsZEtXIp5tyj5huCPnrbD8kwPGB0ERD2j8gmR
ZyTEesrTRbkwPYuzTEmTZIQIpngdKNSDyuD0epda093OCkSS3ZgM7ZUnl87N
JBt2oKUxtUSonV68SCMJKedFf9EcB2DaeWIp6bgBsVeT91yqMXNdlHr43lWY
Kl/nJolRdnhRKB4m+K/epOwWaxoWLMmjv6Dm3Vv8BEnEQnkZbtQDrIHDXxqk
zgMauv0xxcMconECysFWMpFVzz0x/wka69ldoOqONggCLYvRgCjhWlgPkF2Z
tZvrxecIN5a1ooR1aMamwsYa3m4wcfnlVKSBSYR5rqhey974+et0H84zbdts
Yp4k3OYp0S1UURr+m0OnoPdZGMRNWaWQ4yugMvDMYZQHrzkzidaAVeHnLceD
4GHBLiCSKLShxDYDGlG97to9SozFu5d7AeDKD8MDrZDGh77BXPsjWTBaHsFm
jxSiSYhrzpxXyYWzqq+30njYeV/b8yfGCuvh28hG2kPmnMU/nVg4BZTYVsku
OZjph54bGmGjU7g/hIdIaKQOCsMGkGJSh9nYtjL07v0XLARLC0Fpjk05vyTv
HswNNRlo+P6mRe9r21Guya3ltQ1CFPxahFbf2wfpRNoKQW9z6psTn9aeXZyT
wKkM6OyW45yp6bGqtj6G5WCyxj8s9l14W4VtnU1+lv8wFxnXD1/PTqi2Yqcg
A41arfzzbaon3WCc4fJXIrYbjrjiNTF/D9wb1RVoybP5nwExGNyJE2rn/Hjs
dQGfTxJUI1tZ9xCMIqkcPJIXLjwdWXLEyj9NKhAp2SBjIY9r7cJQT5CeibGN
NMV6UcDB42xr58AOZsEUTo5r8wgGBeCsPt0Qu3nNU69Uk8iZQUQyr3OEHQjJ
g+vsSmbrn1Knk+quPP/2CQ0xrLKkYHNjHcLuk+3niLrhwqQhg6vo/sWKPy7N
re54MOliGTQzFFVqOUJ5IS+WLfAPaXG5g5njcv9Q4NhyJvnzw4tGKTdMt7eF
FIjed5XvrEU8oiyla+5kPlvXuqVsL3jOyZJM3hz+zCIknjHJybX5ldEetmFF
YF2OaVDujaZEvZ3htHsf1SBWG9ZcA6E02D0JXUHc947ID0/uZzO52Sak6Q86
ujNl6eqX7nU+Ct/TvdLnh8kKe+2WnHtU1m6AlFfsWpQisSsnEqc56ICoqsXy
onFB7nrS6KIjmZMzClNDnKuVsvIKyJpfaOdQkAnfwsF2BBgBCAAqBQJj95ht
CRD+XxIUcoM7vQIbDBYhBDTikqoKdisDZek+Xf5fEhRygzu9AACMpw/+Lmuc
Uf1MIQRXzBOo1I32kds0QVJxTrCwOt34MoOCROjUV7oQp6ORKyDi02fPGnB/
cFsNiTpH/d2az/qbdurBtMFZVwIEGwobGnQLWkvvSBbAVbPL8PpfgI8Pwypa
5jB+weVqXHuGoxT3XjGywDjzrPUeK6OVzb52Ou0Wr2pB5AnFqhukPQ7qrehv
4HHY1UyscEtvRxl2BmqYe5JtB6uE/BHDw7Ky/jpn0PTXi+Q7uYJD5vqXYZ9L
S6b6FPHZx6ha5Jsyg9VHCJ0CH/YcvdRzvPv0SUXWUkweGQIPSz8whw70O8Cs
g+MrM/GsDH+Do8pzEGa93IV4aynrSqkEda4Zn1tA4hZa6TmQQAduKSPFRJMA
rHc6Y/3ULE8Nc6IMe/2kTwB87LmzkdiGIrglBofyw3q2oCgEki9evKR0w8Ob
k/owPW2Y3BVhdIFQX6zgLbxXAc5W7xnZ9avuG+//P8MGBImMyc/mdGcWJZ6/
4WR3Y5XkizJcu0Azev5K0H1+wjH0J33H3YSBL/ijjBZHHe/Zy5qYYjmxlawh
FqoIUaaknG9JQcE9ljIfJRo+Fi5t0jgXjABci93hbh7YBjJjUW5z2Ux2B8s7
2omcmEAK3FG63KS3thZPoG/FYy3D3N8yMeZAt/yob4pBaunTMUdVyy2sIHIE
AfYUJUhqjgSuBctnpj0=
=zI6e
-----END PGP PRIVATE KEY BLOCK-----`;
        const threadId = '18682c3362ac8abc';
        const passphrase = 'some pass for testing';
        await SettingsPageRecipe.addKeyTest(t, browser, acctEmail, rsa4096, passphrase, {}, false);
        const start = new Date();
        const inboxPage = await browser.newPage(t, t.urls?.extensionInbox(acctEmail) + `&threadId=${threadId}`);
        await inboxPage.waitAll('iframe');
        const frameName = 'pgp_block.htm';
        let frames: Frame[] = [];
        while (frames.length !== 50) {
          frames = (inboxPage.target as Page).frames().filter(frame => frame.url().includes(frameName));
        }
        await Promise.all(frames.map(frame => new ControllableFrame(frame).waitForSelTestState('ready', 60)));
        const stop = new Date();
        const diff = stop.getTime() - start.getTime();
        expect(diff).to.be.lessThan(20000);
      })
    );
  }
};
