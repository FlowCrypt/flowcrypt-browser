/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

tool.catch.try(() => {

  tool.ui.event.protect();

  let url_params = tool.env.url_params(['account_email', 'parent_tab_id', 'draft_id', 'placement', 'frame_id', 'is_reply_box', 'from', 'to', 'subject', 'thread_id', 'thread_message_id', 'skip_click_prompt', 'ignore_draft']);
  
  Store.subscription().then((subscription) => {
  
    type ComposeStorage = {
      google_token_scopes: string[],
      addresses: string[],
      addresses_pks: string[],
      addresses_keyserver: string[],
      email_footer: string|null,
      email_provider: EmailProvider,
      hide_message_password: boolean,
      drafts_reply: any,
    }
  
    const storage_keys = ['google_token_scopes', 'addresses', 'addresses_pks', 'addresses_keyserver', 'email_footer', 'email_provider', 'hide_message_password', 'drafts_reply'];
    Store.get(url_params.account_email as string, storage_keys).then((storage: ComposeStorage) => {
  
      recover_missing_url_params(() => {
  
        tool.browser.message.tab_id(tab_id => {
  
          const can_read_email = tool.api.gmail.has_scope(storage.google_token_scopes as string[], 'read');
          const factory = new Factory(url_params.account_email as string, tab_id);
          if (url_params.is_reply_box && url_params.thread_id && !url_params.ignore_draft && storage.drafts_reply && storage.drafts_reply[url_params.thread_id as string]) { // there may be a draft we want to load
            url_params.draft_id = storage.drafts_reply[url_params.thread_id as string];
          }
  
          (window as FlowCryptWindow).flowcrypt_compose.init({
            can_read_email: () => can_read_email,
            does_recipient_have_my_pubkey: (their_email: string, callback: (has_my_pubkey: boolean|undefined) => void) => {
              their_email = tool.str.parse_email(their_email).email;
              Store.get(url_params.account_email as string, ['pubkey_sent_to']).then(function (pubkey_sent_to_storage: {pubkey_sent_to: string[]}) {
                if (tool.value(their_email).in(pubkey_sent_to_storage.pubkey_sent_to)) {
                  callback(true);
                } else if (!can_read_email) {
                  callback(undefined);
                } else {
                  const q_sent_pubkey = 'is:sent to:' + their_email + ' "BEGIN PGP PUBLIC KEY" "END PGP PUBLIC KEY"';
                  const q_received_message = 'from:' + their_email + ' "BEGIN PGP MESSAGE" "END PGP MESSAGE"';
                  tool.api.gmail.message_list(url_params.account_email as string, '(' + q_sent_pubkey + ') OR (' + q_received_message + ')', true, function (success, response: any) {
                    if (success && response.messages) {
                      Store.set(url_params.account_email as string, {pubkey_sent_to: (pubkey_sent_to_storage.pubkey_sent_to || []).concat(their_email)}).then(() => callback(true));
                    } else {
                      callback(false);
                    }
                  });
                }
              });
            },
            storage_get_addresses: () => storage.addresses || [url_params.account_email as string],
            storage_get_addresses_pks: () => storage.addresses_pks || [],
            storage_get_addresses_keyserver: () => storage.addresses_keyserver || [],
            storage_get_email_footer: () => storage.email_footer,
            storage_set_email_footer: (footer: string|null) => {
              storage.email_footer = footer;
              Store.set(url_params.account_email as string, {email_footer: footer}); // async
            },
            storage_get_hide_message_password: () => !!storage.hide_message_password,
            storage_get_subscription_info: (cb: (si: SubscriptionInfo) => void) => { // returns cached result, callbacks with fresh result
              if(typeof cb === 'function') {
                Store.subscription().then(subscription => {
                  cb(subscription);
                });
              }
              return subscription; // todo - deprecate
            },
            storage_get_armored_public_key: (sender_email: string) => {
              return catcher.Promise((resolve, reject) => {
                Store.keys_get(url_params.account_email as string, ['primary']).then(([primary_k]) => {
                  if(primary_k) {
                    resolve(primary_k.public);
                  } else {
                    reject('FlowCrypt is not properly set up. No Public Key found in storage.')
                  }
                });
              });
            },
            storage_set_draft_meta: (store_if_true: boolean, draft_id: string, thread_id: string, recipients: string[], subject: string) => catcher.Promise((resolve, reject) => {
              Store.get(url_params.account_email as string, ['drafts_reply', 'drafts_compose']).then(function (draft_storage: {drafts_reply: Dict<string>, drafts_compose: Dict<string>}) {
                let drafts: Dict<string|{recipients: string[], subject: string, date: number}>;
                if (thread_id) { // it's a reply
                  drafts = draft_storage.drafts_reply || {};
                  if (store_if_true) {
                    drafts[thread_id] = draft_id;
                  } else {
                    delete drafts[thread_id];
                  }
                  Store.set(url_params.account_email as string, {drafts_reply: drafts as Serializable}).then(resolve);
                } else { // it's a new message
                  drafts = draft_storage.drafts_compose || {};
                  if (store_if_true) {
                    drafts[draft_id] = {recipients: recipients, subject: subject, date: new Date().getTime()};
                  } else {
                    delete drafts[draft_id];
                  }
                  Store.set(url_params.account_email as string, {drafts_compose: drafts as Serializable}).then(resolve);
                }
              });
            }),
            storage_passphrase_get: () => {
              return catcher.Promise((resolve, reject) => {
                Store.keys_get(url_params.account_email as string, ['primary']).then(([primary_ki]) => {
                  if(primary_ki === null) {
                    resolve(null); // flowcrypt just uninstalled or reset?
                  } else {
                    Store.passphrase_get(url_params.account_email as string, primary_ki.longid).then(resolve, reject);
                  }
                });
              });
            },
            storage_add_admin_codes: (short_id: string, message_admin_code: string, attachment_admin_codes: string[], callback: VoidCallback) => {
              Store.get(null, ['admin_codes']).then((admin_code_storage: {admin_codes: Dict<{date: number, codes: string[]}>}) => {
                admin_code_storage.admin_codes = admin_code_storage.admin_codes || {};
                admin_code_storage.admin_codes[short_id] = {
                  date: Date.now(),
                  codes: [message_admin_code].concat(attachment_admin_codes || []),
                };
                Store.set(null, admin_code_storage as any as Dict<Serializable>).then(callback);
              });
            },
            storage_contact_get: (email: string) => catcher.Promise((resolve, reject) => Store.db_contact_get(null, email, resolve)),
            storage_contact_update: (email: string, update: Contact) => catcher.Promise((resolve, reject) => Store.db_contact_update(null, email, update, resolve)),
            storage_contact_save: (contact: Contact) => catcher.Promise((resolve, reject) => Store.db_contact_save(null, contact, resolve)),
            storage_contact_search: (query: DbContactFilter) => catcher.Promise((resolve, reject) => Store.db_contact_search(null, query, resolve)),
            storage_contact_object: Store.db_contact_object,
            email_provider_draft_get: (draft_id: string) => catcher.Promise((resolve, reject) => {
              tool.api.gmail.draft_get(url_params.account_email as string, draft_id, 'raw', (success, response) => {
                (success ? resolve : reject)(response);
              });
            }),
            email_provider_draft_create: (mime_message: string) => catcher.Promise((resolve, reject) => {
              tool.api.gmail.draft_create(url_params.account_email as string, mime_message, url_params.thread_id as string, (success, response) => {
                (success ? resolve : reject)(response);
              });
            }),
            email_provider_draft_update: (draft_id: string, mime_message: string) => catcher.Promise((resolve, reject) => {
              tool.api.gmail.draft_update(url_params.account_email as string, draft_id, mime_message, (success, response) => {
                (success ? resolve : reject)(response);
              });
            }),
            email_provider_draft_delete: (draft_id: string) => catcher.Promise((resolve, reject) => {
              tool.api.gmail.draft_delete(url_params.account_email as string, draft_id, (success, response) => {
                (success ? resolve : reject)(response);
              });
            }),
            email_provider_message_send: (message: SendableMessage, render_upload_progress: ApiCallProgressCallback) => catcher.Promise((resolve, reject) => {
              tool.api.gmail.message_send(url_params.account_email as string, message, function (success, response: any) {
                if(success) {
                  resolve(response);
                } else if(response && response.status === 0) {
                  reject({code: null, message: 'Internet unavailable, please try again', internal: 'network'});
                } else {
                  reject(response);
                }
              }, render_upload_progress);
            }),
            email_provider_search_contacts: (query: string, known_contacts: Contact[], multi_cb: Callback) => tool.api.gmail.search_contacts(url_params.account_email as string, query, known_contacts, multi_cb),
            email_provider_determine_reply_message_header_variables: (callback: Function) => {
              tool.api.gmail.thread_get(url_params.account_email as string, url_params.thread_id as string, 'full', function (success, thread: any) {
                if (success && thread.messages && thread.messages.length > 0) {
                  let thread_message_id_last = tool.api.gmail.find_header(thread.messages[thread.messages.length - 1], 'Message-ID') || '';
                  let thread_message_referrences_last = tool.api.gmail.find_header(thread.messages[thread.messages.length - 1], 'In-Reply-To') || '';
                  callback(thread.messages[thread.messages.length - 1].id, { 'In-Reply-To': thread_message_id_last, 'References': thread_message_referrences_last + ' ' + thread_message_id_last });
                } else {
                  callback();
                }
              });
            },
            email_provider_extract_armored_block: (message_id: string, success: Callback, error: Callback) => tool.api.gmail.extract_armored_block(url_params.account_email as string, message_id, 'full', success, error),
            send_message_to_main_window: (channel: string, data: Dict<Serializable>) => tool.browser.message.send(url_params.parent_tab_id as string, channel, data),
            send_message_to_background_script: (channel: string, data: Dict<Serializable>) => tool.browser.message.send(null, channel, data),
            render_reinsert_reply_box: (last_message_id: string, recipients: string[]) => {
              tool.browser.message.send(url_params.parent_tab_id as string, 'reinsert_reply_box', {
                account_email: url_params.account_email as string,
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
                tool.browser.message.send(url_params.parent_tab_id as string, 'add_pubkey_dialog', {emails: emails});
              } else {
                $.featherlight({iframe: factory.src_add_pubkey_dialog(emails, 'settings'), iframeWidth: 515, iframeHeight: (window as FlowCryptWindow).flowcrypt_compose.S.cached('body').height() - 50});
              }
            },
            render_help_dialog: () => tool.browser.message.send(null, 'settings', { account_email: url_params.account_email as string, page: '/chrome/settings/modules/help.htm' }),
            render_sending_address_dialog: () => $.featherlight({iframe: factory.src_sending_address_dialog('compose'), iframeWidth: 490, iframeHeight: 500}),
            close_message: close_message,
            factory_attachment: (attachment: Attachment) => factory.embedded_attachment(attachment as any as UrlParams),
          }, {
            account_email: url_params.account_email as string,
            draft_id: url_params.draft_id,
            thread_id: url_params.thread_id,
            subject: url_params.subject,
            from: url_params.from,
            to: url_params.to,
            frame_id: url_params.frame_id,
            tab_id: tab_id,
            is_reply_box: url_params.is_reply_box,
            skip_click_prompt: url_params.skip_click_prompt,
          });
  
          tool.browser.message.listen({
            close_dialog: function (data) {
              $('.featherlight.featherlight-iframe').remove();
            },
            set_footer: function (data: {footer: string|null}) {
              storage.email_footer = data.footer;
              (window as FlowCryptWindow).flowcrypt_compose.update_footer_icon();
              $('.featherlight.featherlight-iframe').remove();
            },
            subscribe: (window as FlowCryptWindow).flowcrypt_compose.show_subscribe_dialog_and_wait_for_response,
            subscribe_result: (new_subscription: SubscriptionInfo) => {
              if (new_subscription.active && !subscription.active) {
                subscription.active = new_subscription.active;
              }
              (window as FlowCryptWindow).flowcrypt_compose.process_subscribe_result(new_subscription);
            },
            passphrase_entry: function (data) {
              (window as FlowCryptWindow).flowcrypt_compose.passphrase_entry(data && data.entered);
            },
            reply_pubkey_mismatch: function (data) {
              if (url_params.is_reply_box) {
                window.location.href = tool.env.url_create('reply_pubkey_mismatch.htm', url_params);
              }
            },
          }, tab_id);
  
        });
      });
  
      function recover_missing_url_params(callback: VoidCallback) {
        if(url_params.is_reply_box) {
          if(url_params.thread_id && url_params.thread_id !== url_params.thread_message_id && url_params.to && url_params.from && url_params.subject) {
            callback();
          } else {
            $('#new_message').prepend(tool.e('div', {id: 'loader', html: 'Loading secure reply box..' + tool.ui.spinner('green')}));
            tool.api.gmail.message_get(url_params.account_email as string, url_params.thread_message_id as string, 'metadata', function (success: boolean, gmail_message_object: any) {
              if (success) {
                url_params.thread_id = gmail_message_object.threadId;
                let reply = tool.api.common.reply_correspondents(url_params.account_email as string, storage.addresses, tool.api.gmail.find_header(gmail_message_object, 'from'), (tool.api.gmail.find_header(gmail_message_object, 'to') || '').split(','));
                if(!url_params.to) {
                  url_params.to = reply.to.join(',');
                }
                if(!url_params.from) {
                  url_params.from = reply.from;
                }
                if(!url_params.subject) {
                  url_params.subject = tool.api.gmail.find_header(gmail_message_object, 'subject');
                }
              } else {
                if(!url_params.from) {
                  url_params.from = url_params.account_email as string;
                }
                if(!url_params.subject) {
                  url_params.subject = '';
                }
                url_params.thread_id = url_params.thread_id || url_params.thread_message_id as string;
                console.log('FlowCrypt: Substituting thread_id: could cause issues. Value:' + String(url_params.thread_id));
              }
              $('#loader').remove();
              callback();
            });
          }
        } else {
          callback();
        }
      }
  
    });
  
    function close_message() {
      $('body').attr('data-test-state', 'closed');  // used by automated tests
      if(url_params.is_reply_box) {
        tool.browser.message.send(url_params.parent_tab_id as string, 'close_reply_message', {frame_id: url_params.frame_id, thread_id: url_params.thread_id});
      } else if(url_params.placement === 'settings') {
          tool.browser.message.send(url_params.parent_tab_id as string, 'close_page');
      } else {
        tool.browser.message.send(url_params.parent_tab_id as string, 'close_new_message');
      }
    }
  
  });  

})();