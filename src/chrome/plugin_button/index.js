'use strict';

$('span#version').text('v' + chrome.runtime.getManifest().version);

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

for_each_known_account_email(function(account_email) {
  $('#accounts').html($('#accounts').html() + '&nbsp;&nbsp;&nbsp;<a href="account.htm?account_email=' + encodeURIComponent(account_email) + '">' + account_email + '</a>');
});

$('#btn_flush_pubkey_cache').click(function() {
  pubkey_cache_flush();
  $('pre').text('Pubkey cache flushed.');
});
