/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store } from '../../../js/common/platform/store.js';
import { Ui, Env } from '../../../js/common/browser.js';
import { Settings } from '../../../js/common/settings.js';
import { Pgp } from '../../../js/common/core/pgp.js';
import { Lang } from '../../../js/common/lang.js';
import { Catch } from '../../../js/common/platform/catch.js';

declare const openpgp: typeof OpenPGP;

Catch.try(async () => {

  const uncheckedUrlParams = Env.urlParams(['acctEmail', 'longid', 'parentTabId']);
  const acctEmail = Env.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
  const longid = Env.urlParamRequire.optionalString(uncheckedUrlParams, 'longid') || 'primary';
  const showKeyUrl = Env.urlCreate('my_key.htm', uncheckedUrlParams);

  $('.action_show_public_key').attr('href', showKeyUrl);
  const inputPrivateKey = $('.input_private_key');
  const prvHeaders = Pgp.armor.headers('privateKey');

  const [primaryKi] = await Store.keysGet(acctEmail, [longid]);

  Ui.abortAndRenderErrorIfKeyinfoEmpty(primaryKi);

  $('.email').text(acctEmail);
  $('.key_words').text(primaryKi.keywords).attr('title', primaryKi.longid);
  inputPrivateKey.attr('placeholder', inputPrivateKey.attr('placeholder') + ' (' + primaryKi.longid + ')');

  $('.action_update_private_key').click(Ui.event.prevent('double', async () => {
    const { keys: [uddatedKey] } = await openpgp.key.readArmored(String(inputPrivateKey.val()));
    const { keys: [uddatedKeyEncrypted] } = await openpgp.key.readArmored(String(inputPrivateKey.val()));
    const uddatedKeyPassphrase = String($('.input_passphrase').val());
    if (typeof uddatedKey === 'undefined') {
      alert(Lang.setup.keyFormattedWell(prvHeaders.begin, String(prvHeaders.end)));
    } else if (uddatedKey.isPublic()) {
      alert('This was a public key. Please insert a private key instead. It\'s a block of text starting with "' + prvHeaders.begin + '"');
    } else if (await Pgp.key.fingerprint(uddatedKey) !== await Pgp.key.fingerprint(primaryKi.public)) {
      alert(`This key ${await Pgp.key.longid(uddatedKey)} does not match your current key ${primaryKi.longid}`);
    } else if (await Pgp.key.decrypt(uddatedKey, [uddatedKeyPassphrase]) !== true) {
      alert('The pass phrase does not match.\n\nPlease enter pass phrase of the newly updated key.');
    } else {
      if (await uddatedKey.getEncryptionKey()) {
        await storeUpdatedKeyAndPassphrase(uddatedKeyEncrypted, uddatedKeyPassphrase);
      } else { // cannot get a valid encryption key packet
        if ((await uddatedKey.verifyPrimaryKey() === openpgp.enums.keyStatus.no_self_cert) || await Pgp.key.usableButExpired(uddatedKey)) { // known issues - key can be fixed
          const fixedEncryptedPrv = await Settings.renderPrvCompatFixUiAndWaitTilSubmittedByUser(
            acctEmail, '.compatibility_fix_container', uddatedKeyEncrypted, uddatedKeyPassphrase, showKeyUrl
          );
          await storeUpdatedKeyAndPassphrase(fixedEncryptedPrv, uddatedKeyPassphrase);
        } else {
          alert('Key update: This looks like a valid key but it cannot be used for encryption. Email human@flowcrypt.com to see why is that. We\'re prompt to respond.');
          window.location.href = showKeyUrl;
        }
      }
    }
  }));

  const storeUpdatedKeyAndPassphrase = async (updatedPrv: OpenPGP.key.Key, updatedPrvPassphrase: string) => {
    const storedPassphrase = await Store.passphraseGet(acctEmail, primaryKi.longid, true);
    await Store.keysAdd(acctEmail, updatedPrv.armor());
    await Store.passphraseSave('local', acctEmail, primaryKi.longid, typeof storedPassphrase !== 'undefined' ? updatedPrvPassphrase : undefined);
    await Store.passphraseSave('session', acctEmail, primaryKi.longid, typeof storedPassphrase !== 'undefined' ? undefined : updatedPrvPassphrase);
    alert('Public and private key updated.\n\nPlease send updated PUBLIC key to human@flowcrypt.com to update Attester records.');
    window.location.href = showKeyUrl;
  };

})();
