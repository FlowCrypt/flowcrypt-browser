import {TestWithBrowser} from '..';
import * as ava from 'ava';
import { Util, Config } from '../../util';
import { BrowserHandle } from '../../browser';

export let define_decrypt_tests = (test_with_new_browser: TestWithBrowser, test_with_semaphored_global_browser: TestWithBrowser) => {

  let pgp_block_unit_test = async (browser: BrowserHandle, m: typeof Config.tests.messages[0]) => {
    let pgp_block_page = await browser.new_page(`chrome/elements/pgp_block.htm${m.params}`);
    await pgp_block_page.wait_all('@pgp-block-content');
    await pgp_block_page.wait_for_selector_test_state('ready', 100);
    await Util.sleep(1);
    let content = await pgp_block_page.read('@pgp-block-content');
    for(let expected_content of m.content) {
      if(content.indexOf(expected_content) === -1) {
        await pgp_block_page.close();
        throw new Error(`tests:pgp_block:${m.name}: missing expected content:${expected_content}`);
      }
    }
    await pgp_block_page.close();
  };

  for(let m of Config.tests.messages) {
    ava.test(`decrypt[global] - ${m.name}`, test_with_semaphored_global_browser(async (browser, t) => {
      await pgp_block_unit_test(browser, m);
    }));
  }

};
