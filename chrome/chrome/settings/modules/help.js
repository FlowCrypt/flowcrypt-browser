/* Business Source License 1.0 © 2016 Tom James Holub (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/tomholub/cryptup-chrome/tree/master/src/LICENCE */

'use strict';

var url_params = tool.env.url_params(['account_email', 'parent_tab_id']);

$('.action_send_feedback').click(function () {
  var original_button_text = $(this).text();
  var button = this;
  $(this).html(tool.ui.spinner('white'));
  setTimeout(function () { // this is so that spinner starts spinning before a potential failed connection alert shows up
    tool.api.cryptup.help_feedback(url_params.account_email, $('#input_text').val() + '\n\n\nCryptUp ' + catcher.version(), function (success, response) {
      if(success && response.sent === true) {
        $(button).text('sent!');
        alert('Message sent! You will find your response in ' + url_params.account_email + ', check your email later. Thanks!');
        tool.browser.message.send(url_params.parent_tab_id, 'close_page');
      } else {
        $(button).text(original_button_text);
        if(success && response.sent === false) {
          alert(response.text);
        } else {
          alert('Connection failed, please try to send it one more time. My direct email is tom@cryptup.org');
        }
      }
    });
  }, 50);
});
