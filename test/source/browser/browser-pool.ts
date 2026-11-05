/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { Util } from '../util';
import { BrowserHandle } from './browser-handle';
import { Consts } from '../test';
import { TIMEOUT_DESTROY_UNEXPECTED_ALERT, TIMEOUT_ELEMENT_APPEAR } from '.';
import { launch, TargetType } from 'puppeteer';
import { addDebugHtml, AvaContext, newWithTimeoutsFunc } from '../tests/tooling';
import { ControllablePage } from './controllable';
import { TestUrls } from './test-urls';

class TimeoutError extends Error {}

export class BrowserPool {
  private semaphore: Semaphore;

  public constructor(
    public poolSize: number,
    public name: string,
    private extensionBuildDir: string,
    private isMock: boolean,
    private width = 1280,
    private height = 850,
    private debug = false
  ) {
    this.semaphore = new Semaphore(poolSize, name);
  }

  public newBrowserHandle = async (t: AvaContext) => {
    await this.semaphore.acquire();
    const extensionDir = t.context.extensionDir ?? this.extensionBuildDir;
    const args = [
      '--no-sandbox', // make it work in travis-ci
      '--disable-setuid-sandbox',
      '--kiosk-printing',
      `--disable-extensions-except=${extensionDir}`,
      `--load-extension=${extensionDir}`,
      '-disable-gpu',
      `--window-size=${this.width + 10},${this.height + 132}`,
      // https://github.com/puppeteer/puppeteer/issues/5123
      '--disable-features=site-per-process',
      // https://github.com/FlowCrypt/flowcrypt-browser/issues/6060
      // Fix for CORS Private Network Access issues with Puppeteer 24.16.0+
      '--disable-web-security',
    ];

    if (process.env.CI || process.env.SEMAPHORE) {
      args.push('--disable-dev-shm-usage'); // Use /tmp instead of /dev/shm in CI
      args.push('--no-zygote'); // Helps prevent zombie processes
    }
    if (this.isMock) {
      args.push('--ignore-certificate-errors');
      args.push('--allow-insecure-localhost');
    }
    const slowMo = this.isMock ? 60 : 60;
    const browser = await launch({
      args,
      acceptInsecureCerts: this.isMock,
      headless: false,
      devtools: false,
      slowMo,
      timeout: 90000, // 90 seconds timeout for browser launch (CI can be slow)
    }).catch((err: unknown) => {
      this.semaphore.release();
      throw err;
    });
    const handle = new BrowserHandle(browser, this.semaphore, this.height, this.width);
    try {
      const target = await browser.waitForTarget(
        target =>
          target.type() === TargetType.PAGE &&
          target.url().startsWith('chrome-extension://') &&
          new URL(target.url()).pathname === '/chrome/settings/initial.htm',
        { timeout: TIMEOUT_ELEMENT_APPEAR * 1000 }
      );
      const address = t.context.mockApi?.server.address();
      t.context.urls = new TestUrls(new URL(target.url()).hostname, typeof address === 'object' && address ? address.port : undefined);
      const page = await target.page();
      if (!page) {
        throw new Error('Extension initial page is unavailable');
      }
      const initialPage = new ControllablePage(t, page);
      handle.pages.push(initialPage);
      await initialPage.waitAll('@initial-page');
      await initialPage.close();
      return handle;
    } catch (err) {
      try {
        await browser.close();
      } finally {
        this.semaphore.release();
      }
      throw err;
    }
  };

  public cbWithTimeout = (cb: () => Promise<void>, timeout: number): Promise<void> => {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new TimeoutError(`Test timed out after ${timeout}ms`)), timeout);
      cb()
        .finally(() => clearTimeout(timer))
        .then(resolve, reject);
    });
  };

  public withNewBrowserTimeoutAndRetry = async (cb: (t: AvaContext, browser: BrowserHandle) => void, t: AvaContext, consts: Consts, flag?: 'FAILING') => {
    const withTimeouts = newWithTimeoutsFunc(consts);
    const attemptDebugHtmls: string[] = [];
    t.context.totalAttempts = flag === 'FAILING' ? 1 : consts.ATTEMPTS;
    for (let attemptNumber = 1; attemptNumber <= t.context.totalAttempts; attemptNumber++) {
      t.context.attemptNumber = attemptNumber;
      t.context.attemptText = `(attempt ${t.context.attemptNumber} of ${t.context.totalAttempts})`;
      try {
        const browser = await withTimeouts(this.newBrowserHandle(t));
        try {
          await withTimeouts(this.cbWithTimeout(async () => cb(t, browser), consts.TIMEOUT_EACH_RETRY));
          await this.throwOnRetryFlagAndReset(t);
          if (attemptDebugHtmls.length && flag !== 'FAILING') {
            // don't debug known failures
            addDebugHtml(t.context, `<h1>Test (later succeeded): ${Util.htmlEscape(t.title)}</h1>${attemptDebugHtmls.join('')}`);
          }
          return;
        } catch (err) {
          attemptDebugHtmls.push(await this.testFailSingleAttemptDebugHtml(t, browser, err));
          throw err;
        } finally {
          await Util.sleep(1);
          await browser.close();
        }
      } catch (err) {
        this.processTestError(err, t, attemptDebugHtmls, flag);
      }
    }
  };

  private processTestError = (err: unknown, t: AvaContext, attemptHtmls: string[], flag?: 'FAILING') => {
    t.context.retry = undefined;

    if (t.context.attemptNumber! < t.context.totalAttempts!) {
      t.log(`${t.context.attemptText} Retrying: ${String(err)}`);
    } else {
      if (flag !== 'FAILING') {
        // don't debug known failures
        addDebugHtml(t.context, `<h1>Test: ${Util.htmlEscape(t.title)}</h1>${attemptHtmls.join('')}`);
      }
      t.log(`${t.context.attemptText} Failed:   ${err instanceof Error ? err.stack : String(err)}`);
      t.fail(`[ALL RETRIES FAILED for ${t.title}]`);
    }
  };

  private testFailSingleAttemptDebugHtml = async (t: AvaContext, browser: BrowserHandle, err: unknown): Promise<string> => {
    return `
    <div class="attempt">
      <div style="display:none;">
        <pre title="err.stack">${Util.htmlEscape((err instanceof Error ? err.stack : String(err)) || String(err))}</pre>
        ${await browser.debugPagesHtml(t, this.debug)}
      </div>
      <a href="#" onclick="this.style.display='none';this.parentNode.firstElementChild.style = '';">${String(err)}</a>
    </div>
    `;
  };

  private throwOnRetryFlagAndReset = async (t: AvaContext) => {
    await Util.sleep(TIMEOUT_DESTROY_UNEXPECTED_ALERT + 1); // in case there was an unexpected alert, don't let that affect next round
    if (t.context.retry) {
      t.context.retry = undefined;
      const e = new Error(`last attempt marked for retry`);
      e.stack = e.message; // stack is not interesting here, too much clutter would be printed
      throw e;
    }
  };
}

export class Semaphore {
  private availableLocks: number;
  private name: string;
  private debug = false;

  public constructor(poolSize: number, name = 'semaphore') {
    this.availableLocks = poolSize;
    this.name = name;
  }

  public acquire = async () => {
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
  };

  public release = () => {
    if (this.debug) {
      console.info(`[${this.name}] releasing semaphore, previously available: ${this.availableLocks}`);
    }
    this.availableLocks++;
    if (this.debug) {
      console.info(`[${this.name}] released semaphore, now available: ${this.availableLocks}`);
    }
  };

  private wait = () => {
    return new Promise(resolve => setTimeout(resolve, 1000 + Math.round(Math.random() * 2000))); // wait 1-3s
  };
}
