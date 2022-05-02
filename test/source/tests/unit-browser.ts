/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import * as ava from 'ava';

import { TestVariant } from '../util';
import { CommonAcct, TestWithBrowser } from '../test';
import { TestUrls } from '../browser/test-urls';
import { readdirSync, readFileSync } from 'fs';
import { Buf } from '../core/buf';
import { testConstants } from './tooling/consts';

// tslint:disable:no-blank-lines-func
/* eslint-disable max-len */

type UnitTest = { title: string, code: string, acct?: CommonAcct, only: boolean };

export const defineUnitBrowserTests = (testVariant: TestVariant, testWithBrowser: TestWithBrowser) => {

  if (testVariant !== 'CONSUMER-LIVE-GMAIL') {

    const browserUnitTestsFolder = './test/source/tests/browser-unit-tests/';

    const defineAvaTest = (title: string, testCode: string, acct?: CommonAcct, flag?: 'only') => {
      // eslint-disable-next-line no-only-tests/no-only-tests
      (flag !== 'only' ? ava.default : ava.default.only)(title, testWithBrowser(acct, async (t, browser) => {
        const hostPage = await browser.newPage(t, TestUrls.extension(`chrome/dev/ci_unit_test.htm`));
        // update host page h1
        await hostPage.target.evaluate((title) => { window.document.getElementsByTagName('h1')[0].textContent = title; }, title);
        // inject testConstants
        await hostPage.target.evaluate((object) => { (window as any).testConstants = object; }, testConstants);
        // prepare code to run
        const runThisCodeInBrowser = `
            (async () => {
              try {
                return await ${testCode}
              } catch (e) {
                return "unit test threw something:" + String(e) + "\\n\\n" + e.stack;
              }
            })();
          `;
        // load and run the unit test
        const r = await hostPage.target.evaluate(runThisCodeInBrowser);
        if (r !== 'pass') {
          t.log(`Expected unit test to return "pass" but got: "${r}"`);
          throw Error(String(r).split('\n')[0]);
        }
      }));
    };

    const parseTestFile = (filename: string): UnitTest[] => {
      const unitTestCodes = Buf.fromUint8(readFileSync(browserUnitTestsFolder + filename)).toUtfStr().trim();
      const testCasesInFile = unitTestCodes.split('\nBROWSER_UNIT_TEST_NAME(`');
      const header = testCasesInFile.shift()!;
      if (!header.startsWith('/* ©️ 2016')) {
        throw Error(`Expecting ${browserUnitTestsFolder}/${filename} to start with '/* ©️ 2016'`);
      }
      if (header.includes('require(') || header.includes('import')) { // do not import anything. Add deps to ci_unit_test.ts
        throw Error(`Unexpected import statement found in ${browserUnitTestsFolder}/${filename}`);
      }
      const unitTests = [];
      for (let code of testCasesInFile) {
        if (code.includes('/*')) { // just to make sure we don't parse something wrongly. Block comment only allowed in header.
          throw Error(`Block comments such as /* are not allowed in test definitions. Use line comments eg //`);
        }
        code = code.trim();
        if (!code.endsWith('})();')) {
          console.error(code);
          throw Error(`Test case does not end with '})();'. Did you put code outside of the async functions? (forbidden)`);
        }
        const testCodeLines = code.split('\n');
        let thisUnitTestTitle = testCodeLines.shift()!.trim();
        if (thisUnitTestTitle.endsWith(';')) {
          thisUnitTestTitle = thisUnitTestTitle.slice(0, -1);
        }
        let only = false;
        let consumerOnly = false;
        let enterpriseOnly = false;
        let acct: CommonAcct | undefined;
        const options = thisUnitTestTitle.split('.');
        for (; ;) {
          const option = options.pop();
          if (!option) {
            break;
          }
          if (option === 'only') {
            only = true;
          } else if (option === 'enterprise') {
            enterpriseOnly = true;
          } else if (option === 'consumer') {
            consumerOnly = true;
          } else if (option === 'acct(`compatibility`)') {
            acct = 'compatibility';
          } else if (option === 'acct(`compose`)') {
            acct = 'compose';
          } else if (option === 'acct(`ci.tests.gmail`)') {
            acct = 'ci.tests.gmail';
          } else {
            break;
          }
        }
        if (enterpriseOnly && testVariant === 'CONSUMER-MOCK') {
          continue;
        }
        if (consumerOnly && testVariant === 'ENTERPRISE-MOCK') {
          continue;
        }
        thisUnitTestTitle = thisUnitTestTitle.replace(/`.+$/, '');
        code = testCodeLines.join('\n'); // without the title, just code
        const title = `[${filename}] ${thisUnitTestTitle}`;
        unitTests.push({ title, code, only, acct });
      }
      return unitTests;
    };

    const allUnitTests: UnitTest[] = [];
    for (const filename of readdirSync(browserUnitTestsFolder)) {
      allUnitTests.push(...parseTestFile(filename));
    }
    const markedAsOnly: UnitTest[] = allUnitTests.filter(unitTest => unitTest.only);
    if (!markedAsOnly.length) { // no tests marked as only - run all
      for (const unitTest of allUnitTests) {
        defineAvaTest(unitTest.title, unitTest.code, unitTest.acct);
      }
    } else { // some tests marked as only - only run those + run one test that always fails
      for (const unitTest of markedAsOnly) {
        defineAvaTest(unitTest.title, unitTest.code, unitTest.acct, 'only');
      }
      // eslint-disable-next-line no-only-tests/no-only-tests
      ava.default.only('reminder to remove .only', async t => {
        t.fail(`some tests marked as .only, preventing other tests from running`);
      });
    }

  }
};
