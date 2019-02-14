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
import { defineConsumerAcctTests as defineAcctTests } from './tests/tests/account';
import { Config, Util } from './util';
import { FlowCryptApi } from './tests/api';
import { getDebugHtml, AvaContext, standaloneTestTimeout, minutes, GlobalBrowser, newWithTimeoutsFunc } from './tests';

export type TestVariant = 'CONSUMER' | 'ENTERPRISE';
let TEST_VARIANT: TestVariant;
if (process.argv.indexOf('CONSUMER') !== -1) {
  TEST_VARIANT = 'CONSUMER';
} else if (process.argv.indexOf('ENTERPRISE') !== -1) {
  TEST_VARIANT = 'ENTERPRISE';
} else {
  throw new Error('Unknown test type: specify CONSUMER or ENTERPRISE');
}
const BUILD_DIR = `build/chrome-${TEST_VARIANT.toLowerCase()}`;
console.info(`TEST_VARIANT: ${TEST_VARIANT}`);

const poolSizeOne = process.argv.indexOf('--pool-size=1') !== -1;

const consts = { // higher concurrency can cause 429 google errs when composing
  TIMEOUT_SHORT: minutes(1),
  TIMEOUT_EACH_RETRY: minutes(3),
  TIMEOUT_ALL_RETRIES: minutes(12), // this has to suffer waiting for semaphore on each retry, thus almost the same as below
  TIMEOUT_OVERALL: minutes(poolSizeOne ? 5 : 13),
  ATTEMPTS: poolSizeOne ? 1 : 3,
  POOL_SIZE: poolSizeOne ? 1 : 6,
  POOL_SIZE_COMPATIBILITY: poolSizeOne ? 1 : 2,
  POOL_SIZE_COMPOSE: poolSizeOne ? 1 : 1,
  PROMISE_TIMEOUT_OVERALL: undefined as any as Promise<never>,
};
console.info('consts: ', JSON.stringify(consts), '\n');
consts.PROMISE_TIMEOUT_OVERALL = new Promise((resolve, reject) => setTimeout(() => reject(new Error(`TIMEOUT_OVERALL`)), consts.TIMEOUT_OVERALL));

export type Consts = typeof consts;
export type CommonBrowserGroup = 'compatibility' | 'compose';

const browserPool = new BrowserPool(consts.POOL_SIZE, 'browserPool', false, BUILD_DIR);
const browserGlobal: { [group: string]: GlobalBrowser } = {
  compatibility: {
    browsers: new BrowserPool(consts.POOL_SIZE_COMPATIBILITY, 'browserPoolGlobal', true, BUILD_DIR),
  },
  compose: {
    browsers: new BrowserPool(consts.POOL_SIZE_COMPOSE, 'browserPoolGlobal', true, BUILD_DIR),
  },
};

ava.before('set up global browsers and config', async t => {
  standaloneTestTimeout(t, consts.TIMEOUT_EACH_RETRY);
  for (const i of [1, 2, 3]) {
    try {
      Config.extensionId = await browserPool.getExtensionId(t);
      break;
    } catch (e) {
      t.log(`set up #${i} err: ${String(e)}`);
      await Util.sleep(10);
    }
  }
  if (!Config.extensionId) {
    throw new Error('was not able to get extensionId');
  }
  const setupPromises: Promise<void>[] = [];
  const globalBrowsers: { [group: string]: BrowserHandle[] } = { compatibility: [], compose: [] };
  for (const group of Object.keys(browserGlobal)) {
    for (let i = 0; i < browserGlobal[group].browsers.poolSize; i++) {
      const b = await browserGlobal[group].browsers.newBrowserHandle(t);
      setupPromises.push(browserPool.withGlobalBrowserTimeoutAndRetry(b, (t, b) => BrowserRecipe.setUpCommonAcct(t, b, group as CommonBrowserGroup), t, consts));
      globalBrowsers[group].push(b);
    }
  }
  await Promise.all(setupPromises);
  for (const group of Object.keys(browserGlobal)) {
    for (const b of globalBrowsers[group]) {
      await browserGlobal[group].browsers.doneUsingBrowser(b);
    }
  }
  t.pass();
});

export const testWithNewBrowser = (cb: (t: AvaContext, browser: BrowserHandle) => Promise<void>): ava.Implementation<{}> => {
  return async (t: AvaContext) => {
    await browserPool.withNewBrowserTimeoutAndRetry(cb, t, consts);
    t.pass();
  };
};

export const testWithSemaphoredGlobalBrowser = (group: CommonBrowserGroup, cb: (t: AvaContext, browser: BrowserHandle) => Promise<void>): ava.Implementation<{}> => {
  return async (t: AvaContext) => {
    const withTimeouts = newWithTimeoutsFunc(consts);
    const browser = await withTimeouts(browserGlobal[group].browsers.openOrReuseBrowser(t));
    try {
      await browserPool.withGlobalBrowserTimeoutAndRetry(browser, cb, t, consts);
      t.pass();
    } finally {
      browserGlobal[group].browsers.doneUsingBrowser(browser);
    }
  };
};

ava.after.always('close browsers', async t => {
  standaloneTestTimeout(t, consts.TIMEOUT_SHORT);
  await browserPool.close();
  await browserGlobal.compatibility.browsers.close();
  t.pass();
});

ava.after.always('send debug info if any', async t => {
  const failRnd = Util.lousyRandom();
  const debugHtml = getDebugHtml(TEST_VARIANT);
  console.log(`debugging:1`);
  if (debugHtml) {
    console.info(`FAIL ID ${failRnd}`);
    console.log(`debugging:2`);
    standaloneTestTimeout(t, consts.TIMEOUT_SHORT);
    console.log(`debugging:3`);
    await FlowCryptApi.hookCiDebugEmail(`FlowCrypt Browser Extension (${TEST_VARIANT}) ${failRnd}`, debugHtml);
    console.log(`debugging:4`);
  } else {
    console.info(`no fails to debug`);
  }
  t.pass();
});

defineSetupTests(TEST_VARIANT, testWithNewBrowser, testWithSemaphoredGlobalBrowser);
defineUnitTests(TEST_VARIANT, testWithNewBrowser, testWithSemaphoredGlobalBrowser);
defineComposeTests(TEST_VARIANT, testWithNewBrowser, testWithSemaphoredGlobalBrowser);
defineDecryptTests(TEST_VARIANT, testWithNewBrowser, testWithSemaphoredGlobalBrowser);
defineGmailTests(TEST_VARIANT, testWithNewBrowser, testWithSemaphoredGlobalBrowser);
defineSettingsTests(TEST_VARIANT, testWithNewBrowser, testWithSemaphoredGlobalBrowser);
defineElementTests(TEST_VARIANT, testWithNewBrowser, testWithSemaphoredGlobalBrowser);
defineAcctTests(TEST_VARIANT, testWithNewBrowser, testWithSemaphoredGlobalBrowser);
