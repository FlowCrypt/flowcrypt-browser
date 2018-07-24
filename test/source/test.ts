/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

import {print_results} from './logger';
import {tests} from './tests';
import {BrowserPool} from './browser';

(async () => {

  let pool = new BrowserPool(1);
  let handle = await pool.new_browser_handle();

  await tests.initial_page_shows(handle);
  await tests.unit_tests(handle);
  await tests.login_and_setup_tests(handle);
  await tests.settings_tests(handle);
  await tests.pgp_block_tests(handle);
  await tests.compose_tests(handle);
  await tests.gmail_tests(handle);

  await handle.close();
  print_results();

})();
