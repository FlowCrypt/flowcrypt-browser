'use strict';

require.config({
    baseUrl: '../../lib',
    paths: {
        'emailjs-mime-builder': './emailjs-mime-builder/src/emailjs-mime-builder',
        'emailjs-addressparser': './emailjs-mime-builder/node_modules/emailjs-addressparser/src/emailjs-addressparser',
        'emailjs-mime-types': './emailjs-mime-builder/node_modules/emailjs-mime-types/src/emailjs-mime-types',
        'emailjs-mime-codec': './emailjs-mime-builder/node_modules/emailjs-mime-codec/src/emailjs-mime-codec',
        'punycode': './emailjs-mime-builder/node_modules/punycode/punycode',
        'emailjs-stringencoding': './emailjs-mime-builder/node_modules/emailjs-stringencoding/src/emailjs-stringencoding',
        'sinon': './emailjs-mime-builder/node_modules/sinon/pkg/sinon',
    },
    shim: {
        sinon: {
            exports: 'sinon',
        }
    }
});

require(['emailjs-mime-builder'], function (MimeBuilder) {

  var token_cache = null;
  // chrome.storage.local.set({'google_oauth_tokens': {}});

  function save_token(account, token, callback) {
    chrome.storage.local.get('google_oauth_tokens', function(store) {
      if (typeof store['google_oauth_tokens'] === 'undefined') {
        token_cache = {};
      }
      else {
        token_cache = store['google_oauth_tokens'];
      }
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
    console.log('inside login');
    get_token(account, function(token) {
      // console.log('inside get_token:' + token);
      // // if(typeof token !== 'undefined') {
      // //   console.log('inside get_token is good:' + token);
      // //   callback(token);
      // // }
      // // else {
      //   console.log('inside get_token is bad:' + token);
        var redirect_uri = 'https://nmelpmhpelannghfpkbmmpfggmildcmj.chromiumapp.org/google-auth-cb';
        var scope = 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send';
        var client_id = '717284730244-1ko46mlo9u0h9r16mlr6paine5u1qn7p.apps.googleusercontent.com'; //webapp
        var endpoint = 'https://accounts.google.com/o/oauth2/v2/auth';
        var url = endpoint + '?response_type=token&client_id=' + encodeURIComponent(client_id) + '&redirect_uri=' + encodeURIComponent(redirect_uri) + '&scope=' + encodeURIComponent(scope) + '&login_hint=' + encodeURIComponent(account);
        console.log(['url', url]);
        chrome.identity.launchWebAuthFlow({'url': url, 'interactive': true}, function(redirect_uri) {
          var access_token = redirect_uri.split('access_token=')[1].split('&token_type=')[0];
          console.log(['access_token', access_token]);
          callback(access_token);
        });
      // }
    });
  }

  function call_gmail_api(account, resource, parameters, callback) {
    console.log('inside call_gmail_api');
    login(account, function(token){
      console.log(['token2', token]);
      $.ajax({
          url: 'https://www.googleapis.com/gmail/v1/users/me/' + resource,
          method: 'POST',
          data: JSON.stringify(parameters),
          headers: {'Authorization': 'Bearer ' + token},
          crossDomain: true,
          contentType: 'application/json; charset=UTF-8',
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

  function base64url(str) {
      return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function send_email(account, to, subject, message, send_email_callback) {
    var raw_message = new MimeBuilder('multipart/alternative').setHeader([
      {key: 'To', value: to},
      {key: 'From', value: account},
      {key: 'Subject', value: subject}
    ]).setContent(message).build();
    call_gmail_api(account, 'messages/send', {'raw': base64url(raw_message)}, send_email_callback);
  };

  send_email('info@nvimp.com', 'tomas.holub@gmail.com', 'test from js', 'yeah went through', function(success, response){
    console.log([success, response]);
  });

});
