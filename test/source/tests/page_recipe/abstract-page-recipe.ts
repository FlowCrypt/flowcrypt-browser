import { BrowserHandle, Controllable, ControllablePage } from '../../browser';

import { AvaContext } from '..';
import { ElementHandle } from 'puppeteer';
import { expect } from 'chai';

type ModalOpts = { contentToCheck?: string, clickOn?: 'confirm' | 'cancel', getTriggeredPage?: boolean, timeout?: number };
type ModalType = 'confirm' | 'error' | 'info' | 'warning';

export abstract class PageRecipe {
  public static getElementPropertyJson = async (elem: ElementHandle<Element>, property: string) => {
    return await (await elem.getProperty(property)).jsonValue() as string;
  }

  public static waitForModalAndRespond = async (controllable: Controllable, type: ModalType, { contentToCheck, clickOn, timeout }: ModalOpts) => {
    const modalContainer = await controllable.waitAny(`.ui-modal-${type}`, { timeout });
    if (typeof contentToCheck !== 'undefined') {
      const contentElement = await modalContainer.$('#swal2-content');
      expect(await PageRecipe.getElementPropertyJson(contentElement!, 'textContent')).to.include(contentToCheck);
    }
    if (clickOn) {
      const button = await modalContainer.$(`button.ui-modal-${type}-${clickOn}`);
      await button!.click();
    }
  }

  /**
   * responding to modal triggers a new page to be open, eg oauth login page
   */
  public static async waitForModalGetTriggeredPageAfterResponding(
    cookieAcct: string, t: AvaContext, browser: BrowserHandle, controllable: ControllablePage, type: ModalType, modalOpts: ModalOpts
  ): Promise<ControllablePage> {
    return await browser.newPageTriggeredBy(t, () => PageRecipe.waitForModalAndRespond(controllable, type, modalOpts), cookieAcct);
  }

}
