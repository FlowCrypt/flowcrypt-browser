
function gmail_api_login(account, callback) {
  var redirect_uri = 'https://nmelpmhpelannghfpkbmmpfggmildcmj.chromiumapp.org/google-auth-cb';
  var scope = 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send';
  var client_id = '717284730244-1ko46mlo9u0h9r16mlr6paine5u1qn7p.apps.googleusercontent.com'; //webapp
  var endpoint = 'https://accounts.google.com/o/oauth2/v2/auth';
  var url = endpoint + '?response_type=token&client_id=' + encodeURIComponent(client_id) + '&redirect_uri=' + encodeURIComponent(redirect_uri) + '&scope=' + encodeURIComponent(scope) + '&login_hint=' + encodeURIComponent(account);
  chrome.identity.launchWebAuthFlow({'url': url, 'interactive': true}, function(redirect_uri) {
    var access_token = redirect_uri.split('access_token=')[1].split('&token_type=')[0];
    callback(access_token);
  });
}
var account = 'info@nvimp.com';
gmail_api_login(account, function(token){
  chrome.storage.local.set({'token': token}, function(){
    alert('logged in with token: ' + token);
  });
});

get_pubkey(account, function(result){
  if (result !== null){
    pubkey_cache_add(account, result.key);
  }
})
