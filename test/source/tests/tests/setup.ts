import { TestWithNewBrowser, TestWithGlobalBrowser } from '../../test';
import { SetupPageRecipe } from '../page_recipe';
import { BrowserRecipe } from '../browser_recipe';
import * as ava from 'ava';
import { TestVariant } from '../../util';

// tslint:disable:no-blank-lines-func

export const defineSetupTests = (testVariant: TestVariant, testWithNewBrowser: TestWithNewBrowser, testWithSemaphoredGlobalBrowser: TestWithGlobalBrowser) => {

  if (testVariant !== 'CONSUMER-LIVE-GMAIL') {

    ava.todo('setup - no connection when pulling backup - retry prompt shows and works');

    ava.todo('setup - simple - no connection when making a backup - retry prompt shows');

    ava.todo('setup - advanced - no connection when making a backup - retry prompt shows');

    ava.todo('setup - no connection when submitting public key - retry prompt shows and works');

    ava.default('[standalone] settings > login > close oauth window > close popup', testWithNewBrowser(async (t, browser) => {
      await BrowserRecipe.openSettingsLoginButCloseOauthWindowBeforeGrantingPermission(t, browser, 'flowcrypt.test.key.imported@gmail.com');
    }));

    ava.default('[standalone] setup - import key - do not submit - did not use before', testWithNewBrowser(async (t, browser) => {
      const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, 'flowcrypt.test.key.imported@gmail.com');
      await SetupPageRecipe.manualEnter(settingsPage, 'flowcrypt.test.key.used.pgp', { submitPubkey: false, usedPgpBefore: false });
    }));

    ava.default('[standalone] setup - import key - submit - used before', testWithNewBrowser(async (t, browser) => {
      const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, 'flowcrypt.test.key.used.pgp@gmail.com');
      await SetupPageRecipe.manualEnter(settingsPage, 'flowcrypt.test.key.used.pgp', { submitPubkey: true, usedPgpBefore: true });
    }));

    ava.default('[standalone] setup - import key - naked - choose my own pass phrase', testWithNewBrowser(async (t, browser) => {
      const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, 'flowcrypt.test.key.import.naked@gmail.com');
      await SetupPageRecipe.manualEnter(settingsPage, 'flowcrypt.test.key.naked', { submitPubkey: false, usedPgpBefore: false, naked: true });
    }));

    ava.default('[standalone] setup - import key - naked - auto-generate a pass phrase', testWithNewBrowser(async (t, browser) => {
      const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, 'flowcrypt.test.key.import.naked@gmail.com');
      await SetupPageRecipe.manualEnter(settingsPage, 'flowcrypt.test.key.naked', { submitPubkey: false, usedPgpBefore: false, naked: true, genPp: true });
    }));

    ava.todo('[standalone] setup - import key - naked - do not supply pass phrase gets error');

    ava.default('[standalone] setup - import key - fix key self signatures', testWithNewBrowser(async (t, browser) => {
      const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, 'flowcrypt.test.key.imported@gmail.com');
      await SetupPageRecipe.manualEnter(settingsPage, 'missing.self.signatures', { submitPubkey: false, fixKey: true });
    }));

    ava.default('[standalone] setup - import key - fix key self signatures - skip invalid uid', testWithNewBrowser(async (t, browser) => {
      const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, 'flowcrypt.test.key.imported@gmail.com');
      await SetupPageRecipe.manualEnter(settingsPage, 'missing.self.signatures.invalid.uid', { submitPubkey: false, fixKey: true });
    }));

    ava.todo('[standalone] setup - create key advanced - do not remember pass phrase');

    ava.todo('[standalone] setup - create key advanced - backup as a file');

    ava.todo('[standalone] setup - create key simple');

    ava.default('[standalone] setup - create key advanced - no backup', testWithNewBrowser(async (t, browser) => {
      const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, 'flowcrypt.test.key.new.manual@gmail.com');
      await SetupPageRecipe.createAdvanced(settingsPage, 'flowcrypt.test.key.used.pgp', 'none', { submitPubkey: false, usedPgpBefore: true });
    }));

    ava.default.only('[standalone] setup - craete key- backup as file', testWithNewBrowser(async (t, browser) => {
      const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, 'flowcrypt.test.key.new.manual@gmail.com');
      await SetupPageRecipe.createAdvanced(settingsPage, 'flowcrypt.test.key.used.pgp', 'file', { submitPubkey: false, usedPgpBefore: true });
    }));

    ava.default('[standalone] setup - recover with a pass phrase - skip remaining', testWithNewBrowser(async (t, browser) => {
      const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, 'flowcrypt.compatibility@gmail.com');
      await SetupPageRecipe.recover(settingsPage, 'flowcrypt.compatibility.1pp1', { hasRecoverMore: true, clickRecoverMore: false });
    }));

    ava.default('[standalone] setup - recover with a pass phrase - 1pp1 then 2pp1', testWithNewBrowser(async (t, browser) => {
      const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, 'flowcrypt.compatibility@gmail.com');
      await SetupPageRecipe.recover(settingsPage, 'flowcrypt.compatibility.1pp1', { hasRecoverMore: true, clickRecoverMore: true });
      await SetupPageRecipe.recover(settingsPage, 'flowcrypt.compatibility.2pp1');
    }));

    ava.default('setup - recover with a pass phrase - 1pp2 then 2pp1', testWithNewBrowser(async (t, browser) => {
      const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, 'flowcrypt.compatibility@gmail.com');
      await SetupPageRecipe.recover(settingsPage, 'flowcrypt.compatibility.1pp2', { hasRecoverMore: true, clickRecoverMore: true });
      await SetupPageRecipe.recover(settingsPage, 'flowcrypt.compatibility.2pp1');
    }));

    ava.default('[standalone] setup - recover with a pass phrase - 2pp1 then 1pp1', testWithNewBrowser(async (t, browser) => {
      const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, 'flowcrypt.compatibility@gmail.com');
      await SetupPageRecipe.recover(settingsPage, 'flowcrypt.compatibility.2pp1', { hasRecoverMore: true, clickRecoverMore: true });
      await SetupPageRecipe.recover(settingsPage, 'flowcrypt.compatibility.1pp1');
    }));

    ava.default('[standalone] setup - recover with a pass phrase - 2pp1 then 1pp2', testWithNewBrowser(async (t, browser) => {
      const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, 'flowcrypt.compatibility@gmail.com');
      await SetupPageRecipe.recover(settingsPage, 'flowcrypt.compatibility.2pp1', { hasRecoverMore: true, clickRecoverMore: true });
      await SetupPageRecipe.recover(settingsPage, 'flowcrypt.compatibility.1pp2');
    }));

    ava.default('[standalone] setup - recover with a pass phrase - 1pp1 then 1pp2 (shows already recovered), then 2pp1', testWithNewBrowser(async (t, browser) => {
      const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, 'flowcrypt.compatibility@gmail.com');
      await SetupPageRecipe.recover(settingsPage, 'flowcrypt.compatibility.1pp1', { hasRecoverMore: true, clickRecoverMore: true });
      await SetupPageRecipe.recover(settingsPage, 'flowcrypt.compatibility.1pp2', { alreadyRecovered: true });
      await SetupPageRecipe.recover(settingsPage, 'flowcrypt.compatibility.2pp1', {});
    }));

    ava.todo('[standalone] setup - recover with a pass phrase - 1pp1 then wrong, then skip');
    // ava.default('setup - recover with a pass phrase - 1pp1 then wrong, then skip', test_with_browser(async (t, browser) => {
    //   const settingsPage = await BrowserRecipe.open_settings_login_approve(t, browser,'flowcrypt.compatibility@gmail.com');
    //   await SetupPageRecipe.setup_recover(settingsPage, 'flowcrypt.compatibility.1pp1', {has_recover_more: true, click_recover_more: true});
    //   await SetupPageRecipe.setup_recover(settingsPage, 'flowcrypt.wrong.passphrase', {wrong_passphrase: true});
    //   await Util.sleep(200);
    // }));

    ava.default('[standalone] setup - recover with a pass phrase - no remaining', testWithNewBrowser(async (t, browser) => {
      const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, 'flowcrypt.test.key.recovered@gmail.com');
      await SetupPageRecipe.recover(settingsPage, 'flowcrypt.test.key.recovered', { hasRecoverMore: false });
    }));

    ava.default('[standalone] setup - fail to recover with a wrong pass phrase', testWithNewBrowser(async (t, browser) => {
      const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, 'flowcrypt.test.key.recovered@gmail.com');
      await SetupPageRecipe.recover(settingsPage, 'flowcrypt.wrong.passphrase', { hasRecoverMore: false, wrongPp: true });
    }));

    ava.default('[standalone] setup - fail to recover with a wrong pass phrase at first, then recover with good pass phrase', testWithNewBrowser(async (t, browser) => {
      const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, 'flowcrypt.test.key.recovered@gmail.com');
      await SetupPageRecipe.recover(settingsPage, 'flowcrypt.wrong.passphrase', { wrongPp: true });
      await SetupPageRecipe.recover(settingsPage, 'flowcrypt.test.key.recovered');
    }));

    ava.default('[standalone] setup - import key - submit - offline - retry', testWithNewBrowser(async (t, browser) => {
      const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, 'flowcrypt.test.key.used.pgp@gmail.com');
      await SetupPageRecipe.manualEnter(settingsPage, 'flowcrypt.test.key.used.pgp', { submitPubkey: true, usedPgpBefore: true, simulateRetryOffline: true });
    }));

  }

};
