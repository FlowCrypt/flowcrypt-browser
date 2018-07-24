
import {Page, ElementHandle, Frame, Dialog} from 'puppeteer';
import {Util} from '../util';

abstract class ControllableBase {

  public target: Page|Frame;

  constructor(page_or_frame: Page|Frame) {
    this.target = page_or_frame;
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

  protected selector_test_state = (state: string) => `[data-test-state="${state}"]`;

  protected element = async (selector: string): Promise<ElementHandle|null> => {
    selector = this.selector(selector);
    if(this.is_xpath(selector)) {
      return (await this.target.$x(selector))[0];
    } else {
      return await this.target.$(selector);
    }
  }

  protected selectors_as_processed_array = (selector: string|string[]): string[] => (Array.isArray(selector) ? selector : [selector]).map(this.selector);

  public wait_for_selector_test_state = async (state: string, timeout=30) => {
    await this.wait_all(this.selector_test_state(state), {timeout});
  }

  public attr = async (element_handle: ElementHandle, name: string): Promise<string> => await (await element_handle.getProperty(name)).jsonValue();

  public wait_all = async (selector: string|string[], {timeout=20, visible=true}: {timeout?: number, visible?: boolean}={}) => {
    let selectors = this.selectors_as_processed_array(selector);
    for(let i = 0; i < selectors.length; i++) {
      if (this.is_xpath(selectors[i])) {
        await (this.target as any).waitForXPath(selectors[i], {timeout: timeout * 1000, visible});  // @types/puppeteer doesn't know about this.target.waitForXPath
      } else {
        await this.target.waitForSelector(selectors[i], {timeout: timeout * 1000, visible});
      }
    }
  }

  public wait_any = async (selector: string|string[], {timeout=20, visible=true}: {timeout?: number, visible?: boolean}={}): Promise<ElementHandle> => {
    timeout = Math.max(timeout, 1);
    let selectors = this.selectors_as_processed_array(selector);
    while (timeout-- > 0) {
      try {
        for (let i = 0; i < selectors.length; i++) {
          let elements = await (this.is_xpath(selectors[i]) ? this.target.$x(selectors[i]) : this.target.$$(selectors[i]));
          for (let j = 0; j < elements.length; j++) {
            if ((await elements[j].boundingBox()) !== null || !visible) { // element is visible
              return elements[j];
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
    let e = await this.element(selector);
    if(!e) {
      throw Error(`Element not found: ${selector}`);
    }
    await e.click();
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
    await this.wait_all(selector);
    await Util.sleep(delay);
    await this.click(selector);
    if(confirm_gone) {
      await this.wait_till_gone(selector);
    }
  }

  public get_frame = async (url_matchables: string[], {sleep=1}={sleep: 1}): Promise<ControllableFrame> => {
    if(sleep) {
      await Util.sleep(sleep);
    }
    let frames;
    if(this.target.constructor.name === 'Page') {
      frames = await (this.target as Page).frames();
    } else if(this.target.constructor.name === 'Frame') {
      frames = await (this.target as Frame).childFrames();
    } else {
      throw Error(`Unknown this.target.constructor.name: ${this.target.constructor.name}`);
    }
    let frame = frames.find(frame => {
      for(let i = 0; i < url_matchables.length; i++) {
        if(frame.url().indexOf(url_matchables[i]) === -1) {
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

  private page: Page;

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

  private frame: Frame;

  constructor(frame: Frame) {
    super(frame);
    this.frame = frame;
  }

}

export type Controllable = ControllableFrame|ControllablePage;
