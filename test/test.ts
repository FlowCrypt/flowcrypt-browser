/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

import {Dialog, ElementHandle, Frame, Page, Browser} from "puppeteer";
const puppeteer = require('puppeteer');
const fs = require('fs');

interface Results { success: string[], error: string[], start: number}
interface ConfigInterface {
  extension_id: string,
  auth: { google: {email: string, password: string, backup: string}[],},
  keys: {title: string, passphrase: string, armored: string|null, keywords: string|null}[],
  messages: {name: string, content: string[], params: string}[],
}

let browser: Browser;
let results: Results = {success: [], error: [], start: Date.now()};
let gmail_login_sequence : string[] = [];
let assert = (received: any, expected: any, name: string) => { if(expected !== received) throw Error(`asserted ${name} to be "${String(expected)}" but got "${String(received)}"`); };

const meta = {
  url: {
    settings: (account_email?: string|undefined) => `chrome/settings/index.htm?account_email=${account_email || ''}`,
    gmail: function(account_email: string, url_end='') {
      return `https://mail.google.com/mail/u/${gmail_login_sequence.indexOf(account_email)}/#inbox${url_end}`;
    },
  },
  size: {width: 1280, height: 900},
  config: JSON.parse(fs.readFileSync('test/puppeteer.json', 'utf8')) as ConfigInterface,
  extension_url: function (path: string) {
    return `chrome-extension://${meta.config.extension_id}/${path}`;
  },
  _is_xpath: function(selector: string): boolean {
    return selector.match(/^\/\//) !== null;
  },
  _selector: function (custom_selector_language_query: string): string { // supply browser selector, xpath, @test-id or @test-id(contains this text)
    let m;
    if(meta._is_xpath(custom_selector_language_query)) {
      return custom_selector_language_query;
    } else if(m = custom_selector_language_query.match(/^@([a-z0-9\-]+)$/)) {
      return `[data-test="${m[1]}"]`;
    } else if(m = custom_selector_language_query.match(/^@([a-z0-9\-]+)\(([^()]*)\)$/)) {
      return `//*[@data-test='${m[1]}' and contains(text(),'${m[2]}')]`;
    } else {
      return custom_selector_language_query;
    }
  },
  _selector_test_state: function (state: string) {
    return `[data-test-state="${state}"]`;
  },
  _element: async function(page: Page|Frame, selector: string): Promise<ElementHandle|null> {
    selector = meta._selector(selector);
    if(meta._is_xpath(selector)) {
      return (await page.$x(selector))[0];
    } else {
      return await page.$(selector);
    }
  },
  _selectors_as_processed_array(selector: string|string[]): string[]  {
    return (Array.isArray(selector) ? selector : [selector]).map(meta._selector);
  },
  _k: function(title: string) {
    return meta.config.keys.filter(k => k.title === title)[0];
  },
  attr: async function (element_handle: ElementHandle, name: string): Promise<string> {
    return await (await element_handle.getProperty(name)).jsonValue();
  },
  sleep: function(seconds: number) {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
  },
  wait_all: async function (page: Page|Frame, selector: string|string[], {timeout=20, visible=true}: {timeout?: number, visible?: boolean}={}) {
    let selectors = meta._selectors_as_processed_array(selector);
    for(let i = 0; i < selectors.length; i++) {
      if (meta._is_xpath(selectors[i])) {
        await (page as any).waitForXPath(selectors[i], {timeout: timeout * 1000, visible: visible});  // @types/puppeteer doesn't know about page.waitForXPath
      } else {
        await page.waitForSelector(selectors[i], {timeout: timeout * 1000, visible: visible});
      }
    }
  },
  wait_any: async function (page: Page|Frame, selector: string|string[], {timeout=20, visible=true}: {timeout?: number, visible?: boolean}={}): Promise<ElementHandle> {
    timeout = Math.max(timeout, 1);
    let selectors = meta._selectors_as_processed_array(selector);
    while (timeout-- > 0) {
      try {
        for (let i = 0; i < selectors.length; i++) {
          let elements = await (meta._is_xpath(selectors[i]) ? page.$x(selectors[i]) : page.$$(selectors[i]));
          for (let j = 0; j < elements.length; j++) {
            if ((await elements[j].boundingBox()) !== null || !visible) { // element is visible
              return elements[j];
            }
          }
        }
      } catch (e) {
        if(e.message.indexOf('Cannot find context with specified id undefined') === -1) {
          throw e;
        }
      }
      await meta.sleep(0.5);
    }
    throw Error(`waiting failed: Elements did not appear: ${selectors.join(',')}`);
  },
  wait_till_gone: async function (page: Page|Frame, selector: string|string[], {timeout=5}: {timeout?: number}={timeout:30}) {
    let seconds_left = timeout;
    let selectors = Array.isArray(selector) ? selector : [selector];
    while(seconds_left-- >= 0) {
      try {
        await meta.wait_any(page, selectors, {timeout:0}); // if this fails, that means there are none left: return success
        await meta.sleep(1);
      } catch (e) {
        if(e.message.indexOf('waiting failed') === 0) {
          return;
        }
      }
    }
    throw Error(`meta.wait_till_gone: some of "${selectors.join(',')}" still present after timeout:${timeout}`);
  },
  not_present: async function(page: Page|Frame, selector: string|string[]) {
    await meta.wait_till_gone(page, selector, {timeout: 0});
  },
  click: async function (page: Page|Frame, selector: string) {
    let e = await meta._element(page, selector);
    if(!e) {
      throw Error(`Element not found: ${selector}`);
    }
    await e.click();
  },
  type: async function (page: Page|Frame, selector: string, text: string, letter_by_letter=false) {
    let e = await meta._element(page, selector);
    if(!e) {
      throw Error(`Element not found: ${selector}`);
    }
    if(letter_by_letter || text.length < 20) {
      await e.type(text);
    } else {
      await page.evaluate((s, t) => {let e = document.querySelector(s); e[e.tagName === 'DIV' ? 'innerText' : 'value']=t;}, meta._selector(selector), text.substring(0, text.length - 10));
      await e.type(text.substring(text.length - 10, text.length));
    }
  },
  value: async function(page: Page|Frame, selector: string): Promise<string> {
    return await page.evaluate((s) => { let e = document.querySelector(s); if(e.tagName==='SELECT') {return e.options[e.selectedIndex].value} else {return e.value} }, meta._selector(selector));
  },
  is_checked: async function(page: Page|Frame, selector: string): Promise<boolean> {
    return await page.evaluate((s) => document.querySelector(s).checked, meta._selector(selector));
  },
  read: async function (page: Page|Frame, selector: string) {
    return await page.evaluate((s) => document.querySelector(s).innerText, meta._selector(selector));
  },
  select_option: async function (page: Page|Frame, selector: string, choice: string) {
    await page.evaluate((s, v) => jQuery(s).val(v).trigger('change'), meta._selector(selector), choice);
  },
  wait_and_type: async function (page: Page|Frame, selector: string, text: string, {delay=0.1}: {delay?: number}={}) {
    await meta.wait_all(page, selector);
    await meta.sleep(delay);
    await meta.type(page, selector, text);
  },
  wait_and_click: async function (page: Page|Frame, selector: string, {delay=0.1, confirm_gone=false}: {delay?: number, confirm_gone?: boolean}={}) {
    await meta.wait_all(page, selector);
    await meta.sleep(delay);
    await meta.click(page, selector);
    if(confirm_gone) {
      await meta.wait_till_gone(page, selector);
    }
  },
  log: (text: string, error?: string|undefined) => {
    if(!error) {
      console.log(`[ok] ${text}`);
      results.success.push(text);
    } else {
      console.error(`[error] ${text} (${String(error)})`);
      results.error.push(`${text}|${String(error)}`);
    }
  },
  finish: function () {
    let time = `in ${Math.round((Date.now() - results.start) / (1000 * 60))}m`;
    if(results.error.length) {
      console.log(`failed:${results.error.length} ${time}`);
    } else {
      console.log(`success ${time}`);
    }
  },
  random: () => Math.random().toString(36).substring(7),
  _trigger_and_await_new_page: function (browser: Browser, triggering_action = function () {}): Promise<Page> { // may be a tab or popup
    return new Promise((resolve) => {
      let resolved = 0;
      browser.on('targetcreated', async (target) => {
        if(target.type() === 'page') {
          if(!resolved++) {
            resolve(target.page());
          }
        }
      });
      triggering_action();
    });
  },
  trigger_and_await_new_page: async function (browser: Browser, triggering_action = function () {}): Promise<Page> { // may be a tab or popup
    let page = await meta._trigger_and_await_new_page(browser, triggering_action);
    await page.setViewport(meta.size);
    return page;
  },
  trigger_and_await_new_alert: function (page: Page, triggering_action = function () {}): Promise<Dialog> {
    return new Promise((resolve) => {
      page.on('dialog', resolve);
      triggering_action();
    });
  },
  new_page: async function(url?: string) {
    const page = await browser.newPage();
    await page.setViewport(meta.size);
    if(url) {
      await page.goto(url.indexOf('https://') === 0 ? url : meta.extension_url(url));
    }
    return page;
  },
  get_frame: async function(page: Page|Frame, url_matchables: string[], {sleep=1}={sleep: 1}): Promise<Frame> {
    if(sleep) {
      await meta.sleep(sleep);
    }
    let frames;
    if(page.constructor.name === 'Page') {
      frames = await (page as Page).frames();
    } else if(page.constructor.name === 'Frame') {
      frames = await (page as Frame).childFrames();
    } else {
      throw Error(`Unknown page.constructor.name: ${page.constructor.name}`);
    }
    let frame = frames.find(frame => {
      for(let i = 0; i < url_matchables.length; i++) {
        if(frame.url().indexOf(url_matchables[i]) === -1) {
          return false;
        }
      }
      return true;
    });
    if(frame) {
      return frame;
    }
    throw Error(`Frame not found: ${url_matchables.join(',')}`);
  },
  close_browser: async() => {
    await setTimeout(async() => {
      await browser.close();
      meta.log('close_browser');
      meta.finish();
    }, 5000);
  },
  compose: {
    open_compose_page_standalone: async function(): Promise<Page> {
      let compose_page = await meta.new_page();
      await compose_page.goto(meta.extension_url('chrome/elements/compose.htm?account_email=flowcrypt.compatibility%40gmail.com'));
      await meta.wait_all(compose_page, ['@input-body', '@input-to', '@input-subject', '@action-send']);
      await meta.wait_all(compose_page, meta._selector_test_state('ready')); // wait until page ready
      return compose_page;
    },
    open_compose_page_settings: async function(settings_page: Page): Promise<Frame> {
      await meta.wait_and_click(settings_page, '@action-show-compose-page');
      await meta.wait_all(settings_page, '@dialog');
      let compose_frame = await meta.get_frame(settings_page, ['compose.htm']);
      await meta.wait_all(compose_frame, ['@input-body', '@input-to', '@input-subject', '@action-send']);
      await meta.wait_all(compose_frame, meta._selector_test_state('ready')); // wait until page ready
      return compose_frame;
    },
    change_default_sending_address: async function (compose_page: Page, new_default: string) {
      await meta.wait_and_click(compose_page, '@action-open-sending-address-settings');
      await meta.wait_all(compose_page, '@dialog');
      let sending_address_frame = await meta.get_frame(compose_page, ['sending_address.htm']);
      await meta.wait_and_click(sending_address_frame, `@action-choose-address(${new_default})`);
      await meta.sleep(0.5); // page reload
      await meta.wait_and_click(sending_address_frame, '@action-close-sending-address-settings');
      await meta.wait_till_gone(compose_page, '@dialog');
    },
    fill_message: async function (compose_page_or_frame: Page|Frame, to: string|null, subject: string) {
      if(to) {
        await meta.type(compose_page_or_frame, '@input-to', to);
      }
      await meta.click(compose_page_or_frame, '@input-subject');
      await meta.type(compose_page_or_frame, '@input-subject', `Automated puppeteer test: ${subject}`);
      await meta.type(compose_page_or_frame, '@input-body', `This is an automated puppeteer test: ${subject}`);
    },
    send_and_close: async function (compose_page: Page, password?: string|undefined) {
      if(password) {
        await meta.wait_and_type(compose_page, '@input-password', 'test-pass');
        await meta.wait_and_click(compose_page, '@action-send', {delay: 0.5}); // in real usage, also have to click two times when using password - why?
      }
      await meta.wait_and_click(compose_page, '@action-send', {delay: 0.5});
      await meta.wait_all(compose_page, meta._selector_test_state('closed'), {timeout: 60}); // wait until page closed
      await compose_page.close();
    },
  }
};

const tests = {
  oauth_password_delay: 2,
  handle_gmail_oauth: async function(oauth_page: Page, account_email: string, action: "close"|"deny"|"approve") {
    let selectors = {
      backup_email_verification_choice: "//div[@class='vdE7Oc' and text() = 'Confirm your recovery email']",
      approve_button: '#submit_approve_access',
    };
    let auth = meta.config.auth.google.filter(a => a.email === account_email)[0];
    await meta.wait_all(oauth_page, '#Email, #submit_approve_access, #identifierId, .w6VTHd');
    if (await oauth_page.$('#Email') !== null) {
      await meta.wait_all(oauth_page, '#Email', {timeout: 60});
      await meta.wait_and_type(oauth_page, '#Email', auth['email']);
      await meta.wait_and_click(oauth_page, '#next');
      await meta.sleep(tests.oauth_password_delay);
      await meta.wait_and_type(oauth_page, '#Passwd', auth['password'], {delay: tests.oauth_password_delay});
      await meta.wait_and_click(oauth_page, '#signIn', {delay: 1})
    } else if (await oauth_page.$('#identifierId') !== null) {
      await meta.wait_all(oauth_page, '#identifierId', {timeout: 60});
      await meta.wait_and_type(oauth_page, '#identifierId', auth['email'], {delay: 2});
      await meta.wait_and_click(oauth_page, '.zZhnYe', {delay: 2});  // confirm email
      await meta.sleep(tests.oauth_password_delay);
      await meta.wait_and_type(oauth_page, '.zHQkBf', auth['password'], {delay: tests.oauth_password_delay});
      await meta.wait_and_click(oauth_page, '.CwaK9', {delay: 1});  // confirm password
    } else if (await oauth_page.$('.w6VTHd') !== null) { // select from accounts where already logged in
      await meta.wait_and_click(oauth_page, '.bLzI3e', {delay: 1}); // choose other account, also try .TnvOCe .k6Zj8d .XraQ3b
      await meta.sleep(2);
      await tests.handle_gmail_oauth(oauth_page, account_email, action); // start from beginning after clicking "other email acct"
      return;
    }
    let element = await meta.wait_any(oauth_page, [selectors.approve_button, selectors.backup_email_verification_choice]);
    await meta.sleep(1);
    if((await oauth_page.$x(selectors.backup_email_verification_choice)).length) { // asks for registered backup email
      await element.click();
      await meta.wait_and_type(oauth_page, '#knowledge-preregistered-email-response', auth.backup, {delay: 2});
      await meta.wait_and_click(oauth_page, '#next', {delay: 2});
      await meta.wait_all(oauth_page, '#submit_approve_access');
    }
    if(gmail_login_sequence.indexOf(account_email) === -1) {
      gmail_login_sequence.push(account_email);
    }
    if(action === 'close') {
      await oauth_page.close()
    } else if(action === 'deny') {
      throw Error('tests.handle_gmail_oauth options.deny.true not implemented');
    } else {
      await meta.wait_and_click(oauth_page, '#submit_approve_access', {delay: 1});
    }
    meta.log(`tests:handle_gmail_oauth:${account_email}:${action}`)
  },
  setup_recover: async function(settings_page: Page, key_title: string, {wrong_passphrase=false, more_to_recover=false}: {wrong_passphrase?: boolean, more_to_recover?: boolean}={}) {
    let k = meta._k(key_title);
    await meta.wait_and_type(settings_page, '@input-recovery-pass-phrase', k.passphrase);
    if(wrong_passphrase) {
      let dialog = await meta.trigger_and_await_new_alert(settings_page, () => meta.wait_and_click(settings_page, '@action-recover-account'));
      await dialog.accept();
    } else {
      await meta.wait_and_click(settings_page, '@action-recover-account');
      await meta.wait_and_click(settings_page, more_to_recover ? '@action-step4more-account-settings' : '@action-step4done-account-settings');
    }
    meta.log(`tests:setup_recover:${key_title}`);
  },
  setup_manual_enter: async function(settings_page: Page, key_title: string, {used_pgp_before=false, submit_pubkey=false, fix_key=false}: {used_pgp_before?: boolean, submit_pubkey?: boolean, fix_key?: boolean}={}) {
    let k = meta._k(key_title);
    if(used_pgp_before) {
      await meta.wait_and_click(settings_page, '@action-step0foundkey-choose-manual-enter');
    } else {
      await meta.wait_and_click(settings_page, '@action-step1easyormanual-choose-manual-enter');
    }
    await meta.wait_and_click(settings_page, '@input-step2bmanualenter-source-paste');
    await meta.wait_and_type(settings_page, '@input-step2bmanualenter-ascii-key', k.armored || '');
    await meta.wait_and_type(settings_page, '@input-step2bmanualenter-passphrase', k.passphrase);
    if(!submit_pubkey) {
      await meta.wait_and_click(settings_page, '@input-step2bmanualenter-submit-pubkey'); // uncheck
    }
    await meta.wait_and_click(settings_page, '@input-step2bmanualenter-save', {delay: 1});
    if(fix_key) {
      await meta.wait_all(settings_page, '@input-compatibility-fix-expire-years');
      await meta.select_option(settings_page, '@input-compatibility-fix-expire-years', '1');
      await meta.wait_and_click(settings_page, '@action-fix-and-import-key');
    }
    await meta.wait_and_click(settings_page, '@action-step4done-account-settings');
    meta.log(`tests:setup_manual_enter:${key_title}:used_pgp_before=${used_pgp_before},submit_pubkey=${submit_pubkey},fix_key=${fix_key}`);
  },
  setup_manual_create: async function(settings_page: Page|Frame, key_title: string, backup: "none"|"email"|"file", {used_pgp_before=false, submit_pubkey=false}: {used_pgp_before?: boolean, submit_pubkey?: boolean}={}) {
    let k = meta._k(key_title);
    if(used_pgp_before) {
      await meta.wait_and_click(settings_page, '@action-step0foundkey-choose-manual-create');
    } else {
      await meta.wait_and_click(settings_page, '@action-step1easyormanual-choose-manual-create');
    }
    await meta.wait_and_type(settings_page, '@input-step2bmanualcreate-passphrase-1', k.passphrase);
    await meta.wait_and_type(settings_page, '@input-step2bmanualcreate-passphrase-2', k.passphrase);
    if(!submit_pubkey) {
      await meta.wait_and_click(settings_page, '@input-step2bmanualcreate-submit-pubkey'); // uncheck
    }
    await meta.wait_and_click(settings_page, '@input-step2bmanualcreate-create-and-save');
    if(backup === 'none') {
      await meta.wait_and_click(settings_page, '@input-backup-step3manual-no-backup');
    } else if(backup === 'email') {
      throw Error('tests.setup_manual_create options.backup=email not implemented');
    } else if(backup === 'file') {
      throw Error('tests.setup_manual_create options.backup=file not implemented');
    }
    await meta.wait_and_click(settings_page, '@action-backup-step3manual-continue');
    await meta.wait_and_click(settings_page, '@action-step4done-account-settings');
    meta.log(`tests:setup_manual_create:${key_title}:backup=${backup},used_pgp_before=${used_pgp_before},submit_pubkey=${submit_pubkey}`);
  },
  pgp_block_tests: async function() {
    let pgp_block_page = await meta.new_page();
    let messages = meta.config.messages;
    let all_ok = true;
    for(let i = 0; i < messages.length; i++) {
      let m = messages[i];
      let test_url = meta.extension_url('chrome/elements/pgp_block.htm') + m.params;
      await pgp_block_page.goto(test_url);
      await meta.wait_all(pgp_block_page, '@pgp-block-content');
      await meta.wait_all(pgp_block_page, meta._selector_test_state('ready'), {timeout: 30}); // wait for 30s until decryption done
      await meta.sleep(1);
      let content = await meta.read(pgp_block_page, '@pgp-block-content');
      let ok = true;
      for(let j = 0; j < m.content.length; j++) {
        if(content.indexOf(m.content[j]) === -1) {
          meta.log(`tests:pgp_block:${m.name}`, `missing expected content:${m.content[j]}`);
          ok = false;
          all_ok = false;
        }
      }
      if(ok) {
        meta.log(`tests:pgp_block:${m.name}`);
      }
    }
    await pgp_block_page.close();
    if(all_ok) {
      meta.log(`tests:pgp_block`);
    } else {
      meta.log(`tests:pgp_block`, `some decrypt tests had failures`);
    }
  },
  gmail_tests: async function() {
    // standard gmail
    let gmail_page = await meta.new_page(meta.url.gmail('flowcrypt.compatibility@gmail.com'));
    await meta.wait_and_click(gmail_page, '@action-secure-compose', {delay: 1});
    await meta.wait_all(gmail_page, '@container-new-message');
    meta.log('tests:gmail:secure compose button (mail.google.com)');

    // let compose_frame = await meta.get_frame(gmail_page, ['compose.htm']);
    // meta.compose.fill_message(compose_frame, 'human@flowcrypt.com', 'message from gmail');
    // await meta.wait_and_click(compose_frame, '@action-send', {delay: 0.5});
    // await meta.wait_till_gone(gmail_page, '@container-new-message');
    // await meta.wait_all(gmail_page, '@webmail-notification'); // message sent
    // assert(await meta.read(gmail_page, '@webmail-notification'), 'Your encrypted message has been sent.', 'gmail notifiaction message');
    // await meta.click(gmail_page, '@webmail-notification');
    // await meta.wait_till_gone(gmail_page, '@webmail-notification');
    // meta.log('tests:gmail:secure compose works from gmail + compose frame disappears + notification shows + notification disappears');

    // google inbox - need to hover over the button first
    // await gmail_page.goto('https://inbox.google.com');
    // await meta.wait_and_click(gmail_page, '@action-secure-compose', 1);
    // await meta.wait(gmail_page, '@container-new-message');
    // meta.log('gmail:tests:secure compose button (inbox.google.com)');

    await gmail_page.close();
  },
  compose_tests: async function() {
    let k = meta._k('flowcrypt.compatibility.1pp1');
    let compose_page: Page;

    compose_page = await meta.compose.open_compose_page_standalone();
    await meta.compose.change_default_sending_address(compose_page, 'flowcrypt.compatibility@gmail.com');
    await compose_page.close();
    compose_page = await meta.compose.open_compose_page_standalone();
    let currently_selected_from = await meta.value(compose_page, '@input-from');
    if(currently_selected_from !== 'flowcrypt.compatibility@gmail.com')
      throw Error('did not remember selected from addr: flowcrypt.compatibility@gmail.com');
    await meta.compose.change_default_sending_address(compose_page, 'flowcryptcompatibility@gmail.com');
    await compose_page.close();
    compose_page = await meta.compose.open_compose_page_standalone();
    currently_selected_from = await meta.value(compose_page, '@input-from');
    if(currently_selected_from !== 'flowcryptcompatibility@gmail.com')
      throw Error('did not remember selected from addr: flowcryptcompatibility@gmail.com');
    await meta.compose.change_default_sending_address(compose_page, 'flowcrypt.compatibility@gmail.com');
    await compose_page.close();
    await meta.log('tests:compose:can set and remember default send address');

    compose_page = await meta.compose.open_compose_page_standalone();
    await meta.type(compose_page, '@input-to', 'human'); // test loading of contacts
    await meta.wait_all(compose_page, ['@container-contacts', '@action-select-contact(human@flowcrypt.com)']);
    meta.log('tests:compose:can load contact based on name');
    await meta.wait_and_click(compose_page, '@action-select-contact(human@flowcrypt.com)', {delay: 1}); // select a contact
    meta.log('tests:compose:can choose found contact');
    await meta.compose.fill_message(compose_page, null, 'freshly loaded pubkey');
    await meta.compose.send_and_close(compose_page);
    meta.log('tests:compose:fresh pubkey');

    compose_page = await meta.compose.open_compose_page_standalone();
    await meta.compose.fill_message(compose_page, 'human@flowcrypt.com', 'reused pubkey');
    await meta.compose.send_and_close(compose_page);
    meta.log('tests:compose:reused pubkey');

    compose_page = await meta.compose.open_compose_page_standalone();
    await meta.compose.fill_message(compose_page, 'human+nopgp@flowcrypt.com', 'unknown pubkey');
    await meta.compose.send_and_close(compose_page, 'test-pass');
    meta.log('tests:compose:unknown pubkey');

    compose_page = await meta.compose.open_compose_page_standalone();
    await meta.select_option(compose_page, '@input-from', 'flowcryptcompatibility@gmail.com');
    await meta.compose.fill_message(compose_page, 'human@flowcrypt.com', 'from alias');
    await meta.compose.send_and_close(compose_page);
    meta.log('tests:compose:from alias');

    compose_page = await meta.compose.open_compose_page_standalone();
    await meta.compose.fill_message(compose_page, 'human@flowcrypt.com', 'with files');
    let file_input = await compose_page.$('input[type=file]');
    await file_input!.uploadFile('test/samples/small.txt', 'test/samples/small.png', 'test/samples/small.pdf');
    await meta.compose.send_and_close(compose_page);
    meta.log('tests:compose:with attachments');

    compose_page = await meta.compose.open_compose_page_standalone();
    await meta.compose.fill_message(compose_page, 'human+nopgp@flowcrypt.com', 'with files + nonppg');
    file_input = await compose_page.$('input[type=file]');
    await file_input!.uploadFile('test/samples/small.txt', 'test/samples/small.png', 'test/samples/small.pdf');
    await meta.compose.send_and_close(compose_page, 'test-pass');
    meta.log('tests:compose:with attachments+nopgp');

    compose_page = await meta.compose.open_compose_page_standalone();
    await meta.compose.fill_message(compose_page, 'human@flowcrypt.com', 'signed message');
    await meta.click(compose_page, '@action-switch-to-sign');
    await meta.compose.send_and_close(compose_page);
    meta.log('tests:compose:signed message');

    let settings_page = await meta.new_page(meta.url.settings('flowcrypt.compatibility@gmail.com'));
    let compose_frame : Page|Frame;

    compose_frame = await meta.compose.open_compose_page_settings(settings_page);
    await meta.compose.fill_message(compose_frame, 'human+manualcopypgp@flowcrypt.com', 'manual copied key');
    await meta.wait_and_click(compose_frame, '@action-open-add-pubkey-dialog', {delay: 0.5});
    await meta.wait_all(compose_frame, '@dialog');
    let add_pubkey_dialog = await meta.get_frame(compose_frame, ['add_pubkey.htm']);
    await meta.wait_all(add_pubkey_dialog, '@input-select-copy-from');
    await meta.select_option(add_pubkey_dialog, '@input-select-copy-from', 'human@flowcrypt.com');
    await meta.wait_and_click(add_pubkey_dialog, '@action-add-pubkey');
    await meta.wait_till_gone(compose_frame, '@dialog');
    let alert = await meta.trigger_and_await_new_alert(settings_page, () => meta.wait_and_click(compose_frame, '@action-send', {delay: 2}));
    await alert.accept();
    await meta.wait_till_gone(settings_page, '@dialog');
    meta.log('tests:compose:manually copied pubkey');

    await tests.change_pass_phrase_requirement(settings_page, k.passphrase, 'session');

    compose_frame = await meta.compose.open_compose_page_settings(settings_page);
    await meta.compose.fill_message(compose_frame, 'human@flowcrypt.com', 'sign with entered pass phrase');
    await meta.wait_and_click(compose_frame, '@action-switch-to-sign', {delay: 0.5});
    await meta.wait_and_click(compose_frame, '@action-send');
    let passphrase_dialog = await meta.get_frame(settings_page, ['passphrase.htm']);
    await meta.wait_and_type(passphrase_dialog, '@input-pass-phrase', k.passphrase);
    alert = await meta.trigger_and_await_new_alert(settings_page, () => meta.wait_and_click(passphrase_dialog, '@action-confirm-pass-phrase-entry')); // confirming pass phrase will send the message
    await alert.accept(); // toto - could be error alert for all I know - should distinguish
    await meta.wait_till_gone(settings_page, '@dialog'); // however the @dialog would not go away - so that is a (weak but sufficient) telling sign
    meta.log('tests:compose:signed with entered pass phrase');

    compose_page = await meta.compose.open_compose_page_standalone();
    await meta.compose.fill_message(compose_page, 'human@flowcrypt.com', 'signed message pp in session');
    await meta.click(compose_page, '@action-switch-to-sign'); // should remember pass phrase in session from previous entry
    await meta.compose.send_and_close(compose_page);
    meta.log('tests:compose:signed message with pp in session');

    await tests.change_pass_phrase_requirement(settings_page, k.passphrase, 'storage');

    await settings_page.close();
  },
  initial_page_shows: async function() {
    let initial_page = await meta.trigger_and_await_new_page(browser);
    await meta.wait_all(initial_page, '@initial-page'); // first page opened by flowcrypt
    await initial_page.close();
    meta.log('tests:meta:initial page shows');
  },
  wait_till_gmail_loaded: async function (gmail_page: Page) {
    await meta.wait_all(gmail_page, 'div.z0'); // compose button container visible
    await meta.sleep(3); // give it extra time to make sure FlowCrypt is initialized if it was supposed to
  },
  login_and_setup_tests: async function() {
    // setup flowcrypt.test.key.new.manual@gmail.com
    const settings_page_0 = await meta.new_page(meta.url.settings());
    let oauth_popup_0 = await meta.trigger_and_await_new_page(browser, () => meta.wait_and_click(settings_page_0, '@action-connect-to-gmail'));
    await tests.handle_gmail_oauth(oauth_popup_0, 'flowcrypt.test.key.new.manual@gmail.com', 'close');
    meta.log('tests:login_and_setup_tests:permissions page shows when oauth closed');
    await tests._close_settings_page_dialog(settings_page_0); // it is complaining that the oauth window was closed
    meta.log('tests:login_and_setup_tests:permissions page can be closed');
    await settings_page_0.close();
    // open gmail, check that there is notification, close it, close gmail, reopen, check it's still there, proceed to set up through the link in it
    let gmail_page_0 = await meta.new_page(meta.url.gmail('flowcrypt.test.key.new.manual@gmail.com'));
    await tests.wait_till_gmail_loaded(gmail_page_0);
    await meta.wait_all(gmail_page_0, ['@webmail-notification', '@notification-setup-action-open-settings', '@notification-setup-action-dismiss', '@notification-setup-action-close']);
    meta.log('tests:login_and_setup_tests:gmail setup notification shows up');
    await meta.wait_and_click(gmail_page_0, '@notification-setup-action-close', {confirm_gone: true});
    meta.log('tests:login_and_setup_tests:gmail setup notification goes away when close clicked');
    await gmail_page_0.close();
    gmail_page_0 = await meta.new_page(meta.url.gmail('flowcrypt.test.key.new.manual@gmail.com'));
    await tests.wait_till_gmail_loaded(gmail_page_0);
    await meta.wait_all(gmail_page_0, ['@webmail-notification', '@notification-setup-action-open-settings', '@notification-setup-action-dismiss', '@notification-setup-action-close']);
    meta.log('tests:login_and_setup_tests:gmail setup notification shows up again');
    let new_settings_page = await meta.trigger_and_await_new_page(browser, () => meta.wait_and_click(gmail_page_0, '@notification-setup-action-open-settings'));
    meta.log('tests:login_and_setup_tests:gmail setup notification link works');
    oauth_popup_0 = await meta.trigger_and_await_new_page(browser, () => meta.wait_and_click(new_settings_page, '@action-connect-to-gmail'));
    await tests.handle_gmail_oauth(oauth_popup_0, 'flowcrypt.test.key.new.manual@gmail.com', 'approve');
    await tests.setup_manual_create(new_settings_page, 'flowcrypt.test.key.new.manual', 'none');
    await meta.wait_all(gmail_page_0, ['@webmail-notification', '@notification-successfully-setup-action-close']);
    meta.log('tests:login_and_setup_tests:gmail success notification shows');
    await meta.wait_and_click(gmail_page_0, '@notification-successfully-setup-action-close', {confirm_gone: true});
    meta.log('tests:login_and_setup_tests:gmail success notification goes away after click');
    await gmail_page_0.close();
    gmail_page_0 = await meta.new_page(meta.url.gmail('flowcrypt.test.key.new.manual@gmail.com'));
    await tests.wait_till_gmail_loaded(gmail_page_0);
    await meta.not_present(gmail_page_0, ['@webmail-notification', '@notification-setup-action-close', '@notification-successfully-setup-action-close']);
    meta.log('tests:login_and_setup_tests:gmail success notification doesnt show up again');
    await gmail_page_0.close();
    await new_settings_page.close();

    // log in flowcrypt.compatibility, test that setup prompts can be disabled. Then proceed to set up
    const settings_page_1 = await meta.new_page(meta.url.settings());
    let oauth_popup_1 = await meta.trigger_and_await_new_page(browser, () => meta.wait_and_click(settings_page_1, '@action-add-account'));
    await tests.handle_gmail_oauth(oauth_popup_1, 'flowcrypt.compatibility@gmail.com', 'close');
    await tests._close_settings_page_dialog(settings_page_1);
    let gmail_page_1 = await meta.new_page(meta.url.gmail('flowcrypt.compatibility@gmail.com'));
    await tests.wait_till_gmail_loaded(gmail_page_1);
    await meta.wait_all(gmail_page_1, ['@webmail-notification', '@notification-setup-action-open-settings', '@notification-setup-action-dismiss', '@notification-setup-action-close']);
    await meta.wait_and_click(gmail_page_1, '@notification-setup-action-dismiss', {confirm_gone: true});
    meta.log('tests:login_and_setup_tests:gmail setup notification goes away when dismiss clicked');
    await gmail_page_1.close();
    gmail_page_1 = await meta.new_page(meta.url.gmail('flowcrypt.compatibility@gmail.com'));
    await tests.wait_till_gmail_loaded(gmail_page_1);
    await meta.not_present(gmail_page_1, ['@webmail-notification', '@notification-setup-action-open-settings', '@notification-setup-action-dismiss', '@notification-setup-action-close']);
    await gmail_page_1.close();
    meta.log('tests:login_and_setup_tests:gmail setup notification does not reappear if dismissed');
    oauth_popup_1 = await meta.trigger_and_await_new_page(browser, () => meta.wait_and_click(settings_page_1, '@action-add-account'));
    await tests.handle_gmail_oauth(oauth_popup_1, 'flowcrypt.compatibility@gmail.com', 'approve');
    await tests.setup_recover(settings_page_1, 'flowcrypt.compatibility.1pp1', {more_to_recover: true});

    // setup flowcrypt.test.key.imported
    const oauth_popup_2 = await meta.trigger_and_await_new_page(browser, () => meta.wait_and_click(settings_page_1, '@action-add-account'));
    await tests.handle_gmail_oauth(oauth_popup_2, 'flowcrypt.test.key.imported@gmail.com', 'approve');
    await tests.setup_manual_enter(settings_page_1, 'missing.self.signatures', {fix_key: true});

    // setup flowcrypt.test.key.used.pgp
    const oauth_popup_3 = await meta.trigger_and_await_new_page(browser, () => meta.wait_and_click(settings_page_1, '@action-add-account'));
    await tests.handle_gmail_oauth(oauth_popup_3, 'flowcrypt.test.key.used.pgp@gmail.com', 'approve');
    await tests.setup_manual_enter(settings_page_1, 'flowcrypt.test.key.used.pgp', {used_pgp_before: true});

    // setup flowcrypt.test.key.recovered@gmail.com (+ test wrong pass phrase)
    const oauth_popup_4 = await meta.trigger_and_await_new_page(browser, () => meta.wait_and_click(settings_page_1, '@action-add-account'));
    await tests.handle_gmail_oauth(oauth_popup_4, 'flowcrypt.test.key.recovered@gmail.com', 'approve');
    await tests.setup_recover(settings_page_1, 'flowcrypt.wrong.passphrase', {wrong_passphrase: true}); // test wrong pass phrase first
    await tests.setup_recover(settings_page_1, 'flowcrypt.test.key.recovered');
    await settings_page_1.close();
  },
  minimal_setup: async function() {
    const settings_page = await meta.new_page(meta.url.settings());
    let oauth_popup = await meta.trigger_and_await_new_page(browser, () => meta.wait_and_click(settings_page, '@action-connect-to-gmail'));
    await tests.handle_gmail_oauth(oauth_popup, 'flowcrypt.compatibility@gmail.com', 'approve');
    await tests.setup_recover(settings_page, 'flowcrypt.compatibility.1pp1', {more_to_recover: true});
    await settings_page.close();
    meta.log(`tests:minimal_setup`);
  },
  settings_contacts: async function(settings_page: Page) {
    await tests._toggle_settings_screen(settings_page, 'additional');
    let contacts_frame = await tests._open_settings_page_and_await_new_frame(settings_page, '@action-open-contacts-page' , ['contacts.htm', 'placement=settings']);
    await meta.wait_all(contacts_frame, '@page-contacts');
    await meta.sleep(1);
    assert((await meta.read(contacts_frame, '@page-contacts')).indexOf('flowcrypt.compatibility@gmail.com') !== -1, true, 'flowcrypt.compatibility@gmail.com listed as a contact');
    assert((await meta.read(contacts_frame, '@page-contacts')).indexOf('flowcryptcompatibility@gmail.com') !== -1, true, 'flowcryptcompatibility@gmail.com listed as a contact');
    await tests._close_settings_page_dialog(settings_page);
    await tests._toggle_settings_screen(settings_page, 'basic');
  },
  settings_attester: async function(settings_page: Page) {
    await tests._toggle_settings_screen(settings_page, 'additional');
    let attester_frame = await tests._open_settings_page_and_await_new_frame(settings_page, '@action-open-attester-page' , ['keyserver.htm', 'placement=settings']);
    await meta.wait_all(attester_frame, '@page-attester');
    await meta.sleep(1);
    await meta.wait_till_gone(attester_frame, '@spinner');
    await meta.sleep(1);
    assert((await meta.read(attester_frame, '@page-attester')).indexOf('flowcrypt.compatibility@gmail.com') !== -1, true, 'flowcrypt.compatibility@gmail.com listed in attester page');
    assert((await meta.read(attester_frame, '@page-attester')).indexOf('flowcryptcompatibility@gmail.com') !== -1, true, 'flowcryptcompatibility@gmail.com listed in attester page');
    await tests._close_settings_page_dialog(settings_page);
    await tests._toggle_settings_screen(settings_page, 'basic');
  },
  settings_tests: async function () {
    let settings_page = await meta.new_page(meta.url.settings());
    await tests._settings_switch_account(settings_page, 'flowcrypt.compatibility@gmail.com');
    await tests.settings_test_feedback_form(settings_page);
    await tests.settings_pass_phrase_test(settings_page, meta._k('flowcrypt.wrong.passphrase').passphrase, false);
    await tests.settings_pass_phrase_test(settings_page, meta._k('flowcrypt.compatibility.1pp1').passphrase, true);
    await tests.settings_my_key_tests(settings_page, 'flowcrypt.compatibility.1pp1', 'button');
    await tests.settings_my_key_tests(settings_page, 'flowcrypt.compatibility.1pp1', 'link');
    await tests.settings_contacts(settings_page);
    await tests.settings_attester(settings_page);
    await settings_page.close();
    meta.log(`tests:settings:all`);
  },
  _close_settings_page_dialog: async function(settings_page: Page) {
    await meta.wait_and_click(settings_page, '@dialog-close');
    await meta.wait_till_gone(settings_page, '@dialog');
  },
  settings_my_key_tests: async function (settings_page: Page, expected_key_name: string, trigger: "button"|"link") {
    await tests._toggle_settings_screen(settings_page, 'additional');
    let my_key_frame = await tests._open_settings_page_and_await_new_frame(settings_page, trigger === 'button' ? '@action-open-pubkey-page' : '@action-show-key' , ['my_key.htm', 'placement=settings']);
    await meta.sleep(1);
    let k = meta._k(expected_key_name);
    await meta.wait_all(my_key_frame, ['@content-key-words', '@content-armored-key']);
    assert(await meta.read(my_key_frame, '@content-key-words'), k.keywords, 'my_key page keywords');
    await meta.wait_and_click(my_key_frame, '@action-view-armored-key');
    assert((await meta.read(my_key_frame, '@content-armored-key')).indexOf('-----BEGIN PGP PUBLIC KEY BLOCK-----') !== -1, true, 'armored pubkey visible');
    await meta.wait_and_click(my_key_frame, '@action-toggle-key-type(show private key)');
    assert((await meta.read(my_key_frame, '@content-armored-key')).indexOf('-----BEGIN PGP PRIVATE KEY BLOCK-----') !== -1, true, 'armored prv visible');
    await meta.wait_and_click(my_key_frame, '@action-toggle-key-type(show public key)');
    await meta.wait_and_click(my_key_frame, '@action-view-armored-key');
    assert((await meta.read(my_key_frame, '@content-armored-key')).indexOf('-----BEGIN PGP PUBLIC KEY BLOCK-----') !== -1, true, 'armored pubkey visible');
    await tests._close_settings_page_dialog(settings_page);
    await tests._toggle_settings_screen(settings_page, 'basic');
    meta.log(`tests:settings_my_key_tests:${trigger}`);
  },
  _toggle_settings_screen: async function(settings_page: Page, to: "basic"|"additional") {
    await meta.wait_and_click(settings_page, to === 'basic' ? '@action-toggle-screen-basic' : '@action-toggle-screen-additional'); // switch
    await meta.wait_all(settings_page, to === 'basic' ? '@action-toggle-screen-additional' : '@action-toggle-screen-basic'); // wait for opposite button to show up
  },
  _open_settings_page_and_await_new_frame: async function (settings_page: Page, action_button_selector: string, frame_url_filter: string[]): Promise<Frame> {
    await meta.wait_and_click(settings_page, action_button_selector);
    await meta.wait_all(settings_page, '@dialog');
    return await meta.get_frame(settings_page, frame_url_filter); // placement=settings to differentiate from mini-security frame in settings
  },
  settings_pass_phrase_test: async function (settings_page: Page, passphrase: string, expect_match: boolean) {
    let security_frame = await tests._open_settings_page_and_await_new_frame(settings_page, '@action-open-security-page', ['security.htm', 'placement=settings']);
    await meta.wait_and_click(security_frame, '@action-test-passphrase-begin');
    await meta.wait_and_type(security_frame, '@input-test-passphrase', passphrase);
    let click = () => meta.wait_and_click(security_frame, '@action-test-passphrase');
    if(expect_match) {
      await click();
      await meta.wait_and_click(security_frame, '@action-test-passphrase-successful-close');
    } else {
      let dialog = await meta.trigger_and_await_new_alert(settings_page, click);
      await dialog.accept();
      await tests._close_settings_page_dialog(settings_page);
    }
    await meta.wait_till_gone(settings_page, '@dialog');
    meta.log(`tests:test_pass_phrase:expect-match-${expect_match}`);
  },
  change_pass_phrase_requirement: async function (settings_page: Page, passphrase: string, outcome: "session"|"storage") {
    let security_frame = await tests._open_settings_page_and_await_new_frame(settings_page, '@action-open-security-page', ['security.htm', 'placement=settings']);
    await meta.wait_all(security_frame, '@input-toggle-require-pass-phrase');
    await meta.sleep(1); // wait for form to init / fill
    let require_pass_phrase_is_checked = await meta.is_checked(security_frame, '@input-toggle-require-pass-phrase');
    if(require_pass_phrase_is_checked && outcome === 'session')
      throw Error('change_pass_phrase_requirement: already checked to be in session only');
    if(!require_pass_phrase_is_checked && outcome === 'storage')
      throw Error('change_pass_phrase_requirement: already checked to be in storage');
    await meta.click(security_frame, '@input-toggle-require-pass-phrase');
    await meta.wait_and_type(security_frame, '@input-confirm-pass-phrase', passphrase);
    await meta.wait_and_click(security_frame, '@action-confirm-pass-phrase-requirement-change');
    await meta.sleep(1); // frame will now reload
    await meta.wait_all(security_frame, '@input-toggle-require-pass-phrase');
    await meta.sleep(1); // wait to init
    require_pass_phrase_is_checked = await meta.is_checked(security_frame, '@input-toggle-require-pass-phrase');
    if(!require_pass_phrase_is_checked && outcome === 'session')
      throw Error('change_pass_phrase_requirement: did not remember to only save in sesion');
    if(require_pass_phrase_is_checked && outcome === 'storage')
      throw Error('change_pass_phrase_requirement: did not remember to save in storage');
    await tests._close_settings_page_dialog(settings_page);
    meta.log(`tests:change_pass_phrase_requirement:${outcome}`);
  },
  _settings_switch_account: async function (settings_page: Page, account_email: string) {
    await meta.wait_and_click(settings_page, '@action-toggle-accounts-menu');
    await meta.wait_and_click(settings_page, `@action-switch-to-account(${account_email})`);
    meta.log(`tests:switch_settings_account:${account_email}`);
  },
  settings_test_feedback_form: async function (page: Page) {
    await meta.wait_and_click(page, '@action-open-modules-help');
    await meta.wait_all(page, '@dialog');
    let help_frame = await meta.get_frame(page, ['help.htm']);
    await meta.wait_and_type(help_frame, '@input-feedback-message', 'automated puppeteer test: help form from settings footer');
    let dialog = await meta.trigger_and_await_new_alert(page, () => meta.wait_and_click(help_frame, '@action-feedback-send'));
    await dialog.accept();
    meta.log('tests:test_feedback_form:settings');
  },
};

(async() => {

  browser = await puppeteer.launch({
    args: [
      '--disable-features=site-per-process', // ext frames in gmail: https://github.com/GoogleChrome/puppeteer/issues/2506 https://github.com/GoogleChrome/puppeteer/issues/2548
      '--disable-extensions-except=build/chrome',
      '--load-extension=build/chrome',
      `--window-size=${meta.size.width+10},${meta.size.height+132}`,
    ],
    headless: false, // to run headless-like: "xvfb-run node test.js"
    slowMo: 50,
    // devtools: true,
  });

  // await tests.initial_page_shows();
  // await tests.minimal_setup();
  // await tests.gmail_tests();

  await tests.initial_page_shows();
  await tests.login_and_setup_tests();
  await tests.settings_tests();
  await tests.pgp_block_tests();
  await tests.compose_tests();
  await tests.gmail_tests();
  await meta.close_browser();

})();
