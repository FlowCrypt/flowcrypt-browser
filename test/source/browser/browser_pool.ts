
import { launch } from "puppeteer";
import { BrowserHandle } from './browser_handle';
import { Util } from "../util";
import { addDebugHtml, AvaContext, newWithTimeoutsFunc } from '../tests';
import { Consts } from '../test';
import { TIMEOUT_DESTROY_UNEXPECTED_ALERT } from '.';

class TimeoutError extends Error { }

export class BrowserPool {

  private semaphore: Semaphore;
  private browsersForReuse: BrowserHandle[] = [];

  constructor(
    poolSize: number,
    name: string,
    private reuse: boolean,
    private extensionBuildDir: string,
    private width = 1280,
    private height = 900
  ) {
    this.semaphore = new Semaphore(poolSize, name);
  }

  public newBrowserHandle = async (t: AvaContext, closeInitialPage = true) => {
    await this.semaphore.acquire();
    // ext frames in gmail: https://github.com/GoogleChrome/puppeteer/issues/2506 https://github.com/GoogleChrome/puppeteer/issues/2548
    const args = [
      '--no-sandbox', // make it work in travis-ci
      '--disable-setuid-sandbox',
      '--disable-features=site-per-process',
      `--disable-extensions-except=${this.extensionBuildDir}`,
      `--load-extension=${this.extensionBuildDir}`,
      `--window-size=${this.width + 10},${this.height + 132}`,
    ];
    // to run headless-like: "xvfb-run node test.js"
    const browser = await launch({ args, headless: false, slowMo: 50, devtools: false });
    const handle = new BrowserHandle(browser, this.semaphore, this.height, this.width);
    if (closeInitialPage) {
      await this.closeInitialExtensionPage(t, handle);
    }
    return handle;
  }

  public getExtensionId = async (t: AvaContext): Promise<string> => {
    const browser = await this.newBrowserHandle(t, false);
    const initialPage = await browser.newPageTriggeredBy(t, () => Promise.resolve()); // the page triggered on its own
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

  public openOrReuseBrowser = async (t: AvaContext): Promise<BrowserHandle> => {
    if (!this.reuse) {
      return await this.newBrowserHandle(t);
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

  public getPooledBrowser = async (cb: (t: AvaContext, browser: BrowserHandle) => void, t: AvaContext) => {
    const browser = await this.openOrReuseBrowser(t);
    try {
      await cb(t, browser);
    } finally {
      await Util.sleep(1);
      await this.doneUsingBrowser(browser);
    }
  }

  public cbWithTimeout = (cb: () => Promise<void>, timeout: number): Promise<void> => new Promise((resolve, reject) => {
    setTimeout(() => reject(new TimeoutError(`Test timed out after ${timeout}ms`)), timeout); // reject in
    cb().then(resolve, reject);
  })

  private processTestError = (err: any, t: AvaContext, attemptHtmls: string[]) => {
    t.retry = undefined;
    if (t.attemptNumber! < t.totalAttempts!) {
      t.log(`${t.attemptText} Retrying: ${String(err)}`);
    } else {
      addDebugHtml(`<h1>Test: ${Util.htmlEscape(t.title)}</h1>${attemptHtmls.join('')}`);
      t.log(`${t.attemptText} Failed:   ${err instanceof Error ? err.stack : String(err)}`);
      t.fail(`[ALL RETRIES FAILED for ${t.title}]`);
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

  private throwOnRetryFlagAndReset = async (t: AvaContext) => {
    await Util.sleep(TIMEOUT_DESTROY_UNEXPECTED_ALERT + 1); // in case there was an unexpected alert, don't let that affect next round
    if (t.retry) {
      t.retry = undefined;
      const e = new Error(`last attempt marked for retry`);
      e.stack = e.message; // stack is not interesting here, too much clutter would be printed
      throw e;
    }
  }

  public withNewBrowserTimeoutAndRetry = async (cb: (t: AvaContext, browser: BrowserHandle) => void, t: AvaContext, consts: Consts) => {
    const withTimeouts = newWithTimeoutsFunc(consts);
    const attemptDebugHtmls: string[] = [];
    t.totalAttempts = consts.ATTEMPTS;
    for (let attemptNumber = 1; attemptNumber <= consts.ATTEMPTS; attemptNumber++) {
      t.attemptNumber = attemptNumber;
      t.attemptText = `(attempt ${t.attemptNumber} of ${t.totalAttempts})`;
      try {
        const browser = await withTimeouts(this.newBrowserHandle(t));
        try {
          await withTimeouts(this.cbWithTimeout(async () => await cb(t, browser), consts.TIMEOUT_EACH_RETRY));
          await this.throwOnRetryFlagAndReset(t);
          return;
        } catch (err) {
          attemptDebugHtmls.push(await this.testFailSingleAttemptDebugHtml(t, browser, err));
          throw err;
        } finally {
          await Util.sleep(1);
          await browser.close();
        }
      } catch (err) {
        this.processTestError(err, t, attemptDebugHtmls);
      }
    }
  }

  public withGlobalBrowserTimeoutAndRetry = async (browser: BrowserHandle, cb: (t: AvaContext, b: BrowserHandle) => void, t: AvaContext, consts: Consts) => {
    const withTimeouts = newWithTimeoutsFunc(consts);
    const attemptDebugHtmls: string[] = [];
    t.totalAttempts = consts.ATTEMPTS;
    for (let attemptNumber = 1; attemptNumber <= consts.ATTEMPTS; attemptNumber++) {
      t.attemptNumber = attemptNumber;
      t.attemptText = `(attempt ${t.attemptNumber} of ${t.totalAttempts - 1})`;
      try {
        await browser.closeAllPages();
        try {
          await withTimeouts(this.cbWithTimeout(async () => await cb(t, browser), consts.TIMEOUT_EACH_RETRY));
          await this.throwOnRetryFlagAndReset(t);
          return;
        } catch (err) {
          attemptDebugHtmls.push(await this.testFailSingleAttemptDebugHtml(t, browser, err));
          throw err;
        } finally {
          await Util.sleep(1);
          await browser.closeAllPages();
        }
      } catch (err) {
        this.processTestError(err, t, attemptDebugHtmls);
      }
    }
  }

  private closeInitialExtensionPage = async (t: AvaContext, browser: BrowserHandle) => {
    const initialPage = await browser.newPageTriggeredBy(t, () => Promise.resolve()); // the page triggered on its own
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
        console.info(`[${this.name}] waiting for semaphore attempt ${i++}, now available: ${this.availableLocks}`);
      }
      await this.wait();
    }
    if (this.debug) {
      console.info(`[${this.name}] acquiring, semaphors available: ${this.availableLocks}`);
    }
    this.availableLocks--;
    if (this.debug) {
      console.info(`[${this.name}] acquired, now avaialbe: ${this.availableLocks}`);
    }
  }

  release = () => {
    if (this.debug) {
      console.info(`[${this.name}] releasing semaphore, previously available: ${this.availableLocks}`);
    }
    this.availableLocks++;
    if (this.debug) {
      console.info(`[${this.name}] released semaphore, now available: ${this.availableLocks}`);
    }
  }

}
