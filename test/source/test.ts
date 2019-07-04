/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

console.log('UPDATED???');

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
import { Config, Util, getParsedCliParams } from './util';
import { FlowCryptApi } from './tests/api';
import { getDebugHtmlAtts, AvaContext, standaloneTestTimeout, minutes, GlobalBrowser, newWithTimeoutsFunc } from './tests';
import { mock } from './mock';

const { testVariant, oneIfNotPooled, buildDir, isMock } = getParsedCliParams();

process.setMaxListeners(30);

const consts = { // higher concurrency can cause 429 google errs when composing
  TIMEOUT_SHORT: minutes(1),
  TIMEOUT_EACH_RETRY: minutes(3),
  TIMEOUT_ALL_RETRIES: minutes(13), // this has to suffer waiting for semaphore between retries, thus almost the same as below
  TIMEOUT_OVERALL: minutes(14),
  ATTEMPTS: oneIfNotPooled(3),
  POOL_SIZE: oneIfNotPooled(isMock ? 13 : 2),
  POOL_SIZE_COMPATIBILITY: oneIfNotPooled(isMock ? 5 : 1),
  POOL_SIZE_COMPOSE: oneIfNotPooled(1),
  PROMISE_TIMEOUT_OVERALL: undefined as any as Promise<never>, // will be set right below
};
console.info('consts: ', JSON.stringify(consts), '\n');
consts.PROMISE_TIMEOUT_OVERALL = new Promise((resolve, reject) => setTimeout(() => reject(new Error(`TIMEOUT_OVERALL`)), consts.TIMEOUT_OVERALL));

export type Consts = typeof consts;
export type CommonBrowserGroup = 'compatibility' | 'compose';

const browserPool = new BrowserPool(consts.POOL_SIZE, 'browserPool', false, buildDir);
const browserGlobal: { [group: string]: GlobalBrowser } = {
  compatibility: {
    browsers: new BrowserPool(consts.POOL_SIZE_COMPATIBILITY, 'browserPoolGlobal', true, buildDir),
  },
  compose: {
    browsers: new BrowserPool(consts.POOL_SIZE_COMPOSE, 'browserPoolGlobal', true, buildDir),
  },
};
let closeMockApi: () => Promise<void>;
const mockApiLogs: string[] = [];

ava.before('set up global browsers and config', async t => {
  standaloneTestTimeout(t, consts.TIMEOUT_EACH_RETRY, t.title);
  for (const i of [1, 2, 3]) {
    try {
      Config.extensionId = await browserPool.getExtensionId(t);
      break;
    } catch (e) {
      console.error(`set up #${i} err: ${String(e)}`);
      t.log(`set up #${i} err: ${String(e)}, sleeping 10`);
      await Util.sleep(10);
    }
  }
  if (!Config.extensionId) {
    console.error(`Exiting with exit code 2 because cannot retrieve extension id after 3 attempts`);
    process.exit(2); // ci retries errcode > 1
  }
  const msg = `Extension url: chrome-extension://${Config.extensionId}`;
  t.log(msg);
  console.error(msg);
  console.log(msg);
  console.info(msg);
  await Util.sleep(1);
  if (isMock) {
    const mockApi = await mock(line => mockApiLogs.push(line));
    closeMockApi = mockApi.close;
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

const testWithNewBrowser = (cb: (t: AvaContext, browser: BrowserHandle) => Promise<void>): ava.Implementation<{}> => {
  return async (t: AvaContext) => {
    await browserPool.withNewBrowserTimeoutAndRetry(cb, t, consts);
    t.pass();
  };
};

const testWithSemaphoredGlobalBrowser = (group: CommonBrowserGroup, cb: (t: AvaContext, browser: BrowserHandle) => Promise<void>): ava.Implementation<{}> => {
  return async (t: AvaContext) => {
    const withTimeouts = newWithTimeoutsFunc(consts);
    const browser = await withTimeouts(browserGlobal[group].browsers.openOrReuseBrowser(t));
    try {
      await browserPool.withGlobalBrowserTimeoutAndRetry(browser, cb, t, consts);
      t.pass();
    } finally {
      await browserGlobal[group].browsers.doneUsingBrowser(browser);
    }
  };
};

export type TestWithNewBrowser = typeof testWithNewBrowser;
export type TestWithGlobalBrowser = typeof testWithSemaphoredGlobalBrowser;

ava.after.always('close browsers', async t => {
  standaloneTestTimeout(t, consts.TIMEOUT_SHORT, t.title);
  await browserPool.close();
  await browserGlobal.compatibility.browsers.close();
  t.pass();
});

if (isMock) {
  ava.after.always('close mock api', async t => {
    standaloneTestTimeout(t, consts.TIMEOUT_SHORT, t.title);
    closeMockApi().catch(t.log);
    t.pass();
  });
}

ava.after.always('send debug info if any', async t => {
  console.info('send debug info - deciding');
  const failRnd = Util.lousyRandom();
  const testId = `FlowCrypt Browser Extension ${testVariant} ${failRnd}`;
  const debugHtmlAttachments = getDebugHtmlAtts(testId, mockApiLogs);
  if (debugHtmlAttachments.length) {
    console.info(`FAIL ID ${testId}`);
    standaloneTestTimeout(t, consts.TIMEOUT_SHORT, t.title);
    for (let i = 0; i < debugHtmlAttachments.length; i++) {
      const subject = `${testId} ${i + 1}/${debugHtmlAttachments.length}`;
      await FlowCryptApi.hookCiDebugEmail(subject, debugHtmlAttachments[i]);
    }
  } else {
    console.info(`no fails to debug`);
  }
  t.pass();
});

defineSetupTests(testVariant, testWithNewBrowser, testWithSemaphoredGlobalBrowser);
defineUnitTests(testVariant, testWithNewBrowser, testWithSemaphoredGlobalBrowser);
defineComposeTests(testVariant, testWithNewBrowser, testWithSemaphoredGlobalBrowser);
defineDecryptTests(testVariant, testWithNewBrowser, testWithSemaphoredGlobalBrowser);
defineGmailTests(testVariant, testWithNewBrowser, testWithSemaphoredGlobalBrowser);
defineSettingsTests(testVariant, testWithNewBrowser, testWithSemaphoredGlobalBrowser);
defineElementTests(testVariant, testWithNewBrowser, testWithSemaphoredGlobalBrowser);
defineAcctTests(testVariant, testWithNewBrowser, testWithSemaphoredGlobalBrowser);
