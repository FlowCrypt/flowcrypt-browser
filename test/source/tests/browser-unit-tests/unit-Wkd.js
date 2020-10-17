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

BROWSER_UNIT_TEST_NAME(`Wkd direct method`);
(async () => {
  const wkd = new Wkd('flowcrypt.com', 'http');
  wkd.port = 8001;
  let email;
  email = 'john.doe@127.0.0.1';
  if (!(await wkd.lookupEmail(email)).pubkey) {
    throw Error(`Wkd for ${email} didn't return a pubkey`);
  }
  email = 'John.Doe@127.0.0.1';
  if (!(await wkd.lookupEmail(email)).pubkey) {
    throw Error(`Wkd for ${email} didn't return a pubkey`);
  }
  return 'pass';
})();

BROWSER_UNIT_TEST_NAME(`Wkd advanced method`);
(async () => {
  const wkd = new Wkd('flowcrypt.com', 'http');
  wkd.port = 8001;
  let email;
  email = 'john.doe@localhost';
  if (!(await wkd.lookupEmail(email)).pubkey) {
    throw Error(`Wkd for ${email} didn't return a pubkey`);
  }
  email = 'John.Doe@localHOST';
  if (!(await wkd.lookupEmail(email)).pubkey) {
    throw Error(`Wkd for ${email} didn't return a pubkey`);
  }
  return 'pass';
})();

BROWSER_UNIT_TEST_NAME(`Wkd advanced shouldn't fall back on direct if advanced policy file is present`);
(async () => {
  const wkd = new Wkd('flowcrypt.com', 'http');
  wkd.port = 8001;
  const email = 'jack.advanced@localhost';
  if ((await wkd.lookupEmail(email)).pubkey) {
    throw Error(`Wkd for ${email} didn't expect a pubkey`);
  }
  return 'pass';
})();

BROWSER_UNIT_TEST_NAME(`Wkd incorrect UID should fail`);
(async () => {
  const wkd = new Wkd('flowcrypt.com', 'http');
  wkd.port = 8001;
  const email = 'incorrect@localhost';
  if ((await wkd.lookupEmail(email)).pubkey) {
    throw Error(`Wkd for ${email} didn't expect a pubkey`);
  }
  return 'pass';
})();

BROWSER_UNIT_TEST_NAME(`Wkd should extract key for test-wkd@metacode.biz`);
(async () => {
  const wkd = new Wkd('flowcrypt.com');
  const email = 'test-wkd@metacode.biz';
  if (!(await wkd.lookupEmail(email)).pubkey) {
    throw Error(`Wkd for ${email} didn't return a pubkey`);
  }
  return 'pass';
})();
