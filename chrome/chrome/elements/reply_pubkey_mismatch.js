/* Business Source License 1.0 © 2016 FlowCrypt Limited (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/CryptUp/cryptup-browser/tree/master/src/LICENCE */

'use strict';

var url_params = tool.env.url_params(['account_email', 'from', 'to', 'subject', 'frame_id', 'thread_id', 'thread_message_id', 'parent_tab_id', 'skip_click_prompt', 'ignore_draft']);
var keyinfo = private_keys_get(url_params.account_email, 'primary');
var attachment = tool.file.keyinfo_as_pubkey_attachment(keyinfo);
var compose = init_shared_compose_js(url_params, null, {}, null, true);
var additional_message_headers;

tool.each(url_params.to.split(','), function(i, to) {
  $('.recipients').append(tool.e('span', {text: to}));
});

// render
$('.pubkey_file_name').text(attachment.name);
compose.resize_reply_box();
tool.browser.message.send(url_params.parent_tab_id, 'scroll', {selector: '.reply_message_iframe_container', repeat: [500]});
$('#input_text').focus();

// determine reply headers
tool.api.gmail.thread_get(url_params.account_email, url_params.thread_id, 'full', function (success, thread) {
  if (success && thread.messages && thread.messages.length > 0) {
    var thread_message_id_last = tool.api.gmail.find_header(thread.messages[thread.messages.length - 1], 'Message-ID') || '';
    var thread_message_referrences_last = tool.api.gmail.find_header(thread.messages[thread.messages.length - 1], 'In-Reply-To') || '';
    additional_message_headers = { 'In-Reply-To': thread_message_id_last, 'References': thread_message_referrences_last + ' ' + thread_message_id_last };
  }
});

// send
$('#send_btn').click(tool.ui.event.prevent(tool.ui.event.double(), function (self) {
  $('#send_btn').text('sending..');
  var message = tool.api.common.message(url_params.account_email, url_params.from, url_params.to, url_params.subject, $('#input_text').get(0).innerText, [attachment], url_params.thread_id);
  tool.each(additional_message_headers, function (k, h) {
    message.headers[k] = h;
  });
  tool.api.gmail.message_send(url_params.account_email, message, function (success, response) {
    if(success) {
      tool.browser.message.send(url_params.parent_tab_id, 'notification_show', { notification: 'Message sent.' });
      $('#reply_message_table_container').text('Message sent. The other person should use this information to send a new message.');
    } else {
      $('#send_btn').text('send response');
      alert('There was an error sending message, please try again');
    }
  });
}));

