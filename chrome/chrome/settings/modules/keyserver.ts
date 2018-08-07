/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

tool.catch.try(async () => {

  let url_params = tool.env.url_params(['account_email', 'parent_tab_id']);
  let account_email = tool.env.url_param_require.string(url_params, 'account_email');
  let parent_tab_id = tool.env.url_param_require.string(url_params, 'parent_tab_id');

  $('.email-address').text(account_email);

  $('.summary').html('<br><br><br><br>Loading from keyserver<br><br>' + tool.ui.spinner('green'));

  let render_diagnosis = (diagnosis: any, attests_requested: string[], attests_processed: string[]) => {
    for (let email of Object.keys(diagnosis.results)) {
      let result = diagnosis.results[email];
      let note, action, remove, color;
      if (result.pubkey === null) {
        note = 'Missing record. Your contacts will not know you have encryption set up.';
        action = '<div class="button gray2 small action_request_attestation" email="' + email + '">Submit public key</div>';
        remove = '&nbsp; <b class="bad action_remove_alias" email="' + email + '" title="Remove address from list of send-from addresses.">[x]</b>';
        color = 'orange';
      } else if (result.match) {
        if (email === account_email && !result.attested) {
          if (attests_requested && attests_requested.length) {
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
        } else if (email === account_email && result.attested) {
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
        if (email === account_email && !result.attested) {
          note = 'Wrong public key recorded. Your incoming email may be unreadable when encrypted.';
          action = '<div class="button gray2 small action_request_attestation" email="' + email + '">Request Attestation</div>';
          remove = '';
          color = 'red';
        } else if (email === account_email && result.attested && attests_requested && attests_requested.length) {
          note = 'Re-Attestation requested. This should process shortly.';
          action = '<div class="button gray2 small refresh_after_attest_request" email="' + email + '">Refresh</div>';
          remove = '';
          color = 'orange';
        } else if (email === account_email && result.attested) {
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
    $('.action_request_attestation').click(tool.ui.event.prevent(tool.ui.event.double(), async self => {
      $(self).html(tool.ui.spinner('white'));
      await action_submit_or_request_attestation($(self).attr('email')!);
    }));
    $('.action_remove_alias').click(tool.ui.event.prevent(tool.ui.event.double(), async self => {
      let {addresses} = await Store.get_account(account_email, ['addresses']);
      await Store.set(account_email, {'addresses': tool.arr.without_value(addresses || [], $(self).attr('email')!)});
      window.location.reload();
    }));
    $('.request_replacement').click(tool.ui.event.prevent(tool.ui.event.double(), self => {
      $(self).html(tool.ui.spinner('white'));
      Settings.redirect_sub_page(account_email, parent_tab_id, '/chrome/settings/modules/request_replacement.htm');
    }));
    $('.refresh_after_attest_request').click(tool.ui.event.prevent(tool.ui.event.double(), async self => {
      $(self).html('Updating.. ' + tool.ui.spinner('white'));
      tool.browser.message.send(null, 'attest_requested', {account_email});
      await tool.time.sleep(30000);
      window.location.reload();
    }));
    let refresh_aliases_html = '<div class="line"><a href="#" class="action_fetch_aliases">Missing email address? Refresh list</a></div>';
    $('#content').append(refresh_aliases_html).find('.action_fetch_aliases').click(tool.ui.event.prevent(tool.ui.event.parallel(), async self => {
      $(self).html(tool.ui.spinner('green'));
      try {
        let addresses = await Settings.fetch_account_aliases_from_gmail(account_email);
        await Store.set(account_email, { addresses: tool.arr.unique(addresses.concat(account_email)) });
      } catch(e) {
        if(tool.api.error.is_network_error(e)) {
          alert('Need internet connection to finish. Please click the button again to retry.');
        } else if(parent_tab_id && tool.api.error.is_auth_popup_needed(e)) {
          tool.browser.message.send(parent_tab_id, 'notification_show_auth_popup_needed', {account_email});
          alert('Account needs to be re-connected first. Please try later.');
        } else {
          tool.catch.handle_exception(e);
          alert(`Error happened: ${e.message}`);
        }
      }
      window.location.reload();
    }));
  };

  let action_submit_or_request_attestation = async (email: string) => {
    let [primary_ki] = await Store.keys_get(account_email, ['primary']);
    Settings.abort_and_render_error_if_keyinfo_empty(primary_ki);
    try {
      if (email === account_email) { // request attestation
        await Settings.save_attest_request(account_email, 'CRYPTUP');
        await tool.api.attester.initial_legacy_submit(email, primary_ki.public, true);
      } else { // submit only
        await tool.api.attester.initial_legacy_submit(email, primary_ki.public, false);
      }
    } catch (e) {
      tool.catch.handle_exception(e);
    } finally {
      window.location.reload();
    }
  };

  let storage = await Store.get_account(account_email, ['attests_processed', 'attests_requested', 'addresses']);
  try {
    let diagnosis = await tool.api.attester.diagnose_keyserver_pubkeys(account_email);
    $('.summary').html('');
    render_diagnosis(diagnosis, storage.attests_requested || [], storage.attests_processed || []);
  } catch (e) {
    if (tool.api.error.is_network_error(e)) {
      $('.summary').html('Failed to load due to internet connection. <a href="#" class="reload">Try Again</a>');
    } else {
      $('.summary').html('Failed to load. <a href="#" class="reload">Try Again</a>');
      tool.catch.handle_exception(e);
    }
    $('a.reload').click(tool.ui.event.handle(() =>  window.location.reload()));
  }

})();
