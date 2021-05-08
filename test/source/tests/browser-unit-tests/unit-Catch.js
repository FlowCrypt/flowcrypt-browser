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
  if (Catch.report("testing report") !== false) {
    throw new Error('Wrongly submitted Catch.report');
  }
  if (Catch.reportErr("testing reportErr") !== false) {
    throw new Error('Wrongly submitted Catch.reportErr');
  }
  if (Catch.onErrorInternalHandler("testing onErrorInternalHandler", 'url', 1, 1, Error('test')) !== false) {
    throw new Error('Wrongly submitted Catch.onErrorInternalHandler');
  }
  return "pass";
})();


BROWSER_UNIT_TEST_NAME(`Catcher does report on consumer`).consumer;
(async () => {
  if (Catch.report("testing report") !== true) {
    throw new Error('Wrongly didnt submit Catch.report');
  }
  if (Catch.reportErr("testing reportErr") !== true) {
    throw new Error('Wrongly didnt submit Catch.reportErr');
  }
  if (Catch.onErrorInternalHandler("testing onErrorInternalHandler", 'url', 1, 1, Error('test')) !== true) {
    throw new Error('Wrongly didnt submit Catch.onErrorInternalHandler');
  }
  return "pass";
})();
