/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store } from '../../../js/common/store.js';
import { Catch, Env, Dict } from '../../../js/common/common.js';
import { Att } from '../../../js/common/att.js';
import { Xss, Ui, XssSafeFactory } from '../../../js/common/browser.js';
import { BrowserMsg } from '../../../js/common/extension.js';
import { Pgp } from '../../../js/common/pgp.js';

Catch.try(async () => {

  let urlParams = Env.urlParams(['account_email', 'parent_tab_id']);
  let account_email = Env.urlParamRequire.string(urlParams, 'account_email');
  let parent_tab_id = Env.urlParamRequire.string(urlParams, 'parent_tab_id');

  let tab_id = await BrowserMsg.required_tab_id();

  let factory = new XssSafeFactory(account_email, tab_id, undefined, undefined, {compact: true});
  let back_button = '<a href="#" id="page_back_button" data-test="action-back-to-contact-list">back</a>';
  let space = '&nbsp;&nbsp;&nbsp;&nbsp;';

  BrowserMsg.listen({}, tab_id); // set_css

  let render_contact_list = async () => {
    let contacts = await Store.db_contact_search(null, { has_pgp: true });

    Xss.sanitizeRender('.line.actions', '&nbsp;&nbsp;<a href="#" class="action_export_all">export all</a>&nbsp;&nbsp;').find('.action_export_all').click(Ui.event.prevent('double', (self) => {
      let all_armored_public_keys = contacts.map(c => (c.pubkey || '').trim()).join('\n');
      let export_file = new Att({name: 'public-keys-export.asc', type: 'application/pgp-keys', data: all_armored_public_keys});
      Att.methods.saveToDownloads(export_file, Env.browser().name === 'firefox' ? $('.line.actions') : null);
    }));

    Xss.sanitizeAppend('.line.actions', '&nbsp;&nbsp;<a href="#" class="action_view_bulk_import">import public keys</a>&nbsp;&nbsp;').find('.action_view_bulk_import').off().click(Ui.event.prevent('double', (self) => {
      $('.hide_when_rendering_subpage').css('display', 'none');
      Xss.sanitizeRender('h1', `${back_button}${space}Bulk Public Key Import${space}`);
      $('#bulk_import').css('display', 'block');
      $('#bulk_import .input_pubkey').val('').css('display', 'inline-block');
      $('#bulk_import .action_process').css('display', 'inline-block');
      $('#bulk_import #processed').text('').css('display', 'none');
      $('#page_back_button').click(Ui.event.handle(() => render_contact_list()));
    }));

    $('table#emails').text('');
    $('div.hide_when_rendering_subpage').css('display', 'block');
    $('table.hide_when_rendering_subpage').css('display', 'table');
    $('h1').text('Contacts and their Public Keys');
    $('#view_contact, #edit_contact, #bulk_import').css('display', 'none');

    let table_contents = '';
    for (let c of contacts) {
      let e = Xss.htmlEscape(c.email);
      let show = `<a href="#" class="action_show" data-test="action-show-pubkey"></a>`;
      let change = `<a href="#" class="action_change" data-test="action-change-pubkey"></a>`;
      let remove = `<a href="#" class="action_remove" data-test="action-remove-pubkey"></a>`;
      table_contents += `<tr email="${e}"><td>${e}</td><td>${show}</td><td>${change}</td><td>${remove}</td></tr>`;
    }
    Xss.sanitizeReplace('table#emails', `<table id="emails" class="hide_when_rendering_subpage">${table_contents}</table>`);

    $('a.action_show').off().click(Ui.event.prevent('double', async (self) => {
      let [contact] = await Store.db_contact_get(null, [$(self).closest('tr').attr('email')!]); // defined above
      $('.hide_when_rendering_subpage').css('display', 'none');
      Xss.sanitizeRender('h1', `'${back_button}${space}${contact!.email}`); // should exist - from list of contacts
      if (contact!.client === 'cryptup') {
        Xss.sanitizeAppend('h1', '&nbsp;&nbsp;&nbsp;&nbsp;<img src="/img/logo/flowcrypt-logo-19-19.png" />');
      } else {
        Xss.sanitizeAppend('h1', '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;');
      }
      $('#view_contact .key_dump').text(contact!.pubkey!); // should exist - from list of contacts && should have pgp - filtered
      $('#view_contact .key_fingerprint').text(contact!.fingerprint!); // should exist - from list of contacts && should have pgp - filtered
      $('#view_contact .key_words').text(contact!.keywords!); // should exist - from list of contacts && should have pgp - filtered
      $('#view_contact').css('display', 'block');
      $('#page_back_button').click(Ui.event.handle(() => render_contact_list()));
    }));

    $('a.action_change').off().click(Ui.event.prevent('double', self => {
      $('.hide_when_rendering_subpage').css('display', 'none');
      let email = $(self).closest('tr').attr('email')!;
      Xss.sanitizeRender('h1', `${back_button}${space}${Xss.htmlEscape(email)}${space}(edit)`);
      $('#edit_contact').css('display', 'block');
      $('#edit_contact .input_pubkey').val('').attr('email', email);
      $('#page_back_button').click(Ui.event.handle(() => render_contact_list()));
    }));

    $('#edit_contact .action_save_edited_pubkey').off().click(Ui.event.prevent('double', async (self) => {
      let armored_pubkey = $('#edit_contact .input_pubkey').val() as string; // textarea
      let email = $('#edit_contact .input_pubkey').attr('email');
      if (!armored_pubkey || !email) {
        alert('No public key entered');
      } else if (Pgp.key.fingerprint(armored_pubkey) !== null) {
        await Store.db_contact_save(null, Store.dbContactObj(email, null, 'pgp', armored_pubkey, null, false, Date.now()));
        await render_contact_list();
      } else {
        alert('Cannot recognize a valid public key, please try again. Let me know at human@flowcrypt.com if you need help.');
        $('#edit_contact .input_pubkey').val('').focus();
      }
    }));

    $('.action_view_bulk_import').off().click(Ui.event.prevent('double', self => {
      $('.hide_when_rendering_subpage').css('display', 'none');
      Xss.sanitizeRender('h1', `${back_button}${space}Bulk Public Key Import${space}`);
      $('#bulk_import').css('display', 'block');
      $('#bulk_import .input_pubkey').val('').css('display', 'inline-block');
      $('#bulk_import .action_process').css('display', 'inline-block');
      $('#bulk_import #processed').text('').css('display', 'none');
      $('#page_back_button').click(Ui.event.handle(() => render_contact_list()));
    }));

    $('#bulk_import .action_process').off().click(Ui.event.prevent('double', self => {
      let replaced_html_safe = Pgp.armor.replace_blocks(factory, $('#bulk_import .input_pubkey').val() as string); // textarea
      if (!replaced_html_safe || replaced_html_safe === $('#bulk_import .input_pubkey').val()) {
        alert('Could not find any new public keys');
      } else {
        $('#bulk_import #processed').html(replaced_html_safe).css('display', 'block'); // xss-safe-factory
        $('#bulk_import .input_pubkey, #bulk_import .action_process').css('display', 'none');
      }
    }));

    $('a.action_remove').off().click(Ui.event.prevent('double', async (self) => {
      await Store.db_contact_save(null, Store.dbContactObj($(self).closest('tr').attr('email')!, null, null, null, null, false, null));
      await render_contact_list();
    }));

  };

  await render_contact_list();

})();
