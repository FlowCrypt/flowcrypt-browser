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
export type GlobalBrowser = { browser?: BrowserHandle, semaphore: Semaphore, beforeEachTest: () => Promise<void> };

const testTimeout = 5 * 60 * 1000;
const browserPool = new BrowserPool(5);
const browserGlobal: { [group: string]: GlobalBrowser } = {
  compatibility: {
    browser: undefined,
    semaphore: new Semaphore(1),
    beforeEachTest: async () => undefined,
  },
  trial: {
    browser: undefined,
    semaphore: new Semaphore(1),
    beforeEachTest: async () => {
      await FlowCryptApi.hookCiAcctDelete(Config.secrets.ci_dev_account);
      if (browserGlobal.trial.browser) { // a new browser for each trial test
        await browserGlobal.trial.browser.close();
      }
      browserGlobal.trial.browser = await browserPool.newBrowserHandle();
    },
  },
};

ava.before('set up global browser and config', async t => {
  Config.extensionId = await browserPool.getExtensionId();
  browserGlobal.compatibility.browser = await browserPool.newBrowserHandle();
  await BrowserRecipe.setUpFcCompatAcct(browserGlobal.compatibility.browser!);
  t.pass();
});

export const testWithNewBrowser = (cb: (browser: BrowserHandle, t: ava.ExecutionContext<{}>) => Promise<void>): ava.Implementation<{}> => {
  return async (t: ava.ExecutionContext<{}>) => {
    await browserPool.withNewBrowserTimeoutAndRetry(cb, t, testTimeout);
    t.pass();
  };
};

export const testWithSemaphoredGlobalBrowser = (group: GlobalBrowserGroup, cb: (browser: BrowserHandle, t: ava.ExecutionContext<{}>) => Promise<void>): ava.Implementation<{}> => {
  return async (t: ava.ExecutionContext<{}>) => {
    await browserGlobal[group].semaphore.acquire();
    try {
      await browserPool.withGlobalBrowserTimeoutAndRetry(browserGlobal[group], cb, t, testTimeout);
      t.pass();
    } finally {
      browserGlobal[group].semaphore.release();
    }
  };
};

defineSetupTests(testWithNewBrowser, testWithSemaphoredGlobalBrowser);
defineUnitTests(testWithNewBrowser, testWithSemaphoredGlobalBrowser);
defineComposeTests(testWithNewBrowser, testWithSemaphoredGlobalBrowser);
defineDecryptTests(testWithNewBrowser, testWithSemaphoredGlobalBrowser);
defineGmailTests(testWithNewBrowser, testWithSemaphoredGlobalBrowser);
defineSettingsTests(testWithNewBrowser, testWithSemaphoredGlobalBrowser);
defineElementTests(testWithNewBrowser, testWithSemaphoredGlobalBrowser);
defineAcctTests(testWithNewBrowser, testWithSemaphoredGlobalBrowser);
