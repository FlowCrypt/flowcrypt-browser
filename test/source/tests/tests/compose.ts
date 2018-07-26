import {TestWithBrowser} from '..';
import {PageRecipe} from '../page_recipe';
import {BrowserRecipe} from '../browser_recipe';
import {Url} from '../../browser';
import * as ava from 'ava';
import { Util } from '../../util';
import { config_k } from '../../config';

export let define_compose_tests = (test_with_new_browser: TestWithBrowser) => {

  ava.test('compose - standalone - can set and remember default send address', test_with_new_browser(async (browser, t) => {
    await BrowserRecipe.set_up_flowcrypt_compatibility_account(browser);
    let compose_page = await PageRecipe.compose_open_compose_page_standalone(browser);
    await PageRecipe.compose_change_default_sending_address(compose_page, 'flowcrypt.compatibility@gmail.com');
    await compose_page.close();
    compose_page = await PageRecipe.compose_open_compose_page_standalone(browser);
    let currently_selected_from = await compose_page.value('@input-from');
    if(currently_selected_from !== 'flowcrypt.compatibility@gmail.com') {
      throw Error('did not remember selected from addr: flowcrypt.compatibility@gmail.com');
    }
    await PageRecipe.compose_change_default_sending_address(compose_page, 'flowcryptcompatibility@gmail.com');
    await compose_page.close();
    compose_page = await PageRecipe.compose_open_compose_page_standalone(browser);
    currently_selected_from = await compose_page.value('@input-from');
    if(currently_selected_from !== 'flowcryptcompatibility@gmail.com') {
      throw Error('did not remember selected from addr: flowcryptcompatibility@gmail.com');
    }
    await PageRecipe.compose_change_default_sending_address(compose_page, 'flowcrypt.compatibility@gmail.com');
    await compose_page.close();
  }));

  ava.test('compose - standalone - signed with entered pass phrase + will remember pass phrase in session', test_with_new_browser(async (browser, t) => {
    let k = config_k('flowcrypt.compatibility.1pp1');
    await BrowserRecipe.set_up_flowcrypt_compatibility_account(browser);
    let settings_page = await browser.new_page(Url.extension_settings('flowcrypt.compatibility@gmail.com'));
    let compose_page = await PageRecipe.compose_open_compose_page_standalone(browser);
    await PageRecipe.settings_change_pass_phrase_requirement(settings_page, k.passphrase, 'session');
    let compose_frame = await PageRecipe.compose_open_compose_page_settings(settings_page);
    await PageRecipe.compose_fill_message(compose_frame, 'human@flowcrypt.com', 'sign with entered pass phrase');
    await compose_frame.wait_and_click('@action-switch-to-sign', {delay: 0.5});
    await compose_frame.wait_and_click('@action-send');
    let passphrase_dialog = await settings_page.get_frame(['passphrase.htm']);
    await passphrase_dialog.wait_and_type('@input-pass-phrase', k.passphrase);
    let alert = await settings_page.trigger_and_await_new_alert(() => passphrase_dialog.wait_and_click('@action-confirm-pass-phrase-entry')); // confirming pass phrase will send the message
    await alert.accept(); // toto - could be error alert for all I know - should distinguish
    await settings_page.wait_till_gone('@dialog'); // however the @dialog would not go away - so that is a (weak but sufficient) telling sign
    await compose_page.close();
    // signed - done, now try to see if it remembered pp in session
    compose_page = await PageRecipe.compose_open_compose_page_standalone(browser);
    await PageRecipe.compose_fill_message(compose_page, 'human@flowcrypt.com', 'signed message pp in session');
    await compose_page.click('@action-switch-to-sign'); // should remember pass phrase in session from previous entry
    await PageRecipe.compose_send_and_close(compose_page);
    await settings_page.close();
  }));

  ava.test('compose - standalone - can load contact based on name', test_with_new_browser(async (browser, t) => {
    await BrowserRecipe.set_up_flowcrypt_compatibility_account(browser);
    let compose_page = await PageRecipe.compose_open_compose_page_standalone(browser);
    await compose_page.type('@input-to', 'human'); // test loading of contacts
    await compose_page.wait_all(['@container-contacts', '@action-select-contact(human@flowcrypt.com)']);
  }));

  ava.test('compose - standalone - can choose found contact', test_with_new_browser(async (browser, t) => {
    await BrowserRecipe.set_up_flowcrypt_compatibility_account(browser);
    let compose_page = await PageRecipe.compose_open_compose_page_standalone(browser);
    await compose_page.type('@input-to', 'human'); // test loading of contacts
    await compose_page.wait_all(['@container-contacts', '@action-select-contact(human@flowcrypt.com)']);
    await compose_page.wait_and_click('@action-select-contact(human@flowcrypt.com)', {delay: 1});
    // todo - verify that the contact/pubkey is showing in green once clicked
  }));

  ava.test('compose - standalone - freshly loaded pubkey', test_with_new_browser(async (browser, t) => {
    await BrowserRecipe.set_up_flowcrypt_compatibility_account(browser);
    let compose_page = await PageRecipe.compose_open_compose_page_standalone(browser);
    await PageRecipe.compose_fill_message(compose_page, 'human@flowcrypt.com', 'freshly loaded pubkey');
    await PageRecipe.compose_send_and_close(compose_page);
  }));

  ava.test('compose - standalone - nopgp', test_with_new_browser(async (browser, t) => {
    await BrowserRecipe.set_up_flowcrypt_compatibility_account(browser);
    let compose_page = await PageRecipe.compose_open_compose_page_standalone(browser);
    await PageRecipe.compose_fill_message(compose_page, 'human+nopgp@flowcrypt.com', 'unknown pubkey');
    await PageRecipe.compose_send_and_close(compose_page, 'test-pass');
  }));

  ava.test('compose - standalone - from alias', test_with_new_browser(async (browser, t) => {
    await BrowserRecipe.set_up_flowcrypt_compatibility_account(browser);
    let compose_page = await PageRecipe.compose_open_compose_page_standalone(browser);
    await compose_page.select_option('@input-from', 'flowcryptcompatibility@gmail.com');
    await PageRecipe.compose_fill_message(compose_page, 'human@flowcrypt.com', 'from alias');
    await PageRecipe.compose_send_and_close(compose_page);
  }));

  ava.test('compose - standalone - with attachments', test_with_new_browser(async (browser, t) => {
    await BrowserRecipe.set_up_flowcrypt_compatibility_account(browser);
    let compose_page = await PageRecipe.compose_open_compose_page_standalone(browser);
    await PageRecipe.compose_fill_message(compose_page, 'human@flowcrypt.com', 'with files');
    let file_input = await compose_page.target.$('input[type=file]');
    await file_input!.uploadFile('test/samples/small.txt', 'test/samples/small.png', 'test/samples/small.pdf');
    await PageRecipe.compose_send_and_close(compose_page);
  }));

  ava.test('compose - standalone - with attachments + nopgp', test_with_new_browser(async (browser, t) => {
    await BrowserRecipe.set_up_flowcrypt_compatibility_account(browser);
    let compose_page = await PageRecipe.compose_open_compose_page_standalone(browser);
    await PageRecipe.compose_fill_message(compose_page, 'human+nopgp@flowcrypt.com', 'with files + nonppg');
    let file_input = await compose_page.target.$('input[type=file]');
    await file_input!.uploadFile('test/samples/small.txt', 'test/samples/small.png', 'test/samples/small.pdf');
    await PageRecipe.compose_send_and_close(compose_page, 'test-pass');
  }));

  ava.test('compose - signed message', test_with_new_browser(async (browser, t) => {
    await BrowserRecipe.set_up_flowcrypt_compatibility_account(browser);
    let compose_page = await PageRecipe.compose_open_compose_page_standalone(browser);
    await PageRecipe.compose_fill_message(compose_page, 'human@flowcrypt.com', 'signed message');
    await compose_page.click('@action-switch-to-sign');
    await PageRecipe.compose_send_and_close(compose_page);
  }));

  ava.test('compose - settings - manually copied pubkey', test_with_new_browser(async (browser, t) => {
    await BrowserRecipe.set_up_flowcrypt_compatibility_account(browser);
    let settings_page = await browser.new_page(Url.extension_settings('flowcrypt.compatibility@gmail.com'));
    let compose_frame = await PageRecipe.compose_open_compose_page_settings(settings_page);
    await PageRecipe.compose_fill_message(compose_frame, 'human@flowcrypt.com', 'just to load - will close this page');
    await Util.sleep(1); // todo: should wait until actually loaded
    await settings_page.close();
    settings_page = await browser.new_page(Url.extension_settings('flowcrypt.compatibility@gmail.com'));
    compose_frame = await PageRecipe.compose_open_compose_page_settings(settings_page);
    await PageRecipe.compose_fill_message(compose_frame, 'human+manualcopypgp@flowcrypt.com', 'manual copied key');
    await compose_frame.wait_and_click('@action-open-add-pubkey-dialog', {delay: 1});
    await compose_frame.wait_all('@dialog');
    let add_pubkey_dialog = await compose_frame.get_frame(['add_pubkey.htm']);
    await add_pubkey_dialog.wait_all('@input-select-copy-from');
    await add_pubkey_dialog.select_option('@input-select-copy-from', 'human@flowcrypt.com');
    await add_pubkey_dialog.wait_and_click('@action-add-pubkey');
    await compose_frame.wait_till_gone('@dialog');
    let alert = await settings_page.trigger_and_await_new_alert(() => compose_frame.wait_and_click('@action-send', {delay: 2}));
    await alert.accept(); // todo - read success from the alert
    await settings_page.wait_till_gone('@dialog');
  }));

};
