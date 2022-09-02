
const puppeteer = require('../node_modules/puppeteer');

let browser;

(async () => {

  browser = await puppeteer.launch({
    args: [
      '--disable-features=site-per-process',
      '--disable-extensions-except=add_iframe',
      '--load-extension=add_iframe',
    ],
    headless: false,
    slowMo: 50,
  });

  const page = await browser.newPage();
  await page.goto('https://google.com/404');

  await page.waitForSelector('iframe', { timeout: 5000, visible: true });
  const iframeHandle = await page.$('iframe');
  const iframeSrc = await (await iframeHandle.getProperty('src')).jsonValue();

  const frames = await page.frames();
  const urls = frames.map(frame => frame.url());

  console.info(`parsed iframe src: ${iframeSrc}`);
  console.info(`page.frames() url: ${JSON.stringify(urls)}`);
  console.info(urls.indexOf(iframeSrc) === -1 ? 'FAIL' : 'PASS');

})();
