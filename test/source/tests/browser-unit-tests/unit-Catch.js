/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

/**
 * These tests use JavaScript instead of TypeScript to avoid dealing with types in cross-environment setup.
 * (tests are injected from NodeJS through puppeteer into a browser environment)
 * While this makes them less convenient to write, the result is more flexible.
 *
 * Import your lib to `ci_unit_test.ts` to resolve `ReferenceError: SomeClass is not defined`
 *
 * Each test must return "pass" to pass. To reject, throw an Error.
 *
 * Each test must start with one of (depending on which flavors you want it to run):
 *  - BROWSER_UNIT_TEST_NAME(`some test name`);
 *  - BROWSER_UNIT_TEST_NAME(`some test name`).enterprise;
 *  - BROWSER_UNIT_TEST_NAME(`some test name`).consumer;
 *
 * This is not a JavaScript file. It's a text file that gets parsed, split into chunks, and
 *    parts of it executed as javascript. The structure is very rigid. The only flexible place is inside
 *    the async functions. For the rest, do not change the structure or our parser will get confused.
 *    Do not put any code whatsoever outside of the async functions.
 */

BROWSER_UNIT_TEST_NAME(`Catcher does not report on enterprise`).enterprise;
(async () => {
  if (Catch.report('testing report') !== false) {
    throw new Error('Wrongly submitted Catch.report');
  }
  if (Catch.reportErr('testing reportErr') !== false) {
    throw new Error('Wrongly submitted Catch.reportErr');
  }
  if (Catch.onErrorInternalHandler('testing onErrorInternalHandler', 'url', 1, 1, Error('test')) !== false) {
    throw new Error('Wrongly submitted Catch.onErrorInternalHandler');
  }
  return 'pass';
})();

BROWSER_UNIT_TEST_NAME(`Catcher does report on consumer`).consumer;
(async () => {
  if (Catch.report('testing report') !== true) {
    throw new Error('Wrongly didnt submit Catch.report');
  }
  if (Catch.reportErr('testing reportErr') !== true) {
    throw new Error('Wrongly didnt submit Catch.reportErr');
  }
  if (Catch.onErrorInternalHandler('testing onErrorInternalHandler', 'url', 1, 1, Error('test')) !== true) {
    throw new Error('Wrongly didnt submit Catch.onErrorInternalHandler');
  }
  return 'pass';
})();

BROWSER_UNIT_TEST_NAME(`Catcher does report sensitive infos`);
(async () => {
  const url = 'chrome://extension-id/pgp_block.htm?frameId=id&message=blahblah&some=1&senderEmail=blahblah&acctEmail=123&prefixedacctEmail=blah';
  const censoredUrl = CatchHelper.censoredUrl(url);
  const expectedCensoredUrl =
    'chrome://extension-id/pgp_block.htm?frameId=id&message=[SCRUBBED]&some=1&senderEmail=[SCRUBBED]&acctEmail=[SCRUBBED]&prefixedacctEmail=blah';
  if (censoredUrl !== expectedCensoredUrl) {
    throw new Error(`Error while scrubbing url parameters. expecting ${expectedCensoredUrl} but got ${censoredUrl}`);
  }
  return 'pass';
})();

BROWSER_UNIT_TEST_NAME(`Catcher does not include query string on report`);
(async () => {
  const formatted = Catch.formatExceptionForReport({ name: 'Error' });
  const expectedUrl = 'chrome-extension://extension-id/chrome/dev/ci_unit_test.htm';
  if (formatted.url.indexOf('?') !== -1) {
    const url = formatted.url.replace(/(\w{32})/, 'extension-id');
    throw new Error(`The reported URL where the error occurred should not include query strings. Expecting ${expectedUrl} but got ${url}.`);
  }
  return 'pass';
})();

BROWSER_UNIT_TEST_NAME(`Catcher reports correct URL for Gmail environment`);
(async () => {
  const originalEnv = Catch.RUNTIME_ENVIRONMENT;

  // https://github.com/FlowCrypt/flowcrypt-browser/issues/6128
  const sensitivePaths = [
    '/mail/u/0/#inbox/WhctKLbvMNLndrHSj',
    '/mail/u/0/#sent/KtbxLzFrMS',
    '/mail/u/1/#inbox/rtjXfHsNNgrJVZL',
    '/mail/u/1/#search/MSCGwzQrb',
  ];

  try {
    for (const path of sensitivePaths) {
      const fullUrl = 'https://mail.google.com' + path;

      // Simulate environment detection based on the URL
      const env = Catch.environment(fullUrl);
      Catch.RUNTIME_ENVIRONMENT = env;

      const formatted = Catch.formatExceptionForReport({ name: 'Error' });
      if (formatted.url !== 'https://mail.google.com/mail/') {
        throw new Error(`For path ${path}, expected URL to be 'https://mail.google.com/mail/' but got '${formatted.url}' (env: ${env})`);
      }
    }
  } finally {
    Catch.RUNTIME_ENVIRONMENT = originalEnv;
  }
  return 'pass';
})();