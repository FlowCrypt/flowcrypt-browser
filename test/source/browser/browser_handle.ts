import { Page, Browser } from 'puppeteer';
import { Url } from './url';
import { Semaphore } from './browser_pool';
import { ControllablePage } from './controllable';

export class BrowserHandle {

  public browser: Browser;
  private semaphore: Semaphore;
  private viewport: { height: number, width: number };

  constructor(browser: Browser, semaphore: Semaphore, height: number, width: number) {
    this.browser = browser;
    this.semaphore = semaphore;
    this.viewport = { height, width };
  }

  newPage = async (url?: string): Promise<ControllablePage> => {
    const page = await this.browser.newPage();
    await page.setViewport(this.viewport);
    const controllablePage = new ControllablePage(page);
    if (url) {
      await controllablePage.goto(url);
    }
    return controllablePage;
  }

  newPageTriggeredBy = async (triggeringAction: () => void): Promise<ControllablePage> => {
    const page = await this.doAwaitTriggeredPage(triggeringAction);
    await page.setViewport(this.viewport);
    return new ControllablePage(page);
  }

  closeAllPages = async () => {
    for (const page of await this.browser.pages()) {
      if (page.url() !== 'about:blank') {
        await page.close();
      }
    }
  }

  close = async () => {
    await this.browser.close();
    this.semaphore.release();
  }

  release = () => {
    this.semaphore.release();
  }

  private doAwaitTriggeredPage = (triggeringAction: () => void): Promise<Page> => new Promise(resolve => {
    let resolved = 0;
    this.browser.on('targetcreated', async (target) => {
      if (target.type() === 'page') {
        if (!resolved++) {
          target.page().then(resolve);
        }
      }
    });
    triggeringAction();
  })

}
