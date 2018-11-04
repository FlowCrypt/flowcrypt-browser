/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch, Env, Dict } from './../../js/common/common.js';
import { Xss, Ui, KeyImportUi, UserAlert } from '../../js/common/browser.js';
import { Store } from '../../js/common/store.js';
import { Pgp } from '../../js/common/pgp.js';
import { BrowserMsg } from '../../js/common/extension.js';

Catch.try(async () => {

  Ui.event.protect();

  let urlParams = Env.urlParams(['acctEmail', 'parentTabId', 'emails', 'placement']);
  let acctEmail = Env.urlParamRequire.string(urlParams, 'acctEmail');
  let parentTabId = Env.urlParamRequire.string(urlParams, 'parentTabId');

  let closeDialog = () => BrowserMsg.send(parentTabId, 'close_dialog');

  for (let email of (urlParams.emails as string).split(',')) {
    Xss.sanitizeAppend('select.email', `<option value="${Xss.htmlEscape(email)}">${Xss.htmlEscape(email)}</option>`);
  }

  let contacts = await Store.dbContactSearch(null, { has_pgp: true });

  Xss.sanitizeAppend('select.copy_from_email', '<option value=""></option>');
  for (let contact of contacts) {
    Xss.sanitizeAppend('select.copy_from_email', `<option value="${Xss.htmlEscape(contact.email)}">${Xss.htmlEscape(contact.email)}</option>`);
  }

  $('select.copy_from_email').change(Ui.event.handle(async target => {
    if ($(target).val()) {
      let [contact] = await Store.dbContactGet(null, [$(target).val() as string]);
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
      let keyImportUi = new KeyImportUi({ checkEncryption: true });
      let normalized = await keyImportUi.checkPub(Pgp.armor.strip($('.pubkey').val() as string)); // .pubkey is a textarea
      await Store.dbContactSave(null, Store.dbContactObj($('select.email').val() as string, null, 'pgp', normalized, null, false, Date.now()));
      closeDialog();
    } catch (e) {
      if (e instanceof UserAlert) {
        return alert(e.message);
      } else {
        Catch.handleException(e);
        return alert(`Error happened when processing the public key: ${e.message}`);
      }
    }
  }));

  if (urlParams.placement !== 'settings') {
    $('.action_settings').click(Ui.event.handle(() => BrowserMsg.send(null, 'settings', {
      path: 'index.htm',
      page: '/chrome/settings/modules/contacts.htm',
      acctEmail,
    })));
  } else {
    $('#content').addClass('inside_compose');
  }

  $('.action_close').click(Ui.event.handle(closeDialog));

})();
