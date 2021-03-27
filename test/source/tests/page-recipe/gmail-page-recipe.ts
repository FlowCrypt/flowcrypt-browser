/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { BrowserHandle, ControllablePage } from '../../browser';

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
  }

  public static getSubscribeDialog = async (t: AvaContext, gmailPage: ControllablePage, browser: BrowserHandle): Promise<ControllablePage> => {
    await gmailPage.waitAll('@dialog-subscribe');
    const urls = await gmailPage.getFramesUrls(['/chrome/elements/subscribe.htm'], { sleep: 1 });
    expect(urls.length).to.equal(1);
    return await browser.newPage(t, urls[0]);
  }

  public static closeInitialSetupNotif = async (gmailPage: ControllablePage) => {
    await gmailPage.waitAndClick('@notification-successfully-setup-action-close');
  }

  public static deleteMessage = async (gmailPage: ControllablePage) => {
    // the toolbar needs to be focused in order for Delete button to work
    await gmailPage.page.keyboard.down('Shift');
    for (let i = 0; i < 5; i++) {
      await gmailPage.press('Tab');
    }
    await gmailPage.page.keyboard.up('Shift');
    await gmailPage.waitAndClick('[aria-label="Delete"]');
  }

  // todo - is this the same as the one above?
  public static deleteLastReply = async (gmailPage: ControllablePage) => {
    await gmailPage.waitAndClick('[aria-label="More"]');
    await gmailPage.press('ArrowDown', 5);
    await gmailPage.press('Enter');
    await Util.sleep(3);
  };

}
