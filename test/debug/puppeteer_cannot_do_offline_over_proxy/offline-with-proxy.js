
const puppeteer = require('./node_modules/puppeteer');

const testOffline = async (proxy) => {
  const browser = await puppeteer.launch({ args: proxy ? [proxy] : [] });
  const page = await browser.newPage();
  if (proxy) {
    await page.authenticate({ "username": "ci-test-browser", "password": "ERTvPNFRzivTqx3M2v8XLQ7DVE5AH2" });
  }
  await page.setOfflineMode(true);
  try {
    await page.goto('https://google.com');
    console.error(`proxy ${!!proxy}: ERROR: page loaded although in offline mode`);
  } catch (e) {
    console.info(`proxy ${!!proxy}: SUCCESS: page did not load due to offline mode`);
  }
  await browser.close();
};

(async () => {

  await testOffline(null); // pass
  await testOffline(`--proxy-server=cron.flowcrypt.com:13128`); // fail
})();
