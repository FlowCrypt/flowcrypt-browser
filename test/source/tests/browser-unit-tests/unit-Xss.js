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
  const expectedPreText = `\tA\nB\tC& " ' <script>Script \t 2 \n 2</script> \n \tD`;
  {
    const text1 = Xss.htmlUnescape(Xss.htmlSanitizeAndStripAllTags(html, '\n', false));
    const expectedText1 = expectedPreText;
    if (text1 !== expectedText1) {
      throw Error(`With a single <pre> element expected "${expectedText1}" but got "${text1}" instead`);
    }
  }
  {
    // PRE wrapped in tabs
    const text2 = Xss.htmlUnescape(Xss.htmlSanitizeAndStripAllTags(`\t${html}\t`, '\n', false));
    const expectedText2 = `\t\n${expectedPreText}\n\t`; // a text preceding or following a tag also adds \n in place of the tag
    if (text2 !== expectedText2) {
      throw Error(`With a <pre> element wrapped in tabs expected "${expectedText2}" but got "${text2}" instead`);
    }
  }
  {
    // tabs and <br>
    const text3 = Xss.htmlUnescape(Xss.htmlSanitizeAndStripAllTags('\tline 1<br>\t\tline 2', '\n', false));
    const expectedText3 = '\tline 1\n\t\tline 2'; // preserve tabs and replace <br> with \n
    if (text3 !== expectedText3) {
      throw Error(`With tabs and <br> expected "${expectedText3}" but got "${text3}" instead`);
    }
  }
  return 'pass';
})();

BROWSER_UNIT_TEST_NAME(`Xss.htmlSanitizeKeepBasicTags strips image-set() CSS tracking`);
(async () => {
  const dirty = `<div style="background-image: image-set(&quot;https://attacker.example/track.png&quot; 1x)">message body</div>`;
  const clean = Xss.htmlSanitizeKeepBasicTags(dirty, 'IMG-KEEP');
  if (/image-set/i.test(clean)) {
    throw Error(`image-set() was not stripped from sanitized HTML: ${clean}`);
  }
  return 'pass';
})();

BROWSER_UNIT_TEST_NAME(`Xss.htmlSanitizeKeepBasicTags strips -webkit-image-set() CSS tracking`);
(async () => {
  const dirty = `<div style="background-image: -webkit-image-set(url(&quot;https://attacker.example/track.png&quot;) 1x)">message body</div>`;
  const clean = Xss.htmlSanitizeKeepBasicTags(dirty, 'IMG-KEEP');
  if (/-webkit-image-set/i.test(clean)) {
    throw Error(`-webkit-image-set() was not stripped from sanitized HTML: ${clean}`);
  }
  return 'pass';
})();

BROWSER_UNIT_TEST_NAME(`Xss.htmlSanitizeKeepBasicTags strips url() in CSS`);
(async () => {
  const dirty = `<div style="background-image: url('https://attacker.example/track.png')">message body</div>`;
  const clean = Xss.htmlSanitizeKeepBasicTags(dirty, 'IMG-KEEP');
  if (/url\(/i.test(clean)) {
    throw Error(`url() was not stripped from sanitized HTML: ${clean}`);
  }
  return 'pass';
})();

BROWSER_UNIT_TEST_NAME(`Xss.htmlSanitizeKeepBasicTags sends remote srcset on cid image to consent flow (IMG-KEEP)`);
(async () => {
  const dirty = `<img src="cid:known-cid" srcset="https://attacker.example/track.png 1x">message body`;
  const clean = Xss.htmlSanitizeKeepBasicTags(dirty, 'IMG-KEEP');
  const doc = new DOMParser().parseFromString(clean, 'text/html');
  const imgs = Array.from(doc.querySelectorAll('img'));
  for (const img of imgs) {
    if (/^https?:/i.test(img.getAttribute('src') || '') || /^https?:/i.test(img.getAttribute('srcset') || '')) {
      throw Error(`remote-loading img survived sanitization: ${clean}`);
    }
  }
  const containers = doc.querySelectorAll('.remote_image_container');
  if (containers.length !== 1) {
    throw Error(`expected exactly one remote_image_container placeholder but got ${clean}`);
  }
  if (containers[0].getAttribute('data-src') !== 'https://attacker.example/track.png') {
    throw Error(`unexpected data-src "${containers[0].getAttribute('data-src')}" in ${clean}`);
  }
  return 'pass';
})();

BROWSER_UNIT_TEST_NAME(`Xss.htmlSanitizeKeepBasicTags sends multi-candidate remote srcset to consent flow (IMG-KEEP)`);
(async () => {
  const dirty = `<img src="cid:known-cid" srcset="cid:known-cid 1x, https://attacker.example/track.png 2x, https://attacker.example/track2.png 640w">message body`;
  const clean = Xss.htmlSanitizeKeepBasicTags(dirty, 'IMG-KEEP');
  const doc = new DOMParser().parseFromString(clean, 'text/html');
  for (const img of Array.from(doc.querySelectorAll('img'))) {
    if (/^https?:/i.test(img.getAttribute('src') || '') || /^https?:/i.test(img.getAttribute('srcset') || '')) {
      throw Error(`remote-loading img survived sanitization: ${clean}`);
    }
  }
  const containers = doc.querySelectorAll('.remote_image_container');
  if (containers.length !== 1) {
    throw Error(`expected exactly one remote_image_container placeholder but got ${clean}`);
  }
  return 'pass';
})();

BROWSER_UNIT_TEST_NAME(`Xss.htmlSanitizeKeepBasicTags sends srcset-only remote image to consent flow (IMG-KEEP)`);
(async () => {
  const dirty = `<img srcset="https://attacker.example/track.png 1x, https://attacker.example/track2.png 2x">message body`;
  const clean = Xss.htmlSanitizeKeepBasicTags(dirty, 'IMG-KEEP');
  const doc = new DOMParser().parseFromString(clean, 'text/html');
  for (const img of Array.from(doc.querySelectorAll('img'))) {
    if (/^https?:/i.test(img.getAttribute('src') || '') || /^https?:/i.test(img.getAttribute('srcset') || '')) {
      throw Error(`remote-loading img survived sanitization: ${clean}`);
    }
  }
  const containers = doc.querySelectorAll('.remote_image_container');
  if (containers.length !== 1) {
    throw Error(`expected exactly one remote_image_container placeholder but got ${clean}`);
  }
  return 'pass';
})();

BROWSER_UNIT_TEST_NAME(`Xss.htmlSanitizeKeepBasicTags sends protocol-relative remote src to consent flow (IMG-KEEP)`);
(async () => {
  const dirty = `<img src="//attacker.example/track.png">message body`;
  const clean = Xss.htmlSanitizeKeepBasicTags(dirty, 'IMG-KEEP');
  const doc = new DOMParser().parseFromString(clean, 'text/html');
  for (const img of Array.from(doc.querySelectorAll('img'))) {
    if (img.getAttribute('src') || img.getAttribute('srcset')) {
      throw Error(`remote-loading img survived sanitization: ${clean}`);
    }
  }
  const containers = doc.querySelectorAll('.remote_image_container');
  if (containers.length !== 1) {
    throw Error(`expected exactly one remote_image_container placeholder but got ${clean}`);
  }
  return 'pass';
})();

BROWSER_UNIT_TEST_NAME(`Xss.htmlSanitizeKeepBasicTags keeps local data srcset images untouched (IMG-KEEP)`);
(async () => {
  const dirty = `<img src="data:image/png;base64,AAAA" srcset="data:image/png;base64,AAAA 1x, data:image/png;base64,BBBB 2x">message body`;
  const clean = Xss.htmlSanitizeKeepBasicTags(dirty, 'IMG-KEEP');
  const doc = new DOMParser().parseFromString(clean, 'text/html');
  const containers = doc.querySelectorAll('.remote_image_container');
  if (containers.length !== 0) {
    throw Error(`local image unexpectedly converted to a placeholder: ${clean}`);
  }
  const imgs = Array.from(doc.querySelectorAll('img'));
  if (imgs.length !== 1) {
    throw Error(`expected the local image to be preserved: ${clean}`);
  }
  if (!imgs[0].getAttribute('srcset')) {
    throw Error(`local srcset was dropped although it is not remote: ${clean}`);
  }
  return 'pass';
})();

BROWSER_UNIT_TEST_NAME(`Xss.htmlSanitizeAndStripAllTags leaks no remote srcset URL into text (IMG-TO-PLAIN-TEXT)`);
(async () => {
  const dirty = `<img src="cid:known-cid" srcset="https://attacker.example/track.png 1x">message body`;
  const text = Xss.htmlUnescape(Xss.htmlSanitizeAndStripAllTags(dirty, '\n', false));
  if (text.includes('https://attacker.example') || text.includes('srcset')) {
    throw Error(`remote srcset URL leaked into plain text: ${text}`);
  }
  return 'pass';
})();
