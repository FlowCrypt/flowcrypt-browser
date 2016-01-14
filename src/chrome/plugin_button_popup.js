
console.log(1);
function gmail_api_login(account, callback) {
  console.log(3);
  var redirect_uri = 'https://nmelpmhpelannghfpkbmmpfggmildcmj.chromiumapp.org/google-auth-cb';
  var scope = 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send';
  var client_id = '717284730244-1ko46mlo9u0h9r16mlr6paine5u1qn7p.apps.googleusercontent.com'; //webapp
  var endpoint = 'https://accounts.google.com/o/oauth2/v2/auth';
  var url = endpoint + '?response_type=token&client_id=' + encodeURIComponent(client_id) + '&redirect_uri=' + encodeURIComponent(redirect_uri) + '&scope=' + encodeURIComponent(scope) + '&login_hint=' + encodeURIComponent(account);
  chrome.identity.launchWebAuthFlow({'url': url, 'interactive': true}, function(redirect_uri) {
    console.log(4);
    var access_token = redirect_uri.split('access_token=')[1].split('&token_type=')[0];
    callback(access_token);
  });
}
console.log(2);
var account = 'info@nvimp.com';
gmail_api_login(account, function(token){
  console.log(5);
  chrome.storage.local.set({'token': token}, function(){
    alert('logged in with token: ' + token);
  });
});

// Copyright (c) 2014 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/*
function getCurrentTabUrl(callback) {
  // Query filter to be passed to chrome.tabs.query - see
  // https://developer.chrome.com/extensions/tabs#method-query
  var queryInfo = {
    active: true,
    currentWindow: true
  };

  chrome.tabs.query(queryInfo, function(tabs) {
    // chrome.tabs.query invokes the callback with a list of tabs that match the
    // query. When the popup is opened, there is certainly a window and at least
    // one tab, so we can safely assume that |tabs| is a non-empty array.
    // A window can only have one active tab at a time, so the array consists of
    // exactly one tab.
    var tab = tabs[0];

    // A tab is a plain object that provides information about the tab.
    // See https://developer.chrome.com/extensions/tabs#type-Tab
    var url = tab.url;

    // tab.url is only available if the "activeTab" permission is declared.
    // If you want to see the URL of other tabs (e.g. after removing active:true
    // from |queryInfo|), then the "tabs" permission is required to see their
    // "url" properties.
    console.assert(typeof url == 'string', 'tab.url should be a string');

    callback(url);
  });

  // Most methods of the Chrome extension APIs are asynchronous. This means that
  // you CANNOT do something like this:
  //
  // var url;
  // chrome.tabs.query(queryInfo, function(tabs) {
  //   url = tabs[0].url;
  // });
  // alert(url); // Shows "undefined", because chrome.tabs.query is async.
}

//document.getElementById('status').textContent = statusText;

document.addEventListener('DOMContentLoaded', function() {
  getCurrentTabUrl(function(url) {
    // Put the image URL in Google search.
    renderStatus('Performing Google Image search for ' + url);

    getImageUrl(url, function(imageUrl, width, height) {

      renderStatus('Search term: ' + url + '\n' +
          'Google image search result: ' + imageUrl);
      var imageResult = document.getElementById('image-result');
      // Explicitly set the width/height to minimize the number of reflows. For
      // a single image, this does not matter, but if you're going to embed
      // multiple external images in your page, then the absence of width/height
      // attributes causes the popup to resize multiple times.
      imageResult.width = width;
      imageResult.height = height;
      imageResult.src = imageUrl;
      imageResult.hidden = false;

    }, function(errorMessage) {
      renderStatus('Cannot display image. ' + errorMessage);
    });
  });
});
*/
