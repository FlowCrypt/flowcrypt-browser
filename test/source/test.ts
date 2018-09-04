/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

import * as ava from 'ava';
import {BrowserHandle, BrowserPool, Semaphore} from './browser';
import {BrowserRecipe} from './tests/browser_recipe';
import {define_unit_tests} from './tests/tests/unit';
import {define_setup_tests} from './tests/tests/setup';
import {define_compose_tests} from './tests/tests/compose';
import {define_decrypt_tests} from './tests/tests/decrypt';
import {define_gmail_tests} from './tests/tests/gmail';
import {define_settings_tests} from './tests/tests/settings';
import {define_elements_tests} from './tests/tests/elements';
import {define_account_tests} from './tests/tests/account';
import {Config} from './util';
import {FlowCryptApi} from './tests/api';

type GlobalBrowserGroup = 'compatibility'|'trial';
export type GlobalBrowser = {browser?: BrowserHandle, semaphore: Semaphore, before_each_test: () => Promise<void>};

let test_timeout = 5 * 60 * 1000;
let browser_pool = new BrowserPool(5);
let browser_global: {[group: string]: GlobalBrowser} = {
  compatibility: {
    browser: undefined,
    semaphore: new Semaphore(1),
    before_each_test: async () => undefined,
  },
  trial: {
    browser: undefined,
    semaphore: new Semaphore(1),
    before_each_test: async () => {
      await FlowCryptApi.hook_ci_account_delete(Config.secrets.ci_dev_account);
      if(browser_global.trial.browser) { // a new browser for each trial test
        await browser_global.trial.browser.close();
      }
      browser_global.trial.browser = await browser_pool.new_browser_handle();
    },
  },
};

ava.before('set up global browser and config', async t => {
  Config.extension_id = await browser_pool.get_extension_id();
  browser_global.compatibility.browser = await browser_pool.new_browser_handle();
  await BrowserRecipe.set_up_flowcrypt_compatibility_account(browser_global.compatibility.browser!);
  t.pass();
});

export let test_with_new_browser = (cb: (browser: BrowserHandle, t: ava.ExecutionContext<{}>) => Promise<void>): ava.Implementation<{}> => {
  return async (t: ava.ExecutionContext<{}>) => {
    await browser_pool.with_new_browser_timeout_and_retry(cb, t, test_timeout);
    t.pass();
  };
};

export let test_with_semaphored_global_browser = (group: GlobalBrowserGroup, cb: (browser: BrowserHandle, t: ava.ExecutionContext<{}>) => Promise<void>): ava.Implementation<{}> => {
  return async (t: ava.ExecutionContext<{}>) => {
    await browser_global[group].semaphore.acquire();
    try {
      await browser_pool.with_global_browser_timeout_and_retry(browser_global[group], cb, t, test_timeout);
      t.pass();
    } finally {
      browser_global[group].semaphore.release();
    }
  };
};

define_setup_tests(test_with_new_browser, test_with_semaphored_global_browser);
define_unit_tests(test_with_new_browser, test_with_semaphored_global_browser);
define_compose_tests(test_with_new_browser, test_with_semaphored_global_browser);
define_decrypt_tests(test_with_new_browser, test_with_semaphored_global_browser);
define_gmail_tests(test_with_new_browser, test_with_semaphored_global_browser);
define_settings_tests(test_with_new_browser, test_with_semaphored_global_browser);
define_elements_tests(test_with_new_browser, test_with_semaphored_global_browser);
define_account_tests(test_with_new_browser, test_with_semaphored_global_browser);
