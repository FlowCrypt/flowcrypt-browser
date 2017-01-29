/* Business Source License 1.0 © 2016 Tom James Holub (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/tomholub/cryptup-chrome/tree/master/src/LICENCE */

'use strict';

var url_params = get_url_params(['account_email', 'parent_tab_id']);

$('.action_send_feedback').click(function () {
  var original_button_text = $(this).text();
  var button = this;
  $(this).html(get_spinner());
  setTimeout(function () { // this is so that spinner starts spinning before a potential failed connection alert shows up
    keyserver_call('help/feedback', { email: url_params.account_email, message: $('#input_text').val(), }, function (success, response) {
      if(success && response.sent === true) {
        $(button).text('sent!');
        alert('Message sent! You will find your response in ' + url_params.account_email + ', check your email later. Thanks!');
        chrome_message_send(url_params.parent_tab_id, 'close_page');
      } else {
        $(button).text(original_button_text);
        if(success && response.sent === false) {
          alert(response.text);
        } else {
          alert('Connection failed, please try to send it one more time.');
        }
      }
    });
  }, 50);
});
