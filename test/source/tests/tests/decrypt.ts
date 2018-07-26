import {TestWithBrowser} from '..';
import {PageRecipe} from '../page_recipe';
import {BrowserRecipe} from '../browser_recipe';
import {Url} from '../../browser';
import * as ava from 'ava';
import { Util } from '../../util';
import { config_k, config } from '../../config';

export let define_decrypt_tests = (test_with_new_browser: TestWithBrowser) => {

  for(let m of config.messages) {
    ava.test(`decrypt - ${m.name}`, test_with_new_browser(async (browser, t) => {
      await BrowserRecipe.set_up_flowcrypt_compatibility_account(browser);
      let pgp_block_page = await browser.new_page(`chrome/elements/pgp_block.htm${m.params}`);
      await pgp_block_page.wait_all('@pgp-block-content');
      await pgp_block_page.wait_for_selector_test_state('ready', 20);
      await Util.sleep(1);
      let content = await pgp_block_page.read('@pgp-block-content');
      for(let j = 0; j < m.content.length; j++) {
        if(content.indexOf(m.content[j]) === -1) {
          await pgp_block_page.close();
          throw new Error(`tests:pgp_block:${m.name}: missing expected content:${m.content[j]}`);
        }
      }
      await pgp_block_page.close();
    }));
  }

};
