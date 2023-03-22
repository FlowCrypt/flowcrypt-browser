/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import test from 'ava';

import { TestWithBrowser } from '../test';
import { expect } from 'chai';

export const defineContentScriptTests = (testWithBrowser: TestWithBrowser) => {
  test(
    'content script test',
    testWithBrowser(undefined, async (t, browser) => {
      const authorizationHeader = {
        Authorization: 'Bearer just-to-load-and-run-content-scripts', // eslint-disable-line @typescript-eslint/naming-convention
      };
      const gmailPage = await browser.newMockGmailPage(t, authorizationHeader);
      await gmailPage.waitAny('@content-script-test-result');
      const allValues = (await gmailPage.readAll('@content-script-test-result')).map(el => el.innerText);
      // multiple result div may appear on exceptions. The test is successful only if there is exactly one div containing the word 'pass'
      expect(allValues).to.eql(['pass']);
      await gmailPage.close();
    })
  );
};
