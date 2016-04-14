'use strict';

var url_params = get_url_params(['account_email']);

$('.email-address').text(url_params.account_email);

$('.action_show_private_key').click(function() {
  alert('Key will only show for 10 seconds. Do not share this with anyone.');
  $('pre').text(private_storage_get(localStorage, url_params.account_email, 'master_private_key'));
  setTimeout(function() {
    if($('pre').text().indexOf('PRIVATE') !== -1) {
      $('pre').text('');
    }
  }, 10000);
});

$('.action_show_public_key').click(function() {
  $('pre').text(private_storage_get(localStorage, url_params.account_email, 'master_public_key'));
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

$('.action_passphrase').click(function() {
  window.location = 'passphrase.htm?account_email=' + encodeURIComponent(url_params.account_email);
});


$('.action_backups').click(function() {
  window.location = 'backup.htm?account_email=' + encodeURIComponent(url_params.account_email);
});

$('.action_pubkeys').click(function() {
  window.location = 'pubkeys.htm?account_email=' + encodeURIComponent(url_params.account_email);
});

$('.action_contacts').click(function() {
  window.location = 'contacts.htm?account_email=' + encodeURIComponent(url_params.account_email);
});
