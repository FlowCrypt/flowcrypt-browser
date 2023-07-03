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

BROWSER_UNIT_TEST_NAME(`Xss.htmlSanitizeAndStripAllTags preserves leading tabs`);
(async () => {
  const html = '<pre>\tA\nB\tC<script>Script 1 \n 1</script>&amp; &quot; &#39; &lt;script&gt;Script \t 2 \n 2&lt;&#x2F;script&gt; \n \tD</pre>';
  const expectedText = `\tA\nB\tC& " ' <script>Script \t 2 \n 2</script> \n \tD`;
  {
    const text1 = Xss.htmlUnescape(Xss.htmlSanitizeAndStripAllTags(html, '\n', false));
    const expectedText1 = expectedText;
    if (text1 !== expectedText1) {
      throw Error(`With a single <pre> element expected "${expectedText1}" but got "${text1}" instead`);
    }
  }
  {
    // HTML wrapped in tabs
    const text2 = Xss.htmlUnescape(Xss.htmlSanitizeAndStripAllTags(`\t${html}\t`, '\n', false));
    const expectedText2 = `\t${expectedText}\t`;
    if (text2 !== expectedText2) {
      throw Error(`With a single <pre> element wrapped in tabs expected "${expectedText2}" but got "${text2}" instead`);
    }
  }
  return 'pass';
})();
