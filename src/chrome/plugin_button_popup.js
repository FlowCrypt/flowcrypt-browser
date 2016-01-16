'use strict';

chrome.storage.local.get(['primary_email'], function(storage){
	var account = storage['primary_email'];

  get_pubkey(account, function(result){
    if (result !== null){
      pubkey_cache_add(account, result.key);
    }
  });
});

$('#private_key_form button').click(function(){
  localStorage.master_private_key = $('#private_key_form textarea').val();
  $('#private_key_form textarea').val('');
  $(this).text('Saved');
  return false;
});

$('#passphrase_form button').click(function(){
  localStorage.master_passphrase = $('#passphrase_form input').val();
  $('#passphrase_form input').val('');
  $(this).text('Saved');
  return false;
});
