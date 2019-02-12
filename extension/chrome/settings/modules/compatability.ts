"use strict";

import { Catch } from "../../../js/common/platform/catch.js";
import { Xss, Ui /*, XssSafeFactory, Env*/ } from "../../../js/common/browser.js";
import { Pgp, PgpMsg } from "../../../js/common/core/pgp.js";

declare const openpgp: typeof OpenPGP;

Catch.try(async () => {
  //   const uncheckedUrlParams = Env.urlParams(["acctEmail", "parentTabId"]);
  //   const acctEmail = Env.urlParamRequire.string(uncheckedUrlParams, "acctEmail");

  let origContent: string;
  //   const factory = new XssSafeFactory(acctEmail, tabId);

  const encryptionText = "This is the text we are encrypting!";
  const encryptionPassphrase = "anEncryptionPassphrase";

  $(".action_test_key").click(Ui.event.prevent("double", async self => {
    const keyString = String($(".input_key").val());
    if (!keyString) {
      alert("Please paste an OpenPGP in the input box");
      return;
    }

    origContent = $(self).html();
    Xss.sanitizeRender(self, "Evaluating.. " + Ui.spinner("white"));

    await performKeyCompatabilityTests(keyString);

    Xss.sanitizeRender(self, origContent);
  }));

  const testEncryptDecrypt = async (key: OpenPGP.key.Key): Promise<string[]> => {
    const output: string[] = [];
    const eMessage = await openpgp.encrypt({
      message: openpgp.message.fromText(encryptionText),
      publicKeys: key.toPublic(),
      armor: true,
      passwords: [encryptionPassphrase]
    });

    const cipherText = eMessage.data;
    if (cipherText !== null && typeof cipherText !== 'undefined' && cipherText !== '') {
      output.push("Encryption with key was successful");
    } else {
      output.push("Encryption with key failed");
    }

    if (key.isPrivate() && key.isDecrypted()) {
      const dMessage = await openpgp.decrypt({
        message: await openpgp.message.readArmored(cipherText),
        privateKeys: key,
        passwords: [encryptionPassphrase]
      });

      const decryptionResult = dMessage.data;
      if (decryptionResult === encryptionText) {
        output.push("Decryption with key was successful");
      } else {
        output.push("Decryption with key failed!");
      }
    }

    return output;
  };

  // Figure out how to ensure the signing and verifying was actually successful,
  // verifyResult has an error parameter. But sign doesn't seem to have an obvious error
  // perhaps we can wrap in the try-catch block to see if it returns an error in that way.
  const testSignVerify = async (key: OpenPGP.key.Key): Promise<string[]> => {
    const output: string[] = [];
    const signedMessage = await openpgp.message.fromText(encryptionText).sign([key]);
    output.push("Signing message was successful");

    const verifyResult = await PgpMsg.verify(signedMessage, [key]);
    if (verifyResult.error !== null && typeof verifyResult.error !== 'undefined') {
      output.push(`Verifying message failed with error: ${verifyResult.error}`);
    } else {
      if (verifyResult.match && verifyResult.signer === (await Pgp.key.longid(key))) {
        output.push("Verifying message was successful");
      } else {
        output.push(`Verifying message failed, match or signer wasn't valid: match [${verifyResult.match}] - signer [${verifyResult.signer}]`);
      }
    }

    return output;
  };

  // START: Code and helpers taken from the original private key test page
  let testIndex = 0;

  const test = async (f: () => any) => {
    try {
      return `[-] ${await f()}`;
    } catch (e) {
      return `[${String(e)}]`;
    }
  };

  const appendResult = (str: string, err?: Error) => {
    $("pre").append(`(${testIndex++}) ${Xss.escape(str)} ${err ? Xss.escape(` !! ${err.message}`) : ""} \n`);
  };
  // END

  const outputKeyResults = async (keys: OpenPGP.key.Key[]) => {
    testIndex = 1;
    appendResult(`Primary keys found: ${keys.length}`);

    keys.map(async (key, ki) => {
      const kn = `PK ${ki} >`;
      if (!key.isPrivate() && !key.isPublic()) {
        appendResult(`${kn} key is neither public or private!!`);
        return;
      }

      appendResult(`${kn} Is Private? ${await test(async () => key.isPrivate())}`);
      appendResult(`${kn} Primary User: ${await test(async () => (await key.getPrimaryUser()).user.userId.userid)}`);
      appendResult(`${kn} Fingerprint: ${await test(async () => await Pgp.key.fingerprint(key, "spaced"))}`);
      // appendResult(`${kn} Has valid encryption packet? ${test(async () => {return;})}`);                                // No longer exists on object
      appendResult(`${kn} Subkeys: ${await test(async () => key.subKeys ? key.subKeys.length : key.subKeys)}`);
      appendResult(`${kn} Primary key algo: ${await test(async () => key.primaryKey.algorithm)}`);

      if (key.isPrivate()) {
        appendResult(`${kn} Primary key decrypt: ${await test(async () => Pgp.key.decrypt(key, [String($(".input_passphrase").val())]))}`);
      }

      appendResult(`${kn} Primary key verify: ${await test(async () => await key.verifyPrimaryKey())}`);
      appendResult(`${kn} Primary key expiration? ${await test(async () => await key.getExpirationTime())}`);

      const encryptResult = await testEncryptDecrypt(key);
      encryptResult.map(msg => appendResult(`${kn} Encrypt/Decrypt test: ${msg}`));

      if (key.isPrivate()) {
        const signResult = await testSignVerify(key);
        signResult.map(msg => appendResult(`${kn} Sign/Verify test: ${msg}`));
      }

      key.subKeys.map(async (subkey, si) => {
        // the typings for SubKey are not entirely valid, might need an update

        // const skExpiration = await (subkey as OpenPGP.key.SubKey | any).getExpirationTime();
        // TODO:  Find out how to get expiration time of each subkey

        const skn = `${kn} SK ${si} >`;

        appendResult(`${skn} Algo: ${await test(async () => (subkey as OpenPGP.key.SubKey | any).keyPacket.algorithm)}`);
        // appendResult(`${skn} Valid encryption key?: ${await test(async () => {return subkey.isValidEncryptionKey();})}); // No longer exists on object
        // appendResult(`${skn} Expiration time: ${await test(async () => skExpiration)}`);                       // see error described above
        appendResult(`${skn} Verify: ${await test(async () => await subkey.verify(key.primaryKey))}`);
        appendResult(`${skn} Subkey tag: ${await test(async () => (subkey as OpenPGP.key.SubKey | any).keyPacket.tag)}`);
        // appendResult(`${skn} Subkey getBitSize: ${await test(async () => {return subkey.subKey.getBitSize();})}`);       // No longer exists on object
        // appendResult(`${skn} Valid signing key: ${await test(async () => {return subkey.isValidSigningKey();})}`);       // No longer exists on object
        // appendResult(`${skn} Decrypt attempt: ${await test(async () => {return subkey.subKey.decrypt(passphrase);})}`);  // No longer exists on object,
        // seems to be decrypted when parent key is decrypted
        appendResult(`${skn} Subkey decrypted: ${await test(async () => subkey.isDecrypted())}`);
        appendResult(`${skn} Binding signature length: ${await test(async () => subkey.bindingSignatures.length)}`);

        subkey.bindingSignatures.map(async (sig, sgi) => {
          const sgn = `${skn} SIG ${sgi} >`;
          appendResult(`${sgn} Key flags: ${await test(async () => sig.keyFlags)}`);
          appendResult(`${sgn} Tag: ${await test(async () => sig.tag)}`);
          appendResult(`${sgn} Version: ${await test(async () => sig.version)}`);
          appendResult(`${sgn} Public key algorithm: ${await test(async () => sig.publicKeyAlgorithm)}`);
          appendResult(`${sgn} Key expiration time: ${await test(async () => sig.keyExpirationTime)}`);
          appendResult(`${sgn} Verified: ${await test(async () => sig.verified)}`);
        });
      });
    });
  };

  const performKeyCompatabilityTests = async (keyString: string) => {
    $("pre").css("display", "block");
    $("pre").text("");
    try {
      const openpgpKey = await openpgp.key.readArmored(keyString);

      // check for errors in the response to read the key
      if (openpgpKey.err !== null && typeof openpgpKey.err !== "undefined" && openpgpKey.err.length !== 0) {
        appendResult(`The provided OpenPGP key has an error: ${JSON.stringify(openpgpKey)}`);
        openpgpKey.err.map(err => {
          console.error(err);
          appendResult(`Error parsing keys: `, err);
        });
        return;
      }

      // check for keys, null or undefined array means OpenPGP.js is having a problem
      if (openpgpKey.keys === null || typeof openpgpKey.keys === "undefined") {
        appendResult(`Key parse error: ${JSON.stringify(openpgpKey)}`);
        return;
      }

      if (openpgpKey.keys.length === 0) {
        appendResult("No keys were parsed in request");
        return;
      }

      outputKeyResults(openpgpKey.keys);
    } catch (err) {
      appendResult("Exception parsing key", err);
      return;
    }
  };
})();
