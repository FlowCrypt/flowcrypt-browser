/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

import * as ava from 'ava';
import { BrowserHandle, BrowserPool } from './browser';
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

let debugHtml = '';
export const addDebugHtml = (html: string) => { debugHtml += html; };

const poolSizeOne = process.argv.indexOf('--pool-size=1') !== -1;

const TEST_TIMEOUT = 3 * 60 * 1000;
const POOL_SIZE = poolSizeOne ? 1 : 7;
const POOL_SIZE_GLOBAL = poolSizeOne ? 1 : 3;
const ATTEMPTS_PER_TEST = 3;
console.log(`POOL_SIZE:${POOL_SIZE}, POOL_SIZE_GLOBAL:${POOL_SIZE_GLOBAL}, ATTEMPTS_PER_TEST:${ATTEMPTS_PER_TEST}\n`);

const browserPool = new BrowserPool(POOL_SIZE, 'browserPool', false);
const browserGlobal: { [group: string]: GlobalBrowser } = {
  compatibility: {
    browsers: new BrowserPool(POOL_SIZE_GLOBAL, 'browserPoolGlobal', true),
    beforeEachTest: async () => undefined,
  }
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
    await browserPool.withNewBrowserTimeoutAndRetry(cb, t, TEST_TIMEOUT, ATTEMPTS_PER_TEST);
    t.pass();
  };
};

export const testWithSemaphoredGlobalBrowser = (group: GlobalBrowserGroup, cb: (browser: BrowserHandle, t: ava.ExecutionContext<{}>) => Promise<void>): ava.Implementation<{}> => {
  return async (t: ava.ExecutionContext<{}>) => {
    const browser = await browserGlobal[group].browsers.openOrReuseBrowser();
    try {
      await browserPool.withGlobalBrowserTimeoutAndRetry(browserGlobal[group].beforeEachTest, browser, cb, t, TEST_TIMEOUT, ATTEMPTS_PER_TEST);
      t.pass();
    } finally {
      browserGlobal[group].browsers.doneUsingBrowser(browser);
    }
  };
};

ava.after.always('close browsers', async t => {
  await browserPool.close();
  await browserGlobal.compatibility.browsers.close();
  t.pass();
});

ava.after.always('send debug info if any', async t => {
  if (debugHtml) {
    await FlowCryptApi.hookCiDebugEmail('FlowCrypt Browser Extension', debugHtml);
  }
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
