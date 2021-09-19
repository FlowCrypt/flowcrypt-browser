/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import * as ava from 'ava';

import { AvaContext, getDebugHtmlAtts, minutes, standaloneTestTimeout } from './tests/tooling';
import { BrowserHandle, BrowserPool } from './browser';
import { Config, Util, getParsedCliParams } from './util';

import { BrowserRecipe } from './tests/tooling/browser-recipe';
// import { FlowCryptApi } from './tests/tooling/api';
import { defineComposeTests } from './tests/compose';
import { defineDecryptTests } from './tests/decrypt';
import { defineElementTests } from './tests/elements';
import { defineFlakyTests } from './tests/flaky';
import { defineGmailTests } from './tests/gmail';
import { defineSettingsTests } from './tests/settings';
import { defineSetupTests } from './tests/setup';
import { defineUnitNodeTests } from './tests/unit-node';
import { defineUnitBrowserTests } from './tests/unit-browser';
import { mock } from './mock';
import { mockBackendData } from './mock/backend/backend-endpoints';
import { TestUrls } from './browser/test-urls';
import { mkdirSync, realpathSync, writeFileSync } from 'fs';
// import fileSize from 'filesize';

export const { testVariant, testGroup, oneIfNotPooled, buildDir, isMock } = getParsedCliParams();
export const internalTestState = { expectIntentionalErrReport: false }; // updated when a particular test that causes an error is run
const DEBUG_BROWSER_LOG = false; // set to true to print / export information from browser
const DEBUG_MOCK_LOG = false; // se to true to print mock server logs

process.setMaxListeners(60);

const consts = { // higher concurrency can cause 429 google errs when composing
  TIMEOUT_SHORT: minutes(1),
  TIMEOUT_EACH_RETRY: minutes(3),
  TIMEOUT_ALL_RETRIES: minutes(13), // this has to suffer waiting for semaphore between retries, thus almost the same as below
  TIMEOUT_OVERALL: minutes(14),
  ATTEMPTS: testGroup === 'STANDARD-GROUP' ? oneIfNotPooled(3) : process.argv.includes('--retry=false') ? 1 : 3,
  POOL_SIZE: oneIfNotPooled(isMock ? 20 : 3),
  PROMISE_TIMEOUT_OVERALL: undefined as any as Promise<never>, // will be set right below
  IS_LOCAL_DEBUG: process.argv.includes('--debug') ? true : false, // run locally by developer, not in ci
};
console.info('consts: ', JSON.stringify(consts), '\n');
consts.PROMISE_TIMEOUT_OVERALL = new Promise((resolve, reject) => setTimeout(() => reject(new Error(`TIMEOUT_OVERALL`)), consts.TIMEOUT_OVERALL));

export type Consts = typeof consts;
export type CommonAcct = 'compatibility' | 'compose' | 'ci.tests.gmail';

const browserPool = new BrowserPool(consts.POOL_SIZE, 'browserPool', false, buildDir, isMock, undefined, undefined, consts.IS_LOCAL_DEBUG);
let closeMockApi: () => Promise<void>;
const mockApiLogs: string[] = [];

ava.before('set config and mock api', async t => {
  standaloneTestTimeout(t, consts.TIMEOUT_EACH_RETRY, t.title);
  Config.extensionId = await browserPool.getExtensionId(t);
  console.info(`Extension url: chrome-extension://${Config.extensionId}`);
  if (isMock) {
    const mockApi = await mock(line => {
      if (DEBUG_MOCK_LOG) {
        console.log(line);
      }
      mockApiLogs.push(line);
    });
    closeMockApi = mockApi.close;
  }
  t.pass();
});

const testWithBrowser = (acct: CommonAcct | undefined, cb: (t: AvaContext, browser: BrowserHandle) => Promise<void>, flag?: 'FAILING'): ava.Implementation<{}> => {
  return async (t: AvaContext) => {
    await browserPool.withNewBrowserTimeoutAndRetry(async (t, browser) => {
      const start = Date.now();
      if (acct) {
        await BrowserRecipe.setUpCommonAcct(t, browser, acct);
      }
      await cb(t, browser);
      if (DEBUG_BROWSER_LOG) {
        try {
          const page = await browser.newPage(t, TestUrls.extension('chrome/dev/ci_unit_test.htm'));
          const items = await page.target.evaluate(() => (window as any).Debug.readDatabase()) as { input: unknown, output: unknown }[];
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const input = JSON.stringify(item.input);
            const output = JSON.stringify(item.output, undefined, 2);
            const file = `./test/tmp/${t.title}-${i}.txt`;
            writeFileSync(file, `in: ${input}\n\nout: ${output}`);
            t.log(`browser debug written to file: ${file}`);
          }
        } catch (e) {
          t.log(`Error reading debug messages: ${e}`);
        }
      }
      t.log(`run time: ${Math.ceil((Date.now() - start) / 1000)}s`);
    }, t, consts, flag);
    t.pass();
  };
};

export type TestWithBrowser = typeof testWithBrowser;

ava.after.always('close browsers', async t => {
  standaloneTestTimeout(t, consts.TIMEOUT_SHORT, t.title);
  await browserPool.close();
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
  // todo - here we filter out an error that would otherwise be useful
  // in one test we are testing an error scenario
  // our S/MIME implementation is still early so it throws "reportable" errors like this during tests
  const usefulErrors = mockBackendData.reportedErrors
    .filter(e => e.message !== 'Too few bytes to read ASN.1 value.')
    // below for test "no.fes@example.com - skip FES on consumer, show friendly message on enterprise"
    .filter(e => !e.trace.includes('-1 when GET-ing https://fes.example.com'))
    // todo - ideally mock tests would never call this. But we do tests with human@flowcrypt.com so it's calling here
    .filter(e => !e.trace.includes('-1 when GET-ing https://openpgpkey.flowcrypt.com'));
  const foundExpectedErr = usefulErrors.find(re => re.message === `intentional error for debugging`);
  const foundUnwantedErrs = usefulErrors.filter(re => re.message !== `intentional error for debugging` && !re.message.includes('traversal forbidden'));
  if (testVariant === 'CONSUMER-MOCK' && internalTestState.expectIntentionalErrReport && !foundExpectedErr) {
    // on consumer flavor app, we submit errors to flowcrypt.com backend
    t.fail(`Catch.reportErr errors: missing intentional error report on consumer flavor`);
    return;
  }
  if (testVariant === 'ENTERPRISE-MOCK' && mockBackendData.reportedErrors.length) {
    // on enterprise flavor app, we don't submit any errors anywhere yet
    t.fail(`Catch.reportErr errors: should not report any error on enterprise app`);
    return;
  }
  if (foundUnwantedErrs.length) {
    for (const e of foundUnwantedErrs) {
      console.info(`----- mockBackendData Catch.reportErr -----\nname: ${e.name}\nmessage: ${e.message}\nurl: ${e.url}\ntrace: ${e.trace}`);
    }
    t.fail(`Catch.reportErr errors: ${foundUnwantedErrs.length}`);
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
    const debugArtifactDir = realpathSync(`${__dirname}/..`) + "/debugArtifacts";
    mkdirSync(debugArtifactDir);
    for (let i = 0; i < debugHtmlAttachments.length; i++) {
      // const subject = `${testId} ${i + 1}/${debugHtmlAttachments.length}`;
      // await FlowCryptApi.hookCiDebugEmail(subject, debugHtmlAttachments[i]);
      const filePath = `${debugArtifactDir}/debugHtmlAttachment-${i}.html}`;
      writeFileSync(filePath, debugHtmlAttachments[i]);
    }
  } else {
    console.info(`no fails to debug`);
  }
  t.pass();
});


if (testGroup === 'UNIT-TESTS') {
  defineUnitNodeTests(testVariant);
  defineUnitBrowserTests(testVariant, testWithBrowser);
} else if (testGroup === 'FLAKY-GROUP') {
  defineFlakyTests(testVariant, testWithBrowser);
} else {
  defineSetupTests(testVariant, testWithBrowser);
  defineComposeTests(testVariant, testWithBrowser);
  defineDecryptTests(testVariant, testWithBrowser);
  defineGmailTests(testVariant, testWithBrowser);
  defineSettingsTests(testVariant, testWithBrowser);
  defineElementTests(testVariant, testWithBrowser);
}
