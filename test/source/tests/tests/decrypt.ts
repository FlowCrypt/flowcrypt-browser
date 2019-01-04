import { TestWithBrowser, TestWithGlobalBrowser } from '..';
import * as ava from 'ava';
import { Config, Util } from '../../util';
import { BrowserRecipe } from '../browser_recipe';
import { Url } from '../../browser';
import { SettingsPageRecipe, InboxPageRecipe } from '../page_recipe';

export const defineDecryptTests = (testWithNewBrowser: TestWithBrowser, testWithSemaphoredBrowser: TestWithGlobalBrowser) => {

  for (const m of Config.tests.messages) {
    ava.test(`decrypt[global] - ${m.name}`, testWithSemaphoredBrowser('compatibility', async (browser, t) => {
      await BrowserRecipe.pgpBlockVerifyDecryptedContent(browser, `chrome/elements/pgp_block.htm${m.params}`, m.content, m.password);
    }));
  }

  ava.test('decrypt[global] - by entering pass phrase', testWithNewBrowser(async (browser, t) => {
    const pp = Config.key('flowcrypt.compatibility.1pp1').passphrase;
    await BrowserRecipe.setUpFcCompatAcct(browser);
    const settingsPage = await browser.newPage(Url.extensionSettings());
    await SettingsPageRecipe.changePassphraseRequirement(settingsPage, pp, 'session');
    await InboxPageRecipe.decryptMsgCheckContent(browser, {
      acctEmail: 'flowcrypt.compatibility@gmail.com',
      threadId: '15f7f5630573be2d',
      enterPassphrase: Config.key('flowcrypt.compatibility.1pp1').passphrase,
      expectedContent: 'The International DUBLIN Literary Award is an international literary award',
    });
  }));

  ava.test.todo('decrypt[global] - by entering secondary pass phrase');

};
