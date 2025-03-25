/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { AvaContext, newTimeoutPromise } from '../tests/tooling';
import { ConsoleMessage, Dialog, ElementHandle, Frame, KeyInput, Page, WaitForOptions } from 'puppeteer';
import { PageRecipe } from '../tests/page-recipe/abstract-page-recipe';
import {
  TIMEOUT_DESTROY_UNEXPECTED_ALERT,
  TIMEOUT_ELEMENT_APPEAR,
  TIMEOUT_ELEMENT_GONE,
  TIMEOUT_PAGE_LOAD,
  TIMEOUT_TEST_STATE_SATISFY,
  TIMEOUT_FOCUS,
} from '.';
import { Util } from '../util';
import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import { mkdirp } from 'mkdirp';
import { Dict, asyncFilter } from '../core/common';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const jQuery: any;

abstract class ControllableBase {
  public target: Page | Frame;
  private debugNamespace: string | undefined = undefined;

  public constructor(pageOrFrame: Page | Frame) {
    this.target = pageOrFrame;
  }

  public enableDebugging(namespace: string) {
    this.debugNamespace = namespace;
  }

  public isElementPresent = async (selector: string) => {
    return Boolean(await this.firstElement(selector));
  };

  public isElementVisible = async (selector: string) => {
    // check element visibility by checking `display` property and element offset height
    return await this.target.$eval(this.selector(selector), elem => {
      return window.getComputedStyle(elem).getPropertyValue('display') !== 'none' && (elem as HTMLElement).offsetHeight > 0;
    });
  };

  public waitForSelTestState = async (state: 'ready' | 'working' | 'waiting' | 'closed', timeout = TIMEOUT_TEST_STATE_SATISFY) => {
    await this.waitAll(`[data-test-state="${state}"]`, { timeout, visible: undefined });
  };

  public waitUntilViewLoaded = async (timeout = TIMEOUT_PAGE_LOAD) => {
    try {
      await this.waitAll(`[data-test-view-state="loaded"]`, { timeout, visible: undefined });
    } catch {
      throw new Error(`View didn't load within ${timeout}s at ${this.target.url()}`);
    }
  };

  public waitAll = async (selector: string | string[], { timeout = TIMEOUT_ELEMENT_APPEAR, visible = true }: { timeout?: number; visible?: boolean } = {}) => {
    const selectors = this.selsAsProcessedArr(selector);
    this.log(`wait_all:1:${selectors.join(',')}`);
    for (const selector of selectors) {
      // ignore visibility for at this stage as we don't care if this element is scrolled to
      this.log(`wait_all:2:${selector}`);
      if (this.isXpath(selector)) {
        this.log(`wait_all:3:${selector}`);
        await this.target.waitForSelector(`xpath/.${selector}`, { timeout: timeout * 1000 });
        this.log(`wait_all:4:${selector}`);
      } else {
        this.log(`wait_all:5:${selector}`);
        await this.target.waitForSelector(selector, { timeout: timeout * 1000 });
        this.log(`wait_all:6:${selector}`);
      }
      if (!visible && (await this.isElementVisibleInternal(selector))) {
        throw Error(`waiting failed: Element was expected to be hidden: ${selector}`);
      }
    }
    if (visible) {
      await Promise.all(selectors.map(selector => this.waitAnyInternal([selector], { timeout, visible })));
    }
    this.log(`wait_all:7:${selectors.join(',')}`);
  };

  public waitAny = async (
    selector: string | string[],
    properties: { timeout?: number; visible: true | undefined } | { timeout?: number } = {}
  ): Promise<ElementHandle> => {
    const visible = 'visible' in properties ? properties.visible : true;
    return await this.waitAnyInternal(this.selsAsProcessedArr(selector), {
      timeout: properties.timeout ?? TIMEOUT_ELEMENT_APPEAR,
      visible,
    });
  };

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
  };

  public waitTillFocusIsIn = async (selector: string, { timeout = TIMEOUT_FOCUS }: { timeout?: number } = {}) => {
    const element = await this.waitAny(selector);
    timeout = Math.max(timeout, 1);
    while (timeout-- > 0) {
      const isElementFocused = await this.target.evaluate(element => element === document.activeElement, element);
      if (isElementFocused) {
        return;
      }
      await Util.sleep(0.05);
    }
    throw Error(`waiting failed: Elements did not receive the focus: ${selector}`);
  };

  public notPresent = async (selector: string | string[]) => {
    return await this.waitTillGone(selector, { timeout: 0 });
  };

  public waitUntilFocused = async (selector: string) => {
    const start = Date.now();
    while (Date.now() - start < TIMEOUT_ELEMENT_APPEAR * 1000) {
      const e = await this.singleElement(selector);
      const activeElement = (await this.target.evaluateHandle(() => document.activeElement)) as ElementHandle;
      const activeElementHtml = await PageRecipe.getElementPropertyJson(activeElement, 'outerHTML');
      const testedElementHtml = await PageRecipe.getElementPropertyJson(e, 'outerHTML');
      if (activeElementHtml === testedElementHtml) {
        return;
      }
      await Util.sleep(1);
    }
    throw new Error(`Element ${selector} did not become focused within ${TIMEOUT_ELEMENT_APPEAR}s`);
  };

  public click = async (selector: string) => {
    this.log(`click:1:${selector}`);
    const e = await this.singleElement(selector);
    this.log(`click:2:${selector}`);
    try {
      await e.click();
    } catch (e) {
      if (e instanceof Error) {
        e.stack += ` SELECTOR: ${selector}`;
        await Util.sleep(60);
      }
      throw e;
    }
    this.log(`click:3:${selector}`);
  };

  public clickIfPresent = async (selector: string): Promise<boolean> => {
    if (await this.isElementPresent(selector)) {
      await this.click(selector);
      return true;
    }
    return false;
  };

  public type = async (selector: string, text: string, letterByLetter = false) => {
    const e = await this.singleElement(selector);
    if (!e) {
      throw Error(`Element not found: ${selector}`);
    }
    if (letterByLetter || text.length < 10) {
      await e.type(text);
    } else {
      const typeLastTenChars = await this.target.evaluate(
        (s, t) => {
          const el = document.querySelector<HTMLInputElement>(s)!;
          if (el.contentEditable === 'true') {
            el.innerText = t;
            el.selectionEnd = el.innerText.length;
            el.selectionStart = el.innerText.length;
            return false;
          }
          el.value = t.substring(0, t.length - 5);
          if (el.type !== 'email' && typeof el.value !== 'undefined') {
            el.selectionEnd = el.value.length;
            el.selectionStart = el.value.length;
          }
          return true;
        },
        this.selector(selector),
        text
      );
      if (typeLastTenChars) {
        // used to simulate typing events
        await e.type(text.substring(text.length - 5, text.length));
      }
    }
  };

  public attr = async (selector: string, attr: string): Promise<string | null> => {
    return await this.target.evaluate(
      (selector, attr) => {
        const el = document.querySelector(selector)!; // this will get evaluated in the browser
        return el.getAttribute(attr);
      },
      this.selector(selector),
      attr
    );
  };

  public value = async (selector: string): Promise<string> => {
    await this.waitAll(selector);
    return await this.target.evaluate(s => {
      const e = document.querySelector<HTMLInputElement | HTMLSelectElement>(s)!; // this will get evaluated in the browser
      if (e.tagName === 'SELECT' && e instanceof HTMLSelectElement) {
        return e.options[e.selectedIndex].value;
      } else {
        return e.value;
      }
    }, this.selector(selector));
  };

  public isDisabled = async (selector: string): Promise<boolean> => {
    return await this.target.evaluate(s => document.querySelector<HTMLInputElement>(s)!.disabled, this.selector(selector));
  };

  public isChecked = async (selector: string): Promise<boolean> => {
    return await this.target.evaluate(s => document.querySelector<HTMLInputElement>(s)!.checked, this.selector(selector));
  };

  public hasClass = async (selector: string, className: string): Promise<boolean> => {
    const classList = await this.target.evaluate(s => document.querySelector(s)!.classList, this.selector(selector));
    return Object.values(classList).includes(className);
  };

  // Get the current computed outer height (including padding, border)
  public getOuterHeight = async (selector: string): Promise<string> => {
    return await this.target.evaluate(s => {
      const computedStyle = getComputedStyle(document.querySelector(s)!);
      const paddings = parseInt(computedStyle.getPropertyValue('padding-top')) + parseInt(computedStyle.getPropertyValue('padding-bottom'));
      const border = parseInt(computedStyle.getPropertyValue('border-top-width')) + parseInt(computedStyle.getPropertyValue('border-bottom-width'));
      const outerHeight = parseInt(computedStyle.getPropertyValue('height')) + paddings + border;
      return outerHeight.toString();
    }, this.selector(selector));
  };

  public read = async (selector: string, onlyVisible = false): Promise<string | undefined> => {
    const translatedSelector = this.selector(selector);
    if (onlyVisible) {
      return (await this.readAll(translatedSelector)).find(el => el.visible)?.innerText;
    } else {
      return await this.target.evaluate(s => document.querySelector<HTMLElement>(s)!.innerText, translatedSelector);
    }
  };

  public readAll = async (selector: string) => {
    return await this.target.evaluate(
      s =>
        ([].slice.call(document.querySelectorAll(s)) as HTMLElement[]).map(el => {
          return { innerText: el.innerText, visible: Boolean(el.offsetParent) };
        }),
      this.selector(selector)
    );
  };

  public readHtml = async (selector: string): Promise<string> => {
    return await this.target.evaluate(s => document.querySelector(s)!.innerHTML, this.selector(selector));
  };

  public selectOption = async (selector: string, choice: string) => {
    await this.waitAll(selector, { visible: true });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    await this.target.evaluate((s, v) => jQuery(s).val(v).trigger('change'), this.selector(selector), choice);
  };

  public checkElementColor = async (selector: string, color: string) => {
    const elementColor = await this.target.evaluate(selector => {
      const el = document.querySelector<HTMLElement>(selector)!; // this will get evaluated in the browser
      return el.style.color;
    }, this.selector(selector));
    expect(elementColor).to.equal(color);
  };

  public waitAndType = async (selector: string, text: string, { delay = 0.1 }: { delay?: number } = {}) => {
    await this.waitAll(selector);
    await Util.sleep(delay);
    await this.type(selector, text);
  };

  public waitAndFocus = async (selector: string) => {
    await this.waitAll(selector);
    await this.target.focus(this.selector(selector));
  };

  public waitAndRespondToModal = async (
    type: 'info' | 'warning' | 'error' | 'confirm' | 'confirm-checkbox',
    clickBtn: 'confirm' | 'cancel',
    message: string
  ) => {
    await this.waitAll([`@ui-modal-${type}`, `@ui-modal-${type}:message`]);
    await Util.sleep(0.5);
    expect(await this.read(`@ui-modal-${type}:message`)).to.contain(message, `ui-modal-${type}:message does not contain expected text`);
    if (type === 'confirm-checkbox') {
      await this.waitAndClick(`@ui-modal-${type}-input`);
    }
    await this.waitAndClick(`@ui-modal-${type}-${clickBtn}`);
  };

  public waitAndClick = async (
    selector: string,
    {
      delay = 0.1,
      timeout = TIMEOUT_ELEMENT_APPEAR,
      confirmGone = false,
      retryErrs = false,
      sleepWhenDone,
    }: { delay?: number; timeout?: number; confirmGone?: boolean; retryErrs?: boolean; sleepWhenDone?: number } = {}
  ) => {
    for (const i of [1, 2, 3]) {
      this.log(`wait_and_click(i${i}):1:${selector}`);
      await this.waitAll(selector, { timeout });
      this.log(`wait_and_click(i${i}):2:${selector}`);
      await Util.sleep(delay);
      this.log(`wait_and_click(i${i}):3:${selector}`);
      try {
        this.log(`wait_and_click(i${i}):4:${selector}`);
        await this.click(selector);
        this.log(`wait_and_click(i${i}):5:${selector}`);
        break;
      } catch (e: unknown) {
        this.log(`wait_and_click(i${i}):6:err(${String(e)}):${selector}`);
        if (
          e instanceof Error &&
          ['Node is either not visible or not an HTMLElement', 'Node is either not clickable or not an HTMLElement', 'Node is detached from document'].includes(
            e.message
          )
        ) {
          // maybe the node just re-rendered?
          if (!retryErrs || i === 3) {
            e.stack = `[clicking(${selector}) failed because element quickly disappeared, consider adding retryErrs]\n` + e.stack;
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
    if (sleepWhenDone) {
      await Util.sleep(sleepWhenDone);
      this.log(`wait_and_click:9:${selector}`);
    }
    this.log(`wait_and_click:10:${selector}`);
  };

  public waitForContent = async (selector: string, needle: string | RegExp, timeoutSec = 20, testLoopLengthMs = 100) => {
    await this.waitAny(selector);
    const start = Date.now();
    const observedContentHistory: string[] = [];
    while (Date.now() - start < timeoutSec * 1000) {
      const currentText = await this.read(selector, true);
      if (typeof needle === 'string') {
        // str
        if (currentText?.includes(needle)) {
          return;
        }
      } else {
        // regex
        if (currentText?.match(needle)) {
          return;
        }
      }
      const lastText = observedContentHistory[observedContentHistory.length - 1];
      if (typeof lastText !== 'undefined' && currentText !== lastText) {
        observedContentHistory.push(currentText || '(undefined)');
      }
      await Util.sleep(testLoopLengthMs / 1000);
    }
    throw new Error(
      `Selector ${selector} was found but did not match "${needle}" within ${timeoutSec}s. ` +
        `Observed content history: "${JSON.stringify(observedContentHistory, undefined, 2)}"`
    );
  };

  public waitForInputValue = async (selector: string, needle: string | RegExp, timeoutSec = 20, testLoopLengthMs = 100) => {
    selector = this.selector(selector);
    await this.waitAny(selector);
    const start = Date.now();
    const values: string[] = [];
    while (Date.now() - start < timeoutSec * 1000) {
      const value = await this.target.evaluate(s => document.querySelector<HTMLInputElement>(s)!.value, selector);
      if (typeof needle === 'string') {
        // str
        if (value.includes(needle)) {
          return;
        }
      } else {
        // regex
        if (value.match(needle)) {
          return;
        }
      }
      values.push(value);
      await Util.sleep(testLoopLengthMs / 1000);
    }
    throw new Error(
      `Selector ${selector} was found but did not have value "${needle}" within ${timeoutSec}s. Last values: "${JSON.stringify(values, undefined, 2)}"`
    );
  };

  public checkIfImageIsDisplayedCorrectly = async (selector: string) => {
    const isImageDisplayedCorrectly = await this.target.evaluate(selector => {
      const pgpBlock = document.querySelector<HTMLElement>('#pgp_block')!;
      const img = document.querySelector<HTMLImageElement>(selector)!;
      const imgWidth = img.offsetWidth;
      const pgpBlockWidth = pgpBlock.offsetWidth;
      return img.naturalWidth !== 0 && img.naturalHeight !== 0 && imgWidth <= pgpBlockWidth;
    }, selector);
    expect(isImageDisplayedCorrectly).to.be.true;
  };

  public hasHorizontalScroll = async () => {
    return await this.target.evaluate(() => document.documentElement.scrollWidth > document.documentElement.offsetWidth);
  };

  public verifyContentIsPresentContinuously = async (selector: string, expectedText: string, expectPresentForMs = 3000, timeoutSec = 30) => {
    await this.waitAll(selector);
    const start = Date.now();
    const sleepMs = 250;
    let presentForMs = 0;
    let actualText: string | undefined;
    const history: string[] = [];
    let round = 1;
    while (Date.now() - start < timeoutSec * 1000) {
      await Util.sleep(sleepMs / 1000);
      actualText = await this.read(selector, true);
      if (!actualText?.includes(expectedText)) {
        presentForMs = 0;
      } else {
        presentForMs += sleepMs;
      }
      history.push(`${actualText} for ${presentForMs}ms at ${Date.now()} (round ${round++})`);
      if (presentForMs >= expectPresentForMs) {
        return;
      }
    }
    console.log(`verifyContentIsPresentContinuously:\n${history.join('\n')}`);
    throw new Error(
      `selector ${selector} not continuously containing "${expectedText}" for ${expectPresentForMs}ms within ${timeoutSec}s, last content:${actualText}`
    );
  };

  public verifyContentIsNotPresentContinuously = async (selector: string, expectedText: string, timeoutSec = 10) => {
    await this.waitAll(selector);
    const start = Date.now();
    let actualText: string | undefined;
    let round = 1;
    while (Date.now() - start < timeoutSec * 1000) {
      actualText = await this.read(selector, true);
      if (actualText?.includes(expectedText)) {
        throw new Error(`selector ${selector} contained "${expectedText}" for ${round}th attemp, last content:${actualText}`);
      }
      round += 1;
    }
  };

  public getFramesUrls = async (urlMatchables: string[], { sleep, appearIn }: { sleep?: number; appearIn?: number } = { sleep: 3 }): Promise<string[]> => {
    if (sleep) {
      await Util.sleep(sleep);
    }
    if (!appearIn) {
      return await this.getFramesUrlsInThisMoment(urlMatchables);
    }
    for (let second = 0; second < appearIn; second++) {
      const matched = await this.getFramesUrlsInThisMoment(urlMatchables);
      if (matched.length) {
        return matched;
      }
      await Util.sleep(1);
    }
    throw new Error(`Could not find any frame in ${appearIn}s that matches ${urlMatchables.join(' ')}`);
  };

  public ensureElementsCount = async (selector: string, expectedCount: number) => {
    const actualCount = await this.elementCount(selector);
    expect(actualCount).to.equal(expectedCount);
  };

  public getFrame = async (urlMatchables: string[], { sleep = 1, timeout = 10 } = { sleep: 1, timeout: 10 }): Promise<ControllableFrame> => {
    if (sleep) {
      await Util.sleep(sleep);
    }
    let passes = Math.max(2, Math.round(timeout)); // 1 second per pass, 2 pass minimum
    while (passes--) {
      const frames = 'frames' in this.target ? this.target.frames() : this.target.childFrames();
      const matchingFrames = frames.filter(frame => urlMatchables.every(fragment => frame.url().includes(fragment)));
      if (matchingFrames.length > 1) {
        throw Error(`More than one frame found: ${urlMatchables.join(',')}`);
      } else if (matchingFrames.length === 1) {
        return new ControllableFrame(matchingFrames[0], this.getPage());
      }
      await Util.sleep(1);
    }
    throw Error(`Frame not found within ${timeout}s: ${urlMatchables.join(',')}`);
  };

  /**
   * when downloading several files, only notices files with unique names
   */
  public awaitDownloadTriggeredByClicking = async (selector: string | (() => Promise<void>), expectFileCount = 1): Promise<Dict<Buffer>> => {
    const files: Dict<Buffer> = {};
    const resolvePromise: Promise<void> = (async () => {
      const downloadPath = path.resolve(__dirname, 'download', Util.lousyRandom());
      mkdirp.sync(downloadPath);
      const page = this.getPage().target;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, no-underscore-dangle
      await (page as any)._client().send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath });
      if (typeof selector === 'string') {
        await this.waitAndClick(selector);
      } else {
        await selector();
      }
      while (Object.keys(files).length < expectFileCount) {
        const newFilenames = await this.waitForFilesToDownload(downloadPath);
        if (newFilenames.length) {
          for (const filename of newFilenames) {
            const filepath = path.resolve(downloadPath, filename);
            files[filename] = fs.readFileSync(filepath);
            fs.unlinkSync(filepath);
          }
        } else {
          // Give a turn to other promises, including timeoutPromise
          await Util.sleep(0.5);
        }
      }
    })();
    const timeoutPromise = newTimeoutPromise(`awaitDownloadTriggeredByClicking timeout for ${selector}`, 20);
    await Promise.race([resolvePromise, timeoutPromise]);
    return files;
  };

  public keyboard = () => {
    return 'keyboard' in this.target ? this.target.keyboard : this.target.page().keyboard;
  };

  protected log = (msg: string) => {
    if (this.debugNamespace) {
      console.info(`[debug][controllable][${this.debugNamespace}] ${msg}`);
    }
  };

  protected isXpath = (selector: string): boolean => {
    return selector.startsWith('//');
  };

  protected selector = (customSelLanguageQuery: string): string => {
    // supply browser selector, xpath, @test-id or @test-id(contains this text)
    let m: RegExpMatchArray | null;
    if (this.isXpath(customSelLanguageQuery)) {
      return customSelLanguageQuery;
    } else if ((m = /@(ui-modal-[a-z\-]+)\:message/.exec(customSelLanguageQuery))) {
      return `.${m[1]} .swal2-html-container`; // message inside the modal
    } else if ((m = /@(ui-modal-[a-z\-]+)/.exec(customSelLanguageQuery))) {
      return `.${m[1]}`; // represented as a class
    } else if ((m = /@([a-z0-9\-_]+)$/i.exec(customSelLanguageQuery))) {
      return customSelLanguageQuery.replace(/@([a-z0-9\-_]+)$/i, `[data-test="${m[1]}"]`);
    } else if ((m = /^@([a-z0-9\-_]+)\(([^()]*)\)$/i.exec(customSelLanguageQuery))) {
      return `//*[@data-test='${m[1]}' and (contains(text(),'${m[2]}') or contains(*/following-sibling::text(),'${m[2]}'))]`;
    } else {
      return customSelLanguageQuery;
    }
  };

  protected firstElement = async (selector: string): Promise<ElementHandle | null> => {
    selector = this.selector(selector);
    if (this.isXpath(selector)) {
      return (await this.target.$$(`xpath/.${selector}`))[0];
    } else {
      return await this.target.$(selector);
    }
  };

  protected singleElement = async (selector: string): Promise<ElementHandle> => {
    const elements = await this.elements(selector);
    if (!elements.length) {
      throw Error(`Element not found: ${selector}`);
    } else if (elements.length > 1) {
      const visibleElements = await asyncFilter(elements, Util.isVisible);
      if (visibleElements.length === 1) {
        return visibleElements[0];
      }
      throw Error(`More than one element found: ${selector}`);
    }
    return elements[0];
  };

  protected elementCount = async (selector: string): Promise<number> => {
    return (await this.elements(selector)).length;
  };

  protected elements = async (selector: string) => {
    selector = this.selector(selector);
    if (this.isXpath(selector)) {
      return await this.target.$$(`xpath/.${selector}`);
    } else {
      return await this.target.$$(selector);
    }
  };

  protected selsAsProcessedArr = (selector: string | string[]): string[] => {
    return (Array.isArray(selector) ? selector : [selector]).map(this.selector);
  };

  private waitAnyInternal = async (processedSelectors: string[], { timeout, visible }: { timeout: number; visible?: true }): Promise<ElementHandle> => {
    const attemptsPerSecond = 20;
    timeout = Math.max(timeout * attemptsPerSecond, 1);
    while (timeout-- > 0) {
      try {
        for (const selector of processedSelectors) {
          const elements = await (this.isXpath(selector) ? this.target.$$(`xpath/.${selector}`) : this.target.$$(selector));
          for (const element of elements) {
            if (!visible || (await Util.isVisible(element))) {
              // element is visible
              return element;
            }
          }
        }
      } catch (e) {
        if (e instanceof Error && !e.message.includes('Cannot find context with specified id undefined')) {
          throw e;
        }
      }
      await Util.sleep(1 / attemptsPerSecond);
    }
    throw Error(`waiting failed: Elements did not appear: ${processedSelectors.join(',')}`);
  };

  private isElementVisibleInternal = async (processedSelector: string) => {
    // check element visibility by checking `display` property and element offset height
    return await this.target.$eval(processedSelector, elem => {
      return window.getComputedStyle(elem).getPropertyValue('display') !== 'none' && (elem as HTMLElement).offsetHeight > 0;
    });
  };

  private getFramesUrlsInThisMoment = async (urlMatchables: string[]) => {
    const matchingLinks: string[] = [];
    for (const iframe of await this.target.$$('iframe')) {
      const src = await PageRecipe.getElementPropertyJson(iframe, 'src');
      const visible = !!(await iframe.boundingBox()); // elements without bounding box are not visible
      if (urlMatchables.filter(m => src.includes(m)).length === urlMatchables.length && visible) {
        matchingLinks.push(src);
      }
    }
    return matchingLinks;
  };

  private waitForFilesToDownload = async (downloadPath: string): Promise<string[]> => {
    while (true) {
      const filenames = fs.readdirSync(downloadPath);
      if (!filenames.some(fn => fn.endsWith('.crdownload'))) {
        return filenames;
      }
      await Util.sleep(0.2);
    }
  };

  public abstract getPage(): ControllablePage;
}

export class ControllableAlert {
  public target: Dialog;
  public active = true;

  public constructor(alert: Dialog) {
    this.target = alert;
  }

  public accept = async () => {
    await this.target.accept();
    this.active = false;
  };

  public dismiss = async () => {
    await this.target.dismiss();
    this.active = false;
  };
}

class ConsoleEvent {
  public constructor(
    public type: string,
    public text: string
  ) {}
}

export class ControllablePage extends ControllableBase {
  public target: Page;
  public consoleMsgs: (ConsoleMessage | ConsoleEvent)[] = [];
  public alerts: ControllableAlert[] = [];
  private preventclose = false;
  private acceptUnloadAlert = false;

  public constructor(
    public t: AvaContext,
    public page: Page
  ) {
    super(page);
    page.on('console', console => {
      this.consoleMsgs.push(console);
    });
    page.on('requestfinished', r => {
      const response = r.response();
      const fail = r.failure();
      const url = r.url();
      const extensionUrl = t.context.urls?.extension('');
      if ((extensionUrl && !url.startsWith(extensionUrl)) || fail) {
        // not an extension url, or a fail
        this.consoleMsgs.push(new ConsoleEvent('request', `${response ? response.status() : '-1'} ${r.method()} ${url}: ${fail ? fail.errorText : 'ok'}`));
      }
    });
    page.on('dialog', alert => {
      this.consoleMsgs.push(new ConsoleEvent('alert', alert.message()));
    });
    page.on('pageerror', error => {
      this.consoleMsgs.push(new ConsoleEvent('error', error.stack || String(error)));
    });
    // page.on('error', e => this.consoleMsgs.push(`[error]${e.stack}[/error]`)); // this is Node event emitter error. Maybe just let it go crash the process / test
    page.on('dialog', alert => {
      if (this.acceptUnloadAlert && alert.type() === 'beforeunload') {
        alert.accept().catch((e: unknown) => t.log(`${t.context.attemptText} Err auto-accepting unload alert ${String(e)}`));
        return;
      }
      const controllableAlert = new ControllableAlert(alert);
      this.alerts.push(controllableAlert);
      setTimeout(() => {
        if (controllableAlert.active) {
          t.context.retry = true;
          this.preventclose = true;
          t.log(`${t.context.attemptText} Dismissing unexpected alert ${alert.message()}`);
          try {
            alert.dismiss().catch((e: unknown) => t.log(`${t.context.attemptText} Err1 dismissing alert ${String(e)}`));
          } catch (e) {
            t.log(`${t.context.attemptText} Err2 dismissing alert ${String(e)}`);
          }
        }
      }, TIMEOUT_DESTROY_UNEXPECTED_ALERT * 1000);
    });
  }

  public reload = async (options?: WaitForOptions, acceptUnloadAlert?: boolean) => {
    this.acceptUnloadAlert = Boolean(acceptUnloadAlert);
    try {
      await this.page.reload(options);
    } finally {
      this.acceptUnloadAlert = false;
    }
  };

  public newAlertTriggeredBy = async (triggeringAction: () => Promise<void>): Promise<ControllableAlert> => {
    const dialogPromise = new Promise<ControllableAlert>((resolve, reject) => {
      this.page.on('dialog', () => resolve(this.alerts[this.alerts.length - 1])); // we need it as a ControllableAlert so that we know if it was dismissed or not
      setTimeout(() => reject(new Error('new alert timout - no alert')), TIMEOUT_ELEMENT_APPEAR * 1000);
    });
    triggeringAction().catch((e: unknown) => {
      console.error(e);
    });
    return await dialogPromise;
  };

  public waitForNavigationIfAny = async (triggeringAction: () => Promise<void>, seconds = 5) => {
    try {
      await Promise.all([this.page.waitForNavigation({ timeout: seconds * 1000 }), triggeringAction()]);
    } catch (e: unknown) {
      // can be "Navigation Timeout Exceeded" or "Navigation timeout of 5000 ms exceeded"
      if (new RegExp('^Navigation timeout .*xceeded$').test((e as Error).message)) {
        return;
      }
      throw e;
    }
  };

  public goto = async (url: string) => {
    if (this.t.context.urls) {
      const extensionUrl = this.t.context.urls.extension('');
      url = url.startsWith('https://') || url.startsWith(extensionUrl) ? url : this.t.context.urls.extension(url);
    }

    await Util.sleep(1);
    // await this.page.goto(url); // may produce intermittent Navigation Timeout Exceeded in CI environment
    this.page.goto(url).catch((e: unknown) => this.t.log(`goto: ${(e as Error).message}: ${url}`));
    await Promise.race([
      this.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: TIMEOUT_PAGE_LOAD * 1000 }),
      this.page.waitForNavigation({ waitUntil: 'load', timeout: TIMEOUT_PAGE_LOAD * 1000 }),
    ]);
  };

  public close = async () => {
    if (this.preventclose) {
      this.t.log('page.close() was called but closing was prevented because we want to evaluate earlier errors (cannot screenshot a closed page)');
      this.preventclose = false;
    } else {
      await this.page.close();
    }
  };

  public press = async (key: KeyInput, repeat = 1) => {
    for (let i = 0; i < repeat; i += 1) {
      await this.page.keyboard.press(key);
    }
  };

  public screenshot = async (): Promise<string> => {
    await this.dismissActiveAlerts();
    return await Promise.race([this.page.screenshot({ encoding: 'base64' }), newTimeoutPromise('screenshot', 20)]);
  };

  public html = async (): Promise<string> => {
    await this.dismissActiveAlerts();
    return await Promise.race([this.page.content(), newTimeoutPromise('html content', 10)]);
  };

  public console = async (t: AvaContext, alsoLogDirectly: boolean): Promise<string> => {
    await this.dismissActiveAlerts();
    let html = '';
    for (const msg of this.consoleMsgs) {
      if (msg instanceof ConsoleEvent) {
        html += `<span class="c-${Util.htmlEscape(msg.type)}">${Util.htmlEscape(msg.type)}: ${Util.htmlEscape(msg.text)}</span>\n`;
        if (alsoLogDirectly) {
          console.log(`[${t.title}] console-${msg.type}: ${msg.text}`);
        }
      } else {
        html += `<div class="c-${Util.htmlEscape(msg.type())}">${Util.htmlEscape(msg.type())}: ${Util.htmlEscape(msg.text())}`;
        if (alsoLogDirectly) {
          console.log(`[${t.title}] console-${msg.type()}: ${msg.text()}`);
        }
        const args: string[] = [];
        for (const arg of msg.args()) {
          try {
            const r = JSON.stringify(
              await Promise.race([arg.jsonValue(), new Promise(resolve => setTimeout(() => resolve('test.ts: log fetch timeout'), 3000))])
            );
            if (r !== '{}' && r && r !== JSON.stringify(msg.text())) {
              args.push(r);
            }
          } catch (e) {
            args.push(`test.ts: console msg arg err: ${String(e)}`);
          }
        }
        if (args.length) {
          html += `<ul>${args.map(arg => `<li>${Util.htmlEscape(arg)}</li>`)}</ul>`;
        }
        html += `</div>\n`;
      }
    }
    return html;
  };

  // passing (keys = null) will return all entries
  public getFromLocalStorage = async (keys: string[] | null): Promise<Dict<unknown>> => {
    const result = await this.target.evaluate(
      async keys =>
        await new Promise(resolve => {
          chrome.storage.local.get(keys, resolve);
        }),
      keys
    );
    return result as Dict<unknown>;
  };

  public setLocalStorage = async (key: string, value: string | null): Promise<void> => {
    await this.target.evaluate(async (key, value) => await chrome.storage.local.set({ [key]: value }), key, value);
  };

  public getPage = () => {
    return this;
  };

  private dismissActiveAlerts = async (): Promise<void> => {
    const activeAlerts = this.alerts.filter(a => a.active);
    for (const alert of activeAlerts) {
      // active alert will cause screenshot and other ops to hang: https://github.com/GoogleChrome/puppeteer/issues/2481
      try {
        await Promise.race([alert.dismiss(), newTimeoutPromise('alert dismiss', 10)]);
      } catch (e) {
        if (!(e instanceof Error && e.message === 'Cannot dismiss dialog which is already handled!')) {
          throw e;
        }
      }
    }
  };
}

export class ControllableFrame extends ControllableBase {
  public target: Frame;
  public frame: Frame;

  public constructor(
    frame: Frame,
    private page: ControllablePage
  ) {
    super(frame);
    this.frame = frame;
  }

  public getPage = () => {
    return this.page;
  };
}

export type Controllable = ControllableFrame | ControllablePage;
