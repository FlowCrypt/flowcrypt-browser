
import { Page, ElementHandle, Frame, Dialog, ConsoleMessage } from 'puppeteer';
import { Util } from '../util';
import { Url } from './url';
import { TIMEOUT_TEST_STATE_SATISFY, TIMEOUT_ELEMENT_APPEAR, TIMEOUT_ELEMENT_GONE, TIMEOUT_PAGE_LOAD } from '.';
import { newTimeoutPromise } from '../tests';

declare const jQuery: any;

abstract class ControllableBase {

  public target: Page | Frame;
  private debugNamespace: string | undefined = undefined;

  constructor(pageOrFrame: Page | Frame) {
    this.target = pageOrFrame;
  }

  public enable_debugging(namespace: string) {
    this.debugNamespace = namespace;
  }

  protected log = (msg: string) => {
    if (this.debugNamespace) {
      console.log(`[debug][controllable][${this.debugNamespace}] ${msg}`);
    }
  }

  protected isXpath = (selector: string): boolean => selector.match(/^\/\//) !== null;

  protected selector = (customSelLanguageQuery: string): string => { // supply browser selector, xpath, @test-id or @test-id(contains this text)
    let m;
    if (this.isXpath(customSelLanguageQuery)) {
      return customSelLanguageQuery;
    } else if (m = customSelLanguageQuery.match(/^@([a-z0-9\-]+)$/)) { // tslint:disable-line:no-conditional-assignment
      return `[data-test="${m[1]}"]`;
    } else if (m = customSelLanguageQuery.match(/^@([a-z0-9\-]+)\(([^()]*)\)$/)) { // tslint:disable-line:no-conditional-assignment
      return `//*[@data-test='${m[1]}' and contains(text(),'${m[2]}')]`;
    } else {
      return customSelLanguageQuery;
    }
  }

  protected element = async (selector: string): Promise<ElementHandle | null> => {
    selector = this.selector(selector);
    if (this.isXpath(selector)) {
      return (await this.target.$x(selector))[0];
    } else {
      return await this.target.$(selector);
    }
  }

  protected selsAsProcessedArr = (selector: string | string[]): string[] => (Array.isArray(selector) ? selector : [selector]).map(this.selector);

  public waitForSelTestState = async (state: 'ready' | 'working' | 'waiting' | 'closed', timeout = TIMEOUT_TEST_STATE_SATISFY) => {
    await this.waitAll(`[data-test-state="${state}"]`, { timeout, visible: false });
  }

  public attr = async (elHandle: ElementHandle, name: string): Promise<string> => await (await elHandle.getProperty(name)).jsonValue();

  public waitAll = async (selector: string | string[], { timeout = TIMEOUT_ELEMENT_APPEAR, visible = true }: { timeout?: number, visible?: boolean } = {}) => {
    const selectors = this.selsAsProcessedArr(selector);
    this.log(`wait_all:1:${selectors.join(',')}`);
    for (const selector of selectors) {
      this.log(`wait_all:2:${selector}`);
      if (this.isXpath(selector)) {
        this.log(`wait_all:3:${selector}`);
        await this.target.waitForXPath(selector, { timeout: timeout * 1000, visible });
        this.log(`wait_all:4:${selector}`);
      } else {
        this.log(`wait_all:5:${selector}`);
        await this.target.waitForSelector(selector, { timeout: timeout * 1000, visible });
        this.log(`wait_all:6:${selector}`);
      }
    }
    this.log(`wait_all:7:${selectors.join(',')}`);
  }

  public waitAny = async (selector: string | string[], { timeout = TIMEOUT_ELEMENT_APPEAR, visible = true }: { timeout?: number, visible?: boolean } = {}): Promise<ElementHandle> => {
    timeout = Math.max(timeout, 1);
    const selectors = this.selsAsProcessedArr(selector);
    while (timeout-- > 0) {
      try {
        for (const selector of selectors) {
          const elements = await (this.isXpath(selector) ? this.target.$x(selector) : this.target.$$(selector));
          for (const element of elements) {
            if ((await element.boundingBox()) !== null || !visible) { // element is visible
              return element;
            }
          }
        }
      } catch (e) {
        if (e.message.indexOf('Cannot find context with specified id undefined') === -1) {
          throw e;
        }
      }
      await Util.sleep(0.5);
    }
    throw Error(`waiting failed: Elements did not appear: ${selectors.join(',')}`);
  }

  public waitTillGone = async (selector: string | string[], { timeout = TIMEOUT_ELEMENT_GONE }: { timeout?: number } = {}) => {
    let secondsLeft = typeof timeout !== 'undefined' ? timeout : TIMEOUT_ELEMENT_GONE;
    const selectors = Array.isArray(selector) ? selector : [selector];
    while (secondsLeft-- >= 0) {
      try {
        await this.waitAny(selectors, { timeout: 0 }); // if this fails, that means there are none left: return success
        await Util.sleep(1);
      } catch (e) {
        if (e.message.indexOf('waiting failed') === 0) {
          return;
        }
      }
    }
    throw Error(`this.wait_till_gone: some of "${selectors.join(',')}" still present after timeout:${timeout}`);
  }

  public notPresent = async (selector: string | string[]) => await this.waitTillGone(selector, { timeout: 0 });

  public click = async (selector: string) => {
    this.log(`click:1:${selector}`);
    const e = await this.element(selector);
    this.log(`click:2:${selector}`);
    if (!e) {
      throw Error(`Element not found: ${selector}`);
    }
    this.log(`click:4:${selector}`);
    await e.click();
    this.log(`click:5:${selector}`);
  }

  public type = async (selector: string, text: string, letterByLetter = false) => {
    const e = await this.element(selector);
    if (!e) {
      throw Error(`Element not found: ${selector}`);
    }
    if (letterByLetter || text.length < 20) {
      await e.type(text);
    } else {
      await this.target.evaluate((s, t) => {
        const e = document.querySelector(s);
        e[e.tagName === 'DIV' ? 'innerText' : 'value'] = t;
      }, this.selector(selector), text.substring(0, text.length - 10));
      await e.type(text.substring(text.length - 10, text.length));
    }
  }

  public value = async (selector: string): Promise<string> => {
    return await this.target.evaluate((s) => {
      const e = document.querySelector(s); // this will get evaluated in the browser
      if (e.tagName === 'SELECT') {
        return e.options[e.selectedIndex].value;
      } else {
        return e.value;
      }
    }, this.selector(selector));
  }

  public isChecked = async (selector: string): Promise<boolean> => {
    return await this.target.evaluate((s) => document.querySelector(s).checked, this.selector(selector));
  }

  public read = async (selector: string): Promise<string> => {
    return await this.target.evaluate((s) => document.querySelector(s).innerText, this.selector(selector));
  }

  public selectOption = async (selector: string, choice: string) => {
    await this.target.evaluate((s, v) => jQuery(s).val(v).trigger('change'), this.selector(selector), choice);
  }

  public waitAndType = async (selector: string, text: string, { delay = 0.1 }: { delay?: number } = {}) => {
    await this.waitAll(selector);
    await Util.sleep(delay);
    await this.type(selector, text);
  }

  public waitAndClick = async (selector: string, { delay = 0.1, confirmGone = false, retryErrs = false }: { delay?: number, confirmGone?: boolean, retryErrs?: boolean } = {}) => {
    for (const i of [1, 2, 3]) {
      this.log(`wait_and_click(i${i}):1:${selector}`);
      await this.waitAll(selector);
      this.log(`wait_and_click(i${i}):2:${selector}`);
      await Util.sleep(delay);
      this.log(`wait_and_click(i${i}):3:${selector}`);
      try {
        this.log(`wait_and_click(i${i}):4:${selector}`);
        await this.click(selector);
        this.log(`wait_and_click(i${i}):5:${selector}`);
        break;
      } catch (e) {
        this.log(`wait_and_click(i${i}):6:err(${String(e)}):${selector}`);
        if (e.message === 'Node is either not visible or not an HTMLElement' || e.message === 'Node is detached from document') {
          // maybe the node just re-rendered?
          if (!retryErrs || i === 3) {
            throw e;
          }
          this.log(`wait_and_click(i${i}):retrying`);
          await Util.sleep(1);
          continue;
        }
        throw e;
      }
    }
    if (confirmGone) {
      this.log(`wait_and_click:7:${selector}`);
      await this.waitTillGone(selector);
    }
    this.log(`wait_and_click:8:${selector}`);
  }

  public getFramesUrls = async (urlMatchables: string[], { sleep } = { sleep: 3 }): Promise<string[]> => {
    if (sleep) {
      await Util.sleep(sleep);
    }
    const matchingLinks = [];
    for (const iframe of await this.target.$$('iframe')) {
      const srcHandle = await iframe.getProperty('src');
      const src = await srcHandle.jsonValue() as string;
      if (urlMatchables.filter(m => src.indexOf(m) !== -1).length === urlMatchables.length) {
        matchingLinks.push(src);
      }
    }
    return matchingLinks;
  }

  public getFrame = async (urlMatchables: string[], { sleep = 1 } = { sleep: 1 }): Promise<ControllableFrame> => {
    if (sleep) {
      await Util.sleep(sleep);
    }
    let frames: Frame[];
    if (this.target.constructor.name === 'Page') {
      frames = await (this.target as Page).frames();
    } else if (this.target.constructor.name === 'Frame') {
      frames = await (this.target as Frame).childFrames();
    } else {
      throw Error(`Unknown this.target.constructor.name: ${this.target.constructor.name}`);
    }
    const frame = frames.find(frame => {
      for (const fragment of urlMatchables) {
        if (frame.url().indexOf(fragment) === -1) {
          return false;
        }
      }
      return true;
    });
    if (frame) {
      return new ControllableFrame(frame);
    }
    throw Error(`Frame not found: ${urlMatchables.join(',')}`);
  }

}

export class ControllableAlert {

  public target: Dialog;
  public active = true;

  constructor(alert: Dialog) {
    this.target = alert;
  }

  accept = async () => {
    await this.target.accept();
    this.active = false;
  }

  dismiss = async () => {
    await this.target.dismiss();
    this.active = false;
  }

}

export class ControllablePage extends ControllableBase {

  public page: Page;
  public consoleMsgs: ConsoleMessage[] = [];
  public alerts: ControllableAlert[] = [];

  constructor(page: Page) {
    super(page);
    this.page = page;
    page.on('console', msg => {
      this.consoleMsgs.push(msg);
    });
    page.on('dialog', alert => {
      this.alerts.push(new ControllableAlert(alert));
    });
  }

  public newAlertTriggeredBy = async (triggeringAction: () => Promise<void>): Promise<ControllableAlert> => {
    const dialogPromise: Promise<ControllableAlert> = new Promise((resolve, reject) => {
      this.page.on('dialog', () => resolve(this.alerts[this.alerts.length - 1])); // we need it as a ControllableAlert so that we know if it was dismissed or not
      setTimeout(() => reject(new Error('newAlertTriggeredBy timout - no alert')), TIMEOUT_ELEMENT_APPEAR * 1000);
    });
    triggeringAction().catch(console.error);
    return await dialogPromise;
  }

  public waitForNavigationIfAny = async (seconds: number = 5) => {
    try {
      await this.page.waitForNavigation({ timeout: seconds * 1000 });
    } catch (e) {
      if (e.message.indexOf('Navigation Timeout Exceeded') === 0) {
        return;
      }
      throw e;
    }
  }

  public goto = async (url: string) => {
    url = url.indexOf('https://') === 0 || url.indexOf(Url.extension('')) === 0 ? url : Url.extension(url);
    // await this.page.goto(url); // may produce intermittent Navigation Timeout Exceeded in CI environment
    this.page.goto(url).catch(e => console.log(`goto: ${e.message}: ${url}`));
    await Promise.race([
      this.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: TIMEOUT_PAGE_LOAD * 1000 }),
      this.page.waitForNavigation({ waitUntil: 'load', timeout: TIMEOUT_PAGE_LOAD * 1000 })
    ]);
  }

  public close = async () => await this.page.close();

  public screenshot = async (): Promise<string> => {
    const activeAlerts = this.alerts.filter(a => a.active);
    for (const alert of activeAlerts) {
      // active alert will cause screenshot to hang: https://github.com/GoogleChrome/puppeteer/issues/2481
      await Promise.race([alert.dismiss(), newTimeoutPromise('alert dismiss', 10)]);
    }
    return await Promise.race([this.page.screenshot({ encoding: 'base64' }), newTimeoutPromise('screenshot', 10)]);
  }
}

export class ControllableFrame extends ControllableBase {

  public frame: Frame;

  constructor(frame: Frame) {
    super(frame);
    this.frame = frame;
  }

}

export type Controllable = ControllableFrame | ControllablePage;
