'use strict';

var url_params = get_url_params(['account_email', 'parent_tab_id']);

$('.action_send_feedback').click(function() {
  keyserver_call('help/feedback', {
    email: url_params.account_email,
    message: $('#input_text').val(),
  }, function(success, response) {
    if(success && response.sent === true) {
      alert('Message sent! You will find your response in ' + url_params.account_email + ', check your email later. Thanks!');
      chrome_message_send(url_params.parent_tab_id, 'close_page');
    } else {
      if(success && response.sent === false) {
        alert(response.text);
      } else {
        alert('Connection failed, please try to send it one more time.');
      }
    }
  });
});
