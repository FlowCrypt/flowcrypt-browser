/* Business Source License 1.0 © 2016 Tom James Holub (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/tomholub/cryptup-chrome/tree/master/src/LICENCE */

'use strict';

var url_params = tool.env.url_params(['account_email', 'parent_tab_id', 'emails', 'placement']);

$.each(url_params.emails.split(','), function (i, email) {
  $('select.email').append('<option value="' + email + '">' + email + '</option>');
});

db_open(function (db) {
  db_contact_search(db, { has_pgp: true }, function (contacts) {

    $('select.copy_from_email').append('<option value=""></option>');
    $.each(contacts, function (i, contact) {
      $('select.copy_from_email').append('<option value="' + contact.email + '">' + contact.email + '</option>');
    });

    $('select.copy_from_email').change(function () {
      if($(this).val()) {
        db_contact_get(db, $(this).val(), function (contact) {
          $('.pubkey').val(contact.pubkey).prop('disabled', true);
        });
      } else {
        $('.pubkey').val('').prop('disabled', false);
      }
    });

    $('.action_ok').click(tool.ui.event.prevent(tool.ui.event.double(), function () {
      var armored = tool.crypto.key.normalize(tool.crypto.armor.strip($('.pubkey').val()));
      if(!tool.crypto.key.fingerprint(armored)) {
        alert('Could not recognize the format, please try again.');
        $('.pubkey').val('').focus();
      } else if (openpgp.key.readArmored(armored).keys[0].getEncryptionKeyPacket() === null) {
        alert('This public key looks correctly formatted, but cannot be used for encryption. Please write me at tom@cryptup.org so that I can see if there is a way to fix it.');
        $('.pubkey').val('').focus();
      } else {
        db_contact_save(db, db_contact_object($('select.email').val(), null, 'pgp', armored, null, false, Date.now()), close_dialog);
      }
    }));

  });
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
