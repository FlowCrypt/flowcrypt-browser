/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

/**
 * This code runs in the context of the content script and should store the result into a div '@content-script-test-result'
 * (injected into the webmail_bundle.js for the `-content-script-tests(-mock)` builds)
 */

(async () => {
  let result = '';
  try {
    Xss.sanitizePrepend('body', '<h1 id="content-script-test-status">Running content script tests...</h1>');
    const armoredPrv = `-----BEGIN PGP PRIVATE KEY BLOCK-----

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
dYU0CKNXUkv+q8TEUw==
=LKvX
-----END PGP PRIVATE KEY BLOCK-----
`;
    const key = await KeyUtil.parse(armoredPrv);
    const { type, data } = await PgpArmor.dearmor(armoredPrv);
    try {
      const armorResult = PgpArmor.armor(type, data);
      if (typeof armorResult !== 'string' || armorResult.length < 100) {
        result += `armor result isn't a string\n`;
      }
    } catch (e) {
      result += `Exception when calling PgpArmor.armor(): ${e}\n`;
    }
    try {
      // getOrCreateRevocationCertificate tests if Stream (web-stream-tools) is wired correctly
      const revocationCertificate = await KeyUtil.getOrCreateRevocationCertificate(key);
      if (typeof revocationCertificate !== 'string' || revocationCertificate.length < 100) {
        result += `revocation certificate isn't a string\n`;
      }
    } catch (e) {
      result += `Exception when calling KeyUtil.getOrCreateRevocationCertificate(): ${e}\n`;
    }
  } catch (e) {
    result += `Exception: ${e}`;
  }
  Xss.sanitizeReplace('#content-script-test-status', `<div data-test="content-script-test-result">${Xss.escape(result || 'pass')}</div>`);
})();
