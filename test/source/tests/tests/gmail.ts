import { TestWithBrowser, TestWithGlobalBrowser } from '..';
import { Url, BrowserHandle, ControllablePage } from '../../browser';
import * as ava from 'ava';
import { expect } from 'chai';
import { BrowserRecipe } from '../browser_recipe';
import { ComposePageRecipe, GmailPageRecipe } from '../page_recipe';

export const defineGmailTests = (testWithNewBrowser: TestWithBrowser, testWithSemaphoredGlobalBrowser: TestWithGlobalBrowser) => {

  const pageHasReplyContainer = async (gmailPage: ControllablePage) => {
    const urls = await gmailPage.getFramesUrls(['/chrome/elements/compose.htm'], { sleep: 0 });
    expect(urls.length).to.equal(1);
  };

  const openGmailPage = async (browser: BrowserHandle, path: string): Promise<ControllablePage> => {
    const url = Url.gmail(0, path);
    const gmialPage = await browser.newPage(url);
    await gmialPage.waitAll('@action-secure-compose');
    if (path) { // gmail does weird things with navigation sometimes, nudge it again
      await gmialPage.goto(url);
    }
    return gmialPage;
  };

  ava.test('mail.google.com[global] - compose window opens', testWithSemaphoredGlobalBrowser('compatibility', async (browser, t) => {
    const gmailPage = await BrowserRecipe.openGmailPageAndVerifyComposeBtnPresent(browser);
    const composePage = await GmailPageRecipe.openSecureCompose(gmailPage, browser);
  }));

  ava.test('mail.google.com[global] - msg.asc message content renders', testWithSemaphoredGlobalBrowser('compatibility', async (browser, t) => {
    const gmailPage = await openGmailPage(browser, '/WhctKJTrdTXcmgcCRgXDpVnfjJNnjjLzSvcMDczxWPMsBTTfPxRDMrKCJClzDHtbXlhnwtV');
    const urls = await gmailPage.getFramesUrls(['/chrome/elements/pgp_block.htm'], { sleep: 10 });
    expect(urls.length).to.equal(1);
    await BrowserRecipe.pgpBlockVerifyDecryptedContent(browser, urls[0], ['This is a test, as requested by the Flowcrypt team', 'mutt + gnupg']);
    await pageHasReplyContainer(gmailPage);
  }));

  ava.test('mail.google.com[global] - pubkey file gets rendered', testWithSemaphoredGlobalBrowser('compatibility', async (browser, t) => {
    const gmailPage = await openGmailPage(browser, '/WhctKJTrSJzzjsZVrGcLhhcDLKCJKVrrHNMDLqTMbSjRZZftfDQWbjDWWDsmrpJVHWDblwg');
    const urls = await gmailPage.getFramesUrls(['/chrome/elements/pgp_pubkey.htm'], { sleep: 10 });
    expect(urls.length).to.equal(1);
    await pageHasReplyContainer(gmailPage);
  }));

  // const compose_frame = await gmail_page.get_frame(['compose.htm']);
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
