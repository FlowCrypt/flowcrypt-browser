/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { BrowserHandle, Controllable, ControllablePage } from '../../browser';

import { AvaContext } from '../tooling/';
import { ElementHandle, JSHandle } from 'puppeteer';
import { expect } from 'chai';

type ModalOpts = { contentToCheck?: string, clickOn?: 'confirm' | 'cancel', getTriggeredPage?: boolean, timeout?: number };
type ModalType = 'confirm' | 'error' | 'info' | 'warning';

export abstract class PageRecipe {
  public static getElementPropertyJson = async (elem: ElementHandle<Element>, property: string) => {
    return await (await elem.getProperty(property) as JSHandle).jsonValue() as string;
  }

  public static getElementAttribute = async (elem: ElementHandle<Element>, attribute: string) => {
    return await elem.evaluate((el, attribute) => el.getAttribute(attribute), attribute);
  }

  public static waitForModalAndRespond = async (controllable: Controllable, type: ModalType, { contentToCheck, clickOn, timeout }: ModalOpts) => {
    const modalContainer = await controllable.waitAny(`.ui-modal-${type}`, { timeout });
    if (typeof contentToCheck !== 'undefined') {
      const contentElement = await modalContainer.$('.swal2-html-container');
      expect(await PageRecipe.getElementPropertyJson(contentElement!, 'textContent')).to.include(contentToCheck);
    }
    if (clickOn) {
      const button = await modalContainer.$(`button.ui-modal-${type}-${clickOn}`);
      await button!.click();
    }
  }

  public static sendMessage = async (controllable: Controllable, msg: any) => {
    return await controllable.target.evaluate(async (msg) => await new Promise((resolve) => {
      chrome.runtime.sendMessage(msg, resolve);
    }), msg);
  }

  public static getTabId = async (controllable: Controllable): Promise<string> => {
    // tslint:disable-next-line:no-null-keyword
    const result = await PageRecipe.sendMessage(controllable, { name: '_tab_', data: { bm: {}, objUrls: {} }, to: null, uid: '1' });
    return (result as { result: { tabId: string } }).result.tabId;
  }

  /**
   * responding to modal triggers a new page to be open, eg oauth login page
   */
  public static async waitForModalGetTriggeredPageAfterResponding(
    t: AvaContext, browser: BrowserHandle, controllable: ControllablePage, type: ModalType, modalOpts: ModalOpts
  ): Promise<ControllablePage> {
    return await browser.newPageTriggeredBy(t, () => PageRecipe.waitForModalAndRespond(controllable, type, modalOpts));
  }

}
