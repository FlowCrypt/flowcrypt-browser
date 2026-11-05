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

BROWSER_UNIT_TEST_NAME(`[unit][Gmail.attachmentGetChunk] decodes a response split between Base64 padding characters`);
(async () => {
  const { GoogleOAuth } = await import('/js/common/api/authentication/google/google-oauth.js');
  const originalGoogleApiAuthHeader = GoogleOAuth.googleApiAuthHeader;
  const originalFetch = window.fetch;
  const attachment = new Uint8Array(1000);
  const encodedAttachment = Buf.fromUint8(attachment).toBase64Str();
  const response = JSON.stringify({ size: attachment.length, data: encodedAttachment });
  const responseThroughFirstPaddingCharacter = response.slice(0, response.lastIndexOf('='));

  try {
    GoogleOAuth.googleApiAuthHeader = async () => ({ authorization: 'Bearer test' });
    window.fetch = async () => new Response(responseThroughFirstPaddingCharacter);
    const decoded = await new Gmail('test@example.com').attachmentGetChunk('message', 'attachment', 'attachment');
    if (decoded.length !== attachment.length || decoded.some((byte, index) => byte !== attachment[index])) {
      throw Error('Decoded attachment chunk does not match the attachment');
    }
  } finally {
    GoogleOAuth.googleApiAuthHeader = originalGoogleApiAuthHeader;
    window.fetch = originalFetch;
  }
  return 'pass';
})();
