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
 * To run only one test (remove before pushing to git):
 *  - BROWSER_UNIT_TEST_NAME(`some test name`).only;
 *  - BROWSER_UNIT_TEST_NAME(`some test name`).enterprise.only;
 *  - BROWSER_UNIT_TEST_NAME(`some test name`).consumer.only;
 * 
 * This is not a JavaScript file. It's a text file that gets parsed, split into chunks, and
 *    parts of it executed as javascript. The structure is very rigid. The only flexible place is inside
 *    the async functions. For the rest, do not change the structure or our parser will get confused.
 *    Do not put any code whatsoever outside of the async functions.
 */

BROWSER_UNIT_TEST_NAME(`test@nowhere.com throws when server cannot be reached`).enterprise;
(async () => {
  const wellKnownHostMeta = new WellKnownHostMeta('test@nowhere.com');
  try {
    await wellKnownHostMeta.fetchAndCacheFesUrl();
  } catch (e) {
    if (ApiErr.isNetErr(e)) {
      return 'pass'; // enterprise does not tolerate a net err - since it may simply mean offline
    }
    throw e;
  }
})();

BROWSER_UNIT_TEST_NAME(`test@nowhere.com does not return any fesUrl`).consumer;
(async () => {
  const wellKnownHostMeta = new WellKnownHostMeta('test@nowhere.com');
  const fesUrl = await wellKnownHostMeta.fetchAndCacheFesUrl();
  if (typeof fesUrl !== 'undefined') {
    throw Error(`fesUrl unexpectedly ${fesUrl}, expecting undefined`);
  }
  return 'pass'; // consumer tolerates a net err because the server may not be set up
})();

BROWSER_UNIT_TEST_NAME(`status404 does not return any fesUrl`);
(async () => {
  const mockHost = 'localhost:8001';
  const wellKnownHostMeta = new WellKnownHostMeta(`status404@${mockHost}`);
  const fesUrl = await wellKnownHostMeta.fetchAndCacheFesUrl();
  if (typeof fesUrl !== 'undefined') {
    throw Error(`fesUrl unexpectedly ${fesUrl}, expecting undefined`);
  }
  return 'pass'; // consumer tolerates a net err because the server may not be set up
})();

BROWSER_UNIT_TEST_NAME(`status500 throws when server cannot be reached`).enterprise;
(async () => {
  const mockHost = 'localhost:8001';
  const wellKnownHostMeta = new WellKnownHostMeta(`status500@${mockHost}`);
  try {
    await wellKnownHostMeta.fetchAndCacheFesUrl();
  } catch (e) {
    if (ApiErr.isServerErr(e)) {
      return 'pass'; // enterprise does not tolerate a server err - since it may simply mean offline
    }
    throw e;
  }
})();

BROWSER_UNIT_TEST_NAME(`status500 does not return any fesUrl`).consumer;
(async () => {
  const mockHost = 'localhost:8001';
  const wellKnownHostMeta = new WellKnownHostMeta(`status500@${mockHost}`);
  const fesUrl = await wellKnownHostMeta.fetchAndCacheFesUrl();
  if (typeof fesUrl !== 'undefined') {
    throw Error(`fesUrl unexpectedly ${fesUrl}, expecting undefined`);
  }
  return 'pass'; // consumer tolerates a net err because the server may not be expecting to serve these
})();

BROWSER_UNIT_TEST_NAME(`not.json throws when response not a json`).enterprise;
(async () => {
  const mockHost = 'localhost:8001';
  const wellKnownHostMeta = new WellKnownHostMeta(`not.json@${mockHost}`);
  try {
    await wellKnownHostMeta.fetchAndCacheFesUrl();
  } catch (e) {
    if (e.message.includes('Enterprise host meta file at https://localhost:8001/.well-known/host-meta.json?local=not.json has wrong format::SyntaxError: Unexpected token < in JSON')) {
      return 'pass'; // enterprise does not tolerate a server wrong response
    }
    throw e;
  }
})();

BROWSER_UNIT_TEST_NAME(`not.json does not return any fesUrl`).consumer;
(async () => {
  const mockHost = 'localhost:8001';
  const wellKnownHostMeta = new WellKnownHostMeta(`not.json@${mockHost}`);
  const fesUrl = await wellKnownHostMeta.fetchAndCacheFesUrl();
  if (typeof fesUrl !== 'undefined') {
    throw Error(`fesUrl unexpectedly ${fesUrl}, expecting undefined`);
  }
  return 'pass'; // consumer tolerates a format err because the server may not be expecting to serve these
})();

BROWSER_UNIT_TEST_NAME(`wrong.format when json has wrong structure`).enterprise;
(async () => {
  const mockHost = 'localhost:8001';
  const wellKnownHostMeta = new WellKnownHostMeta(`wrong.format@${mockHost}`);
  try {
    await wellKnownHostMeta.fetchAndCacheFesUrl();
  } catch (e) {
    if (e.message === 'Enterprise host meta file at https://localhost:8001/.well-known/host-meta.json?local=wrong.format has wrong format::Error: unexpected json structure') {
      return 'pass'; // enterprise does not tolerate a server err - since it may simply mean offline
    }
    throw e;
  }
})();

BROWSER_UNIT_TEST_NAME(`wrong.format does not return any fesUrl`).consumer;
(async () => {
  const mockHost = 'localhost:8001';
  const wellKnownHostMeta = new WellKnownHostMeta(`wrong.format@${mockHost}`);
  const fesUrl = await wellKnownHostMeta.fetchAndCacheFesUrl();
  if (typeof fesUrl !== 'undefined') {
    throw Error(`fesUrl unexpectedly ${fesUrl}, expecting undefined`);
  }
  return 'pass'; // consumer tolerates a format err because the server may not be expecting to serve these
})();

BROWSER_UNIT_TEST_NAME(`no.fes.rel does not return any fesUrl`);
(async () => {
  const mockHost = 'localhost:8001';
  const wellKnownHostMeta = new WellKnownHostMeta(`no.fes.rel@${mockHost}`);
  const fesUrl = await wellKnownHostMeta.fetchAndCacheFesUrl();
  if (typeof fesUrl !== 'undefined') {
    throw Error(`fesUrl unexpectedly ${fesUrl}, expecting undefined`);
  }
  return 'pass'; // consumer tolerates a format err because the server may not be expecting to serve these
})();

BROWSER_UNIT_TEST_NAME(`has.fes.rel returns fesUrl`);
(async () => {
  const mockHost = 'localhost:8001';
  const expecting = 'https://targer.customer.com/fes/';
  const wellKnownHostMeta = new WellKnownHostMeta(`has.fes.rel@${mockHost}`);
  const fesUrl = await wellKnownHostMeta.fetchAndCacheFesUrl();
  if (fesUrl === expecting) {
    return 'pass';
  }
  throw Error(`fesUrl unexpectedly ${fesUrl}, expecting ${expecting}`);
})();

BROWSER_UNIT_TEST_NAME(`empty200 should be an error`).enterprise;
(async () => {
  const mockHost = 'localhost:8001';
  const wellKnownHostMeta = new WellKnownHostMeta(`empty200@${mockHost}`);
  try {
    await wellKnownHostMeta.fetchAndCacheFesUrl();
  } catch (e) {
    if (e.message === 'Enterprise host meta url https://localhost:8001/.well-known/host-meta.json?local=empty200 returned empty 200 response') {
      return 'pass'; // enterprise does not tolerate a server err - since it may simply mean offline
    }
    throw e;
  }
})();

BROWSER_UNIT_TEST_NAME(`empty200 ignored`).consumer;
(async () => {
  const mockHost = 'localhost:8001';
  const wellKnownHostMeta = new WellKnownHostMeta(`empty200@${mockHost}`);
  const fesUrl = await wellKnownHostMeta.fetchAndCacheFesUrl();
  if (typeof fesUrl !== 'undefined') {
    throw Error(`fesUrl unexpectedly ${fesUrl}, expecting undefined`);
  }
  return 'pass'; // consumer tolerates a format err because the server may not be expecting to serve these
})();

BROWSER_UNIT_TEST_NAME(`get empty cache, then fetch ok, then get filled cache`);
(async () => {
  const mockHost = 'localhost:8001';
  const expecting = 'https://targer.customer.com/fes/';
  const wellKnownHostMeta = new WellKnownHostMeta(`has.fes.rel@${mockHost}`);
  const fesUrlFromCache = await wellKnownHostMeta.getFesUrlFromCache();
  if (typeof fesUrlFromCache !== 'undefined') {
    throw Error(`fesUrlFromCache unexpectedly ${fesUrl}, expecting undefined`);
  }
  const fesUrl = await wellKnownHostMeta.fetchAndCacheFesUrl();
  if (fesUrl !== expecting) {
    throw Error(`fesUrl unexpectedly ${fesUrl}, expecting ${expecting}`);
  }
  const fesUrlFromCacheAgain = await wellKnownHostMeta.fetchAndCacheFesUrl();
  if (fesUrlFromCacheAgain !== expecting) {
    throw Error(`fesUrlFromCacheAgain unexpectedly ${fesUrlFromCacheAgain}, expecting ${expecting}`);
  }
  return 'pass'; // consumer tolerates a format err because the server may not be expecting to serve these
})();

BROWSER_UNIT_TEST_NAME(`get empty cache, then fetch none, then get empty cache`);
(async () => {
  const mockHost = 'localhost:8001';
  const wellKnownHostMeta = new WellKnownHostMeta(`no.fes.rel@${mockHost}`);
  const fesUrlFromCache = await wellKnownHostMeta.getFesUrlFromCache();
  if (typeof fesUrlFromCache !== 'undefined') {
    throw Error(`fesUrlFromCache unexpectedly ${fesUrl}, expecting undefined`);
  }
  const fesUrl = await wellKnownHostMeta.fetchAndCacheFesUrl();
  if (typeof fesUrl !== 'undefined') {
    throw Error(`fesUrl unexpectedly ${fesUrl}, expecting undefined`);
  }
  const fesUrlFromCacheAgain = await wellKnownHostMeta.fetchAndCacheFesUrl();
  if (typeof fesUrlFromCacheAgain !== 'undefined') {
    throw Error(`fesUrlFromCacheAgain unexpectedly ${fesUrlFromCacheAgain}, expecting undefined`);
  }
  return 'pass'; // consumer tolerates a format err because the server may not be expecting to serve these
})();
