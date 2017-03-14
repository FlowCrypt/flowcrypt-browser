/* Business Source License 1.0 © 2016 Tom James Holub (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/tomholub/cryptup-chrome/tree/master/src/LICENCE */

$('.account_email').val('cryptup.tester.1@outlook.com');

tool.browser.message.tab_id(function(tab_id) {
  tool.browser.message.listen({
    microsoft_access_token_result: function(data, sender, respond) {
      var token_response = tool.env.url_params(['error', 'error_description', 'access_token', 'token_type', 'expires_in', 'id_token', 'scope', 'state'], data.token.replace('#', ''));
      console.log(data.token.replace('#', '').split(/&/g).map(function(pair) { return pair.split('=')[0]}));
      if(token_response.error) {
        alert(token_response.error + ':' + decodeURIComponent(token_response.error_description));
      } else {
        var account_email = tool.api.id_token(token_response.id_token).email;
        $('.account_email').val(account_email);
        console.log('account_email: ' + account_email);
        token_response.expires_on = Date.now() + (token_response.expires_in * 1000);
        token_response.expires_on_debug = String(new Date(token_response.expires_on));
        add_account_email_to_list_of_accounts(account_email, function() {
          account_storage_set(account_email, {microsoft_auth: token_response}, render_token_info);
        });
      }
    },
  }, tab_id);
});

function render_token_info() {
  account_storage_get($('.account_email').val(), ['microsoft_auth'], function (storage) {
    $('#microsoft_auth').text(JSON.stringify(storage.microsoft_auth, null, '  '));
  });
}

function render_api_response(success, result) {
  $('#api_response').text(JSON.stringify(result, null, '  ')).css('border', success ? '2px solid green' : '2px solid red');
}

$('.action_office_auth').click(function () {
  $('body').append(element_factory().meta.oauth(tool.api.outlook.oauth_url($('.account_email').val())));
});

$('.action_send_email').click(tool.ui.event.prevent(tool.ui.event.double(), function() {
  tool.api.outlook.message_send($('.account_email').val(), $('.input_subject').val(), $('.input_to').val().split(','), $('.input_body').val(), [], $('.input_thread_id').val() || null, render_api_response);
}));

render_token_info();