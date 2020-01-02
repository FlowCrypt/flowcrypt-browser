import * as ava from 'ava';

import { AvaContext, GlobalBrowser, getDebugHtmlAtts, minutes, newWithTimeoutsFunc, standaloneTestTimeout } from './tests';
import { BrowserHandle, BrowserPool } from './browser';
import { Config, Util, getParsedCliParams } from './util';

import { BrowserRecipe } from './tests/browser_recipe';
import { FlowCryptApi } from './tests/api';
import { defineConsumerAcctTests as defineAcctTests } from './tests/tests/account';
import { defineComposeTests } from './tests/tests/compose';
import { defineDecryptTests } from './tests/tests/decrypt';
import { defineElementTests } from './tests/tests/elements';
import { defineFlakyTests } from './tests/tests/flaky';
import { defineGmailTests } from './tests/tests/gmail';
import { defineSettingsTests } from './tests/tests/settings';
import { defineSetupTests } from './tests/tests/setup';
import { defineUnitTests } from './tests/tests/unit';
import { mock } from './mock';
import { mockBackendData } from './mock/backend/backend-endpoints';

/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */


const { testVariant, testGroup, oneIfNotPooled, buildDir, isMock } = getParsedCliParams();
const startedAt = Date.now();
export const internalTestState = { expectiIntentionalErrReport: false }; // updated when a particular test that causes an error is run

process.setMaxListeners(30);

const consts = { // higher concurrency can cause 429 google errs when composing
  TIMEOUT_SHORT: minutes(1),
  TIMEOUT_EACH_RETRY: minutes(3),
  TIMEOUT_ALL_RETRIES: minutes(13), // this has to suffer waiting for semaphore between retries, thus almost the same as below
  TIMEOUT_OVERALL: minutes(14),
  ATTEMPTS: testGroup === 'STANDARD-GROUP' ? oneIfNotPooled(3) : 3, // if it's FLAKY-GROUP, do 3 retries even if not pooled
  POOL_SIZE: oneIfNotPooled(isMock ? 14 : 2),
  POOL_SIZE_COMPATIBILITY: oneIfNotPooled(isMock ? 1 : 1),
  POOL_SIZE_COMPOSE: oneIfNotPooled(isMock ? 1 : 0),
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
  Config.extensionId = await browserPool.getExtensionId(t);
  console.info(`Extension url: chrome-extension://${Config.extensionId}`);
  if (isMock) {
    const mockApi = await mock(line => mockApiLogs.push(line));
    closeMockApi = mockApi.close;
  }
  // const setupPromises: Promise<void>[] = [];
  // const globalBrowsers: { [group: string]: BrowserHandle[] } = { compatibility: [], compose: [] };
  // for (const group of Object.keys(browserGlobal)) {
  //   for (let i = 0; i < browserGlobal[group].browsers.poolSize; i++) {
  //     const b = await browserGlobal[group].browsers.newBrowserHandle(t, true, isMock);
  //     setupPromises.push(browserPool.withGlobalBrowserTimeoutAndRetry(b, (t, b) => BrowserRecipe.setUpCommonAcct(t, b, group as CommonBrowserGroup), t, consts));
  //     globalBrowsers[group].push(b);
  //   }
  // }
  // await Promise.all(setupPromises);
  // for (const group of Object.keys(browserGlobal)) {
  //   for (const b of globalBrowsers[group]) {
  //     await browserGlobal[group].browsers.doneUsingBrowser(b);
  //   }
  // }
  // console.info(`global browsers set up in: ${Math.round((Date.now() - startedAt) / 1000)}s`);
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
    await browserPool.withNewBrowserTimeoutAndRetry(async (t, browser) => {
      await BrowserRecipe.setUpCommonAcct(t, browser, group);
      await cb(t, browser);
    }, t, consts);
    t.pass();
  };
  // return async (t: AvaContext) => {
  //   const withTimeouts = newWithTimeoutsFunc(consts);
  //   const browser = await withTimeouts(browserGlobal[group].browsers.openOrReuseBrowser(t));
  //   try {
  //     await browserPool.withGlobalBrowserTimeoutAndRetry(browser, cb, t, consts);
  //     t.pass();
  //   } finally {
  //     await browserGlobal[group].browsers.doneUsingBrowser(browser);
  //   }
  // };
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

ava.after.always('evaluate Catch.reportErr errors', async t => {
  if (!isMock || testGroup !== 'STANDARD-GROUP') { // can only collect reported errs when running with a mocked api
    t.pass();
    return;
  }
  const foundExpectedErr = mockBackendData.reportedErrors.find(re => re.message === `intentional error for debugging`);
  const foundUnwantedErrs = mockBackendData.reportedErrors.filter(re => re.message !== `intentional error for debugging`);
  if (!foundExpectedErr && internalTestState.expectiIntentionalErrReport) {
    t.fail(`Catch.reportErr errors: missing intentional error`);
  } else if (foundUnwantedErrs.length) {
    for (const e of foundUnwantedErrs) {
      console.info(`----- mockBackendData Catch.reportErr -----\nname: ${e.name}\nmessage: ${e.message}\nurl: ${e.url}\ntrace: ${e.trace}`);
    }
    t.fail(`Catch.reportErr errors: ${mockBackendData.reportedErrors.length}`);
  } else {
    t.pass();
  }
});

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

if (testGroup === 'FLAKY-GROUP') {
  defineFlakyTests(testVariant, testWithNewBrowser, testWithSemaphoredGlobalBrowser);
} else {
  defineSetupTests(testVariant, testWithNewBrowser, testWithSemaphoredGlobalBrowser);
  defineUnitTests(testVariant, testWithNewBrowser, testWithSemaphoredGlobalBrowser);
  defineComposeTests(testVariant, testWithNewBrowser, testWithSemaphoredGlobalBrowser);
  defineDecryptTests(testVariant, testWithNewBrowser, testWithSemaphoredGlobalBrowser);
  defineGmailTests(testVariant, testWithNewBrowser, testWithSemaphoredGlobalBrowser);
  defineSettingsTests(testVariant, testWithNewBrowser, testWithSemaphoredGlobalBrowser);
  defineElementTests(testVariant, testWithNewBrowser, testWithSemaphoredGlobalBrowser);
  defineAcctTests(testVariant, testWithNewBrowser, testWithSemaphoredGlobalBrowser);
}
