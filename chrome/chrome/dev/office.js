/* Business Source License 1.0 © 2016 Tom James Holub (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/tomholub/cryptup-chrome/tree/master/src/LICENCE */

$('.account_email').val('cryptup.tester.1@outlook.com');


tool.browser.message.tab_id(function(tab_id) {

  function render_token_info() {
    account_storage_get($('.account_email').val(), ['microsoft_auth'], function (storage) {
      $('#microsoft_auth').text(JSON.stringify(storage.microsoft_auth, null, '  '));
    });
  }

  function render_api_response(success, result) {
    $('#api_response').text(JSON.stringify(result, null, '  ')).css('border', success ? '2px solid green' : '2px solid red');
  }

  $('.action_office_auth').click(function () {
    var suggested_login_email = $('.account_email').val();
    var window_id = 'popup_' + tool.str.random(20);
    var close_auth_window = tool.api.auth.window(tool.api.outlook.oauth_url(suggested_login_email, window_id, tab_id, false), function () {
      alert('window closed by user');
    });
    tool.browser.message.listen({
      microsoft_access_token_result: function (message) {
        tool.api.auth.process_fragment(message.fragment, null, window_id, function (success, result, email, state) {
          if(state.frame === window_id && state.tab === tab_id) {
            close_auth_window();
            render_token_info();
            alert('successfully authed as ' + email);
          } else {
            console.log('Ignoring auth request with a wrong frame or tab id: ' + [window_id, tab_id, state.frame, tab.id].join(','));
          }
        });
      },
    }, tab_id);
  });

  $('.action_send_email').click(tool.ui.event.prevent(tool.ui.event.double(), function() {
    var attachments = $('.input_file').prop('checked') ? [tool.file.attachment('some file.txt', 'text/plain', 'this is some file\nreally, its just a file\n\nseriously\n')] : [];
    var body = $('.input_html').prop('checked') ? {'text/html': $('.input_body').val()} : {'text/plain': $('.input_body').val()};
    var message = tool.api.common.message($('.account_email').val(), $('.account_email').val(), $('.input_to').val().split(','), $('.input_subject').val(), body, attachments, $('.input_thread_id').val());
    tool.api.outlook.message_send($('.account_email').val(), message, render_api_response);
  }));

  $('.action_get_thread').click(tool.ui.event.prevent(tool.ui.event.double(), function() {
    tool.api.outlook.message_thread($('.account_email').val(), $('.input_thread_id').val(), render_api_response);
  }));

  render_token_info();

});