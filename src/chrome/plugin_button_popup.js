'use strict';

$('#btn_flush_pubkey_cache').click(function(){
  localStorage.pubkey_cache = JSON.stringify({});
  $('pre#key_container').text('Pubkey cache flushed.');
});

$('#btn_show_private_key').click(function(){
  $('pre#key_container').text(localStorage.master_private_key);
});

$('#btn_show_public_key').click(function(){
  $('pre#key_container').text(localStorage.master_public_key);
});

$('#btn_back_up_private_key').click(function(){

});
