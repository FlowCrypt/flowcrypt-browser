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

BROWSER_UNIT_TEST_NAME(`Mime attachment file names`);
(async () => {
  // 1..31
  var filenames = [...Array(31).keys()].map(i => String.fromCharCode(i + 1));
  // 33..255
  filenames = filenames.concat([...Array(223).keys()].map(i => String.fromCharCode(i + 33)));
  // capital Cyrillic
  filenames.push('\u0401' + String.fromCharCode(...[...Array(32).keys()].map(i => i + 0x410)));
  const attachments = filenames.map(name => new Attachment({ name: name, type: 'text/plain', data: new Uint8Array([80, 81]) }));
  const encoded = await Mime.encode({ 'text/plain': 'text' }, { Subject: 'subject' }, attachments);
  const decoded = await Mime.decode(encoded);
  for (var i = 0; i < filenames.length; i++) {
    const originalName = filenames[i];
    const extractedAttachment = decoded.attachments[i];
    if (typeof extractedAttachment === 'undefined') {
      throw Error(`could not extract attachment at index ${i}`);
    }
    const extractedName = extractedAttachment.name;
    if (extractedName !== originalName) {
      throw Error(`extractedName unexpectedly ${extractedName}, expecting ${originalName}`);
    }
  }
  return 'pass';
})();

BROWSER_UNIT_TEST_NAME(`Mime attachment file name issue 3352`);
(async () => {
  const originalName = 'XX J 1 IT E (P 4) p_c.pdf';
  const attachments = [new Attachment({ name: originalName, type: 'text/plain', data: new Uint8Array([80, 81]) })];
  const encoded = await Mime.encode({ 'text/plain': 'text' }, { Subject: 'subject' }, attachments);
  const decoded = await Mime.decode(encoded);
  if (decoded.attachments.length !== 1) {
    throw Error(`Decoded MIME message has unexpectedly ${decoded.attachments.length} attachments, expecting 1`);
  }
  const index = 0;
  const extractedAttachment = decoded.attachments[index];
  if (typeof extractedAttachment === 'undefined') {
    throw Error(`could not extract attachment at index ${index}`);
  }
  const extractedName = extractedAttachment.name;
  if (extractedName !== originalName) {
    throw Error(`extractedName unexpectedly ${extractedName}, expecting ${originalName}`);
  }
  return 'pass';
})();
