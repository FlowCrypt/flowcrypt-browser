/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import * as fs from 'fs';
import * as ava from 'ava';
import { Page } from 'puppeteer';

import { Config, Util } from './../util';
import { TestWithBrowser, internalTestState } from './../test';

import { BrowserRecipe } from './tooling/browser-recipe';
import { InboxPageRecipe } from './page-recipe/inbox-page-recipe';
import { SettingsPageRecipe } from './page-recipe/settings-page-recipe';
import { TestUrls } from './../browser/test-urls';
import { TestVariant } from './../util';
import { expect } from 'chai';
import { SetupPageRecipe } from './page-recipe/setup-page-recipe';
import { testConstants } from './tooling/consts';
import { PageRecipe } from './page-recipe/abstract-page-recipe';
import { OauthPageRecipe } from './page-recipe/oauth-page-recipe';
import { Pubkey } from '../platform/store/contact-store';
import { KeyInfo } from '../core/crypto/key';

// tslint:disable:no-blank-lines-func

export let defineSettingsTests = (testVariant: TestVariant, testWithBrowser: TestWithBrowser) => {

  if (testVariant !== 'CONSUMER-LIVE-GMAIL') {

    ava.default('settings - my own emails show as contacts', testWithBrowser('compatibility', async (t, browser) => {
      const settingsPage = await browser.newPage(t, TestUrls.extensionSettings('flowcrypt.compatibility@gmail.com'));
      await SettingsPageRecipe.toggleScreen(settingsPage, 'additional');
      const comtactsFrame = await SettingsPageRecipe.awaitNewPageFrame(settingsPage, '@action-open-contacts-page', ['contacts.htm', 'placement=settings']);
      await comtactsFrame.waitAll('@page-contacts');
      await Util.sleep(1);
      expect(await comtactsFrame.read('@page-contacts')).to.contain('flowcrypt.compatibility@gmail.com');
      expect(await comtactsFrame.read('@page-contacts')).to.contain('flowcryptcompatibility@gmail.com');
      await SettingsPageRecipe.closeDialog(settingsPage);
      await SettingsPageRecipe.toggleScreen(settingsPage, 'basic');
    }));

    ava.default('settings - attester shows my emails', testWithBrowser('compatibility', async (t, browser) => {
      const settingsPage = await browser.newPage(t, TestUrls.extensionSettings('flowcrypt.compatibility@gmail.com'));
      await SettingsPageRecipe.toggleScreen(settingsPage, 'additional');
      const attesterFrame = await SettingsPageRecipe.awaitNewPageFrame(settingsPage, '@action-open-attester-page', ['keyserver.htm', 'placement=settings']);
      await attesterFrame.waitAll('@page-attester');
      await Util.sleep(1);
      await attesterFrame.waitTillGone('@spinner');
      await attesterFrame.waitForContent('@page-attester', 'flowcrypt.compatibility@gmail.com');
      await attesterFrame.waitForContent('@page-attester', 'flowcryptcompatibility@gmail.com');
      await SettingsPageRecipe.closeDialog(settingsPage);
      await SettingsPageRecipe.toggleScreen(settingsPage, 'basic');
    }));

    ava.default('settings - verify key presense 1pp1', testWithBrowser('compatibility', async (t, browser) => {
      const settingsPage = await browser.newPage(t, TestUrls.extensionSettings('flowcrypt.compatibility@gmail.com'));
      await SettingsPageRecipe.verifyMyKeyPage(settingsPage, 'flowcrypt.compatibility.1pp1', 'button');
    }));

    ava.default('settings - test pass phrase', testWithBrowser('compatibility', async (t, browser) => {
      const settingsPage = await browser.newPage(t, TestUrls.extensionSettings('flowcrypt.compatibility@gmail.com'));
      await SettingsPageRecipe.passphraseTest(settingsPage, Config.key('flowcrypt.wrong.passphrase').passphrase, false);
      await SettingsPageRecipe.passphraseTest(settingsPage, Config.key('flowcrypt.compatibility.1pp1').passphrase, true);
    }));

    ava.todo('settings - verify 2pp1 key presense');
    // await tests.settings_my_key_tests(settingsPage, 'flowcrypt.compatibility.2pp1', 'link');

    ava.default('settings - feedback form', testWithBrowser('compatibility', async (t, browser) => {
      const settingsPage = await browser.newPage(t, TestUrls.extensionSettings('flowcrypt.compatibility@gmail.com'));
      await settingsPage.waitAndClick('@action-open-modules-help');
      await settingsPage.waitAll('@dialog');
      const helpFrame = await settingsPage.getFrame(['help.htm']);
      await helpFrame.waitAndType('@input-feedback-message', 'automated puppeteer test: help form from settings footer');
      await helpFrame.waitAndClick('@action-feedback-send');
      await helpFrame.waitAndRespondToModal('info', 'confirm', 'Message sent!');
    }));

    ava.default('settings - view contact public key', testWithBrowser('compatibility', async (t, browser) => {
      const settingsPage = await browser.newPage(t, TestUrls.extensionSettings('flowcrypt.compatibility@gmail.com'));
      await SettingsPageRecipe.toggleScreen(settingsPage, 'additional');
      const contactsFrame = await SettingsPageRecipe.awaitNewPageFrame(settingsPage, '@action-open-contacts-page', ['contacts.htm', 'placement=settings']);
      await contactsFrame.waitAll('@page-contacts');
      await Util.sleep(1);
      await contactsFrame.waitAndClick('@action-show-email-flowcryptcompatibilitygmailcom');
      await Util.sleep(1);
      const contacts = await contactsFrame.read('@page-contacts');
      expect(contacts).to.contain('openpgp - active - 5520 CACE 2CB6 1EA7 13E5 B005 7FDE 6855 48AE A788');
      expect(contacts).to.contain('openpgp - active - E8F0 517B A6D7 DAB6 081C 96E4 ADAC 279C 9509 3207');
      await contactsFrame.waitAndClick('@action-show-pubkey-5520CACE2CB61EA713E5B0057FDE685548AEA788-openpgp', { confirmGone: true });
      const contacts1 = await contactsFrame.read('@page-contacts');
      expect(contacts1).to.contain('7FDE 6855 48AE A788');
      expect(contacts1).to.contain('flowcrypt.compatibility@gmail.com');
      expect(contacts1).to.contain('-----BEGIN PGP PUBLIC KEY BLOCK-----');
      await contactsFrame.waitAndClick('@action-back-to-contact-list', { confirmGone: true });
      await Util.sleep(1);
      expect(await contactsFrame.read('@page-contacts')).to.contain('flowcrypt.compatibility@gmail.com');
      expect(await contactsFrame.read('@page-contacts')).to.contain('flowcryptcompatibility@gmail.com');
      await SettingsPageRecipe.closeDialog(settingsPage);
      await SettingsPageRecipe.toggleScreen(settingsPage, 'basic');
    }));

    ava.default('settings - update contact public key', testWithBrowser('ci.tests.gmail', async (t, browser) => {
      const recipientEmail = 'has.older.key.on.attester@recipient.com';
      // add a newer expired key manually
      const settingsPage = await browser.newPage(t, TestUrls.extensionSettings('ci.tests.gmail@flowcrypt.test'));
      await SettingsPageRecipe.toggleScreen(settingsPage, 'additional');
      const contactsFrame = await SettingsPageRecipe.awaitNewPageFrame(settingsPage, '@action-open-contacts-page', ['contacts.htm', 'placement=settings']);
      await contactsFrame.waitAll('@page-contacts');
      await contactsFrame.waitAndClick('@action-show-import-public-keys-form', { confirmGone: true });
      await contactsFrame.waitAndType('@input-bulk-public-keys', testConstants.oldHasOlderKeyOnAttester);
      await contactsFrame.waitAndClick('@action-show-parsed-public-keys', { confirmGone: true });
      await contactsFrame.waitAll('iframe');
      const pubkeyFrame = await contactsFrame.getFrame(['pgp_pubkey.htm']);
      await pubkeyFrame.waitForContent('@action-add-contact', 'IMPORT EXPIRED KEY');
      await pubkeyFrame.waitAndClick('@action-add-contact');
      await pubkeyFrame.waitForContent('@container-pgp-pubkey', `${recipientEmail} added`);
      await contactsFrame.waitAndClick('@action-back-to-contact-list', { confirmGone: true });
      await contactsFrame.waitAndClick(`@action-show-email-${recipientEmail.replace(/[^a-z0-9]+/g, '')}`);
      await contactsFrame.waitForContent('@page-contacts', 'openpgp - expired - 8EC7 8F04 3CEB 0224 98AF D477 1E62 ED6D 15A2 5921');
      await contactsFrame.waitAndClick(`@action-show-pubkey-8EC78F043CEB022498AFD4771E62ED6D15A25921-openpgp`, { confirmGone: true });
      await contactsFrame.waitForContent('@container-pubkey-details', 'Fingerprint: 8EC7 8F04 3CEB 0224 98AF D477 1E62 ED6D 15A2 5921');
      await contactsFrame.waitForContent('@container-pubkey-details', 'Created on: Thu Jul 16 2020 09:56:40');
      await contactsFrame.waitForContent('@container-pubkey-details', 'Expiration: Thu Jul 16 2020 09:56:42');
      await contactsFrame.waitForContent('@container-pubkey-details', 'Expired: yes');
      await contactsFrame.waitAndClick('@action-back-to-contact-list', { confirmGone: true });
      await contactsFrame.waitAndClick(`@action-show-email-${recipientEmail.replace(/[^a-z0-9]+/g, '')}`);
      await contactsFrame.waitAndClick('@action-change-pubkey-8EC78F043CEB022498AFD4771E62ED6D15A25921-openpgp', { confirmGone: true });
      await contactsFrame.waitAndType('@input-public-key', testConstants.newHasOlderKeyOnAttester);
      await contactsFrame.waitAndClick('@action-save-public-key', { confirmGone: true });
      await contactsFrame.waitAndClick(`@action-show-email-${recipientEmail.replace(/[^a-z0-9]+/g, '')}`);
      await contactsFrame.waitForContent('@page-contacts', 'openpgp - expired - 8EC7 8F04 3CEB 0224 98AF D477 1E62 ED6D 15A2 5921');
      await contactsFrame.waitAndClick(`@action-show-pubkey-8EC78F043CEB022498AFD4771E62ED6D15A25921-openpgp`, { confirmGone: true });
      await contactsFrame.waitForContent('@container-pubkey-details', 'Fingerprint: 8EC7 8F04 3CEB 0224 98AF D477 1E62 ED6D 15A2 5921');
      await contactsFrame.waitForContent('@container-pubkey-details', 'Created on: Thu Jul 16 2020 09:56:40');
      await contactsFrame.waitForContent('@container-pubkey-details', 'Expiration: Thu Jul 16 2020 09:57:40');
      await contactsFrame.waitForContent('@container-pubkey-details', 'Expired: yes');
    }));

    ava.default('settings - remove public keys from contact', testWithBrowser('compatibility', async (t, browser) => {
      const dbPage = await browser.newPage(t, TestUrls.extension('chrome/dev/ci_unit_test.htm'));
      const foundKeys = await dbPage.page.evaluate(async () => {
        const db = await (window as any).ContactStore.dbOpen();
        // first, unlink pubkeys from `flowcrypt.compatibility@gmail.com',
        // so they remain linked only to `flowcryptcompatibility@gmail.com'
        await (window as any).ContactStore.unlinkPubkey(db, 'flowcrypt.compatibility@gmail.com', { id: '5520CACE2CB61EA713E5B0057FDE685548AEA788', type: 'openpgp ' });
        await (window as any).ContactStore.unlinkPubkey(db, 'flowcrypt.compatibility@gmail.com', { id: 'E8F0517BA6D7DAB6081C96E4ADAC279C95093207', type: 'openpgp ' });
        const pubkey7FDE685548AEA788: Pubkey = await new Promise((resolve, reject) => {
          const tx = db.transaction(['pubkeys'], 'readonly');
          const req = tx.objectStore('pubkeys').get('5520CACE2CB61EA713E5B0057FDE685548AEA788');
          (window as any).ContactStore.setReqPipe(req, resolve, reject);
        });
        const pubkeyADAC279C95093207: Pubkey = await new Promise((resolve, reject) => {
          const tx = db.transaction(['pubkeys'], 'readonly');
          const req = tx.objectStore('pubkeys').get('E8F0517BA6D7DAB6081C96E4ADAC279C95093207');
          (window as any).ContactStore.setReqPipe(req, resolve, reject);
        });
        const contactsSize: number = (await (window as any).ContactStore.search(db, { hasPgp: true, substring: 'flowcrypt' })).length;
        return { pubkey7FDE685548AEA788, pubkeyADAC279C95093207, contactsSize };
      });
      expect(foundKeys.contactsSize).to.equal(1);
      expect(foundKeys.pubkey7FDE685548AEA788.fingerprint).to.equal('5520CACE2CB61EA713E5B0057FDE685548AEA788');
      expect(foundKeys.pubkeyADAC279C95093207.fingerprint).to.equal('E8F0517BA6D7DAB6081C96E4ADAC279C95093207');
      const settingsPage = await browser.newPage(t, TestUrls.extensionSettings('flowcrypt.compatibility@gmail.com'));
      await SettingsPageRecipe.toggleScreen(settingsPage, 'additional');
      const contactsFrame = await SettingsPageRecipe.awaitNewPageFrame(settingsPage, '@action-open-contacts-page', ['contacts.htm', 'placement=settings']);
      await contactsFrame.waitAll('@page-contacts');
      await Util.sleep(1);
      await contactsFrame.waitAndClick('@action-show-email-flowcryptcompatibilitygmailcom');
      await Util.sleep(1);
      const contacts = await contactsFrame.read('@page-contacts');
      expect(contacts).to.contain('openpgp - active - 5520 CACE 2CB6 1EA7 13E5 B005 7FDE 6855 48AE A788');
      expect(contacts).to.contain('openpgp - active - E8F0 517B A6D7 DAB6 081C 96E4 ADAC 279C 9509 3207');
      await contactsFrame.waitAndClick('@action-remove-pubkey-5520CACE2CB61EA713E5B0057FDE685548AEA788-openpgp', { confirmGone: true });
      await contactsFrame.waitAll('@page-contacts');
      await Util.sleep(1);
      const foundKeys1 = await dbPage.page.evaluate(async () => {
        const db = await (window as any).ContactStore.dbOpen();
        const pubkey7FDE685548AEA788: Pubkey = await new Promise((resolve, reject) => {
          const tx = db.transaction(['pubkeys'], 'readonly');
          const req = tx.objectStore('pubkeys').get('5520CACE2CB61EA713E5B0057FDE685548AEA788');
          (window as any).ContactStore.setReqPipe(req, resolve, reject);
        });
        const pubkeyADAC279C95093207: Pubkey = await new Promise((resolve, reject) => {
          const tx = db.transaction(['pubkeys'], 'readonly');
          const req = tx.objectStore('pubkeys').get('E8F0517BA6D7DAB6081C96E4ADAC279C95093207');
          (window as any).ContactStore.setReqPipe(req, resolve, reject);
        });
        const contactsSize: number = (await (window as any).ContactStore.search(db, { hasPgp: true, substring: 'flowcrypt' })).length;
        return { pubkey7FDE685548AEA788, pubkeyADAC279C95093207, contactsSize };
      });
      expect(foundKeys1.contactsSize).to.equal(1);
      expect(foundKeys1.pubkey7FDE685548AEA788).to.be.an('undefined');
      expect(foundKeys1.pubkeyADAC279C95093207.fingerprint).to.equal('E8F0517BA6D7DAB6081C96E4ADAC279C95093207');
      await contactsFrame.waitAndClick('@action-show-email-flowcryptcompatibilitygmailcom');
      await Util.sleep(1);
      const contacts1 = await contactsFrame.read('@page-contacts');
      expect(contacts1).to.not.contain('openpgp - active - 5520 CACE 2CB6 1EA7 13E5 B005 7FDE 6855 48AE A788');
      expect(contacts1).to.contain('openpgp - active - E8F0 517B A6D7 DAB6 081C 96E4 ADAC 279C 9509 3207');
      await contactsFrame.waitAndClick('@action-remove-pubkey-E8F0517BA6D7DAB6081C96E4ADAC279C95093207-openpgp', { confirmGone: true });
      await contactsFrame.waitAll('@page-contacts');
      await Util.sleep(1);
      const foundKeys2 = await dbPage.page.evaluate(async () => {
        const db = await (window as any).ContactStore.dbOpen();
        const pubkey7FDE685548AEA788: Pubkey = await new Promise((resolve, reject) => {
          const tx = db.transaction(['pubkeys'], 'readonly');
          const req = tx.objectStore('pubkeys').get('5520CACE2CB61EA713E5B0057FDE685548AEA788');
          (window as any).ContactStore.setReqPipe(req, resolve, reject);
        });
        const pubkeyADAC279C95093207: Pubkey = await new Promise((resolve, reject) => {
          const tx = db.transaction(['pubkeys'], 'readonly');
          const req = tx.objectStore('pubkeys').get('E8F0517BA6D7DAB6081C96E4ADAC279C95093207');
          (window as any).ContactStore.setReqPipe(req, resolve, reject);
        });
        const contactsSize: number = (await (window as any).ContactStore.search(db, { hasPgp: true, substring: 'flowcrypt' })).length;
        return { pubkey7FDE685548AEA788, pubkeyADAC279C95093207, contactsSize };
      });
      expect(foundKeys2.contactsSize).to.equal(0);
      expect(foundKeys2.pubkey7FDE685548AEA788).to.be.an('undefined');
      expect(foundKeys2.pubkeyADAC279C95093207).to.be.an('undefined');
      await contactsFrame.waitTillGone('@action-show-email-flowcryptcompatibilitygmailcom');
      await SettingsPageRecipe.closeDialog(settingsPage);
      await SettingsPageRecipe.toggleScreen(settingsPage, 'basic');
      await dbPage.close();
    }));

    ava.default('settings - my key page - primary + secondary', testWithBrowser('compatibility', async (t, browser) => {
      const settingsPage = await browser.newPage(t, TestUrls.extensionSettings('flowcrypt.compatibility@gmail.com'));
      await SettingsPageRecipe.verifyMyKeyPage(settingsPage, 'flowcrypt.compatibility.1pp1', 'link', 0);
      await SettingsPageRecipe.verifyMyKeyPage(settingsPage, 'flowcrypt.compatibility.2pp1', 'link', 1);
    }));

    ava.default('settings - my key page - remove key', testWithBrowser('compatibility', async (t, browser) => {
      const settingsPage = await browser.newPage(t, TestUrls.extensionSettings('flowcrypt.compatibility@gmail.com'));
      await SettingsPageRecipe.ready(settingsPage);
      await SettingsPageRecipe.toggleScreen(settingsPage, 'additional');
      await settingsPage.waitAll('@action-open-add-key-page');
      await settingsPage.waitAndClick('@action-remove-key');
      await settingsPage.page.waitForNavigation({ waitUntil: 'networkidle0' });
      await Util.sleep(1);
      await settingsPage.waitAll('@action-open-add-key-page');
      await settingsPage.notPresent('@action-remove-key');
    }));

    ava.default('settings - my key page - remove button should be hidden when using key manager', testWithBrowser(undefined, async (t, browser) => {
      const acct = 'two.keys@key-manager-autogen.flowcrypt.test';
      const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acct);
      await SetupPageRecipe.autoKeygen(settingsPage);
      await SettingsPageRecipe.toggleScreen(settingsPage, 'additional');
      // check imported key at index 1
      const myKeyFrame = await SettingsPageRecipe.awaitNewPageFrame(settingsPage, `@action-show-key-1`, ['my_key.htm', 'placement=settings']);
      await Util.sleep(1);
      await myKeyFrame.waitAll('@content-fingerprint');
      await settingsPage.notPresent('@action-remove-key');
    }));

    ava.todo('settings - edit contact public key');

    ava.default('settings - change passphrase - current in local storage', testWithBrowser(undefined, async (t, browser) => {
      const { acctEmail, settingsPage } = await BrowserRecipe.setUpFcPpChangeAcct(t, browser);
      const newPp = `temp ci test pp: ${Util.lousyRandom()}`;
      await SettingsPageRecipe.changePassphrase(settingsPage, undefined, newPp); // change pp and test
      await InboxPageRecipe.checkDecryptMsg(t, browser, { acctEmail, threadId: '16819bec18d4e011', expectedContent: 'changed correctly if this can be decrypted' });
    }));

    ava.default('settings - change passphrase - current in session known', testWithBrowser(undefined, async (t, browser) => {
      const { acctEmail, passphrase, settingsPage } = await BrowserRecipe.setUpFcPpChangeAcct(t, browser);
      const newPp = `temp ci test pp: ${Util.lousyRandom()}`;
      await SettingsPageRecipe.forgetAllPassPhrasesInStorage(settingsPage, passphrase);
      // decrypt msg and enter pp so that it's remembered in session
      await InboxPageRecipe.checkDecryptMsg(t, browser, {
        acctEmail, threadId: '16819bec18d4e011',
        enterPp: {
          passphrase,
          isForgetPpChecked: true,
          isForgetPpDisabled: false
        },
        expectedContent: 'changed correctly if this can be decrypted',
      });
      // change pp - should not ask for pp because already in session
      await SettingsPageRecipe.changePassphrase(settingsPage, undefined, newPp);
      // now it will remember the pass phrase so decrypts without asking
      await InboxPageRecipe.checkDecryptMsg(t, browser, { acctEmail, threadId: '16819bec18d4e011', expectedContent: 'changed correctly if this can be decrypted' });
      // test decrypt - should ask for new pass phrase
      await InboxPageRecipe.checkDecryptMsg(t, browser, {
        acctEmail, threadId: '16819bec18d4e011',
        finishCurrentSession: true,
        enterPp: {
          passphrase: newPp,
          isForgetPpChecked: true,
          isForgetPpDisabled: false
        },
        expectedContent: 'changed correctly if this can be decrypted'
      });
    }));

    ava.default('settings - change passphrase honoring FORBID_STORING_PASS_PHRASE OrgRule', testWithBrowser(undefined, async (t, browser) => {
      const acctEmail = 'user@forbid-storing-passphrase-org-rule.flowcrypt.test';
      const { settingsPage, passphrase } = await BrowserRecipe.setUpFcForbidPpStoringAcct(t, browser);
      const { cryptup_userforbidstoringpassphraseorgruleflowcrypttest_passphrase_B8F687BCDE14435A: savedPassphrase1,
        cryptup_userforbidstoringpassphraseorgruleflowcrypttest_keys: keys }
        = await settingsPage.getFromLocalStorage(['cryptup_userforbidstoringpassphraseorgruleflowcrypttest_passphrase_B8F687BCDE14435A',
          'cryptup_userforbidstoringpassphraseorgruleflowcrypttest_keys']);
      expect((keys as KeyInfo[])[0].longid).to.equal('B8F687BCDE14435A');
      expect(savedPassphrase1).to.be.an('undefined');
      const newPp = `temp ci test pp: ${Util.lousyRandom()}`;
      // decrypt msg, enter pp and make sure it's not stored to the local storage
      await InboxPageRecipe.checkDecryptMsg(t, browser, {
        acctEmail,
        threadId: '179f6feb575df213',
        finishCurrentSession: true,
        enterPp: { passphrase, isForgetPpDisabled: true, isForgetPpChecked: true },
        expectedContent: 'changed correctly if this can be decrypted'
      });
      const { cryptup_userforbidstoringpassphraseorgruleflowcrypttest_passphrase_B8F687BCDE14435A: savedPassphrase2 }
        = await settingsPage.getFromLocalStorage(['cryptup_userforbidstoringpassphraseorgruleflowcrypttest_passphrase_B8F687BCDE14435A']);
      expect(savedPassphrase2).to.be.an('undefined');
      // change pp - should not ask for pp because already in session
      await SettingsPageRecipe.changePassphrase(settingsPage, undefined, newPp);
      const { cryptup_userforbidstoringpassphraseorgruleflowcrypttest_passphrase_B8F687BCDE14435A: savedPassphrase3 }
        = await settingsPage.getFromLocalStorage(['cryptup_userforbidstoringpassphraseorgruleflowcrypttest_passphrase_B8F687BCDE14435A']);
      expect(savedPassphrase3).to.be.an('undefined');
      // test decrypt - should not ask for pp because already in session
      await InboxPageRecipe.checkDecryptMsg(t, browser, {
        acctEmail, threadId: '179f6feb575df213', expectedContent: 'changed correctly if this can be decrypted'
      });
      // test decrypt - should ask for new pass phrase
      await InboxPageRecipe.checkDecryptMsg(t, browser, {
        acctEmail,
        threadId: '179f6feb575df213',
        finishCurrentSession: true,
        enterPp: { passphrase: newPp, isForgetPpDisabled: true, isForgetPpChecked: true },
        expectedContent: 'changed correctly if this can be decrypted'
      });
    }));

    ava.default('settings - change passphrase - current in session unknown', testWithBrowser(undefined, async (t, browser) => {
      const { acctEmail, passphrase, settingsPage } = await BrowserRecipe.setUpFcPpChangeAcct(t, browser);
      const newPp = `temp ci test pp: ${Util.lousyRandom()}`;
      await SettingsPageRecipe.forgetAllPassPhrasesInStorage(settingsPage, passphrase);
      // pp wiped after switching to session - should be needed to change pp
      await SettingsPageRecipe.changePassphrase(settingsPage, passphrase, newPp);
      // now it will remember the pass phrase so decrypts without asking
      await InboxPageRecipe.checkDecryptMsg(t, browser, { acctEmail, threadId: '16819bec18d4e011', expectedContent: 'changed correctly if this can be decrypted' });
      // test decrypt - should ask for new pass phrase
      await InboxPageRecipe.checkDecryptMsg(t, browser, {
        acctEmail, threadId: '16819bec18d4e011',
        expectedContent: 'changed correctly if this can be decrypted', finishCurrentSession: true,
        enterPp: { passphrase: newPp, isForgetPpChecked: true, isForgetPpDisabled: false }
      });
    }));

    ava.default('settings - Catch.reportErr reports an error', testWithBrowser('compatibility', async (t, browser) => {
      const settingsPage = await browser.newPage(t, TestUrls.extensionSettings('flowcrypt.compatibility@gmail.com'));
      await SettingsPageRecipe.toggleScreen(settingsPage, 'additional');
      const experimentalFrame = await SettingsPageRecipe.awaitNewPageFrame(settingsPage, '@action-open-module-experimental', ['experimental.htm']);
      await experimentalFrame.waitAndClick('@action-throw-err'); // mock tests will verify that err was reported to mock backend in `test.ts`
      internalTestState.expectIntentionalErrReport = true;
    }));

    ava.default('settings - attachment previews are rendered according to their types', testWithBrowser('compatibility', async (t, browser) => {
      const inboxPage = await browser.newPage(t, TestUrls.extension(`chrome/settings/inbox/inbox.htm?acctEmail=flowcrypt.compatibility@gmail.com&threadId=174ab0ba9643b4fa`));
      // image
      const attachmentImage = await inboxPage.getFrame(['attachment.htm', 'name=tiny-face.png']);
      await attachmentImage.waitForSelTestState('ready');
      await attachmentImage.click('body');
      const attachmentPreviewImage = await inboxPage.getFrame(['attachment_preview.htm']);
      await attachmentPreviewImage.waitAll('#attachment-preview-container img.attachment-preview-img');
      await inboxPage.press('Escape');
      // text
      const attachmentText = await inboxPage.getFrame(['attachment.htm', 'name=small.txt']);
      await attachmentText.waitForSelTestState('ready');
      await attachmentText.click('body');
      const attachmentPreviewText = await inboxPage.getFrame(['attachment_preview.htm']);
      await attachmentPreviewText.waitForContent('#attachment-preview-container .attachment-preview-txt', 'small text file');
      await inboxPage.press('Escape');
      // pdf
      const attachmentPdf = await inboxPage.getFrame(['attachment.htm', 'name=small.pdf']);
      await attachmentPdf.waitForSelTestState('ready');
      await attachmentPdf.click('body');
      const attachmentPreviewPdf = await inboxPage.getFrame(['attachment_preview.htm']);
      await attachmentPreviewPdf.waitAll('#attachment-preview-container.attachment-preview-pdf .attachment-preview-pdf-page');
      await inboxPage.press('Escape');
      // no preview
      const attachmentOther = await inboxPage.getFrame(['attachment.htm', 'name=unknown']);
      await attachmentOther.waitForSelTestState('ready');
      await attachmentOther.click('body');
      const attachmentPreviewOther = await inboxPage.getFrame(['attachment_preview.htm']);
      await attachmentPreviewOther.waitForContent('#attachment-preview-container .attachment-preview-unavailable', 'No preview available');
      await attachmentPreviewOther.waitAll('#attachment-preview-container .attachment-preview-unavailable #attachment-preview-download');
    }));

    ava.default('settings - attachment previews with entering pass phrase', testWithBrowser('compatibility', async (t, browser) => {
      const settingsPage = await browser.newPage(t, TestUrls.extensionSettings('flowcrypt.compatibility@gmail.com'));
      const k = Config.key('flowcrypt.compatibility.1pp1');
      await SettingsPageRecipe.forgetAllPassPhrasesInStorage(settingsPage, k.passphrase);
      const inboxPage = await browser.newPage(t, TestUrls.extension(`chrome/settings/inbox/inbox.htm?acctEmail=flowcrypt.compatibility@gmail.com&threadId=174ab0ba9643b4fa`));
      const attachmentImage = await inboxPage.getFrame(['attachment.htm', 'name=tiny-face.png']);
      await attachmentImage.waitForSelTestState('ready');
      await attachmentImage.click('body');
      const passphraseDialog = await inboxPage.getFrame(['passphrase.htm']);
      await passphraseDialog.waitAndType('@input-pass-phrase', k.passphrase);
      await passphraseDialog.waitAndClick('@action-confirm-pass-phrase-entry');
      const attachmentPreviewImage = await inboxPage.getFrame(['attachment_preview.htm']);
      await attachmentPreviewImage.waitAll('#attachment-preview-container img.attachment-preview-img');
    }));

    ava.default('settings - pgp/mime preview and download attachment', testWithBrowser('compatibility', async (t, browser) => {
      const downloadedAttachmentFilename = `${__dirname}/7 years.jpeg`;
      Util.deleteFileIfExists(downloadedAttachmentFilename);
      const inboxPage = await browser.newPage(t, TestUrls.extension(`chrome/settings/inbox/inbox.htm?acctEmail=flowcrypt.compatibility@gmail.com&threadId=16e8b01f136c3d28`));
      const pgpBlockFrame = await inboxPage.getFrame(['pgp_block.htm']);
      // check if download is awailable
      await pgpBlockFrame.waitAll('.download-attachment');
      // and preview
      await pgpBlockFrame.waitAndClick('.preview-attachment');
      const attachmentPreviewImage = await inboxPage.getFrame(['attachment_preview.htm']);
      await attachmentPreviewImage.waitAll('#attachment-preview-container img.attachment-preview-img');
      // @ts-ignore
      await (inboxPage.target as Page)._client.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: __dirname });
      await attachmentPreviewImage.waitAndClick('@attachment-preview-download');
      await Util.sleep(1);
      expect(fs.existsSync(downloadedAttachmentFilename)).to.be.true; // tslint:disable-line:no-unused-expression
      Util.deleteFileIfExists(downloadedAttachmentFilename);
    }));

    ava.default('settings - add unprotected key', testWithBrowser('ci.tests.gmail', async (t, browser) => {
      await SettingsPageRecipe.addKeyTest(t, browser, 'ci.tests.gmail@flowcrypt.test', testConstants.unprotectedPrvKey, 'this is a new passphrase to protect previously unprotected key');
    }));

    ava.default('settings - error modal when page parameter invalid', testWithBrowser('ci.tests.gmail', async (t, browser) => {
      const invalidParamModalPage = await browser.newPage(t, TestUrls.extension(`chrome/settings/index.htm?acctEmail=ci.tests.gmail@gmail.com&page=invalid`));
      await Util.sleep(3);
      await invalidParamModalPage.waitForContent('.swal2-html-container', 'An unexpected value was found for the page parameter');
    }));

    ava.default('settings - my key page - update non-first private key', testWithBrowser(undefined, async (t, browser) => {
      const acctEmail = 'flowcrypt.test.key.multiple@gmail.com';
      const settingsPage1 = await BrowserRecipe.openSettingsLoginApprove(t, browser, acctEmail);
      await SetupPageRecipe.manualEnter(settingsPage1, 'unused', {
        submitPubkey: false,
        usedPgpBefore: false,
        key: {
          title: '?',
          armored: testConstants.testKeyMultiple1b383d0334e38b28,
          passphrase: '1234',
          longid: '1b383d0334e38b28',
        }
      }, { isSavePassphraseChecked: false, isSavePassphraseDisabled: false });
      await settingsPage1.close();

      await SettingsPageRecipe.addKeyTest(t, browser, acctEmail, testConstants.testKeyMultiple98acfa1eadab5b92, '1234');

      const settingsPage = await browser.newPage(t, TestUrls.extensionSettings(acctEmail));
      await SettingsPageRecipe.toggleScreen(settingsPage, 'additional');
      // open key at index 1
      const myKeyFrame = await SettingsPageRecipe.awaitNewPageFrame(settingsPage, `@action-show-key-1`, ['my_key.htm', 'placement=settings']);
      await Util.sleep(1);
      await myKeyFrame.waitAll('@content-fingerprint');
      await myKeyFrame.waitAndClick('@action-update-prv');
      await myKeyFrame.waitAndType('@input-prv-key', testConstants.testKeyMultiple98acfa1eadab5b92);
      await myKeyFrame.type('@input-passphrase', '1234');
      await myKeyFrame.waitAndClick('@action-update-key');
      await PageRecipe.waitForModalAndRespond(myKeyFrame, 'confirm', { contentToCheck: 'Public and private key updated locally', clickOn: 'cancel' });
      const { cryptup_flowcrypttestkeymultiplegmailcom_passphrase_98ACFA1EADAB5B92: savedPassphrase } =
        await settingsPage.getFromLocalStorage(['cryptup_flowcrypttestkeymultiplegmailcom_passphrase_98ACFA1EADAB5B92']);
      expect(savedPassphrase).to.equal('1234');
      await settingsPage.close();
    }));

    ava.default('settings - manual enter and key update honor FORBID_STORING_PASS_PHRASE OrgRule', testWithBrowser(undefined, async (t, browser) => {
      const { settingsPage, passphrase } = await BrowserRecipe.setUpFcForbidPpStoringAcct(t, browser);
      const { cryptup_userforbidstoringpassphraseorgruleflowcrypttest_passphrase_B8F687BCDE14435A: savedPassphrase1,
        cryptup_userforbidstoringpassphraseorgruleflowcrypttest_keys: keys }
        = await settingsPage.getFromLocalStorage(['cryptup_userforbidstoringpassphraseorgruleflowcrypttest_passphrase_B8F687BCDE14435A',
          'cryptup_userforbidstoringpassphraseorgruleflowcrypttest_keys']);
      expect(savedPassphrase1).to.be.an('undefined');
      expect((keys as KeyInfo[])[0].longid).to.equal('B8F687BCDE14435A');
      await SettingsPageRecipe.toggleScreen(settingsPage, 'additional');
      // open key at index 0
      const myKeyFrame = await SettingsPageRecipe.awaitNewPageFrame(settingsPage, `@action-show-key-0`, ['my_key.htm', 'placement=settings']);
      await Util.sleep(1);
      await myKeyFrame.waitAll('@content-fingerprint');
      await myKeyFrame.waitAndClick('@action-update-prv');
      await myKeyFrame.waitAndType('@input-prv-key', testConstants.testKeyB8F687BCDE14435A);
      await myKeyFrame.type('@input-passphrase', passphrase);
      await myKeyFrame.waitAndClick('@action-update-key');
      await PageRecipe.waitForModalAndRespond(myKeyFrame, 'confirm', { contentToCheck: 'Public and private key updated locally', clickOn: 'cancel' });
      const { cryptup_userforbidstoringpassphraseorgruleflowcrypttest_passphrase_B8F687BCDE14435A: savedPassphrase2 }
        = await settingsPage.getFromLocalStorage(['cryptup_userforbidstoringpassphraseorgruleflowcrypttest_passphrase_B8F687BCDE14435A']);
      expect(savedPassphrase2).to.be.an('undefined');
      await settingsPage.close();
    }));

    ava.default('settings - reauth after uuid change', testWithBrowser('ci.tests.gmail', async (t, browser) => {
      const acct = 'ci.tests.gmail@flowcrypt.test';
      const settingsPage = await browser.newPage(t, TestUrls.extensionSettings(acct));
      await SettingsPageRecipe.toggleScreen(settingsPage, 'additional');
      const experimentalFrame = await SettingsPageRecipe.awaitNewPageFrame(settingsPage, '@action-open-module-experimental', ['experimental.htm']);
      await experimentalFrame.waitAndClick('@action-regenerate-uuid');
      await Util.sleep(2);
      const oauthPopup = await browser.newPageTriggeredBy(t, () => PageRecipe.waitForModalAndRespond(settingsPage, 'confirm',
        { contentToCheck: 'Please log in with FlowCrypt to continue', clickOn: 'confirm' }));
      await OauthPageRecipe.google(t, oauthPopup, acct, 'approve');
      await Util.sleep(5);
      await settingsPage.close();

      const settingsPage1 = await browser.newPage(t, TestUrls.extensionSettings(acct));
      await Util.sleep(10);
      await settingsPage1.notPresent('.swal2-container');
      await settingsPage1.close();
    }));

    ava.default('settings - email change', testWithBrowser('ci.tests.gmail', async (t, browser) => {
      const acct1 = 'ci.tests.gmail@flowcrypt.test';
      const acct2 = 'user@forbid-storing-passphrase-org-rule.flowcrypt.test';
      const settingsPage = await browser.newPage(t, TestUrls.extensionSettings(acct1));
      const { cryptup_citestsgmailflowcrypttest_rules: oldRules, cryptup_citestsgmailflowcrypttest_passphrase_07481C8ACF9D49FE: savedPassphrase1 } =
        await settingsPage.getFromLocalStorage(['cryptup_citestsgmailflowcrypttest_rules', 'cryptup_citestsgmailflowcrypttest_passphrase_07481C8ACF9D49FE']);
      expect(savedPassphrase1).not.to.be.an('undefined');
      expect((oldRules as { flags: string[] }).flags).not.to.include('FORBID_STORING_PASS_PHRASE');
      await SettingsPageRecipe.toggleScreen(settingsPage, 'additional');
      const experimentalFrame = await SettingsPageRecipe.awaitNewPageFrame(settingsPage, '@action-open-module-experimental', ['experimental.htm']);
      await experimentalFrame.waitAndClick('@action-change-email');
      const oauthPopup1 = await browser.newPageTriggeredBy(t, () => PageRecipe.waitForModalAndRespond(experimentalFrame, 'confirm',
        { contentToCheck: 'email address has changed', clickOn: 'confirm' }));
      await OauthPageRecipe.mock(t, oauthPopup1, acct2, 'override_acct');
      await PageRecipe.waitForModalAndRespond(experimentalFrame, 'confirm',
        { contentToCheck: 'email from ci.tests.gmail@flowcrypt.test to user@forbid-storing-passphrase-org-rule.flowcrypt.test', clickOn: 'confirm' });
      const newSettingsPage = await browser.newPageTriggeredBy(t, () => PageRecipe.waitForModalAndRespond(experimentalFrame, 'info',
        { contentToCheck: 'Email address changed to user@forbid-storing-passphrase-org-rule.flowcrypt.test', clickOn: 'confirm' }));
      const oauthPopup2 = await browser.newPageTriggeredBy(t, () => PageRecipe.waitForModalAndRespond(newSettingsPage, 'confirm',
        { contentToCheck: 'Please log in with FlowCrypt to continue', clickOn: 'confirm' }));
      await OauthPageRecipe.mock(t, oauthPopup2, acct2, 'override_acct');
      await Util.sleep(2);
      // await PageRecipe.waitForModalAndRespond(?, 'confirm',
      //   { contentToCheck: 'Your email aliases on Gmail have refreshed since the last time you used FlowCrypt', clickOn: 'confirm' });
      const { cryptup_userforbidstoringpassphraseorgruleflowcrypttest_rules: newRules,
        cryptup_userforbidstoringpassphraseorgruleflowcrypttest_keys: keys } =
        await settingsPage.getFromLocalStorage(['cryptup_userforbidstoringpassphraseorgruleflowcrypttest_rules',
          'cryptup_userforbidstoringpassphraseorgruleflowcrypttest_keys']);
      expect((newRules as { flags: string[] }).flags).to.include('FORBID_STORING_PASS_PHRASE');
      expect((keys as KeyInfo[])[0].longid).to.equal('07481C8ACF9D49FE');
      // todo: should this passphrase be forgotten?
      // const { cryptup_userforbidstoringpassphraseorgruleflowcrypttest_passphrase_07481C8ACF9D49FE: savedPassphrase2 } =
      //   await settingsPage.getFromLocalStorage(['cryptup_userforbidstoringpassphraseorgruleflowcrypttest_passphrase_07481C8ACF9D49FE']);
      // expect(savedPassphrase2).to.be.an('undefined');
      await newSettingsPage.close();
      await settingsPage.close();
    }));

    ava.todo('settings - change passphrase - mismatch curent pp');

    ava.todo('settings - change passphrase - mismatch new pp');

  }

};
