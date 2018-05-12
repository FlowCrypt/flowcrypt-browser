/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

tool.catch.try(() => {

  tool.ui.event.protect();

  const url_params = tool.env.url_params(['account_email', 'from', 'to', 'subject', 'frame_id', 'thread_id', 'thread_message_id', 'parent_tab_id', 'skip_click_prompt', 'ignore_draft']);

  Store.keys_get(url_params.account_email as string, 'primary').then((primary_k: KeyInfo) => {
  
    const attachment = tool.file.keyinfo_as_pubkey_attachment(primary_k);
    let additional_message_headers: FlatHeaders;
  
    // todo - change to class
    (window as FlowCryptWindow).flowcrypt_compose.init({
      send_message_to_main_window: (channel: string, data: Dict<Serializable>) => tool.browser.message.send(url_params.parent_tab_id as string, channel, data),
    }, {is_reply_box: true, frame_id: url_params.frame_id});
  
    tool.each((url_params.to as string).split(','), function(i, to) {
      $('.recipients').append(tool.e('span', {text: to}));
    });
  
    // render
    $('.pubkey_file_name').text(attachment.name);
    (window as FlowCryptWindow).flowcrypt_compose.resize_reply_box(); // todo - change to class
    tool.browser.message.send(url_params.parent_tab_id as string, 'scroll', {selector: '.reply_message_iframe_container', repeat: [500]});
    $('#input_text').focus();
  
    // determine reply headers
    tool.api.gmail.thread_get(url_params.account_email as string, url_params.thread_id as string, 'full', function (success, thread: any) {
      if (success && thread.messages && thread.messages.length > 0) {
        let thread_message_id_last = tool.api.gmail.find_header(thread.messages[thread.messages.length - 1], 'Message-ID') || '';
        let thread_message_referrences_last = tool.api.gmail.find_header(thread.messages[thread.messages.length - 1], 'In-Reply-To') || '';
        additional_message_headers = { 'In-Reply-To': thread_message_id_last, 'References': thread_message_referrences_last + ' ' + thread_message_id_last };
      }
    });
  
    // send
    $('#send_btn').click(tool.ui.event.prevent(tool.ui.event.double(), function (self) {
      $('#send_btn').text('sending..');
      let message = tool.api.common.message(url_params.account_email as string, url_params.from as string, url_params.to as string, url_params.subject as string, {'text/plain': $('#input_text').get(0).innerText}, [attachment], url_params.thread_id as string);
      tool.each(additional_message_headers, function (k, h) {
        message.headers[k] = h;
      });
      tool.api.gmail.message_send(url_params.account_email as string, message, function (success, response) {
        if(success) {
          tool.browser.message.send(url_params.parent_tab_id as string, 'notification_show', { notification: 'Message sent.' });
          $('#compose').replaceWith('Message sent. The other person should use this information to send a new message.');
        } else {
          $('#send_btn').text('send response');
          alert('There was an error sending message, please try again');
        }
      });
    }));
  
  });

})();