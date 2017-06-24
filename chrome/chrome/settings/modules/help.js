/* Business Source License 1.0 © 2016 FlowCrypt Limited (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/CryptUp/cryptup-browser/tree/master/src/LICENCE */

'use strict';

var url_params = tool.env.url_params(['account_email', 'parent_tab_id']);

$('.action_send_feedback').click(function () {
  var original_button_text = $(this).text();
  var button = this;
  $(this).html(tool.ui.spinner('white'));
  setTimeout(function () { // this is so that spinner starts spinning before a potential failed connection alert shows up
    var msg = $('#input_text').val() + '\n\n\nCryptUp ' + tool.env.browser().name +  ' ' +  catcher.version();
    tool.api.cryptup.help_feedback(url_params.account_email, msg).validate(r => r.sent).then(response => {
      $(button).text('sent!');
      alert('Message sent! You will find your response in ' + url_params.account_email + ', check your email later. Thanks!');
      tool.browser.message.send(url_params.parent_tab_id, 'close_page');
    }, error => {
      $(button).text(original_button_text);
      alert('There was an error sending message. My direct email is tom@cryptup.org\n\n' + error.message);
    });
  }, 50);
});
