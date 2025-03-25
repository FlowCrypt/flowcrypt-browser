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

BROWSER_UNIT_TEST_NAME(`Sks lookup pubkey - trailing slash`);
(async () => {
  const email = 'john.doe@example.com';
  const sks = new Sks(`https://localhost:${MOCK_PORT}/`);
  const { pubkey } = await sks.lookupEmail(email);
  const key = await KeyUtil.parse(pubkey);
  if (key.id !== '094C3CBA696FA009F6015C473B635D858A1DB5E0') {
    throw Error(`Expecting key.id=094C3CBA696FA009F6015C473B635D858A1DB5E0 but got ${key.id}`);
  }
  return 'pass';
})();

BROWSER_UNIT_TEST_NAME(`Sks lookup pubkey - no trailing slash`);
(async () => {
  const email = 'john.doe@example.com';
  const sks = new Sks(`https://localhost:${MOCK_PORT}`);
  const { pubkey } = await sks.lookupEmail(email);
  const key = await KeyUtil.parse(pubkey);
  if (key.id !== '094C3CBA696FA009F6015C473B635D858A1DB5E0') {
    throw Error(`Expecting key.id=094C3CBA696FA009F6015C473B635D858A1DB5E0 but got ${key.id}`);
  }
  return 'pass';
})();

BROWSER_UNIT_TEST_NAME(`Sks lookup pubkey - server down`);
(async () => {
  const email = 'john.doe@example.com';
  const sks = new Sks('https://localhost:3456');
  try {
    await sks.lookupEmail(email);
  } catch (e) {
    if (ApiErr.isNetErr(e)) {
      return 'pass';
    }
    throw e;
  }
  throw new Error('Lookup wrongly didnt throw');
})();

BROWSER_UNIT_TEST_NAME(`Sks lookup pubkey - not found`);
(async () => {
  const email = 'nobody@example.com';
  const sks = new Sks(`https://localhost:${MOCK_PORT}/`);
  const { pubkey } = await sks.lookupEmail(email);
  if (pubkey !== null) {
    throw Error(`expected pubkey=null but got ${pubkey}`);
  }
  return 'pass';
})();
