var url_params = get_url_params(['account_email']);

$('h1').text('Settings for ' + url_params['account_email']);

$('.action_show_private_key').click(function() {
  $('pre').text(restricted_account_storage_get(url_params['account_email'], 'master_private_key'));
});

$('.action_show_public_key').click(function() {
  $('pre').text(restricted_account_storage_get(url_params['account_email'], 'master_public_key'));
});

$('.action_flush_gmail_api_tokens').click(function() {
  account_storage_remove(url_params['account_email'], ['google_token_access', 'google_token_refresh', 'google_token_expires']);
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
