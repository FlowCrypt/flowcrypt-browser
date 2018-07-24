/* tslint:disable */

import {BrowserHandle, ControllablePage, ControllableFrame, Controllable, Url, gmail_seq} from './browser';
import {config, config_k} from './config';
import {log_test_step} from './logger';
import {Util} from './util';
const ordered_stringify = require('json-stable-stringify');

let assert = (received: any, expected: any, name: string) => { if(expected !== received) throw Error(`asserted ${name} to be "${String(expected)}" but got "${String(received)}"`); };

class Task {
  
  public static compose_open_compose_page_standalone = async (browser: BrowserHandle): Promise<ControllablePage> => {
    let compose_page = await browser.new_page('chrome/elements/compose.htm?account_email=flowcrypt.compatibility%40gmail.com&parent_tab_id=0');
    await compose_page.wait_all(['@input-body', '@input-to', '@input-subject', '@action-send']);
    await compose_page.wait_for_selector_test_state('ready');
    return compose_page;
  }

  public static compose_open_compose_page_settings = async (settings_page: ControllablePage): Promise<ControllableFrame> => {
    await settings_page.wait_and_click('@action-show-compose-page');
    await settings_page.wait_all('@dialog');
    let compose_frame = await settings_page.get_frame(['compose.htm']);
    await compose_frame.wait_all(['@input-body', '@input-to', '@input-subject', '@action-send']);
    await compose_frame.wait_for_selector_test_state('ready');
    return compose_frame;
  }

  public static compose_change_default_sending_address = async (compose_page: ControllablePage, new_default: string) => {
    await compose_page.wait_and_click('@action-open-sending-address-settings');
    await compose_page.wait_all('@dialog');
    let sending_address_frame = await compose_page.get_frame(['sending_address.htm']);
    await sending_address_frame.wait_and_click(`@action-choose-address(${new_default})`);
    await Util.sleep(0.5); // page reload
    await sending_address_frame.wait_and_click('@action-close-sending-address-settings');
    await compose_page.wait_till_gone('@dialog');
  }

  public static compose_fill_message = async (compose_page_or_frame: Controllable, to: string|null, subject: string) => {
    if(to) {
      await compose_page_or_frame.type('@input-to', to);
    }
    await compose_page_or_frame.click('@input-subject');
    await compose_page_or_frame.type('@input-subject', `Automated puppeteer test: ${subject}`);
    await compose_page_or_frame.type('@input-body', `This is an automated puppeteer test: ${subject}`);
  }

  public static compose_send_and_close = async (compose_page: ControllablePage, password?: string|undefined) => {
    if(password) {
      await compose_page.wait_and_type('@input-password', 'test-pass');
      await compose_page.wait_and_click('@action-send', {delay: 0.5}); // in real usage, also have to click two times when using password - why?
    }
    await compose_page.wait_and_click('@action-send', {delay: 0.5});
    await compose_page.wait_for_selector_test_state('closed', 60); // wait until page closed
    await compose_page.close();
  }

  public static toggle_settings_screen = async (settings_page: ControllablePage, to: "basic"|"additional") => {
    await settings_page.wait_and_click(to === 'basic' ? '@action-toggle-screen-basic' : '@action-toggle-screen-additional'); // switch
    await settings_page.wait_all(to === 'basic' ? '@action-toggle-screen-additional' : '@action-toggle-screen-basic'); // wait for opposite button to show up
  }

  public static close_settings_page_dialog = async (settings_page: ControllablePage) => {
    await settings_page.wait_and_click('@dialog-close');
    await settings_page.wait_till_gone('@dialog');
  }

  public static open_settings_page_and_await_new_frame = async (settings_page: ControllablePage, action_button_selector: string, frame_url_filter: string[]): Promise<ControllableFrame> => {
    await settings_page.wait_and_click(action_button_selector);
    await settings_page.wait_all('@dialog');
    return await settings_page.get_frame(frame_url_filter); // placement=settings to differentiate from mini-security frame in settings
  }

  public static settings_switch_account = async (settings_page: ControllablePage, account_email: string) => {
    await settings_page.wait_and_click('@action-toggle-accounts-menu');
    await settings_page.wait_and_click(`@action-switch-to-account(${account_email})`);
    log_test_step(`tests:switch_settings_account:${account_email}`);
  }

}


export const tests = {
  oauth_password_delay: 2,
  handle_gmail_oauth: async function(oauth_page: ControllablePage, account_email: string, action: "close"|"deny"|"approve") {
    let selectors = {
      backup_email_verification_choice: "//div[@class='vdE7Oc' and text() = 'Confirm your recovery email']",
      approve_button: '#submit_approve_access',
    };
    let auth = config.auth.google.filter(a => a.email === account_email)[0];
    await oauth_page.wait_all('#Email, #submit_approve_access, #identifierId, .w6VTHd');
    if (await oauth_page.target.$('#Email') !== null) {
      await oauth_page.wait_all('#Email', {timeout: 60});
      await oauth_page.wait_and_type('#Email', auth['email']);
      await oauth_page.wait_and_click('#next');
      await Util.sleep(tests.oauth_password_delay);
      await oauth_page.wait_and_type('#Passwd', auth['password'], {delay: tests.oauth_password_delay});
      await oauth_page.wait_and_click('#signIn', {delay: 1})
    } else if (await oauth_page.target.$('#identifierId') !== null) {
      await oauth_page.wait_all('#identifierId', {timeout: 60});
      await oauth_page.wait_and_type('#identifierId', auth['email'], {delay: 2});
      await oauth_page.wait_and_click('.zZhnYe', {delay: 2});  // confirm email
      await Util.sleep(tests.oauth_password_delay);
      await oauth_page.wait_and_type('.zHQkBf', auth['password'], {delay: tests.oauth_password_delay});
      await oauth_page.wait_and_click('.CwaK9', {delay: 1});  // confirm password
    } else if (await oauth_page.target.$('.w6VTHd') !== null) { // select from accounts where already logged in
      await oauth_page.wait_and_click('.bLzI3e', {delay: 1}); // choose other account, also try .TnvOCe .k6Zj8d .XraQ3b
      await Util.sleep(2);
      await tests.handle_gmail_oauth(oauth_page, account_email, action); // start from beginning after clicking "other email acct"
      return;
    }
    let element = await oauth_page.wait_any([selectors.approve_button, selectors.backup_email_verification_choice]);
    await Util.sleep(1);
    if((await oauth_page.target.$x(selectors.backup_email_verification_choice)).length) { // asks for registered backup email
      await element.click();
      await oauth_page.wait_and_type('#knowledge-preregistered-email-response', auth.backup, {delay: 2});
      await oauth_page.wait_and_click('#next', {delay: 2});
      await oauth_page.wait_all('#submit_approve_access');
    }
    if(gmail_seq.indexOf(account_email) === -1) {
      gmail_seq.push(account_email);
    }
    if(action === 'close') {
      await oauth_page.close()
    } else if(action === 'deny') {
      throw Error('tests.handle_gmail_oauth options.deny.true not implemented');
    } else {
      await oauth_page.wait_and_click('#submit_approve_access', {delay: 1});
    }
    log_test_step(`tests:handle_gmail_oauth:${account_email}:${action}`);
  },
  setup_recover: async function(settings_page: ControllablePage, key_title: string, {wrong_passphrase=false, more_to_recover=false}: {wrong_passphrase?: boolean, more_to_recover?: boolean}={}) {
    let k = config_k(key_title);
    await settings_page.wait_and_type('@input-recovery-pass-phrase', k.passphrase);
    if(wrong_passphrase) {
      let dialog = await settings_page.trigger_and_await_new_alert(() => settings_page.wait_and_click('@action-recover-account'));
      await dialog.accept();
    } else {
      await settings_page.wait_and_click('@action-recover-account');
      await settings_page.wait_any(['@action-step4more-account-settings', '@action-step4done-account-settings'], {timeout: 40});
      await settings_page.wait_and_click(more_to_recover ? '@action-step4more-account-settings' : '@action-step4done-account-settings');
    }
    log_test_step(`tests:setup_recover:${key_title}`);
  },
  setup_manual_enter: async function(settings_page: ControllablePage, key_title: string, {used_pgp_before=false, submit_pubkey=false, fix_key=false}: {used_pgp_before?: boolean, submit_pubkey?: boolean, fix_key?: boolean}={}) {
    let k = config_k(key_title);
    if(used_pgp_before) {
      await settings_page.wait_and_click('@action-step0foundkey-choose-manual-enter');
    } else {
      await settings_page.wait_and_click('@action-step1easyormanual-choose-manual-enter');
    }
    await settings_page.wait_and_click('@input-step2bmanualenter-source-paste');
    await settings_page.wait_and_type('@input-step2bmanualenter-ascii-key', k.armored || '');
    await settings_page.wait_and_type('@input-step2bmanualenter-passphrase', k.passphrase);
    if(!submit_pubkey) {
      await settings_page.wait_and_click('@input-step2bmanualenter-submit-pubkey'); // uncheck
    }
    await settings_page.wait_and_click('@input-step2bmanualenter-save', {delay: 1});
    if(fix_key) {
      await settings_page.wait_all('@input-compatibility-fix-expire-years');
      await settings_page.select_option('@input-compatibility-fix-expire-years', '1');
      await settings_page.wait_and_click('@action-fix-and-import-key');
    }
    await settings_page.wait_and_click('@action-step4done-account-settings');
    log_test_step(`tests:setup_manual_enter:${key_title}:used_pgp_before=${used_pgp_before},submit_pubkey=${submit_pubkey},fix_key=${fix_key}`);
  },
  setup_manual_create: async function(settings_page: Controllable, key_title: string, backup: "none"|"email"|"file", {used_pgp_before=false, submit_pubkey=false}: {used_pgp_before?: boolean, submit_pubkey?: boolean}={}) {
    let k = config_k(key_title);
    if(used_pgp_before) {
      await settings_page.wait_and_click('@action-step0foundkey-choose-manual-create');
    } else {
      await settings_page.wait_and_click('@action-step1easyormanual-choose-manual-create');
    }
    await settings_page.wait_and_type('@input-step2bmanualcreate-passphrase-1', k.passphrase);
    await settings_page.wait_and_type('@input-step2bmanualcreate-passphrase-2', k.passphrase);
    if(!submit_pubkey) {
      await settings_page.wait_and_click('@input-step2bmanualcreate-submit-pubkey'); // uncheck
    }
    await settings_page.wait_and_click('@input-step2bmanualcreate-create-and-save');
    if(backup === 'none') {
      await settings_page.wait_and_click('@input-backup-step3manual-no-backup');
    } else if(backup === 'email') {
      throw Error('tests.setup_manual_create options.backup=email not implemented');
    } else if(backup === 'file') {
      throw Error('tests.setup_manual_create options.backup=file not implemented');
    }
    await settings_page.wait_and_click('@action-backup-step3manual-continue');
    await settings_page.wait_and_click('@action-step4done-account-settings');
    log_test_step(`tests:setup_manual_create:${key_title}:backup=${backup},used_pgp_before=${used_pgp_before},submit_pubkey=${submit_pubkey}`);
  },
  pgp_block_tests: async function(browser: BrowserHandle) {
    let pgp_block_page = await browser.new_page()
    let messages = config.messages;
    let all_ok = true;
    for(let i = 0; i < messages.length; i++) {
      let m = messages[i];
      await pgp_block_page.goto(Url.extension(`chrome/elements/pgp_block.htm${m.params}`));
      await pgp_block_page.wait_all('@pgp-block-content');
      await pgp_block_page.wait_for_selector_test_state('ready');
      await Util.sleep(1);
      let content = await pgp_block_page.read('@pgp-block-content');
      let ok = true;
      for(let j = 0; j < m.content.length; j++) {
        if(content.indexOf(m.content[j]) === -1) {
          log_test_step(`tests:pgp_block:${m.name}`, `missing expected content:${m.content[j]}`);
          ok = false;
          all_ok = false;
        }
      }
      if(ok) {
        log_test_step(`tests:pgp_block:${m.name}`);
      }
    }
    await pgp_block_page.close();
    if(all_ok) {
      log_test_step(`tests:pgp_block`);
    } else {
      log_test_step(`tests:pgp_block`, `some decrypt tests had failures`);
    }
  },
  gmail_tests: async function(browser: BrowserHandle) {
    // standard gmail
    let gmail_page = await browser.new_page(Url.gmail('flowcrypt.compatibility@gmail.com'));
    await gmail_page.wait_and_click('@action-secure-compose', {delay: 1});
    await gmail_page.wait_all('@container-new-message');
    log_test_step('tests:gmail:secure compose button (mail.google.com)');

    // let compose_frame = await gmail_page.get_frame(['compose.htm']);
    // Task.compose_fill_message(compose_frame, 'human@flowcrypt.com', 'message from gmail');
    // await compose_frame.wait_and_click('@action-send', {delay: 0.5});
    // await gmail_page.wait_till_gone('@container-new-message');
    // await gmail_page.wait_all('@webmail-notification'); // message sent
    // assert(await gmail_page.read('@webmail-notification'), 'Your encrypted message has been sent.', 'gmail notifiaction message');
    // await gmail_page.click('@webmail-notification');
    // await gmail_page.wait_till_gone('@webmail-notification');
    // log('tests:gmail:secure compose works from gmail + compose frame disappears + notification shows + notification disappears');

    // google inbox - need to hover over the button first
    // await gmail_page.goto('https://inbox.google.com');
    // await gmail_page.wait_and_click('@action-secure-compose', 1);
    // await gmail_page.wait('@container-new-message');
    // log('gmail:tests:secure compose button (inbox.google.com)');

    await gmail_page.close();
  },
  compose_tests: async function(browser: BrowserHandle) {
    let k = config_k('flowcrypt.compatibility.1pp1');
    let compose_page: ControllablePage;

    compose_page = await Task.compose_open_compose_page_standalone(browser);
    await Task.compose_change_default_sending_address(compose_page, 'flowcrypt.compatibility@gmail.com');
    await compose_page.close();
    compose_page = await Task.compose_open_compose_page_standalone(browser);
    let currently_selected_from = await compose_page.value('@input-from');
    if(currently_selected_from !== 'flowcrypt.compatibility@gmail.com')
      throw Error('did not remember selected from addr: flowcrypt.compatibility@gmail.com');
    await Task.compose_change_default_sending_address(compose_page, 'flowcryptcompatibility@gmail.com');
    await compose_page.close();
    compose_page = await Task.compose_open_compose_page_standalone(browser);
    currently_selected_from = await compose_page.value('@input-from');
    if(currently_selected_from !== 'flowcryptcompatibility@gmail.com')
      throw Error('did not remember selected from addr: flowcryptcompatibility@gmail.com');
    await Task.compose_change_default_sending_address(compose_page, 'flowcrypt.compatibility@gmail.com');
    await compose_page.close();
    await log_test_step('tests:compose:can set and remember default send address');

    compose_page = await Task.compose_open_compose_page_standalone(browser);
    await compose_page.type('@input-to', 'human'); // test loading of contacts
    await compose_page.wait_all(['@container-contacts', '@action-select-contact(human@flowcrypt.com)']);
    log_test_step('tests:compose:can load contact based on name');
    await compose_page.wait_and_click('@action-select-contact(human@flowcrypt.com)', {delay: 1}); // select a contact
    log_test_step('tests:compose:can choose found contact');
    await Task.compose_fill_message(compose_page, null, 'freshly loaded pubkey');
    await Task.compose_send_and_close(compose_page);
    log_test_step('tests:compose:fresh pubkey');

    compose_page = await Task.compose_open_compose_page_standalone(browser);
    await Task.compose_fill_message(compose_page, 'human@flowcrypt.com', 'reused pubkey');
    await Task.compose_send_and_close(compose_page);
    log_test_step('tests:compose:reused pubkey');

    compose_page = await Task.compose_open_compose_page_standalone(browser);
    await Task.compose_fill_message(compose_page, 'human+nopgp@flowcrypt.com', 'unknown pubkey');
    await Task.compose_send_and_close(compose_page, 'test-pass');
    log_test_step('tests:compose:unknown pubkey');

    compose_page = await Task.compose_open_compose_page_standalone(browser);
    await compose_page.select_option('@input-from', 'flowcryptcompatibility@gmail.com');
    await Task.compose_fill_message(compose_page, 'human@flowcrypt.com', 'from alias');
    await Task.compose_send_and_close(compose_page);
    log_test_step('tests:compose:from alias');

    compose_page = await Task.compose_open_compose_page_standalone(browser);
    await Task.compose_fill_message(compose_page, 'human@flowcrypt.com', 'with files');
    let file_input = await compose_page.target.$('input[type=file]');
    await file_input!.uploadFile('test/samples/small.txt', 'test/samples/small.png', 'test/samples/small.pdf');
    await Task.compose_send_and_close(compose_page);
    log_test_step('tests:compose:with attachments');

    compose_page = await Task.compose_open_compose_page_standalone(browser);
    await Task.compose_fill_message(compose_page, 'human+nopgp@flowcrypt.com', 'with files + nonppg');
    file_input = await compose_page.target.$('input[type=file]');
    await file_input!.uploadFile('test/samples/small.txt', 'test/samples/small.png', 'test/samples/small.pdf');
    await Task.compose_send_and_close(compose_page, 'test-pass');
    log_test_step('tests:compose:with attachments+nopgp');

    compose_page = await Task.compose_open_compose_page_standalone(browser);
    await Task.compose_fill_message(compose_page, 'human@flowcrypt.com', 'signed message');
    await compose_page.click('@action-switch-to-sign');
    await Task.compose_send_and_close(compose_page);
    log_test_step('tests:compose:signed message');

    let settings_page = await browser.new_page(Url.extension_settings('flowcrypt.compatibility@gmail.com'));
    let compose_frame: Controllable;

    compose_frame = await Task.compose_open_compose_page_settings(settings_page);
    await Task.compose_fill_message(compose_frame, 'human+manualcopypgp@flowcrypt.com', 'manual copied key');
    await compose_frame.wait_and_click('@action-open-add-pubkey-dialog', {delay: 0.5});
    await compose_frame.wait_all('@dialog');
    let add_pubkey_dialog = await compose_frame.get_frame(['add_pubkey.htm']);
    await add_pubkey_dialog.wait_all('@input-select-copy-from');
    await add_pubkey_dialog.select_option('@input-select-copy-from', 'human@flowcrypt.com');
    await add_pubkey_dialog.wait_and_click('@action-add-pubkey');
    await compose_frame.wait_till_gone('@dialog');
    let alert = await settings_page.trigger_and_await_new_alert(() => compose_frame.wait_and_click('@action-send', {delay: 2}));
    await alert.accept();
    await settings_page.wait_till_gone('@dialog');
    log_test_step('tests:compose:manually copied pubkey');

    await tests.change_pass_phrase_requirement(settings_page, k.passphrase, 'session');

    compose_frame = await Task.compose_open_compose_page_settings(settings_page);
    await Task.compose_fill_message(compose_frame, 'human@flowcrypt.com', 'sign with entered pass phrase');
    await compose_frame.wait_and_click('@action-switch-to-sign', {delay: 0.5});
    await compose_frame.wait_and_click('@action-send');
    let passphrase_dialog = await settings_page.get_frame(['passphrase.htm']);
    await passphrase_dialog.wait_and_type('@input-pass-phrase', k.passphrase);
    alert = await settings_page.trigger_and_await_new_alert(() => passphrase_dialog.wait_and_click('@action-confirm-pass-phrase-entry')); // confirming pass phrase will send the message
    await alert.accept(); // toto - could be error alert for all I know - should distinguish
    await settings_page.wait_till_gone('@dialog'); // however the @dialog would not go away - so that is a (weak but sufficient) telling sign
    log_test_step('tests:compose:signed with entered pass phrase');

    compose_page = await Task.compose_open_compose_page_standalone(browser);
    await Task.compose_fill_message(compose_page, 'human@flowcrypt.com', 'signed message pp in session');
    await compose_page.click('@action-switch-to-sign'); // should remember pass phrase in session from previous entry
    await Task.compose_send_and_close(compose_page);
    log_test_step('tests:compose:signed message with pp in session');

    await tests.change_pass_phrase_requirement(settings_page, k.passphrase, 'storage');

    await settings_page.close();
  },
  initial_page_shows: async function(browser: BrowserHandle) {
    let initial_page = await browser.new_page_triggered_by(() => null); // the page triggered on its own
    await initial_page.wait_all('@initial-page'); // first page opened by flowcrypt
    await initial_page.close();
    log_test_step('tests:meta:initial page shows');
  },
  wait_till_gmail_loaded: async function (gmail_page: ControllablePage) {
    await gmail_page.wait_all('div.z0'); // compose button container visible
    await Util.sleep(3); // give it extra time to make sure FlowCrypt is initialized if it was supposed to
  },
  login_and_setup_tests: async function(browser: BrowserHandle) {
    // setup flowcrypt.test.key.new.manual@gmail.com
    const settings_page_0 = await browser.new_page(Url.extension_settings());
    let oauth_popup_0 = await browser.new_page_triggered_by(() => settings_page_0.wait_and_click('@action-connect-to-gmail'));
    await tests.handle_gmail_oauth(oauth_popup_0, 'flowcrypt.test.key.new.manual@gmail.com', 'close');
    log_test_step('tests:login_and_setup_tests:permissions page shows when oauth closed');
    await Task.close_settings_page_dialog(settings_page_0); // it is complaining that the oauth window was closed
    log_test_step('tests:login_and_setup_tests:permissions page can be closed');
    await settings_page_0.close();
    // open gmail, check that there is notification, close it, close gmail, reopen, check it's still there, proceed to set up through the link in it
    let gmail_page_0 = await browser.new_page(Url.gmail('flowcrypt.test.key.new.manual@gmail.com'));
    await tests.wait_till_gmail_loaded(gmail_page_0);
    await gmail_page_0.wait_all(['@webmail-notification', '@notification-setup-action-open-settings', '@notification-setup-action-dismiss', '@notification-setup-action-close']);
    log_test_step('tests:login_and_setup_tests:gmail setup notification shows up');
    await gmail_page_0.wait_and_click('@notification-setup-action-close', {confirm_gone: true});
    log_test_step('tests:login_and_setup_tests:gmail setup notification goes away when close clicked');
    await gmail_page_0.close();
    gmail_page_0 = await browser.new_page(Url.gmail('flowcrypt.test.key.new.manual@gmail.com'));
    await tests.wait_till_gmail_loaded(gmail_page_0);
    await gmail_page_0.wait_all(['@webmail-notification', '@notification-setup-action-open-settings', '@notification-setup-action-dismiss', '@notification-setup-action-close']);
    log_test_step('tests:login_and_setup_tests:gmail setup notification shows up again');
    let new_settings_page = await browser.new_page_triggered_by(() => gmail_page_0.wait_and_click('@notification-setup-action-open-settings'));
    log_test_step('tests:login_and_setup_tests:gmail setup notification link works');
    oauth_popup_0 = await browser.new_page_triggered_by(() => new_settings_page.wait_and_click('@action-connect-to-gmail'));
    await tests.handle_gmail_oauth(oauth_popup_0, 'flowcrypt.test.key.new.manual@gmail.com', 'approve');
    await tests.setup_manual_create(new_settings_page, 'flowcrypt.test.key.new.manual', 'none');
    await gmail_page_0.wait_all(['@webmail-notification', '@notification-successfully-setup-action-close']);
    log_test_step('tests:login_and_setup_tests:gmail success notification shows');
    await gmail_page_0.wait_and_click('@notification-successfully-setup-action-close', {confirm_gone: true});
    log_test_step('tests:login_and_setup_tests:gmail success notification goes away after click');
    await gmail_page_0.close();
    gmail_page_0 = await browser.new_page(Url.gmail('flowcrypt.test.key.new.manual@gmail.com'));
    await tests.wait_till_gmail_loaded(gmail_page_0);
    await gmail_page_0.not_present(['@webmail-notification', '@notification-setup-action-close', '@notification-successfully-setup-action-close']);
    log_test_step('tests:login_and_setup_tests:gmail success notification doesnt show up again');
    await gmail_page_0.close();
    await new_settings_page.close();

    // log in flowcrypt.compatibility, test that setup prompts can be disabled. Then proceed to set up
    const settings_page_1 = await browser.new_page(Url.extension_settings());
    let oauth_popup_1 = await browser.new_page_triggered_by(() => settings_page_1.wait_and_click('@action-add-account'));
    await tests.handle_gmail_oauth(oauth_popup_1, 'flowcrypt.compatibility@gmail.com', 'close');
    await Task.close_settings_page_dialog(settings_page_1);
    let gmail_page_1 = await browser.new_page(Url.gmail('flowcrypt.compatibility@gmail.com'));
    await tests.wait_till_gmail_loaded(gmail_page_1);
    await gmail_page_1.wait_all(['@webmail-notification', '@notification-setup-action-open-settings', '@notification-setup-action-dismiss', '@notification-setup-action-close']);
    await gmail_page_1.wait_and_click('@notification-setup-action-dismiss', {confirm_gone: true});
    log_test_step('tests:login_and_setup_tests:gmail setup notification goes away when dismiss clicked');
    await gmail_page_1.close();
    gmail_page_1 = await browser.new_page(Url.gmail('flowcrypt.compatibility@gmail.com'));
    await tests.wait_till_gmail_loaded(gmail_page_1);
    await gmail_page_1.not_present(['@webmail-notification', '@notification-setup-action-open-settings', '@notification-setup-action-dismiss', '@notification-setup-action-close']);
    await gmail_page_1.close();
    log_test_step('tests:login_and_setup_tests:gmail setup notification does not reappear if dismissed');
    oauth_popup_1 = await browser.new_page_triggered_by(() => settings_page_1.wait_and_click('@action-add-account'));
    await tests.handle_gmail_oauth(oauth_popup_1, 'flowcrypt.compatibility@gmail.com', 'approve');
    await tests.setup_recover(settings_page_1, 'flowcrypt.compatibility.1pp1', {more_to_recover: true});

    // setup flowcrypt.test.key.imported
    const oauth_popup_2 = await browser.new_page_triggered_by(() => settings_page_1.wait_and_click('@action-add-account'));
    await tests.handle_gmail_oauth(oauth_popup_2, 'flowcrypt.test.key.imported@gmail.com', 'approve');
    await tests.setup_manual_enter(settings_page_1, 'missing.self.signatures', {fix_key: true});

    // setup flowcrypt.test.key.used.pgp
    const oauth_popup_3 = await browser.new_page_triggered_by(() => settings_page_1.wait_and_click('@action-add-account'));
    await tests.handle_gmail_oauth(oauth_popup_3, 'flowcrypt.test.key.used.pgp@gmail.com', 'approve');
    await tests.setup_manual_enter(settings_page_1, 'flowcrypt.test.key.used.pgp', {used_pgp_before: true});

    // setup flowcrypt.test.key.recovered@gmail.com (+ test wrong pass phrase)
    const oauth_popup_4 = await browser.new_page_triggered_by(() => settings_page_1.wait_and_click('@action-add-account'));
    await tests.handle_gmail_oauth(oauth_popup_4, 'flowcrypt.test.key.recovered@gmail.com', 'approve');
    await tests.setup_recover(settings_page_1, 'flowcrypt.wrong.passphrase', {wrong_passphrase: true}); // test wrong pass phrase first
    await tests.setup_recover(settings_page_1, 'flowcrypt.test.key.recovered');
    await settings_page_1.close();
  },
  minimal_setup: async function(browser: BrowserHandle) {
    const settings_page = await browser.new_page(Url.extension_settings());
    let oauth_popup = await browser.new_page_triggered_by(() => settings_page.wait_and_click('@action-connect-to-gmail'));
    await tests.handle_gmail_oauth(oauth_popup, 'flowcrypt.compatibility@gmail.com', 'approve');
    await tests.setup_recover(settings_page, 'flowcrypt.compatibility.1pp1', {more_to_recover: true});
    await settings_page.close();
    log_test_step(`tests:minimal_setup`);
  },
  settings_contacts: async function(settings_page: ControllablePage) {
    await Task.toggle_settings_screen(settings_page, 'additional');
    let contacts_frame = await Task.open_settings_page_and_await_new_frame(settings_page, '@action-open-contacts-page' , ['contacts.htm', 'placement=settings']);
    await contacts_frame.wait_all('@page-contacts');
    await Util.sleep(1);
    assert((await contacts_frame.read('@page-contacts')).indexOf('flowcrypt.compatibility@gmail.com') !== -1, true, 'flowcrypt.compatibility@gmail.com listed as a contact');
    assert((await contacts_frame.read('@page-contacts')).indexOf('flowcryptcompatibility@gmail.com') !== -1, true, 'flowcryptcompatibility@gmail.com listed as a contact');
    await Task.close_settings_page_dialog(settings_page);
    await Task.toggle_settings_screen(settings_page, 'basic');
  },
  settings_attester: async function(settings_page: ControllablePage) {
    await Task.toggle_settings_screen(settings_page, 'additional');
    let attester_frame = await Task.open_settings_page_and_await_new_frame(settings_page, '@action-open-attester-page' , ['keyserver.htm', 'placement=settings']);
    await attester_frame.wait_all('@page-attester');
    await Util.sleep(1);
    await attester_frame.wait_till_gone('@spinner');
    await Util.sleep(1);
    assert((await attester_frame.read('@page-attester')).indexOf('flowcrypt.compatibility@gmail.com') !== -1, true, 'flowcrypt.compatibility@gmail.com listed in attester page');
    assert((await attester_frame.read('@page-attester')).indexOf('flowcryptcompatibility@gmail.com') !== -1, true, 'flowcryptcompatibility@gmail.com listed in attester page');
    await Task.close_settings_page_dialog(settings_page);
    await Task.toggle_settings_screen(settings_page, 'basic');
  },
  settings_tests: async function (browser: BrowserHandle) {
    let settings_page = await browser.new_page(Url.extension_settings());
    await Task.settings_switch_account(settings_page, 'flowcrypt.compatibility@gmail.com');
    await tests.settings_test_feedback_form(settings_page);
    await tests.settings_pass_phrase_test(settings_page, config_k('flowcrypt.wrong.passphrase').passphrase, false);
    await tests.settings_pass_phrase_test(settings_page, config_k('flowcrypt.compatibility.1pp1').passphrase, true);
    await tests.settings_my_key_tests(settings_page, 'flowcrypt.compatibility.1pp1', 'button');
    await tests.settings_my_key_tests(settings_page, 'flowcrypt.compatibility.1pp1', 'link');
    await tests.settings_contacts(settings_page);
    await tests.settings_attester(settings_page);
    await settings_page.close();
    log_test_step(`tests:settings:all`);
  },
  settings_my_key_tests: async function (settings_page: ControllablePage, expected_key_name: string, trigger: "button"|"link") {
    await Task.toggle_settings_screen(settings_page, 'additional');
    let my_key_frame = await Task.open_settings_page_and_await_new_frame(settings_page, trigger === 'button' ? '@action-open-pubkey-page' : '@action-show-key' , ['my_key.htm', 'placement=settings']);
    await Util.sleep(1);
    let k = config_k(expected_key_name);
    await my_key_frame.wait_all(['@content-key-words', '@content-armored-key']);
    assert(await my_key_frame.read('@content-key-words'), k.keywords, 'my_key page keywords');
    await my_key_frame.wait_and_click('@action-toggle-key-type(show private key)');
    assert((await my_key_frame.read('@content-armored-key')).indexOf('-----BEGIN PGP PRIVATE KEY BLOCK-----') !== -1, true, 'armored prv visible');
    await my_key_frame.wait_and_click('@action-toggle-key-type(show public key)');
    await Task.close_settings_page_dialog(settings_page);
    await Task.toggle_settings_screen(settings_page, 'basic');
    log_test_step(`tests:settings_my_key_tests:${trigger}`);
  },
  settings_pass_phrase_test: async function (settings_page: ControllablePage, passphrase: string, expect_match: boolean) {
    let security_frame = await Task.open_settings_page_and_await_new_frame(settings_page, '@action-open-security-page', ['security.htm', 'placement=settings']);
    await security_frame.wait_and_click('@action-test-passphrase-begin');
    await security_frame.wait_and_type('@input-test-passphrase', passphrase);
    let click = () => security_frame.wait_and_click('@action-test-passphrase');
    if(expect_match) {
      await click();
      await security_frame.wait_and_click('@action-test-passphrase-successful-close');
    } else {
      let dialog = await settings_page.trigger_and_await_new_alert(click);
      await dialog.accept();
      await Task.close_settings_page_dialog(settings_page);
    }
    await settings_page.wait_till_gone('@dialog');
    log_test_step(`tests:test_pass_phrase:expect-match-${expect_match}`);
  },
  change_pass_phrase_requirement: async function (settings_page: ControllablePage, passphrase: string, outcome: "session"|"storage") {
    let security_frame = await Task.open_settings_page_and_await_new_frame(settings_page, '@action-open-security-page', ['security.htm', 'placement=settings']);
    await security_frame.wait_all('@input-toggle-require-pass-phrase');
    await Util.sleep(1); // wait for form to init / fill
    let require_pass_phrase_is_checked = await security_frame.is_checked('@input-toggle-require-pass-phrase');
    if(require_pass_phrase_is_checked && outcome === 'session')
      throw Error('change_pass_phrase_requirement: already checked to be in session only');
    if(!require_pass_phrase_is_checked && outcome === 'storage')
      throw Error('change_pass_phrase_requirement: already checked to be in storage');
    await security_frame.click('@input-toggle-require-pass-phrase');
    await security_frame.wait_and_type('@input-confirm-pass-phrase', passphrase);
    await security_frame.wait_and_click('@action-confirm-pass-phrase-requirement-change');
    await Util.sleep(1); // frame will now reload
    await security_frame.wait_all('@input-toggle-require-pass-phrase');
    await Util.sleep(1); // wait to init
    require_pass_phrase_is_checked = await security_frame.is_checked('@input-toggle-require-pass-phrase');
    if(!require_pass_phrase_is_checked && outcome === 'session')
      throw Error('change_pass_phrase_requirement: did not remember to only save in sesion');
    if(require_pass_phrase_is_checked && outcome === 'storage')
      throw Error('change_pass_phrase_requirement: did not remember to save in storage');
    await Task.close_settings_page_dialog(settings_page);
    log_test_step(`tests:change_pass_phrase_requirement:${outcome}`);
  },
  settings_test_feedback_form: async function (page: ControllablePage) {
    await page.wait_and_click('@action-open-modules-help');
    await page.wait_all('@dialog');
    let help_frame = await page.get_frame(['help.htm']);
    await help_frame.wait_and_type('@input-feedback-message', 'automated puppeteer test: help form from settings footer');
    let dialog = await page.trigger_and_await_new_alert(() => help_frame.wait_and_click('@action-feedback-send'));
    await dialog.accept();
    log_test_step('tests:test_feedback_form:settings');
  },
  unit_tests: async (browser: BrowserHandle) => {
    let unit_test_page = await browser.new_page();
    let unit_tests = config.unit_tests;
    let all_ok = true;
    for(let ut of unit_tests) {
      let test_url = Url.extension(`chrome/dev/unit_test.htm?f=${ut.f}&args=${encodeURIComponent(JSON.stringify(ut.args))}`);
      await unit_test_page.goto(test_url);
      await unit_test_page.wait_for_selector_test_state('ready');
      let content = await unit_test_page.read('@unit-test-result');
      let r = JSON.parse(content);
      if(r.error === null && ordered_stringify(r.result) === ordered_stringify(ut.result)) {
        log_test_step(`tests:unit_test:${ut.name}`);
      } else {
        all_ok = false;
      }
    }
    await unit_test_page.close();
    if(all_ok) {
      log_test_step(`tests:unit_test`);
    } else {
      log_test_step(`tests:unit_test`, `some unit tests had failures`);
    }

  },
};