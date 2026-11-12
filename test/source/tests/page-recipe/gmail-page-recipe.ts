/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { BrowserHandle } from '../../browser/browser-handle';
import { ControllablePage } from '../../browser/controllable';
import { TIMEOUT_ELEMENT_GONE } from '../../browser';

import { AvaContext } from '../tooling/';
import { PageRecipe } from './abstract-page-recipe';
import { expect } from 'chai';

export class GmailPageRecipe extends PageRecipe {
  public static dismissMobileNotificationsPrompt = async (gmailPage: ControllablePage) => {
    const selector =
      'xpath/.//*[@role="dialog"][.//div[starts-with(normalize-space(text()), "Pause mobile notifications while")]]//button[@aria-label="Close"]';
    const closeButton = await gmailPage.page.$(selector);
    if (!closeButton) {
      return;
    }
    try {
      if (await closeButton.isVisible()) {
        await closeButton.press('Enter');
        const hiddenButton = await gmailPage.page.waitForSelector(selector, { hidden: true, timeout: TIMEOUT_ELEMENT_GONE * 1000 });
        await hiddenButton?.dispose();
        gmailPage.t.log('Dismissed Gmail’s pause mobile notifications prompt');
      }
    } finally {
      await closeButton.dispose();
    }
  };

  public static openSecureComposeWithRichTextWorkaround = async (
    t: AvaContext,
    gmailPage: ControllablePage,
    browser: BrowserHandle
  ): Promise<ControllablePage> => {
    await gmailPage.waitAndClick('@action-secure-compose', { delay: 1 });
    await gmailPage.waitAll('@container-new-message');
    const urls = await gmailPage.getFramesUrls(['/chrome/elements/compose.htm'], { sleep: 1 });
    expect(urls.length).to.equal(1);
    return await browser.newPage(t, `${urls[0]}&debug=___cu_true___`);
  };

  public static closeInitialSetupNotif = async (gmailPage: ControllablePage) => {
    await gmailPage.waitAndClick('@notification-successfully-setup-action-close');
  };

  public static deleteThread = async (gmailPage: ControllablePage) => {
    await gmailPage.page.keyboard.press('#');
    await gmailPage.waitForContent('.bAq', 'Conversation moved to Trash');
  };

  public static expandMainMenuIfNeeded = async (gmailPage: ControllablePage) => {
    const mainMenu = await gmailPage.waitAny('[aria-label="Main menu"]');
    const expanded = await PageRecipe.getElementAttribute(mainMenu, 'aria-expanded');
    if (expanded === 'false') {
      await mainMenu.click();
    }
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
      const lastMessage = `[${messageIdAttrName}="${lastMessageId}"]`;
      await this.dismissMobileNotificationsPrompt(gmailPage);
      await gmailPage.waitAndFocus(`${lastMessage} [aria-label="More message options"]`);
      await gmailPage.press('Enter');
      const deleteItem = await gmailPage.waitAny('li[data-action-type="11"]'); // Delete this message
      try {
        await deleteItem.press('Enter');
      } finally {
        await deleteItem.dispose();
      }
      await gmailPage.waitTillGone(lastMessage);
    }

    if (await gmailPage.isElementPresent('//*[text()="delete forever"]')) {
      // Gmail has 100 emails per thread limit, so if there are 98 deleted messages + 1 initial message,
      // the draft number 100 won't be saved. Therefore, we need to delete forever trashed messages from this thread.
      await gmailPage.click('//*[text()="delete forever"]');
    }
  };
}
