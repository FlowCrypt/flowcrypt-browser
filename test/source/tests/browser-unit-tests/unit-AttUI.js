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
  await new Promise(resolve => setTimeout(resolve, 1000)); // the above method is actually async and needs some time
  attachmentUi.addFile(new File([content], utfName));
  await new Promise(resolve => setTimeout(resolve, 1000)); // again it seems to need some time to crunch the new file
  const pubkey = `-----BEGIN PGP PUBLIC KEY BLOCK-----
Version: CryptUP 3.2.0 Easy Gmail Encryption https://cryptup.org
Comment: Seamlessly send, receive and search encrypted email


mQENBGc9gogBCACzdC8asczNuVebgn4rQ87hBnpJcWRnYOjCFdL1mSsh6CT787kr
AWdMr5xvNzCThv7n1uhWcdw4vdE87IRRiLTlx56HjkLkq/YyDC+rzf2kEVFSHpQn
l0gAZrExcm7QSU3RkiyLeIhZl5TWnlk7swW4St85wurP+bEOn9hv0Csl5sNTVDYv
jP02ewdm3VCe6y0s3euWo1FCOYtIx0K4IQyyghgHR94LYOtXa9nPbYLJr87Gqtto
OK5yPB//ZN2t3tYwpAgpDWNQzFu/Jl0bREQFP1bVrZHhfy65UWwsxhP8REzdtl6Y
t/EUM+74SC6pyEcVqCnJS8m3BmJUjGlrplT1ABEBAAG0IlRvbSBKYW1lcyBIb2x1
YiA8dG9tQGJpdG9hc2lzLm5ldD6JAVEEEwEIADsWIQSMTB/Md581dynRlOzqIlql
HKheCgUCZz2CiAIbLwULCQgHAgIiAgYVCgkICwIEFgIDAQIeBwIXgAAKCRDqIlql
HKheCt8vB/4pLL2aMJwDgi8Qhmxfllz9mXTOn+h3LequV3ou8gDNSwByLbSrcZvd
M4rlqjezQ9/Y+itALjQ3/jwhHMh4M5sDc7BXaO82eQzrpBywgLTY2km1RQ9BaoxT
PQwkBDSt2Zp/XhBwYXiMtxw/d90Cu99fnitXFFZz3lkCq4zn3BeCAJmL3CHotCLe
clmE7C16Y/w6t5+2AXej+lNpmBvQt2cXzDWeNxcZhJInW1MuIdUQFT8rEQ1H/r83
t1RcQH6LuwetOysrY5a9DjH09mHizyt9KFu+jPP//pTXlWE0d2JX9buvkLTsm8IX
jg/j+T6eFDW23ZST+PeNj4pFukc+feDa
=kM8e
-----END PGP PUBLIC KEY BLOCK-----`;
  const pubkeyResult = { pubkey: await KeyUtil.parse(pubkey), email: 'some@email.com', isMine: false };
  // test
  const [att] = await attachmentUi.collectEncryptAttachments([pubkeyResult]);
  if (att.name !== encryptedUtfName) {
    throw Error(`Expected att.name to equal "${encryptedUtfName}" but got "${att.name}"`);
  }
  return 'pass';
})();
