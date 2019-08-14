/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch } from '../../../js/common/platform/catch.js';
import { Store } from '../../../js/common/platform/store.js';
import { Ui, Env } from '../../../js/common/browser.js';
import { Settings } from '../../../js/common/settings.js';
import { Pgp } from '../../../js/common/core/pgp.js';
import { Lang } from '../../../js/common/lang.js';
import { Assert } from '../../../js/common/assert.js';
import { Attester } from '../../../js/common/api/attester.js';
import { Api } from '../../../js/common/api/api.js';

declare const openpgp: typeof OpenPGP;

Catch.try(async () => {

  const uncheckedUrlParams = Env.urlParams(['acctEmail', 'longid', 'parentTabId']);
  const acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
  const longid = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'longid') || 'primary';
  const showKeyUrl = Env.urlCreate('my_key.htm', uncheckedUrlParams);

  $('.action_show_public_key').attr('href', showKeyUrl);
  const inputPrivateKey = $('.input_private_key');
  const prvHeaders = Pgp.armor.headers('privateKey');

  const [primaryKi] = await Store.keysGet(acctEmail, [longid]);

  Assert.abortAndRenderErrorIfKeyinfoEmpty(primaryKi);

  $('.email').text(acctEmail);
  $('.key_words').text(primaryKi.keywords).attr('title', primaryKi.longid);
  inputPrivateKey.attr('placeholder', inputPrivateKey.attr('placeholder') + ' (' + primaryKi.longid + ')');

  $('.action_update_private_key').click(Ui.event.prevent('double', async () => {
    const { keys: [uddatedKey] } = await openpgp.key.readArmored(String(inputPrivateKey.val()));
    const { keys: [uddatedKeyEncrypted] } = await openpgp.key.readArmored(String(inputPrivateKey.val()));
    const uddatedKeyPassphrase = String($('.input_passphrase').val());
    if (typeof uddatedKey === 'undefined') {
      await Ui.modal.warning(Lang.setup.keyFormattedWell(prvHeaders.begin, String(prvHeaders.end)));
    } else if (uddatedKey.isPublic()) {
      await Ui.modal.warning('This was a public key. Please insert a private key instead. It\'s a block of text starting with "' + prvHeaders.begin + '"');
    } else if (await Pgp.key.fingerprint(uddatedKey) !== await Pgp.key.fingerprint(primaryKi.public)) {
      await Ui.modal.warning(`This key ${await Pgp.key.longid(uddatedKey)} does not match your current key ${primaryKi.longid}`);
    } else if (await Pgp.key.decrypt(uddatedKey, uddatedKeyPassphrase) !== true) {
      await Ui.modal.error('The pass phrase does not match.\n\nPlease enter pass phrase of the newly updated key.');
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
          await Ui.modal.warning('Key update: This looks like a valid key but it cannot be used for encryption. Email human@flowcrypt.com to see why is that. We\'re prompt to respond.');
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
    if (await Ui.modal.confirm('Public and private key updated locally.\n\nUpdate public records with new Public Key?')) {
      try {
        await Ui.modal.info(await Attester.updatePubkey(primaryKi.longid, updatedPrv.toPublic().armor()));
      } catch (e) {
        if (Api.err.isSignificant(e)) {
          Catch.reportErr(e);
        }
        await Ui.modal.error(`Error updating public records:\n\n${Api.err.eli5(e)}\n\n(but local update was successful)`);
      }
    }
    window.location.href = showKeyUrl;
  };

})();
