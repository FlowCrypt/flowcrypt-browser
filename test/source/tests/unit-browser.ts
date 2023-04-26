/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import test from 'ava';

import { TestVariant } from '../util';
import { CommonAcct, TestWithBrowser } from '../test';
import { readdirSync, readFileSync } from 'fs';
import { Buf } from '../core/buf';
import { testConstants } from './tooling/consts';
import { BrowserRecipe } from './tooling/browser-recipe';
import { ConfigurationProvider } from '../mock/lib/api';
import { somePubkey } from '../mock/attester/attester-key-constants';
import { aliceKey, jackAdvancedKey, johnDoeDirectKey, johnDoeAdvancedKey } from '../mock/wkd/wkd-constants';

type UnitTest = { title: string; code: string; acct?: CommonAcct; only: boolean };

export const defineUnitBrowserTests = (testVariant: TestVariant, testWithBrowser: TestWithBrowser) => {
  if (testVariant !== 'CONSUMER-LIVE-GMAIL') {
    const browserUnitTestsFolder = './test/source/tests/browser-unit-tests/';

    const defineAvaTest = (title: string, testCode: string, acct?: CommonAcct, flag?: 'only') => {
      // eslint-disable-next-line no-only-tests/no-only-tests
      (flag !== 'only' ? test : test.only)(
        title,
        testWithBrowser(async (t, browser) => {
          if (acct) {
            t.mockApi!.configProvider = new ConfigurationProvider({
              attester: {
                pubkeyLookup: {
                  'ci.tests.gmail@flowcrypt.test': {
                    pubkey: somePubkey,
                  },
                  'flowcrypt.compatibility@gmail.com': {
                    pubkey: somePubkey,
                  },
                },
              },
            });
            await BrowserRecipe.setUpCommonAcct(t, browser, acct);
          } else {
            t.mockApi!.configProvider = new ConfigurationProvider({
              wkd: {
                directLookup: {
                  'john.doe': { pubkeys: [johnDoeDirectKey] },
                  'jack.advanced': { pubkeys: [jackAdvancedKey] },
                },
                advancedLookup: {
                  'john.doe': { pubkeys: [johnDoeAdvancedKey] },
                  incorrect: { pubkeys: [aliceKey] },
                  'some.revoked': { pubkeys: [testConstants.somerevokedRevoked1, testConstants.somerevokedValid, testConstants.somerevokedRevoked2] },
                },
              },
            });
          }
          const hostPage = await browser.newExtensionPage(t, 'chrome/dev/ci_unit_test.htm');
          // update host page h1
          await hostPage.target.evaluate(title => {
            window.document.getElementsByTagName('h1')[0].textContent = title;
          }, title);
          // inject testConstants
          await hostPage.target.evaluate(object => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (window as any).testConstants = object;
          }, testConstants);
          // prepare code to run
          const testCodeWithMockPort = testCode.replace(/\:8001/g, ':' + t.urls?.port);
          const runThisCodeInBrowser = `
            (async () => {
              try {
                return await ${testCodeWithMockPort}
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
        })
      );
    };

    const parseTestFile = (filename: string): UnitTest[] => {
      const unitTestCodes = Buf.fromUint8(readFileSync(browserUnitTestsFolder + filename))
        .toUtfStr()
        .trim();
      const testCasesInFile = unitTestCodes.split('\nBROWSER_UNIT_TEST_NAME(');
      const header = testCasesInFile.shift();
      if (!header?.startsWith('/* ©️ 2016')) {
        throw Error(`Expecting ${browserUnitTestsFolder}/${filename} to start with '/* ©️ 2016'`);
      }
      if (header.includes('require(') || header.includes('import')) {
        // do not import anything. Add deps to ci_unit_test.ts
        throw Error(`Unexpected import statement found in ${browserUnitTestsFolder}/${filename}`);
      }
      const unitTests: UnitTest[] = [];
      for (let code of testCasesInFile) {
        if (code.includes('/*')) {
          // just to make sure we don't parse something wrongly. Block comment only allowed in header.
          throw Error(`Block comments such as /* are not allowed in test definitions. Use line comments eg //`);
        }
        code = code.trim();
        if (!code.startsWith('`')) {
          console.error(code);
          throw Error(`Test case name should be in backticks`);
        }
        if (!code.endsWith('})();')) {
          console.error(code);
          throw Error(`Test case does not end with '})();'. Did you put code outside of the async functions? (forbidden)`);
        }
        const testCodeLines = code.split('\n');
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        let thisUnitTestTitle = testCodeLines.shift()!.trim();
        if (thisUnitTestTitle.endsWith(';')) {
          thisUnitTestTitle = thisUnitTestTitle.slice(0, -1);
        }
        let only = false;
        let consumerOnly = false;
        let enterpriseOnly = false;
        let acct: CommonAcct | undefined;
        const options = thisUnitTestTitle.split('.');
        for (;;) {
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
        thisUnitTestTitle = thisUnitTestTitle.slice(1).replace(/`.+$/, '');
        code = testCodeLines.join('\n'); // without the title, just code
        const title = `[${filename}] ${thisUnitTestTitle}`;
        unitTests.push({ title, code, only, acct });
      }
      return unitTests;
    };

    const allUnitTests: UnitTest[] = [];
    for (const filename of readdirSync(browserUnitTestsFolder)) {
      if (!filename.startsWith('.')) {
        allUnitTests.push(...parseTestFile(filename));
      }
    }
    const markedAsOnly = allUnitTests.filter(unitTest => unitTest.only);
    if (!markedAsOnly.length) {
      // no tests marked as only - run all
      for (const unitTest of allUnitTests) {
        defineAvaTest(unitTest.title, unitTest.code, unitTest.acct);
      }
    } else {
      // some tests marked as only - only run those + run one test that always fails
      for (const unitTest of markedAsOnly) {
        defineAvaTest(unitTest.title, unitTest.code, unitTest.acct, 'only');
      }
      // eslint-disable-next-line no-only-tests/no-only-tests
      test.only('reminder to remove .only', async t => {
        t.fail(`some tests marked as .only, preventing other tests from running`);
      });
    }
  }
};
