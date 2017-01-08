'use strict';

var url_params = get_url_params(['account_email', 'armored_pubkey', 'parent_tab_id', 'frame_id']);

var pubkey = openpgp.key.readArmored(url_params.armored_pubkey).keys[0];

$('.pubkey').text(url_params.armored_pubkey);

function send_resize_message() {
  chrome_message_send(url_params.parent_tab_id, 'set_css', {
    selector: 'iframe#' + url_params.frame_id,
    css: {
      height: $('#pgp_block').height() + 30
    }
  });
}

function set_button_text(db) {
  db_contact_get(db, $('.input_email').val(), function(contact) {
    if(contact && contact.has_pgp) {
      $('.add_pubkey').text('update contact');
    } else {
      $('.add_pubkey').text('add to contacts');
    }
  });
}

db_open(function(db) {

  if(db === db_denied) {
    notify_about_storage_access_error(url_params.account_email, url_params.parent_tab_id);
    return;
  }

  if(typeof pubkey !== 'undefined') {
    $('.input_email').val(trim_lower(pubkey.users[0].userId.userid));
    set_button_text(db);
  } else {
    $('.add_pubkey').replaceWith('<div style="color: red;">This public key is invalid or has unknown format.</div>');
    send_resize_message();
  }

  $('.add_pubkey').click(prevent(doubleclick(), function(self) {
    if(is_email_valid($('.input_email').val())) {
      db_contact_save(db, db_contact_object($('.input_email').val(), null, 'pgp', url_params.armored_pubkey, null, false, Date.now()), function () {
        $(self).replaceWith('<b style="color: green;">' + $('.input_email').val() + ' added</b>')
        $('.input_email').remove();
      });
    } else {
      alert('This email is invalid, please check for typos. Not added.');
      $('.input_email').focus();
    }
  }));

  $('.input_email').keyup(function() {
    set_button_text(db);
  });

});

send_resize_message();
