
import {Dialog, ElementHandle, Frame, Page, Browser, launch} from "puppeteer";
import {Url} from './url';

export class Pool {

  private height: number;
  private width: number;
  private semaphore: Semaphore;

  constructor(pool_size: number, width=1280, height=900) {
    this.height = height;
    this.width = width;
    this.semaphore = new Semaphore(pool_size);
  }

  public async new_browser_handle() {
    await this.semaphore.acquire();
    // ext frames in gmail: https://github.com/GoogleChrome/puppeteer/issues/2506 https://github.com/GoogleChrome/puppeteer/issues/2548
    let args = [
      '--disable-features=site-per-process',
      '--disable-extensions-except=build/chrome',
      '--load-extension=build/chrome',
      `--window-size=${this.width+10},${this.height+132}`,
    ];
    // to run headless-like: "xvfb-run node test.js"
    return new BrowserHandle(await launch({args, headless: false, slowMo: 50, devtools: false}), this.semaphore, this.height, this.width);
  }

}

export class BrowserHandle {

  public browser: Browser;
  private semaphore: Semaphore;
  private viewport: {height: number, width: number};

  constructor(browser: Browser, semaphore: Semaphore, height: number, width: number) {
    this.browser = browser;
    this.semaphore = semaphore;
    this.viewport = {height, width};
  }

  async new_page(url?: string) {
    const page = await this.browser.newPage();
    await page.setViewport(this.viewport);
    if(url) {
      await page.goto(url.indexOf('https://') === 0 ? url : Url.extension(url));
    }
    return page;
  }

  async new_page_triggered_by(triggering_action: () => void): Promise<Page> {
    let page = await this.do_await_triggered_page(triggering_action);
    await page.setViewport(this.viewport);
    return page;
  }

  async close() {
    await this.browser.close();
    this.semaphore.release();
  }

  private do_await_triggered_page(triggering_action: () => void): Promise<Page> {
    return new Promise((resolve) => {
      let resolved = 0;
      this.browser.on('targetcreated', async (target) => {
        if(target.type() === 'page') {
          if(!resolved++) {
            target.page().then(resolve);
          }
        }
      });
      triggering_action();
    });
  }

}

export class Semaphore {

  private available_locks: number;

  constructor(pool_size: number) {
    this.available_locks = pool_size;
  }

  private wait = () => new Promise(resolve => setTimeout(resolve, 10 + Math.round(Math.random() * 10))); // wait 10-20 ms

  acquire = async () => {
    while(this.available_locks < 1) {
      await this.wait();
    }
    this.available_locks--;
  }

  release = () => {
    this.available_locks++;
  }

}
