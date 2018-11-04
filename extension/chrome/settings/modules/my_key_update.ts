/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store } from '../../../js/common/store.js';
import { Catch, Env } from '../../../js/common/common.js';
import { Ui } from '../../../js/common/browser.js';
import { Settings } from '../../../js/common/settings.js';
import { Pgp } from '../../../js/common/pgp.js';

declare const openpgp: typeof OpenPGP;

Catch.try(async () => {

  let urlParams = Env.urlParams(['acctEmail', 'longid', 'parentTabId']);
  let acctEmail = Env.urlParamRequire.string(urlParams, 'acctEmail');
  let parentTabId = Env.urlParamRequire.string(urlParams, 'parentTabId');

  let urlMyKeyPage = Env.urlCreate('my_key.htm', urlParams);
  $('.action_show_public_key').attr('href', urlMyKeyPage);
  let inputPrivateKey = $('.input_private_key');
  let prvHeaders = Pgp.armor.headers('privateKey');

  let [primaryKi] = await Store.keysGet(acctEmail, [urlParams.longid as string || 'primary']);

  Settings.abortAndRenderErrorIfKeyinfoEmpty(primaryKi);

  $('.email').text(acctEmail);
  $('.key_words').text(primaryKi.keywords).attr('title', primaryKi.longid);
  inputPrivateKey.attr('placeholder', inputPrivateKey.attr('placeholder') + ' (' + primaryKi.longid + ')');

  $('.action_update_private_key').click(Ui.event.prevent('double', async () => {
    let uddatedKey = openpgp.key.readArmored(inputPrivateKey.val() as string).keys[0];
    let uddatedKeyEncrypted = openpgp.key.readArmored(inputPrivateKey.val() as string).keys[0];
    let uddatedKeyPassphrase = $('.input_passphrase').val() as string;
    if (typeof uddatedKey === 'undefined') {
      alert('Private key is not correctly formated. Please insert complete key, including "' + prvHeaders.begin + '" and "' + prvHeaders.end + '"\n\nEnter the private key you previously used. The corresponding public key is registered with your email, and the private key is needed to confirm this change.\n\nIf you chose to download your backup as a file, you should find it inside that file. If you backed up your key on Gmail, you will find there it by searching your inbox.');
    } else if (uddatedKey.isPublic()) {
      alert('This was a public key. Please insert a private key instead. It\'s a block of text starting with "' + prvHeaders.begin + '"');
    } else if (Pgp.key.fingerprint(uddatedKey) !== Pgp.key.fingerprint(primaryKi.public)) {
      alert('This key ' + Pgp.key.longid(uddatedKey) + ' does not match your current key ' + primaryKi.longid);
    } else if (await Pgp.key.decrypt(uddatedKey, [uddatedKeyPassphrase]) !== true) {
      alert('The pass phrase does not match.\n\nPlease enter pass phrase of the newly updated key.');
    } else {
      if (await uddatedKey.getEncryptionKey() !== null) {
        await storeUpdatedKeyAndPassphrase(uddatedKeyEncrypted, uddatedKeyPassphrase);
      } else { // cannot get a valid encryption key packet
        if ((await uddatedKey.verifyPrimaryKey() === openpgp.enums.keyStatus.no_self_cert) || await Pgp.key.usableButExpired(uddatedKey)) { // known issues - key can be fixed
          let fixedEncryptedPrv = await Settings.renderPrvCompatibilityFixUiAndWaitUntilSubmittedByUser(acctEmail, '.compatibility_fix_container', uddatedKeyEncrypted, uddatedKeyPassphrase, urlMyKeyPage);
          await storeUpdatedKeyAndPassphrase(fixedEncryptedPrv, uddatedKeyPassphrase);
        } else {
          alert('Key update: This looks like a valid key but it cannot be used for encryption. Email human@flowcrypt.com to see why is that. We\'re prompt to respond.');
          window.location.href = urlMyKeyPage;
        }
      }
    }
  }));

  let storeUpdatedKeyAndPassphrase = async (updated_prv: OpenPGP.key.Key, updated_prv_passphrase: string) => {
    let storedPassphrase = await Store.passphraseGet(acctEmail, primaryKi.longid, true);
    await Store.keysAdd(acctEmail, updated_prv.armor());
    await Store.passphraseSave('local', acctEmail, primaryKi.longid, storedPassphrase !== null ? updated_prv_passphrase : undefined);
    await Store.passphraseSave('session', acctEmail, primaryKi.longid, storedPassphrase !== null ? undefined : updated_prv_passphrase);
    alert('Public and private key updated.\n\nPlease send updated PUBLIC key to human@flowcrypt.com to update Attester records.');
    window.location.href = urlMyKeyPage;
  };

})();
