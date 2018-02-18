/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

tool.ui.event.protect();

let url_params = tool.env.url_params(['account_email', 'parent_tab_id', 'emails', 'placement']);

tool.each(url_params.emails.split(','), function (i, email) {
  $('select.email').append('<option value="' + email + '">' + email + '</option>');
});

window.flowcrypt_storage.db_contact_search(null, { has_pgp: true }, function (contacts) {

  $('select.copy_from_email').append('<option value=""></option>');
  tool.each(contacts, function (i, contact) {
    $('select.copy_from_email').append('<option value="' + contact.email + '">' + contact.email + '</option>');
  });

  $('select.copy_from_email').change(function () {
    if($(this).val()) {
      window.flowcrypt_storage.db_contact_get(null, $(this).val(), function (contact) {
        $('.pubkey').val(contact.pubkey).prop('disabled', true);
      });
    } else {
      $('.pubkey').val('').prop('disabled', false);
    }
  });

  $('.action_ok').click(tool.ui.event.prevent(tool.ui.event.double(), function () {
    let armored = tool.crypto.key.normalize(tool.crypto.armor.strip($('.pubkey').val()));
    if(!tool.crypto.key.fingerprint(armored)) {
      alert('Could not recognize the format, please try again.');
      $('.pubkey').val('').focus();
    } else if (!tool.crypto.key.usable(armored)) {
      alert('This public key looks correctly formatted, but cannot be used for encryption. Please write me at human@flowcrypt.com so that I can see if there is a way to fix it.');
      $('.pubkey').val('').focus();
    } else {
      window.flowcrypt_storage.db_contact_save(null, window.flowcrypt_storage.db_contact_object($('select.email').val(), null, 'pgp', armored, null, false, Date.now()), close_dialog);
    }
  }));

});

if(url_params.placement !== 'settings') {
  $('.action_settings').click(tool.ui.event.prevent(tool.ui.event.double(), function () {
    tool.browser.message.send(null, 'settings', {
      path: 'index.htm',
      page: '/chrome/settings/modules/contacts.htm',
      account_email: url_params.account_email,
    });
  }));
} else {
  $('#content').addClass('inside_compose');
}

$('.action_close').click(tool.ui.event.prevent(tool.ui.event.double(), close_dialog));

function close_dialog() {
  if(url_params.parent_tab_id) {
    tool.browser.message.send(url_params.parent_tab_id, 'close_dialog');
  } else {
    window.close();
  }

}
