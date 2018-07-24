
import {Dialog, ElementHandle, Frame, Page} from "puppeteer";
import {results} from './results';
import {config} from './config';
import {BrowserHandle} from './chrome';

/* tslint:disable */

export const meta = {
  _is_xpath: function(selector: string): boolean {
    return selector.match(/^\/\//) !== null;
  },
  _selector: function (custom_selector_language_query: string): string { // supply browser selector, xpath, @test-id or @test-id(contains this text)
    let m;
    if(meta._is_xpath(custom_selector_language_query)) {
      return custom_selector_language_query;
    } else if(m = custom_selector_language_query.match(/^@([a-z0-9\-]+)$/)) {
      return `[data-test="${m[1]}"]`;
    } else if(m = custom_selector_language_query.match(/^@([a-z0-9\-]+)\(([^()]*)\)$/)) {
      return `//*[@data-test='${m[1]}' and contains(text(),'${m[2]}')]`;
    } else {
      return custom_selector_language_query;
    }
  },
  _selector_test_state: function (state: string) {
    return `[data-test-state="${state}"]`;
  },
  _element: async function(page: Page|Frame, selector: string): Promise<ElementHandle|null> {
    selector = meta._selector(selector);
    if(meta._is_xpath(selector)) {
      return (await page.$x(selector))[0];
    } else {
      return await page.$(selector);
    }
  },
  _selectors_as_processed_array(selector: string|string[]): string[]  {
    return (Array.isArray(selector) ? selector : [selector]).map(meta._selector);
  },
  _k: function(title: string) {
    return config.keys.filter(k => k.title === title)[0];
  },
  attr: async function (element_handle: ElementHandle, name: string): Promise<string> {
    return await (await element_handle.getProperty(name)).jsonValue();
  },
  sleep: function(seconds: number) {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
  },
  wait_all: async function (page: Page|Frame, selector: string|string[], {timeout=20, visible=true}: {timeout?: number, visible?: boolean}={}) {
    let selectors = meta._selectors_as_processed_array(selector);
    for(let i = 0; i < selectors.length; i++) {
      if (meta._is_xpath(selectors[i])) {
        await (page as any).waitForXPath(selectors[i], {timeout: timeout * 1000, visible: visible});  // @types/puppeteer doesn't know about page.waitForXPath
      } else {
        await page.waitForSelector(selectors[i], {timeout: timeout * 1000, visible: visible});
      }
    }
  },
  wait_any: async function (page: Page|Frame, selector: string|string[], {timeout=20, visible=true}: {timeout?: number, visible?: boolean}={}): Promise<ElementHandle> {
    timeout = Math.max(timeout, 1);
    let selectors = meta._selectors_as_processed_array(selector);
    while (timeout-- > 0) {
      try {
        for (let i = 0; i < selectors.length; i++) {
          let elements = await (meta._is_xpath(selectors[i]) ? page.$x(selectors[i]) : page.$$(selectors[i]));
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
      await meta.sleep(0.5);
    }
    throw Error(`waiting failed: Elements did not appear: ${selectors.join(',')}`);
  },
  wait_till_gone: async function (page: Page|Frame, selector: string|string[], {timeout=5}: {timeout?: number}={timeout:30}) {
    let seconds_left = timeout;
    let selectors = Array.isArray(selector) ? selector : [selector];
    while(seconds_left-- >= 0) {
      try {
        await meta.wait_any(page, selectors, {timeout:0}); // if this fails, that means there are none left: return success
        await meta.sleep(1);
      } catch (e) {
        if(e.message.indexOf('waiting failed') === 0) {
          return;
        }
      }
    }
    throw Error(`meta.wait_till_gone: some of "${selectors.join(',')}" still present after timeout:${timeout}`);
  },
  not_present: async function(page: Page|Frame, selector: string|string[]) {
    await meta.wait_till_gone(page, selector, {timeout: 0});
  },
  click: async function (page: Page|Frame, selector: string) {
    let e = await meta._element(page, selector);
    if(!e) {
      throw Error(`Element not found: ${selector}`);
    }
    await e.click();
  },
  type: async function (page: Page|Frame, selector: string, text: string, letter_by_letter=false) {
    let e = await meta._element(page, selector);
    if(!e) {
      throw Error(`Element not found: ${selector}`);
    }
    if(letter_by_letter || text.length < 20) {
      await e.type(text);
    } else {
      await page.evaluate((s, t) => {let e = document.querySelector(s); e[e.tagName === 'DIV' ? 'innerText' : 'value']=t;}, meta._selector(selector), text.substring(0, text.length - 10));
      await e.type(text.substring(text.length - 10, text.length));
    }
  },
  value: async function(page: Page|Frame, selector: string): Promise<string> {
    return await page.evaluate((s) => { let e = document.querySelector(s); if(e.tagName==='SELECT') {return e.options[e.selectedIndex].value} else {return e.value} }, meta._selector(selector));
  },
  is_checked: async function(page: Page|Frame, selector: string): Promise<boolean> {
    return await page.evaluate((s) => document.querySelector(s).checked, meta._selector(selector));
  },
  read: async function (page: Page|Frame, selector: string) {
    return await page.evaluate((s) => document.querySelector(s).innerText, meta._selector(selector));
  },
  select_option: async function (page: Page|Frame, selector: string, choice: string) {
    await page.evaluate((s, v) => jQuery(s).val(v).trigger('change'), meta._selector(selector), choice);
  },
  wait_and_type: async function (page: Page|Frame, selector: string, text: string, {delay=0.1}: {delay?: number}={}) {
    await meta.wait_all(page, selector);
    await meta.sleep(delay);
    await meta.type(page, selector, text);
  },
  wait_and_click: async function (page: Page|Frame, selector: string, {delay=0.1, confirm_gone=false}: {delay?: number, confirm_gone?: boolean}={}) {
    await meta.wait_all(page, selector);
    await meta.sleep(delay);
    await meta.click(page, selector);
    if(confirm_gone) {
      await meta.wait_till_gone(page, selector);
    }
  },
  log: (text: string, error?: string|undefined) => {
    if(!error) {
      console.log(`[ok] ${text}`);
      results.success.push(text);
    } else {
      console.error(`[error] ${text} (${String(error)})`);
      results.error.push(`${text}|${String(error)}`);
    }
  },
  random: () => Math.random().toString(36).substring(7),
  trigger_and_await_new_alert: function (page: Page, triggering_action = function () {}): Promise<Dialog> {
    return new Promise((resolve) => {
      page.on('dialog', resolve);
      triggering_action();
    });
  },
  get_frame: async function(page: Page|Frame, url_matchables: string[], {sleep=1}={sleep: 1}): Promise<Frame> {
    if(sleep) {
      await meta.sleep(sleep);
    }
    let frames;
    if(page.constructor.name === 'Page') {
      frames = await (page as Page).frames();
    } else if(page.constructor.name === 'Frame') {
      frames = await (page as Frame).childFrames();
    } else {
      throw Error(`Unknown page.constructor.name: ${page.constructor.name}`);
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
      return frame;
    }
    throw Error(`Frame not found: ${url_matchables.join(',')}`);
  },
  compose: {
    open_compose_page_standalone: async function(handle: BrowserHandle): Promise<Page> {
      let compose_page = await handle.new_page('chrome/elements/compose.htm?account_email=flowcrypt.compatibility%40gmail.com&parent_tab_id=0');
      await meta.wait_all(compose_page, ['@input-body', '@input-to', '@input-subject', '@action-send']);
      await meta.wait_all(compose_page, meta._selector_test_state('ready')); // wait until page ready
      return compose_page;
    },
    open_compose_page_settings: async function(settings_page: Page): Promise<Frame> {
      await meta.wait_and_click(settings_page, '@action-show-compose-page');
      await meta.wait_all(settings_page, '@dialog');
      let compose_frame = await meta.get_frame(settings_page, ['compose.htm']);
      await meta.wait_all(compose_frame, ['@input-body', '@input-to', '@input-subject', '@action-send']);
      await meta.wait_all(compose_frame, meta._selector_test_state('ready')); // wait until page ready
      return compose_frame;
    },
    change_default_sending_address: async function (compose_page: Page, new_default: string) {
      await meta.wait_and_click(compose_page, '@action-open-sending-address-settings');
      await meta.wait_all(compose_page, '@dialog');
      let sending_address_frame = await meta.get_frame(compose_page, ['sending_address.htm']);
      await meta.wait_and_click(sending_address_frame, `@action-choose-address(${new_default})`);
      await meta.sleep(0.5); // page reload
      await meta.wait_and_click(sending_address_frame, '@action-close-sending-address-settings');
      await meta.wait_till_gone(compose_page, '@dialog');
    },
    fill_message: async function (compose_page_or_frame: Page|Frame, to: string|null, subject: string) {
      if(to) {
        await meta.type(compose_page_or_frame, '@input-to', to);
      }
      await meta.click(compose_page_or_frame, '@input-subject');
      await meta.type(compose_page_or_frame, '@input-subject', `Automated puppeteer test: ${subject}`);
      await meta.type(compose_page_or_frame, '@input-body', `This is an automated puppeteer test: ${subject}`);
    },
    send_and_close: async function (compose_page: Page, password?: string|undefined) {
      if(password) {
        await meta.wait_and_type(compose_page, '@input-password', 'test-pass');
        await meta.wait_and_click(compose_page, '@action-send', {delay: 0.5}); // in real usage, also have to click two times when using password - why?
      }
      await meta.wait_and_click(compose_page, '@action-send', {delay: 0.5});
      await meta.wait_all(compose_page, meta._selector_test_state('closed'), {timeout: 60}); // wait until page closed
      await compose_page.close();
    },
  }
};
