/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store } from '../../../js/common/store.js';
import { Catch, Env } from '../../../js/common/common.js';
import { Ui } from '../../../js/common/browser.js';
import { Settings } from '../../../js/common/settings.js';
import { Pgp } from '../../../js/common/pgp.js';

declare const openpgp: typeof OpenPGP;

Catch.try(async () => {

  let urlParams = Env.urlParams(['account_email', 'longid', 'parent_tab_id']);
  let account_email = Env.urlParamRequire.string(urlParams, 'account_email');
  let parent_tab_id = Env.urlParamRequire.string(urlParams, 'parent_tab_id');

  let url_my_key_page = Env.urlCreate('my_key.htm', urlParams);
  $('.action_show_public_key').attr('href', url_my_key_page);
  let input_private_key = $('.input_private_key');
  let prv_headers = Pgp.armor.headers('private_key');

  let [primary_ki] = await Store.keysGet(account_email, [urlParams.longid as string || 'primary']);

  Settings.abort_and_render_error_if_keyinfo_empty(primary_ki);

  $('.email').text(account_email);
  $('.key_words').text(primary_ki.keywords).attr('title', primary_ki.longid);
  input_private_key.attr('placeholder', input_private_key.attr('placeholder') + ' (' + primary_ki.longid + ')');

  $('.action_update_private_key').click(Ui.event.prevent('double', async () => {
    let updated_key = openpgp.key.readArmored(input_private_key.val() as string).keys[0];
    let updated_key_encrypted = openpgp.key.readArmored(input_private_key.val() as string).keys[0];
    let updated_key_passphrase = $('.input_passphrase').val() as string;
    if (typeof updated_key === 'undefined') {
      alert('Private key is not correctly formated. Please insert complete key, including "' + prv_headers.begin + '" and "' + prv_headers.end + '"\n\nEnter the private key you previously used. The corresponding public key is registered with your email, and the private key is needed to confirm this change.\n\nIf you chose to download your backup as a file, you should find it inside that file. If you backed up your key on Gmail, you will find there it by searching your inbox.');
    } else if (updated_key.isPublic()) {
      alert('This was a public key. Please insert a private key instead. It\'s a block of text starting with "' + prv_headers.begin + '"');
    } else if (Pgp.key.fingerprint(updated_key) !== Pgp.key.fingerprint(primary_ki.public)) {
      alert('This key ' + Pgp.key.longid(updated_key) + ' does not match your current key ' + primary_ki.longid);
    } else if (await Pgp.key.decrypt(updated_key, [updated_key_passphrase]) !== true) {
      alert('The pass phrase does not match.\n\nPlease enter pass phrase of the newly updated key.');
    } else {
      if (await updated_key.getEncryptionKey() !== null) {
        await store_updated_key_and_passphrase(updated_key_encrypted, updated_key_passphrase);
      } else { // cannot get a valid encryption key packet
        if ((await updated_key.verifyPrimaryKey() === openpgp.enums.keyStatus.no_self_cert) || await Pgp.key.usable_but_expired(updated_key)) { // known issues - key can be fixed
          let fixed_encrypted_prv = await Settings.render_prv_compatibility_fix_ui_and_wait_until_submitted_by_user(account_email, '.compatibility_fix_container', updated_key_encrypted, updated_key_passphrase, url_my_key_page);
          await store_updated_key_and_passphrase(fixed_encrypted_prv, updated_key_passphrase);
        } else {
          alert('Key update: This looks like a valid key but it cannot be used for encryption. Email human@flowcrypt.com to see why is that. We\'re prompt to respond.');
          window.location.href = url_my_key_page;
        }
      }
    }
  }));

  let store_updated_key_and_passphrase = async (updated_prv: OpenPGP.key.Key, updated_prv_passphrase: string) => {
    let stored_passphrase = await Store.passphrase_get(account_email, primary_ki.longid, true);
    await Store.keys_add(account_email, updated_prv.armor());
    await Store.passphrase_save('local', account_email, primary_ki.longid, stored_passphrase !== null ? updated_prv_passphrase : undefined);
    await Store.passphrase_save('session', account_email, primary_ki.longid, stored_passphrase !== null ? undefined : updated_prv_passphrase);
    alert('Public and private key updated.\n\nPlease send updated PUBLIC key to human@flowcrypt.com to update Attester records.');
    window.location.href = url_my_key_page;
  };

})();
