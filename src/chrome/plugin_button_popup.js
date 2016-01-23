

$('#btn_flush_pubkey_cache').click(function(){
  localStorage.pubkey_cache = JSON.stringify({});
});
