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
import { getDebugHtml, AvaContext, standaloneTestTimeout, minutes, GlobalBrowser, newWithTimeoutsFunc } from './tests';

type GlobalBrowserGroup = 'compatibility' | 'trial';

const poolSizeOne = process.argv.indexOf('--pool-size=1') !== -1;

const consts = {
  TIMEOUT_SHORT: minutes(1),
  TIMEOUT_EACH_RETRY: minutes(3),
  TIMEOUT_ALL_RETRIES: minutes(7),
  TIMEOUT_OVERALL: minutes(13),
  ATTEMPTS: 3,
  POOL_SIZE: poolSizeOne ? 1 : 7,
  POOL_SIZE_GLOBAL: poolSizeOne ? 1 : 3,
  PROMISE_TIMEOUT_OVERALL: undefined as any as Promise<never>,
};
console.info('consts: ', JSON.stringify(consts), '\n');
consts.PROMISE_TIMEOUT_OVERALL = new Promise((resolve, reject) => setTimeout(() => reject(new Error(`TIMEOUT_OVERALL`)), consts.TIMEOUT_OVERALL));

export type Consts = typeof consts;

const browserPool = new BrowserPool(consts.POOL_SIZE, 'browserPool', false);
const browserGlobal: { [group: string]: GlobalBrowser } = {
  compatibility: {
    browsers: new BrowserPool(consts.POOL_SIZE_GLOBAL, 'browserPoolGlobal', true),
  }
};

ava.before('set up global browsers and config', async t => {
  standaloneTestTimeout(t, consts.TIMEOUT_EACH_RETRY);
  Config.extensionId = await browserPool.getExtensionId();
  const { email, password, backup } = Config.secrets.auth.google.filter(a => a.email === 'flowcrypt.compatibility@gmail.com')[0];
  await FlowCryptApi.ciInitialize(email, password, backup);
  const setupPromises: Promise<void>[] = [];
  const globalBrowsers = [];
  for (let i = 0; i < consts.POOL_SIZE_GLOBAL; i++) {
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

export const testWithNewBrowser = (cb: (browser: BrowserHandle, t: AvaContext) => Promise<void>): ava.Implementation<{}> => {
  return async (t: AvaContext) => {
    await browserPool.withNewBrowserTimeoutAndRetry(cb, t, consts);
    t.pass();
  };
};

export const testWithSemaphoredGlobalBrowser = (group: GlobalBrowserGroup, cb: (browser: BrowserHandle, t: AvaContext) => Promise<void>): ava.Implementation<{}> => {
  return async (t: AvaContext) => {
    const withTimeouts = newWithTimeoutsFunc(consts);
    const browser = await withTimeouts(browserGlobal[group].browsers.openOrReuseBrowser());
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
  standaloneTestTimeout(t, consts.TIMEOUT_SHORT);
  if (getDebugHtml()) {
    await FlowCryptApi.hookCiDebugEmail('FlowCrypt Browser Extension', getDebugHtml());
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
