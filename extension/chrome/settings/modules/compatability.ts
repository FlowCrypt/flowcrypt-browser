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

    let key: OpenPGP.key.Key;
    let keyData: {
        type: null | string;
        alg: OpenPGP.key.AlgorithmInfo;
        created: Date;
        expiration: number | Date;
        fingerprint: string;
        key_id: OpenPGP.Keyid;
        revoked: boolean;
    };

    $(".private_key").hide();

  $(".action_test_key").click(
    Ui.event.prevent("double", async self => {
      const keyString = String($(".input_key").val());
      if (!keyString) {
        alert("Please paste an OpenPGP in the input box");
        return;
      }
      if (!("TextEncoder" in window)) {
        alert(
          "Sorry, your browser does not support TextEncoder which is required for this feature"
        );
        return;
      }

      origContent = $(self).html();
      Xss.sanitizeRender(self, "Evaluating.. " + Ui.spinner("white"));

      await performKeyCompatabilityTests(keyString);

      Xss.sanitizeRender(self, origContent);
    })
  );

  const performKeyCompatabilityTests = async (keyString: string) => {
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
      alert("The provided OpenPGP key has an error, check the console for more info.");
      openpgpKey.err.map(err => {
        console.error(err);
      });
      return;
    }

    // check for keys, null or undefined array means OpenPGP.js is having a problem
    if (openpgpKey.keys === null || typeof openpgpKey.keys === "undefined") {
      alert("An error was encountered while processing your provided OpenPGP Key");
      return;
    }

    let ct = openpgpKey.keys.length;
    if (ct === 0) {
      alert("OpenPGP.js returned no keys from request.");
      return;
    }

    key = openpgpKey.keys[0];

    keyData = {
        type: <null | string>null,
        alg: key.getAlgorithmInfo(),
        created: key.getCreationTime(),
        expiration: await key.getExpirationTime(),
        fingerprint: key.getFingerprint(),
        key_id: key.getKeyId(),
        revoked: await key.isRevoked()
    };

    if (key.isPrivate()) {
        keyData.type = 'private';

        // show the private key fields
        $('.private_key').show();
    } else if (key.isPublic()) {
        keyData.type = 'public';
        $(".private_key").hide();
    } else {
      alert("This OpenPGP key is neither public or private according to our libraries.");
      return;
    }
  };

  $('.action_private_password').click(
      Ui.event.prevent('double', async self => {
        const privatePw = String($('.key_password').val());
        if (!privatePw && key.isPrivate()) {
            alert("Please provide a password when encrypting with your private key");
            return;
        }

        if (!await key.decrypt(privatePw)) {
            alert("Sorry your private key was not decrypted with that password. Try again with a different password!");
            return;
        }
      })
  );

  $('.action_encrypt').click(
    Ui.event.prevent('double', async self => {
        const inputString = String($(".text_input").val());
        if (!inputString) {
            alert("Please include a message to be encrypted in the textbox");
            return;
        }

        const privatePw = String($('.key_password').val());
        if (!privatePw && keyData.type === 'private') {
            alert("Please provide a password when encrypting with your private key");
            return;
        }

        let message = await openpgp.encrypt(<OpenPGP.EncryptOptions>{
            message: openpgp.message.fromText(inputString),
            privateKeys: (key.isPrivate() ? key : null),
            publicKeys: (key.isPublic() ? key : null),
            passwords: (key.isPrivate() ? [privatePw] : null)
        });

        console.log((message as any).data);
        $('.text_input').val((message as any).data);
    })
  );

  $('.action_decrypt').click(
    Ui.event.prevent('double', async self => {
        const inputString = String($(".text_input").val());
        if (!inputString) {
            alert("Please include a message to be decrypted in the textbox");
            return;
        }

        const privatePw = String($('.key_password').val());
        if (!privatePw && keyData.type === 'private') {
            alert("Please provide a password when encrypting with your private key");
            return;
        }

        // let inputBytes = new TextEncoder().encode(inputString);

        let message = await openpgp.decrypt(<OpenPGP.DecryptOptions>{
            message: await openpgp.message.readArmored(inputString),
            privateKeys: key,
            passwords: [privatePw]
        });

        console.log(JSON.stringify(message));
        $('.text_input').val((message as any).data);
    })
  );

  $('.action_sign').click(
    Ui.event.prevent('double', async self => {
        const inputString = String($(".text_input").val());
        if (!inputString) {
            alert("Please include a message to be signed in the textbox");
            return;
        }

        let result = await openpgp.message.fromText(inputString).sign([key]);
        console.log(JSON.stringify(result));
    })
  );

  $('.action_verify').click(
    Ui.event.prevent('double', async self => {
        const inputString = String($(".text_input").val());
        if (!inputString) {
            alert("Please include a message to be verified in the textbox");
            return;
        }
        
        let result =  await openpgp.message.fromText(inputString).verify([key]);
        console.log(JSON.stringify(result));
    })
  );
})();
