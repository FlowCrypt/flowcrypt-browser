"use strict";

import { Catch } from "../../../js/common/platform/catch.js";
import { BrowserMsg } from "../../../js/common/extension.js";
import { Xss, Ui /*, XssSafeFactory, Env*/ } from "../../../js/common/browser.js";
import { Pgp } from '../../../js/common/core/pgp.js';
import { Buf } from '../../../js/common/core/buf.js';

declare const openpgp: typeof OpenPGP;

Catch.try(async () => {
//   const uncheckedUrlParams = Env.urlParams(["acctEmail", "parentTabId"]);
//   const acctEmail = Env.urlParamRequire.string(uncheckedUrlParams, "acctEmail");

  const tabId = await BrowserMsg.requiredTabId();
  let origContent: string;
//   const factory = new XssSafeFactory(acctEmail, tabId);

  BrowserMsg.addListener("close_dialog", async () => {
    $(".passphrase_dialog").text("");
  });
  BrowserMsg.listen(tabId);

    const encryptionText = 'This is the text we are encrypting!';
    const encryptionPassphrase = 'anEncryptionPassphrase';
    let cipherText: string;
    let decryptionResult: string;

  $(".action_test_key").click(Ui.event.prevent("double", async self => {
      const keyString = String($(".input_key").val());
      if (!keyString) {
        alert("Please paste an OpenPGP in the input box");
        return;
      }
      if (!("TextEncoder" in window)) {
        alert("Sorry, your browser does not support TextEncoder which is required for this feature");
        return;
      }

      origContent = $(self).html();
      Xss.sanitizeRender(self, "Evaluating.. " + Ui.spinner("white"));

      await performKeyCompatabilityTests(keyString);

      Xss.sanitizeRender(self, origContent);
    }));

const encryptWithKey = async (key: OpenPGP.key.Key) => {
    const message = await openpgp.encrypt({
        message: openpgp.message.fromText(encryptionText),
        publicKeys: key.toPublic(),
        armor: true,
        passwords: [encryptionPassphrase]
    });

    cipherText = (message as any).data;
    console.log(message);
};

const decryptWithKey = async (key: OpenPGP.key.Key) => {
    const message = await openpgp.decrypt({
        message: await openpgp.message.readArmored(cipherText),
        privateKeys: key,
        passwords: [encryptionPassphrase]
    });

    decryptionResult = (message.data as string);
    console.log(decryptionResult);
};

const signWithKey = async (key: OpenPGP.key.Key) => {
    let result = await openpgp.message.fromText(encryptionText).sign([key]);
    console.log(result);
};

const verifyWithKey = async (key: OpenPGP.key.Key) => {
    let result =  await openpgp.message.fromText(encryptionText).verify([key]);
    console.log(result);
};

// START: Code and helpers taken from the original private key test page
let _i = 0;

const test = async (f: () => any) => {
    try {
        return '[-] ' + await f();
    } catch(e) {
        return '[' + e.message + ']';
    }
};

const appendResult = (str: string, err?: Error) => {
    $('pre').append(`(${_i++}) ${Xss.escape(str)} ${(err ? Xss.escape(` !! ${err.message}`) : '')} \n`);
};
// END

const outputKeyResults = async (keys: OpenPGP.key.Key[]) => {
    _i = 1;
    appendResult(`Primary keys found: ${keys.length}`);

    keys.map(async (key, ki) => {
        const kn = `PK ${ki} >`;
        if (!key.isPrivate() && !key.isPublic()) {
            appendResult(`${kn} key is neither public or private!!`);
            return;
        }

        console.log(key);

        appendResult(`${kn} Is Private? ${await test(async () =>  key.isPrivate())}`);
        appendResult(`${kn} Primary User: ${await test(async () =>  await key.getPrimaryUser().user.userId.userid)}`);
        appendResult(`${kn} Fingerprint: ${await test(async () =>  key.getFingerprint())}`);
        // appendResult(`${kn} Has valid encryption packet? ${test(async () => {return;})}`);                                // No longer exists on object
        appendResult(`${kn} Subkeys: ${await test(async () =>  key.subKeys ? key.subKeys.length : key.subKeys)}`);
        appendResult(`${kn} Primary key algo: ${await test(async () =>  key.primaryKey.algorithm)}`);
        appendResult(`${kn} Primary key decrypt: ${await test(async () =>  Pgp.key.decrypt(key, [String($('.input_passphrase').val())]))}`);
        appendResult(`${kn} Primary key verify: ${await test(async () => await key.verifyPrimaryKey())}`);
        appendResult(`${kn} Primary key expiration? ${await test(async () =>  await key.getExpirationTime())}`);

        key.subKeys.map(async (subkey, si) => {
            // the typings for SubKey are not entirely valid, might need an update

            // const skExpiration = await (subkey as OpenPGP.key.SubKey | any).getExpirationTime();
            // Throwing an error "TypeError: Cannot read property 'algorithm' of undefined"
            // Stack trace:
            /*
                at Signature.verify (openpgp.js:38060)
                at getLatestValidSignature (openpgp.js:31279)
                at SubKey.getExpirationTime (openpgp.js:32125)
                at key.subKeys.map (compatability.js:148)
                at Array.map (<anonymous>)
                at keys.map (compatability.js:146)
            */
            const skVerified = await subkey.verify(key.primaryKey);

            const skn = `${kn} SK ${si} >`;
            console.log(subkey);
            appendResult(`${skn} Algo: ${await test(async () => (subkey as OpenPGP.key.SubKey | any).keyPacket.algorithm)}`);
            // appendResult(`${skn} Valid encryption key?: ${await test(async () => {return subkey.isValidEncryptionKey();})}); // No longer exists on object
            // appendResult(`${skn} Expiration time: ${await test(async () => {return skExpiration;})}`);                       // see error described above
            appendResult(`${skn} Verify: ${await test(async () => {return skVerified;})}`);
            appendResult(`${skn} Subkey tag: ${await test(async () => {return (subkey as OpenPGP.key.SubKey | any).keyPacket.tag;})}`);
            // appendResult(`${skn} Subkey getBitSize: ${await test(async () => {return subkey.subKey.getBitSize();})}`);       // No longer exists on object
            // appendResult(`${skn} Valid signing key: ${await test(async () => {return subkey.isValidSigningKey();})}`);       // No longer exists on object
            // appendResult(`${skn} Decrypt attempt: ${await test(async () => {return subkey.subKey.decrypt(passphrase);})}`);  // No longer exists on object, seems to be decrypted when parent key is decrypted
            appendResult(`${skn} Subkey decrypted: ${await test(async () => {return subkey.isDecrypted();})}`);
            appendResult(`${skn} Binding signature length: ${await test(async () => {return subkey.bindingSignatures.length;})}`);

            subkey.bindingSignatures.map(async (sig, sgi) => {
                const sgn = `${skn} SIG ${sgi} >`;
                appendResult(`${sgn} Key flags: ${await test(async () => {return sig.keyFlags;})}`);
                appendResult(`${sgn} Tag: ${await test(async () => {return sig.tag;})}`);
                appendResult(`${sgn} Version: ${await test(async () => {return sig.version;})}`);
                appendResult(`${sgn} Public key algorithm: ${await test(async () => {return sig.publicKeyAlgorithm;})}`);
                appendResult(`${sgn} Key expiration time: ${await test(async () => {return sig.keyExpirationTime;})}`);
                appendResult(`${sgn} Verified: ${await test(async () => {return sig.verified;})}`);
            });
        });


        // TODO: Add appendResult calls for each of the following functions
        // possibly a simple success / error message depending on the result

        if (key.isPublic()) {
            await encryptWithKey(key);
        }

        if (key.isPrivate()) {
            if (! await decryptPrivateKey(key)) {
                return;
            }
            await encryptWithKey(key);
            await decryptWithKey(key);
            await signWithKey(key);
            await verifyWithKey(key);
        }
    });
};

  const performKeyCompatabilityTests = async (keyString: string) => {
    $('pre').text('');
    try {
        const keyBytes = Buf.fromUtfStr(keyString);
        // let keyBytes = new TextEncoder().encode(keyString);
        let openpgpKey = await openpgp.key.read(keyBytes);

        // key is either armoured or not valid
        if (openpgpKey.keys.length === 0) {
            // read the key as armoured
            const armoredOpenpgpKey = await openpgp.key.readArmored(keyString);
            if (armoredOpenpgpKey.keys.length > 0) {
                // use the armoured key
                openpgpKey = armoredOpenpgpKey;
            } else if (armoredOpenpgpKey.keys.length === 0) {
                // move the errors in the armoured key request to the openpgpKey object
                // consider a means to remove duplicate errors that isnt overly verbose
                openpgpKey.err.push(...armoredOpenpgpKey.err);
            }
        }

        // check for errors in the response to read the key
        if ( openpgpKey.err !== null && typeof openpgpKey.err !== "undefined" && openpgpKey.err.length !== 0) {
            alert("The provided OpenPGP key has an error.");
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
            alert("No keys were parsed in request");
            return;
        }

        outputKeyResults(openpgpKey.keys);
    } catch(err) {
        appendResult('Exception parsing key', err);
        return;
    }
  };
})();
