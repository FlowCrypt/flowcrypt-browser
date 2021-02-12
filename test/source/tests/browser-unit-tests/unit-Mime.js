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
  const expectedEncodedFilenames = [
    // 1..31
    "filename*0*=utf-8''%01",
    "filename*0*=utf-8''%02",
    "filename*0*=utf-8''%03",
    "filename*0*=utf-8''%04",
    "filename*0*=utf-8''%05",
    "filename*0*=utf-8''%06",
    "filename*0*=utf-8''%07",
    "filename*0*=utf-8''%08",
    "filename*0*=utf-8''%09",
    "filename*0*=utf-8''%0A",
    "filename*0*=utf-8''%0B",
    "filename*0*=utf-8''%0C",
    "filename*0*=utf-8''%0D",
    "filename*0*=utf-8''%0E",
    "filename*0*=utf-8''%0F",
    "filename*0*=utf-8''%10",
    "filename*0*=utf-8''%11",
    "filename*0*=utf-8''%12",
    "filename*0*=utf-8''%13",
    "filename*0*=utf-8''%14",
    "filename*0*=utf-8''%15",
    "filename*0*=utf-8''%16",
    "filename*0*=utf-8''%17",
    "filename*0*=utf-8''%18",
    "filename*0*=utf-8''%19",
    "filename*0*=utf-8''%1A",
    "filename*0*=utf-8''%1B",
    "filename*0*=utf-8''%1C",
    "filename*0*=utf-8''%1D",
    "filename*0*=utf-8''%1E",
    "filename*0*=utf-8''%1F",
    // 33..127 
    "filename*0*=utf-8''!",
    "filename*0*=utf-8''%22",
    "filename*0*=utf-8''%23",
    "filename*0*=utf-8''%24",
    "filename*0*=utf-8''%25",
    "filename*0*=utf-8''%26",
    "filename*0*=utf-8'''",
    "filename*0*=utf-8''%28",
    "filename*0*=utf-8''%29",
    "filename*0*=utf-8''*",
    "filename*0*=utf-8''%2B",
    "filename*0*=utf-8''%2C",
    "filename=-",
    "filename=.",
    "filename*0*=utf-8''%2F",
    "filename=0",
    "filename=1",
    "filename=2",
    "filename=3",
    "filename=4",
    "filename=5",
    "filename=6",
    "filename=7",
    "filename=8",
    "filename=9",
    "filename*0*=utf-8''%3A",
    "filename*0*=utf-8''%3B",
    "filename*0*=utf-8''%3C",
    "filename*0*=utf-8''%3D",
    "filename*0*=utf-8''%3E",
    "filename*0*=utf-8''%3F",
    "filename*0*=utf-8''%40",
    "filename=A",
    "filename=B",
    "filename=C",
    "filename=D",
    "filename=E",
    "filename=F",
    "filename=G",
    "filename=H",
    "filename=I",
    "filename=J",
    "filename=K",
    "filename=L",
    "filename=M",
    "filename=N",
    "filename=O",
    "filename=P",
    "filename=Q",
    "filename=R",
    "filename=S",
    "filename=T",
    "filename=U",
    "filename=V",
    "filename=W",
    "filename=X",
    "filename=Y",
    "filename=Z",
    "filename*0*=utf-8''%5B",
    "filename*0*=utf-8''%5C",
    "filename*0*=utf-8''%5D",
    "filename*0*=utf-8''%5E",
    "filename=_",
    "filename*0*=utf-8''%60",
    "filename=a",
    "filename=b",
    "filename=c",
    "filename=d",
    "filename=e",
    "filename=f",
    "filename=g",
    "filename=h",
    "filename=i",
    "filename=j",
    "filename=k",
    "filename=l",
    "filename=m",
    "filename=n",
    "filename=o",
    "filename=p",
    "filename=q",
    "filename=r",
    "filename=s",
    "filename=t",
    "filename=u",
    "filename=v",
    "filename=w",
    "filename=x",
    "filename=y",
    "filename=z",
    "filename*0*=utf-8''%7B",
    "filename*0*=utf-8''%7C",
    "filename*0*=utf-8''%7D",
    "filename*0*=utf-8''~",
    "filename*0*=utf-8''%7F",
    // 128..255
    "filename*0*=utf-8''%C2%80",
    "filename*0*=utf-8''%C2%81",
    "filename*0*=utf-8''%C2%82",
    "filename*0*=utf-8''%C2%83",
    "filename*0*=utf-8''%C2%84",
    "filename*0*=utf-8''%C2%85",
    "filename*0*=utf-8''%C2%86",
    "filename*0*=utf-8''%C2%87",
    "filename*0*=utf-8''%C2%88",
    "filename*0*=utf-8''%C2%89",
    "filename*0*=utf-8''%C2%8A",
    "filename*0*=utf-8''%C2%8B",
    "filename*0*=utf-8''%C2%8C",
    "filename*0*=utf-8''%C2%8D",
    "filename*0*=utf-8''%C2%8E",
    "filename*0*=utf-8''%C2%8F",
    "filename*0*=utf-8''%C2%90",
    "filename*0*=utf-8''%C2%91",
    "filename*0*=utf-8''%C2%92",
    "filename*0*=utf-8''%C2%93",
    "filename*0*=utf-8''%C2%94",
    "filename*0*=utf-8''%C2%95",
    "filename*0*=utf-8''%C2%96",
    "filename*0*=utf-8''%C2%97",
    "filename*0*=utf-8''%C2%98",
    "filename*0*=utf-8''%C2%99",
    "filename*0*=utf-8''%C2%9A",
    "filename*0*=utf-8''%C2%9B",
    "filename*0*=utf-8''%C2%9C",
    "filename*0*=utf-8''%C2%9D",
    "filename*0*=utf-8''%C2%9E",
    "filename*0*=utf-8''%C2%9F",
    "filename*0*=utf-8''%C2%A0",
    "filename*0*=utf-8''%C2%A1",
    "filename*0*=utf-8''%C2%A2",
    "filename*0*=utf-8''%C2%A3",
    "filename*0*=utf-8''%C2%A4",
    "filename*0*=utf-8''%C2%A5",
    "filename*0*=utf-8''%C2%A6",
    "filename*0*=utf-8''%C2%A7",
    "filename*0*=utf-8''%C2%A8",
    "filename*0*=utf-8''%C2%A9",
    "filename*0*=utf-8''%C2%AA",
    "filename*0*=utf-8''%C2%AB",
    "filename*0*=utf-8''%C2%AC",
    "filename*0*=utf-8''%C2%AD",
    "filename*0*=utf-8''%C2%AE",
    "filename*0*=utf-8''%C2%AF",
    "filename*0*=utf-8''%C2%B0",
    "filename*0*=utf-8''%C2%B1",
    "filename*0*=utf-8''%C2%B2",
    "filename*0*=utf-8''%C2%B3",
    "filename*0*=utf-8''%C2%B4",
    "filename*0*=utf-8''%C2%B5",
    "filename*0*=utf-8''%C2%B6",
    "filename*0*=utf-8''%C2%B7",
    "filename*0*=utf-8''%C2%B8",
    "filename*0*=utf-8''%C2%B9",
    "filename*0*=utf-8''%C2%BA",
    "filename*0*=utf-8''%C2%BB",
    "filename*0*=utf-8''%C2%BC",
    "filename*0*=utf-8''%C2%BD",
    "filename*0*=utf-8''%C2%BE",
    "filename*0*=utf-8''%C2%BF",
    "filename*0*=utf-8''%C3%80",
    "filename*0*=utf-8''%C3%81",
    "filename*0*=utf-8''%C3%82",
    "filename*0*=utf-8''%C3%83",
    "filename*0*=utf-8''%C3%84",
    "filename*0*=utf-8''%C3%85",
    "filename*0*=utf-8''%C3%86",
    "filename*0*=utf-8''%C3%87",
    "filename*0*=utf-8''%C3%88",
    "filename*0*=utf-8''%C3%89",
    "filename*0*=utf-8''%C3%8A",
    "filename*0*=utf-8''%C3%8B",
    "filename*0*=utf-8''%C3%8C",
    "filename*0*=utf-8''%C3%8D",
    "filename*0*=utf-8''%C3%8E",
    "filename*0*=utf-8''%C3%8F",
    "filename*0*=utf-8''%C3%90",
    "filename*0*=utf-8''%C3%91",
    "filename*0*=utf-8''%C3%92",
    "filename*0*=utf-8''%C3%93",
    "filename*0*=utf-8''%C3%94",
    "filename*0*=utf-8''%C3%95",
    "filename*0*=utf-8''%C3%96",
    "filename*0*=utf-8''%C3%97",
    "filename*0*=utf-8''%C3%98",
    "filename*0*=utf-8''%C3%99",
    "filename*0*=utf-8''%C3%9A",
    "filename*0*=utf-8''%C3%9B",
    "filename*0*=utf-8''%C3%9C",
    "filename*0*=utf-8''%C3%9D",
    "filename*0*=utf-8''%C3%9E",
    "filename*0*=utf-8''%C3%9F",
    "filename*0*=utf-8''%C3%A0",
    "filename*0*=utf-8''%C3%A1",
    "filename*0*=utf-8''%C3%A2",
    "filename*0*=utf-8''%C3%A3",
    "filename*0*=utf-8''%C3%A4",
    "filename*0*=utf-8''%C3%A5",
    "filename*0*=utf-8''%C3%A6",
    "filename*0*=utf-8''%C3%A7",
    "filename*0*=utf-8''%C3%A8",
    "filename*0*=utf-8''%C3%A9",
    "filename*0*=utf-8''%C3%AA",
    "filename*0*=utf-8''%C3%AB",
    "filename*0*=utf-8''%C3%AC",
    "filename*0*=utf-8''%C3%AD",
    "filename*0*=utf-8''%C3%AE",
    "filename*0*=utf-8''%C3%AF",
    "filename*0*=utf-8''%C3%B0",
    "filename*0*=utf-8''%C3%B1",
    "filename*0*=utf-8''%C3%B2",
    "filename*0*=utf-8''%C3%B3",
    "filename*0*=utf-8''%C3%B4",
    "filename*0*=utf-8''%C3%B5",
    "filename*0*=utf-8''%C3%B6",
    "filename*0*=utf-8''%C3%B7",
    "filename*0*=utf-8''%C3%B8",
    "filename*0*=utf-8''%C3%B9",
    "filename*0*=utf-8''%C3%BA",
    "filename*0*=utf-8''%C3%BB",
    "filename*0*=utf-8''%C3%BC",
    "filename*0*=utf-8''%C3%BD",
    "filename*0*=utf-8''%C3%BE",
    "filename*0*=utf-8''%C3%BF",
    // capital Cyrillic letters
    " filename*0*=utf-8''%D0%81%D0%90%D0%91%D0%92%D0%93%D0%94%D0%95;\r\n" +
    " filename*1*=%D0%96%D0%97%D0%98%D0%99%D0%9A%D0%9B%D0%9C%D0%9D;\r\n" +
    " filename*2*=%D0%9E%D0%9F%D0%A0%D0%A1%D0%A2%D0%A3%D0%A4%D0%A5;\r\n" +
    " filename*3*=%D0%A6%D0%A7%D0%A8%D0%A9%D0%AA%D0%AB%D0%AC%D0%AD;\r\n" +
    " filename*4*=%D0%AE%D0%AF"
  ];
  // 1..31
  var filenames = [...Array(31).keys()].map(i => String.fromCharCode(i + 1));
  // 33..255
  filenames = filenames.concat([...Array(223).keys()].map(i => String.fromCharCode(i + 33)));
  // capital Cyrillic letters
  filenames.push('\u0401' + String.fromCharCode(...[...Array(32).keys()].map(i => i + 0x410)));
  const attachments = filenames.map(name => new Attachment({ name: name, type: 'text/plain', data: new Uint8Array([80, 81]) }));
  const encoded = await Mime.encode({ 'text/plain': 'text' }, { Subject: 'subject' }, attachments);
  const encodedFilenames = [...encoded.matchAll(/Content\-Disposition: attachment; ?\r?\n?(.+?)\r\nX\-Attachment\-Id/gs)];
  if (encodedFilenames.length !== expectedEncodedFilenames.length) {
    throw Error(`Found ${encodedFilenames.length} encoded filenames, while ${expectedEncodedFilenames.length} were expected`);
  }
  const mismatchIndex = encodedFilenames.findIndex((value, index) => value[1] !== expectedEncodedFilenames[index]);
  if (mismatchIndex !== -1) {
    throw Error(`Mismatch at index ${mismatchIndex}, found: ${encodedFilenames[mismatchIndex][1]}, expected: ${expectedEncodedFilenames[mismatchIndex]}`);
  }
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
