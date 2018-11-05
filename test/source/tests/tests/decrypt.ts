import { TestWithBrowser, TestWithGlobalBrowser } from '..';
import * as ava from 'ava';
import { Util, Config } from '../../util';
import { BrowserRecipe } from '../browser_recipe';

export let defineDecryptTests = (testWithNewBrowser: TestWithBrowser, testWithSemaphoredBrowser: TestWithGlobalBrowser) => {

  for (let m of Config.tests.messages) {
    ava.test(`decrypt[global] - ${m.name}`, testWithSemaphoredBrowser('compatibility', async (browser, t) => {
      await BrowserRecipe.pgpBlockVerifyDecryptedContent(browser, `chrome/elements/pgp_block.htm${m.params}`, m.content, m.password);
    }));
  }

};
