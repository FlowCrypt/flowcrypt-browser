import { TestWithBrowser, TestWithGlobalBrowser, AvaContext } from '..';
import { Url, BrowserHandle, ControllablePage } from '../../browser';
import * as ava from 'ava';
import { expect } from 'chai';
import { BrowserRecipe } from '../browser_recipe';
import { GmailPageRecipe } from '../page_recipe';
import { TestVariant } from '../../test';

// tslint:disable:no-blank-lines-func

export const defineGmailTests = (testVariant: TestVariant, testWithNewBrowser: TestWithBrowser, testWithSemaphoredGlobalBrowser: TestWithGlobalBrowser) => {

  const pageHasReplyContainer = async (gmailPage: ControllablePage) => {
    const urls = await gmailPage.getFramesUrls(['/chrome/elements/compose.htm'], { sleep: 0 });
    expect(urls.length).to.equal(1);
  };

  const openGmailPage = async (t: AvaContext, browser: BrowserHandle, path: string): Promise<ControllablePage> => {
    const url = Url.gmail(0, path);
    const gmialPage = await browser.newPage(t, url);
    await gmialPage.waitAll('@action-secure-compose');
    if (path) { // gmail does weird things with navigation sometimes, nudge it again
      await gmialPage.goto(url);
    }
    return gmialPage;
  };

  ava.test('mail.google.com[global:compatibility] - compose window opens', testWithSemaphoredGlobalBrowser('compatibility', async (t, browser) => {
    const gmailPage = await BrowserRecipe.openGmailPageAndVerifyComposeBtnPresent(t, browser);
    const composePage = await GmailPageRecipe.openSecureCompose(t, gmailPage, browser);
  }));

  ava.test('mail.google.com[global:compatibility] - msg.asc message content renders', testWithSemaphoredGlobalBrowser('compatibility', async (t, browser) => {
    const gmailPage = await openGmailPage(t, browser, '/WhctKJTrdTXcmgcCRgXDpVnfjJNnjjLzSvcMDczxWPMsBTTfPxRDMrKCJClzDHtbXlhnwtV');
    const urls = await gmailPage.getFramesUrls(['/chrome/elements/pgp_block.htm'], { sleep: 10, appearIn: 20 });
    expect(urls.length).to.equal(1);
    await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, urls[0], ['This is a test, as requested by the Flowcrypt team', 'mutt + gnupg']);
    await pageHasReplyContainer(gmailPage);
  }));

  ava.test('mail.google.com[global:compatibility] - pubkey file gets rendered', testWithSemaphoredGlobalBrowser('compatibility', async (t, browser) => {
    const gmailPage = await openGmailPage(t, browser, '/WhctKJTrSJzzjsZVrGcLhhcDLKCJKVrrHNMDLqTMbSjRZZftfDQWbjDWWDsmrpJVHWDblwg');
    const urls = await gmailPage.getFramesUrls(['/chrome/elements/pgp_pubkey.htm'], { sleep: 10, appearIn: 20 });
    expect(urls.length).to.equal(1);
    await pageHasReplyContainer(gmailPage);
  }));

  ava.test.only('mail.google.com[global:compatibility] - pubkey gets rendered when using quoted-printable mime', testWithSemaphoredGlobalBrowser('compatibility', async (t, browser) => {
    const gmailPage = await openGmailPage(t, browser, '/WhctKJVRFztXGwvSbwcrbDshGTnLWMFvhwJmhqllRWwvpKnlpblQMXVZLTsKfWdPWKhPFBV');
    const urls = await gmailPage.getFramesUrls(['/chrome/elements/pgp_pubkey.htm'], { sleep: 10, appearIn: 20 });
    expect(urls.length).to.equal(1);
    await pageHasReplyContainer(gmailPage);
    const pubkeyPage = await browser.newPage(t, urls[0]);
    const content = await pubkeyPage.read('body');
    expect(content).to.contain('STONE NEED REMAIN SLIDE DEPOSIT BRICK');
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
