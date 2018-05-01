/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

const puppeteer = require('puppeteer');
const fs = require('fs');

let browser;
let results = {
  success: [],
  error: [],
};

const meta = {
  config: JSON.parse(fs.readFileSync('test/puppeteer.json', 'utf8')),
  extension_url: function (path) {
    return 'chrome-extension://' + this.config.extension_id + '/' + path;
  },
  _selector: function (name_or_selector) {
    if(name_or_selector[0] === '@') {
      return '[data-test="' + name_or_selector.substr(1) + '"]';  // element name for testing
    } else {
      return name_or_selector; // actual selector
    }
  },
  _selector_test_state: function (state) {
    return '[data-test-state="' + state + '"]';
  },
  sleep: function(seconds) {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
  },
  wait: async function (page, selector, timeout=20, visible=true) {
    let selectors = Array.isArray(selector) ? selector : [selector];
    for(let i = 0; i < selectors.length; i++) {
      await page.waitForSelector(meta._selector(selectors[i]), {timeout: timeout * 1000, visible: visible});
    }
  },
  click: async function (page, selector) {
    await page.click(meta._selector(selector));
  },
  type: async function (page, selector, text, letter_by_letter=false) {
    if(letter_by_letter || text.length < 20) {
      await page.type(meta._selector(selector), text);
    } else {
      await page.evaluate((s, t) => document.querySelector(s).value = t, meta._selector(selector), text.substring(0, text.length - 10));
      await page.type(meta._selector(selector), text.substring(text.length - 10, text.length));
    }
  },
  read: async function (page, selector) {
    return await page.evaluate((s) => document.querySelector(s).innerText, meta._selector(selector));
  },
  select: async function(page, selector, value) {
    return await page.evaluate((s, v) => window.jQuery(s).val(v), meta._selector(selector), value);
  },
  wait_and_type: async function (page, selector, text, delay=0) {
    await this.wait(page, selector);
    if(delay) {
      await this.sleep(delay);
    }
    await this.type(page, selector, text);
  },
  wait_and_click: async function (page, selector, delay=0) {
    await this.wait(page, selector);
    if(delay) {
      await this.sleep(delay);
    }
    await this.click(page, selector);
  },
  log: (text, error) => {
    if(!error) {
      console.log('[ok] ' + text);
      results.success.push(text);
    } else {
      console.error('[error] ' + text + '(' + String(error) + ')');
      results.error.push(text + '|' + String(error));
    }
  },
  size: {width: 1280, height: 900},
  finish: function () {
    if(results.error.length) {
      console.log('failed:' + results.error.length);
    } else {
      console.log('success');
    }
  },
  random: () => Math.random().toString(36).substring(7),
  await_new_page: function (browser, triggering_action = function () {}) { // may be a tab or popup
    return new Promise((resolve, reject) => {
      browser.on('targetcreated', target => {
        if(target.type() === 'page') {
          resolve(target.page());
        }
      });
      triggering_action();
    });
  },
  new_page: async function(url) {
    const page = await browser.newPage();
    await page.bringToFront();
    await page.setViewport(meta.size);
    if(url) {
      await page.goto(url.indexOf('https://') === 0 ? url : meta.extension_url(url));
    }
    return page;
  },
  close_browser: async() => {
    await setTimeout(async() => {
      await browser.close();
      meta.log('close_browser');
      meta.finish();
    }, 5000);
  },
 };

const tests = {
  oauth_password_delay: 1,
  approve_gmail_oauth: async function(oauth_page, account_email) {
    let auth = meta.config.auth.google.filter(a => a.email === account_email)[0];
    await meta.wait(oauth_page, '#Email, #submit_approve_access, #identifierId, .w6VTHd');
    if (await oauth_page.$('#Email') !== null) {
      await meta.wait(oauth_page, '#Email', 60);
      await meta.wait_and_type(oauth_page, '#Email', auth['email']);
      await meta.wait_and_click(oauth_page, '#next');
      await meta.sleep(this.oauth_password_delay);
      await meta.wait_and_type(oauth_page, '#Passwd', auth['password'], this.oauth_password_delay);
      await meta.wait_and_click(oauth_page, '#signIn', 1);
    } else if (await oauth_page.$('#identifierId') !== null) {
      await meta.wait(oauth_page, '#identifierId', 60);
      await meta.wait_and_type(oauth_page, '#identifierId', auth['email'], 2);
      await meta.wait_and_click(oauth_page, '.zZhnYe', 2);  // confirm email
      await meta.sleep(this.oauth_password_delay);
      await meta.wait_and_type(oauth_page, '.zHQkBf', auth['password'], this.oauth_password_delay);
      await meta.wait_and_click(oauth_page, '.CwaK9', 1);  // confirm password
    } else if (await oauth_page.$('.w6VTHd') !== null) { // select from accounts where already logged in
      await meta.wait_and_click(oauth_page, '.bLzI3e', 1); // choose other account, also try .TnvOCe .k6Zj8d .XraQ3b
      await meta.sleep(2);
      return await this.approve_gmail_oauth(oauth_page, account_email); // start from beginning after clicking "other email acct"
    }
    await meta.wait(oauth_page, '#submit_approve_access', 60);
    await meta.wait_and_click(oauth_page, '#submit_approve_access', 1);
    meta.log('tests:approve_gmail_oauth:' + account_email);
  },
  setup_recover: async function(settings_page, key_title) {
    await settings_page.bringToFront();
    let k = meta.config.keys.filter(k => k.title === key_title)[0];
    await meta.wait_and_type(settings_page, '@input-recovery-pass-phrase', k.passphrase);
    await meta.wait_and_click(settings_page, '@action-recover-account');
    await meta.wait_and_click(settings_page, '@action-step4more-account-settings');
    meta.log('tests:setup_recover:' + key_title);
  },
  setup_manual_enter: async function(settings_page, key_title, options={}) {
    await settings_page.bringToFront();
    let k = meta.config.keys.filter(k => k.title === key_title)[0];
    await meta.wait_and_click(settings_page, '@action-step1easyormanual-choose-manual-enter');
    await meta.wait_and_click(settings_page, '@input-step2bmanualenter-source-paste');
    await meta.wait_and_type(settings_page, '@input-step2bmanualenter-ascii-key', k.armored);
    await meta.wait_and_type(settings_page, '@input-step2bmanualenter-passphrase', k.passphrase);
    if(!options.submit_pubkey) {
      await meta.wait_and_click(settings_page, '@input-step2bmanualenter-submit-pubkey'); // uncheck
    }
    await meta.wait_and_click(settings_page, '@input-step2bmanualenter-save', 1);
    if(options.fix_key) {
      await meta.wait(settings_page, '@input-compatibility-fix-expire-years');
      await meta.select(settings_page, '@input-compatibility-fix-expire-years', '1');
      await meta.wait_and_click(settings_page, '@action-fix-and-import-key');
    }
    await meta.wait_and_click(settings_page, '@action-step4done-account-settings');
    meta.log('tests:setup_manual_enter:' + key_title);
  },
  pgp_block_tests: async function() {
    let pgp_block_page = await meta.new_page();
    let messages = meta.config.messages;
    let all_ok = true;
    for(let i = 0; i < messages.length; i++) {
      let m = messages[i];
      await pgp_block_page.goto(meta.extension_url('chrome/elements/pgp_block.htm') + m.params);
      await meta.wait(pgp_block_page, '@pgp-block-content');
      await meta.wait(pgp_block_page, meta._selector_test_state('ready'), 30); // wait for 30s until decryption done
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
    let gmail_page = await meta.new_page('https://mail.google.com');
    await meta.wait_and_click(gmail_page, '@action-secure-compose', 1);
    await meta.wait(gmail_page, '@container-new-message');
    meta.log('tests:gmail:secure compose button (mail.google.com)');

    // google inbox - need to hover over the button first
    // await gmail_page.goto('https://inbox.google.com');
    // await meta.wait_and_click(gmail_page, '@action-secure-compose', 1);
    // await meta.wait(gmail_page, '@container-new-message');
    // meta.log('gmail:tests:secure compose button (inbox.google.com)');

    await gmail_page.close();
  },
  compose_tests: async function() {
    let compose_page = await meta.new_page();
    let compose_url = meta.extension_url('chrome/elements/compose.htm?account_email=flowcrypt.compatibility%40gmail.com');

    await meta.sleep(1);
    await compose_page.goto(compose_url);
    await meta.wait(compose_page, ['@input-body', '@input-to', '@input-subject', '@action-send']);
    await meta.wait(compose_page, meta._selector_test_state('ready')); // wait until page ready
    await meta.type(compose_page, '@input-to', 'human@flowcrypt.com');
    await meta.click(compose_page, '@input-subject');
    await meta.type(compose_page, '@input-subject', 'Automated puppeteer test: freshly loaded pubkey: ' + meta.random());
    await meta.type(compose_page, '@input-body', 'This is an automated puppeteer test sent to a freshly loaded public key');
    await meta.click(compose_page, '@action-send');
    await meta.wait(compose_page, meta._selector_test_state('closed')); // wait until page closed
    meta.log('tests:compose:fresh pubkey');

    await meta.sleep(1);
    await compose_page.goto(compose_url);
    await meta.wait(compose_page, ['@input-body', '@input-to', '@input-subject', '@action-send']);
    await meta.wait(compose_page, meta._selector_test_state('ready')); // wait until page ready
    await meta.type(compose_page, '@input-to', 'human@flowcrypt.com');
    await meta.click(compose_page, '@input-subject');
    await meta.type(compose_page, '@input-subject', 'Automated puppeteer test: reused pubkey: ' + meta.random());
    await meta.type(compose_page, '@input-body', 'This is an automated puppeteer test sent to a reused public key');
    await meta.click(compose_page, '@action-send');
    await meta.wait(compose_page, meta._selector_test_state('closed')); // wait until page closed
    meta.log('tests:compose:reused pubkey');

    await meta.sleep(1);
    await compose_page.goto(compose_url);
    await meta.wait(compose_page, ['@input-body', '@input-to', '@input-subject', '@action-send']);
    await meta.wait(compose_page, meta._selector_test_state('ready')); // wait until page ready
    await meta.type(compose_page, '@input-to', 'human+test@flowcrypt.com');
    await meta.click(compose_page, '@input-subject');
    await meta.type(compose_page, '@input-subject', 'Automated puppeteer test: unknown pubkey: ' + meta.random());
    await meta.type(compose_page, '@input-body', 'This is an automated puppeteer test sent to a person without a pubkey');
    await meta.wait_and_type(compose_page, '@input-password', 'test-pass');
    await meta.wait_and_click(compose_page, '@action-send', 1);
    await meta.wait_and_click(compose_page, '@action-send', 1);  // in real usage, also have to click two times when using password - why?
    await meta.wait(compose_page, meta._selector_test_state('closed')); // wait until page closed
    meta.log('tests:compose:unknown pubkey');

    await compose_page.close();
  },
  initial_page_shows: async function() {
    await meta.wait(await meta.await_new_page(browser), '@initial-page'); // first page opened by flowcrypt, comes second
    meta.log('tests:meta:initial page shows');
  },
};


(async() => {

  browser = await puppeteer.launch({
    args: [
      '--disable-extensions-except=chrome',
      '--load-extension=chrome',
      `--window-size=${meta.size.width},${meta.size.height}`,
    ],
    headless: false,
    slowMo: 50,
  });

  await tests.initial_page_shows();

  const settings_page = await meta.new_page('chrome/settings/index.htm');

  // setup flowcrypt.compatibility
  const oauth_popup_1 = await meta.await_new_page(browser, () => meta.wait_and_click(settings_page, '@action-connect-to-gmail'));
  await tests.approve_gmail_oauth(oauth_popup_1, 'flowcrypt.compatibility@gmail.com');
  await tests.setup_recover(settings_page, 'flowcrypt.compatibility.1pp1');

  // setup flowcrypt.test.key.imported
  const oauth_popup_2 = await meta.await_new_page(browser, () => meta.wait_and_click(settings_page, '@action-add-account'));
  await tests.approve_gmail_oauth(oauth_popup_2, 'flowcrypt.test.key.imported@gmail.com');
  await tests.setup_manual_enter(settings_page, 'missing.self.signatures', {fix_key: true});

  // specific tests
  await tests.pgp_block_tests();
  await tests.compose_tests();
  await tests.gmail_tests();

  await meta.close_browser();

})();
