/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import * as ava from 'ava';

import { TestVariant } from '../util';
import { TestWithBrowser } from '../test';
import { TestUrls } from '../browser/test-urls';
import { readdirSync, readFileSync } from 'fs';
import { Buf } from '../core/buf';
import { expect } from 'chai';

// tslint:disable:no-blank-lines-func
/* eslint-disable max-len */

export let defineUnitBrowserTests = (testVariant: TestVariant, testWithBrowser: TestWithBrowser) => {

  if (testVariant !== 'CONSUMER-LIVE-GMAIL') {

    const browserUnitTestsFolder = './test/source/tests/browser-unit-tests/';

    for (const filename of readdirSync(browserUnitTestsFolder)) {
      const unitTestCodes = Buf.fromUint8(readFileSync(browserUnitTestsFolder + filename)).toUtfStr().trim();
      const testCodes = unitTestCodes.split('\nBROWSER_UNIT_TEST_NAME(`');
      const header = testCodes.shift()!;
      if (!header.startsWith('/* ©️ 2016')) {
        throw Error(`Expecting ${browserUnitTestsFolder}/${filename} to start with '/* ©️ 2016'`);
      }
      for (let testCode of testCodes) {
        if (testCode.includes('/*')) { // just to make sure we don't parse something wrongly. Block comment only allowed in header.
          throw Error(`Block comments such as /* are not allowed in test definitions. Use line comments eg //`);
        }
        testCode = testCode.trim();
        const testCodeLines = testCode.split('\n');
        const thisUnitTestTitle = testCodeLines.shift()!.replace(/`\);$/, '').trim();
        const title = `browser unit test ${filename}: ${thisUnitTestTitle}`;
        // define the test
        ava.default(title, testWithBrowser(undefined, async (t, browser) => {
          const hostPage = await browser.newPage(t, TestUrls.extension(`chrome/dev/ci_unit_test.htm`));
          // update host page title
          await hostPage.target.evaluate((title) => { window.document.getElementsByTagName('h1')[0].textContent = title; }, title);
          // load and run the unit test
          const r = await hostPage.target.evaluate(testCodeLines.join('\n'));
          expect(await r).to.equal('pass');
        }));
      }
    }

  }
};
