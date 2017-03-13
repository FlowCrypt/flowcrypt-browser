/* Business Source License 1.0 © 2016 Tom James Holub (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/tomholub/cryptup-chrome/tree/master/src/LICENCE */

$('.account_email').val('cryptup.tester.1@outlook.com');

var oauth2 = chrome.runtime.getManifest().oauth2; // good for state headers stuff?
var MICROSOFT_CLIENT_ID = '5c22daa5-737e-440b-8dd1-e4e9d0f4a1a9';
var MICROSOFT_REDIRECT_URI = 'https://outlook.office.com/noop/cryptup';
var MICROSOFT_SCOPES = ['openid', 'email', 'https://outlook.office.com/Mail.ReadWrite', 'https://outlook.office.com/Mail.Send'];

tool.browser.message.tab_id(function(tab_id) {
  tool.browser.message.listen({
    microsoft_access_token_result: function(data, sender, respond) {
      console.log('result:' + data.token);
    },
  }, tab_id);
});


$('.action_office_auth').click(function () {
  var auth_url = tool.env.url_create('https://login.microsoftonline.com/common/oauth2/v2.0/authorize', {
    client_id: MICROSOFT_CLIENT_ID,
    response_type: 'token',
    redirect_uri: MICROSOFT_REDIRECT_URI,
    nonce: tool.str.random(20),
    response_mode: 'fragment',
    scope: MICROSOFT_SCOPES.join(' '),
    state: 'cryptup',
    login_hint: $('.account_email').val(),
  });
  console.log('auth:' + auth_url);

  $('body').append(element_factory().meta.oauth(auth_url));

});