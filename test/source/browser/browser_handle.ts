import { Page, Browser } from 'puppeteer';
import { Semaphore } from './browser_pool';
import { ControllablePage } from './controllable';
import { Util } from '../util';

export class BrowserHandle {

  public pages: ControllablePage[] = [];
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
    this.pages.push(controllablePage);
    return controllablePage;
  }

  newPageTriggeredBy = async (triggeringAction: () => void): Promise<ControllablePage> => {
    const page = await this.doAwaitTriggeredPage(triggeringAction);
    await page.setViewport(this.viewport);
    const controllablePage = new ControllablePage(page);
    this.pages.push(controllablePage);
    return controllablePage;
  }

  closeAllPages = async () => {
    for (const page of await this.browser.pages()) {
      if (page.url() !== 'about:blank') {
        await page.close();
      }
    }
    this.pages = [];
  }

  close = async () => {
    await this.browser.close();
    this.semaphore.release();
  }

  release = () => {
    this.semaphore.release();
  }

  debugPagesHtml = async () => {
    let html = '';
    for (let i = 0; i < this.pages.length; i++) {
      const controllablePage = this.pages[i];
      const url = await controllablePage.page.url();
      html += '<div style="border:1px dashed #999;padding:5px;margin: 5px;">';
      html += `<pre>Page ${i} (${controllablePage.page.isClosed() ? 'closed' : 'active'}) ${Util.htmlEscape(url)}</pre>`;
      html += `<pre>${controllablePage.consoleMsgs.map(msg => `${msg.type()}: ${Util.htmlEscape(msg.text())}`).join('\n')}</pre>`;
      if (url !== 'about:blank' && !controllablePage.page.isClosed()) {
        html += `<img style="margin:5px;" src="data:image/png;base64,${await controllablePage.page.screenshot({ encoding: 'base64' })}"><br><br>`;
      }
      html += '</div>';
    }
    return html;
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
