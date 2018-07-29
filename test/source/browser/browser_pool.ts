
import {launch} from "puppeteer";
import {BrowserHandle} from './browser_handle';
import {Util} from "../util";
import * as ava from 'ava';

export class BrowserPool {

  private height: number;
  private width: number;
  private semaphore: Semaphore;

  constructor(pool_size: number, width=1280, height=900) {
    this.height = height;
    this.width = width;
    this.semaphore = new Semaphore(pool_size);
  }

  public async new_browser_handle(close_initial_page=true) {
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

  public async get_extension_id(): Promise<string> {
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

  public async with_new_browser(cb: (browser: BrowserHandle, t: ava.ExecutionContext<{}>) => void, t: ava.ExecutionContext<{}>) {
    let browser = await this.new_browser_handle();
    try {
      await cb(browser, t);
    } catch(e) {
      // console.error(e);
      throw e;
    } finally {
      await Util.sleep(1);
      await browser.close();
    }
  }

  private async close_initial_extension_page(browser: BrowserHandle) {
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
