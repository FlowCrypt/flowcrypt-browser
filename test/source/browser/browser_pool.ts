
import {launch} from "puppeteer";
import {BrowserHandle} from './browser_handle';

export class BrowserPool {

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
