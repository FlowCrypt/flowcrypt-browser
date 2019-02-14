import { TestWithBrowser, TestWithGlobalBrowser } from '..';
import * as ava from 'ava';
import { Config } from '../../util';
import { BrowserRecipe } from '../browser_recipe';
import { Url } from '../../browser';
import { SettingsPageRecipe, InboxPageRecipe } from '../page_recipe';
import { TestVariant } from '../../test';

export const defineDecryptTests = (testVariant: TestVariant, testWithNewBrowser: TestWithBrowser, testWithSemaphoredBrowser: TestWithGlobalBrowser) => {

  for (const m of Config.tests.messages) {
    ava.test(`decrypt[global:compatibility] - ${m.name}`, testWithSemaphoredBrowser('compatibility', async (t, browser) => {
      await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, `chrome/elements/pgp_block.htm${m.params}`, m.content, m.password);
    }));
  }

  ava.test('decrypt[global:compatibility] - by entering pass phrase + remember in session', testWithNewBrowser(async (t, browser) => {
    const pp = Config.key('flowcrypt.compatibility.1pp1').passphrase;
    const threadId = '15f7f5630573be2d';
    const expectedContent = 'The International DUBLIN Literary Award is an international literary award';
    const acctEmail = 'flowcrypt.compatibility@gmail.com';
    await BrowserRecipe.setUpCommonAcct(t, browser, 'compatibility');
    const settingsPage = await browser.newPage(t, Url.extensionSettings());
    await SettingsPageRecipe.changePassphraseRequirement(settingsPage, pp, 'session');
    // requires pp entry
    await InboxPageRecipe.checkDecryptMsg(t, browser, { acctEmail, threadId, expectedContent, enterPp: Config.key('flowcrypt.compatibility.1pp1').passphrase });
    // now remembers pp in session
    await InboxPageRecipe.checkDecryptMsg(t, browser, { acctEmail, threadId, expectedContent });
  }));

  ava.test.todo('decrypt[global:compatibility] - by entering secondary pass phrase');

};
