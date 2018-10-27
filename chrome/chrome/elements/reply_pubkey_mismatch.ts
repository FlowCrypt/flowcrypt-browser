/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

Catch.try(async () => {

  Ui.event.protect();

  const url_params = Env.url_params(['account_email', 'from', 'to', 'subject', 'frame_id', 'thread_id', 'thread_message_id', 'parent_tab_id', 'skip_click_prompt', 'ignore_draft']);
  let account_email = Env.url_param_require.string(url_params, 'account_email');
  let parent_tab_id = Env.url_param_require.string(url_params, 'parent_tab_id');

  let [primary_k] = await Store.keys_get(account_email, ['primary']);

  const attachment = Attachment.methods.keyinfo_as_pubkey_attachment(primary_k);
  let additional_message_headers: FlatHeaders;

  let app_functions = Composer.default_app_functions();
  app_functions.send_message_to_main_window = (channel: string, data: Dict<Serializable>) => BrowserMsg.send(parent_tab_id, channel, data);
  let composer = new Composer(app_functions, {is_reply_box: true, frame_id: url_params.frame_id}, new Subscription(null));

  for (let to of (url_params.to as string).split(',')) {
    Ui.sanitize_append('.recipients', Ui.e('span', {text: to}));
  }

  // render
  $('.pubkey_file_name').text(attachment.name);
  composer.resize_reply_box();
  BrowserMsg.send(parent_tab_id, 'scroll_to_bottom_of_conversation');
  $('#input_text').focus();

  // determine reply headers
  try {
    let thread = await Api.gmail.thread_get(account_email, url_params.thread_id as string, 'full');
    if (thread.messages && thread.messages.length > 0) {
      let thread_message_id_last = Api.gmail.find_header(thread.messages[thread.messages.length - 1], 'Message-ID') || '';
      let thread_message_referrences_last = Api.gmail.find_header(thread.messages[thread.messages.length - 1], 'In-Reply-To') || '';
      additional_message_headers = { 'In-Reply-To': thread_message_id_last, 'References': thread_message_referrences_last + ' ' + thread_message_id_last };
    }
  } catch (e) {
    if(Api.error.is_auth_popup_needed(e)) {
      BrowserMsg.send(parent_tab_id, 'notification_show_auth_popup_needed', {account_email});
    } else if (Api.error.is_network_error(e)) {
      // todo - render retry button
    } else {
      Catch.handle_exception(e);
      // todo - render error
    }
  }

  // send
  $('#send_btn').click(Ui.event.prevent('double', async target => {
    $(target).text('sending..');
    let message = await Api.common.message(account_email, url_params.from as string, url_params.to as string, url_params.subject as string, {'text/plain': $('#input_text').get(0).innerText}, [attachment], url_params.thread_id as string);
    for (let k of Object.keys(additional_message_headers)) {
      message.headers[k] = additional_message_headers[k];
    }
    try {
      await Api.gmail.message_send(account_email, message);
      BrowserMsg.send(parent_tab_id, 'notification_show', { notification: 'Message sent.' });
      Ui.sanitize_replace('#compose', 'Message sent. The other person should use this information to send a new message.');
    } catch (e) {
      if(Api.error.is_auth_popup_needed(e)) {
        $(target).text('send response');
        BrowserMsg.send(parent_tab_id, 'notification_show_auth_popup_needed', {account_email});
        alert('Google account permission needed, please re-connect account and try again.');
      } else if(Api.error.is_network_error(e)) {
        $(target).text('send response');
        alert('No internet connection, please try again.');
      } else {
        Catch.handle_exception(e);
        $(target).text('send response');
        alert('There was an error sending, please try again.');
      }
    }
  }));

})();
