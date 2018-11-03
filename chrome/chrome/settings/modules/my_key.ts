/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store } from '../../../js/common/storage.js';
import { Catch, Env, Attachment } from '../../../js/common/common.js';
import { Ui } from '../../../js/common/browser.js';
import { Pgp } from '../../../js/common/pgp.js';
import { Settings } from '../settings.js';
import { Api } from '../../../js/common/api.js';

declare const openpgp: typeof OpenPGP;

Catch.try(async () => {

  let url_params = Env.url_params(['account_email', 'longid', 'parent_tab_id']);
  let account_email = Env.url_param_require.string(url_params, 'account_email');
  let parent_tab_id = Env.url_param_require.string(url_params, 'parent_tab_id');

  $('.action_view_user_ids').attr('href', Env.url_create('my_key_user_ids.htm', url_params));
  $('.action_view_update').attr('href', Env.url_create('my_key_update.htm', url_params));

  let [primary_ki] = await Store.keys_get(account_email, [url_params.longid as string || 'primary']);
  Settings.abort_and_render_error_if_keyinfo_empty(primary_ki);

  let key = openpgp.key.readArmored(primary_ki.private).keys[0];

  try {
    let {results: [result]} = await Api.attester.lookup_email([account_email]);
    let url = Api.fc.url('pubkey', account_email);
    if (result.pubkey && Pgp.key.longid(result.pubkey) === primary_ki.longid) {
      $('.pubkey_link_container a').text(url.replace('https://', '')).attr('href', url).parent().css('visibility', 'visible');
    }
  } catch (e) {
    Catch.handle_exception(e);
    $('.pubkey_link_container').remove();
  }

  $('.email').text(account_email);
  $('.key_fingerprint').text(Pgp.key.fingerprint(key, 'spaced')!);
  $('.key_words').text(primary_ki.keywords);
  $('.show_when_showing_public').css('display', '');
  $('.show_when_showing_private').css('display', 'none');

  $('.action_download_pubkey').click(Ui.event.prevent('double', () => {
    Attachment.methods.save_to_downloads(Attachment.methods.keyinfo_as_pubkey_attachment(primary_ki), Env.browser().name === 'firefox' ? $('body') : undefined);
  }));

  $('.action_show_other_type').click(Ui.event.handle(() => {
    if ($('.action_show_other_type').text().toLowerCase() === 'show private key') {
      $('.key_dump').text(key.armor()).removeClass('good').addClass('bad');
      $('.action_show_other_type').text('show public key').removeClass('bad').addClass('good');
      $('.key_type').text('Private Key');
      $('.show_when_showing_public').css('display', 'none');
      $('.show_when_showing_private').css('display', '');
    } else {
      $('.key_dump').text('').removeClass('bad').addClass('good');
      $('.action_show_other_type').text('show private key').removeClass('good').addClass('bad');
      $('.key_type').text('Public Key Info');
      $('.show_when_showing_public').css('display', '');
      $('.show_when_showing_private').css('display', 'none');
    }
  }));

  let clipboard_options = {text: () => key.toPublic().armor()};
  // @ts-ignore
  let cbjs = new window.ClipboardJS('.action_copy_pubkey', clipboard_options);

})();
