'use strict';

var url_params = get_url_params(['account_email']);

$('h1').text('Settings for ' + url_params['account_email']);

$('.action_show_private_key').click(function() {
  alert('Key will only show for 10 seconds. Do not share this with anyone.');
  $('pre').text(restricted_account_storage_get(url_params.account_email, 'master_private_key'));
  setTimeout(function() {
    if($('pre').text().indexOf('PRIVATE') !== -1) {
      $('pre').text('');
    }
  }, 10000);
});

$('.action_show_public_key').click(function() {
  $('pre').text(restricted_account_storage_get(url_params.account_email, 'master_public_key'));
});

$('.action_show_gmail_api_tokens').click(function() {
  account_storage_get(url_params['account_email'], ['google_token_access', 'google_token_refresh', 'google_token_expires'], function(tokens) {
    var tokens_text = '';
    tokens_text += 'google_token_access' + ': ' + tokens.google_token_access + '\n';
    tokens_text += 'google_token_refresh' + ': ' + tokens.google_token_refresh + '\n';
    tokens_text += 'google_token_expires' + ': ' + tokens.google_token_expires + '\n';
    $('pre').text(tokens_text);
  });
});

$('.action_load_send_from_email_addresses').click(prevent(parallel(), function(self, process_id) {
  var button_text = $(self).text();
  $(self).html(get_spinner());
  fetch_all_account_addresses(url_params['account_email'], function(addresses) {
    account_storage_set(url_params['account_email'], {
      addresses: addresses
    }, function() {
      submit_pubkey_alternative_addresses(addresses.slice(), restricted_account_storage_get(url_params['account_email'], 'master_public_key'), function() {
        $(self).text(button_text);
        $('pre').text(JSON.stringify(addresses));
        release(process_id);
      });
    });
  });
}));

$('.action_backups').click(function() {
  window.location = 'backup.htm?account_email=' + encodeURIComponent(url_params.account_email);
});

$('.action_pubkeys').click(function() {
  window.location = 'pubkeys.htm?account_email=' + encodeURIComponent(url_params.account_email);
});
