/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch, Ui, Env, Xss } from './../../js/common/common.js';
import { Store } from './../../js/common/storage.js';
import { KeyImportUI, UserAlert } from './../../js/common/key_import.js';
import { Pgp } from '../../js/common/pgp.js';
import { BrowserMsg } from '../../js/common/extension.js';

Catch.try(async () => {

  Ui.event.protect();

  let url_params = Env.url_params(['account_email', 'parent_tab_id', 'emails', 'placement']);
  let account_email = Env.url_param_require.string(url_params, 'account_email');
  let parent_tab_id = Env.url_param_require.string(url_params, 'parent_tab_id');

  let close_dialog = () => BrowserMsg.send(parent_tab_id, 'close_dialog');

  for (let email of (url_params.emails as string).split(',')) {
    Xss.sanitize_append('select.email', `<option value="${Xss.html_escape(email)}">${Xss.html_escape(email)}</option>`);
  }

  let contacts = await Store.db_contact_search(null, {has_pgp: true});

  Xss.sanitize_append('select.copy_from_email', '<option value=""></option>');
  for (let contact of contacts) {
    Xss.sanitize_append('select.copy_from_email', `<option value="${Xss.html_escape(contact.email)}">${Xss.html_escape(contact.email)}</option>`);
  }

  $('select.copy_from_email').change(Ui.event.handle(async target => {
    if ($(target).val()) {
      let [contact] = await Store.db_contact_get(null, [$(target).val() as string]);
      if (contact && contact.pubkey) {
        $('.pubkey').val(contact.pubkey).prop('disabled', true);
      } else {
        alert('Contact not found.');
      }
    } else {
      $('.pubkey').val('').prop('disabled', false);
    }
  }));

  $('.action_ok').click(Ui.event.handle(async () => {
    try {
      let key_import_ui = new KeyImportUI({check_encryption: true});
      let normalized = await key_import_ui.check_pub(Pgp.armor.strip($('.pubkey').val() as string)); // .pubkey is a textarea
      await Store.db_contact_save(null, Store.db_contact_object($('select.email').val() as string, null, 'pgp', normalized, null, false, Date.now()));
      close_dialog();
    } catch (e) {
      if(e instanceof UserAlert) {
        return alert(e.message);
      } else {
        Catch.handle_exception(e);
        return alert(`Error happened when processing the public key: ${e.message}`);
      }
    }
  }));

  if (url_params.placement !== 'settings') {
    $('.action_settings').click(Ui.event.handle(() => BrowserMsg.send(null, 'settings', {
      path: 'index.htm',
      page: '/chrome/settings/modules/contacts.htm',
      account_email,
    })));
  } else {
    $('#content').addClass('inside_compose');
  }

  $('.action_close').click(Ui.event.handle(close_dialog));

})();
