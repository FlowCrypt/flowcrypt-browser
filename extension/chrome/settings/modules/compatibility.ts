'use strict';

import { Catch } from '../../../js/common/platform/catch.js';
import { Ui } from '../../../js/common/browser.js';
import { Pgp, PgpMsg } from '../../../js/common/core/pgp.js';
import { Xss } from '../../../js/common/platform/xss.js';

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

  // Figure out how to ensure the signing and verifying was actually successful,
  // verifyResult has an error parameter. But sign doesn't seem to have an obvious error
  // perhaps we can wrap in the try-catch block to see if it returns an error in that way.
  const testSignVerify = async (key: OpenPGP.key.Key): Promise<string[]> => {
    const output: string[] = [];
    if (!key.isDecrypted()) {
      output.push('Skipped test because private key is not decrypted');
      return output;
    }

    const signedMessage = await openpgp.message.fromText(encryptionText).sign([key]);
    output.push('Signing message was successful');

    const verifyResult = await PgpMsg.verify(signedMessage, [key]);
    if (verifyResult.error !== null && typeof verifyResult.error !== 'undefined') {
      output.push(`Verifying message failed with error: ${verifyResult.error}`);
    } else {
      if (verifyResult.match && verifyResult.signer === (await Pgp.key.longid(key))) {
        output.push('Verifying message was successful');
      } else {
        output.push(`Verifying message failed, match or signer wasn't valid: match [${verifyResult.match}] - signer [${verifyResult.signer}]`);
      }
    }

    return output;
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
      const key = keys[keyIndex];
      const kn = `PK ${keyIndex} >`;
      if (!key.isPrivate() && !key.isPublic()) {
        appendResult(`${kn} key is neither public or private!!`);
        return;
      }
      appendResult(`${kn} Is Private? ${await test(async () => key.isPrivate())}`);
      appendResult(`${kn} Primary User: ${await test(async () => {
        const user = await key.getPrimaryUser();
        if (user !== null && typeof user !== 'undefined' && user.user !== null &&
          typeof user.user !== 'undefined' && user.user.userId !== null &&
          typeof user.user.userId !== 'undefined') {
          return user.user.userId.userid;
        }
        return 'Primary user is not accessible';
      })}`);
      appendResult(`${kn} Fingerprint: ${await test(async () => await Pgp.key.fingerprint(key, 'spaced'))}`);
      // appendResult(`${kn} Has valid encryption packet? ${test(async () => {return;})}`);                                // No longer exists on object
      appendResult(`${kn} Subkeys: ${await test(async () => key.subKeys ? key.subKeys.length : key.subKeys)}`);
      appendResult(`${kn} Primary key algo: ${await test(async () => key.primaryKey.algorithm)}`);

      if (key.isPrivate()) {
        appendResult(`${kn} Primary key decrypt: ${await test(async () => Pgp.key.decrypt(key, [String($('.input_passphrase').val())]))}`);
      }

      appendResult(`${kn} Primary key verify: ${await test(async () => await key.verifyPrimaryKey())}`);
      appendResult(`${kn} Primary key expiration? ${await test(async () => await key.getExpirationTime())}`);

      const encryptResult = await testEncryptDecrypt(key);
      encryptResult.map(msg => appendResult(`${kn} Encrypt/Decrypt test: ${msg}`));

      if (key.isPrivate()) {
        const signResult = await testSignVerify(key);
        signResult.map(msg => appendResult(`${kn} Sign/Verify test: ${msg}`));
      }

      for (let subKeyIndex = 0; subKeyIndex < key.subKeys.length; subKeyIndex++) {
        const subKey = key.subKeys[subKeyIndex];
        // the typings for SubKey are not entirely valid, might need an update
        // const skExpiration = await (subkey as OpenPGP.key.SubKey | any).getExpirationTime();
        // TODO:  Find out how to get expiration time of each subkey
        const skn = `${kn} SK ${subKeyIndex} >`;

        appendResult(`${skn} LongId: ${await test(async () => Pgp.key.longid(subKey.getKeyId().bytes))}`);
        appendResult(`${skn} Algo: ${await test(async () => subKey.keyPacket.algorithm)}`);
        // appendResult(`${skn} Valid encryption key?: ${await test(async () => {return subkey.isValidEncryptionKey();})}); // No longer exists on object
        // appendResult(`${skn} Expiration time: ${await test(async () => skExpiration)}`);                       // see error described above
        appendResult(`${skn} Verify: ${await test(async () => await subKey.verify(key.primaryKey))}`);
        appendResult(`${skn} Subkey tag: ${await test(async () => subKey.keyPacket.tag)}`);
        // appendResult(`${skn} Subkey getBitSize: ${await test(async () => {return subkey.subKey.getBitSize();})}`);       // No longer exists on object
        // appendResult(`${skn} Valid signing key: ${await test(async () => {return subkey.isValidSigningKey();})}`);       // No longer exists on object
        // appendResult(`${skn} Decrypt attempt: ${await test(async () => {return subkey.subKey.decrypt(passphrase);})}`);  // No longer exists on object,
        // seems to be decrypted when parent key is decrypted
        appendResult(`${skn} Subkey decrypted: ${await test(async () => subKey.isDecrypted())}`);
        appendResult(`${skn} Binding signature length: ${await test(async () => subKey.bindingSignatures.length)}`);

        for (let sigIndex = 0; sigIndex < subKey.bindingSignatures.length; sigIndex++) {
          const sig = subKey.bindingSignatures[sigIndex];
          const sgn = `${skn} SIG ${sigIndex} >`;
          appendResult(`${sgn} Key flags: ${await test(async () => sig.keyFlags)}`);
          appendResult(`${sgn} Tag: ${await test(async () => sig.tag)}`);
          appendResult(`${sgn} Version: ${await test(async () => sig.version)}`);
          appendResult(`${sgn} Public key algorithm: ${await test(async () => sig.publicKeyAlgorithm)}`);
          appendResult(`${sgn} Key expiration time: ${await test(async () => sig.keyExpirationTime)}`);
          appendResult(`${sgn} Verified: ${await test(async () => sig.verified)}`);
        }
      }
    }
  };

  const performKeyCompatibilityTests = async (keyString: string) => {
    $('pre').text('').css('display', 'block');
    testIndex = 1;
    try {
      const openpgpKey = await openpgp.key.readArmored(keyString);
      // check for errors in the response to read the key
      if (openpgpKey.err !== null && typeof openpgpKey.err !== 'undefined' && openpgpKey.err.length !== 0) {
        appendResult(`The provided OpenPGP key has an error: ${JSON.stringify(openpgpKey)}`);
        for (const err of openpgpKey.err) {
          console.error(err);
          appendResult(`Error parsing keys: `, err);
        }
        return;
      }
      // check for keys, null or undefined array means OpenPGP.js is having a problem
      if (openpgpKey.keys === null || typeof openpgpKey.keys === 'undefined') {
        appendResult(`Key parse error: ${JSON.stringify(openpgpKey)}`);
        return;
      }
      if (openpgpKey.keys.length === 0) {
        appendResult('No keys were parsed in request');
        return;
      }
      await outputKeyResults(openpgpKey.keys);
    } catch (err) {
      if (err instanceof Error) {
        appendResult('Exception parsing key', err);
      } else {
        appendResult(`Error parsing key: ${err}`);
      }
      return;
    }
  };
})();
