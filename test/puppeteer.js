/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

const puppeteer = require('puppeteer');
const fs = require('fs');

let browser;
let results = {
  success: [],
  error: [],
};

const extension = {
  config: JSON.parse(fs.readFileSync('test/puppeteer.json', 'utf8')),
  url: function (path) {
    return 'chrome-extension://' + this.config.extension_id + '/' + path;
  },
  selector: function (name_or_selector) {
    if(name_or_selector[0] === '@') {
      return '[data-test="' + name_or_selector.substr(1) + '"]';  // element name for testing
    } else {
      return name_or_selector; // actual selector
    }
  },
  selector_test_state: function (state) {
    return '[data-test-state="' + state + '"]';
  },
};

const meta = {
  sleep: function(seconds) {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
  },
  wait: async function (page, selector, timeout=20, visible=true) {
    let selectors = Array.isArray(selector) ? selector : [selector];
    for(let i = 0; i < selectors.length; i++) {
      await page.waitForSelector(extension.selector(selectors[i]), {timeout: timeout * 1000, visible: visible});
    }
  },
  click: async function (page, selector) {
    await page.click(extension.selector(selector));
  },
  type: async function (page, selector, text) {
    await page.type(extension.selector(selector), text);
  },
  read: async function (page, selector) {
    return await page.evaluate(`document.querySelector('${extension.selector(selector)}').innerText`);
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
 };

const actions = {
  approve_gmail_oauth: async function(account_email, callback) {
    let auth = extension.config.auth.google.filter(a => a.email === account_email)[0];
    return async(target) => {
      meta.sleep(5);
      let oauth_page = await target.page();
      await meta.wait(oauth_page, '#Email, #submit_approve_access, #identifierId, .w6VTHd');
      if (await oauth_page.$('#Email') !== null) {
        await meta.wait(oauth_page, '#Email', 60);
        await meta.wait_and_type(oauth_page, '#Email', auth['email']);
        await meta.wait_and_click(oauth_page, '#next');
        await meta.sleep(5);
        await meta.wait_and_type(oauth_page, '#Passwd', auth['password'], 5);
        await meta.wait_and_click(oauth_page, '#signIn', 1);
      } else if (await oauth_page.$('#identifierId') !== null) {
        await meta.wait(oauth_page, '#identifierId', 60);
        await meta.wait_and_type(oauth_page, '#identifierId', auth['email'], 2);
        await meta.wait_and_click(oauth_page, '.zZhnYe', 2);  // confirm email
        await meta.sleep(5);
        await meta.wait_and_type(oauth_page, '.zHQkBf', auth['password'], 5);
        await meta.wait_and_click(oauth_page, '.CwaK9', 1);  // confirm password
      } else if (await oauth_page.$('.w6VTHd') !== null) {
        await meta.wait_and_click(oauth_page, '.w6VTHd', 1);  // select first email account
      }
      await meta.wait(oauth_page, '#submit_approve_access', 60);
      await meta.wait_and_click(oauth_page, '#submit_approve_access', 1);
      meta.log('approve_gmail_oauth');
      callback();
    };
  },
  setup_recover: async function(settings_page, key_n) {
    await settings_page.bringToFront();
    await meta.wait_and_type(settings_page, '@input-recovery-pass-phrase', extension.config.keys[key_n].passphrase);
    await meta.wait_and_click(settings_page, '@action-recover-account');
    await meta.wait_and_click(settings_page, '@action-step4more-account-settings');
    meta.log('setup_recover');
  },
  pgp_block_tests: async function() {
    let pgp_block_page = await this.new_page();
    let messages = extension.config.messages;
    let all_ok = true;
    for(let i = 0; i < messages.length; i++) {
      let m = messages[i];
      await pgp_block_page.goto(extension.url('chrome/elements/pgp_block.htm') + m.params);
      await meta.wait(pgp_block_page, '@pgp-block-content');
      await meta.wait(pgp_block_page, extension.selector_test_state('ready')); // wait until decryption done
      await meta.sleep(1);
      let content = await meta.read(pgp_block_page, '@pgp-block-content');
      let ok = true;
      for(let j = 0; j < m.content.length; j++) {
        if(content.indexOf(m.content[j]) === -1) {
          meta.log(`pgp_block_tests:${m.name}`, `missing expected content:${m.content[j]}`);
          ok = false;
          all_ok = false;
        }
      }
      if(ok) {
        meta.log(`pgp_block_tests:${m.name}`);
      }
    }
    await pgp_block_page.close();
    if(all_ok) {
      meta.log(`pgp_block_tests`);
    } else {
      meta.log(`pgp_block_tests`, `some decrypt tests had failures`);
    }
  },
  compose_tests: async function() {
    let compose_page = await this.new_page();
    let compose_url = extension.url('chrome/elements/compose.htm?account_email=flowcrypt.compatibility%40gmail.com');

    await meta.sleep(1);
    await compose_page.goto(compose_url);
    await meta.wait(compose_page, ['@input-body', '@input-to', '@input-subject', '@action-send']);
    await meta.wait(compose_page, extension.selector_test_state('ready')); // wait until page ready
    await meta.type(compose_page, '@input-to', 'human@flowcrypt.com');
    await meta.click(compose_page, '@input-subject');
    await meta.type(compose_page, '@input-subject', 'Automated puppeteer test: freshly loaded pubkey: ' + meta.random());
    await meta.type(compose_page, '@input-body', 'This is an automated puppeteer test sent to a freshly loaded public key');
    await meta.click(compose_page, '@action-send');
    await meta.wait(compose_page, extension.selector_test_state('closed')); // wait until page closed
    // await compose_page.close();
    meta.log('compose:tests:fresh pubkey');

    await meta.sleep(1);
    await compose_page.goto(compose_url);
    await meta.wait(compose_page, ['@input-body', '@input-to', '@input-subject', '@action-send']);
    await meta.wait(compose_page, extension.selector_test_state('ready')); // wait until page ready
    await meta.type(compose_page, '@input-to', 'human@flowcrypt.com');
    await meta.click(compose_page, '@input-subject');
    await meta.type(compose_page, '@input-subject', 'Automated puppeteer test: reused pubkey: ' + meta.random());
    await meta.type(compose_page, '@input-body', 'This is an automated puppeteer test sent to a reused public key');
    await meta.click(compose_page, '@action-send');
    await meta.wait(compose_page, extension.selector_test_state('closed')); // wait until page closed
    // await compose_page.close();
    meta.log('compose:tests:reused pubkey');

    await meta.sleep(1);
    await compose_page.goto(compose_url);
    await meta.wait(compose_page, ['@input-body', '@input-to', '@input-subject', '@action-send']);
    await meta.wait(compose_page, extension.selector_test_state('ready')); // wait until page ready
    await meta.type(compose_page, '@input-to', 'human+test@flowcrypt.com');
    await meta.click(compose_page, '@input-subject');
    await meta.type(compose_page, '@input-subject', 'Automated puppeteer test: unknown pubkey: ' + meta.random());
    await meta.type(compose_page, '@input-body', 'This is an automated puppeteer test sent to a person without a pubkey');
    await meta.wait_and_type(compose_page, '@input-password', 'test-pass');
    await meta.wait_and_click(compose_page, '@action-send', 1);
    await meta.wait_and_click(compose_page, '@action-send', 1);  // in real usage, also have to click two times when using password - why?
    await meta.wait(compose_page, extension.selector_test_state('closed')); // wait until page closed
    meta.log('compose:tests:unknown pubkey');

    await compose_page.close();
  },
  new_page: async function(url) {
    const page = await browser.newPage();
    await page.bringToFront();
    await page.setViewport(meta.size);
    if(url) {
      await page.goto(extension.url(url));
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


(async() => {

  browser = await puppeteer.launch({
    args: [
      '--disable-extensions-except=chrome',
      '--load-extension=chrome',
      `--window-size=${meta.size.width},${meta.size.height}`,
    ],
    headless: false,
    slowMo: 40,
  });

  const settings_page = await actions.new_page('chrome/settings/index.htm');
  meta.wait_and_click(settings_page, '@action-connect-to-gmail');
  browser.once('targetcreated', await actions.approve_gmail_oauth('flowcrypt.compatibility@gmail.com', async() => {
    await actions.setup_recover(settings_page, 2);
    await actions.pgp_block_tests();
    await actions.compose_tests();
    await actions.close_browser();
  }));


})();
