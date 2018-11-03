import { Page, Browser } from 'puppeteer';
import { Url } from './url';
import { Semaphore } from './browser_pool';
import { ControllablePage } from './controllable';

export class BrowserHandle {

  public browser: Browser;
  private semaphore: Semaphore;
  private viewport: {height: number, width: number};

  constructor(browser: Browser, semaphore: Semaphore, height: number, width: number) {
    this.browser = browser;
    this.semaphore = semaphore;
    this.viewport = {height, width};
  }

  new_page = async (url?: string): Promise<ControllablePage> => {
    const page = await this.browser.newPage();
    await page.setViewport(this.viewport);
    if(url) {
      await page.goto(url.indexOf('https://') === 0 || url.indexOf(Url.extension('')) === 0 ? url : Url.extension(url));
    }
    return new ControllablePage(page);
  }

  new_page_triggered_by = async (triggering_action: () => void): Promise<ControllablePage> => {
    let page = await this.do_await_triggered_page(triggering_action);
    await page.setViewport(this.viewport);
    return new ControllablePage(page);
  }

  close_all_pages = async () => {
    for(let page of await this.browser.pages()) {
      if(page.url() !== 'about:blank') {
        await page.close();
      }
    }
  }

  close = async () => {
    await this.browser.close();
    this.semaphore.release();
  }

  private do_await_triggered_page = (triggering_action: () => void): Promise<Page> => new Promise(resolve => {
    let resolved = 0;
    this.browser.on('targetcreated', async (target) => {
      if(target.type() === 'page') {
        if(!resolved++) {
          target.page().then(resolve);
        }
      }
    });
    triggering_action();
  })

}
