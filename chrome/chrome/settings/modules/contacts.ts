/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

tool.catch.try(async () => {

  let url_params = Env.url_params(['account_email', 'parent_tab_id']);
  let account_email = Env.url_param_require.string(url_params, 'account_email');
  let parent_tab_id = Env.url_param_require.string(url_params, 'parent_tab_id');

  let tab_id = await BrowserMsg.required_tab_id();

  let factory = new XssSafeFactory(account_email, tab_id, undefined, undefined, {compact: true});
  let back_button = '<a href="#" id="page_back_button" data-test="action-back-to-contact-list">back</a>';
  let space = '&nbsp;&nbsp;&nbsp;&nbsp;';

  BrowserMsg.listen({}, tab_id); // set_css

  let render_contact_list = async () => {
    let contacts = await Store.db_contact_search(null, { has_pgp: true });

    Ui.sanitize_render('.line.actions', '&nbsp;&nbsp;<a href="#" class="action_export_all">export all</a>&nbsp;&nbsp;').find('.action_export_all').click(Ui.event.prevent(Ui.event.double(), (self) => {
      let all_armored_public_keys = contacts.map(c => (c.pubkey || '').trim()).join('\n');
      let export_file = new Attachment({name: 'public-keys-export.asc', type: 'application/pgp-keys', data: all_armored_public_keys});
      tool.file.save_to_downloads(export_file, Env.browser().name === 'firefox' ? $('.line.actions') : null);
    }));

    Ui.sanitize_append('.line.actions', '&nbsp;&nbsp;<a href="#" class="action_view_bulk_import">import public keys</a>&nbsp;&nbsp;').find('.action_view_bulk_import').off().click(Ui.event.prevent(Ui.event.double(), (self) => {
      $('.hide_when_rendering_subpage').css('display', 'none');
      Ui.sanitize_render('h1', `${back_button}${space}Bulk Public Key Import${space}`);
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
      let e = Xss.html_escape(c.email);
      let show = `<a href="#" class="action_show" data-test="action-show-pubkey"></a>`;
      let change = `<a href="#" class="action_change" data-test="action-change-pubkey"></a>`;
      let remove = `<a href="#" class="action_remove" data-test="action-remove-pubkey"></a>`;
      table_contents += `<tr email="${e}"><td>${e}</td><td>${show}</td><td>${change}</td><td>${remove}</td></tr>`;
    }
    Ui.sanitize_replace('table#emails', `<table id="emails" class="hide_when_rendering_subpage">${table_contents}</table>`);

    $('a.action_show').off().click(Ui.event.prevent(Ui.event.double(), async (self) => {
      let [contact] = await Store.db_contact_get(null, [$(self).closest('tr').attr('email')!]); // defined above
      $('.hide_when_rendering_subpage').css('display', 'none');
      Ui.sanitize_render('h1', `'${back_button}${space}${contact!.email}`); // should exist - from list of contacts
      if (contact!.client === 'cryptup') {
        Ui.sanitize_append('h1', '&nbsp;&nbsp;&nbsp;&nbsp;<img src="/img/logo/flowcrypt-logo-19-19.png" />');
      } else {
        Ui.sanitize_append('h1', '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;');
      }
      $('#view_contact .key_dump').text(contact!.pubkey!); // should exist - from list of contacts && should have pgp - filtered
      $('#view_contact .key_fingerprint').text(contact!.fingerprint!); // should exist - from list of contacts && should have pgp - filtered
      $('#view_contact .key_words').text(contact!.keywords!); // should exist - from list of contacts && should have pgp - filtered
      $('#view_contact').css('display', 'block');
      $('#page_back_button').click(Ui.event.handle(() => render_contact_list()));
    }));

    $('a.action_change').off().click(Ui.event.prevent(Ui.event.double(), self => {
      $('.hide_when_rendering_subpage').css('display', 'none');
      let email = $(self).closest('tr').attr('email')!;
      Ui.sanitize_render('h1', `${back_button}${space}${Xss.html_escape(email)}${space}(edit)`);
      $('#edit_contact').css('display', 'block');
      $('#edit_contact .input_pubkey').val('').attr('email', email);
      $('#page_back_button').click(Ui.event.handle(() => render_contact_list()));
    }));

    $('#edit_contact .action_save_edited_pubkey').off().click(Ui.event.prevent(Ui.event.double(), async (self) => {
      let armored_pubkey = $('#edit_contact .input_pubkey').val() as string; // textarea
      let email = $('#edit_contact .input_pubkey').attr('email');
      if (!armored_pubkey || !email) {
        alert('No public key entered');
      } else if (tool.crypto.key.fingerprint(armored_pubkey) !== null) {
        await Store.db_contact_save(null, Store.db_contact_object(email, null, 'pgp', armored_pubkey, null, false, Date.now()));
        await render_contact_list();
      } else {
        alert('Cannot recognize a valid public key, please try again. Let me know at human@flowcrypt.com if you need help.');
        $('#edit_contact .input_pubkey').val('').focus();
      }
    }));

    $('.action_view_bulk_import').off().click(Ui.event.prevent(Ui.event.double(), self => {
      $('.hide_when_rendering_subpage').css('display', 'none');
      Ui.sanitize_render('h1', `${back_button}${space}Bulk Public Key Import${space}`);
      $('#bulk_import').css('display', 'block');
      $('#bulk_import .input_pubkey').val('').css('display', 'inline-block');
      $('#bulk_import .action_process').css('display', 'inline-block');
      $('#bulk_import #processed').text('').css('display', 'none');
      $('#page_back_button').click(Ui.event.handle(() => render_contact_list()));
    }));

    $('#bulk_import .action_process').off().click(Ui.event.prevent(Ui.event.double(), self => {
      let replaced_html_safe = tool.crypto.armor.replace_blocks(factory, $('#bulk_import .input_pubkey').val() as string); // textarea
      if (!replaced_html_safe || replaced_html_safe === $('#bulk_import .input_pubkey').val()) {
        alert('Could not find any new public keys');
      } else {
        $('#bulk_import #processed').html(replaced_html_safe).css('display', 'block'); // xss-safe-factory
        $('#bulk_import .input_pubkey, #bulk_import .action_process').css('display', 'none');
      }
    }));

    $('a.action_remove').off().click(Ui.event.prevent(Ui.event.double(), async (self) => {
      await Store.db_contact_save(null, Store.db_contact_object($(self).closest('tr').attr('email')!, null, null, null, null, false, null));
      await render_contact_list();
    }));

  };

  await render_contact_list();

})();
