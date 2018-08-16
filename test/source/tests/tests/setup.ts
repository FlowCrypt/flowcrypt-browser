import {TestWithBrowser} from '..';
import {PageRecipe} from '../page_recipe';
import {BrowserRecipe} from '../browser_recipe';
import * as ava from 'ava';

export let define_setup_tests = (test_with_browser: TestWithBrowser, test_with_semaphored_global_browser: TestWithBrowser) => {

  ava.test.todo('setup - no connection when pulling backup - retry prompt shows and works');

  ava.test.todo('setup - simple - no connection when making a backup - retry prompt shows');

  ava.test.todo('setup - advanced - no connection when making a backup - retry prompt shows');

  ava.test.todo('setup - no connection when submitting public key - retry prompt shows and works');

  ava.test('settings > login > close oauth window > close popup', test_with_browser(async (browser, t) => {
    await BrowserRecipe.open_settings_login_but_close_oauth_window_before_granting_permission(browser, 'flowcrypt.test.key.imported@gmail.com');
  }));

  ava.test('gmail setup prompt notification shows up + goes away when close clicked + shows up again + setup link opens settings', test_with_browser(async (browser, t) => {
    let settings_page = await BrowserRecipe.open_settings_login_but_close_oauth_window_before_granting_permission(browser, 'flowcrypt.test.key.imported@gmail.com');
    await settings_page.close();
    let gmail_page = await BrowserRecipe.open_gmail_page(browser);
    await gmail_page.wait_all(['@webmail-notification', '@notification-setup-action-open-settings', '@notification-setup-action-dismiss', '@notification-setup-action-close']);
    await gmail_page.wait_and_click('@notification-setup-action-close', {confirm_gone: true});
    await gmail_page.close();
    gmail_page = await BrowserRecipe.open_gmail_page(browser);
    await gmail_page.wait_all(['@webmail-notification', '@notification-setup-action-open-settings', '@notification-setup-action-dismiss', '@notification-setup-action-close']);
    let new_settings_page = await browser.new_page_triggered_by(() => gmail_page.wait_and_click('@notification-setup-action-open-settings'));
    await new_settings_page.wait_all('@action-connect-to-gmail');
  }));

  ava.test('gmail shows success notification after setup + goes away after click + does not re-appear', test_with_browser(async (browser, t) => {
    let settings_page = await BrowserRecipe.open_settings_login_approve(browser, 'flowcrypt.test.key.imported@gmail.com');
    await PageRecipe.setup_manual_enter(settings_page, 'flowcrypt.test.key.used.pgp');
    let gmail_page = await BrowserRecipe.open_gmail_page(browser);
    await gmail_page.wait_all(['@webmail-notification', '@notification-successfully-setup-action-close']);
    await gmail_page.wait_and_click('@notification-successfully-setup-action-close', {confirm_gone: true});
    await gmail_page.close();
    gmail_page = await BrowserRecipe.open_gmail_page(browser);
    await gmail_page.not_present(['@webmail-notification', '@notification-setup-action-close', '@notification-successfully-setup-action-close']);
  }));

  ava.test('gmail setup prompt notification shows up + dismiss hides it + does not reappear if dismissed', test_with_browser(async (browser, t) => {
    await BrowserRecipe.open_settings_login_but_close_oauth_window_before_granting_permission(browser, 'flowcrypt.test.key.imported@gmail.com');
    let gmail_page = await BrowserRecipe.open_gmail_page(browser);
    await gmail_page.wait_all(['@webmail-notification', '@notification-setup-action-open-settings', '@notification-setup-action-dismiss', '@notification-setup-action-close']);
    await gmail_page.wait_and_click('@notification-setup-action-dismiss', {confirm_gone: true});
    await gmail_page.close();
    gmail_page = await BrowserRecipe.open_gmail_page(browser);
    await gmail_page.not_present(['@webmail-notification', '@notification-setup-action-open-settings', '@notification-setup-action-dismiss', '@notification-setup-action-close']);
  }));

  ava.test('setup - import key - do not submit - did not use before', test_with_browser(async (browser, t) => {
    let settings_page = await BrowserRecipe.open_settings_login_approve(browser, 'flowcrypt.test.key.imported@gmail.com');
    await PageRecipe.setup_manual_enter(settings_page, 'flowcrypt.test.key.used.pgp', {submit_pubkey: false, used_pgp_before: false});
    await BrowserRecipe.open_gmail_page_and_verify_compose_button_present(browser);
  }));

  ava.test('setup - import key - submit - used before', test_with_browser(async (browser, t) => {
    let settings_page = await BrowserRecipe.open_settings_login_approve(browser, 'flowcrypt.test.key.used.pgp@gmail.com');
    await PageRecipe.setup_manual_enter(settings_page, 'flowcrypt.test.key.used.pgp', {submit_pubkey: true, used_pgp_before: true});
    await BrowserRecipe.open_gmail_page_and_verify_compose_button_present(browser);
  }));

  ava.test('setup - import key - naked - choose my own pass phrase', test_with_browser(async (browser, t) => {
    let settings_page = await BrowserRecipe.open_settings_login_approve(browser, 'flowcrypt.test.key.import.naked@gmail.com');
    await PageRecipe.setup_manual_enter(settings_page, 'flowcrypt.test.key.naked', {submit_pubkey: false, used_pgp_before: false, naked: true});
    await BrowserRecipe.open_gmail_page_and_verify_compose_button_present(browser);
  }));

  ava.test('setup - import key - naked - auto-generate a pass phrase', test_with_browser(async (browser, t) => {
    let settings_page = await BrowserRecipe.open_settings_login_approve(browser, 'flowcrypt.test.key.import.naked@gmail.com');
    await PageRecipe.setup_manual_enter(settings_page, 'flowcrypt.test.key.naked', {submit_pubkey: false, used_pgp_before: false, naked: true, gen_pp: true});
    await BrowserRecipe.open_gmail_page_and_verify_compose_button_present(browser);
  }));

  ava.test.todo('setup - import key - naked - do not supply pass phrase gets error');

  ava.test('setup - import key - fix key self signatures', test_with_browser(async (browser, t) => {
    let settings_page = await BrowserRecipe.open_settings_login_approve(browser, 'flowcrypt.test.key.imported@gmail.com');
    await PageRecipe.setup_manual_enter(settings_page, 'missing.self.signatures', {submit_pubkey: false, fix_key: true});
    await BrowserRecipe.open_gmail_page_and_verify_compose_button_present(browser);
  }));

  ava.test('setup - import key - fix key self signatures - skip invalid uid', test_with_browser(async (browser, t) => {
    let settings_page = await BrowserRecipe.open_settings_login_approve(browser, 'flowcrypt.test.key.imported@gmail.com');
    await PageRecipe.setup_manual_enter(settings_page, 'missing.self.signatures.invalid.uid', {submit_pubkey: false, fix_key: true});
    await BrowserRecipe.open_gmail_page_and_verify_compose_button_present(browser);
  }));

  ava.test.todo('setup - create key advanced - do not remember pass phrase');

  ava.test.todo('setup - create key advanced - backup as a file');

  ava.test.todo('setup - create key simple');

  ava.test('setup - create key advanced - no backup', test_with_browser(async (browser, t) => {
    let settings_page = await BrowserRecipe.open_settings_login_approve(browser, 'flowcrypt.test.key.new.manual@gmail.com');
    await PageRecipe.setup_create_advanced(settings_page, 'flowcrypt.test.key.used.pgp', 'none', {submit_pubkey: false, used_pgp_before: false});
    await BrowserRecipe.open_gmail_page_and_verify_compose_button_present(browser);
  }));

  ava.test('setup - recover with a pass phrase - skip remaining', test_with_browser(async (browser, t) => {
    let settings_page = await BrowserRecipe.open_settings_login_approve(browser, 'flowcrypt.compatibility@gmail.com');
    await PageRecipe.setup_recover(settings_page, 'flowcrypt.compatibility.1pp1', {has_recover_more: true, click_recover_more: false});
    await BrowserRecipe.open_gmail_page_and_verify_compose_button_present(browser);
  }));

  ava.test('setup - recover with a pass phrase - 1pp1 then 2pp1', test_with_browser(async (browser, t) => {
    let settings_page = await BrowserRecipe.open_settings_login_approve(browser, 'flowcrypt.compatibility@gmail.com');
    await PageRecipe.setup_recover(settings_page, 'flowcrypt.compatibility.1pp1', {has_recover_more: true, click_recover_more: true});
    await PageRecipe.setup_recover(settings_page, 'flowcrypt.compatibility.2pp1');
  }));

  ava.test('setup - recover with a pass phrase - 1pp2 then 2pp1', test_with_browser(async (browser, t) => {
    let settings_page = await BrowserRecipe.open_settings_login_approve(browser, 'flowcrypt.compatibility@gmail.com');
    await PageRecipe.setup_recover(settings_page, 'flowcrypt.compatibility.1pp2', {has_recover_more: true, click_recover_more: true});
    await PageRecipe.setup_recover(settings_page, 'flowcrypt.compatibility.2pp1');
  }));

  ava.test('setup - recover with a pass phrase - 2pp1 then 1pp1', test_with_browser(async (browser, t) => {
    let settings_page = await BrowserRecipe.open_settings_login_approve(browser, 'flowcrypt.compatibility@gmail.com');
    await PageRecipe.setup_recover(settings_page, 'flowcrypt.compatibility.2pp1', {has_recover_more: true, click_recover_more: true});
    await PageRecipe.setup_recover(settings_page, 'flowcrypt.compatibility.1pp1');
  }));

  ava.test('setup - recover with a pass phrase - 2pp1 then 1pp2', test_with_browser(async (browser, t) => {
    let settings_page = await BrowserRecipe.open_settings_login_approve(browser, 'flowcrypt.compatibility@gmail.com');
    await PageRecipe.setup_recover(settings_page, 'flowcrypt.compatibility.2pp1', {has_recover_more: true, click_recover_more: true});
    await PageRecipe.setup_recover(settings_page, 'flowcrypt.compatibility.1pp2');
  }));

  ava.test('setup - recover with a pass phrase - 1pp1 then 1pp2 (shows already recovered), then 2pp1', test_with_browser(async (browser, t) => {
    let settings_page = await BrowserRecipe.open_settings_login_approve(browser, 'flowcrypt.compatibility@gmail.com');
    await PageRecipe.setup_recover(settings_page, 'flowcrypt.compatibility.1pp1', {has_recover_more: true, click_recover_more: true});
    await PageRecipe.setup_recover(settings_page, 'flowcrypt.compatibility.1pp2', {already_recovered: true});
    await PageRecipe.setup_recover(settings_page, 'flowcrypt.compatibility.2pp1', {});
  }));

  ava.test.todo('setup - recover with a pass phrase - 1pp1 then wrong, then skip');
  // ava.test('setup - recover with a pass phrase - 1pp1 then wrong, then skip', test_with_browser(async (browser, t) => {
  //   let settings_page = await BrowserRecipe.open_settings_login_approve(browser, 'flowcrypt.compatibility@gmail.com');
  //   await PageRecipe.setup_recover(settings_page, 'flowcrypt.compatibility.1pp1', {has_recover_more: true, click_recover_more: true});
  //   await PageRecipe.setup_recover(settings_page, 'flowcrypt.wrong.passphrase', {wrong_passphrase: true});
  //   await Util.sleep(200);
  // }));

  ava.test('setup - recover with a pass phrase - no remaining', test_with_browser(async (browser, t) => {
    let settings_page = await BrowserRecipe.open_settings_login_approve(browser, 'flowcrypt.test.key.recovered@gmail.com');
    await PageRecipe.setup_recover(settings_page, 'flowcrypt.test.key.recovered', {has_recover_more: false});
    await BrowserRecipe.open_gmail_page_and_verify_compose_button_present(browser);
  }));

  ava.test('setup - fail to recover with a wrong pass phrase', test_with_browser(async (browser, t) => {
    let settings_page = await BrowserRecipe.open_settings_login_approve(browser, 'flowcrypt.test.key.recovered@gmail.com');
    await PageRecipe.setup_recover(settings_page, 'flowcrypt.wrong.passphrase', {has_recover_more: false, wrong_passphrase: true});
    await BrowserRecipe.open_gmail_page_and_verify_compose_button_not_present(browser);
  }));

  ava.test('setup - fail to recover with a wrong pass phrase at first, then recover with good pass phrase', test_with_browser(async (browser, t) => {
    let settings_page = await BrowserRecipe.open_settings_login_approve(browser, 'flowcrypt.test.key.recovered@gmail.com');
    await PageRecipe.setup_recover(settings_page, 'flowcrypt.wrong.passphrase', {wrong_passphrase: true});
    await PageRecipe.setup_recover(settings_page, 'flowcrypt.test.key.recovered');
    await BrowserRecipe.open_gmail_page_and_verify_compose_button_present(browser);
  }));

};
