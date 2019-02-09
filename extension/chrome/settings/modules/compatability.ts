"use strict";

import { Catch } from "../../../js/common/platform/catch.js";
import { BrowserMsg } from "../../../js/common/extension.js";
import { Xss, Ui /*, XssSafeFactory, Env*/ } from "../../../js/common/browser.js";

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

const decryptPrivateKey = async (key: OpenPGP.key.Key): Promise<boolean> => {
    if (key.isDecrypted()) { return true; }
    const privatePw = String($('.input_passphrase').val());
    if (!privatePw) {
        alert("Please provide a password when encrypting with your private key");
        return false;
    }

    if (!await key.decrypt(privatePw)) {
        alert("Sorry your private key was not decrypted with that password. Try again with a different password!");
        return false;
    }

    return true;
};

const encryptWithKey = async (key: OpenPGP.key.Key) => {
    let message = await openpgp.encrypt(<OpenPGP.EncryptOptions>{
        message: openpgp.message.fromText(encryptionText),
        privateKeys: (key.isPrivate() ? key : null),
        publicKeys: (key.isPublic() ? key : null),
        armor: true,
        passwords: [encryptionPassphrase]
    });

    cipherText = (message as any).data;
    console.log(message);
};

const decryptWithKey = async (key: OpenPGP.key.Key) => {
    let message = await openpgp.decrypt(<OpenPGP.DecryptOptions>{
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
const str_html_escape = (str: string) => { // http://stackoverflow.com/questions/1219860/html-encoding-lost-when-attribute-read-from-input-field
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
};

const test = (f: () => any) => {
    try {
        return '[-] ' + f();
    } catch(e) {
        return '[' + e.message + ']';
    }
}

const appendResult = (str: string, err?: Error) => {
    $('pre').append(`(${_i++}) ${str_html_escape(str)} ${(err ? str_html_escape(` !! ${err.message}`) : '')} \n`);
};
// END

const outputKeyResults = async (keys: OpenPGP.key.Key[]) => {
    _i = 1
    appendResult(`Primary keys found: ${keys.length}`);

    keys.map(async (key, ki) => {
        const kn = `PK ${ki} >`;
        if (!key.isPrivate() && !key.isPublic()) {
            appendResult(`${kn} key is neither public or private!!`);
            return;
        }

        console.log(key);

        const primaryUser = await key.getPrimaryUser();
        const decrypted = await decryptPrivateKey(key);
        const verified = await key.verifyPrimaryKey();
        const expiration = await key.getExpirationTime();

        console.log(primaryUser, decrypted, verified, expiration);

        appendResult(`${kn} Is Private? ${test(() => {return key.isPrivate()})}`);
        appendResult(`${kn} Primary User: ${test(() => {return primaryUser.user.userId.userid})}`);
        appendResult(`${kn} Fingerprint: ${test(() => {return key.getFingerprint()})}`);
        // appendResult(`${kn} Has valid encryption packet? ${test(async () => {return;})}`);                                // No longer exists on object
        appendResult(`${kn} Subkeys: ${test(() => {return key.subKeys ? key.subKeys.length : key.subKeys})}`);
        appendResult(`${kn} Primary key algo: ${test(() => {return key.primaryKey.algorithm})}`);
        appendResult(`${kn} Primary key decrypt: ${test(() => {return decrypted;})}`);
        appendResult(`${kn} Primary key verify: ${test(() => {return verified;})}`);
        appendResult(`${kn} Primary key expiration? ${test(() => {return expiration;})}`);

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
            appendResult(`${skn} Algo: ${test(() => {return (subkey as OpenPGP.key.SubKey | any).keyPacket.algorithm;})}`);
            // appendResult(`${skn} Valid encryption key?: ${test(() => {return subkey.isValidEncryptionKey();})}); // No longer exists on object
            // appendResult(`${skn} Expiration time: ${test(() => {return skExpiration;})}`);                       // see error described above
            appendResult(`${skn} Verify: ${test(() => {return skVerified;})}`);
            appendResult(`${skn} Subkey tag: ${test(() => {return (subkey as OpenPGP.key.SubKey | any).keyPacket.tag;})}`);
            // appendResult(`${skn} Subkey getBitSize: ${test(() => {return subkey.subKey.getBitSize();})}`);       // No longer exists on object
            // appendResult(`${skn} Valid signing key: ${test(() => {return subkey.isValidSigningKey();})}`);       // No longer exists on object
            // appendResult(`${skn} Decrypt attempt: ${test(() => {return subkey.subKey.decrypt(passphrase);})}`);  // No longer exists on object, seems to be decrypted when parent key is decrypted
            appendResult(`${skn} Subkey decrypted: ${test(() => {return subkey.isDecrypted();})}`);
            appendResult(`${skn} Binding signature length: ${test(() => {return subkey.bindingSignatures.length;})}`);

            subkey.bindingSignatures.map(async (sig, sgi) => {
                const sgn = `${skn} SIG ${sgi} >`;
                appendResult(`${sgn} Key flags: ${test(() => {return sig.keyFlags;})}`);
                appendResult(`${sgn} Tag: ${test(() => {return sig.tag;})}`);
                appendResult(`${sgn} Version: ${test(() => {return sig.version;})}`);
                appendResult(`${sgn} Public key algorithm: ${test(() => {return sig.publicKeyAlgorithm;})}`);
                appendResult(`${sgn} Key expiration time: ${test(() => {return sig.keyExpirationTime;})}`);
                appendResult(`${sgn} Verified: ${test(() => {return sig.verified;})}`);
            })
        });


        // TODO: Add appendResult calls for each of the following functions
        // possibly a simple success / error message depending on the result

        if (key.isPublic()) {
            await encryptWithKey(key);
        }

        if (key.isPrivate()) {
            if (! await decryptPrivateKey(key)) {
                return;
            };
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
        let keyBytes = new TextEncoder().encode(keyString);
        let openpgpKey = await openpgp.key.read(keyBytes);

        // key is either armoured or not valid
        if (openpgpKey.keys.length === 0) {
            // read the key as armoured
            let armoredOpenpgpKey = await openpgp.key.readArmored(keyString);
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