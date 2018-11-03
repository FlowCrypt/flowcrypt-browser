/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store } from '../../../js/common/storage.js';
import { Catch, Env, Dict } from '../../../js/common/common.js';
import { Xss, Ui } from '../../../js/common/browser.js';
import { Pgp } from '../../../js/common/pgp.js';
import { Settings } from '../settings.js';
import { Api } from '../../../js/common/api.js';

declare const openpgp: typeof OpenPGP;

Catch.try( async () => {

  let url_params = Env.url_params(['account_email', 'embedded', 'parent_tab_id']);
  let account_email = Env.url_param_require.string(url_params, 'account_email');
  let parent_tab_id = Env.url_param_require.string(url_params, 'parent_tab_id');

  await Ui.passphrase_toggle(['passphrase_entry']);

  let [primary_ki] = await Store.keys_get(account_email, ['primary']);
  Settings.abort_and_render_error_if_keyinfo_empty(primary_ki, false);
  if (!primary_ki) {
    return; // added do_throw=false above + manually exiting here because security.htm can indeed be commonly rendered on setup page before setting acct up
  }

  let storage = await Store.get_account(account_email, ['hide_message_password', 'outgoing_language']);

  if (url_params.embedded) {
    $('.change_passhrase_container, .title_container').css('display', 'none');
    $('.line').css('padding', '7px 0');
  }

  let on_default_expire_user_change = async () => {
    Xss.sanitize_render('.select_loader_container', Ui.spinner('green'));
    $('.default_message_expire').css('display', 'none');
    await Api.fc.account_update({default_message_expire: Number($('.default_message_expire').val())});
    window.location.reload();
  };

  let on_message_language_user_change = async () => {
    await Store.set(account_email, {outgoing_language: $('.password_message_language').val()});
    window.location.reload();
  };

  let stored_passphrase = await Store.passphrase_get(account_email, primary_ki.longid, true);
  if (stored_passphrase === null) {
    $('#passphrase_to_open_email').prop('checked', true);
  }
  $('#passphrase_to_open_email').change(Ui.event.handle(() => {
    $('.passhprase_checkbox_container').css('display', 'none');
    $('.passphrase_entry_container').css('display', 'block');
  }));

  $('.action_change_passphrase').click(Ui.event.handle(() => Settings.redirect_sub_page(account_email, parent_tab_id, '/chrome/settings/modules/change_passphrase.htm')));

  $('.action_test_passphrase').click(Ui.event.handle(() => Settings.redirect_sub_page(account_email, parent_tab_id, '/chrome/settings/modules/test_passphrase.htm')));

  $('.confirm_passphrase_requirement_change').click(Ui.event.handle(async () => {
    if ($('#passphrase_to_open_email').is(':checked')) { // todo - forget pass all phrases, not just master
      let stored_passphrase = await Store.passphrase_get(account_email, primary_ki.longid);
      if ($('input#passphrase_entry').val() === stored_passphrase) {
        await Store.passphrase_save('local', account_email, primary_ki.longid, undefined);
        await Store.passphrase_save('session', account_email, primary_ki.longid, undefined);
        window.location.reload();
      } else {
        alert('Pass phrase did not match, please try again.');
        $('input#passphrase_entry').val('').focus();
      }
    } else { // save pass phrase
      let key = openpgp.key.readArmored(primary_ki.private).keys[0];
      if (await Pgp.key.decrypt(key, [$('input#passphrase_entry').val() as string]) === true) { // text input
        await Store.passphrase_save('local', account_email, primary_ki.longid, $('input#passphrase_entry').val() as string);
        window.location.reload();
      } else {
        alert('Pass phrase did not match, please try again.');
        $('input#passphrase_entry').val('').focus();
      }
    }
  }));

  $('.cancel_passphrase_requirement_change').click(() =>  window.location.reload());

  $('#hide_message_password').prop('checked', storage.hide_message_password === true);
  $('.password_message_language').val(storage.outgoing_language || 'EN');
  $('#hide_message_password').change(Ui.event.handle(async target => {
    await Store.set(account_email, {hide_message_password: $(target).is(':checked')});
    window.location.reload();
  }));

  $('.password_message_language').change(Ui.event.handle(on_message_language_user_change));

  let subscription = await Store.subscription();
  if (subscription.active) {
    Xss.sanitize_render('.select_loader_container', Ui.spinner('green'));
    try {
      let response = await Api.fc.account_update();
      $('.select_loader_container').text('');
      $('.default_message_expire').val(Number(response.result.default_message_expire).toString()).prop('disabled', false).css('display', 'inline-block');
      $('.default_message_expire').change(Ui.event.handle(on_default_expire_user_change));
    } catch (e) {
      if (Api.error.is_auth_error(e)) {
        Xss.sanitize_render('.expiration_container', '(unknown: <a href="#">verify your device</a>)').find('a').click(Ui.event.handle(() => Settings.redirect_sub_page(account_email, parent_tab_id, '/chrome/elements/subscribe.htm', '&source=auth_error')));
      } else if (Api.error.is_network_error(e)) {
        Xss.sanitize_render('.expiration_container', '(network error: <a href="#">retry</a>)').find('a').click(() => window.location.reload()); // safe source
      } else {
        Catch.handle_exception(e);
        Xss.sanitize_render('.expiration_container', '(unknown error: <a href="#">retry</a>)').find('a').click(() => window.location.reload()); // safe source
      }
    }
  } else {
    $('.default_message_expire').val('3').css('display', 'inline-block');
    Xss.sanitize_append($('.default_message_expire').parent(), '<a href="#">upgrade</a>').find('a').click(Ui.event.handle(() => Settings.redirect_sub_page(account_email, parent_tab_id, '/chrome/elements/subscribe.htm')));
  }

})();
