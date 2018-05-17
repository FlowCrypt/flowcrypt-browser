/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

tool.catch.try(() => {

  let url_params = tool.env.url_params(['account_email']);

  $('.email-address').text(url_params.account_email as string);

  $('.summary').html('<br><br><br><br>Loading from keyserver<br><br>' + tool.ui.spinner('green'));

  Store.get(url_params.account_email as string, ['attests_processed', 'attests_requested', 'addresses']).then(storage => {
    tool.api.attester.diagnose_keyserver_pubkeys(url_params.account_email as string, function (diagnosis) {
      if(diagnosis) {
        $('.summary').html('');
        render_diagnosis(diagnosis, storage.attests_requested || [], storage.attests_processed || []);
      } else {
        $('.summary').html('Failed to load due to internet connection. <a href="#" class="reload">Try Again</a>');
        $('a.reload').click(function () {
          window.location.reload();
        });
      }
    });
  });

  function render_diagnosis(diagnosis: any, attests_requested: string[], attests_processed: string[]) {
    for(let email of Object.keys(diagnosis.results)) {
      let result = diagnosis.results[email];
      let note, action, remove, color;
      if(result.pubkey === null) {
        note = 'Missing record. Your contacts will not know you have encryption set up.';
        action = '<div class="button gray2 small action_request_attestation" email="' + email + '">Submit public key</div>';
        remove = '&nbsp; <b class="bad action_remove_alias" email="' + email + '" title="Remove address from list of send-from addresses.">[x]</b>';
        color = 'orange';
      } else if(result.match) {
        if(email === url_params.account_email && !result.attested) {
          if(attests_requested && attests_requested.length) {
            note = 'Submitted. Attestation was requested from ' + attests_requested.join(', ') + ' and should process shortly.';
            action = '<div class="button gray2 small refresh_after_attest_request" email="' + email + '">Refresh</div>';
            remove = '';
            color = 'orange';
          } else {
            note = 'Found but not attested.';
            action = '<div class="button gray2 small action_request_attestation" email="' + email + '">Request Attestation</div>';
            remove = '';
            color = 'orange';
          }
        } else if(email === url_params.account_email && result.attested) {
          note = 'Submitted, can receive encrypted email. Attested by CRYPTUP.';
          action = '';
          remove = '';
          color = 'green';
        } else {
          note = 'Submitted, can receive encrypted email.';
          action = '';
          remove = '';
          color = 'green';
        }
      } else {
        if(email === url_params.account_email && !result.attested) {
          note = 'Wrong public key recorded. Your incoming email may be unreadable when encrypted.';
          action = '<div class="button gray2 small action_request_attestation" email="' + email + '">Request Attestation</div>';
          remove = '';
          color = 'red';
        } else if(email === url_params.account_email && result.attested && attests_requested && attests_requested.length) {
          note = 'Re-Attestation requested. This should process shortly.';
          action = '<div class="button gray2 small refresh_after_attest_request" email="' + email + '">Refresh</div>';
          remove = '';
          color = 'orange';
        } else if(email === url_params.account_email && result.attested) {
          note = 'Wrong public key recorded. Your incoming email may be unreadable when encrypted.';
          action = '<div class="button gray2 small request_replacement" email="' + email + '">Request Replacement Attestation</div>';
          remove = '';
          color = 'red';
        } else {
          note = 'Wrong public key recorded. Your incoming email may be unreadable when encrypted.';
          action = '';
          remove = '';
          color = 'red';
        }
      }
      $('table#emails').append('<tr><td>' + email + remove + '</td><td class="' + color + '">' + note + '</td><td>' + action + '</td></tr>');
    }
    $('.action_request_attestation').click(tool.ui.event.prevent(tool.ui.event.double(), function (self) {
      $(self).html(tool.ui.spinner('white'));
      action_submit_or_request_attestation($(self).attr('email')!);
    }));
    $('.action_remove_alias').click(tool.ui.event.prevent(tool.ui.event.double(), function (self) {
      Store.get(url_params.account_email as string, ['addresses']).then(storage => {
        Store.set(url_params.account_email as string, {'addresses': tool.arr.without_value(storage.addresses || [], $(self).attr('email'))}).then(() => window.location.reload());
      });
    }));
    $('.request_replacement').click(tool.ui.event.prevent(tool.ui.event.double(), function (self) {
      $(self).html(tool.ui.spinner('white'));
      show_settings_page('/chrome/settings/modules/request_replacement.htm');
    }));
    $('.refresh_after_attest_request').click(tool.ui.event.prevent(tool.ui.event.double(), function (self) {
      $(self).html('Updating.. ' + tool.ui.spinner('white'));
      tool.browser.message.send(null, 'attest_requested', { account_email: url_params.account_email, }, function () {
        setTimeout(function () {
          window.location.reload();
        }, 30000);
      });
    }));
    let refresh_aliases_html = '<div class="line"><a href="#" class="action_fetch_aliases">Missing email address? Refresh list</a></div>';
    $('#content').append(refresh_aliases_html).find('.action_fetch_aliases').click(tool.ui.event.prevent(tool.ui.event.parallel(), function(self, id) {
      $(self).html(tool.ui.spinner('green'));
      fetch_account_aliases_from_gmail(url_params.account_email as string, function(addresses) {
        Store.set(url_params.account_email as string, { addresses: tool.arr.unique(addresses.concat(url_params.account_email)) }).then(() => window.location.reload());
      });
    }));
  }

  function action_submit_or_request_attestation(email: string) {
    Store.keys_get(url_params.account_email as string, ['primary']).then(([primary_k]) => {
      if(email === url_params.account_email) { // request attestation
        save_attest_request(url_params.account_email, 'CRYPTUP', function () {
          // @ts-ignore
          tool.api.attester.initial_legacy_submit(email, primary_k.public, true).done(() => window.location.reload());
        });
      } else { // submit only
        // @ts-ignore
        tool.api.attester.initial_legacy_submit(email, primary_k.public, false).done(() => window.location.reload());
      }
    });
  }

})();