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
