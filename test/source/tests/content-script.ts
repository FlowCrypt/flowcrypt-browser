/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import test from 'ava';

import { TestWithBrowser } from '../test';
import { expect } from 'chai';
import { Value } from '../core/common';

export const defineContentScriptTests = (testWithBrowser: TestWithBrowser) => {
  test(
    'content script test',
    testWithBrowser(async (t, browser) => {
      const authorizationHeader = {
        Authorization: 'Bearer just-to-load-and-run-content-scripts', // eslint-disable-line @typescript-eslint/naming-convention
      };
      const gmailPage = await browser.newMockGmailPage(t, authorizationHeader);
      await gmailPage.waitAny('@content-script-test-result');
      const allValues = (await gmailPage.readAll('@content-script-test-result')).map(el => el.innerText);
      // multiple results appear in Firefox. The test is successful only if all divs have the word 'pass'
      expect(Value.arr.unique(allValues)).to.eql(['pass']);
      await gmailPage.close();
    })
  );
};
