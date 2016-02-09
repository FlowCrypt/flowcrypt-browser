'use strict';

function for_each_known_account_email(callback) {
  account_storage_get(null, 'account_emails', function(account_emails_string) {
    var account_emails = [];
    if(typeof account_emails_string !== 'undefined') {
      account_emails = JSON.parse(account_emails_string);
    }
    for(var i in account_emails) {
      callback(account_emails[i]);
    }
  });
}


$('#btn_show_accounts').click(function() {
  account_storage_get(null, 'account_emails', function(account_emails_string) {
    $('pre').text(account_emails_string);
  });
});



$('#btn_flush_pubkey_cache').click(function() {
  localStorage.pubkey_cache = JSON.stringify({});
  $('pre').text('Pubkey cache flushed.');
});

$('#btn_show_private_key').click(function() {
  $('pre').text(localStorage.master_private_key);
});

$('#btn_show_public_key').click(function() {
  $('pre').text(localStorage.master_public_key);
});

$('#btn_flush_gmail_api_tokens').click(function() {
  for_each_known_account_email(function(account_email) {
    account_storage_remove(account_email, 'token');
  });
});

$('#btn_show_gmail_api_tokens').click(function() {
  $('pre').text('');
  for_each_known_account_email(function(account_email) {
    account_storage_get(account_email, 'token', function(token) {
      $('pre').text($('pre').text() + account_email + ' token' + ': ' + token + '\n');
    });
  });
});


// $('#btn_back_up_private_key').click(function() {
//
// });
