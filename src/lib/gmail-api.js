
//https://github.com/whiteout-io/pgpbuilder/tree/master/test

var token_cache = null;

function save_token(account, token, callback) {
  chrome.storage.local.get('google_oauth_tokens', function(store) {
    token_cache = store['google_oauth_tokens'];
    token_cache[account] = token;
    chrome.storage.local.set({'google_oauth_tokens': token_cache}, callback);
  });
}

function get_token(account, callback) {
  if (token_cache === null){
    chrome.storage.local.get('google_oauth_tokens', function(store) {
      if(store['google_oauth_tokens'] === null || typeof store['google_oauth_tokens'] === 'undefined'){
        token_cache = {};
      }
      else {
        token_cache = store['google_oauth_tokens'];
      }
      callback(token_cache[account]);
    });
  }
  else{
    callback(token_cache[account]);
  }
}

function login(account, callback) {
  get_token(account, function(token) {
    if(typeof token !== 'undefined') {
      callback(token);
    }
    else {
      var redirect_uri = encodeURIComponent('https://nmelpmhpelannghfpkbmmpfggmildcmj.chromiumapp.org/google-auth-cb');
      var scope = encodeURIComponent('https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send');
      var client_id = encodeURIComponent('717284730244-1ko46mlo9u0h9r16mlr6paine5u1qn7p.apps.googleusercontent.com');
      var endpoint = 'https://accounts.google.com/o/oauth2/v2/auth';
      var url = endpoint + '?response_type=code&client_id=' + client_id + '&redirect_uri=' + redirect_uri + '&scope=' + scope + '&login_hint=' + account;
      chrome.identity.launchWebAuthFlow({'url': url, 'interactive': true}, function(redirect_uri) {
        var split = redirect_uri.split('?code=');
        var token = split[1].replace('#', '');
        save_token(account, token, function(){
          callback(token);
        });
      });
    }
  });
}

function call_gmail_api(account, resource, parameters, callback) {
  login(account, function(token){
    $.ajax({
        url: 'https://www.googleapis.com/gmail/v1/users/userId/' + resource,
        method: 'POST',
        data: parameters,
        headers: {'Authorization': 'Bearer ' + token},
        crossDomain: true,
        // contentType: 'application/json; charset=UTF-8',
        async: true,
        success: function(response) {
          callback(true, response);
        },
        error: function(response) {
          callback(false, response);
        },
    });
  });
}

function send_email(account, to, subject, message, send_email_callback) {
  var raw_message = new Mimebuilder('multipart/alternative').setHeader([
    {key: 'To', value: to},
    {key: 'From', value: account},
    {key: 'Subject', value: subject}
  ]).setContent(message).build();
  call_gmail_api(account, 'messages/send', {'raw': raw_message}, send_email_callback);
};

send_email('info@nvimp.com', 'tomas.holub@gmail.com', 'test from js', 'yeah went through', function(success, response){
  console.log([success, response]);
});
