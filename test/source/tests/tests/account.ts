
import { TestWithBrowser, TestWithGlobalBrowser } from '..';
import { PageRecipe, ComposePageRecipe, SetupPageRecipe, GmailPageRecipe } from '../page_recipe';
import { BrowserRecipe } from '../browser_recipe';
import { Url, Semaphore } from '../../browser';
import { FlowCryptApi } from '../api';
import * as ava from 'ava';
import { Util, Config } from '../../util';
import { expect } from 'chai';

export let define_account_tests = (test_with_new_browser: TestWithBrowser, test_with_semaphored_global_browser: TestWithGlobalBrowser) => {

  ava.test('compose > large file > subscribe > trial > attach again', test_with_semaphored_global_browser('trial', async (browser, t) => {
    // set up acct and open compose page
    let settings_page = await BrowserRecipe.open_settings_login_approve(browser, Config.secrets.ci_dev_account);
    await SetupPageRecipe.recover(settings_page, 'flowcrypt.test.trial', {has_recover_more: false});
    await browser.close_all_pages();
    let gmail_page = await BrowserRecipe.open_gmail_page_and_verify_compose_button_present(browser);
    await GmailPageRecipe.close_initial_setup_notification(gmail_page);
    let compose_page = await GmailPageRecipe.open_secure_compose(gmail_page, browser);
    await ComposePageRecipe.fill_message(compose_page, 'human@flowcrypt.com', 'a large file to trigger trial');
    // add a large file
    let file_input = await compose_page.target.$('input[type=file]');
    let subsccription_needed_alert = await compose_page.trigger_and_await_new_alert(async () => await file_input!.uploadFile('test/samples/large.jpg'));
    expect(await subsccription_needed_alert.message()).contains('The files are over 5 MB');
    await subsccription_needed_alert.accept();
    // get a trial
    let subscribe_page = await GmailPageRecipe.get_subscribe_dialog(gmail_page, browser);
    let subscribed_alert = await compose_page.trigger_and_await_new_alert(async () => await subscribe_page.wait_and_click('@action-get-trial', {delay: 1}));
    expect(await subscribed_alert.message()).contains('now you can add your file again');
    await subscribed_alert.accept();
    await subscribe_page.close();
    // verify can add large file now
    await gmail_page.wait_till_gone('@dialog-subscribe');
    await gmail_page.wait_all('@webmail-notification');
    expect(await gmail_page.read('@webmail-notification')).contains('Successfully upgraded to FlowCrypt Advanced');
    await compose_page.click('@input-body'); // focus on this tab before interacting with file upload
    file_input = await compose_page.target.$('input[type=file]');
    await file_input!.uploadFile('test/samples/large.jpg');
    await ComposePageRecipe.send_and_close(compose_page);
    await gmail_page.wait_till_gone('@container-new-message');
  }));

  ava.test.todo('compose > footer > subscribe > trial');

  ava.test.todo('settings > subscribe > trial');

  ava.test.todo('settings will recognize expired subscription');

  ava.test.todo('settings will recognize / sync subscription');

  ava.test.todo('settings > subscribe > expire > compose > large file > subscribe');

  ava.test.todo('settings > subscribe > expire > compose > footer > subscribe');

};
