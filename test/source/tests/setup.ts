/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import test from 'ava';

import { Config, TestVariant, Util } from './../util';
import { SetupPageRecipe } from './page-recipe/setup-page-recipe';
import { TestWithBrowser } from './../test';
import { expect } from 'chai';
import { SettingsPageRecipe } from './page-recipe/settings-page-recipe';
import { ComposePageRecipe } from './page-recipe/compose-page-recipe';
import { Str, emailKeyIndex } from './../core/common';
import { BrowserRecipe } from './tooling/browser-recipe';
import { Key, KeyInfoWithIdentity, KeyUtil } from '../core/crypto/key';
import { testConstants } from './tooling/consts';
import { InboxPageRecipe } from './page-recipe/inbox-page-recipe';
import { PageRecipe } from './page-recipe/abstract-page-recipe';
import { BrowserHandle, ControllablePage } from '../browser';
import { OauthPageRecipe } from './page-recipe/oauth-page-recipe';
import { AvaContext } from './tooling';
import { opgp } from '../core/crypto/pgp/openpgpjs-custom';
import { hasPubKey, protonMailCompatKey, singlePubKeyAttesterConfig, somePubkey } from '../mock/attester/attester-key-constants';
import { ConfigurationProvider, HttpClientErr, Status } from '../mock/lib/api';
import { prvNoSubmit } from '../mock/key-manager/key-manager-constants';
import {
  flowcryptTestClientConfiguration,
  getKeyManagerAutoImportNoPrvCreateRules,
  getKeyManagerAutogenRules,
  getKeyManagerChoosePassphraseForbidStoringRules,
} from '../mock/fes/fes-constants';

const getAuthorizationHeader = async (t: AvaContext, browser: BrowserHandle, acctEmail: string) => {
  const settingsPage = await browser.newExtensionSettingsPage(t, acctEmail);
  const accessToken = await BrowserRecipe.getGoogleAccessToken(settingsPage, acctEmail);
  await settingsPage.close();
  // eslint-disable-next-line @typescript-eslint/naming-convention
  return { Authorization: `Bearer ${accessToken}` };
};

const openMockGmailPage = async (t: AvaContext, browser: BrowserHandle, acctEmail: string, hasPermission = true) => {
  const authorizationHeader = hasPermission
    ? await getAuthorizationHeader(t, browser, acctEmail)
    : { Authorization: 'Bearer emulating-not-properly-set-up-extension' }; // eslint-disable-line @typescript-eslint/naming-convention
  return await browser.newMockGmailPage(t, authorizationHeader);
};

export const defineSetupTests = (testVariant: TestVariant, testWithBrowser: TestWithBrowser) => {
  if (testVariant !== 'CONSUMER-LIVE-GMAIL') {
    // note - `SetupPageRecipe.createKey` tests are in `defineFlakyTests` - running serially
    // because the keygen CPU spike can cause trouble to other concurrent tests

    test.todo('setup - no connection when pulling backup - retry prompt shows and works');

    test.todo('setup - simple - no connection when making a backup - retry prompt shows');

    test.todo('setup - advanced - no connection when making a backup - retry prompt shows');

    test.todo('setup - no connection when submitting public key - retry prompt shows and works');

    test(
      'settings > login > close oauth window > close popup',
      testWithBrowser(async (t, browser) => {
        const settingsPage = await BrowserRecipe.openSettingsLoginButCloseOauthWindowBeforeGrantingPermission(
          t,
          browser,
          'flowcrypt.test.key.imported@gmail.com'
        );
        await settingsPage.notPresent('.settings-banner');
      })
    );

    test(
      'setup - invalid csrf token returns error on gmail login',
      testWithBrowser(async (t, browser) => {
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {},
          },
        });
        const settingsPage = await browser.newExtensionSettingsPage(t);
        const oauthPopup = await browser.newPageTriggeredBy(t, () => settingsPage.waitAndClick('@action-connect-to-gmail'));
        await OauthPageRecipe.mock(t, oauthPopup, 'test.invalid.csrf@gmail.com', 'login');
        await settingsPage.waitAndRespondToModal('error', 'confirm', 'Wrong oauth CSRF token. Please try again.');
      })
    );

    test(
      'setup - optional checkbox for each email aliases',
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
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, 'flowcrypt.compatibility@gmail.com');
        await Util.sleep(5);
        await SetupPageRecipe.createKey(settingsPage, 'unused', 'none', {
          key: { passphrase: 'long enough to suit requirements' },
          usedPgpBefore: false,
          skipForPassphrase: true,
          submitPubkey: true,
          pageEvaluator: async () => {
            expect(await settingsPage.isChecked('@input-email-alias-flowcryptcompatibilitygmailcom')).to.equal(false); // unchecked by default
            await settingsPage.clickIfPresent('@input-email-alias-flowcryptcompatibilitygmailcom'); // include by the user (simulated)
            await settingsPage.waitAndClick('@input-step2bmanualcreate-create-and-save');
          },
        });
        expect(t.mockApi!.configProvider?.config.attester?.pubkeyLookup?.['flowcrypt.compatibility@gmail.com']).not.to.be.an('undefined');
        expect(t.mockApi!.configProvider?.config.attester?.pubkeyLookup?.['flowcryptcompatibility@gmail.com']).not.to.be.an('undefined');
        await settingsPage.close();
      })
    );

    test(
      'setup - import key - do not submit - did not use before',
      testWithBrowser(async (t, browser) => {
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {},
          },
        });
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, 'flowcrypt.test.key.imported@gmail.com');
        await SetupPageRecipe.manualEnter(
          settingsPage,
          'flowcrypt.test.key.used.pgp',
          { submitPubkey: false, usedPgpBefore: false },
          { isSavePassphraseChecked: false, isSavePassphraseHidden: false }
        );
      })
    );

    test(
      'setup - import unarmored key from file',
      testWithBrowser(async (t, browser) => {
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {},
          },
        });
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, 'flowcrypt.test.key.imported@gmail.com');
        const key = {
          title: 'unarmored OpenPGP key',
          filePath: 'test/samples/openpgp/flowcrypttestkeyimportedgmailcom-0x825B8AE8B14CFC0E.key',
          armored: null, // eslint-disable-line no-null/no-null
          passphrase: 'will recognize i used pgp',
          longid: null, // eslint-disable-line no-null/no-null
        };
        await SetupPageRecipe.manualEnter(settingsPage, key.title, { submitPubkey: false, usedPgpBefore: false, key });
      })
    );

    test(
      'setup - import invalid key file',
      testWithBrowser(async (t, browser) => {
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {},
          },
        });
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, 'flowcrypt.test.key.imported@gmail.com');
        const key = {
          title: 'invalid key',
          filePath: 'test/samples/small.txt',
          armored: null, // eslint-disable-line no-null/no-null
          passphrase: '',
          longid: null, // eslint-disable-line no-null/no-null
        };
        await SetupPageRecipe.manualEnter(settingsPage, key.title, { key, isInvalidKey: true });
      })
    );

    test(
      'setup - import key - submit - used before',
      testWithBrowser(async (t, browser) => {
        const acctEmail = 'flowcrypt.test.key.used.pgp@gmail.com';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: singlePubKeyAttesterConfig(acctEmail, somePubkey),
        });
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acctEmail);
        await SetupPageRecipe.manualEnter(
          settingsPage,
          'flowcrypt.test.key.used.pgp',
          { submitPubkey: true, usedPgpBefore: true },
          { isSavePassphraseChecked: false, isSavePassphraseHidden: false }
        );
      })
    );

    test(
      'setup - import key - naked - choose my own pass phrase',
      testWithBrowser(async (t, browser) => {
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {},
          },
        });
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, 'flowcrypt.test.key.import.naked@gmail.com');
        await SetupPageRecipe.manualEnter(
          settingsPage,
          'flowcrypt.test.key.naked',
          { submitPubkey: false, usedPgpBefore: false, naked: true },
          { isSavePassphraseChecked: false, isSavePassphraseHidden: false }
        );
      })
    );

    test(
      'setup - import key - naked - auto-generate a pass phrase',
      testWithBrowser(async (t, browser) => {
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {},
          },
        });
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, 'flowcrypt.test.key.import.naked@gmail.com');
        await SetupPageRecipe.manualEnter(
          settingsPage,
          'flowcrypt.test.key.naked',
          { submitPubkey: false, usedPgpBefore: false, naked: true, genPp: true },
          { isSavePassphraseChecked: false, isSavePassphraseHidden: false }
        );
      })
    );

    test.todo('setup - import key - naked - do not supply pass phrase gets error');

    test(
      'setup - import key - fix key self signatures',
      testWithBrowser(async (t, browser) => {
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {},
          },
        });
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, 'flowcrypt.test.key.imported@gmail.com');
        await SetupPageRecipe.manualEnter(
          settingsPage,
          'missing.self.signatures',
          { submitPubkey: false, fixKey: true },
          { isSavePassphraseChecked: false, isSavePassphraseHidden: false }
        );
      })
    );

    test(
      'setup - import key - fix key self signatures - skip invalid uid',
      testWithBrowser(async (t, browser) => {
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {},
          },
        });
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, 'flowcrypt.test.key.imported@gmail.com');
        await SetupPageRecipe.manualEnter(
          settingsPage,
          'missing.self.signatures.invalid.uid',
          { submitPubkey: false, fixKey: true },
          { isSavePassphraseChecked: false, isSavePassphraseHidden: false }
        );
      })
    );

    // This test will succeed after OpenPGP adds support for parsing keys without
    // User IDs. See: https://github.com/openpgpjs/openpgpjs/issues/1144
    //
    // The test will also succeed if local openpgp.js is patched and
    // `!this.users.length` condition is removed from the Key constructor.
    test.failing(
      'setup - import key - fix uids',
      testWithBrowser(async (t, browser) => {
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {},
          },
        });
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, 'flowcrypt.test.key.imported@gmail.com');
        await SetupPageRecipe.manualEnter(settingsPage, 'uid.less.key', { submitPubkey: false, fixKey: true });
      }, 'FAILING')
    );

    test(
      'setup - import key - warning on primary has no secret',
      testWithBrowser(async (t, browser) => {
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {},
          },
        });
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, 'flowcrypt.test.key.imported@gmail.com');
        await SetupPageRecipe.manualEnter(
          settingsPage,
          'unused',
          {
            submitPubkey: false,
            genPp: false,
            fillOnly: true,
            key: {
              title: 'Primary no secret',
              armored: `-----BEGIN PGP PRIVATE KEY BLOCK-----

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
=OeNi
-----END PGP PRIVATE KEY BLOCK-----`,
              passphrase: '1234',
              longid: '8B3BB9CFC476EE16',
            },
          },
          { isSavePassphraseChecked: false, isSavePassphraseHidden: false }
        );
        await settingsPage.waitAndClick('@input-step2bmanualenter-save', { delay: 1 });
        await Util.sleep(1);
        await settingsPage.waitAndRespondToModal(
          'warning',
          'confirm',
          'Please export the key with --export-secret-key option if you plan to use it for signing.'
        );
      })
    );

    test(
      'setup - import key - two e-mails on the screen',
      testWithBrowser(async (t, browser) => {
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {},
          },
        });
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, 'flowcrypt.test.key.imported@gmail.com');
        await SetupPageRecipe.manualEnter(
          settingsPage,
          'unused',
          {
            submitPubkey: false,
            key: {
              title: '2 UIDs key',
              armored: `-----BEGIN PGP PRIVATE KEY BLOCK-----

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
AN8G3r5Htj8olot+jm9mIa5XLXWzMNUZgg==
=aK4l
-----END PGP PRIVATE KEY BLOCK-----`,
              passphrase: 'correct horse battery staple',
              longid: '123',
              expired: true,
            },
          },
          { isSavePassphraseChecked: false, isSavePassphraseHidden: false }
        );
        await SettingsPageRecipe.toggleScreen(settingsPage, 'additional');
        const myKeyFrame = await SettingsPageRecipe.awaitNewPageFrame(settingsPage, `@action-show-key-0`, ['my_key.htm', 'placement=settings']);
        await Util.sleep(1);
        await myKeyFrame.waitAll('@content-fingerprint');
        expect(await myKeyFrame.read('@content-fingerprint')).to.contain('61E8 C603 67CD B0EB');
        expect(await myKeyFrame.read('@content-emails')).to.contain('test@example.com');
        expect(await myKeyFrame.read('@content-emails')).to.contain('test-alias@example.com');
      })
    );

    test(
      'setup - recover with a pass phrase - skip remaining',
      testWithBrowser(async (t, browser) => {
        const acctEmail = 'flowcrypt.compatibility@gmail.com';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: singlePubKeyAttesterConfig(acctEmail, somePubkey),
        });
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acctEmail);
        await SetupPageRecipe.recover(settingsPage, 'flowcrypt.compatibility.1pp1', {
          hasRecoverMore: true,
          clickRecoverMore: false,
        });
      })
    );

    test(
      'setup - recover with a pass phrase - 1pp1 then 2pp1',
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
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, 'flowcrypt.compatibility@gmail.com');
        await SetupPageRecipe.recover(settingsPage, 'flowcrypt.compatibility.1pp1', {
          hasRecoverMore: true,
          clickRecoverMore: true,
        });
        await SetupPageRecipe.recover(settingsPage, 'flowcrypt.compatibility.2pp1');
      })
    );

    test(
      'setup - recover with a pass phrase - 1pp2 then 2pp1',
      testWithBrowser(async (t, browser) => {
        const acctEmail = 'flowcrypt.compatibility@gmail.com';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: singlePubKeyAttesterConfig(acctEmail, somePubkey),
        });
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acctEmail);
        await SetupPageRecipe.recover(settingsPage, 'flowcrypt.compatibility.1pp2', {
          hasRecoverMore: true,
          clickRecoverMore: true,
        });
        await SetupPageRecipe.recover(settingsPage, 'flowcrypt.compatibility.2pp1');
      })
    );

    test(
      'setup - recover with a pass phrase - 2pp1 then 1pp1',
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
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, 'flowcrypt.compatibility@gmail.com');
        await SetupPageRecipe.recover(settingsPage, 'flowcrypt.compatibility.2pp1', {
          hasRecoverMore: true,
          clickRecoverMore: true,
        });
        await SetupPageRecipe.recover(settingsPage, 'flowcrypt.compatibility.1pp1');
      })
    );

    test(
      'setup - recover with a pass phrase - 2pp1 then 1pp2',
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
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, 'flowcrypt.compatibility@gmail.com');
        await SetupPageRecipe.recover(settingsPage, 'flowcrypt.compatibility.2pp1', {
          hasRecoverMore: true,
          clickRecoverMore: true,
        });
        await SetupPageRecipe.recover(settingsPage, 'flowcrypt.compatibility.1pp2');
      })
    );

    test(
      'setup - recover with a pass phrase - 1pp1 then 1pp2 (shows already recovered), then 2pp1',
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
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, 'flowcrypt.compatibility@gmail.com');
        await SetupPageRecipe.recover(settingsPage, 'flowcrypt.compatibility.1pp1', {
          hasRecoverMore: true,
          clickRecoverMore: true,
        });
        await SetupPageRecipe.recover(settingsPage, 'flowcrypt.compatibility.1pp2', { alreadyRecovered: true });
        await SetupPageRecipe.recover(settingsPage, 'flowcrypt.compatibility.2pp1', {});
      })
    );

    test(
      'test re-auth after updating chrome extension',
      testWithBrowser(async (t, browser) => {
        const acctEmail = 'flowcrypt.compatibility@gmail.com';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: singlePubKeyAttesterConfig(acctEmail, somePubkey),
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'compatibility');
        // Wipe google tokens to test re-auth popup
        await Util.wipeGoogleTokensUsingExperimentalSettingsPage(t, browser, acctEmail);
        const gmailPage = await openMockGmailPage(t, browser, acctEmail);
        await gmailPage.waitAndClick('@action-secure-compose');
        // Check reconnect auth notification
        await gmailPage.waitForContent('@webmail-notification-setup', 'Please reconnect FlowCrypt to your Gmail Account.');
        let oauthPopup = await browser.newPageTriggeredBy(t, () => gmailPage.waitAndClick('@action-reconnect-account'));
        // mock api will return missing scopes
        await OauthPageRecipe.mock(t, oauthPopup, acctEmail, 'missing_permission');
        // Check missing permission notification
        await gmailPage.waitForContent('@webmail-notification-setup', 'Connection successful. Please also add missing permissions');
        oauthPopup = await browser.newPageTriggeredBy(t, () => gmailPage.waitAndClick('@action-add-missing-permission'));
        await OauthPageRecipe.mock(t, oauthPopup, acctEmail, 'approve');
        // after successful reauth, check if connection is successful
        await gmailPage.waitForContent('@webmail-notification-setup', 'Connected successfully. You may need to reload the tab.');
        // reload and test that it has no more notifications
        await gmailPage.page.reload();
        await gmailPage.waitAndClick('@action-secure-compose');
        await Util.sleep(2);
        await gmailPage.notPresent(['@webmail-notification-setup']);
      })
    );

    test(
      'mail.google.com - success notif after setup, click hides it, does not re-appear + offers to reauth',
      testWithBrowser(async (t, browser) => {
        const acct = 'flowcrypt.compatibility@gmail.com';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: singlePubKeyAttesterConfig(acct, somePubkey),
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'compatibility');
        const gmailPage = await openMockGmailPage(t, browser, acct);
        await gmailPage.waitAll(['@webmail-notification-setup', '@notification-successfully-setup-action-close']);
        await gmailPage.waitAndClick('@notification-successfully-setup-action-close', { confirmGone: true });
        await gmailPage.page.reload();
        await gmailPage.notPresent(['@webmail-notification-setup', '@notification-setup-action-close', '@notification-successfully-setup-action-close']);
        // below test that can re-auth after lost access (simulating situation when user changed password on google)
        await Util.wipeGoogleTokensUsingExperimentalSettingsPage(t, browser, acct);
        const settingsPage = await browser.newExtensionSettingsPage(t, acct);
        await settingsPage.waitAndRespondToModal('confirm', 'cancel', 'FlowCrypt must be re-connected to your Google account.');
        // *** these tests below are very flaky in CI environment, Google will want to re-authenticate the user for whatever reason
        // // opening secure compose should trigger an api call which causes a reconnect notification
        await gmailPage.page.reload();
        await gmailPage.waitAndClick('@action-secure-compose');
        await gmailPage.waitAll(['@webmail-notification-setup', '@action-reconnect-account']);
        await Util.sleep(1);
        await gmailPage.waitForContent('@webmail-notification-setup', 'Please reconnect FlowCrypt to your Gmail Account.');
        const oauthPopup = await browser.newPageTriggeredBy(t, () => gmailPage.waitAndClick('@action-reconnect-account'));
        await OauthPageRecipe.google(t, oauthPopup, acct, 'approve');
        await gmailPage.waitAll(['@webmail-notification-setup']);
        await Util.sleep(1);
        await gmailPage.waitForContent('@webmail-notification-setup', 'Connected successfully. You may need to reload the tab.');
        // reload and test that it has no more notifications
        await gmailPage.page.reload();
        await gmailPage.waitAndClick('@action-secure-compose');
        await Util.sleep(1);
        await gmailPage.notPresent(['@webmail-notification-setup']);
      })
    );

    test(
      'mail.google.com - setup prompt notif + hides when close clicked + reappears + setup link opens settings',
      testWithBrowser(async (t, browser) => {
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {},
          },
        });
        const acct = 'flowcrypt.compatibility@gmail.com';
        const gmailPage = await openMockGmailPage(t, browser, acct, false);
        await gmailPage.waitAll([
          '@webmail-notification-setup',
          '@notification-setup-action-open-settings',
          '@notification-setup-action-dismiss',
          '@notification-setup-action-close',
        ]);
        await gmailPage.waitAndClick('@notification-setup-action-close', { confirmGone: true });
        await gmailPage.page.reload();
        await gmailPage.waitAll([
          '@webmail-notification-setup',
          '@notification-setup-action-open-settings',
          '@notification-setup-action-dismiss',
          '@notification-setup-action-close',
        ]);
        const newSettingsPage = await browser.newPageTriggeredBy(t, () => gmailPage.waitAndClick('@notification-setup-action-open-settings'));
        await newSettingsPage.waitAll('@action-connect-to-gmail');
      })
    );

    test(
      'mail.google.com - setup prompt notification shows up + dismiss hides it + does not reappear if dismissed',
      testWithBrowser(async (t, browser) => {
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {},
          },
        });
        const acct = 'flowcrypt.compatibility@gmail.com';
        const gmailPage = await openMockGmailPage(t, browser, acct, false);
        await gmailPage.waitAll([
          '@webmail-notification-setup',
          '@notification-setup-action-open-settings',
          '@notification-setup-action-dismiss',
          '@notification-setup-action-close',
        ]);
        await gmailPage.waitAndClick('@notification-setup-action-dismiss', { confirmGone: true });
        await gmailPage.page.reload();
        await gmailPage.notPresent([
          '@webmail-notification-setup',
          '@notification-setup-action-open-settings',
          '@notification-setup-action-dismiss',
          '@notification-setup-action-close',
        ]);
      })
    );

    test(
      'setup - test adding missing self-signature key issue',
      testWithBrowser(async (t, browser) => {
        const acctEmail = 'flowcrypt.compatibility@gmail.com';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: singlePubKeyAttesterConfig(acctEmail, somePubkey),
        });
        await BrowserRecipe.setUpCommonAcct(t, browser, 'compatibility');
        const settingsPage = await browser.newExtensionSettingsPage(t, acctEmail);
        await SettingsPageRecipe.toggleScreen(settingsPage, 'additional');
        const addKeyPopup = await SettingsPageRecipe.awaitNewPageFrame(settingsPage, '@action-open-add-key-page', ['add_key.htm']);
        await addKeyPopup.waitAndClick('@source-paste');
        const key = Config.key('missing.self.signatures');
        await addKeyPopup.waitAndType('@input-armored-key', key?.armored ?? '');
        await addKeyPopup.waitAndType('#input_passphrase', key?.passphrase ?? '', { delay: 1 });
        await addKeyPopup.waitAndClick('.action_add_private_key', { delay: 1 });
        await addKeyPopup.waitAll('@input-compatibility-fix-expire-years', { timeout: 30 });
        await addKeyPopup.selectOption('@input-compatibility-fix-expire-years', '1');
        await addKeyPopup.waitAndClick('@action-fix-and-import-key');
        await Util.sleep(1);
        const myKeyFrame = await SettingsPageRecipe.awaitNewPageFrame(settingsPage, `@action-show-key-2`, ['my_key.htm', 'placement=settings']);
        await Util.sleep(1);
        const curDate = new Date(),
          year = curDate.getFullYear(),
          month = curDate.getMonth(),
          date = curDate.getDate();
        const expirationDate = new Date(year + 1, month, date);
        // Had to add this because if test runs at 23:59:59 it might cause assertion error
        // https://github.com/FlowCrypt/flowcrypt-browser/pull/4796#discussion_r1025150001
        const oneDayBeforeExpirationDate = new Date(year + 1, month, date - 1);
        const expiration = Str.datetimeToDate(Str.fromDate(expirationDate));
        const oneDayBeforeExpiration = Str.datetimeToDate(Str.fromDate(oneDayBeforeExpirationDate));
        expect(await myKeyFrame.read('@content-key-expiration')).to.be.oneOf([expiration, oneDayBeforeExpiration]);
      })
    );

    test(
      'setup [not using key manager] - notify users when their keys expire soon',
      testWithBrowser(async (t, browser) => {
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {},
          },
        });
        const acctEmail = 'flowcrypt.notify.expiring.keys@gmail.com';
        const passphrase = '1234';
        const warningMsg = 'Your keys are expiring in 18 days. Please import a newer set of keys to use.';
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acctEmail);
        // Generate key that expires in 20 days
        const key = await opgp.generateKey({
          type: 'ecc',
          curve: 'curve25519',
          userIDs: [{ email: acctEmail }],
          keyExpirationTime: 20 * 24 * 60 * 60,
          passphrase,
          format: 'armored',
          date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        });
        // Setup with above key
        await SetupPageRecipe.manualEnter(
          settingsPage,
          'unused',
          {
            submitPubkey: false,
            usedPgpBefore: false,
            key: {
              title: '?',
              armored: key.privateKey,
              passphrase,
              longid: '0000000000000000', // dummy -- not needed
            },
          },
          { isSavePassphraseChecked: false, isSavePassphraseHidden: false }
        );
        const gmailPage = await openMockGmailPage(t, browser, acctEmail);
        // Check if notification presents
        await gmailPage.waitForContent('@webmail-notification-notify_expiring_keys', warningMsg);
        // Add updated key that expires in 100 days
        await SettingsPageRecipe.toggleScreen(settingsPage, 'additional');
        const addKeyPopup = await SettingsPageRecipe.awaitNewPageFrame(settingsPage, '@action-open-add-key-page', ['add_key.htm']);
        await addKeyPopup.waitAndClick('@source-paste');
        const updatedKey = await opgp.generateKey({
          type: 'ecc',
          curve: 'curve25519',
          userIDs: [{ email: acctEmail }, { email: 'demo@gmail.com', name: 'Demo user' }],
          passphrase,
          format: 'armored',
          keyExpirationTime: 100 * 24 * 60 * 60,
        });
        await addKeyPopup.waitAndType('@input-armored-key', updatedKey.privateKey);
        await addKeyPopup.waitAndType('#input_passphrase', passphrase);
        await addKeyPopup.waitAndClick('.action_add_private_key', { delay: 1 });
        await Util.sleep(1);
        await gmailPage.page.reload();
        await gmailPage.notPresent('@webmail-notification-notify_expiring_keys');
        // remove added key and observe warning appears again
        await settingsPage.waitAndClick('@action-remove-key-1');
        await gmailPage.page.reload();
        await Util.sleep(1);
        await gmailPage.waitForContent('@webmail-notification-notify_expiring_keys', warningMsg);
      })
    );

    test(
      'setup [using key manager] - notify users when their keys expire soon',
      testWithBrowser(async (t, browser) => {
        const acctEmail = 'flowcrypt.notify.expiring.keys.updating.key@key-manager-autogen.flowcrypt.test';
        // Generate negative expiration key and check if it shows correct expiration note
        const negativeExpirationKey = await opgp.generateKey({
          format: 'armored',
          curve: 'curve25519',
          userIDs: [{ email: acctEmail }],
          keyExpirationTime: 1,
          date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        });
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {},
          },
          ekm: {
            keys: [negativeExpirationKey.privateKey],
          },
          fes: {
            clientConfiguration: getKeyManagerAutogenRules(t.urls!.port!),
          },
        });
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acctEmail);
        await SetupPageRecipe.autoSetupWithEKM(settingsPage, { expectWarnModal: 'Public key not usable - not sumbitting to Attester' });
        const gmailPage = await openMockGmailPage(t, browser, acctEmail);
        // Check if notification presents
        let warningMsg =
          'Your local keys are expired.\nTo receive the latest keys, please ensure that you can connect to your corporate network either through VPN or in person and reload Gmail.\nIf this notification still shows after that, please contact your Help Desk.';
        await gmailPage.waitForContent('@webmail-notification-notify_expiring_keys', warningMsg);
        // Generate expired key(positive expiration) and check if it shows correct note
        const key = await opgp.generateKey({
          type: 'ecc',
          curve: 'curve25519',
          userIDs: [{ email: acctEmail }],
          keyExpirationTime: 20 * 24 * 60 * 60,
          format: 'armored',
          date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        });
        t.mockApi!.configProvider.config.ekm!.keys = [key.privateKey];
        await gmailPage.page.reload();
        await Util.sleep(1);
        // Check if notification presents
        warningMsg =
          'Your local keys expire in 18 days.\nTo receive the latest keys, please ensure that you can connect to your corporate network either through VPN or in person and reload Gmail.\nIf this notification still shows after that, please contact your Help Desk.';
        await gmailPage.waitForContent('@webmail-notification-notify_expiring_keys', warningMsg);
        // Check if warning message still presents when EKM returns error
        t.mockApi!.configProvider.config.ekm!.returnError = new HttpClientErr('RequestTimeout', Status.BAD_REQUEST);
        await gmailPage.page.reload();
        await Util.sleep(1);
        await gmailPage.waitForContent('@webmail-notification-notify_expiring_keys', warningMsg);
        // Return correct key and check if expiration note doesn't appear
        t.mockApi!.configProvider.config.ekm = { keys: [key.privateKey, testConstants.notifyExpiringKeys] };
        await gmailPage.page.reload();
        await PageRecipe.waitForToastToAppearAndDisappear(gmailPage, 'Account keys updated');
        await gmailPage.page.reload();
        await gmailPage.notPresent('@webmail-notification-setup');
      })
    );

    test.todo('setup - recover with a pass phrase - 1pp1 then wrong, then skip');
    // test('setup - recover with a pass phrase - 1pp1 then wrong, then skip', test_with_browser(async (t, browser) => {
    //   const settingsPage = await BrowserRecipe.open_settings_login_approve(t, browser,'flowcrypt.compatibility@gmail.com');
    //   await SetupPageRecipe.setup_recover(settingsPage, 'flowcrypt.compatibility.1pp1', {has_recover_more: true, click_recover_more: true});
    //   await SetupPageRecipe.setup_recover(settingsPage, 'flowcrypt.wrong.passphrase', {wrong_passphrase: true});
    //   await Util.sleep(200);
    // }));

    test(
      'setup - recover with a pass phrase - no remaining',
      testWithBrowser(async (t, browser) => {
        const acctEmail = 'flowcrypt.test.key.recovered@gmail.com';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: singlePubKeyAttesterConfig(acctEmail, somePubkey),
        });
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acctEmail);
        await SetupPageRecipe.recover(settingsPage, 'flowcrypt.test.key.recovered', { hasRecoverMore: false });
      })
    );

    test(
      'setup - fail to recover with a wrong pass phrase',
      testWithBrowser(async (t, browser) => {
        const acctEmail = 'flowcrypt.test.key.recovered@gmail.com';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: singlePubKeyAttesterConfig(acctEmail, somePubkey),
        });
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acctEmail);
        await SetupPageRecipe.recover(settingsPage, 'flowcrypt.wrong.passphrase', {
          hasRecoverMore: false,
          wrongPp: true,
        });
      })
    );

    test(
      'setup - fail to recover with a wrong pass phrase at first, then recover with good pass phrase',
      testWithBrowser(async (t, browser) => {
        const acctEmail = 'flowcrypt.test.key.recovered@gmail.com';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: singlePubKeyAttesterConfig(acctEmail, somePubkey),
        });
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acctEmail);
        await SetupPageRecipe.recover(settingsPage, 'flowcrypt.wrong.passphrase', { wrongPp: true });
        await SetupPageRecipe.recover(settingsPage, 'flowcrypt.test.key.recovered');
      })
    );

    test(
      'setup - import key - submit - offline - retry',
      testWithBrowser(async (t, browser) => {
        const acctEmail = 'flowcrypt.test.key.used.pgp@gmail.com';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: singlePubKeyAttesterConfig(acctEmail, somePubkey),
        });
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acctEmail);
        await SetupPageRecipe.manualEnter(
          settingsPage,
          'flowcrypt.test.key.used.pgp',
          { submitPubkey: true, usedPgpBefore: true, simulateRetryOffline: true },
          { isSavePassphraseChecked: false, isSavePassphraseHidden: false }
        );
      })
    );

    test(
      'setup - enterprise users should be redirected to their help desk when an error occured',
      testWithBrowser(async (t, browser) => {
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {},
          },
        });
        const acctEmail = 'flowcrypt.compatibility@gmail.com';
        if (testVariant === 'ENTERPRISE-MOCK') {
          const settingsPage = await browser.newExtensionSettingsPage(t);
          const oauthPopup = await browser.newPageTriggeredBy(t, () => settingsPage.waitAndClick('@action-connect-to-gmail'));
          await OauthPageRecipe.mock(t, oauthPopup, acctEmail, 'login_with_invalid_state');
          await settingsPage.waitForContent('@container-error-modal-text', 'please contact your Help Desk');
        } else if (testVariant === 'CONSUMER-MOCK') {
          const settingsPage = await browser.newExtensionSettingsPage(t);
          const oauthPopup = await browser.newPageTriggeredBy(t, () => settingsPage.waitAndClick('@action-connect-to-gmail'));
          await OauthPageRecipe.mock(t, oauthPopup, acctEmail, 'login_with_invalid_state');
          await settingsPage.waitForContent('@container-error-modal-text', 'write us at human@flowcrypt.com');
        }
      })
    );

    test(
      'has.pub@client-configuration-test.flowcrypt.test - no backup, no keygen',
      testWithBrowser(async (t, browser) => {
        const acct = 'has.pub@client-configuration-test.flowcrypt.test';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            ldapRelay: {
              [acct]: {
                pubkey: hasPubKey,
              },
            },
          },
          fes: flowcryptTestClientConfiguration,
        });
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acct);
        await SetupPageRecipe.manualEnter(
          settingsPage,
          'has.pub.client.configuration.test',
          { noPrvCreateClientConfiguration: true, enforceAttesterSubmitClientConfiguration: true },
          { isSavePassphraseChecked: false, isSavePassphraseHidden: false }
        );
        await settingsPage.waitAll(['@action-show-encrypted-inbox', '@action-open-security-page']);
        await Util.sleep(1);
        await settingsPage.notPresent(['@action-open-backup-page']);
        const { cryptup_haspubclientconfigurationtestflowcrypttest_keys: keys } = await settingsPage.getFromLocalStorage([
          'cryptup_haspubclientconfigurationtestflowcrypttest_keys',
        ]);
        const ki = keys as KeyInfoWithIdentity[];
        expect(ki.length).to.equal(1);
        expect(ki[0].private).to.include('PGP PRIVATE KEY');
        expect(ki[0].private).to.not.include('Version');
        expect(ki[0].private).to.not.include('Comment');
        expect(ki[0].public).to.include('PGP PUBLIC KEY');
        expect(ki[0].public).to.not.include('Version');
        expect(ki[0].public).to.not.include('Comment');
      })
    );

    test(
      'invalid.pub@client-configuration-test.flowcrypt.test - no backup, no keygen',
      testWithBrowser(async (t, browser) => {
        const acct = 'invalid.pub@client-configuration-test.flowcrypt.test';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            ldapRelay: {
              [acct]: {
                pubkey: protonMailCompatKey,
              },
            },
          },
          fes: flowcryptTestClientConfiguration,
        });
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acct);
        await SetupPageRecipe.manualEnter(
          settingsPage,
          'has.pub.client.configuration.test',
          { noPrvCreateClientConfiguration: true, enforceAttesterSubmitClientConfiguration: true, fillOnly: true },
          { isSavePassphraseChecked: false, isSavePassphraseHidden: false }
        );
        await settingsPage.waitAndClick('@input-step2bmanualenter-save');
        await settingsPage.waitAll(['@container-overlay-prompt-text', '@action-overlay-retry']);
        const renderedErr = await settingsPage.read('@container-overlay-prompt-text');
        expect(renderedErr).to.contain('Attempting to import unknown key');
        expect(renderedErr).to.contain(
          'Imported private key with ids 576C48E8E9E33B772FF07B11BC614F7068DB6E23 does not match public keys on company LDAP server with ids AB8CF86E37157C3F290D72007ED43D79E9617655 for invalid.pub@client-configuration-test.flowcrypt.test. Please ask your help desk.'
        );
      })
    );

    test(
      'no.pub@client-configurations-test - no backup, no keygen, enforce attester submit with submit err',
      testWithBrowser(async (t, browser) => {
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {},
            ldapRelay: {},
          },
          fes: flowcryptTestClientConfiguration,
        });
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, 'no.pub@client-configuration-test.flowcrypt.test');
        await SetupPageRecipe.manualEnter(
          settingsPage,
          'no.pub.client.configuration',
          { noPrvCreateClientConfiguration: true, enforceAttesterSubmitClientConfiguration: true, fillOnly: true },
          { isSavePassphraseChecked: false, isSavePassphraseHidden: false }
        );
        await settingsPage.waitAndClick('@input-step2bmanualenter-save');
        await settingsPage.waitAll(['@container-overlay-prompt-text', '@action-overlay-retry']);
        const renderedErr = await settingsPage.read('@container-overlay-prompt-text');
        expect(renderedErr).to.contain(`Attempting to import unknown key`);
        expect(renderedErr).to.contain(
          `Your organization requires public keys to be present on company LDAP server, but no public key was found for no.pub@client-configuration-test.flowcrypt.test. Please ask your internal help desk.`
        );
      })
    );

    test(
      'user@no-submit-client-configuration.flowcrypt.test - do not submit to attester',
      testWithBrowser(async (t, browser) => {
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {},
          },
          fes: {
            clientConfiguration: {
              flags: ['NO_ATTESTER_SUBMIT'],
            },
          },
        });
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, 'user@no-submit-client-configuration.flowcrypt.test');
        await SetupPageRecipe.manualEnter(
          settingsPage,
          'flowcrypt.test.key.used.pgp',
          { noPubSubmitRule: true },
          { isSavePassphraseChecked: false, isSavePassphraseHidden: false }
        );
        await SettingsPageRecipe.toggleScreen(settingsPage, 'additional');
        const attesterFrame = await SettingsPageRecipe.awaitNewPageFrame(settingsPage, '@action-open-attester-page', ['keyserver.htm']);
        await attesterFrame.waitAndClick('@action-submit-pub');
        await attesterFrame.waitAndRespondToModal('error', 'confirm', 'Disallowed by your organisation rules');
      })
    );

    test(
      'setup - manualEnter honors DEFAULT_REMEMBER_PASS_PHRASE ClientConfiguration',
      testWithBrowser(async (t, browser) => {
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {},
          },
          fes: {
            clientConfiguration: {
              flags: ['DEFAULT_REMEMBER_PASS_PHRASE'],
            },
          },
        });
        const acctEmail = 'user@default-remember-passphrase-client-configuration.flowcrypt.test';
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acctEmail);
        await SetupPageRecipe.manualEnter(
          settingsPage,
          'unused',
          {
            submitPubkey: false,
            usedPgpBefore: false,
            key: {
              title: '?',
              armored: testConstants.testkey715EDCDC7939A8F7,
              passphrase: '1234',
              longid: '715EDCDC7939A8F7',
            },
          },
          { isSavePassphraseChecked: true, isSavePassphraseHidden: false }
        );
        const { cryptup_userdefaultrememberpassphraseclientconfigurationflowcrypttest_passphrase_715EDCDC7939A8F7: savedPassphrase } =
          await settingsPage.getFromLocalStorage(['cryptup_userdefaultrememberpassphraseclientconfigurationflowcrypttest_passphrase_715EDCDC7939A8F7']);
        expect(savedPassphrase).to.equal('1234');
        await settingsPage.close();
      })
    );

    test(
      'user@no-search-domains-client-configuration.flowcrypt.test - do not search attester for recipients on particular domains',
      testWithBrowser(async (t, browser) => {
        // disallowed searching attester for pubkeys on "flowcrypt.com" domain
        // below we search for human@flowcrypt.com which normally has pubkey on attester, but none should be found due to the rule
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              'mock.only.pubkey@flowcrypt.com': {
                pubkey: somePubkey,
              },
              'mock.only.pubkey@other.com': {
                pubkey: somePubkey,
              },
            },
          },
          fes: {
            clientConfiguration: {
              flags: [],
              // eslint-disable-next-line @typescript-eslint/naming-convention
              disallow_attester_search_for_domains: ['flowcrypt.com'],
            },
          },
        });
        const acct = 'user@no-search-domains-client-configuration.flowcrypt.test';
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acct);
        await SetupPageRecipe.manualEnter(settingsPage, 'flowcrypt.test.key.used.pgp');
        const composePage = await ComposePageRecipe.openStandalone(t, browser, acct);
        await ComposePageRecipe.fillMsg(
          composePage,
          { to: 'mock.only.pubkey@flowcrypt.com,mock.only.pubkey@other.com' },
          'flowcrypt domain should not be found'
        );
        await composePage.waitForContent('.email_address.no_pgp', 'mock.only.pubkey@flowcrypt.com');
        await composePage.waitForContent('.email_address.has_pgp', 'mock.only.pubkey@other.com');
        await composePage.waitAll('@input-password');
      })
    );

    test(
      'user@only-allow-some-domains-client-configuration.flowcrypt.test - search attester for recipients only on particular domains',
      testWithBrowser(async (t, browser) => {
        // disallow_attester_search_for_domains is not respected if allow_attester_search_only_for_domains is set
        // searching attester for pubkeys only on "flowcrypt.com" domain
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              'mock.only.pubkey@flowcrypt.com': {
                pubkey: somePubkey,
              },
              'mock.only.pubkey@other.com': {
                pubkey: somePubkey,
              },
            },
          },
          fes: {
            clientConfiguration: {
              flags: [],
              // eslint-disable-next-line @typescript-eslint/naming-convention
              allow_attester_search_only_for_domains: ['flowcrypt.com'],
              // eslint-disable-next-line @typescript-eslint/naming-convention
              disallow_attester_search_for_domains: ['*'],
            },
          },
        });
        const acct = 'user@only-allow-some-domains-client-configuration.flowcrypt.test';
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acct);
        await SetupPageRecipe.manualEnter(settingsPage, 'flowcrypt.test.key.used.pgp');
        const composePage = await ComposePageRecipe.openStandalone(t, browser, acct);
        await ComposePageRecipe.fillMsg(
          composePage,
          { to: 'mock.only.pubkey@flowcrypt.com,mock.only.pubkey@other.com' },
          'flowcrypt domain should be found. other domains should not be found'
        );
        await composePage.waitForContent('.email_address.has_pgp', 'mock.only.pubkey@flowcrypt.com');
        await composePage.waitForContent('.email_address.no_pgp', 'mock.only.pubkey@other.com');
        await composePage.waitAll('@input-password');
      })
    );

    test(
      "user@no-allow-domains-client-configuration.flowcrypt.test - search attester for recipients doesn't work on any domains",
      testWithBrowser(async (t, browser) => {
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {},
          },
          fes: {
            clientConfiguration: {
              flags: [],
              // eslint-disable-next-line @typescript-eslint/naming-convention
              allow_attester_search_only_for_domains: [],
            },
          },
        });
        // as `allow_attester_search_only_for_domains: []` is set, attester search shouldn't work for any domains
        const acct = 'user@no-allow-domains-client-configuration.flowcrypt.test';
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acct);
        await SetupPageRecipe.manualEnter(settingsPage, 'flowcrypt.test.key.used.pgp');
        const composePage = await ComposePageRecipe.openStandalone(t, browser, acct);
        await ComposePageRecipe.fillMsg(composePage, { to: 'mock.only.pubkey@flowcrypt.com' }, 'all domains should not be found');
        await composePage.waitForContent('.email_address.no_pgp', 'mock.only.pubkey@flowcrypt.com');
        await composePage.waitAll('@input-password');
      })
    );

    test(
      'user@only-allow-some-domains-for-keys-openpgp-org-client-configuration.flowcrypt.test - search pubkey for recipients only on particular domains for keys.openpgp.org',
      testWithBrowser(async (t, browser) => {
        // disallow_keys_openpgp_org_search_for_domains is not respected if allow_keys_openpgp_org_search_only_for_domains is set
        // searching for pubkeys only on "allowed-domain.test" domain
        const recipient1 = 'test.only.pubkey.keys.openpgp.org@allowed-domain.test';
        const recipient2 = 'test.only.pubkey.keys.openpgp.org@other.com';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {},
          },
          keysOpenPgp: {
            [recipient1]: somePubkey,
            [recipient2]: somePubkey,
          },
          fes: {
            clientConfiguration: {
              flags: [],
              // eslint-disable-next-line @typescript-eslint/naming-convention
              allow_keys_openpgp_org_search_only_for_domains: ['allowed-domain.test'],
              // eslint-disable-next-line @typescript-eslint/naming-convention
              disallow_keys_openpgp_org_search_for_domains: ['*'],
            },
          },
        });
        const acct = 'user@only-allow-some-domains-for-keys-openpgp-org-client-configuration.flowcrypt.test';
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acct);
        await SetupPageRecipe.manualEnter(settingsPage, 'flowcrypt.test.key.used.pgp');
        const composePage = await ComposePageRecipe.openStandalone(t, browser, acct);
        await ComposePageRecipe.fillMsg(
          composePage,
          { to: `${recipient1},${recipient2}` },
          'flowcrypt domain should be found. other domains should not be found'
        );
        await composePage.waitForContent('.email_address.has_pgp', recipient1);
        await composePage.waitForContent('.email_address.no_pgp', recipient2);
        await composePage.waitAll('@input-password');
      })
    );

    test(
      "user@no-allow-domains-for-keys-openpgp-org-client-configuration.flowcrypt.test - search pubkey on keys.openpgp.org for recipients doesn't work on any domains",
      testWithBrowser(async (t, browser) => {
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {},
          },
          fes: {
            clientConfiguration: {
              flags: [],
              // eslint-disable-next-line @typescript-eslint/naming-convention
              allow_keys_openpgp_org_search_only_for_domains: [],
            },
          },
        });
        // as `allow_keys_openpgp_org_search_only_for_domains: []` is set, pubkey search shouldn't work for any domains
        const acct = 'user@no-allow-domains-for-keys-openpgp-org-client-configuration.flowcrypt.test';
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acct);
        await SetupPageRecipe.manualEnter(settingsPage, 'flowcrypt.test.key.used.pgp');
        const composePage = await ComposePageRecipe.openStandalone(t, browser, acct);
        await ComposePageRecipe.fillMsg(composePage, { to: 'test.only.pubkey.keys.openpgp.org@flowcrypt.com' }, 'all domains should not be found');
        await composePage.waitForContent('.email_address.no_pgp', 'test.only.pubkey.keys.openpgp.org@flowcrypt.com');
        await composePage.waitAll('@input-password');
      })
    );

    test(
      'user@no-search-wildcard-domains-client-configuration.flowcrypt.test - do not search attester for recipients on any domain',
      testWithBrowser(async (t, browser) => {
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {},
          },
          fes: {
            clientConfiguration: {
              flags: [],
              // eslint-disable-next-line @typescript-eslint/naming-convention
              disallow_attester_search_for_domains: ['*'],
            },
          },
        });
        // disallowed searching attester for pubkeys on * domain
        // below we search for mock.only.pubkey@other.com which normally has pubkey on attester, but none should be found due to the rule
        const acct = 'user@no-search-wildcard-domains-client-configuration.flowcrypt.test';
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acct);
        await SetupPageRecipe.manualEnter(settingsPage, 'flowcrypt.test.key.used.pgp');
        const composePage = await ComposePageRecipe.openStandalone(t, browser, acct);
        await ComposePageRecipe.fillMsg(composePage, { to: 'mock.only.pubkey@other.com' }, 'other.com domain should not be found');
        await composePage.waitForContent('.email_address.no_pgp', 'mock.only.pubkey@other.com');
        await composePage.waitAll('@input-password');
      })
    );

    test(
      'get.key@key-manager-autogen.flowcrypt.test - automatic setup with key found on key manager',
      testWithBrowser(async (t, browser) => {
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {},
          },
          ekm: {
            keys: [testConstants.existingPrv],
          },
          fes: {
            clientConfiguration: getKeyManagerAutogenRules(t.urls!.port!),
          },
        });
        const acct = 'get.key@key-manager-autogen.flowcrypt.test';
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acct);
        await SetupPageRecipe.autoSetupWithEKM(settingsPage);
        await SettingsPageRecipe.toggleScreen(settingsPage, 'additional');
        // check no "add key"
        await settingsPage.notPresent('@action-open-add-key-page');
        // check imported key
        const myKeyFrame = await SettingsPageRecipe.awaitNewPageFrame(settingsPage, `@action-show-key-0`, ['my_key.htm', 'placement=settings']);
        await Util.sleep(1);
        await myKeyFrame.waitAll('@content-fingerprint');
        expect(await myKeyFrame.read('@content-fingerprint')).to.contain('00B0 1158 0796 9D75');
        await SettingsPageRecipe.closeDialog(settingsPage);
        await Util.sleep(2);
        // check that it does not offer any pass phrase options
        await SettingsPageRecipe.toggleScreen(settingsPage, 'basic');
        const securityFrame = await SettingsPageRecipe.awaitNewPageFrame(settingsPage, '@action-open-security-page', ['security.htm', 'placement=settings']);
        await Util.sleep(1);
        await securityFrame.notPresent(['@action-change-passphrase-begin', '@action-test-passphrase-begin', '@action-forget-pp']);
      })
    );

    const getPassphrase = async (page: ControllablePage, acctEmail: string, longid: string) => {
      const key = `cryptup_${emailKeyIndex(acctEmail, 'passphrase')}_${longid}`;
      const passphrase = (await page.getFromLocalStorage([key]))[key] || (await BrowserRecipe.getPassphraseFromInMemoryStore(page, acctEmail, longid));
      expect(passphrase).to.be.a.string; // eslint-disable-line @typescript-eslint/unbound-method
      return passphrase as string;
    };

    const retrieveAndCheckKeys = async (page: ControllablePage, acctEmail: string, expectedKeyCount: number, passphrase?: string) => {
      const key = `cryptup_${emailKeyIndex(acctEmail, 'keys')}`;
      const keyset = (await page.getFromLocalStorage([key]))[key];
      const kis = keyset as KeyInfoWithIdentity[];
      expect(kis.length).to.equal(expectedKeyCount);
      return await Promise.all(
        kis.map(async ki => {
          const prv = await KeyUtil.parse(ki.private);
          expect(prv.fullyEncrypted).to.be.true;
          const passphraseToDecrypt = passphrase || (await getPassphrase(page, acctEmail, KeyUtil.getPrimaryLongid(prv)));
          expect(passphraseToDecrypt).to.be.not.empty;
          expect(await KeyUtil.decrypt(prv, passphraseToDecrypt, undefined, undefined)).to.be.true;
          expect(prv.lastModified).to.not.be.an.undefined;
          return prv;
        })
      );
    };

    test(
      'get.updating.key@key-manager-choose-passphrase-forbid-storing.flowcrypt.test - automatic update of key found on key manager',
      testWithBrowser(async (t, browser) => {
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {},
          },
          ekm: {
            keys: [testConstants.updatingPrv],
          },
          fes: {
            clientConfiguration: getKeyManagerChoosePassphraseForbidStoringRules(t.urls!.port!),
          },
        });
        const acct = 'get.updating.key@key-manager-choose-passphrase-forbid-storing.flowcrypt.test';
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acct);
        const passphrase = 'long enough to suit requirements';
        await SetupPageRecipe.autoSetupWithEKM(settingsPage, {
          enterPp: { passphrase, checks: { isSavePassphraseChecked: false, isSavePassphraseHidden: true } },
        });
        const accessToken = await BrowserRecipe.getGoogleAccessToken(settingsPage, acct);
        // eslint-disable-next-line @typescript-eslint/naming-convention
        const extraAuthHeaders = { Authorization: `Bearer ${accessToken}` };
        const updateAndArmorKey = async (prv: Key) => {
          return KeyUtil.armor(await KeyUtil.reformatKey(prv, undefined, [{ name: 'Full Name', email: acct }], 6000));
        };
        const set1 = await retrieveAndCheckKeys(settingsPage, acct, 1);
        // 1. EKM returns the same key, no update, no toast
        let gmailPage = await browser.newMockGmailPage(t, extraAuthHeaders);
        await PageRecipe.noToastAppears(gmailPage);
        await gmailPage.notPresent('@dialog-passphrase');
        const set2 = await retrieveAndCheckKeys(settingsPage, acct, 1);
        expect(set2[0].lastModified).to.equal(set1[0].lastModified); // no update
        await gmailPage.close();
        // 2. EKM returns a newer version of the existing key
        const someOlderVersion = await updateAndArmorKey(set2[0]);
        t.mockApi!.configProvider.config.ekm!.keys = [someOlderVersion];
        gmailPage = await browser.newMockGmailPage(t, extraAuthHeaders);
        await PageRecipe.waitForToastToAppearAndDisappear(gmailPage, 'Account keys updated');
        const set3 = await retrieveAndCheckKeys(settingsPage, acct, 1);
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        expect(set3[0].lastModified).to.be.greaterThan(set2[0].lastModified!); // an update happened
        await gmailPage.close();
        // 3. EKM returns the same version of the existing key, no toast, no update
        gmailPage = await browser.newMockGmailPage(t, extraAuthHeaders);
        await PageRecipe.noToastAppears(gmailPage);
        await gmailPage.notPresent('@dialog-passphrase');
        const set4 = await retrieveAndCheckKeys(settingsPage, acct, 1);
        expect(set4[0].lastModified).to.equal(set3[0].lastModified); // no update
        // 4. Forget the passphrase, EKM the same version of the existing key, no prompt
        await InboxPageRecipe.finishSessionOnInboxPage(gmailPage);
        await gmailPage.close();
        gmailPage = await browser.newMockGmailPage(t, extraAuthHeaders);
        await PageRecipe.noToastAppears(gmailPage);
        await gmailPage.notPresent('@dialog-passphrase');
        const set5 = await retrieveAndCheckKeys(settingsPage, acct, 1, passphrase);
        expect(set5[0].lastModified).to.equal(set4[0].lastModified); // no update
        await gmailPage.close();
        // 5. EKM returns a newer version of the existing key, canceling passphrase prompt, no update
        t.mockApi!.configProvider.config.ekm!.keys = [await updateAndArmorKey(set5[0])];
        gmailPage = await browser.newMockGmailPage(t, extraAuthHeaders);
        await gmailPage.waitAll('@dialog-passphrase');
        await ComposePageRecipe.cancelPassphraseDialog(gmailPage, 'keyboard');
        await PageRecipe.noToastAppears(gmailPage);
        const set6 = await retrieveAndCheckKeys(settingsPage, acct, 1, passphrase);
        expect(set6[0].lastModified).to.equal(set5[0].lastModified); // no update
        await gmailPage.close();
        // 6. EKM returns a newer version of the existing key, entering the passphrase, update toast
        gmailPage = await browser.newMockGmailPage(t, extraAuthHeaders);
        await gmailPage.waitAll('@dialog-passphrase');
        {
          const passphraseDialog = await gmailPage.getFrame(['passphrase.htm']);
          await passphraseDialog.waitForContent('@passphrase-text', 'Enter FlowCrypt pass phrase to keep your account keys up to date');
          await passphraseDialog.waitAndType('@input-pass-phrase', passphrase);
          await passphraseDialog.waitAndClick('@action-confirm-pass-phrase-entry');
        }
        await gmailPage.waitTillGone('@dialog-passphrase');
        await PageRecipe.waitForToastToAppearAndDisappear(gmailPage, 'Account keys updated');
        const set7 = await retrieveAndCheckKeys(settingsPage, acct, 1);
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        expect(set7[0].lastModified!).to.be.greaterThan(set6[0].lastModified!); // an update happened
        await gmailPage.close();
        // 7. EKM returns an older version of the existing key, no toast, no update
        t.mockApi!.configProvider.config.ekm!.keys = [someOlderVersion];
        gmailPage = await browser.newMockGmailPage(t, extraAuthHeaders);
        await PageRecipe.noToastAppears(gmailPage);
        await gmailPage.notPresent('@dialog-passphrase');
        const set8 = await retrieveAndCheckKeys(settingsPage, acct, 1);
        expect(set8[0].lastModified).to.equal(set7[0].lastModified); // no update
        await gmailPage.close();
        // 8. EKM returns an older version of the existing key, and a new key, toast, new key gets added encrypted with the same passphrase
        t.mockApi!.configProvider.config.ekm!.keys = [someOlderVersion, testConstants.existingPrv];
        gmailPage = await browser.newMockGmailPage(t, extraAuthHeaders);
        await PageRecipe.waitForToastToAppearAndDisappear(gmailPage, 'Account keys updated');
        await gmailPage.notPresent('@dialog-passphrase');
        const set9 = await retrieveAndCheckKeys(settingsPage, acct, 2);
        const mainKey9 = KeyUtil.filterKeysByIdentity(set9, [{ family: 'openpgp', id: '392FB1E9FF4184659AB6A246835C0141B9ECF536' }]);
        expect(mainKey9.length).to.equal(1);
        const secondaryKey9 = KeyUtil.filterKeysByIdentity(set9, [{ family: 'openpgp', id: 'FAFB7D675AC74E87F84D169F00B0115807969D75' }]);
        expect(secondaryKey9.length).to.equal(1);
        expect(mainKey9[0].lastModified).to.equal(set8[0].lastModified); // no update
        await gmailPage.close();
        // 9. EKM returns a newer version of one key, fully omitting the other one, a toast, an update and removal
        t.mockApi!.configProvider.config.ekm!.keys = [await updateAndArmorKey(mainKey9[0])];
        gmailPage = await browser.newMockGmailPage(t, extraAuthHeaders);
        await PageRecipe.waitForToastToAppearAndDisappear(gmailPage, 'Account keys updated');
        await gmailPage.notPresent('@dialog-passphrase');
        const set10 = await retrieveAndCheckKeys(settingsPage, acct, 1);
        const mainKey10 = KeyUtil.filterKeysByIdentity(set10, [mainKey9[0]]);
        expect(await getPassphrase(settingsPage, acct, KeyUtil.getPrimaryLongid(secondaryKey9[0]))).to.be.an.undefined; // the passphrase for the old key was deleted
        expect(mainKey10.length).to.equal(1);
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        expect(mainKey10[0].lastModified!).to.be.greaterThan(mainKey9[0].lastModified!); // updated this key
        // 10. Forget the passphrase, EKM returns a third key, we enter a passphrase that doesn't match any of the existing keys, no update
        await InboxPageRecipe.finishSessionOnInboxPage(gmailPage);
        await gmailPage.close();
        t.mockApi!.configProvider.config.ekm!.keys = [testConstants.unprotectedPrvKey];
        gmailPage = await browser.newMockGmailPage(t, extraAuthHeaders);
        await gmailPage.waitAll('@dialog-passphrase');
        {
          const passphraseDialog = await gmailPage.getFrame(['passphrase.htm']);
          await passphraseDialog.waitAndType('@input-pass-phrase', 'g00D_pa$$worD-But_Different');
          await passphraseDialog.waitAndClick('@action-confirm-pass-phrase-entry');
          // todo: how to wait properly
          await passphraseDialog.waitForContent('@input-pass-phrase', /^$/);
          expect(await passphraseDialog.attr('@input-pass-phrase', 'placeholder')).to.eq('Please try again');
        }
        await ComposePageRecipe.cancelPassphraseDialog(gmailPage, 'keyboard');
        await PageRecipe.noToastAppears(gmailPage);
        const set11 = await retrieveAndCheckKeys(settingsPage, acct, 1, passphrase);
        expect(set11.map(entry => entry.id)).to.eql(['392FB1E9FF4184659AB6A246835C0141B9ECF536']);
        await gmailPage.close();
        // 11. EKM returns a new third key, we enter a passphrase matching an existing key, update happens, the old key is removed
        gmailPage = await browser.newMockGmailPage(t, extraAuthHeaders);
        await gmailPage.waitAll('@dialog-passphrase');
        {
          const passphraseDialog = await gmailPage.getFrame(['passphrase.htm']);
          await passphraseDialog.waitForContent('@passphrase-text', 'Enter FlowCrypt pass phrase to keep your account keys up to date');
          await passphraseDialog.waitAndType('@input-pass-phrase', passphrase);
          await passphraseDialog.waitAndClick('@action-confirm-pass-phrase-entry');
        }
        await gmailPage.waitTillGone('@dialog-passphrase');
        await PageRecipe.waitForToastToAppearAndDisappear(gmailPage, 'Account keys updated');
        const set12 = await retrieveAndCheckKeys(settingsPage, acct, 1);
        expect(await getPassphrase(settingsPage, acct, KeyUtil.getPrimaryLongid(set11[0]))).to.be.an.undefined; // the passphrase for the old key was deleted
        expect(set12.map(entry => entry.id)).to.eql(['277D1ADA213881F4ABE0415395E783DC0289E2E2']);
        const mainKey12 = KeyUtil.filterKeysByIdentity(set12, [{ family: 'openpgp', id: '277D1ADA213881F4ABE0415395E783DC0289E2E2' }]);
        expect(mainKey12.length).to.equal(1);
        // 12. Forget the passphrase, EKM sends a broken key, no passphrase dialog, no updates
        await InboxPageRecipe.finishSessionOnInboxPage(gmailPage);
        await gmailPage.close();
        t.mockApi!.configProvider.config.ekm!.keys = [
          await updateAndArmorKey(set2[0]),
          testConstants.unprotectedPrvKey.substring(0, testConstants.unprotectedPrvKey.length / 2),
        ];
        gmailPage = await browser.newMockGmailPage(t, extraAuthHeaders);
        await PageRecipe.waitForToastToAppearAndDisappear(gmailPage, 'Could not update keys from EKM due to error: Some keys could not be parsed');
        await gmailPage.notPresent('@dialog-passphrase');
        const set13 = await retrieveAndCheckKeys(settingsPage, acct, 1, passphrase);
        expect(set13.map(entry => entry.id)).to.eql(['277D1ADA213881F4ABE0415395E783DC0289E2E2']);
        const mainKey13 = KeyUtil.filterKeysByIdentity(set13, [{ family: 'openpgp', id: '277D1ADA213881F4ABE0415395E783DC0289E2E2' }]);
        expect(mainKey13.length).to.equal(1);
        expect(mainKey13[0].lastModified).to.equal(mainKey12[0].lastModified); // no update
        await gmailPage.close();
        // 13. EKM down, no toast, no passphrase dialog, no updates
        t.mockApi!.configProvider.config.ekm!.returnError = new HttpClientErr('RequestTimeout', Status.BAD_REQUEST);
        gmailPage = await browser.newMockGmailPage(t, extraAuthHeaders);
        await PageRecipe.noToastAppears(gmailPage);
        await gmailPage.notPresent('@dialog-passphrase');
        const set14 = await retrieveAndCheckKeys(settingsPage, acct, 1, passphrase);
        expect(set14.map(entry => entry.id)).to.eql(['277D1ADA213881F4ABE0415395E783DC0289E2E2']);
        const mainKey14 = KeyUtil.filterKeysByIdentity(
          set14.map(ki => ki),
          [{ family: 'openpgp', id: '277D1ADA213881F4ABE0415395E783DC0289E2E2' }]
        );
        expect(mainKey14.length).to.equal(1);
        expect(mainKey14[0].lastModified).to.equal(mainKey13[0].lastModified); // no update
        await gmailPage.close();
      })
    );

    test(
      'put.updating.key@key-manager-choose-passphrase-forbid-storing.flowcrypt.test - updates of key found on key manager via setup page (with passphrase)',
      testWithBrowser(async (t, browser) => {
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {},
          },
          ekm: {
            keys: [testConstants.updatingPrv],
          },
          fes: {
            clientConfiguration: getKeyManagerChoosePassphraseForbidStoringRules(t.urls!.port!),
          },
        });
        const acct = 'put.updating.key@key-manager-choose-passphrase-forbid-storing.flowcrypt.test';
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acct);
        const passphrase = 'long enough to suit requirements';
        await SetupPageRecipe.autoSetupWithEKM(settingsPage, {
          enterPp: { passphrase, checks: { isSavePassphraseChecked: false, isSavePassphraseHidden: true } },
        });
        const accessToken = await BrowserRecipe.getGoogleAccessToken(settingsPage, acct);
        // eslint-disable-next-line @typescript-eslint/naming-convention
        const extraAuthHeaders = { Authorization: `Bearer ${accessToken}` };
        const set1 = await retrieveAndCheckKeys(settingsPage, acct, 1);
        // 1. EKM returns the empty set, forcing to auto-generate
        t.mockApi!.configProvider.config.ekm!.keys = [];
        let gmailPage = await browser.newMockGmailPage(t, extraAuthHeaders);
        // The new settingsPage is loaded in place of the existing settings tab (this is by design)
        // However, after a second the newly-activated (old) settings tab loses focus in favour of the gmailPage, why is that?
        // Looks like Puppeteer's misbehaviour
        await PageRecipe.noToastAppears(gmailPage);
        await gmailPage.notPresent('@dialog-passphrase');
        await gmailPage.close();
        await retrieveAndCheckKeys(settingsPage, acct, 0); // no keys, auto-generation
        expect(await getPassphrase(settingsPage, acct, KeyUtil.getPrimaryLongid(set1[0]))).to.be.an.undefined; // the passphrase for the old key was deleted
        await SetupPageRecipe.autoSetupWithEKM(settingsPage, {
          enterPp: { passphrase, checks: { isSavePassphraseChecked: false, isSavePassphraseHidden: true } },
        });
        const savedKeys = t.mockApi!.configProvider.config.ekm?.keys ?? [];
        expect(savedKeys.length).to.not.eq(0);
        const set2 = await retrieveAndCheckKeys(settingsPage, acct, 1);
        expect(set2[0].id).to.not.equal(set1[0].id); // entirely new key was generated
        // 2. Adding a new key from the key manager when there is none in the storage
        // First, erase the keys by supplying an empty set from mock EKM
        t.mockApi!.configProvider.config.ekm!.keys = [];
        gmailPage = await browser.newMockGmailPage(t, extraAuthHeaders);
        await PageRecipe.noToastAppears(gmailPage);
        await gmailPage.notPresent('@dialog-passphrase');
        await gmailPage.close();
        await retrieveAndCheckKeys(settingsPage, acct, 0); // no keys, auto-generation
        expect(await getPassphrase(settingsPage, acct, KeyUtil.getPrimaryLongid(set2[0]))).to.be.an.undefined; // the passphrase for the old key was deleted
        await settingsPage.close();
        // Secondly, configure mock EKM to return a key and re-load the gmail page
        t.mockApi!.configProvider.config.ekm!.keys = [testConstants.updatingPrv];
        gmailPage = await browser.newPage(t, undefined, undefined, extraAuthHeaders);
        const newSettingsPage = await browser.newPageTriggeredBy(t, () => gmailPage.goto(t.urls?.mockGmailUrl() ?? ''));
        await SetupPageRecipe.autoSetupWithEKM(newSettingsPage, {
          enterPp: { passphrase, checks: { isSavePassphraseChecked: false, isSavePassphraseHidden: true } },
        });
        const savedKeys2 = t.mockApi!.configProvider.config.ekm?.keys ?? [];
        expect(savedKeys2.length).to.not.eq(0);
        const set3 = await retrieveAndCheckKeys(newSettingsPage, acct, 1);
        expect(set3[0].id).to.equal(set1[0].id); // the key was received from the EKM
        await newSettingsPage.close();
        await gmailPage.close();
      })
    );

    test(
      'get.updating.key@key-manager-autoimport-no-prv-create.flowcrypt.test - updates of key found on key manager when NO_PRV_CREATE',
      testWithBrowser(async (t, browser) => {
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {},
          },
          ekm: {
            keys: [testConstants.updatingPrv],
          },
          fes: {
            clientConfiguration: getKeyManagerAutoImportNoPrvCreateRules(t.urls!.port!),
          },
        });
        const acct = 'get.updating.key@key-manager-autoimport-no-prv-create.flowcrypt.test';
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acct);
        await SetupPageRecipe.autoSetupWithEKM(settingsPage);
        const accessToken = await BrowserRecipe.getGoogleAccessToken(settingsPage, acct);
        // eslint-disable-next-line @typescript-eslint/naming-convention
        const extraAuthHeaders = { Authorization: `Bearer ${accessToken}` };
        const set1 = await retrieveAndCheckKeys(settingsPage, acct, 1);
        t.mockApi!.configProvider.config.ekm!.keys = [];
        // 1. EKM returns the empty set, auto-generation is not allowed, hence the error modal
        let gmailPage = await browser.newMockGmailPage(t, extraAuthHeaders);
        await gmailPage.waitAndRespondToModal('error', 'confirm', 'Keys for your account were not set up yet - please ask your systems administrator');
        await PageRecipe.noToastAppears(gmailPage);
        await gmailPage.close();
        await retrieveAndCheckKeys(settingsPage, acct, 0); // no keys
        expect(await getPassphrase(settingsPage, acct, KeyUtil.getPrimaryLongid(set1[0]))).to.be.an.undefined; // the passphrase for the old key was deleted
        await settingsPage.close();
        // 2. Adding a new key from the key manager when there is none in the storage
        t.mockApi!.configProvider.config.ekm!.keys = [testConstants.updatingPrv];
        gmailPage = await browser.newMockGmailPage(t, extraAuthHeaders);
        await PageRecipe.waitForToastToAppearAndDisappear(gmailPage, 'Account keys updated');
        await gmailPage.close();
        const dbPage = await browser.newExtensionPage(t, 'chrome/dev/ci_unit_test.htm');
        const set2 = await retrieveAndCheckKeys(dbPage, acct, 1);
        expect(set2[0].id).to.equal(set1[0].id); // the key was received from the EKM
        await dbPage.close();
      })
    );

    test(
      'user@custom-sks.flowcrypt.test - Respect custom key server url',
      testWithBrowser(async (t, browser) => {
        const port = t.urls!.port!;
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {},
          },
          ekm: {
            keys: [testConstants.existingPrv],
          },
          fes: {
            clientConfiguration: {
              ...getKeyManagerAutogenRules(port),
              // eslint-disable-next-line @typescript-eslint/naming-convention
              custom_keyserver_url: `https://localhost:${port}`,
            },
          },
        });
        const acct = 'user@custom-sks.flowcrypt.test';
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acct);
        await SetupPageRecipe.autoSetupWithEKM(settingsPage);
        const composePage = await ComposePageRecipe.openStandalone(t, browser, acct);
        await ComposePageRecipe.fillMsg(composePage, { to: 'test@custom-sks.flowcrypt.test' }, 'Respect custom key server url');
        await composePage.waitForContent('.email_address.has_pgp', 'test@custom-sks.flowcrypt.test');
        await composePage.close();
        await SettingsPageRecipe.toggleScreen(settingsPage, 'additional');
        const contactsFrame = await SettingsPageRecipe.awaitNewPageFrame(settingsPage, '@action-open-contacts-page', ['contacts.htm', 'placement=settings']);
        await contactsFrame.waitForContent('@custom-key-server-description', `using custom SKS pubkeyserver: https://localhost:${port}`);
      })
    );

    test.todo('DEFAULT_REMEMBER_PASS_PHRASE with auto-generation when all keys are removed by EKM');
    // should we re-use the known passphrase or delete it from the storage in this scenario?

    test(
      'user@no-flags-client-configuration.flowcrypt.test - should show error when no flags is present',
      testWithBrowser(async (t, browser) => {
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {},
          },
          fes: {
            clientConfiguration: {},
          },
        });
        const acctEmail = 'user@no-flags-client-configuration.flowcrypt.test';
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acctEmail);
        await Util.sleep(1);
        await settingsPage.waitAndRespondToModal('error', 'confirm', 'Missing client configuration flags.');
      })
    );

    test(
      'null-setting@null-client-configuration.flowcrypt.test - should not show error when no setting is present',
      testWithBrowser(async (t, browser) => {
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {},
          },
          fes: {
            clientConfiguration: undefined,
          },
        });
        const acctEmail = 'null-setting@null-client-configuration.flowcrypt.test';
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acctEmail);
        await Util.sleep(1);
        await settingsPage.notPresent('@container-error-modal-text');
      })
    );

    test(
      'get.key@key-manager-choose-passphrase.flowcrypt.test - passphrase chosen by user with key found on key manager',
      testWithBrowser(async (t, browser) => {
        const clientConfiguration = getKeyManagerAutogenRules(t.urls!.port!);
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {},
          },
          ekm: {
            keys: [testConstants.existingPrv],
          },
          fes: {
            clientConfiguration: {
              ...clientConfiguration,
              flags: ['NO_PRV_BACKUP', 'PRV_AUTOIMPORT_OR_AUTOGEN', 'NO_ATTESTER_SUBMIT', 'DEFAULT_REMEMBER_PASS_PHRASE'],
            },
          },
        });
        const acct = 'get.key@key-manager-choose-passphrase.flowcrypt.test';
        const passphrase = 'Long and complicated pass PHRASE';
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acct);
        await SetupPageRecipe.autoSetupWithEKM(settingsPage, {
          enterPp: { passphrase, checks: { isSavePassphraseChecked: true, isSavePassphraseHidden: false } },
        });
        const {
          cryptup_getkeykeymanagerchoosepassphraseflowcrypttest_keys: keys,
          cryptup_getkeykeymanagerchoosepassphraseflowcrypttest_rules: rules,
          cryptup_getkeykeymanagerchoosepassphraseflowcrypttest_passphrase_00B0115807969D75: savedPassphrase,
        } = await settingsPage.getFromLocalStorage([
          'cryptup_getkeykeymanagerchoosepassphraseflowcrypttest_keys',
          'cryptup_getkeykeymanagerchoosepassphraseflowcrypttest_rules',
          'cryptup_getkeykeymanagerchoosepassphraseflowcrypttest_passphrase_00B0115807969D75',
        ]);
        expect((rules as { flags: string[] }).flags).not.to.include('FORBID_STORING_PASS_PHRASE');
        expect((rules as { flags: string[] }).flags).to.include('DEFAULT_REMEMBER_PASS_PHRASE');
        expect((keys as KeyInfoWithIdentity[])[0].longid).to.equal('00B0115807969D75');
        expect(savedPassphrase).to.equal(passphrase);
      })
    );

    test(
      'get.key@key-manager-choose-passphrase-forbid-storing.flowcrypt.test - passphrase chosen by user with key found on key manager and forbid storing',
      testWithBrowser(async (t, browser) => {
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {},
          },
          ekm: {
            keys: [testConstants.existingPrv],
          },
          fes: {
            clientConfiguration: getKeyManagerChoosePassphraseForbidStoringRules(t.urls!.port!),
          },
        });
        const acct = 'get.key@key-manager-choose-passphrase-forbid-storing.flowcrypt.test';
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acct);
        await SetupPageRecipe.autoSetupWithEKM(settingsPage, {
          enterPp: {
            passphrase: 'long enough to suit requirements',
            checks: { isSavePassphraseChecked: false, isSavePassphraseHidden: true },
          },
        });
        const {
          cryptup_getkeykeymanagerchoosepassphraseforbidstoringflowcrypttest_keys: keys,
          cryptup_getkeykeymanagerchoosepassphraseforbidstoringflowcrypttest_rules: rules,
          cryptup_getkeykeymanagerchoosepassphraseforbidstoringflowcrypttest_passphrase_00B0115807969D75: savedPassphrase,
        } = await settingsPage.getFromLocalStorage([
          'cryptup_getkeykeymanagerchoosepassphraseforbidstoringflowcrypttest_keys',
          'cryptup_getkeykeymanagerchoosepassphraseforbidstoringflowcrypttest_rules',
          'cryptup_getkeykeymanagerchoosepassphraseforbidstoringflowcrypttest_passphrase_00B0115807969D75',
        ]);
        expect((rules as { flags: string[] }).flags).to.include('FORBID_STORING_PASS_PHRASE');
        expect((rules as { flags: string[] }).flags).not.to.include('DEFAULT_REMEMBER_PASS_PHRASE');
        expect((keys as KeyInfoWithIdentity[])[0].longid).to.equal('00B0115807969D75');
        expect(savedPassphrase).to.be.an('undefined');
      })
    );

    test(
      'user@passphrase-session-length-client-configuration.flowcrypt.test - passphrase should expire in in_memory_pass_phrase_session_length',
      testWithBrowser(async (t, browser) => {
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {},
          },
          fes: {
            clientConfiguration: {
              flags: ['FORBID_STORING_PASS_PHRASE'],
              // eslint-disable-next-line @typescript-eslint/naming-convention
              in_memory_pass_phrase_session_length: 10,
            },
          },
        });
        const acctEmail = 'user@passphrase-session-length-client-configuration.flowcrypt.test';
        const longid = '715EDCDC7939A8F7';
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acctEmail);
        const passphrase = '1234';
        await SetupPageRecipe.manualEnter(settingsPage, 'unused', {
          submitPubkey: false,
          usedPgpBefore: false,
          key: {
            title: 'my key',
            armored: testConstants.testkey715EDCDC7939A8F7,
            passphrase,
            longid,
          },
        });
        const { cryptup_userpassphrasesessionlengthclientconfigurationflowcrypttest_rules: rules } = await settingsPage.getFromLocalStorage([
          'cryptup_userpassphrasesessionlengthclientconfigurationflowcrypttest_rules',
        ]);
        let savedPassphrase = await BrowserRecipe.getPassphraseFromInMemoryStore(settingsPage, acctEmail, longid);
        expect(
          // eslint-disable-next-line @typescript-eslint/naming-convention
          (rules as { in_memory_pass_phrase_session_length: number }).in_memory_pass_phrase_session_length
        ).to.be.equal(10);
        expect(savedPassphrase).to.be.equal(passphrase);
        await Util.sleep(10);
        savedPassphrase = await BrowserRecipe.getPassphraseFromInMemoryStore(settingsPage, acctEmail, longid);
        expect(savedPassphrase).to.be.undefined;
      })
    );

    test(
      'get.key@key-manager-autoimport-no-prv-create.flowcrypt.test - respect NO_PRV_CREATE when key not found on key manager',
      testWithBrowser(async (t, browser) => {
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {},
          },
          ekm: {
            keys: [],
          },
          fes: {
            clientConfiguration: getKeyManagerAutoImportNoPrvCreateRules(t.urls!.port!),
          },
        });
        const acct = 'get.key@key-manager-autoimport-no-prv-create.flowcrypt.test';
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acct);
        await settingsPage.waitAndRespondToModal('error', 'confirm', 'Keys for your account were not set up yet - please ask your systems administrator');
      })
    );

    test(
      'get.key@no-submit-client-configuration.key-manager-autogen.flowcrypt.test - automatic setup with key found on key manager and no submit rule',
      testWithBrowser(async (t, browser) => {
        const rules = getKeyManagerAutogenRules(t.urls!.port!);
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {},
          },
          ekm: {
            keys: [prvNoSubmit],
          },
          fes: {
            clientConfiguration: {
              ...rules,
              flags: [...(rules.flags ?? []), 'NO_ATTESTER_SUBMIT'],
            },
          },
        });
        const acct = 'get.key@no-submit-client-configuration.key-manager-autogen.flowcrypt.test';
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acct);
        await SetupPageRecipe.autoSetupWithEKM(settingsPage);
        await SettingsPageRecipe.toggleScreen(settingsPage, 'additional');
        // check no "add key"
        await settingsPage.notPresent('@action-open-add-key-page');
        // check imported key
        const myKeyFrame = await SettingsPageRecipe.awaitNewPageFrame(settingsPage, `@action-show-key-0`, ['my_key.htm', 'placement=settings']);
        await Util.sleep(1);
        await myKeyFrame.waitAll('@content-fingerprint');
        expect(await myKeyFrame.read('@content-fingerprint')).to.contain('9C64 3D82 783E 291A 2AD2 611B 499E 84DB 185F 0359');
        await SettingsPageRecipe.closeDialog(settingsPage);
      })
    );

    test(
      'put.key@key-manager-autogen.flowcrypt.test - automatic setup with key not found on key manager, then generated',
      testWithBrowser(async (t, browser) => {
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {},
          },
          ekm: {
            keys: [],
          },
          fes: {
            clientConfiguration: getKeyManagerAutogenRules(t.urls!.port!),
          },
        });
        const acct = 'put.key@key-manager-autogen.flowcrypt.test';
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acct);
        await SetupPageRecipe.autoSetupWithEKM(settingsPage);
        await SettingsPageRecipe.toggleScreen(settingsPage, 'additional');
        // check no "add key"
        await settingsPage.notPresent('@action-open-add-key-page');
        // check imported key
        const myKeyFrame = await SettingsPageRecipe.awaitNewPageFrame(settingsPage, `@action-show-key-0`, ['my_key.htm', 'placement=settings']);
        await Util.sleep(1);
        await myKeyFrame.waitAll('@content-fingerprint');
        const savedKey = (t.mockApi!.configProvider.config.ekm?.keys ?? [])[0];
        const k = await KeyUtil.parse(savedKey);
        expect(await myKeyFrame.read('@content-fingerprint')).to.equal(Str.spaced(k.id));
        expect(await myKeyFrame.read('@content-key-expiration')).to.equal('Key does not expire');
        await SettingsPageRecipe.closeDialog(settingsPage);
        await Util.sleep(2);
        // check that it does not offer any pass phrase options
        await SettingsPageRecipe.toggleScreen(settingsPage, 'basic');
        const securityFrame = await SettingsPageRecipe.awaitNewPageFrame(settingsPage, '@action-open-security-page', ['security.htm', 'placement=settings']);
        await Util.sleep(1);
        await securityFrame.notPresent(['@action-change-passphrase-begin', '@action-test-passphrase-begin', '@action-forget-pp']);
      })
    );

    test(
      'get.error@key-manager-autogen.flowcrypt.test - handles error during KM key GET',
      testWithBrowser(async (t, browser) => {
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {},
          },
          ekm: {
            returnError: new HttpClientErr('Intentional error for get.error to test client behavior', Status.SERVER_ERROR),
          },
          fes: {
            clientConfiguration: getKeyManagerAutogenRules(t.urls!.port!),
          },
        });
        const acct = 'get.error@key-manager-autogen.flowcrypt.test';
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acct);
        await SetupPageRecipe.autoSetupWithEKM(settingsPage, {
          expectErrView: {
            title: 'Server responded with an unexpected error.',
            text: `500 when GET-ing https://localhost:${t.urls?.port}/flowcrypt-email-key-manager/v1/keys/private (no body): -> Intentional error for get.error to test client behavior`,
          },
        });
      })
    );

    test(
      'put.error@key-manager-autogen.flowcrypt.test - handles error during KM key PUT',
      testWithBrowser(async (t, browser) => {
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {},
          },
          ekm: {
            keys: [],
            putReturnError: new HttpClientErr('Intentional error for put.error user to test client behavior', Status.SERVER_ERROR),
          },
          fes: {
            clientConfiguration: getKeyManagerAutogenRules(t.urls!.port!),
          },
        });
        const acct = 'put.error@key-manager-autogen.flowcrypt.test';
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acct);
        await settingsPage.waitAll(['@action-overlay-retry', '@container-overlay-prompt-text', '@action-show-overlay-details']);
        await Util.sleep(0.5);
        expect(await settingsPage.read('@container-overlay-prompt-text')).to.contain('Failed to store newly generated key on FlowCrypt Email Key Manager');
        await settingsPage.click('@action-show-overlay-details');
        await settingsPage.waitAll('@container-overlay-details');
        await Util.sleep(0.5);
        const details = await settingsPage.read('@container-overlay-details');
        expect(details).to.contain(
          `500 when PUT-ing https://localhost:${t.urls?.port}/flowcrypt-email-key-manager/v1/keys/private string: privateKey -> Intentional error for put.error user to test client behavior`
        );
        expect(details).to.not.contain('PRIVATE KEY');
        expect(details).to.not.contain('<REDACTED:');
      })
    );

    test(
      'fail@key-manager-server-offline.flowcrypt.test - shows friendly EKM not reachable error - during autogen',
      testWithBrowser(async (t, browser) => {
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {},
          },
          fes: {
            clientConfiguration: {
              ...getKeyManagerAutogenRules(t.urls!.port!),
              // eslint-disable-next-line @typescript-eslint/naming-convention
              key_manager_url: 'https://localhost:1230/intentionally-wrong',
            },
          },
        });
        const acct = 'fail@key-manager-server-offline.flowcrypt.test';
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acct);
        await SetupPageRecipe.autoSetupWithEKM(settingsPage, {
          expectErrView: {
            title: 'Network connection issue.',
            text: 'FlowCrypt Email Key Manager at https://localhost:1230/intentionally-wrong cannot be reached. If your organization requires a VPN, please connect to it. Else, please inform your network admin.',
          },
        });
      })
    );

    test(
      'get.key@ekm-offline-retrieve.flowcrypt.test - show clear error to user - during retrieval',
      testWithBrowser(async (t, browser) => {
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {},
          },
          fes: {
            clientConfiguration: {
              // EKM offline during key retrieval from EKM flow
              flags: ['NO_PRV_CREATE', 'NO_PRV_BACKUP', 'NO_ATTESTER_SUBMIT', 'PRV_AUTOIMPORT_OR_AUTOGEN'],
              // eslint-disable-next-line @typescript-eslint/naming-convention
              key_manager_url: 'https://localhost:1230/intentionally-wrong',
            },
          },
        });
        const acct = 'get.key@ekm-offline-retrieve.flowcrypt.test';
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acct);
        await SetupPageRecipe.autoSetupWithEKM(settingsPage, {
          enterPp: { passphrase: 'l3o3kqSa:;[]Leppaanz' },
          expectErrModal:
            'FlowCrypt Email Key Manager at https://localhost:1230/intentionally-wrong cannot be reached. If your organization requires a VPN, please connect to it. Else, please inform your network admin.',
        });
      })
    );

    test(
      'expire@key-manager-keygen-expiration.flowcrypt.test - ClientConfiguration enforce_keygen_expire_months: 1',
      testWithBrowser(async (t, browser) => {
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {},
          },
          ekm: {
            keys: [],
          },
          fes: {
            clientConfiguration: {
              ...getKeyManagerAutogenRules(t.urls!.port!),
              // eslint-disable-next-line @typescript-eslint/naming-convention
              enforce_keygen_expire_months: 1,
            },
          },
        });
        const acct = 'expire@key-manager-keygen-expiration.flowcrypt.test';
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acct);
        await SetupPageRecipe.autoSetupWithEKM(settingsPage);
        await SettingsPageRecipe.toggleScreen(settingsPage, 'additional');
        const myKeyFrame = await SettingsPageRecipe.awaitNewPageFrame(settingsPage, `@action-show-key-0`, ['my_key.htm', 'placement=settings']);
        await Util.sleep(1);
        await myKeyFrame.waitAll('@content-fingerprint');
        const savedKey = (t.mockApi?.configProvider.config.ekm?.keys ?? [])[0];
        const k = await KeyUtil.parse(savedKey);
        expect(await myKeyFrame.read('@content-fingerprint')).to.equal(Str.spaced(k.id));
        const approxMonth = [29, 30, 31].map(days => Str.datetimeToDate(Str.fromDate(new Date(Date.now() + 1000 * 60 * 60 * 24 * days))));
        expect(await myKeyFrame.read('@content-key-expiration')).to.be.oneOf(approxMonth);
        await SettingsPageRecipe.closeDialog(settingsPage);
      })
    );

    test(
      'reject.client.keypair@key-manager-autogen.flowcrypt.test - does not leak sensitive info on err 400, shows informative err',
      testWithBrowser(async (t, browser) => {
        const acct = 'reject.client.keypair@key-manager-autogen.flowcrypt.test';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {},
          },
          ekm: {
            keys: [],
            putReturnError: new HttpClientErr(`No key has been generated for ${acct} yet. Please ask your administrator.`, Status.NOT_ALLOWED),
          },
          fes: {
            clientConfiguration: getKeyManagerAutogenRules(t.urls!.port!),
          },
        });
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acct);
        await settingsPage.waitAll(['@action-overlay-retry', '@container-overlay-prompt-text', '@action-show-overlay-details']);
        await Util.sleep(0.5);
        const title = await settingsPage.read('@container-overlay-prompt-text');
        expect(title).to.contain(
          'Failed to store newly generated key on FlowCrypt Email Key Manager, ' +
            'No key has been generated for reject.client.keypair@key-manager-autogen.flowcrypt.test yet. Please ask your administrator.'
        );
        await settingsPage.click('@action-show-overlay-details');
        await settingsPage.waitAll('@container-overlay-details');
        await Util.sleep(0.5);
        const details = await settingsPage.read('@container-overlay-details');
        expect(details).to.contain(
          `405 when PUT-ing https://localhost:${t.urls?.port}/flowcrypt-email-key-manager/v1/keys/private string: ` +
            'privateKey -> No key has been generated for reject.client.keypair@key-manager-autogen.flowcrypt.test yet'
        );
        expect(details).to.not.contain('PRIVATE KEY');
      })
    );

    test(
      'user@standardsubdomainfes.localhost:8001 - uses FES on standard domain',
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
        const debugFrame = await SettingsPageRecipe.awaitNewPageFrame(settingsPage, '@action-show-local-store-contents', ['debug_api.htm']);
        await debugFrame.waitForContent('@container-pre', `fes.standardsubdomainfes.localhost:${port}`); // FES url on standard subdomain
        await debugFrame.waitForContent('@container-pre', 'got.this@fromstandardfes.com'); // org rules from FES
      })
    );

    /**
     * enterprise - expects FES to be set up. when it's not, show nice error
     * consumer - tolerates the missing FES and and sets up without it
     */
    test(
      'no.fes@example.com - skip FES on consumer, show friendly message on enterprise',
      testWithBrowser(async (t, browser) => {
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {},
          },
        });
        const acct = 'no.fes@example.com';
        if (testVariant === 'ENTERPRISE-MOCK') {
          // shows err on enterprise
          const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acct);
          await settingsPage.waitAndRespondToModal(
            'error',
            'confirm',
            "Cannot reach your company's FlowCrypt External Service (FES). Contact your Help Desk when unsure."
          );
        } else if (testVariant === 'CONSUMER-MOCK') {
          // allows to set up on consumer
          const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acct);
          await SetupPageRecipe.manualEnter(
            settingsPage,
            'flowcrypt.test.key.used.pgp',
            { submitPubkey: false, usedPgpBefore: false },
            { isSavePassphraseChecked: false, isSavePassphraseHidden: false }
          );
        } else {
          throw new Error(`Unexpected test variant ${testVariant}`);
        }
      })
    );

    test(
      'setup - s/mime private key',
      testWithBrowser(async (t, browser) => {
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {},
          },
        });
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, 'flowcrypt.test.key.imported@gmail.com');
        await SetupPageRecipe.setupSmimeAccount(settingsPage, {
          title: 's/mime pkcs12 unprotected key',
          filePath: 'test/samples/smime/test-unprotected-PKCS12.p12',
          armored: null, // eslint-disable-line no-null/no-null
          passphrase: 'test pp to encrypt unprotected key',
          longid: null, // eslint-disable-line no-null/no-null
        });
      })
    );
  }

  if (testVariant === 'CONSUMER-MOCK') {
    test(
      'setup - imported key with multiple alias should show checkbox per alias',
      testWithBrowser(async (t, browser) => {
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {},
          },
        });
        expect((await KeyUtil.parse(testConstants.keyMultiAliasedUser)).emails.length).to.equals(3);
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, 'multi.aliased.user@example.com');
        await SetupPageRecipe.manualEnter(
          settingsPage,
          '',
          {
            submitPubkey: true,
            fillOnly: true,
            checkEmailAliasIfPresent: true,
            key: {
              title: 'multi.aliased.user@example.com',
              passphrase: '1basic passphrase to use',
              armored: testConstants.keyMultiAliasedUser,
              longid: null, // eslint-disable-line no-null/no-null
            },
          },
          { isSavePassphraseChecked: false, isSavePassphraseHidden: false }
        );
        expect(await settingsPage.isChecked('.container_for_import_key_email_alias @input-email-alias-alias1examplecom')).to.equal(true);
        expect(await settingsPage.isChecked('.container_for_import_key_email_alias @input-email-alias-alias2examplecom')).to.equal(true);
        await settingsPage.close();
      })
    );

    test(
      'setup - imported key from a file with multiple alias',
      testWithBrowser(async (t, browser) => {
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {},
          },
        });
        const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, 'multi.aliased.user@example.com');
        const key = {
          title: 'unarmored OpenPGP key',
          filePath: 'test/samples/openpgp/multialiaseduserexamplecom-0x357B908F62498DF8.key',
          armored: null, // eslint-disable-line no-null/no-null
          passphrase: '1basic passphrase to use',
          longid: null, // eslint-disable-line no-null/no-null
        };
        await SetupPageRecipe.manualEnter(settingsPage, key.title, { submitPubkey: true, fillOnly: true, key });
        expect(await settingsPage.isChecked('.container_for_import_key_email_alias @input-email-alias-alias1examplecom')).to.equal(true);
        expect(await settingsPage.isChecked('.container_for_import_key_email_alias @input-email-alias-alias2examplecom')).to.equal(true);
        /* simulate several clicks then exclude alias2@example.com from submitting key from the attester */
        await settingsPage.waitAndClick('.container_for_import_key_email_alias @input-email-alias-alias1examplecom'); // uncheck
        await settingsPage.waitAndClick('.container_for_import_key_email_alias @input-email-alias-alias1examplecom'); // check
        await settingsPage.waitAndClick('.container_for_import_key_email_alias @input-email-alias-alias2examplecom'); // uncheck
        await settingsPage.waitAndClick('.container_for_import_key_email_alias @input-email-alias-alias2examplecom'); // check
        await settingsPage.waitAndClick('.container_for_import_key_email_alias @input-email-alias-alias2examplecom'); // finally uncheck
        await settingsPage.waitAndClick('@input-step2bmanualenter-save', { delay: 1 });
        await settingsPage.waitAndClick('@action-step4done-account-settings');
        expect(t.mockApi!.configProvider?.config.attester?.pubkeyLookup?.['multi.aliased.user@example.com']).not.to.be.an('undefined');
        expect(t.mockApi!.configProvider?.config.attester?.pubkeyLookup?.['alias1@example.com']).not.to.be.an('undefined');
        expect(t.mockApi!.configProvider?.config.attester?.pubkeyLookup?.['alias2@example.com']).to.be.an('undefined');
        await settingsPage.close();
      })
    );
  }
};
