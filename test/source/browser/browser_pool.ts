
import { launch } from "puppeteer";
import { BrowserHandle } from './browser_handle';
import { Util } from "../util";
import { addDebugHtml, AvaContext, newWithTimeoutsFunc } from '../tests';
import { Consts } from '../test';

class TimeoutError extends Error { }

export class BrowserPool {

  private height: number;
  private width: number;
  private semaphore: Semaphore;
  private reuse: boolean;
  private browsersForReuse: BrowserHandle[] = [];

  constructor(poolSize: number, name: string, reuse: boolean, width = 1280, height = 900) {
    this.height = height;
    this.width = width;
    this.semaphore = new Semaphore(poolSize, name);
    this.reuse = reuse;
  }

  public newBrowserHandle = async (closeInitialPage = true) => {
    await this.semaphore.acquire();
    // ext frames in gmail: https://github.com/GoogleChrome/puppeteer/issues/2506 https://github.com/GoogleChrome/puppeteer/issues/2548
    const args = [
      '--no-sandbox', // make it work in travis-ci
      '--disable-setuid-sandbox',
      '--disable-features=site-per-process',
      '--disable-extensions-except=build/chrome',
      '--load-extension=build/chrome',
      `--window-size=${this.width + 10},${this.height + 132}`,
    ];
    // to run headless-like: "xvfb-run node test.js"
    const browser = await launch({ args, headless: false, slowMo: 50, devtools: false });
    const handle = new BrowserHandle(browser, this.semaphore, this.height, this.width);
    if (closeInitialPage) {
      await this.closeInitialExtensionPage(handle);
    }
    return handle;
  }

  public getExtensionId = async (): Promise<string> => {
    const browser = await this.newBrowserHandle(false);
    const initialPage = await browser.newPageTriggeredBy(() => undefined); // the page triggered on its own
    const url = initialPage.page.url();
    const match = url.match(/[a-z]{32}/);
    if (match !== null) {
      await browser.close();
      return match[0];
    }
    throw new Error(`Cannot determine extension id from url: ${url}`);
  }

  public close = async () => {
    while (this.browsersForReuse.length) {
      await this.browsersForReuse.pop()!.close();
    }
  }

  public openOrReuseBrowser = async (): Promise<BrowserHandle> => {
    if (!this.reuse) {
      return await this.newBrowserHandle();
    }
    await this.semaphore.acquire();
    return this.browsersForReuse.pop()!;
  }

  public doneUsingBrowser = async (browser: BrowserHandle) => {
    if (this.reuse) {
      await browser.closeAllPages();
      this.browsersForReuse.push(browser);
      browser.release();
    } else {
      await browser.close();
    }
  }

  public getPooledBrowser = async (cb: (browser: BrowserHandle, t: AvaContext) => void, t: AvaContext) => {
    const browser = await this.openOrReuseBrowser();
    try {
      await cb(browser, t);
    } finally {
      await Util.sleep(1);
      await this.doneUsingBrowser(browser);
    }
  }

  public cbWithTimeout = (cb: () => Promise<void>, timeout: number): Promise<void> => new Promise((resolve, reject) => {
    setTimeout(() => reject(new TimeoutError(`Test timed out after ${timeout}ms`)), timeout); // reject in
    cb().then(resolve, reject);
  })

  private processTestError = (err: any, attemptNumber: number, t: AvaContext, totalAttempts: number, attemptHtmls: string[]) => {
    if (attemptNumber < totalAttempts) {
      t.log(`Retrying: ${String(err)}`);
    } else {
      addDebugHtml(`<h1>Test: ${Util.htmlEscape(t.title)}</h1>${attemptHtmls.join('')}`);
      t.log(`Failed:   ${err instanceof Error ? err.stack : String(err)}`);
      t.fail('[ALL RETRIES FAILED]');
    }
  }

  private testFailSingleAttemptDebugHtml = async (t: AvaContext, browser: BrowserHandle, err: any): Promise<string> => `
    <div class="attempt">
      <div style="display:none;">
        <pre title="err.stack">${Util.htmlEscape((err instanceof Error ? err.stack : String(err)) || String(err))}</pre>
        ${await browser.debugPagesHtml()}
      </div>
      <a href="#" onclick="this.style.display='none';this.parentNode.firstElementChild.style = '';">${String(err)}</a>
    </div>
    `

  public withNewBrowserTimeoutAndRetry = async (cb: (browser: BrowserHandle, t: AvaContext) => void, t: AvaContext, consts: Consts) => {
    const withTimeouts = newWithTimeoutsFunc(consts);
    const attemptDebugHtmls: string[] = [];
    for (let attemptNumber = 1; attemptNumber <= consts.ATTEMPTS; attemptNumber++) {
      try {
        const browser = await withTimeouts(this.newBrowserHandle());
        try {
          return await withTimeouts(this.cbWithTimeout(async () => await cb(browser, t), consts.TIMEOUT_EACH_RETRY));
        } catch (err) {
          attemptDebugHtmls.push(await this.testFailSingleAttemptDebugHtml(t, browser, err));
          throw err;
        } finally {
          await Util.sleep(1);
          await browser.close();
        }
      } catch (err) {
        this.processTestError(err, attemptNumber, t, consts.ATTEMPTS, attemptDebugHtmls);
      }
    }
  }

  public withGlobalBrowserTimeoutAndRetry = async (browser: BrowserHandle, cb: (b: BrowserHandle, t: AvaContext) => void, t: AvaContext, consts: Consts) => {
    const withTimeouts = newWithTimeoutsFunc(consts);
    const attemptDebugHtmls: string[] = [];
    for (let attemptNumber = 1; attemptNumber <= consts.ATTEMPTS; attemptNumber++) {
      try {
        await browser.closeAllPages();
        try {
          return await withTimeouts(this.cbWithTimeout(async () => await cb(browser, t), consts.TIMEOUT_EACH_RETRY));
        } catch (err) {
          attemptDebugHtmls.push(await this.testFailSingleAttemptDebugHtml(t, browser, err));
          throw err;
        } finally {
          await Util.sleep(1);
          await browser.closeAllPages();
        }
      } catch (err) {
        this.processTestError(err, attemptNumber, t, consts.ATTEMPTS, attemptDebugHtmls);
      }
    }
  }

  private closeInitialExtensionPage = async (browser: BrowserHandle) => {
    const initialPage = await browser.newPageTriggeredBy(() => undefined); // the page triggered on its own
    await initialPage.waitAll('@initial-page'); // first page opened by flowcrypt
    await initialPage.close();
  }
}

export class Semaphore {

  private availableLocks: number;
  private name: string;
  private debug = false;

  constructor(poolSize: number, name = 'semaphore') {
    this.availableLocks = poolSize;
    this.name = name;
  }

  private wait = () => new Promise(resolve => setTimeout(resolve, 1000 + Math.round(Math.random() * 2000))); // wait 1-3s

  acquire = async () => {
    let i = 0;
    while (this.availableLocks < 1) {
      if (this.debug) {
        console.log(`[${this.name}] waiting for semaphore attempt ${i++}, now available: ${this.availableLocks}`);
      }
      await this.wait();
    }
    if (this.debug) {
      console.log(`[${this.name}] acquiring, semaphors available: ${this.availableLocks}`);
    }
    this.availableLocks--;
    if (this.debug) {
      console.log(`[${this.name}] acquired, now avaialbe: ${this.availableLocks}`);
    }
  }

  release = () => {
    if (this.debug) {
      console.log(`[${this.name}] releasing semaphore, previously available: ${this.availableLocks}`);
    }
    this.availableLocks++;
    if (this.debug) {
      console.log(`[${this.name}] released semaphore, now available: ${this.availableLocks}`);
    }
  }

}
