/* Business Source License 1.0 © 2016 FlowCrypt Limited (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/CryptUp/cryptup-browser/tree/master/src/LICENCE */

'use strict';

tool.ui.event.protect();

let url_params = tool.env.url_params(['account_email', 'parent_tab_id', 'draft_id', 'placement', 'frame_id', 'is_reply_box', 'from', 'to', 'subject', 'thread_id', 'thread_message_id', 'skip_click_prompt', 'ignore_draft']);

window.flowcrypt_storage.subscription((subscription_level, subscription_expire, subscription_active, subscription_method) => {
  let subscription = { level: subscription_level, expire: subscription_expire, active: subscription_active, method: subscription_method };
  window.flowcrypt_storage.db_open(db => {

    if(db === window.flowcrypt_storage.db_denied) {
      window.flowcrypt_storage.notify_error(url_params.account_email, url_params.parent_tab_id);
      setTimeout(close_message, 300);
      return;
    }

    const storage_keys = ['google_token_scopes', 'addresses', 'addresses_pks', 'addresses_keyserver', 'email_footer', 'email_provider', 'hide_message_password', 'drafts_reply'];
    window.flowcrypt_storage.get(url_params.account_email, storage_keys, storage => {

      recover_missing_url_params(() => {

        tool.browser.message.tab_id(tab_id => {

          const can_read_email = tool.api.gmail.has_scope(storage.google_token_scopes, 'read');
          const factory = element_factory(url_params.account_email, tab_id);
          if (url_params.is_reply_box && url_params.thread_id && !url_params.ignore_draft && storage.drafts_reply && storage.drafts_reply[url_params.thread_id]) { // there may be a draft we want to load
            url_params.draft_id = storage.drafts_reply[url_params.thread_id];
          }

          window.flowcrypt_compose.init({
            can_read_email: () => can_read_email,
            does_recipient_have_my_pubkey: (their_email, callback) => {
              their_email = tool.str.parse_email(their_email).email;
              window.flowcrypt_storage.get(url_params.account_email, ['pubkey_sent_to'], function (pubkey_sent_to_storage) {
                if (tool.value(their_email).in(pubkey_sent_to_storage.pubkey_sent_to)) {
                  callback(true);
                } else if (!can_read_email) {
                  callback(undefined);
                } else {
                  const q_sent_pubkey = 'is:sent to:' + their_email + ' "BEGIN PGP PUBLIC KEY" "END PGP PUBLIC KEY"';
                  const q_received_message = 'from:' + their_email + ' "BEGIN PGP MESSAGE" "END PGP MESSAGE"';
                  tool.api.gmail.message_list(url_params.account_email, '(' + q_sent_pubkey + ') OR (' + q_received_message + ')', true, function (success, response) {
                    if (success && response.messages) {
                      window.flowcrypt_storage.set(url_params.account_email, {pubkey_sent_to: (pubkey_sent_to_storage.pubkey_sent_to || []).concat(their_email),}, function () {
                        callback(true);
                      });
                    } else {
                      callback(false);
                    }
                  });
                }
              });
            },
            storage_get_addresses: () => storage.addresses || [url_params.account_email],
            storage_get_addresses_pks: () => storage.addresses_pks || [],
            storage_get_addresses_keyserver: () => storage.addresses_keyserver || [],
            storage_get_email_footer: () => storage.email_footer,
            storage_get_hide_message_password: () => !!storage.hide_message_password,
            storage_get_subscription_info: (cb) => { // returns cached result, callbacks with fresh result
              if(typeof cb === 'function') {
                window.flowcrypt_storage.subscription(function(subscription_level, subscription_expire, subscription_active, subscription_method) {
                  subscription = {level: subscription_level, expire: subscription_expire, active: subscription_active, method: subscription_method};
                  cb(subscription);
                });
              }
              return subscription;
            },
            storage_get_armored_public_key: (sender_email) => window.flowcrypt_storage.keys_get(url_params.account_email, 'primary').public,
            storage_set_draft_meta: (store_if_true, draft_id, thread_id, recipients, subject) => catcher.Promise((resolve, reject) => {
              window.flowcrypt_storage.get(url_params.account_email, ['drafts_reply', 'drafts_compose'], function (draft_storage) {
                let drafts;
                if (thread_id) { // it's a reply
                  drafts = draft_storage.drafts_reply || {};
                  if (store_if_true) {
                    drafts[thread_id] = draft_id;
                  } else {
                    delete drafts[thread_id];
                  }
                  window.flowcrypt_storage.set(url_params.account_email, {drafts_reply: drafts}, () => {
                    resolve();
                  });
                } else { // it's a new message
                  drafts = draft_storage.drafts_compose || {};
                  if (store_if_true) {
                    drafts[draft_id] = {recipients: recipients, subject: subject, date: new Date().getTime()};
                  } else {
                    delete drafts[draft_id];
                  }
                  window.flowcrypt_storage.set(url_params.account_email, {drafts_compose: drafts}, () => {
                    resolve();
                  });
                }
              });
            }),
            storage_passphrase_get: () => window.flowcrypt_storage.passphrase_get(url_params.account_email),
            storage_add_admin_codes: (short_id, message_admin_code, attachment_admin_codes, callback) => {
              window.flowcrypt_storage.get(null, ['admin_codes'], function (admin_code_storage) {
                admin_code_storage.admin_codes = admin_code_storage.admin_codes || {};
                admin_code_storage.admin_codes[short_id] = {
                  date: Date.now(),
                  codes: [message_admin_code].concat(attachment_admin_codes || [])
                };
                window.flowcrypt_storage.set(null, admin_code_storage, callback);
              });
            },
            storage_contact_get: (email, callback) => window.flowcrypt_storage.db_contact_get(db, email, callback),
            storage_contact_update: (email, update, callback) => window.flowcrypt_storage.db_contact_update(db, email, update, callback),
            storage_contact_save: (contact, callback) => window.flowcrypt_storage.db_contact_save(db, contact, callback),
            storage_contact_search: (query, callback) => window.flowcrypt_storage.db_contact_search(db, query, callback),
            storage_contact_object: window.flowcrypt_storage.db_contact_object,
            email_provider_draft_get: (draft_id) => catcher.Promise((resolve, reject) => {
              tool.api.gmail.draft_get(url_params.account_email, draft_id, 'raw', (success, response) => {
                (success ? resolve : reject)(response);
              });
            }),
            email_provider_draft_create: (mime_message) => catcher.Promise((resolve, reject) => {
              tool.api.gmail.draft_create(url_params.account_email, mime_message, url_params.thread_id, (success, response) => {
                (success ? resolve : reject)(response);
              });
            }),
            email_provider_draft_update: (draft_id, mime_message) => catcher.Promise((resolve, reject) => {
              tool.api.gmail.draft_update(url_params.account_email, draft_id, mime_message, (success, response) => {
                (success ? resolve : reject)(response);
              });
            }),
            email_provider_draft_delete: (draft_id) => catcher.Promise((resolve, reject) => {
              tool.api.gmail.draft_delete(url_params.account_email, draft_id, (success, response) => {
                (success ? resolve : reject)(response);
              });
            }),
            email_provider_message_send: (message, render_upload_progress) => catcher.Promise((resolve, reject) => {
              tool.api.gmail.message_send(url_params.account_email, message, function (success, response) {
                if(success) {
                  resolve(response);
                } else if(response && response.status === 0) {
                  reject({code: null, message: 'Internet unavailable, please try again', internal: 'network'});
                } else {
                  reject(response);
                }
              }, render_upload_progress);
            }),
            email_provider_search_contacts: (query, known_contacts) => catcher.Promise((resolve, reject) => {
              tool.api.gmail.search_contacts(url_params.account_email, query, known_contacts, resolve);
            }),
            email_provider_determine_reply_message_header_variables: (callback) => {
              tool.api.gmail.thread_get(url_params.account_email, url_params.thread_id, 'full', function (success, thread) {
                if (success && thread.messages && thread.messages.length > 0) {
                  let thread_message_id_last = tool.api.gmail.find_header(thread.messages[thread.messages.length - 1], 'Message-ID') || '';
                  let thread_message_referrences_last = tool.api.gmail.find_header(thread.messages[thread.messages.length - 1], 'In-Reply-To') || '';
                  callback(thread.messages[thread.messages.length - 1].id, { 'In-Reply-To': thread_message_id_last, 'References': thread_message_referrences_last + ' ' + thread_message_id_last });
                } else {
                  callback();
                }
              });
            },
            email_provider_extract_armored_block: (message_id, success, error) => tool.api.gmail.extract_armored_block(url_params.account_email, message_id, 'full', success, error),
            send_message_to_main_window: (channel, data) => tool.browser.message.send(url_params.parent_tab_id, channel, data),
            send_message_to_background_script: (channel, data) => tool.browser.message.send(null, channel, data),
            render_reinsert_reply_box: (last_message_id, recipients) => {
              tool.browser.message.send(url_params.parent_tab_id, 'reinsert_reply_box', {
                account_email: url_params.account_email,
                my_email: url_params.from,
                subject: url_params.subject,
                their_email: recipients.join(','),
                thread_id: url_params.thread_id,
                thread_message_id: last_message_id,
              });
            },
            render_footer_dialog: () => {
              $.featherlight({iframe: factory.src.add_footer_dialog('compose'), iframeWidth: 490, iframeHeight: 230, variant: 'noscroll', afterContent: () => {
                $('.featherlight.noscroll > .featherlight-content > iframe').attr('scrolling', 'no');
              }});
            },
            render_add_pubkey_dialog: (emails) => {
              if (url_params.placement !== 'settings') {
                tool.browser.message.send(url_params.parent_tab_id, 'add_pubkey_dialog', {emails: emails});
              } else {
                $.featherlight({iframe: factory.src.add_pubkey_dialog(emails, 'settings'), iframeWidth: 515, iframeHeight: window.flowcrypt_compose.S.cached('body').height() - 50});
              }
            },
            render_help_dialog: () => tool.browser.message.send(null, 'settings', { account_email: url_params.account_email, page: '/chrome/settings/modules/help.htm' }),
            close_message: close_message,
            factory_attachment: (attachment) => factory.embedded.attachment(attachment, []),
          }, {
            account_email: url_params.account_email,
            db: db,
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
            set_footer: function (data) {
              storage.email_footer = data.footer;
              window.flowcrypt_compose.update_footer_icon();
              $('.featherlight.featherlight-iframe').remove();
            },
            subscribe: window.flowcrypt_compose.show_subscribe_dialog_and_wait_for_response,
            subscribe_result: (new_subscription) => {
              if (new_subscription.active && !subscription.active) {
                subscription.active = new_subscription.active;
              }
              window.flowcrypt_compose.process_subscribe_result(new_subscription);
            },
            passphrase_entry: function (data) {
              window.flowcrypt_compose.passphrase_entry(data && data.entered);
            },
            reply_pubkey_mismatch: function (data) {
              if (url_params.is_reply_box) {
                window.location = tool.env.url_create('reply_pubkey_mismatch.htm', url_params);
              }
            },
          }, tab_id);

        });
      });

      function recover_missing_url_params(callback) {
        if(url_params.is_reply_box) {
          if(url_params.thread_id && url_params.thread_id !== url_params.thread_message_id && url_params.to && url_params.from && url_params.subject) {
            callback();
          } else {
            $('#new_message').prepend(tool.e('div', {id: 'loader', html: 'Loading secure reply box..' + tool.ui.spinner('green')}));
            tool.api.gmail.message_get(url_params.account_email, url_params.thread_message_id, 'metadata', function (success, gmail_message_object) {
              if (success) {
                url_params.thread_id = gmail_message_object.threadId;
                let reply = tool.api.common.reply_correspondents(url_params.account_email, storage.addresses, tool.api.gmail.find_header(gmail_message_object, 'from'), (tool.api.gmail.find_header(gmail_message_object, 'to') || '').split(','));
                if(!url_params.to) {
                  url_params.to = reply.to;
                }
                if(!url_params.from) {
                  url_params.from = reply.from;
                }
                if(!url_params.subject) {
                  url_params.subject = tool.api.gmail.find_header(gmail_message_object, 'subject');
                }
              } else {
                if(!url_params.from) {
                  url_params.from = url_params.account_email;
                }
                if(!url_params.subject) {
                  url_params.subject = '';
                }
                url_params.thread_id = url_params.thread_id || url_params.thread_message_id;
                console.log('CRYPTUP: Substituting thread_id: could cause issues. Value:' + String(url_params.thread_id));
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
      if(url_params.is_reply_box) {
        tool.browser.message.send(url_params.parent_tab_id, 'close_reply_message', {frame_id: url_params.frame_id, thread_id: url_params.thread_id});
      } else if(url_params.placement === 'settings') {
          tool.browser.message.send(url_params.parent_tab_id, 'close_page');
      } else {
        tool.browser.message.send(url_params.parent_tab_id, 'close_new_message');
      }
    }

  });
});
