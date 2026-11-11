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

BROWSER_UNIT_TEST_NAME(`Wkd direct method when advanced policy is absent`);
(async () => {
  const wkd = new Wkd();
  for (const email of ['john.doe@example.com', 'John.Doe@example.com', 'John.Doe@EXAMPLE.com']) {
    const { pubkeys } = await wkd.lookupEmail(email);
    if (pubkeys.length !== 1 || (await KeyUtil.parse(pubkeys[0])).id.toUpperCase() !== '094C3CBA696FA009F6015C473B635D858A1DB5E0') {
      throw Error(`Wkd for ${email} didn't return the expected direct pubkey`);
    }
  }
  return 'pass';
})();

BROWSER_UNIT_TEST_NAME(`Wkd advanced method`);
(async () => {
  const wkd = new Wkd();
  for (const email of ['john.doe@localhost', 'John.Doe@localhost', 'John.Doe@localHOST']) {
    const { pubkeys } = await wkd.lookupEmail(email);
    if (pubkeys.length !== 1 || (await KeyUtil.parse(pubkeys[0])).id.toUpperCase() !== 'CB1B7A41BA7C1CBAA08A6166B902CB65C694D6B4') {
      throw Error(`Wkd for ${email} didn't return the expected advanced pubkey`);
    }
  }
  return 'pass';
})();

BROWSER_UNIT_TEST_NAME(`Wkd client returns all keys`);
(async () => {
  const wkd = new Wkd();
  const email = 'some.revoked@localhost';
  const pubkeys = (await wkd.lookupEmail(email)).pubkeys;
  if (!pubkeys.length) {
    throw Error(`Wkd for ${email} didn't return a pubkey`);
  }
  const ids = (await Promise.all(pubkeys.map(async pubkey => await KeyUtil.parse(pubkey)))).map(key => key.id.toUpperCase());
  if (
    ids.length === 3 &&
    ids.includes('D6662C5FB9BDE9DA01F3994AAA1EF832D8CCA4F2') &&
    ids.includes('A5CFC8E8EA4AE69989FE2631097EEBF354259A5E') &&
    ids.includes('3930752556D57C46A1C56B63DE8538DDA1648C76')
  ) {
    return 'pass';
  } else {
    return "Expected keys weren't received";
  }
})();

BROWSER_UNIT_TEST_NAME(`Wkd advanced shouldn't fall back on direct if advanced policy file is present`);
(async () => {
  const wkd = new Wkd();
  const email = 'jack.advanced@localhost';
  if ((await wkd.lookupEmail(email)).pubkeys.length) {
    throw Error(`Wkd for ${email} didn't expect a pubkey`);
  }
  return 'pass';
})();

BROWSER_UNIT_TEST_NAME(`Wkd incorrect UID should fail`);
(async () => {
  const wkd = new Wkd();
  const email = 'incorrect@localhost';
  if ((await wkd.lookupEmail(email)).pubkeys.length) {
    throw Error(`Wkd for ${email} didn't expect a pubkey`);
  }
  return 'pass';
})();
