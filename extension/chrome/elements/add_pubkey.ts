/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch } from '../../js/common/platform/catch.js';
import { Store } from '../../js/common/platform/store.js';
import { Xss, Ui, KeyImportUi, UserAlert, Env } from '../../js/common/browser.js';
import { BrowserMsg } from '../../js/common/extension.js';

Catch.try(async () => {

  Ui.event.protect();

  const uncheckedUrlParams = Env.urlParams(['acctEmail', 'parentTabId', 'emails', 'placement']);
  const acctEmail = Env.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
  const parentTabId = Env.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');
  const emails = Env.urlParamRequire.string(uncheckedUrlParams, 'emails').split(',');
  const placement = Env.urlParamRequire.optionalString(uncheckedUrlParams, 'placement');

  const closeDialog = () => BrowserMsg.send.closeDialog(parentTabId);

  for (const email of emails) {
    Xss.sanitizeAppend('select.email', `<option value="${Xss.escape(email)}">${Xss.escape(email)}</option>`);
  }

  const contacts = await Store.dbContactSearch(undefined, { has_pgp: true });

  Xss.sanitizeAppend('select.copy_from_email', '<option value=""></option>');
  for (const contact of contacts) {
    Xss.sanitizeAppend('select.copy_from_email', `<option value="${Xss.escape(contact.email)}">${Xss.escape(contact.email)}</option>`);
  }

  $('select.copy_from_email').change(Ui.event.handle(async target => {
    if ($(target).val()) {
      const [contact] = await Store.dbContactGet(undefined, [String($(target).val())]);
      if (contact && contact.pubkey) {
        $('.pubkey').val(contact.pubkey).prop('disabled', true);
      } else {
        await Ui.modal.error('Contact not found.');
      }
    } else {
      $('.pubkey').val('').prop('disabled', false);
    }
  }));

  $('.action_ok').click(Ui.event.handle(async () => {
    try {
      const keyImportUi = new KeyImportUi({ checkEncryption: true });
      const normalized = await keyImportUi.checkPub(String($('.pubkey').val()));
      await Store.dbContactSave(undefined, await Store.dbContactObj(String($('select.email').val()), undefined, 'pgp', normalized, undefined, false, Date.now()));
      closeDialog();
    } catch (e) {
      if (e instanceof UserAlert) {
        await Ui.modal.warning(e.message);
      } else {
        Catch.handleErr(e);
        await Ui.modal.error(`Error happened when processing the public key: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }));

  if (placement !== 'settings') {
    $('.action_settings').click(Ui.event.handle(() => BrowserMsg.send.bg.settings({ path: 'index.htm', page: '/chrome/settings/modules/contacts.htm', acctEmail })));
  } else {
    $('#content').addClass('inside_compose');
  }

  $('.action_close').click(Ui.event.handle(closeDialog));

})();
