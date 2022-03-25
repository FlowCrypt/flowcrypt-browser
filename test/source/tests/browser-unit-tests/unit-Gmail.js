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

BROWSER_UNIT_TEST_NAME(`Gmail.extractArmoredBlock helps detect bogus PGP message`).acct(`compatibility`);
(async () => {
  const gmail = new Gmail('flowcrypt.compatibility@gmail.com');
  const extractedFull = await gmail.extractArmoredBlock('17d7a337b7b87eb9', 'full', undefined);
  if (extractedFull.plaintext !== '-----BEGIN PGP MESSAGE-----\r\n\r\nThis is not a valid PGP message\r\n') {
    throw Error(`extractedFull.plaintext unexpectedly equals ${extractedFull.plaintext}`);
  }
  const extractedRaw = await gmail.extractArmoredBlock('17d7a337b7b87eb9', 'raw', undefined);
  if (extractedRaw.plaintext !== '-----BEGIN PGP MESSAGE-----\n\nThis is not a valid PGP message\n') {
    throw Error(`extractedRaw.plaintext unexpectedly equals ${extractedRaw.plaintext}`);
  }
  return 'pass';
})();

BROWSER_UNIT_TEST_NAME(`Gmail.extractArmoredBlock detect inline bogus PGP message`).acct(`compatibility`);
(async () => {
  // original message - An OpenPGP message starts with this header: -----BEGIN PGP MESSAGE----- example
  const gmail = new Gmail('flowcrypt.compatibility@gmail.com');
  const extractedFull = await gmail.extractArmoredBlock('17fbb5f1cd2010ee', 'full', undefined);
  if (extractedFull.plaintext !== '-----BEGIN PGP MESSAGE-----\r\n\r\nexample\r\n') {
    throw Error(`extractedFull.plaintext unexpectedly equals ${extractedFull.plaintext}`);
  }
  const extractedRaw = await gmail.extractArmoredBlock('17fbb5f1cd2010ee', 'raw', undefined);
  console.log(encodeURIComponent(extractedRaw.plaintext));
  if (extractedRaw.plaintext !== '-----BEGIN PGP MESSAGE-----\n\nexample\n') {
    throw Error(`extractedRaw.plaintext unexpectedly equals ${extractedRaw.plaintext}`);
  }
  return 'pass';
})();