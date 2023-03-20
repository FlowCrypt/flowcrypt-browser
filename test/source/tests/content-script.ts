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
      expect(await gmailPage.read('@content-script-test-result')).to.equal('pass');
      await gmailPage.close();
    })
  );
};
