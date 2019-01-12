import { Page, Browser } from 'puppeteer';
import { Semaphore } from './browser_pool';
import { ControllablePage } from './controllable';
import { Util } from '../util';
import { TIMEOUT_ELEMENT_APPEAR } from '.';

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

  newPageTriggeredBy = async (triggeringAction: () => Promise<void>): Promise<ControllablePage> => {
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
      const cpage = this.pages[i];
      const url = await cpage.page.url();
      const consoleMsgs = cpage.consoleMsgs.map(msg => `<font class="c-${msg.type()}">${msg.type()}: ${Util.htmlEscape(msg.text())}</font>`).join('\n');
      const alerts = cpage.alerts.map(a => `${a.active ? `<b class="c-error">ACTIVE ${a.target.type()}</b>` : a.target.type()}: ${a.target.message()}`).join('\n');
      html += '<div class="page">';
      html += `<pre title="url">Page ${i} (${cpage.page.isClosed() ? 'closed' : 'active'}) ${Util.htmlEscape(url)}</pre>`;
      html += `<pre title="console">${consoleMsgs || '(no console messages)'}</pre>`;
      html += `<pre title="alerts">${alerts || '(no alerts)'}</pre>`;
      if (url !== 'about:blank' && !cpage.page.isClosed()) {
        html += `<img src="data:image/png;base64,${await cpage.screenshot()}"><br><br>`;
      }
      html += '</div>';
    }
    return html;
  }

  private doAwaitTriggeredPage = (triggeringAction: () => Promise<void>): Promise<Page> => new Promise((resolve, reject) => {
    setTimeout(() => reject(new Error('Action did not trigger a new page within timeout period')), TIMEOUT_ELEMENT_APPEAR * 1000);
    let resolved = 0;
    this.browser.on('targetcreated', async target => {
      if (target.type() === 'page') {
        if (!resolved++) {
          target.page().then(resolve, reject);
        }
      }
    });
    triggeringAction().catch(console.error);
  })

}
