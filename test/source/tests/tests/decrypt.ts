import { TestWithBrowser, TestWithGlobalBrowser } from '..';
import * as ava from 'ava';
import { Util, Config } from '../../util';
import { BrowserRecipe } from '../browser_recipe';

export let define_decrypt_tests = (test_with_new_browser: TestWithBrowser, test_with_semaphored_global_browser: TestWithGlobalBrowser) => {

  for(let m of Config.tests.messages) {
    ava.test.only(`decrypt[global] - ${m.name}`, test_with_semaphored_global_browser('compatibility', async (browser, t) => {
      await BrowserRecipe.pgp_block_verify_decrypted_content(browser, `chrome/elements/pgp_block.htm${m.params}`, m.content, m.password);
    }));
  }

};
