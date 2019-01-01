import { TestWithBrowser, TestWithGlobalBrowser } from '..';
import * as ava from 'ava';
import { Config, Util } from '../../util';
import { BrowserRecipe } from '../browser_recipe';
import { Url } from '../../browser';
import { SettingsPageRecipe } from '../page_recipe';

export const defineDecryptTests = (testWithNewBrowser: TestWithBrowser, testWithSemaphoredBrowser: TestWithGlobalBrowser) => {

  for (const m of Config.tests.messages) {
    ava.test(`decrypt[global] - ${m.name}`, testWithSemaphoredBrowser('compatibility', async (browser, t) => {
      await BrowserRecipe.pgpBlockVerifyDecryptedContent(browser, `chrome/elements/pgp_block.htm${m.params}`, m.content, m.password);
    }));
  }

  ava.test('decrypt[global] - by entering pass phrase', testWithNewBrowser(async (browser, t) => {
    const pp = Config.key('flowcrypt.compatibility.1pp1').passphrase;
    await BrowserRecipe.setUpFcCompatAcct(browser);
    const settingsPage = await browser.newPage(Url.extensionSettings('flowcrypt.compatibility@gmail.com'));
    await SettingsPageRecipe.changePassphraseRequirement(settingsPage, pp, 'session');
    const inboxPage = await browser.newPage(Url.extension(`chrome/settings/inbox/inbox.htm?acctEmail=flowcrypt.compatibility%40gmail.com&threadId=15f7f5630573be2d`));
    await inboxPage.waitAll('iframe');
    const pgpBlockFrame = await inboxPage.getFrame(['pgp_block.htm']);
    await pgpBlockFrame.waitAll('@pgp-block-content');
    await pgpBlockFrame.waitForSelTestState('ready');
    await pgpBlockFrame.waitAndClick('@action-show-passphrase-dialog', { delay: 1 });
    await inboxPage.waitAll('@dialog-passphrase');
    const ppFrame = await inboxPage.getFrame(['passphrase.htm']);
    await ppFrame.waitAndType('@input-pass-phrase', pp);
    await ppFrame.waitAndClick('@action-confirm-pass-phrase-entry', { delay: 1 });
    await pgpBlockFrame.waitForSelTestState('ready');
    await Util.sleep(1);
    const content = await pgpBlockFrame.read('@pgp-block-content');
    if (content.indexOf('The International DUBLIN Literary Award is an international literary award') === -1) {
      throw new Error(`message did not decrypt`);
    }
    // todo - test secondary key
  }));

};
