/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

tool.catch.try(() => {

  tool.ui.event.protect();

  const url_params = tool.env.url_params(['account_email', 'from', 'to', 'subject', 'frame_id', 'thread_id', 'thread_message_id', 'parent_tab_id', 'skip_click_prompt', 'ignore_draft']);

  Store.keys_get(url_params.account_email as string, ['primary']).then(([primary_k]) => {
  
    const attachment = tool.file.keyinfo_as_pubkey_attachment(primary_k);
    let additional_message_headers: FlatHeaders;
  
    let composer = new Composer({
      send_message_to_main_window: (channel: string, data: Dict<Serializable>) => tool.browser.message.send(url_params.parent_tab_id as string, channel, data),
      can_read_email: () => false,
      does_recipient_have_my_pubkey: (their_email: string, callback: (has_my_pubkey: boolean|undefined) => void) => callback(false),
      storage_get_addresses: () => [url_params.account_email as string],
      storage_get_addresses_pks: () => [],
      storage_get_addresses_keyserver: () => [],
      storage_get_email_footer: () => null,
      storage_set_email_footer: () => null,
      storage_get_hide_message_password: () => false,
      storage_get_subscription_info: (cb: (si: Subscription) => void) => { if(typeof cb === 'function') {cb(new Subscription(null));} return new Subscription(null); },
      storage_get_armored_public_key: (sender_email: string) => Promise.resolve(null),
      storage_set_draft_meta: () => Promise.resolve(),
      storage_passphrase_get: () => Promise.resolve(null),
      storage_add_admin_codes: (short_id: string, message_admin_code: string, attachment_admin_codes: string[], callback: VoidCallback) => callback(),
      storage_contact_get: (email: string) => Store.db_contact_get(null, email),
      storage_contact_update: (email: string[]|string, update: ContactUpdate) => Store.db_contact_update(null, email, update),
      storage_contact_save: (contact: Contact) => Store.db_contact_save(null, contact),
      storage_contact_search: (query: DbContactFilter) => Store.db_contact_search(null, query),
      storage_contact_object: Store.db_contact_object,
      email_provider_draft_get: (draft_id: string) => Promise.resolve(),
      email_provider_draft_create: (mime_message: string) => Promise.resolve(),
      email_provider_draft_update: (draft_id: string, mime_message: string) => Promise.resolve(),
      email_provider_draft_delete: (draft_id: string) => Promise.resolve(),
      email_provider_message_send: (message: SendableMessage, render_upload_progress: ApiCallProgressCallback) => Promise.resolve(),
      email_provider_search_contacts: (query: string, known_contacts: Contact[], multi_cb: Callback) => tool.api.gmail.search_contacts(url_params.account_email as string, query, known_contacts, multi_cb),
      email_provider_determine_reply_message_header_variables: (callback: Function) => callback(),
      email_provider_extract_armored_block: (message_id: string, success: Callback, error: (error_type: any, url_formatted_data_block: string) => void) => success(),
      send_message_to_background_script: (channel: string, data: Dict<Serializable>) => tool.browser.message.send(null, channel, data),
      render_reinsert_reply_box: (last_message_id: string, recipients: string[]) => Promise.resolve(),
      render_footer_dialog: () => null,
      render_add_pubkey_dialog: (emails: string[]) => null,
      render_help_dialog: () => null,
      render_sending_address_dialog: () => null,
      close_message: () => null,
      factory_attachment: (attachment: Attachment) => `<div>${attachment.name}</div>`,
    }, {is_reply_box: true, frame_id: url_params.frame_id});
  
    tool.each((url_params.to as string).split(','), function(i, to) {
      $('.recipients').append(tool.e('span', {text: to}));
    });
  
    // render
    $('.pubkey_file_name').text(attachment.name);
    composer.resize_reply_box(); // todo - change to class
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