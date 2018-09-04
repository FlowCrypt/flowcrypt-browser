
import {launch} from "puppeteer";
import {BrowserHandle} from './browser_handle';
import {Util} from "../util";
import * as ava from 'ava';
import { resolve } from "url";
import {GlobalBrowser} from "../test";

class TimeoutError extends Error {}

export class BrowserPool {

  private height: number;
  private width: number;
  private semaphore: Semaphore;

  constructor(pool_size: number, width=1280, height=900) {
    this.height = height;
    this.width = width;
    this.semaphore = new Semaphore(pool_size);
  }

  public new_browser_handle = async (close_initial_page=true) => {
    await this.semaphore.acquire();
    // ext frames in gmail: https://github.com/GoogleChrome/puppeteer/issues/2506 https://github.com/GoogleChrome/puppeteer/issues/2548
    let args = [
      '--no-sandbox', // make it work in travis-ci
      '--disable-setuid-sandbox',
      '--disable-features=site-per-process',
      '--disable-extensions-except=build/chrome',
      '--load-extension=build/chrome',
      `--window-size=${this.width+10},${this.height+132}`,
    ];
    // to run headless-like: "xvfb-run node test.js"
    let browser = await launch({args, headless: false, slowMo: 50, devtools: false});
    let handle = new BrowserHandle(browser, this.semaphore, this.height, this.width);
    if(close_initial_page) {
      await this.close_initial_extension_page(handle);
    }
    return handle;
  }

  public get_extension_id = async (): Promise<string> => {
    let browser = await this.new_browser_handle(false);
    let initial_page = await browser.new_page_triggered_by(() => null); // the page triggered on its own
    let url = initial_page.page.url();
    let match = url.match(/[a-z]{32}/);
    if(match !== null) {
      await browser.close();
      return match[0];
    }
    throw new Error(`Cannot determine extension id from url: ${url}`);
  }

  public with_new_browser = async (cb: (browser: BrowserHandle, t: ava.ExecutionContext<{}>) => void, t: ava.ExecutionContext<{}>) => {
    let browser = await this.new_browser_handle();
    try {
      await cb(browser, t);
    } finally {
      await Util.sleep(1);
      await browser.close();
    }
  }

  public cb_with_timeout = (cb: () => Promise<void>, timeout: number): Promise<void> => new Promise((resolve, reject) => {
    setTimeout(() => reject(new TimeoutError(`Test timed out after ${timeout}ms`)), timeout); // reject in
    cb().then(resolve, reject);
  })

  public with_new_browser_timeout_and_retry = async (cb: (browser: BrowserHandle, t: ava.ExecutionContext<{}>) => void, t: ava.ExecutionContext<{}>, timeout: number) => {
    for(let i of [1,2,3]) {
      try {
        let browser = await this.new_browser_handle();
        try {
          return await this.cb_with_timeout(async () => await cb(browser, t), timeout);
        } finally {
          await Util.sleep(1);
          await browser.close();
        }
      } catch(e) {
        if(i < 3) {
          console.log(`Retrying: ${t.title} (${e.message})\n${e.stack}`);
        } else {
          throw e;
        }
      }
    }
  }

  public with_global_browser_timeout_and_retry = async (global_browser: GlobalBrowser, cb: (browser: BrowserHandle, t: ava.ExecutionContext<{}>) => void, t: ava.ExecutionContext<{}>, timeout: number) => {
    for(let i of [1,2,3]) {
      try {
        await global_browser.before_each_test();
        await global_browser.browser!.close_all_pages();
        try {
          return await this.cb_with_timeout(async () => await cb(global_browser.browser!, t), timeout);
        } finally {
          await Util.sleep(1);
          await global_browser.browser!.close_all_pages();
        }
      } catch(e) {
        if(i < 3) {
          console.log(`Retrying: ${t.title} (${e.message})\n${e.stack}`);
        } else {
          throw e;
        }
      }
    }
  }

  private close_initial_extension_page = async (browser: BrowserHandle) => {
    let initial_page = await browser.new_page_triggered_by(() => null); // the page triggered on its own
    await initial_page.wait_all('@initial-page'); // first page opened by flowcrypt
    await initial_page.close();
  }

}

export class Semaphore {

  private available_locks: number;

  constructor(pool_size: number) {
    this.available_locks = pool_size;
  }

  private wait = () => new Promise(resolve => setTimeout(resolve, 50 + Math.round(Math.random() * 100))); // wait 50-150 ms

  acquire = async () => {
    // let i = 0;
    while(this.available_locks < 1) {
      // console.log(`waiting for semaphore attempt ${i++}, now available: ${this.available_locks}`);
      await this.wait();
    }
    // console.log(`acquiring, semaphors available: ${this.available_locks}`);
    this.available_locks--;
    // console.log(`acquired, now avaialbe: ${this.available_locks}`);
  }

  release = () => {
    // console.log(`releasing semaphore, previously available: ${this.available_locks}`);
    this.available_locks++;
    // console.log(`released semaphore, now available: ${this.available_locks}`);
  }

}
