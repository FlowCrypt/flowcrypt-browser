'use strict';

var l = {
  all_good: 'Your account is well set up. If you cannot open some of your received email, please inform your contacts to update their information about your public key. ',
  mismatch: 'There is at least one incorrect pubkey record. Your encrypted email might be unreadable as a result. ',
  missing: 'Some receiving emails are not registered for encryption, and your contancts will not know they can send you encrypted email. ',
}

var url_params = get_url_params(['account_email']);
var hide_attest_button = false;

$('.email-address').text(url_params.account_email);

$('.summary').html('Loading from keyserver <br>' + get_spinner());

account_storage_get(url_params.account_email, ['attests_processed', 'attests_requested'], function(storage) {
  if(storage.attests_processed && storage.attests_processed.length) {
    $('.attests').html('Your email was attested by: <span class="green">' + storage.attests_processed.join(', ') + '</span>. Attesters icrease the security of your communication by helping your contacts use the right public key for encryption.');
    hide_attest_button = true;
    $('.request_attest').css('visibility', 'hidden');
  } else if(storage.attests_requested && storage.attests_requested.length) {
    $('.attests').html('Attestation was requested from: ' + storage.attests_requested.join(', ') + '. Attesters icrease the security of your communication by helping your contacts use the right public key for encryption.');
    hide_attest_button = true;
    $('.request_attest').css('visibility', 'hidden');
  }
});

$('.fix_all').click(prevent(doubleclick(), function(self) {
  $(self).html(get_spinner());
  account_storage_get(url_params.account_email, ['addresses'], function(storage) {
    submit_pubkeys(storage.addresses, private_storage_get('local', url_params.account_email, 'master_public_key'), function() {
      window.location.reload();
    });
  });
}));

check_pubkeys_keyserver(url_params.account_email, function(diagnosis) {
  if(diagnosis) {
    if(!diagnosis.has_pubkey_mismatch && !diagnosis.has_pubkey_missing) {
      $('.summary').html(l.all_good);
      if(!hide_attest_button) {
        $('.line.request_attest').css('display', 'block');
        $('.action_request_attest').click(function() {
          keyserver_keys_submit(url_params.account_email, private_storage_get('local', url_params.account_email, 'master_public_key'), true, function(success, response) {
            save_attest_request(url_params.account_email, 'CRYPTUP', function() {
              alert('You will receive attestation email soon. No further action needed.');
              window.location.reload();
            });
          });
        });
      }
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
          keyserver_keys_submit($(self).attr('email'), private_storage_get('local', url_params.account_email, 'master_public_key'), false, function() {
            window.location.reload();
          });
        } else {
          window.location.reload();
        }
      });
    }));
    var armored_pubkey = private_storage_get('local', url_params.account_email, 'master_public_key');
    var pubkey = openpgp.key.readArmored(armored_pubkey);
  } else {
    $('.summary').html('Failed to load due to internet connection, please refresh the page.');
  }
});
