/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

/* eslint-disable max-len */

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

BROWSER_UNIT_TEST_NAME(`collectEncryptAtts preserves utf attachment names`);
(async () => {
  // DOM prep
  $('body').append('<div id="fineuploader"></div><button id="fineuploader_button">attach</button>');
  // test prep
  const utfName = '\u0410\u0411\u0412';
  const encryptedUtfName = `${utfName}.pgp`;
  const content = Buf.fromUtfStr('hello');
  const attachmentUi = new AttachmentUI(() => Promise.resolve({ sizeMb: 5, size: 5 * 1024 * 1024, count: 1 }));
  attachmentUi.initAttachmentDialog('fineuploader', 'fineuploader_button');
  await new Promise((resolve) => setTimeout(resolve, 1000)); // the above method is actually async and needs some time
  attUi.addFile(new File([content], utfName));
  await new Promise((resolve) => setTimeout(resolve, 1000)); // again it seems to need some time to crunch the new file
  const pubkey = '-----BEGIN PGP PUBLIC KEY BLOCK-----\nVersion: CryptUP 3.2.0 Easy Gmail Encryption https://cryptup.org\nComment: Seamlessly send, receive and search encrypted email\n\nxsBNBFU0WMgBCACZSzijeN4YozhjmHU7BGWzW7ZbY6GGtJinByt8OnEnQ9TX\n9zrAxbyr0grPE4On7nd3uepwNxJbk5LlaCwHNkpX39xKgDgCskRO9CfeqOIO\n4l5Wjj4XldrgLSOGJe8Vmimo9UKmqsP5v8fR3mMyIqQbtE4G+Vq/J9A3uabr\nf0XYVsBdBvVoJkQ83gtQrZoTA/zihNmtLXH9pTwtX8FJcqgFK6RgvfAh2jCz\nDhT+reI50ZcuHRvVRxvrL172DFSQsLSdj8PcewS1J89knH4sjjBC/kwbLa0n\ntod/gBPWw/uetaOJna43wNueUKKOl2kAXE4sw6ESIrlFDynJ4g05T9yxABEB\nAAHNIlRvbSBKYW1lcyBIb2x1YiA8dG9tQGJpdG9hc2lzLm5ldD7CwFwEEAEI\nABAFAlU0WM8JEA1WiOvzECvnAAAB4gf8DaIzZACUqkGEoI19HyBPtcrJT4mx\nhKZ/Wts0C6TGj/OQXevDI+h2jQTYf8+fOqCdQev2Kwh/8mQV6wQqmN9uiVXO\n5F4vAbWNfEve6mCVB5gi296mFf6kx04xC7VVYAJ3FUR72BplE/0+cwv9Nx2r\nJh3QGFhoPaFMPtCAk0TgKcO0UkcBwXNzAV5Pgz0MT1COTWBXEej4yOrqdWoP\nA6fEpV8aLaFnAt+zh3cw4A7SNAO9omGAUZeBl4Pz1IlN2lC2grc2zpqoxo8o\n3W49JYTfExeCNVWhlSU74f6bpN6CMdSdrh5phOr+ffQQhEhkNblUgSZe6tKa\nVFI1MhkJ6Xhrug==\n=+de8\n-----END PGP PUBLIC KEY BLOCK-----';
  const pubkeyResult = { pubkey: await KeyUtil.parse(pubkey), email: 'some@email.com', isMine: false };
  // test
  const [att] = await attUi.collectEncryptAtts([pubkeyResult]);
  if (att.name !== encryptedUtfName) {
    throw Error(`Expected att.name to equal "${encryptedUtfName}" but got "${att.name}"`);
  }
  return 'pass';
})();
