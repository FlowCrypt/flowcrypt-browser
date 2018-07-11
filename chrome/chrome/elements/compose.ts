/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

tool.catch.try(async() => {

  tool.ui.event.protect();

  let url_params = tool.env.url_params(['account_email', 'parent_tab_id', 'draft_id', 'placement', 'frame_id', 'is_reply_box', 'from', 'to', 'subject', 'thread_id', 'thread_message_id', 'skip_click_prompt', 'ignore_draft']);
  let account_email = tool.env.url_param_require.string(url_params, 'account_email');
  let parent_tab_id = tool.env.url_param_require.string(url_params, 'parent_tab_id');

  let subscription_when_page_was_opened = await Store.subscription();
  const storage_keys = ['google_token_scopes', 'addresses', 'addresses_pks', 'addresses_keyserver', 'email_footer', 'email_provider', 'hide_message_password', 'drafts_reply'];
  let storage = await Store.get_account(account_email, storage_keys);
  await recover_missing_url_params();
  
  let tab_id = await tool.browser.message.required_tab_id();
  
  const can_read_email = tool.api.gmail.has_scope(storage.google_token_scopes as string[], 'read');
  const factory = new Factory(account_email, tab_id);
  if (url_params.is_reply_box && url_params.thread_id && !url_params.ignore_draft && storage.drafts_reply && storage.drafts_reply[url_params.thread_id as string]) { // there may be a draft we want to load
    url_params.draft_id = storage.drafts_reply[url_params.thread_id as string];
  }

  let composer = new Composer({
    can_read_email: () => can_read_email,
    does_recipient_have_my_pubkey: (their_email: string, callback: (has_my_pubkey: boolean|undefined) => void) => {
      their_email = tool.str.parse_email(their_email).email;
      Store.get_account(account_email, ['pubkey_sent_to']).then(storage => {
        if (tool.value(their_email).in(storage.pubkey_sent_to || [])) {
          callback(true);
        } else if (!can_read_email) {
          callback(undefined);
        } else {
          const q_sent_pubkey = 'is:sent to:' + their_email + ' "BEGIN PGP PUBLIC KEY" "END PGP PUBLIC KEY"';
          const q_received_message = 'from:' + their_email + ' "BEGIN PGP MESSAGE" "END PGP MESSAGE"';
          tool.api.gmail.message_list(account_email, '(' + q_sent_pubkey + ') OR (' + q_received_message + ')', true).then(response => {
            if (response.messages) {
              Store.set(account_email, {pubkey_sent_to: (storage.pubkey_sent_to || []).concat(their_email)}).then(() => callback(true));
            } else {
              callback(false);
            }
          }, (e) => {
            tool.api.error.notify_parent_if_auth_popup_needed(account_email, parent_tab_id, e, false);
            callback(false);
          });  
        }
      });
    },
    storage_get_addresses: () => storage.addresses || [account_email],
    storage_get_addresses_pks: () => storage.addresses_pks || [],
    storage_get_addresses_keyserver: () => storage.addresses_keyserver || [],
    storage_get_email_footer: () => storage.email_footer || null,
    storage_set_email_footer: async (footer: string|null) => {
      storage.email_footer = footer;
      await Store.set(account_email, {email_footer: footer});
    },
    storage_get_hide_message_password: () => !!storage.hide_message_password,
    storage_get_subscription: () => Store.subscription(),
    storage_get_key: async (sender_email: string): Promise<KeyInfo> => {
      let [primary_k] = await Store.keys_get(account_email, ['primary']);
      if(primary_k) {
        return primary_k;
      } else {
        throw new ComposerUserError('FlowCrypt is not properly set up. No Public Key found in storage.');
      }
    },
    storage_set_draft_meta: (store_if_true: boolean, draft_id: string, thread_id: string, recipients: string[], subject: string) => tool.catch.Promise((resolve, reject) => {
      Store.get_account(account_email, ['drafts_reply', 'drafts_compose']).then(draft_storage => {
        if (thread_id) { // it's a reply
          let drafts = draft_storage.drafts_reply || {};
          if (store_if_true) {
            drafts[thread_id] = draft_id;
          } else {
            delete drafts[thread_id];
          }
          Store.set(account_email, {drafts_reply: drafts}).then(resolve);
        } else { // it's a new message
          let drafts = draft_storage.drafts_compose || {};
          drafts = draft_storage.drafts_compose || {};
          if (store_if_true) {
            drafts[draft_id] = {recipients: recipients, subject: subject, date: new Date().getTime()};
          } else {
            delete drafts[draft_id];
          }
          Store.set(account_email, {drafts_compose: drafts}).then(resolve);
        }
      });
    }),
    storage_passphrase_get: () => {
      return tool.catch.Promise((resolve, reject) => {
        Store.keys_get(account_email, ['primary']).then(([primary_ki]) => {
          if(primary_ki === null) {
            resolve(null); // flowcrypt just uninstalled or reset?
          } else {
            Store.passphrase_get(account_email, primary_ki.longid).then(resolve, reject);
          }
        });
      });
    },
    storage_add_admin_codes: async (short_id: string, message_admin_code: string, attachment_admin_codes: string[]) => {
      let admin_code_storage = await Store.get_global(['admin_codes']);
      admin_code_storage.admin_codes = admin_code_storage.admin_codes || {};
      admin_code_storage.admin_codes[short_id] = {
        date: Date.now(),
        codes: [message_admin_code].concat(attachment_admin_codes || []),
      };
      await Store.set(null, admin_code_storage);
    },
    storage_contact_get: (email: string[]) => Store.db_contact_get(null, email),
    storage_contact_update: (email: string[]|string, update: ContactUpdate) => Store.db_contact_update(null, email, update),
    storage_contact_save: (contact: Contact) => Store.db_contact_save(null, contact),
    storage_contact_search: (query: DbContactFilter) => Store.db_contact_search(null, query),
    storage_contact_object: Store.db_contact_object,
    email_provider_draft_get: (draft_id: string) => catch_auth_error(tool.api.gmail.draft_get(account_email, draft_id, 'raw')),
    email_provider_draft_create: (mime_message: string) => catch_auth_error(tool.api.gmail.draft_create(account_email, mime_message, url_params.thread_id as string)),
    email_provider_draft_update: (draft_id: string, mime_message: string) => catch_auth_error(tool.api.gmail.draft_update(account_email, draft_id, mime_message)),
    email_provider_draft_delete: (draft_id: string) => catch_auth_error(tool.api.gmail.draft_delete(account_email, draft_id)),
    email_provider_message_send: (message: SendableMessage, render_upload_progress: ApiCallProgressCallback) => catch_auth_error(tool.api.gmail.message_send(account_email, message, render_upload_progress)),
    // todo tool.api.gmail.search_contacts auth popup needed error should be handled
    email_provider_search_contacts: (query: string, known_contacts: Contact[], multi_cb: Callback) => tool.api.gmail.search_contacts(account_email, query, known_contacts, multi_cb),
    email_provider_determine_reply_message_header_variables: async () => {
      try {
        let thread = await tool.api.gmail.thread_get(account_email, url_params.thread_id as string, 'full');
        if (thread.messages && thread.messages.length > 0) {
          let thread_message_id_last = tool.api.gmail.find_header(thread.messages[thread.messages.length - 1], 'Message-ID') || '';
          let thread_message_referrences_last = tool.api.gmail.find_header(thread.messages[thread.messages.length - 1], 'In-Reply-To') || '';
          return {last_message_id: thread.messages[thread.messages.length - 1].id, headers: { 'In-Reply-To': thread_message_id_last, 'References': thread_message_referrences_last + ' ' + thread_message_id_last }};
        } else {
          return;
        }  
      } catch(e) {
        tool.api.error.notify_parent_if_auth_popup_needed(account_email, parent_tab_id, e);
      }
    },
    email_provider_extract_armored_block: (message_id: string) => catch_auth_error(tool.api.gmail.extract_armored_block(account_email, message_id, 'full')),
    send_message_to_main_window: (channel: string, data: Dict<Serializable>) => tool.browser.message.send(parent_tab_id, channel, data),
    send_message_to_background_script: (channel: string, data: Dict<Serializable>) => tool.browser.message.send(null, channel, data),
    render_reinsert_reply_box: (last_message_id: string, recipients: string[]) => {
      tool.browser.message.send(parent_tab_id, 'reinsert_reply_box', {
        account_email: account_email,
        my_email: url_params.from,
        subject: url_params.subject,
        their_email: recipients.join(','),
        thread_id: url_params.thread_id,
        thread_message_id: last_message_id,
      });
    },
    render_footer_dialog: () => $.featherlight({iframe: factory.src_add_footer_dialog('compose'), iframeWidth: 490, iframeHeight: 230, variant: 'noscroll', afterContent: () => {
      $('.featherlight.noscroll > .featherlight-content > iframe').attr('scrolling', 'no');
    }}),
    render_add_pubkey_dialog: (emails: string[]) => {
      if (url_params.placement !== 'settings') {
        tool.browser.message.send(parent_tab_id, 'add_pubkey_dialog', {emails: emails});
      } else {
        $.featherlight({iframe: factory.src_add_pubkey_dialog(emails, 'settings'), iframeWidth: 515, iframeHeight: composer.S.cached('body').height()! - 50}); // body element is present
      }
    },
    render_help_dialog: () => tool.browser.message.send(null, 'settings', { account_email: account_email, page: '/chrome/settings/modules/help.htm' }),
    render_sending_address_dialog: () => $.featherlight({iframe: factory.src_sending_address_dialog('compose'), iframeWidth: 490, iframeHeight: 500}),
    close_message: close_message,
    factory_attachment: (attachment: Attachment) => factory.embedded_attachment(attachment),
  }, {
    account_email: account_email,
    draft_id: url_params.draft_id,
    thread_id: url_params.thread_id,
    subject: url_params.subject,
    from: url_params.from,
    to: url_params.to,
    frame_id: url_params.frame_id,
    tab_id: tab_id,
    is_reply_box: url_params.is_reply_box,
    skip_click_prompt: url_params.skip_click_prompt,
  }, subscription_when_page_was_opened);

  tool.browser.message.listen({
    close_dialog: function (data, sender, respond) {
      $('.featherlight.featherlight-iframe').remove();
    },
    set_footer: function (data: {footer: string|null}, sender, respond) {
      storage.email_footer = data.footer;
      composer.update_footer_icon();
      $('.featherlight.featherlight-iframe').remove();
    },
    subscribe: (data, sender, respond) => composer.show_subscribe_dialog_and_wait_for_response,
    subscribe_result: (new_subscription: Subscription) => {
      if (new_subscription.active && !subscription_when_page_was_opened.active) {
        subscription_when_page_was_opened.active = new_subscription.active;
      }
      composer.process_subscribe_result(new_subscription);
    },
    passphrase_entry: function (data) {
      composer.passphrase_entry(data && data.entered);
    },
    reply_pubkey_mismatch: function (data) {
      if (url_params.is_reply_box) {
        window.location.href = tool.env.url_create('reply_pubkey_mismatch.htm', url_params);
      }
    },
  }, tab_id || undefined);

  function recover_missing_url_params() {
    return new Promise(resolve => {
      if(!url_params.is_reply_box || (url_params.thread_id && url_params.thread_id !== url_params.thread_message_id && url_params.to && url_params.from && url_params.subject)) {
        resolve(); // either not a reply box, or reply box & has all needed params
        return;
      }
      $('#new_message').prepend(tool.e('div', {id: 'loader', html: 'Loading secure reply box..' + tool.ui.spinner('green')}));
      tool.api.gmail.message_get(account_email, url_params.thread_message_id as string, 'metadata').then(gmail_message_object => {
        url_params.thread_id = gmail_message_object.threadId;
        let reply = tool.api.common.reply_correspondents(account_email, storage.addresses || [], tool.api.gmail.find_header(gmail_message_object, 'from'), (tool.api.gmail.find_header(gmail_message_object, 'to') || '').split(','));
        if(!url_params.to) {
          url_params.to = reply.to.join(',');
        }
        if(!url_params.from) {
          url_params.from = reply.from;
        }
        if(!url_params.subject) {
          url_params.subject = tool.api.gmail.find_header(gmail_message_object, 'subject');
        }
        $('#loader').remove();
        resolve();
      }, (e) => {
        tool.api.error.notify_parent_if_auth_popup_needed(account_email, parent_tab_id, e, false);
        if(!url_params.from) {
          url_params.from = account_email;
        }
        if(!url_params.subject) {
          url_params.subject = '';
        }
        url_params.thread_id = url_params.thread_id || url_params.thread_message_id as string;
        console.info('FlowCrypt: Substituting thread_id: could cause issues. Value:' + String(url_params.thread_id));
        $('#loader').remove();
        resolve();
      });
    })
  }

  function close_message() {
    $('body').attr('data-test-state', 'closed');  // used by automated tests
    if(url_params.is_reply_box) {
      tool.browser.message.send(parent_tab_id, 'close_reply_message', {frame_id: url_params.frame_id, thread_id: url_params.thread_id});
    } else if(url_params.placement === 'settings') {
        tool.browser.message.send(parent_tab_id, 'close_page');
    } else {
      tool.browser.message.send(parent_tab_id, 'close_new_message');
    }
  }

  function catch_auth_error <RETURM_TYPE_OF_F>(p: Promise<RETURM_TYPE_OF_F>): Promise<RETURM_TYPE_OF_F> {
    p.catch(e => tool.api.error.notify_parent_if_auth_popup_needed(account_email, parent_tab_id, e));
    return p;
  }

})();