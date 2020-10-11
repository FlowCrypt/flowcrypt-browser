/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

const { FLAVOR } = require('../../core/const');

/**
 * This test uses JavaScript instead of TypeScript to avoid dealing with types in this cross-environment setup.
 * (tests are injected from NodeJS through puppeteer into a browser environment)
 * While this makes them less convenient to write, the result is more flexible.
 * 
 * Import your lib to `ci_unit_test.ts` to resolve `ReferenceError: SomeClass is not defined`
 * 
 * Each test must return "pass" to pass. To reject, throw an exception.
 * 
 * Each test must start with: BROWSER_UNIT_TEST_NAME(`some test name`);
 * 
 * This is not really a JavaScript file. It's a text file that gets parsed, split into chunks, and
 *    parts of it executed as javascript. The structure is very rigid. The only flexible place is inside
 *    the async functions. For the rest, do not change the structure or our parser will get confused.
 *    Do not put any code whatsoever outside of the async functions.
 */

BROWSER_UNIT_TEST_NAME(`test@nowhere.com does not return any fesUrl`);
(async () => {
  const wellKnownHostMeta = new WellKnownHostMeta('test@nowhere.com');
  if (FLAVOR === 'consumer') {
    const fesUrl = await wellKnownHostMeta.fetchAndCacheFesUrl();
    if (typeof fesUrl !== 'undefined') {
      throw Error(`fesUrl unexpectedly ${fesUrl}, expecting undefined`);
    }
    return 'pass'; // consumer tolerates a net err because the server may not be set up
  } else { // enterprise
    try {
      await wellKnownHostMeta.fetchAndCacheFesUrl();
    } catch (e) {
      if (ApiErr.isNetErr(e)) {
        return 'pass'; // enterprise does not tolerate a net err - since it may simply mean offline
      }
      throw e;
    }
  }
})();
