/* Business Source License 1.0 © 2016 Tom James Holub (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/tomholub/cryptup-chrome/tree/master/src/LICENCE */

'use strict';

var l = {
  all_good: 'Your account is well set up. If you cannot open some of your received email, please inform your contacts to update their information about your public key. ',
  mismatch: 'There is at least one incorrect pubkey record. Your encrypted email might be unreadable as a result. ',
  missing: 'Some receiving emails are not registered for encryption, and your contancts will not know they can send you encrypted email. ',
};

var url_params = tool.env.url_params(['account_email']);

$('.email-address').text(url_params.account_email);

$('.summary').html('<br><br><br><br>Loading from keyserver<br><br>' + tool.ui.spinner());

account_storage_get(url_params.account_email, ['attests_processed', 'attests_requested', 'addresses'], function (storage) {
  tool.diagnose.keyserver_pubkeys(url_params.account_email, function (diagnosis) {
    if(diagnosis) {
      $('.summary').html('');
      render_diagnosis(diagnosis, storage.attests_requested, storage.attests_processed);
    } else {
      $('.summary').html('Failed to load due to internet connection. <a href="#" class="reload">Try Again</a>');
      $('a.reload').click(function () {
        window.location.reload();
      });
    }
  });
});

function render_diagnosis(diagnosis, attests_requested, attests_processed) {
  $.each(diagnosis.results, function (email, result) {
    if(result.pubkey === null) {
      var note = 'Missing record. Your contacts will not know you have encryption set up.';
      var action = '<div class="button gray2 small action_request_attestation" email="' + email + '">Submit public key</div>';
      var color = 'orange';
    } else if(result.match) {
      if(email === url_params.account_email && !result.attested) {
        if(attests_requested && attests_requested.length) {
          var note = 'Submitted. Attestation was requested from ' + attests_requested.join(', ') + ' and should process shortly.';
          var action = '<div class="button gray2 small refresh_after_attest_request" email="' + email + '">Refresh</div>';
          var color = 'orange';
        } else {
          var note = 'Submitted, but not attested.';
          var action = '<div class="button gray2 small action_request_attestation" email="' + email + '">Request Attestation</div>';
          var color = 'orange';
        }
      } else if(email === url_params.account_email && result.attested) {
        var note = 'Submitted, can receive encrypted email. Attested by CRYPTUP.';
        var action = '';
        var color = 'green';
      } else {
        var note = 'Submitted, can receive encrypted email.';
        var action = '';
        var color = 'green';
      }
    } else {
      if(email === url_params.account_email && !result.attested) {
        var note = 'Wrong public key recorded. Your incoming email might be unreadable when encrypted.';
        var action = '<div class="button gray2 small action_request_attestation" email="' + email + '">Request Attestation</div>';
        var color = 'red';
      } else if(email === url_params.account_email && result.attested && attests_requested && attests_requested.length) {
        var note = 'Re-Attestation requested. This should process shortly.';
        var action = '<div class="button gray2 small refresh_after_attest_request" email="' + email + '">Refresh</div>';
        var color = 'orange';
      } else if(email === url_params.account_email && result.attested) {
        var note = 'Wrong public key recorded. Your incoming email might be unreadable when encrypted.';
        var action = '<div class="button gray2 small request_replacement" email="' + email + '">Request Replacement Attestation</div>';
        var color = 'red';
      } else {
        var note = 'Wrong public key recorded. Your incoming email might be unreadable when encrypted.';
        var action = '';
        var color = 'red';
      }
    }
    $('table#emails').append('<tr><td>' + email + '</td><td class="' + color + '">' + note + '</td><td>' + action + '</td></tr>');
  });
  $('.action_request_attestation').click(tool.ui.event.prevent(tool.ui.event.double(), function (self) {
    $(self).html(tool.ui.spinner());
    action_submit_or_request_attestation($(self).attr('email'));
  }));
  $('.request_replacement').click(tool.ui.event.prevent(tool.ui.event.double(), function (self) {
    $(self).html(tool.ui.spinner());
    show_settings_page('/chrome/settings/modules/request_replacement.htm');
  }));
  $('.refresh_after_attest_request').click(tool.ui.event.prevent(tool.ui.event.double(), function (self) {
    $('.refresh_after_attest_request').html('Updating.. ' + tool.ui.spinner());
    tool.browser.message.send(null, 'attest_requested', { account_email: url_params.account_email, }, function () {
      setTimeout(function () {
        window.location.reload();
      }, 10000);
    });
  }));
  var armored_pubkey = private_storage_get('local', url_params.account_email, 'master_public_key');
  var pubkey = openpgp.key.readArmored(armored_pubkey);
}

function action_submit_or_request_attestation(email) {
  if(email === url_params.account_email) { // request attestation
    save_attest_request(url_params.account_email, 'CRYPTUP', function () {
      tool.api.attester.keys_submit(email, private_storage_get('local', url_params.account_email, 'master_public_key'), true, function () {
        window.location.reload();
      });
    });
  } else { // submit only
    tool.api.attester.keys_submit(email, private_storage_get('local', url_params.account_email, 'master_public_key'), false, function () {
      window.location.reload();
    });
  }
}
