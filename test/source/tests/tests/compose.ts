import {TestWithBrowser, TestWithGlobalBrowser} from '..';
import {PageRecipe, ComposePageRecipe, SettingsPageRecipe} from '../page_recipe';
import {BrowserRecipe} from '../browser_recipe';
import {Url} from '../../browser';
import * as ava from 'ava';
import { Util, Config } from '../../util';

export let define_compose_tests = (test_with_new_browser: TestWithBrowser, test_with_semaphored_global_browser: TestWithGlobalBrowser) => {

  ava.test('compose - standalone - can set and remember default send address', test_with_new_browser(async (browser, t) => {
    await BrowserRecipe.set_up_flowcrypt_compatibility_account(browser);
    let compose_page = await ComposePageRecipe.open_standalone(browser);
    await ComposePageRecipe.change_default_sending_address(compose_page, 'flowcrypt.compatibility@gmail.com');
    await compose_page.close();
    compose_page = await ComposePageRecipe.open_standalone(browser);
    let currently_selected_from = await compose_page.value('@input-from');
    if(currently_selected_from !== 'flowcrypt.compatibility@gmail.com') {
      throw Error('did not remember selected from addr: flowcrypt.compatibility@gmail.com');
    }
    await ComposePageRecipe.change_default_sending_address(compose_page, 'flowcryptcompatibility@gmail.com');
    await compose_page.close();
    compose_page = await ComposePageRecipe.open_standalone(browser);
    currently_selected_from = await compose_page.value('@input-from');
    if(currently_selected_from !== 'flowcryptcompatibility@gmail.com') {
      throw Error('did not remember selected from addr: flowcryptcompatibility@gmail.com');
    }
    await ComposePageRecipe.change_default_sending_address(compose_page, 'flowcrypt.compatibility@gmail.com');
    await compose_page.close();
  }));

  ava.test('compose - standalone - signed with entered pass phrase + will remember pass phrase in session', test_with_new_browser(async (browser, t) => {
    let k = Config.key('flowcrypt.compatibility.1pp1');
    await BrowserRecipe.set_up_flowcrypt_compatibility_account(browser);
    let settings_page = await browser.new_page(Url.extension_settings('flowcrypt.compatibility@gmail.com'));
    await SettingsPageRecipe.change_pass_phrase_requirement(settings_page, k.passphrase, 'session');
    let compose_frame = await ComposePageRecipe.open_in_settings(settings_page);
    await ComposePageRecipe.fill_message(compose_frame, 'human@flowcrypt.com', 'sign with entered pass phrase');
    await compose_frame.wait_and_click('@action-switch-to-sign', {delay: 0.5});
    await compose_frame.wait_and_click('@action-send');
    let passphrase_dialog = await settings_page.get_frame(['passphrase.htm']);
    await passphrase_dialog.wait_and_type('@input-pass-phrase', k.passphrase);
    await passphrase_dialog.wait_and_click('@action-confirm-pass-phrase-entry'); // confirming pass phrase will send the message
    await settings_page.wait_till_gone('@dialog'); // however the @dialog would not go away - so that is a (weak but sufficient) telling sign
    // signed - done, now try to see if it remembered pp in session
    let compose_page = await ComposePageRecipe.open_standalone(browser);
    await ComposePageRecipe.fill_message(compose_page, 'human@flowcrypt.com', 'signed message pp in session');
    await compose_page.click('@action-switch-to-sign'); // should remember pass phrase in session from previous entry
    await ComposePageRecipe.send_and_close(compose_page);
    await settings_page.close();
  }));

  ava.test('compose - standalone - can load contact based on name', test_with_new_browser(async (browser, t) => {
    await BrowserRecipe.set_up_flowcrypt_compatibility_account(browser);
    let compose_page = await ComposePageRecipe.open_standalone(browser);
    await compose_page.type('@input-to', 'human'); // test loading of contacts
    await compose_page.wait_all(['@container-contacts', '@action-select-contact(human@flowcrypt.com)']);
  }));

  ava.test.skip(`compose - standalone - can choose found contact`, test_with_new_browser(async (browser, t) => {
    await BrowserRecipe.set_up_flowcrypt_compatibility_account(browser);
    let compose_page = await ComposePageRecipe.open_standalone(browser);
    compose_page.enable_debugging('choose-contact');
    await compose_page.type('@input-to', 'human'); // test loading of contacts
    await compose_page.wait_all(['@container-contacts', '@action-select-contact(human@flowcrypt.com)']);
    await compose_page.wait_and_click('@action-select-contact(human@flowcrypt.com)', {retry_errors: true, confirm_gone: true});
    // todo - verify that the contact/pubkey is showing in green once clicked
  }));

  ava.test('compose - standalone - freshly loaded pubkey', test_with_new_browser(async (browser, t) => {
    await BrowserRecipe.set_up_flowcrypt_compatibility_account(browser);
    let compose_page = await ComposePageRecipe.open_standalone(browser);
    await ComposePageRecipe.fill_message(compose_page, 'human@flowcrypt.com', 'freshly loaded pubkey');
    await ComposePageRecipe.send_and_close(compose_page);
  }));

  ava.test('compose[global] - standalone - nopgp', test_with_semaphored_global_browser('compatibility', async (browser, t) => {
    let compose_page = await ComposePageRecipe.open_standalone(browser);
    await ComposePageRecipe.fill_message(compose_page, 'human+nopgp@flowcrypt.com', 'unknown pubkey');
    await ComposePageRecipe.send_and_close(compose_page, 'test-pass');
  }));

  ava.test('compose[global] - standalone - from alias', test_with_semaphored_global_browser('compatibility', async (browser, t) => {
    let compose_page = await ComposePageRecipe.open_standalone(browser);
    await compose_page.select_option('@input-from', 'flowcryptcompatibility@gmail.com');
    await ComposePageRecipe.fill_message(compose_page, 'human@flowcrypt.com', 'from alias');
    await ComposePageRecipe.send_and_close(compose_page);
  }));

  ava.test('compose[global] - standalone - with attachments', test_with_semaphored_global_browser('compatibility', async (browser, t) => {
    let compose_page = await ComposePageRecipe.open_standalone(browser);
    await ComposePageRecipe.fill_message(compose_page, 'human@flowcrypt.com', 'with files');
    let file_input = await compose_page.target.$('input[type=file]');
    await file_input!.uploadFile('test/samples/small.txt', 'test/samples/small.png', 'test/samples/small.pdf');
    await ComposePageRecipe.send_and_close(compose_page);
  }));

  ava.test('compose[global] - standalone - with attachments + nopgp', test_with_semaphored_global_browser('compatibility', async (browser, t) => {
    let compose_page = await ComposePageRecipe.open_standalone(browser);
    await ComposePageRecipe.fill_message(compose_page, 'human+nopgp@flowcrypt.com', 'with files + nonppg');
    let file_input = await compose_page.target.$('input[type=file]');
    await file_input!.uploadFile('test/samples/small.txt', 'test/samples/small.png', 'test/samples/small.pdf');
    await ComposePageRecipe.send_and_close(compose_page, 'test-pass');
  }));

  ava.test('compose[global] - signed message', test_with_semaphored_global_browser('compatibility', async (browser, t) => {
    let compose_page = await ComposePageRecipe.open_standalone(browser);
    await ComposePageRecipe.fill_message(compose_page, 'human@flowcrypt.com', 'signed message');
    await compose_page.click('@action-switch-to-sign');
    await ComposePageRecipe.send_and_close(compose_page);
  }));

  ava.test('compose[global] - settings - manually copied pubkey', test_with_semaphored_global_browser('compatibility', async (browser, t) => {
    let settings_page = await browser.new_page(Url.extension_settings('flowcrypt.compatibility@gmail.com'));
    let compose_frame = await ComposePageRecipe.open_in_settings(settings_page);
    await ComposePageRecipe.fill_message(compose_frame, 'human@flowcrypt.com', 'just to load - will close this page');
    await Util.sleep(1); // todo: should wait until actually loaded
    await settings_page.close();
    settings_page = await browser.new_page(Url.extension_settings('flowcrypt.compatibility@gmail.com'));
    compose_frame = await ComposePageRecipe.open_in_settings(settings_page);
    await ComposePageRecipe.fill_message(compose_frame, 'human+manualcopypgp@flowcrypt.com', 'manual copied key');
    await compose_frame.wait_and_click('@action-open-add-pubkey-dialog', {delay: 1});
    await compose_frame.wait_all('@dialog');
    let add_pubkey_dialog = await compose_frame.get_frame(['add_pubkey.htm']);
    await add_pubkey_dialog.wait_all('@input-select-copy-from');
    await add_pubkey_dialog.select_option('@input-select-copy-from', 'human@flowcrypt.com');
    await add_pubkey_dialog.wait_and_click('@action-add-pubkey');
    await compose_frame.wait_till_gone('@dialog');
    await compose_frame.wait_and_click('@action-send', {delay: 2});
    await settings_page.wait_till_gone('@dialog');
  }));

};
