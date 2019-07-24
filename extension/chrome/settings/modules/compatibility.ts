'use strict';

import { Catch } from '../../../js/common/platform/catch.js';
import { Ui } from '../../../js/common/browser.js';
import { Pgp, PgpMsg } from '../../../js/common/core/pgp.js';
import { Xss } from '../../../js/common/platform/xss.js';
import { Buf } from '../../../js/common/core/buf.js';

declare const openpgp: typeof OpenPGP;

Catch.try(async () => {
  const encryptionText = 'This is the text we are encrypting!';
  const encryptionPassphrase = 'anEncryptionPassphrase';
  let testIndex = 0;

  $('.action_test_key').click(Ui.event.prevent('double', async self => {
    const keyString = String($('.input_key').val());
    if (!keyString) {
      await Ui.modal.warning('Please paste an OpenPGP in the input box');
      return;
    }
    const origBtnContent = $(self).html();
    Xss.sanitizeRender(self, 'Evaluating.. ' + Ui.spinner('white'));
    await performKeyCompatibilityTests(keyString);
    Xss.sanitizeRender(self, origBtnContent);
  }));

  const formatDate = (date: Date | number, expiresInSecondsFromDate?: number | null) => {
    if (date === Infinity) {
      return '-';
    }
    if (typeof date === 'number') {
      return `UNEXPECTED FORMAT: ${date}`;
    }
    if (typeof expiresInSecondsFromDate === 'undefined') {
      return `${date.getTime() / 1000} or ${date.toISOString()}`;
    }
    if (expiresInSecondsFromDate === null) {
      return '-'; // no expiration
    }
    const expDate = new Date(date.getTime() + (expiresInSecondsFromDate * 1000));
    return `${date.getTime() / 1000} + ${expiresInSecondsFromDate} seconds, which is: ${expDate.getTime() / 1000} or ${expDate.toISOString()}`;
  };

  const testEncryptDecrypt = async (key: OpenPGP.key.Key): Promise<string[]> => {
    const output: string[] = [];
    try {
      const encryptedMsg = await openpgp.encrypt({
        message: openpgp.message.fromText(encryptionText),
        publicKeys: key.toPublic(),
        armor: true,
        passwords: [encryptionPassphrase]
      });
      output.push(`Encryption with key was successful`);
      if (key.isPrivate() && key.isDecrypted()) {
        const decryptedMsg = await openpgp.decrypt({
          message: await openpgp.message.readArmored(encryptedMsg.data),
          privateKeys: key,
          passwords: [encryptionPassphrase]
        });
        output.push(`Decryption with key ${decryptedMsg.data === encryptionText ? 'succeeded' : 'failed!'}`);
      } else {
        output.push(`Skipping decryption because isPrivate:${key.isPrivate()} isDecrypted:${key.isDecrypted()}`);
      }
    } catch (err) {
      output.push(`Got error performing encryption/decryption test: ${err}`);
    }
    return output;
  };

  const testSignVerify = async (key: OpenPGP.key.Key): Promise<string> => {
    const output: string[] = [];
    try {
      if (!key.isDecrypted()) {
        return 'skiped, not decrypted';
      }
      const signedMessage = await openpgp.message.fromText(encryptionText).sign([key]);
      output.push('sign msg ok');
      const verifyResult = await PgpMsg.verify(signedMessage, [key]);
      if (verifyResult.error !== null && typeof verifyResult.error !== 'undefined') {
        output.push(`verify failed: ${verifyResult.error}`);
      } else {
        if (verifyResult.match && verifyResult.signer === (await Pgp.key.longid(key))) {
          output.push('verify ok');
        } else {
          output.push(`verify mismatch: match[${verifyResult.match}] signer[${verifyResult.signer}]`);
        }
      }
    } catch (e) {
      output.push(`Exception: ${String(e)}`);
    }
    return output.join('|');
  };

  const test = async (f: () => Promise<unknown>) => {
    try {
      return `[-] ${String(await f())}`;
    } catch (e) {
      return `[${String(e)}]`;
    }
  };

  const appendResult = (str: string, err?: Error) => {
    Xss.sanitizeAppend('pre', `(${Xss.escape(`${testIndex++}`)}) ${Xss.escape(str)} ${err ? Xss.escape(` !! ${err.message}`) : Xss.escape('')} \n`);
  };

  const outputKeyResults = async (keys: OpenPGP.key.Key[]) => {
    appendResult(`Primary keys found: ${keys.length}`);
    for (let keyIndex = 0; keyIndex < keys.length; keyIndex++) {
      appendResult(`----- Testing key ${keyIndex} -----`);
      const key = keys[keyIndex];
      const kn = `PK ${keyIndex} >`;
      if (!key.isPrivate() && !key.isPublic()) {
        appendResult(`${kn} key is neither public or private!!`);
        return;
      }
      appendResult(`${kn} Is Private? ${await test(async () => key.isPrivate())}`);
      for (let i = 0; i < key.users.length; i++) {
        appendResult(`${kn} User id ${i}: ${await test(async () => key.users[i].userId!.userid)}`);
      }
      appendResult(`${kn} Primary User: ${await test(async () => {
        const user = await key.getPrimaryUser();
        return user && user.user && user.user.userId ? user.user.userId.userid : 'No primary user';
      })}`);
      appendResult(`${kn} Fingerprint: ${await test(async () => await Pgp.key.fingerprint(key, 'spaced'))}`);
      appendResult(`${kn} Subkeys: ${await test(async () => key.subKeys ? key.subKeys.length : key.subKeys)}`);
      appendResult(`${kn} Primary key algo: ${await test(async () => key.primaryKey.algorithm)}`);
      if (key.isPrivate()) {
        appendResult(`${kn} Primary key decrypt: ${await test(async () => Pgp.key.decrypt(key, [String($('.input_passphrase').val())]))}`);
      }
      appendResult(`${kn} Primary key verify: ${await test(async () => await key.verifyPrimaryKey())}`);
      appendResult(`${kn} Primary key creation? ${await test(async () => formatDate(await key.getCreationTime()))}`);
      appendResult(`${kn} Primary key expiration? ${await test(async () => formatDate(await key.getExpirationTime()))}`);
      const encryptResult = await testEncryptDecrypt(key);
      encryptResult.map(msg => appendResult(`${kn} Encrypt/Decrypt test: ${msg}`));
      if (key.isPrivate()) {
        appendResult(`${kn} Sign/Verify test: ${await test(async () => await testSignVerify(key))}`);
      }
      for (let subKeyIndex = 0; subKeyIndex < key.subKeys.length; subKeyIndex++) {
        const subKey = key.subKeys[subKeyIndex];
        const skn = `${kn} SK ${subKeyIndex} >`;
        appendResult(`${skn} LongId: ${await test(async () => Pgp.key.longid(subKey.getKeyId().bytes))}`);
        appendResult(`${skn} Created: ${await test(async () => formatDate(subKey.keyPacket.created))}`);
        appendResult(`${skn} Algo: ${await test(async () => `${subKey.getAlgorithmInfo().algorithm}`)}`);
        appendResult(`${skn} Verify: ${await test(async () => await subKey.verify(key.primaryKey))}`);
        appendResult(`${skn} Subkey tag: ${await test(async () => subKey.keyPacket.tag)}`);
        appendResult(`${skn} Subkey getBitSize: ${await test(async () => subKey.getAlgorithmInfo().bits)}`);       // No longer exists on object
        appendResult(`${skn} Subkey decrypted: ${await test(async () => subKey.isDecrypted())}`);
        appendResult(`${skn} Binding signature length: ${await test(async () => subKey.bindingSignatures.length)}`);
        for (let sigIndex = 0; sigIndex < subKey.bindingSignatures.length; sigIndex++) {
          const sig = subKey.bindingSignatures[sigIndex];
          const sgn = `${skn} SIG ${sigIndex} >`;
          appendResult(`${sgn} Key flags: ${await test(async () => sig.keyFlags)}`);
          appendResult(`${sgn} Tag: ${await test(async () => sig.tag)}`);
          appendResult(`${sgn} Version: ${await test(async () => sig.version)}`);
          appendResult(`${sgn} Public key algorithm: ${await test(async () => sig.publicKeyAlgorithm)}`);
          appendResult(`${sgn} Sig creation time: ${await test(async () => formatDate(sig.created))}`);
          appendResult(`${sgn} Sig expiration time: ${await test(async () => {
            if (!subKey.keyPacket.created) {
              return 'unknown key creation time';
            }
            return formatDate(subKey.keyPacket.created, sig.keyExpirationTime);
          })}`);
          appendResult(`${sgn} Verified: ${await test(async () => sig.verified)}`);
        }
      }
      appendResult(`${kn} internal dateBeforeExpiration: ${await test(async () => Pgp.key.dateBeforeExpiration(key))}`);
      appendResult(`${kn} internal usableButExpired: ${await test(async () => Pgp.key.usableButExpired(key))}`);
    }
  };

  const performKeyCompatibilityTests = async (keyString: string) => {
    $('pre').text('').css('display', 'block');
    try {
      testIndex = 1;
      const { keys, errs } = await Pgp.key.readMany(Buf.fromUtfStr(keyString));
      for (const err of errs) {
        appendResult(`Error parsing input: ${String(err)}`);
      }
      await outputKeyResults(keys);
    } catch (err) {
      appendResult(`Exception: ${String(err)}`);
    }
  };
})();
