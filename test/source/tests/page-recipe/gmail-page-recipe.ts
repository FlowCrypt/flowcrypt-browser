/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { BrowserHandle, ControllablePage, TIMEOUT_PAGE_LOAD } from '../../browser';

import { AvaContext } from '../tooling/';
import { PageRecipe } from './abstract-page-recipe';
import { expect } from 'chai';
import { Util } from '../../util';

export class GmailPageRecipe extends PageRecipe {
  public static openSecureCompose = async (t: AvaContext, gmailPage: ControllablePage, browser: BrowserHandle): Promise<ControllablePage> => {
    await gmailPage.waitAndClick('@action-secure-compose', { delay: 1 });
    await gmailPage.waitAll('@container-new-message');
    const urls = await gmailPage.getFramesUrls(['/chrome/elements/compose.htm'], { sleep: 1 });
    expect(urls.length).to.equal(1);
    return await browser.newPage(t, `${urls[0]}&debug=___cu_true___`);
  };

  public static getSubscribeDialog = async (t: AvaContext, gmailPage: ControllablePage, browser: BrowserHandle): Promise<ControllablePage> => {
    await gmailPage.waitAll('@dialog-subscribe');
    const urls = await gmailPage.getFramesUrls(['/chrome/elements/subscribe.htm'], { sleep: 1 });
    expect(urls.length).to.equal(1);
    return await browser.newPage(t, urls[0]);
  };

  public static closeInitialSetupNotif = async (gmailPage: ControllablePage) => {
    await gmailPage.waitAndClick('@notification-successfully-setup-action-close');
  };

  public static deleteThread = async (gmailPage: ControllablePage) => {
    await gmailPage.page.keyboard.press('#');
    await gmailPage.waitForContent('.bAq', 'Conversation moved to Trash');
  };

  public static trimConvo = async (gmailPage: ControllablePage, messageId: string) => {
    const messageIdAttrName = 'data-legacy-message-id';
    while (true) {
      await gmailPage.getFrame(['pgp_block.htm']); // wait for the page to load properly
      // checking id of the last message in the thread
      await gmailPage.ensureElementsCount(`[${messageIdAttrName}]`, 1);
      const lastMessageElement = await gmailPage.target.$(`[${messageIdAttrName}]`);
      const lastMessageId = lastMessageElement ? await PageRecipe.getElementAttribute(lastMessageElement, messageIdAttrName) : undefined;
      expect(typeof lastMessageId === 'string' && lastMessageId.length === 16).to.be.true;
      if (!lastMessageId || !lastMessageElement || lastMessageId === messageId) {
        break;
      }
      // deleting last reply
      const moreActionsButton = await lastMessageElement.$$('[aria-label="More"]');
      expect(moreActionsButton.length).to.equal(1);
      await moreActionsButton[0].click();
      await gmailPage.press('ArrowDown', 5);
      await gmailPage.press('Enter');
      await Util.sleep(3);
      await gmailPage.page.reload({ timeout: TIMEOUT_PAGE_LOAD * 1000, waitUntil: 'networkidle2' });
    }

    if (await gmailPage.isElementPresent('//*[text()="delete forever"]')) {
      // Gmail has 100 emails per thread limit, so if there are 98 deleted messages + 1 initial message,
      // the draft number 100 won't be saved. Therefore, we need to delete forever trashed messages from this thread.
      await gmailPage.click('//*[text()="delete forever"]');
    }
  };
}
