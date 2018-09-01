import {TestWithBrowser, TestWithGlobalBrowser} from '..';
import {Url, BrowserHandle, ControllablePage} from '../../browser';
import * as ava from 'ava';
import {expect} from 'chai';
import {BrowserRecipe} from '../browser_recipe';

export let define_gmail_tests = (test_with_new_browser: TestWithBrowser, test_with_semaphored_global_browser: TestWithGlobalBrowser) => {

  let page_has_a_reply_container = async (gmail_page: ControllablePage) => {
    let urls = await gmail_page.get_frames_hrefs(['/chrome/elements/compose.htm'], {sleep: 0});
    expect(urls.length).to.equal(1);
  };

  let open_gmail_page = async (browser: BrowserHandle, path: string): Promise<ControllablePage> => {
    let url = Url.gmail(0, path);
    let gmail_page = await browser.new_page(url);
    await gmail_page.wait_all('@action-secure-compose');
    if(path) { // gmail does weird things with navigation sometimes, nudge it again
      await gmail_page.goto(url);
    }
    return gmail_page;
  };

  ava.test('mail.google.com[global] - compose window opens', test_with_semaphored_global_browser('compatibility', async (browser, t) => {
    let gmail_page = await browser.new_page(Url.gmail());
    await gmail_page.wait_and_click('@action-secure-compose', {delay: 1});
    await gmail_page.wait_all('@container-new-message');
  }));

  ava.test.todo('inbox.google.com - compose window opens');

  ava.test('mail.google.com[global] - msg.asc message content renders', test_with_semaphored_global_browser('compatibility', async (browser, t) => {
    let gmail_page = await open_gmail_page(browser, '/WhctKJTrdTXcmgcCRgXDpVnfjJNnjjLzSvcMDczxWPMsBTTfPxRDMrKCJClzDHtbXlhnwtV');
    let urls = await gmail_page.get_frames_hrefs(['/chrome/elements/pgp_block.htm'], {sleep: 10});
    expect(urls.length).to.equal(1);
    await BrowserRecipe.pgp_block_verify_decrypted_content(browser, urls[0], ['This is a test, as requested by the Flowcrypt team', 'mutt + gnupg']);
    await page_has_a_reply_container(gmail_page);
  }));

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
