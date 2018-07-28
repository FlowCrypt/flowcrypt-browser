
import {TestWithBrowser} from '..';
import {PageRecipe} from '../page_recipe';
import {Url} from '../../browser';
import * as ava from 'ava';
import { Util, Config } from '../../util';
import {expect} from 'chai';

export let define_settings_tests = (test_with_new_browser: TestWithBrowser, test_with_semaphored_global_browser: TestWithBrowser) => {

  ava.test('settings[global] - my own emails show as contacts', test_with_semaphored_global_browser(async (browser, t) => {
    let settings_page = await browser.new_page(Url.extension_settings('flowcrypt.compatibility@gmail.com'));
    await PageRecipe.toggle_settings_screen(settings_page, 'additional');
    let contacts_frame = await PageRecipe.open_settings_page_and_await_new_frame(settings_page, '@action-open-contacts-page' , ['contacts.htm', 'placement=settings']);
    await contacts_frame.wait_all('@page-contacts');
    await Util.sleep(1);
    expect(await contacts_frame.read('@page-contacts')).to.contain('flowcrypt.compatibility@gmail.com');
    expect(await contacts_frame.read('@page-contacts')).to.contain('flowcryptcompatibility@gmail.com');
    await PageRecipe.close_settings_page_dialog(settings_page);
    await PageRecipe.toggle_settings_screen(settings_page, 'basic');
  }));

  ava.test('settings[global] - attester shows my emails', test_with_semaphored_global_browser(async (browser, t) => {
    let settings_page = await browser.new_page(Url.extension_settings('flowcrypt.compatibility@gmail.com'));
    await PageRecipe.toggle_settings_screen(settings_page, 'additional');
    let attester_frame = await PageRecipe.open_settings_page_and_await_new_frame(settings_page, '@action-open-attester-page' , ['keyserver.htm', 'placement=settings']);
    await attester_frame.wait_all('@page-attester');
    await Util.sleep(1);
    await attester_frame.wait_till_gone('@spinner');
    await Util.sleep(1);
    expect(await attester_frame.read('@page-attester')).to.contain('flowcrypt.compatibility@gmail.com');
    expect(await attester_frame.read('@page-attester')).to.contain('flowcryptcompatibility@gmail.com');
    await PageRecipe.close_settings_page_dialog(settings_page);
    await PageRecipe.toggle_settings_screen(settings_page, 'basic');
  }));

  ava.test('settings[global] - verify key presense 1pp1', test_with_semaphored_global_browser(async (browser, t) => {
    let settings_page = await browser.new_page(Url.extension_settings('flowcrypt.compatibility@gmail.com'));
    await PageRecipe.verify_settings_key_presence(settings_page, 'flowcrypt.compatibility.1pp1', 'button');
  }));

  ava.test('settings[global] - test pass phrase', test_with_semaphored_global_browser(async (browser, t) => {
    let settings_page = await browser.new_page(Url.extension_settings('flowcrypt.compatibility@gmail.com'));
    await PageRecipe.settings_pass_phrase_test(settings_page, Config.key('flowcrypt.wrong.passphrase').passphrase, false);
    await PageRecipe.settings_pass_phrase_test(settings_page, Config.key('flowcrypt.compatibility.1pp1').passphrase, true);
  }));

  ava.test.todo('settings - verify 2pp1 key presense');
  // await tests.settings_my_key_tests(settings_page, 'flowcrypt.compatibility.2pp1', 'link');

  ava.test('settings[global] - feedback form', test_with_semaphored_global_browser(async (browser, t) => {
    let settings_page = await browser.new_page(Url.extension_settings('flowcrypt.compatibility@gmail.com'));
    await settings_page.wait_and_click('@action-open-modules-help');
    await settings_page.wait_all('@dialog');
    let help_frame = await settings_page.get_frame(['help.htm']);
    await help_frame.wait_and_type('@input-feedback-message', 'automated puppeteer test: help form from settings footer');
    let dialog = await settings_page.trigger_and_await_new_alert(() => help_frame.wait_and_click('@action-feedback-send'));
    await dialog.accept();
  }));

};
