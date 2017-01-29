/* Business Source License 1.0 © 2016 Tom James Holub (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/tomholub/cryptup-chrome/tree/master/src/LICENCE */

'use strict';

var url_params = get_url_params(['account_email', 'armored_pubkey', 'parent_tab_id', 'is_outgoing', 'frame_id']);
url_params.is_outgoing = Boolean(Number(url_params.is_outgoing || ''));

var pubkey = openpgp.key.readArmored(url_params.armored_pubkey).keys[0];

render();

function send_resize_message() {
  chrome_message_send(url_params.parent_tab_id, 'set_css', {
    selector: 'iframe#' + url_params.frame_id,
    css: { height: $('#pgp_block').height() + 30 }
  });
}

function set_button_text(db) {
  db_contact_get(db, $('.input_email').val(), function (contact) {
    if(contact && contact.has_pgp) {
      $('.action_add_contact').text('update contact');
    } else {
      $('.action_add_contact').text('add to contacts');
    }
  });
}

function render() {
  $('.pubkey').text(url_params.armored_pubkey);
  $('.line.fingerprints, .line.add_contact').css('display', url_params.is_outgoing ? 'none' : 'block');
  $('.line.fingerprints .fingerprint').text(key_fingerprint(pubkey));
  $('.line.fingerprints .keywords').text(mnemonic(key_longid(pubkey)));
}

db_open(function (db) {

  if(db === db_denied) {
    notify_about_storage_access_error(url_params.account_email, url_params.parent_tab_id);
    return;
  }

  if(typeof pubkey !== 'undefined') {
    $('.input_email').val(trim_lower(pubkey.users[0].userId.userid));
    $('.email').text(trim_lower(pubkey.users[0].userId.userid));
    set_button_text(db);
  } else {
    $('.line.add_contact').addClass('bad').html('This public key is invalid or has unknown format.');
    $('.line.fingerprints').css('display', 'none');
    send_resize_message();
  }

  $('.action_add_contact').click(prevent(doubleclick(), function (self) {
    if(is_email_valid($('.input_email').val())) {
      db_contact_save(db, db_contact_object($('.input_email').val(), null, 'pgp', pubkey.armor(), null, false, Date.now()), function () {
        $(self).replaceWith('<span class="good">' + $('.input_email').val() + ' added</span>')
        $('.input_email').remove();
      });
    } else {
      alert('This email is invalid, please check for typos. Not added.');
      $('.input_email').focus();
    }
  }));

  $('.input_email').keyup(function () {
    set_button_text(db);
  });

});

$('.action_show_full').click(function () {
  $(this).css('display', 'none');
  $('pre.pubkey, .line.fingerprints, .line.add_contact').css('display', 'block');
  send_resize_message();
});

send_resize_message();
