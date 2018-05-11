/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

let url_params = tool.env.url_params(['account_email']);

tool.browser.message.tab_id(function(tab_id) {

  let factory = new Factory(url_params.account_email, tab_id, undefined, undefined, undefined, {compact: true});

  tool.browser.message.listen({
    set_css: function (data) {
      $(data.selector).css(data.css);
    },
  }, tab_id);

  function render_contact_list() {
    window.flowcrypt_storage.db_contact_search(null, { has_pgp: true }, function (contacts) {

      $('.line.actions').html('&nbsp;&nbsp;<a href="#" class="action_export_all">export all</a>&nbsp;&nbsp;').find('.action_export_all').click(tool.ui.event.prevent(tool.ui.event.double(), function (self) {
        let all_armored_public_keys = contacts.map(c => c.pubkey.trim()).join('\n');
        tool.file.save_to_downloads('public-keys-export.asc', 'application/pgp-keys', all_armored_public_keys, tool.env.browser().name === 'firefox' ? $('.line.actions') : null);
      }));

      $('.line.actions').append('&nbsp;&nbsp;<a href="#" class="action_view_bulk_import">import public keys</a>&nbsp;&nbsp;').find('.action_view_bulk_import').off().click(tool.ui.event.prevent(tool.ui.event.double(), function (self) {
        $('.hide_when_rendering_subpage').css('display', 'none');
        $('h1').html('<a href="#" id="page_back_button">back</a>&nbsp;&nbsp;&nbsp;&nbsp;Bulk Public Key Import&nbsp;&nbsp;&nbsp;&nbsp;');
        $('#bulk_import').css('display', 'block');
        $('#bulk_import .input_pubkey').val('').css('display', 'inline-block');
        $('#bulk_import .action_process').css('display', 'inline-block');
        $('#bulk_import #processed').text('').css('display', 'none');
        $('#page_back_button').click(render_contact_list);
      }));

      $('table#emails').html('');
      $('div.hide_when_rendering_subpage').css('display', 'block');
      $('table.hide_when_rendering_subpage').css('display', 'table');
      $('h1').text('Contacts and their Public Keys');
      $('#view_contact, #edit_contact, #bulk_import').css('display', 'none');

      tool.each(contacts, function (i, contact) {
        $('table#emails').append('<tr email="' + contact.email + '"><td>' + contact.email + '</td><td><a href="#" class="action_show">show</a></td><td><a href="#" class="action_change">change</a></td><td><a href="#" class="action_remove">remove</a></td></tr>');
      });

      $('a.action_show').off().click(tool.ui.event.prevent(tool.ui.event.double(), function (self) {
        window.flowcrypt_storage.db_contact_get(null, $(self).closest('tr').attr('email'), function (contact) {
          $('.hide_when_rendering_subpage').css('display', 'none');
          $('h1').html('<a href="#" id="page_back_button">back</a>&nbsp;&nbsp;&nbsp;&nbsp;' + contact.email);
          if(contact.client === 'cryptup') {
            $('h1').append('&nbsp;&nbsp;&nbsp;&nbsp;<img src="/img/logo/flowcrypt-logo-19-19.png" />');
          } else {
            $('h1').append('&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;');
          }
          $('#view_contact .key_dump').text(contact.pubkey);
          $('#view_contact .key_fingerprint').text(contact.fingerprint);
          $('#view_contact .key_words').text(contact.keywords);
          $('#view_contact').css('display', 'block');
          $('#page_back_button').click(render_contact_list);
        });
      }));

      $('a.action_change').off().click(tool.ui.event.prevent(tool.ui.event.double(), function (self) {
        $('.hide_when_rendering_subpage').css('display', 'none');
        let email = $(self).closest('tr').attr('email');
        $('h1').html('<a href="#" id="page_back_button">back</a>&nbsp;&nbsp;&nbsp;&nbsp;' + email + '&nbsp;&nbsp;&nbsp;&nbsp;(edit)');
        $('#edit_contact').css('display', 'block');
        $('#edit_contact .input_pubkey').val('').attr('email', email);
        $('#page_back_button').click(render_contact_list);
      }));

      $('#edit_contact .action_save_edited_pubkey').off().click(tool.ui.event.prevent(tool.ui.event.double(), function (self) {
        let armored_pubkey = $('#edit_contact .input_pubkey').val();
        let email = $('#edit_contact .input_pubkey').attr('email');
        if(!armored_pubkey || !email) {
          alert('No public key entered');
        } else if(tool.crypto.key.fingerprint(armored_pubkey) !== null) {
          window.flowcrypt_storage.db_contact_save(null, window.flowcrypt_storage.db_contact_object(email, null, 'pgp', armored_pubkey, null, false, Date.now()), render_contact_list);
        } else {
          alert('Cannot recognize a valid public key, please try again. Let me know at human@flowcrypt.com if you need help.');
          $('#edit_contact .input_pubkey').val('').focus();
        }
      }));

      $('.action_view_bulk_import').off().click(tool.ui.event.prevent(tool.ui.event.double(), function (self) {
        $('.hide_when_rendering_subpage').css('display', 'none');
        $('h1').html('<a href="#" id="page_back_button">back</a>&nbsp;&nbsp;&nbsp;&nbsp;Bulk Public Key Import&nbsp;&nbsp;&nbsp;&nbsp;');
        $('#bulk_import').css('display', 'block');
        $('#bulk_import .input_pubkey').val('').css('display', 'inline-block');
        $('#bulk_import .action_process').css('display', 'inline-block');
        $('#bulk_import #processed').text('').css('display', 'none');
        $('#page_back_button').click(render_contact_list);
      }));

      $('#bulk_import .action_process').off().click(tool.ui.event.prevent(tool.ui.event.double(), function (self) {
        let replaced = tool.crypto.armor.replace_blocks(factory, $('#bulk_import .input_pubkey').val());
        if(!replaced || replaced === $('#bulk_import .input_pubkey').val()) {
          alert('Could not find any new public keys');
        } else {
          $('#bulk_import #processed').html(replaced).css('display', 'block');
          $('#bulk_import .input_pubkey, #bulk_import .action_process').css('display', 'none');
        }
      }));

      $('a.action_remove').off().click(tool.ui.event.prevent(tool.ui.event.double(), function (self) {
        window.flowcrypt_storage.db_contact_save(null, window.flowcrypt_storage.db_contact_object($(self).closest('tr').attr('email'), null, null, null, null, null, null), render_contact_list);
      }));

    });
  }

  render_contact_list();

});