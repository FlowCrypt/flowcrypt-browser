/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { BrowserHandle, Controllable, ControllablePage } from '../../browser';

import { AvaContext } from '../tooling/';
import { ElementHandle } from 'puppeteer';
import { Util } from '../../util';

type ModalOpts = {
  contentToCheck?: string;
  clickOn?: 'confirm' | 'cancel';
  getTriggeredPage?: boolean;
  timeout?: number;
};
type ModalType = 'confirm' | 'error' | 'info' | 'warning';

export abstract class PageRecipe {
  public static getElementPropertyJson = async (elem: ElementHandle, property: string) => {
    return (await (await elem.getProperty(property)).jsonValue()) as string;
  };

  public static getElementAttribute = async (elem: ElementHandle, attribute: string) => {
    return await elem.evaluate((el, attribute) => el.getAttribute(attribute), attribute);
  };

  public static waitForModalAndRespond = async (controllable: Controllable, type: ModalType, { contentToCheck, clickOn, timeout }: ModalOpts) => {
    const modalContainer = await controllable.waitAny(`.ui-modal-${type}`, { timeout });
    if (typeof contentToCheck !== 'undefined') {
      const contentElement = await modalContainer.$('.swal2-html-container');

      const actualContent = await PageRecipe.getElementPropertyJson(contentElement!, 'textContent');
      if (!actualContent.includes(contentToCheck)) {
        throw new Error(`Expected modal to contain "${contentToCheck}" but contained "${actualContent}"`);
      }
    }
    if (clickOn) {
      const button = await modalContainer.$(`button.ui-modal-${type}-${clickOn}`);
      await button?.click();
    }
  };

  public static checkModalLink = async (controllable: Controllable, type: ModalType, linktoCheck: string) => {
    const modalContainer = await controllable.waitAny(`.ui-modal-${type}`, { timeout: 15 });
    const contentElement = await modalContainer.$('.swal2-html-container a');

    const actualLink = await PageRecipe.getElementPropertyJson(contentElement!, 'textContent');
    if (!actualLink.includes(linktoCheck)) {
      throw new Error(`Expected link "${linktoCheck}" not found. Actual content: "${actualLink}"`);
    }
  };

  public static waitForToastToAppearAndDisappear = async (controllable: Controllable, containsText: string | RegExp): Promise<void> => {
    await controllable.waitForContent('.ui-toast-title', containsText);
    await controllable.waitTillGone('.ui-toast-title');
  };

  public static noToastAppears = async (controllable: Controllable, waitSeconds = 5): Promise<void> => {
    await controllable.notPresent('.ui-toast-container');
    for (let i = 0; i < waitSeconds; i++) {
      await Util.sleep(1);
      await controllable.notPresent('.ui-toast-container');
    }
  };

  public static sendMessage = async (controllable: Controllable, msg: unknown) => {
    return await controllable.target.evaluate(
      async msg =>
        await new Promise(resolve => {
          chrome.runtime.sendMessage(msg, resolve);
        }),
      msg
    );
  };

  public static addPubkey = async (t: AvaContext, browser: BrowserHandle, acctEmail: string, pubkey: string, email?: string) => {
    const pubFrameUrl = `chrome/elements/pgp_pubkey.htm?frameId=none&armoredPubkey=${encodeURIComponent(pubkey)}&acctEmail=${encodeURIComponent(
      acctEmail
    )}&parentTabId=0`;
    const pubFrame = await browser.newPage(t, pubFrameUrl);
    if (email) {
      await pubFrame.waitAndType('@input-email', email);
    }
    await pubFrame.waitAndClick('@action-add-contact');
    await Util.sleep(1);
    await pubFrame.close();
  };
  /**
   * responding to modal triggers a new page to be open, eg oauth login page
   */
  public static async waitForModalGetTriggeredPageAfterResponding(
    t: AvaContext,
    browser: BrowserHandle,
    controllable: ControllablePage,
    type: ModalType,
    modalOpts: ModalOpts
  ): Promise<ControllablePage> {
    return await browser.newPageTriggeredBy(t, () => PageRecipe.waitForModalAndRespond(controllable, type, modalOpts));
  }
}
