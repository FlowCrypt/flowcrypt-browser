'use strict';

var l = {
  all_good: 'Your account is well set up. If you cannot open some of your received email, please inform your contacts to update their information about your public key. ',
  mismatch: 'There is at least one incorrect pubkey record. Your encrypted email might be unreadable as a result. ',
  missing: 'Some receiving emails are not registered for encryption, and your contancts will not know they can send you encrypted email. ',
}

var url_params = get_url_params(['account_email']);

$('.email-address').text(url_params.account_email);

$('.summary').html('Loading from keyserver ' + get_spinner());

$('.fix_all').click(prevent(doubleclick(), function(self) {
  $(self).html(get_spinner());
  account_storage_get(url_params.account_email, ['addresses'], function(storage) {
    submit_pubkey_alternative_addresses(storage.addresses, private_storage_get(localStorage, url_params.account_email, 'master_public_key'), function() {
      window.location.reload();
    });
  });
}));

check_pubkeys_keyserver(url_params.account_email, function(diagnosis) {
  if(diagnosis) {
    if(!diagnosis.has_pubkey_mismatch && !diagnosis.has_pubkey_missing) {
      $('.summary').html(l.all_good);
    } else {
      if(diagnosis.has_pubkey_mismatch) {
        $('.summary').html(l.mismatch);
      }
      if(diagnosis.has_pubkey_missing) {
        $('.summary').append(l.missing);
      }
      $('.fix_container').css('display', 'block');
    }
    $.each(diagnosis.results, function(email, result) {
      if(result.match) {
        var note = 'Can receive encrypted email.';
        var action = '';
        var color = 'green';
      } else if(result.pubkey === null) {
        var note = 'Missing record. Your contacts will not know you have encryption set up.';
        var action = '<div class="button gray2 small fix_pubkey" email="' + email + '">Submit public key</div>';
        var color = 'orange';
      } else {
        var note = 'Wrong public key recorded. Your incoming email might be unreadable when encrypted.';
        var action = '<div class="button gray2 small fix_pubkey" email="' + email + '">Update public key</div>';
        var color = 'red';
      }
      $('table#emails').append('<tr><td>' + email + '</td><td class="' + color + '">' + note + '</td><td>' + action + '</td></tr>');
    });
    $('.fix_pubkey').click(prevent(doubleclick(), function(self) {
      $(self).html(get_spinner());
      account_storage_get(url_params.account_email, ['addresses'], function(storage) {
        if(storage.addresses.indexOf($(self).attr('email')) !== -1) {
          keyserver_keys_submit($(self).attr('email'), private_storage_get(localStorage, url_params.account_email, 'master_public_key'), function() {
            window.location.reload();
          });
        } else {
          window.location.reload();
        }
      });
    }));
    var armored_pubkey = private_storage_get(localStorage, url_params.account_email, 'master_public_key');
    var pubkey = openpgp.key.readArmored(armored_pubkey);
  } else {
    $('.summary').html('Failed to load due to internet connection, please refresh the page.');
  }
});

$('.back').off().click(function() {
  window.location = 'account.htm?account_email=' + encodeURIComponent(url_params.account_email);
});
