
import {Page, ElementHandle, Frame, Dialog} from 'puppeteer';
import {Util} from '../util';

abstract class ControllableBase {

  public target: Page|Frame;
  private debug_namespace: string|null = null;

  constructor(page_or_frame: Page|Frame) {
    this.target = page_or_frame;
  }

  public enable_debugging(namespace: string) {
    this.debug_namespace = namespace;
  }

  protected log = (msg: string) => {
    if(this.debug_namespace) {
      console.log(`[debug][controllable] ${msg}`);
    }
  }

  protected is_xpath = (selector: string): boolean => selector.match(/^\/\//) !== null;

  protected selector = (custom_selector_language_query: string): string => { // supply browser selector, xpath, @test-id or @test-id(contains this text)
    let m;
    if(this.is_xpath(custom_selector_language_query)) {
      return custom_selector_language_query;
    } else if(m = custom_selector_language_query.match(/^@([a-z0-9\-]+)$/)) { // tslint:disable-line:no-conditional-assignment
      return `[data-test="${m[1]}"]`;
    } else if(m = custom_selector_language_query.match(/^@([a-z0-9\-]+)\(([^()]*)\)$/)) { // tslint:disable-line:no-conditional-assignment
      return `//*[@data-test='${m[1]}' and contains(text(),'${m[2]}')]`;
    } else {
      return custom_selector_language_query;
    }
  }

  protected element = async (selector: string): Promise<ElementHandle|null> => {
    selector = this.selector(selector);
    if(this.is_xpath(selector)) {
      return (await this.target.$x(selector))[0];
    } else {
      return await this.target.$(selector);
    }
  }

  protected selectors_as_processed_array = (selector: string|string[]): string[] => (Array.isArray(selector) ? selector : [selector]).map(this.selector);

  public wait_for_selector_test_state = async (state: string, timeout=10) => {
    await this.wait_all(`[data-test-state="${state}"]`, {timeout, visible: false});
  }

  public attr = async (element_handle: ElementHandle, name: string): Promise<string> => await (await element_handle.getProperty(name)).jsonValue();

  // private wait_for_navigation = async () => { // needed for puppeteer 1.5.0 but still failing
  //   if(typeof (this.target as Page).waitForNavigation === 'function') {
  //     await (this.target as Page).waitForNavigation();
  //   }
  // }

  public wait_all = async (selector: string|string[], {timeout=20, visible=true}: {timeout?: number, visible?: boolean}={}) => {
    let selectors = this.selectors_as_processed_array(selector);
    this.log(`wait_all:1:${selectors.join(',')}`);
    for(let selector of selectors) {
      this.log(`wait_all:2:${selector}`);
      if (this.is_xpath(selector)) {
        this.log(`wait_all:3:${selector}`);
        await (this.target as any).waitForXPath(selector, {timeout: timeout * 1000, visible});  // @types/puppeteer doesn't know about this.target.waitForXPath
        this.log(`wait_all:4:${selector}`);
      } else {
        this.log(`wait_all:5:${selector}`);
        await this.target.waitForSelector(selector, {timeout: timeout * 1000, visible});
        this.log(`wait_all:6:${selector}`);
      }
    }
    this.log(`wait_all:7:${selectors.join(',')}`);
  }

  public wait_any = async (selector: string|string[], {timeout=20, visible=true}: {timeout?: number, visible?: boolean}={}): Promise<ElementHandle> => {
    timeout = Math.max(timeout, 1);
    let selectors = this.selectors_as_processed_array(selector);
    while (timeout-- > 0) {
      try {
        for (let selector of selectors) {
          let elements = await (this.is_xpath(selector) ? this.target.$x(selector) : this.target.$$(selector));
          for (let element of elements ) {
            if ((await element.boundingBox()) !== null || !visible) { // element is visible
              return element;
            }
          }
        }
      } catch (e) {
        if(e.message.indexOf('Cannot find context with specified id undefined') === -1) {
          throw e;
        }
      }
      await Util.sleep(0.5);
    }
    throw Error(`waiting failed: Elements did not appear: ${selectors.join(',')}`);
  }

  public wait_till_gone = async (selector: string|string[], {timeout=5}: {timeout?: number}={timeout:30}) => {
    let seconds_left = timeout;
    let selectors = Array.isArray(selector) ? selector : [selector];
    while(seconds_left-- >= 0) {
      try {
        await this.wait_any(selectors, {timeout:0}); // if this fails, that means there are none left: return success
        await Util.sleep(1);
      } catch (e) {
        if(e.message.indexOf('waiting failed') === 0) {
          return;
        }
      }
    }
    throw Error(`this.wait_till_gone: some of "${selectors.join(',')}" still present after timeout:${timeout}`);
  }

  public not_present = async (selector: string|string[]) => await this.wait_till_gone(selector, {timeout: 0});

  public click = async (selector: string) => {
    this.log(`click:1:${selector}`);
    let e = await this.element(selector);
    this.log(`click:2:${selector}`);
    if(!e) {
      throw Error(`Element not found: ${selector}`);
    }
    this.log(`click:4:${selector}`);
    await e.click();
    this.log(`click:5:${selector}`);
  }

  public type = async (selector: string, text: string, letter_by_letter=false) => {
    let e = await this.element(selector);
    if(!e) {
      throw Error(`Element not found: ${selector}`);
    }
    if(letter_by_letter || text.length < 20) {
      await e.type(text);
    } else {
      await this.target.evaluate((s, t) => {let e = document.querySelector(s); e[e.tagName === 'DIV' ? 'innerText' : 'value']=t;}, this.selector(selector), text.substring(0, text.length - 10));
      await e.type(text.substring(text.length - 10, text.length));
    }
  }

  public value = async (selector: string): Promise<string> => {
    return await this.target.evaluate((s) => {
      let e = document.querySelector(s); // this will get evaluated in the browser
      if(e.tagName==='SELECT') {
        return e.options[e.selectedIndex].value;
      } else {
        return e.value;
      }
    }, this.selector(selector));
  }

  public is_checked = async (selector: string): Promise<boolean> => {
    return await this.target.evaluate((s) => document.querySelector(s).checked, this.selector(selector));
  }

  public read = async (selector: string) => {
    return await this.target.evaluate((s) => document.querySelector(s).innerText, this.selector(selector));
  }

  public select_option = async (selector: string, choice: string) => {
    await this.target.evaluate((s, v) => jQuery(s).val(v).trigger('change'), this.selector(selector), choice);
  }

  public wait_and_type = async (selector: string, text: string, {delay=0.1}: {delay?: number}={}) => {
    await this.wait_all(selector);
    await Util.sleep(delay);
    await this.type(selector, text);
  }

  public wait_and_click = async (selector: string, {delay=0.1, confirm_gone=false}: {delay?: number, confirm_gone?: boolean}={}) => {
    this.log(`wait_and_click:1:${selector}`);
    await this.wait_all(selector);
    this.log(`wait_and_click:2:${selector}`);
    await Util.sleep(delay);
    this.log(`wait_and_click:3:${selector}`);
    await this.click(selector);
    this.log(`wait_and_click:4:${selector}`);
    if(confirm_gone) {
      await this.wait_till_gone(selector);
    }
  }

  public get_frame = async (url_matchables: string[], {sleep=1}={sleep: 1}): Promise<ControllableFrame> => {
    if(sleep) {
      await Util.sleep(sleep);
    }
    let frames: Frame[];
    if(this.target.constructor.name === 'Page') {
      frames = await (this.target as Page).frames();
    } else if(this.target.constructor.name === 'Frame') {
      frames = await (this.target as Frame).childFrames();
    } else {
      throw Error(`Unknown this.target.constructor.name: ${this.target.constructor.name}`);
    }
    let frame = frames.find(frame => {
      for(let fragment of url_matchables) {
        if(frame.url().indexOf(fragment) === -1) {
          return false;
        }
      }
      return true;
    });
    if(frame) {
      return new ControllableFrame(frame);
    }
    throw Error(`Frame not found: ${url_matchables.join(',')}`);
  }

}

export class ControllablePage extends ControllableBase {

  public page: Page;

  constructor(page: Page) {
    super(page);
    this.page = page;
  }

  public trigger_and_await_new_alert = async (triggering_action: () => void): Promise<Dialog> => {
    return new Promise(resolve => this.page.on('dialog', resolve) && triggering_action()) as Promise<Dialog>;
  }

  public goto = async (url: string) => await this.page.goto(url);

  public close = async () => await this.page.close();

}

export class ControllableFrame extends ControllableBase {

  public frame: Frame;

  constructor(frame: Frame) {
    super(frame);
    this.frame = frame;
  }

}

export type Controllable = ControllableFrame|ControllablePage;
