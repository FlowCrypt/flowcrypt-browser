/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

import * as ava from 'ava';
import { BrowserHandle, BrowserPool, Semaphore } from './browser';
import { BrowserRecipe } from './tests/browser_recipe';
import { defineUnitTests } from './tests/tests/unit';
import { defineSetupTests } from './tests/tests/setup';
import { defineComposeTests } from './tests/tests/compose';
import { defineDecryptTests } from './tests/tests/decrypt';
import { defineGmailTests } from './tests/tests/gmail';
import { defineSettingsTests } from './tests/tests/settings';
import { defineElementTests } from './tests/tests/elements';
import { defineAcctTests } from './tests/tests/account';
import { Config } from './util';
import { FlowCryptApi } from './tests/api';

type GlobalBrowserGroup = 'compatibility' | 'trial';
export type GlobalBrowser = { browsers: BrowserPool, beforeEachTest: () => Promise<void> };

const TEST_TIMEOUT = 3 * 60 * 1000;
const POOL_SIZE = 8;
const POOL_SIZE_GLOBAL = 2;

const browserPool = new BrowserPool(POOL_SIZE, 'browserPool', false);
const browserGlobal: { [group: string]: GlobalBrowser } = {
  compatibility: {
    browsers: new BrowserPool(POOL_SIZE_GLOBAL, 'browserPoolGlobal', true),
    beforeEachTest: async () => undefined,
  },
  trial: {
    browsers: new BrowserPool(1, 'browserPoolTrial', true),
    beforeEachTest: async () => {
      await FlowCryptApi.hookCiAcctDelete(Config.secrets.ci_dev_account);
    },
  },
};

ava.before('set up global browsers and config', async t => {
  Config.extensionId = await browserPool.getExtensionId();
  const setupPromises: Promise<void>[] = [];
  const globalBrowsers = [];
  for (let i = 0; i < POOL_SIZE_GLOBAL; i++) {
    const b = await browserGlobal.compatibility.browsers.newBrowserHandle();
    setupPromises.push(BrowserRecipe.setUpFcCompatAcct(b));
    globalBrowsers.push(b);
  }
  await Promise.all(setupPromises);
  for (const b of globalBrowsers) {
    await browserGlobal.compatibility.browsers.doneUsingBrowser(b);
  }
  t.pass();
});

export const testWithNewBrowser = (cb: (browser: BrowserHandle, t: ava.ExecutionContext<{}>) => Promise<void>): ava.Implementation<{}> => {
  return async (t: ava.ExecutionContext<{}>) => {
    await browserPool.withNewBrowserTimeoutAndRetry(cb, t, TEST_TIMEOUT);
    t.pass();
  };
};

export const testWithSemaphoredGlobalBrowser = (group: GlobalBrowserGroup, cb: (browser: BrowserHandle, t: ava.ExecutionContext<{}>) => Promise<void>): ava.Implementation<{}> => {
  return async (t: ava.ExecutionContext<{}>) => {
    const browser = await browserGlobal[group].browsers.openOrReuseBrowser();
    try {
      await browserPool.withGlobalBrowserTimeoutAndRetry(browserGlobal[group].beforeEachTest, browser, cb, t, TEST_TIMEOUT);
      t.pass();
    } finally {
      browserGlobal[group].browsers.doneUsingBrowser(browser);
    }
  };
};

ava.after('close browsers', async t => {
  await browserPool.close();
  await browserGlobal.compatibility.browsers.close();
  await browserGlobal.trial.browsers.close();
  t.pass();
});

defineSetupTests(testWithNewBrowser, testWithSemaphoredGlobalBrowser);
defineUnitTests(testWithNewBrowser, testWithSemaphoredGlobalBrowser);
defineComposeTests(testWithNewBrowser, testWithSemaphoredGlobalBrowser);
defineDecryptTests(testWithNewBrowser, testWithSemaphoredGlobalBrowser);
defineGmailTests(testWithNewBrowser, testWithSemaphoredGlobalBrowser);
defineSettingsTests(testWithNewBrowser, testWithSemaphoredGlobalBrowser);
defineElementTests(testWithNewBrowser, testWithSemaphoredGlobalBrowser);
defineAcctTests(testWithNewBrowser, testWithSemaphoredGlobalBrowser);
