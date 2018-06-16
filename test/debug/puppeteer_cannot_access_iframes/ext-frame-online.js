
const puppeteer = require('../node_modules/puppeteer');

let browser;

(async() => {

  browser = await puppeteer.launch({
    args: [
      '--disable-features=site-per-process',
      '--disable-extensions-except=add_iframe',
      '--load-extension=add_iframe',
    ],
    headless: false,
    slowMo: 50,
  });

  let page = await browser.newPage();
  await page.goto('https://google.com/404');

  await page.waitForSelector('iframe', {timeout: 5000, visible: true});
  let iframeHandle = await page.$('iframe');
  let iframeSrc = await (await iframeHandle.getProperty('src')).jsonValue();

  let frames = await page.frames();
  let urls = frames.map(frame => frame.url());

  console.log(`parsed iframe src: ${iframeSrc}`);
  console.log(`page.frames() url: ${JSON.stringify(urls)}`);
  console.log(urls.indexOf(iframeSrc) === -1 ? 'FAIL' : 'PASS');

})();
