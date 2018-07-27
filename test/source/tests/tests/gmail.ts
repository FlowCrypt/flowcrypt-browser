
import {TestWithBrowser} from '..';
import {Url} from '../../browser';
import * as ava from 'ava';

export let define_gmail_tests = (test_with_new_browser: TestWithBrowser, test_with_semaphored_global_browser: TestWithBrowser) => {

  ava.test('mail.google.com[global] - compose window opens', test_with_semaphored_global_browser(async (browser, t) => {
    let gmail_page = await browser.new_page(Url.gmail());
    await gmail_page.wait_and_click('@action-secure-compose', {delay: 1});
    await gmail_page.wait_all('@container-new-message');
  }));

  ava.test.todo('inbox.google.com - compose window opens');

  // let compose_frame = await gmail_page.get_frame(['compose.htm']);
  // Task.compose_fill_message(compose_frame, 'human@flowcrypt.com', 'message from gmail');
  // await compose_frame.wait_and_click('@action-send', {delay: 0.5});
  // await gmail_page.wait_till_gone('@container-new-message');
  // await gmail_page.wait_all('@webmail-notification'); // message sent
  // assert(await gmail_page.read('@webmail-notification'), 'Your encrypted message has been sent.', 'gmail notifiaction message');
  // await gmail_page.click('@webmail-notification');
  // await gmail_page.wait_till_gone('@webmail-notification');
  // log('tests:gmail:secure compose works from gmail + compose frame disappears + notification shows + notification disappears');

  // google inbox - need to hover over the button first
  // await gmail_page.goto('https://inbox.google.com');
  // await gmail_page.wait_and_click('@action-secure-compose', 1);
  // await gmail_page.wait('@container-new-message');
  // log('gmail:tests:secure compose button (inbox.google.com)');

};
