/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

/// <reference path="common.d.ts" />
/// <reference path="../../../node_modules/@types/jquery/index.d.ts" />

'use strict';

declare var require: any;

(function() {

  class Subscription implements SubscriptionInfo { // todo - look into this later, is a class necessary? If so, it should be elsewhere
    active = null;
    method = null;
    level = null;
  }

  let storage = (window as FlowCryptWindow).flowcrypt_storage;
  let flowcrypt_attach = (window as FlowCryptWindow).flowcrypt_attach;

  const S = tool.ui.build_jquery_selectors({
    body: 'body',
    compose_table: 'table#compose',
    header: '#section_header',
    subject: '#section_subject',
    title: 'table#compose th h1',
    input_text: 'div#input_text',
    input_to: '#input_to',
    input_from: '#input_from',
    input_subject: '#input_subject',
    input_password: '#input_password',
    input_intro: '.input_intro',
    all_cells_except_text: 'table#compose > tbody > tr > :not(.text)',
    add_intro: '.action_add_intro',
    add_their_pubkey: '.add_pubkey',
    intro_container: '.intro_container',
    password_or_pubkey: '#password_or_pubkey_container',
    password_label: '.label_password',
    send_btn_note: '#send_btn_note',
    send_btn_span: '#send_btn span',
    send_btn_i: '#send_btn i',
    send_btn: '#send_btn',
    icon_pubkey: '.icon.action_include_pubkey',
    icon_footer: '.icon.action_include_footer',
    icon_help: '.action_feedback',
    icon_sign: '.icon.action_sign',
    reply_message_prompt: 'div#reply_message_prompt',
    reply_message_successful: '#reply_message_successful_container',
    replied_body: '.replied_body',
    replied_attachments: '#attachments',
    contacts: '#contacts',
  }) as SelectorCacher;

  const _self = {
    init: init,
    resize_reply_box: resize_reply_box,
    update_footer_icon: update_footer_icon,
    show_subscribe_dialog_and_wait_for_response: show_subscribe_dialog_and_wait_for_response,
    process_subscribe_result: process_subscribe_result,
    passphrase_entry: passphrase_entry,
    S: S,
  };

  if(typeof exports !== 'object') {
    (window as any).flowcrypt_compose = _self as any;
  } else {
    exports.compose = _self;
  }

  const SAVE_DRAFT_FREQUENCY = 3000;
  const PUBKEY_LOOKUP_RESULT_WRONG = 'wrong';
  const PUBKEY_LOOKUP_RESULT_FAIL = 'fail';
  const BTN_ENCRYPT_AND_SEND = 'encrypt and send';
  const BTN_SIGN_AND_SEND = 'sign and send';
  const BTN_WRONG_ENTRY = 're-enter recipient..';
  const BTN_LOADING = 'loading..';
  const CRYPTUP_WEB_URL = 'https://flowcrypt.com';

  let attach = flowcrypt_attach.init(get_max_attachment_size_and_oversize_notice);

  let last_draft = '';
  let can_read_emails: boolean;
  let last_reply_box_table_height = 0;
  let contact_search_in_progress = false;
  let added_pubkey_db_lookup_interval: number;
  let save_draft_interval = setInterval(draft_save, SAVE_DRAFT_FREQUENCY);
  let save_draft_in_process = false;
  let passphrase_interval: number;
  let include_pubkey_toggled_manually = false;
  let my_addresses_on_pks: string[] = [];
  let my_addresses_on_keyserver: string[] = [];
  let recipients_missing_my_key: string[] = [];
  let keyserver_lookup_results_by_email: {[key: string]: PubkeySearchResult} = {};
  let subscribe_result_listener: ((subscription_active: boolean) => void)|undefined;
  let additional_message_headers: {[key: string]: string} = {};
  let button_update_timeout: number;
  let is_reply_box: boolean, tab_id: string, account_email: string, thread_id: string, draft_id:string, supplied_subject:string, supplied_from:string, supplied_to:string, frame_id:string;
  let reference_body_height: number;

  let app = { // this is a list of empty defaults that will get overwritten wherever composer is used
    can_read_email: () => true,
    does_recipient_have_my_pubkey: (email: string, cb: (has_pubkey: boolean) => void) => { if(cb) { cb(false); }},
    storage_get_addresses: (): string[] => [account_email],
    storage_get_addresses_pks: (): string[] => [],
    storage_get_addresses_keyserver: (): string[] => [],
    storage_get_email_footer: (): string|null => null,
    storage_set_email_footer: (footer: string): void => undefined,
    storage_get_hide_message_password: ():boolean => false,
    storage_get_subscription_info: (cb?: (s: Subscription) => void) : Subscription|undefined => { if(typeof cb === 'function') { cb(new Subscription()); } return new Subscription(); }, // returns cached result, callbacks with fresh result
    storage_get_armored_public_key: (sender_email: string) => tool.catch.Promise((resolve, reject) => {resolve(null)}),
    storage_set_draft_meta: (store_if_true: boolean, draft_id: string, thread_id: string, recipients: string[], subject: string) => tool.catch.Promise((resolve, reject) => {resolve()}),
    storage_passphrase_get: (): Promise<string|null> => tool.catch.Promise((resolve, reject) => { resolve(null); }) as Promise<null>,
    storage_add_admin_codes: (short_id: string, message_admin_code: string, attachment_admin_codes: string[], callback: () => void) => { callback(); },
    storage_contact_get: async (email: string): Promise<Contact|Contact[]|null> => null,
    storage_contact_update: async (email: string, update: object): Promise<undefined> => undefined,
    storage_contact_save: async (contact: Contact): Promise<undefined> => undefined,
    storage_contact_search: async (query: ProviderContactsQuery): Promise<Contact[]> => [],
    storage_contact_object: (email: string, name: string, has_cryptup: boolean, pubkey: string, attested: boolean, pending_lookup: boolean, last_use: number): Contact => { return {} as Contact},
    email_provider_draft_get: (draft_id: string) => tool.catch.Promise((resolve, reject) => {reject()}),
    email_provider_draft_create: (mime_message: string) => tool.catch.Promise((resolve, reject) => {reject()}),
    email_provider_draft_update: (draft_id: string, mime_message: string) => tool.catch.Promise((resolve, reject) => {reject()}),
    email_provider_draft_delete: (draft_id: string) => tool.catch.Promise((resolve, reject) => {reject()}),
    email_provider_message_send: (message: SendableMessage, render_upload_progress: (progress: number) => void) => tool.catch.Promise((resolve, reject) => {reject()}),
    email_provider_search_contacts: (query: string, known_contacts: Contact[], multi_cb: (r: {new: Contact[], all: Contact[]}) => void): void => undefined,
    email_provider_determine_reply_message_header_variables: (cb: (last_msg_id: string, headers: Headers) => void) => { if(cb) cb('', {} as Headers); },
    email_provider_extract_armored_block: (message_id: string, success_cb: (armored_msg: string) => void, error_cb: (err?: any) => void) => { if(error_cb) error_cb('not implemented'); },
    send_message_to_main_window: (channel: string, data?: Object): void => undefined,
    send_message_to_background_script: (channel: string, data?: Object): void => undefined,
    render_footer_dialog: (): void => undefined,
    render_add_pubkey_dialog: (emails: string[]): void => undefined,
    render_reinsert_reply_box: (last_message_id: string, recipients: string[]): void => undefined,
    render_help_dialog: ():void => undefined,
    render_sending_address_dialog: ():void => undefined,
    factory_attachment: (attachment: Attachment):string => `<div>${attachment.name}</div>`,
    close_message: ():void => undefined,
  } as NamedFunctionsObject;

  function init(app_functions: NamedFunctionsObject, variables: UrlParams) {
    account_email = variables.account_email as string;
    draft_id = variables.draft_id as string;
    thread_id = variables.thread_id as string;
    supplied_subject = variables.subject as string;
    supplied_from = variables.from as string;
    supplied_to = variables.to as string;
    frame_id = variables.frame_id as string;
    tab_id = variables.tab_id as string;
    is_reply_box = variables.is_reply_box as boolean;
    for(let name in app_functions) {
      app[name] = app_functions[name];
    }
    my_addresses_on_pks = app.storage_get_addresses_pks() || [];
    my_addresses_on_keyserver = app.storage_get_addresses_keyserver() || [];
    can_read_emails = app.can_read_email();
    let subscription = app.storage_get_subscription_info();
    if (subscription.active) {
      update_footer_icon();
    } else if (app.storage_get_email_footer()) { // footer set but subscription not active - subscription expired
      app.storage_set_email_footer(null);
      app.send_message_to_main_window('notification_show', {
        notification: 'Your FlowCrypt ' + (subscription.method === 'trial' ? 'trial' : 'subscription') + ' has ended. Custom email signature (email footer) will no longer be used. <a href="#" class="subscribe">renew</a> <a href="#" class="close">close</a>',
      });
    }
    if (app.storage_get_hide_message_password()) {
      S.cached('input_password').attr('type', 'password');
    }
    initialize_compose_box(variables);
  }

  function initialize_compose_box(variables: UrlParams) {
    if(draft_id) {
      initial_draft_load();
    } else {
      if(is_reply_box) {
        if(variables.skip_click_prompt) {
          render_reply_message_compose_table();
        } else {
          $('#reply_click_area,#a_reply,#a_reply_all,#a_forward').click(function () {
            if ($(this).attr('id') === 'a_reply') {
              supplied_to = supplied_to.split(',')[0];
            } else if ($(this).attr('id') === 'a_forward') {
              supplied_to = '';
            }
            render_reply_message_compose_table((($(this).attr('id') || '').replace('a_', '') || 'reply') as 'reply'|'forward');
          });
        }
      }
    }
    if(is_reply_box) {
      if(!variables.skip_click_prompt) {
        S.cached('reply_message_prompt').css('display', 'block');
      }
      S.cached('header').remove();
      S.cached('subject').remove();
      S.cached('contacts').css('top', '39px');
      S.cached('compose_table').css({'border-bottom': '1px solid #cfcfcf', 'border-top': '1px solid #cfcfcf'});
      S.cached('input_text').css('overflow-y', 'hidden');
      $(document).ready(() => resize_reply_box());
    } else {
      S.cached('body').css('overflow', 'hidden'); // do not enable this for replies or automatic resize won't work
      S.cached('compose_table').css('display', 'table');
      render_compose_table();
    }
    $('body').attr('data-test-state', 'ready');  //set as ready so that automated tests can evaluate results
  }

  function initial_draft_load() {
    if(is_reply_box) {
      S.cached('reply_message_prompt').html('Loading draft.. ' + tool.ui.spinner('green'));
    }
    app.email_provider_draft_get(draft_id).then((response: any) => {
      tool.mime.decode(tool.str.base64url_decode((response as any).message.raw), function (mime_success, parsed_message) {
        let armored = tool.crypto.armor.clip(parsed_message.text || tool.crypto.armor.strip(parsed_message.html || '') || '');
        if(armored) {
          S.cached('input_subject').val(parsed_message.headers.subject || '');
          decrypt_and_render_draft(armored, is_reply_box ? render_reply_message_compose_table : null, tool.mime.headers_to_from(parsed_message));
        } else {
          console.log('tool.api.gmail.draft_get tool.mime.decode else {}');
          if(is_reply_box) {
            render_reply_message_compose_table();
          }
        }
      });
    }, (error: any) => {
      if (is_reply_box && error.status === 404) {
        tool.catch.log('about to reload reply_message automatically: get draft 404', account_email);
        setTimeout(function () {
          app.storage_set_draft_meta(false, draft_id, thread_id, null, null).then(() => {
            console.log('Above red message means that there used to be a draft, but was since deleted. (not an error)');
            window.location.reload();
          });
        }, 500);
      } else {
        console.log('tool.api.gmail.draft_get success===false');
        console.log(error);
        if(is_reply_box) {
          render_reply_message_compose_table();
        }
      }
    });
  }

  function process_subscribe_result(new_subscription: Subscription) {
    if (typeof subscribe_result_listener === 'function') {
      subscribe_result_listener(new_subscription.active || false);
      subscribe_result_listener = undefined;
    }
  }

  function show_subscribe_dialog_and_wait_for_response(_data: any, _sender: string|null, respond: (subscribed: boolean) => void) {
    subscribe_result_listener = respond;
    app.send_message_to_main_window('subscribe_dialog', {subscribe_result_tab_id: tab_id});
  }

  S.cached('icon_pubkey').attr('title', Lang.compose.include_pubkey_icon_title);

  function get_max_attachment_size_and_oversize_notice() {
    let subscription = app.storage_get_subscription_info();
    if (!subscription.active) {
      return {
        size_mb: 5,
        size: 5 * 1024 * 1024,
        count: 10,
        oversize: function () {
          let get_advanced = 'The files are over 5 MB. Advanced users can send files up to 25 MB.';
          if (!subscription.method) {
            get_advanced += '\n\nTry it free for 30 days.';
          } else if (subscription.method === 'trial') {
            get_advanced += '\n\nYour trial has expired, please consider supporting our efforts by upgrading.';
          } else if (subscription.method === 'group') {
            get_advanced += '\n\nGroup billing is due for renewal. Please check with your leadership.';
          } else if (subscription.method === 'stripe') {
            get_advanced += '\n\nPlease renew your subscription to continue sending large files.';
          } else {
            get_advanced += '\n\nClick ok to see subscribe options.'
          }
          if(subscription.method === 'group') {
            alert(get_advanced);
          } else {
            if (confirm(get_advanced)) {
              show_subscribe_dialog_and_wait_for_response(null, null, function (new_subscription_active) {
                if (new_subscription_active) {
                  alert('You\'re all set, now you can add your file again.');
                }
              });
            }
          }
        },
      };
    } else {
      let allow_huge_attachments = ['94658c9c332a11f20b1e45c092e6e98a1e34c953', 'b092dcecf277c9b3502e20c93b9386ec7759443a', '9fbbe6720a6e6c8fc30243dc8ff0a06cbfa4630e'];
      let size_mb = (subscription.method !== 'trial' && tool.value(tool.crypto.hash.sha1(account_email)).in(allow_huge_attachments)) ? 200 : 25;
      return {
        size_mb: size_mb,
        size: size_mb * 1024 * 1024,
        count: 10,
        oversize: function (combined_size: number) {
          alert('Combined attachment size is limited to 25 MB. The last file brings it to ' + Math.ceil(combined_size / (1024 * 1024)) + ' MB.');
        },
      };
    }
  }

  function reset_send_btn(delay:number|null=null) {
    const do_reset = function () {
      S.cached('send_btn').html('<i class=""></i><span tabindex="4">' + (S.cached('icon_sign').is('.active') ? BTN_SIGN_AND_SEND : BTN_ENCRYPT_AND_SEND) + '</span>');
    };
    clearTimeout(button_update_timeout);
    if (!delay) {
      do_reset();
    } else {
      setTimeout(do_reset, delay);
    }
  }

  function passphrase_entry(entered: boolean) {
    if(!entered) {
      reset_send_btn();
      clearInterval(passphrase_interval);
    }
  }

  function draft_save(force_save: boolean) {
    if (should_save_draft(S.cached('input_text').text()) || force_save === true) {
      save_draft_in_process = true;
      S.cached('send_btn_note').text('Saving');
      app.storage_get_armored_public_key(account_email).then((armored_pubkey: string) => {
        if(armored_pubkey) {
          tool.crypto.message.encrypt([armored_pubkey], null, null, S.cached('input_text')[0].innerText, null, true, function (encrypted: OpenpgpEncryptResult) {
            let body;
            if (thread_id) { // replied message
              body = '[cryptup:link:draft_reply:' + thread_id + ']\n\n' + encrypted.data;
            } else if (draft_id) {
              body = '[cryptup:link:draft_compose:' + draft_id + ']\n\n' + encrypted.data;
            } else {
              body = encrypted.data;
            }
            let subject = String(S.cached('input_subject').val()) || supplied_subject || 'FlowCrypt draft';
            tool.mime.encode(body as string, {To: get_recipients_from_dom(), From: supplied_from || get_sender_from_dom(), Subject: subject} as RichHeaders, [], (mime_message) => {
              if (!draft_id) {
                app.email_provider_draft_create(mime_message).then((response: any) => {
                  S.cached('send_btn_note').text('Saved');
                  draft_id = response.id;
                  app.storage_set_draft_meta(true, response.id, thread_id, get_recipients_from_dom(), S.cached('input_subject').val());
                  // recursing one more time, because we need the draft_id we get from this reply in the message itself
                  // essentially everytime we save draft for the first time, we have to save it twice
                  // save_draft_in_process will remain true because well.. it's still in process
                  draft_save(true); // force_save = true
                }, (error: any) => {
                  S.cached('send_btn_note').text('Not saved');
                  save_draft_in_process = false; // it will only be set to false (done) if it's a failure (only in terms of the very first save)
                });
              } else {
                app.email_provider_draft_update(draft_id, mime_message).then((response: any) => {
                  S.cached('send_btn_note').text('Saved');
                  save_draft_in_process = false;
                }, (error: any) => {
                  S.cached('send_btn_note').text('Not saved');
                  save_draft_in_process = false;
                });
              }
            });
          });
        }
      });
    }
  }

  function draft_delete(callback: () => void) {
    clearInterval(save_draft_interval);
    tool.time.wait(() => {if (!save_draft_in_process) { return true; }}).then(() => {
      if (draft_id) {
        // @ts-ignore: .done()
        app.storage_set_draft_meta(false, draft_id, thread_id, null, null).done(() => {
          // @ts-ignore: .done()
          app.email_provider_draft_delete(draft_id).done((success, result) => {
            callback();
          });
        });
      } else if (callback) {
        callback();
      }
    });
  }

  function decrypt_and_render_draft(encrypted_draft: string, render_function: (() => void)|null, headers: FromToHeaders) {
    app.storage_passphrase_get().then((passphrase: string) => {
      if (passphrase !== null) {
        tool.crypto.message.decrypt(account_email, encrypted_draft, null, (result) => {
          if(result.success) {
            tool.str.as_safe_html((result.content.data as string).replace(/\n/g, '<br>\n'), function (safe_html_draft: string) {
              S.cached('input_text').html(safe_html_draft);
              if (headers && headers.to && headers.to.length) {
                S.cached('input_to').focus();
                S.cached('input_to').val(headers.to.join(','));
                S.cached('input_text').focus();
              }
              if (headers && headers.from) {
                S.now('input_from').val(headers.from);
              }
              set_input_text_height_manually_if_needed();
              if (render_function) {
                render_function();
              }
            });
          } else {
            set_input_text_height_manually_if_needed()
            if (render_function) {
              render_function();
            }
          }
        }, 'utf8');
      } else {
        if (is_reply_box) {
          S.cached('reply_message_prompt').html(tool.ui.spinner('green') + ' Waiting for pass phrase to open previous draft..');
          when_master_passphrase_entered(function () {
            decrypt_and_render_draft(encrypted_draft, render_function, headers);
          });
        }
      }
    });
  }

  function when_master_passphrase_entered(callback: (pp: string|null) => void, seconds_timeout:number|null=null) {
    clearInterval(passphrase_interval);
    const timeout_at = seconds_timeout ? Date.now() + seconds_timeout * 1000 : null;
    passphrase_interval = window.setInterval(function () {
      app.storage_passphrase_get().then((passphrase: string) => {
        if (passphrase !== null) {
          clearInterval(passphrase_interval);
          callback(passphrase);
        } else if (timeout_at && Date.now() > timeout_at) {
          clearInterval(passphrase_interval);
          callback(null);
        }
      });
    }, 1000);
  }

  async function collect_all_available_public_keys(account_email: string, recipients: string[]) {
    let contacts = await app.storage_contact_get(recipients) as Contact[];
    let armored_public_key = await app.storage_get_armored_public_key(account_email);
    const armored_pubkeys = [armored_public_key];
    const emails_without_pubkeys = [];
    for(let i in contacts) {
      let contact = contacts[i];
      if (contact && contact.has_pgp) {
        armored_pubkeys.push(contact.pubkey);
      } else if (contact && keyserver_lookup_results_by_email[contact.email] && keyserver_lookup_results_by_email[contact.email].has_pgp) {
        armored_pubkeys.push(keyserver_lookup_results_by_email[contact.email].pubkey);
      } else {
        emails_without_pubkeys.push(recipients[i]);
      }
    }
    return {armored_pubkeys, emails_without_pubkeys};
  }

  function is_compose_form_rendered_as_ready(recipients: string[]) {
    if(tool.value(S.now('send_btn_span').text().toLowerCase().trim()).in([BTN_ENCRYPT_AND_SEND, BTN_SIGN_AND_SEND]) && recipients && recipients.length) {
      return true;
    } else {
      if(S.now('send_btn_span').text().toLowerCase().trim() === BTN_WRONG_ENTRY) {
        alert('Please re-enter recipients marked in red color.');
      } else if(!recipients || !recipients.length) {
        alert('Please add a recipient first');
      } else {
        alert('Still working, please wait.');
      }
      return false;
    }
  }

  function are_compose_form_values_valid(recipients: string[], emails_without_pubkeys: string[], subject: string, plaintext: string, challenge: Challenge|null): boolean {
    const is_encrypt = !S.cached('icon_sign').is('.active');
    if(!recipients.length) {
      alert('Please add receiving email address.');
      return false;
    } else if(is_encrypt && emails_without_pubkeys.length && (!challenge || !challenge.answer)) {
      alert('Some recipients don\'t have encryption set up. Please add a password.');
      S.cached('input_password').focus();
      return false;
    } else if((plaintext !== '' || window.confirm('Send empty message?')) && (subject !== '' || window.confirm('Send without a subject?'))) {
      return true; //todo - tailor for replying w/o subject
    } else {
      return false;
    }
  }

  function handle_send_btn_processing_error(callback: () => void): void {
    try {
      callback();
    } catch(err) {
      tool.catch.handle_exception(err);
      reset_send_btn();
      alert(String(err));
    }
  }

  async function extract_process_encrypt_and_send_message() {
    const recipients = get_recipients_from_dom();
    const subject = supplied_subject || String($('#input_subject').val()); // replies have subject in url params
    const plaintext = $('#input_text').get(0).innerText;
    if(is_compose_form_rendered_as_ready(recipients)) {
      S.now('send_btn_span').text('Loading');
      S.now('send_btn_i').replaceWith(tool.ui.spinner('white'));
      S.cached('send_btn_note').text('');
      app.storage_get_subscription_info(async function (subscription: Subscription) {
      let {armored_pubkeys, emails_without_pubkeys} = await collect_all_available_public_keys(account_email, recipients);
        const challenge = emails_without_pubkeys.length ? {answer: String(S.cached('input_password').val())} : null;
        if(are_compose_form_values_valid(recipients, emails_without_pubkeys, subject, plaintext, challenge)) {
          if(S.cached('icon_sign').is('.active')) {
            sign_and_send(recipients, armored_pubkeys, subject, plaintext, challenge, subscription);
          } else {
            encrypt_and_send(recipients, armored_pubkeys, subject, plaintext, challenge, subscription);
          }
        } else {
          reset_send_btn();
        }
      });
    }
  }

  function encrypt_and_send(recipients: string[], armored_pubkeys: string[], subject: string, plaintext: string, challenge: Challenge|null, subscription: Subscription) {
    S.now('send_btn_span').text('Encrypting');
    add_reply_token_to_message_body_if_needed(recipients, subject, plaintext, challenge, subscription, function (plaintext) {
      handle_send_btn_processing_error(function () {
        attach.collect_and_encrypt_attachments(armored_pubkeys, challenge, function (attachments: Attachment[]) {
          if (attachments.length && challenge) { // these will be password encrypted attachments
            button_update_timeout = window.setTimeout(function () {
              S.now('send_btn_span').text('sending');
            }, 500);
            upload_attachments_to_cryptup(attachments, subscription, function (all_good, upload_results, attachment_admin_codes, upload_error_message) {
              if (all_good === true && upload_results && attachment_admin_codes) {
                plaintext = add_uploaded_file_links_to_message_body(plaintext, upload_results);
                do_encrypt_message_body_and_format(armored_pubkeys, challenge, plaintext, [], recipients, subject, subscription, attachment_admin_codes);
              } else if (all_good === tool.api.cryptup.auth_error) {
                if (confirm('Your FlowCrypt account information is outdated, please review your account settings.')) {
                  app.send_message_to_main_window('subscribe_dialog', {source: 'auth_error'});
                }
                reset_send_btn(100);
              } else {
                alert('There was an error uploading attachments. Please try it again. Write me at human@flowcrypt.com if it happens repeatedly.\n\n' + upload_error_message);
                reset_send_btn(100);
              }
            });
          } else {
            do_encrypt_message_body_and_format(armored_pubkeys, challenge, plaintext, attachments, recipients, subject, subscription);
          }
        });
      });
    });
  }

  function sign_and_send(recipients: string[], armored_pubkeys: string[], subject: string, plaintext: string, challenge: Challenge|null, subscription: Subscription) {
    S.now('send_btn_span').text('Signing');
    storage.keys_get(account_email, 'primary').then((primary_k: KeyInfo) => {
      if (primary_k) {
        const prv = openpgp.key.readArmored(primary_k.private).keys[0];
        app.storage_passphrase_get().then((passphrase: string|null) => {
          if (passphrase === null) {
            app.send_message_to_main_window('passphrase_dialog', {type: 'sign', longids: 'primary'});
            when_master_passphrase_entered(function (passphrase) {
              if (passphrase) {
                sign_and_send(recipients, armored_pubkeys, subject, plaintext, challenge, subscription);
              } else { // timeout - reset
                clearInterval(passphrase_interval);
                reset_send_btn();
              }
            }, 60);
          } else {
            tool.env.set_up_require();
            //@ts-ignore
            require(['emailjs-mime-codec'], function (MimeCodec) {

              // Folding the lines or GMAIL WILL RAPE THE TEXT, regardless of what encoding is used
              // https://mathiasbynens.be/notes/gmail-plain-text applies to API as well
              // resulting in.. wait for it.. signatures that don't match
              // if you are reading this and have ideas about better solutions which:
              //  - don't involve text/html ( Enigmail refuses to fix: https://sourceforge.net/p/enigmail/bugs/218/ - Patrick Brunschwig - 2017-02-12 )
              //  - don't require text to be sent as an attachment
              //  - don't require all other clients to support PGP/MIME
              // then please let me know. Eagerly waiting! In the meanwhile..
              plaintext = MimeCodec.foldLines(plaintext, 76, true);

              // Gmail will also remove trailing spaces on the end of each line in transit, causing signatures that don't match
              // Removing them here will prevent Gmail from screwing up the signature
              plaintext = plaintext.split('\n').map(l => l.replace(/\s+$/g, '')).join('\n').trim();

              tool.crypto.key.decrypt(prv, passphrase);
              tool.crypto.message.sign(prv, format_email_text_footer({'text/plain': plaintext})['text/plain'] || '', true, function (success, signing_result) {
                if (success) {
                  handle_send_btn_processing_error(function () {
                    attach.collect_attachments(async function (attachments: Attachment[]) { // todo - not signing attachments
                      await app.storage_contact_update(recipients, {last_use: Date.now()});
                      S.now('send_btn_span').text('Sending');
                      with_attached_pubkey_if_needed(signing_result).then(signing_result => {
                        const body = {'text/plain': signing_result};
                        do_send_message(tool.api.common.message(account_email, supplied_from || get_sender_from_dom(), recipients, subject, body, attachments, thread_id), plaintext);
                      });
                    });
                  });
                } else {
                  tool.catch.report('error signing message. Error:' + signing_result);
                  alert('There was an error signing this message. Please write me at human@flowcrypt.com, I resolve similar issues very quickly.\n\n' + signing_result);
                  reset_send_btn();
                }
              });
            });
          }
        });
      } else {
        alert('Cannot sign the message because your plugin is not correctly set up. Write me at human@flowcrypt.com if this persists.');
        reset_send_btn();
      }
    });
  }

  function upload_attachments_to_cryptup(attachments: Attachment[], subscription: Subscription, callback: (ok: boolean|null|object, uploads?: Attachment[]|null, ac?: string[]|null, err?: string) => void): void {
    // @ts-ignore: .validate()
    tool.api.cryptup.message_presign_files(attachments, subscription.active ? 'uuid' : null).validate((r: {approvals:Dict<any>[]}) => r.approvals && r.approvals.length === attachments.length).then(pf_response => {
      const items: any[] = [];
      for(let i in pf_response.approvals) {
        items.push({base_url: pf_response.approvals[i].base_url, fields: pf_response.approvals[i].fields, attachment: attachments[i as any as number]});
      }
      // @ts-ignore - call sig mismatch
      tool.api.aws.s3_upload(items, render_upload_progress).then(s3_results_successful => {
        tool.api.cryptup.message_confirm_files(items.map(function (item) {
          return item.fields.key;
          // @ts-ignore: .validate()
        })).validate(r => r.confirmed && r.confirmed.length === items.length).then((cf_response: {admin_codes: string[]}) => {
          for(let i in attachments) {
            attachments[i].url = pf_response.approvals[i].base_url + pf_response.approvals[i].fields.key;
          }
          callback(true, attachments, cf_response.admin_codes);
        }, (error: any) => {
          if (error.internal === 'validate') {
            callback(false, null, null, 'Could not verify that all files were uploaded properly, please try again.');
          } else {
            callback(false, null, null, error.message);
          }
        });
      }, (s3_results_has_failure: any) => { // todo
        callback(false, null, null, 'Some files failed to upload, please try again')
      });
    }, (error: any) => {
      if (error.internal === 'auth') {
        callback(error);
      } else {
        callback(false, null, null, error.message);
      }
    });
  }

  function render_upload_progress(progress: number) {
    if (attach.has_attachment()) {
      progress = Math.floor(progress);
      S.now('send_btn_span').text(progress < 100 ? 'sending.. ' + progress + '%' : 'sending');
    }
  }

  function add_uploaded_file_links_to_message_body(plaintext: string, attachments: Attachment[]) {
    plaintext += '\n\n';
    for(let i in attachments) {
      const size_mb = attachments[i].size / (1024 * 1024);
      const size_text = size_mb < 0.1 ? '' : ' ' + (Math.round(size_mb * 10) / 10) + 'MB';
      const link_text = 'Attachment: ' + attachments[i].name + ' (' + attachments[i].type + ')' + size_text;
      const cryptup_data = tool.str.html_attribute_encode({size: attachments[i].size, type: attachments[i].type, name: attachments[i].name});
      plaintext += '<a href="' + attachments[i].url + '" class="cryptup_file" cryptup-data="' + cryptup_data + '">' + link_text + '</a>\n';
    }
    return plaintext;
  }

  function add_reply_token_to_message_body_if_needed(recipients: string[], subject: string, plaintext: string, challenge: Challenge|null, subscription: Subscription, callback: (res: string) => void): void {
    if (challenge && subscription.active) {
      // @ts-ignore: .validate()
      tool.api.cryptup.message_token().validate(r => r.token).then((response: {token: string}) => {
        callback(plaintext + '\n\n' + tool.e('div', {
            'style': 'display: none;', 'class': 'cryptup_reply', 'cryptup-data': tool.str.html_attribute_encode({
              sender: supplied_from || get_sender_from_dom(),
              recipient: tool.arr.without_value(tool.arr.without_value(recipients, supplied_from || get_sender_from_dom()), account_email),
              subject: subject,
              token: response.token,
            })
          }));
      }, (error: any) => {
        if (error.internal === 'auth') {
          if (confirm('Your FlowCrypt account information is outdated, please review your account settings.')) {
            app.send_message_to_main_window('subscribe_dialog', {source: 'auth_error'});
          }
          reset_send_btn();
        } else if (error.internal === 'subscription') {
          callback(plaintext); // just skip and leave as is
        } else {
          alert('There was an error sending this message. Please try again. Let me know at human@flowcrypt.com if this happens repeatedly.\n\nmessage/token: ' + error.message);
          reset_send_btn();
        }
      });
    } else {
      callback(plaintext);
    }
  }

  function upload_encrypted_message_to_cryptup(encrypted_data: Uint8Array|string, subscription: Subscription, callback: (short: string|null, admin_code: string|null, error?: string|StandardError) => void): void {
    S.now('send_btn_span').text('Sending');
    // this is used when sending encrypted messages to people without encryption plugin
    // used to send it as a parameter in URL, but the URLs are way too long and not all clients can deal with it
    // the encrypted data goes through FlowCrypt and recipients get a link.
    // admin_code stays locally and helps the sender extend life of the message or delete it
    // @ts-ignore: .validate()
    tool.api.cryptup.message_upload(encrypted_data, subscription.active ? 'uuid' : null).validate(r => r.short && r.admin_code).then(response => {
      callback(response.short, response.admin_code);
    }, (error: StandardError) => {
      if (error.internal === 'auth') {
        callback(null, null, tool.api.cryptup.auth_error);
      } else {
        callback(null, null, error.internal || error.message);
      }
    });
  }

  function with_attached_pubkey_if_needed(encrypted: string) {
    return tool.catch.Promise((resolve, reject) => {
      app.storage_get_armored_public_key(account_email).then((armored_public_key: string) => {
        if (S.cached('icon_pubkey').is('.active')) {
          encrypted += '\n\n' + armored_public_key;
        }
        resolve(encrypted);
      });
    });
  }

  function do_encrypt_message_body_and_format(armored_pubkeys: string[], challenge: Challenge|null, plaintext: string, attachments: Attachment[], recipients: string[], subject: string, subscription: Subscription, attachment_admin_codes:string[]=[]) {
    tool.crypto.message.encrypt(armored_pubkeys, null, challenge, plaintext, null, true, function (encrypted) {
      with_attached_pubkey_if_needed(encrypted.data as string).then(async(encrypted_data: string) => {
        encrypted.data = encrypted_data;
        let body = {'text/plain': encrypted.data} as SendableMessageBody;
        button_update_timeout = window.setTimeout(() => { S.now('send_btn_span').text('sending') }, 500);
        await app.storage_contact_update(recipients, {last_use: Date.now()});
        if (challenge) {
          upload_encrypted_message_to_cryptup(encrypted.data, subscription, function (short_id, message_admin_code, error) {
            if (short_id) {
              body = format_password_protected_email(short_id, body, armored_pubkeys);
              body = format_email_text_footer(body);
              app.storage_add_admin_codes(short_id, message_admin_code, attachment_admin_codes, () => {
                do_send_message(tool.api.common.message(account_email, supplied_from || get_sender_from_dom(), recipients, subject, body, attachments, thread_id), plaintext);
              });
            } else {
              if (error === tool.api.cryptup.auth_error) {
                if (confirm('Your FlowCrypt account information is outdated, please review your account settings.')) {
                  app.send_message_to_main_window('subscribe_dialog', {source: 'auth_error'});
                }
              } else {
                alert('Could not send message, probably due to internet connection. Please click the SEND button again to retry.\n\n(Error:' + error + ')');
              }
              reset_send_btn();
            }
          });
        } else {
          body = format_email_text_footer(body);
          do_send_message(tool.api.common.message(account_email, supplied_from || get_sender_from_dom(), recipients, subject, body, attachments, thread_id), plaintext);
        }
      });
    });
  }

  function do_send_message(message: SendableMessage, plaintext: string) {
    for(let k in additional_message_headers) {
      message.headers[k] = additional_message_headers[k];
    }
    for(let a of message.attachments) {
      a.type = 'application/octet-stream'; // so that Enigmail+Thunderbird does not attempt to display without decrypting
    }
    app.email_provider_message_send(message, render_upload_progress).then((response: any) => {
      const is_signed = S.cached('icon_sign').is('.active');
      app.send_message_to_main_window('notification_show', {notification: 'Your ' + (is_signed ? 'signed' : 'encrypted') + ' ' + (is_reply_box ? 'reply' : 'message') + ' has been sent.'});
      draft_delete(() => {
        if(is_reply_box) {
          render_reply_success(message, plaintext, response ? response.id : null);
        } else {
          app.close_message();
        }
      });
    }, (error: StandardError) => {
      reset_send_btn();
      if(error && error.message && error.internal) {
        alert(error.message);
      } else {
        tool.catch.report('email_provider message_send error response', error);
        alert('Error sending message, try to re-open your web mail window and send again. Write me at human@flowcrypt.com if this happens repeatedly.');
      }
    });
  }

  async function lookup_pubkey_from_db_or_keyserver_and_update_db_if_needed(email: string): Promise<Contact|"fail"> {
    let db_contact = await app.storage_contact_get(email) as Contact;
    if (db_contact && db_contact.has_pgp && db_contact.pubkey) {
      return db_contact;
    } else {
      try {
        let response = await tool.api.attester.lookup_email(email);
        if (response && (response as any).email) {
          if ((response as any).pubkey) {
            const parsed = openpgp.key.readArmored((response as any).pubkey);
            if (!parsed.keys[0]) {
              tool.catch.log('Dropping found but incompatible public key', {
                for: (response as any).email,
                err: parsed.err ? ' * ' + parsed.err.join('\n * ') : null
              });
              (response as any).pubkey = null;
            } else if (parsed.keys[0].getEncryptionKeyPacket() === null) {
              tool.catch.log('Dropping found+parsed key because getEncryptionKeyPacket===null', {
                for: (response as any).email,
                fingerprint: tool.crypto.key.fingerprint(parsed.keys[0])
              });
              (response as any).pubkey = null;
            }
          }
          let ks_contact = app.storage_contact_object((response as any).email, db_contact && db_contact.name ? db_contact.name : null, (response as any).has_cryptup ? 'cryptup' : 'pgp', (response as any).pubkey, (response as any).attested, false, Date.now());
          keyserver_lookup_results_by_email[(response as any).email] = ks_contact;
          await app.storage_contact_save(ks_contact);
          return ks_contact;
        } else  {
          return PUBKEY_LOOKUP_RESULT_FAIL;
        }
      } catch (e) {
        console.log(e);
        return PUBKEY_LOOKUP_RESULT_FAIL;
      }
    }
  }

  function evaluate_receivers() {
    $('.recipients span').not('.working, .has_pgp, .no_pgp, .wrong, .attested, .failed, .expired').each(function () {
      const email_element = this;
      const email = tool.str.parse_email($(email_element).text()).email;
      if (tool.str.is_email_valid(email)) {
        S.now('send_btn_span').text(BTN_LOADING);
        set_input_text_height_manually_if_needed();
        lookup_pubkey_from_db_or_keyserver_and_update_db_if_needed(email).then(pubkey_lookup_result => {
          render_pubkey_result(email_element, email, pubkey_lookup_result);
        });
      } else {
        render_pubkey_result(email_element, email, PUBKEY_LOOKUP_RESULT_WRONG);
      }
    });
    set_input_text_height_manually_if_needed()
  }

  function get_password_validation_warning() {
    if (!S.cached('input_password').val()) {
      return 'No password entered';
    }
  }

  function show_message_password_ui_and_color_button() {
    S.cached('password_or_pubkey').css('display', 'table-row');
    S.cached('password_or_pubkey').css('display', 'table-row');
    if (S.cached('input_password').val() || S.cached('input_password').is(':focus')) {
      S.cached('password_label').css('display', 'inline-block');
      S.cached('input_password').attr('placeholder', '');
    } else {
      S.cached('password_label').css('display', 'none');
      S.cached('input_password').attr('placeholder', 'one time password');
    }
    if (get_password_validation_warning()) {
      S.cached('send_btn').removeClass('green').addClass('gray');
    } else {
      S.cached('send_btn').removeClass('gray').addClass('green');
    }
    if (S.cached('input_intro').is(':visible')) {
      S.cached('add_intro').css('display', 'none');
    } else {
      S.cached('add_intro').css('display', 'block');
    }
    set_input_text_height_manually_if_needed();
  }

  /**
   * On Firefox, we have to manage textbox height manually. Only applies to composing new messages
   * (else ff will keep expanding body element beyond frame view)
   * A decade old firefox bug is the culprit: https://bugzilla.mozilla.org/show_bug.cgi?id=202081
   *
   * @param update_reference_body_height - set to true to take a new snapshot of intended html body height
   */
  function set_input_text_height_manually_if_needed(update_reference_body_height:boolean=false) {
    if(!is_reply_box && tool.env.browser().name === 'firefox') {
      let cell_height_except_text = 0;
      S.cached('all_cells_except_text').each(function() {
        let cell = $(this);
        cell_height_except_text += cell.is(':visible') ? (cell.parent('tr').height() || 0) + 1 : 0; // add a 1px border height for each table row
      });
      if(update_reference_body_height || !reference_body_height) {
        reference_body_height = S.cached('body').height() || 605;
      }
      S.cached('input_text').css('height', reference_body_height - cell_height_except_text);
    }
  }

  function hide_message_password_ui() {
    S.cached('password_or_pubkey').css('display', 'none');
    S.cached('input_password').val('');
    S.cached('add_intro').css('display', 'none');
    S.cached('input_intro').text('');
    S.cached('intro_container').css('display', 'none');
    set_input_text_height_manually_if_needed();
  }

  function show_hide_password_or_pubkey_container_and_color_send_button() {
    reset_send_btn();
    S.cached('send_btn_note').text('');
    S.cached('send_btn').removeAttr('title');
    let was_previously_visible = S.cached('password_or_pubkey').css('display') === 'table-row';
    if (!$('.recipients span').length) {
      hide_message_password_ui();
      S.cached('send_btn').removeClass('gray').addClass('green');
    } else if (S.cached('icon_sign').is('.active')) {
      S.cached('send_btn').removeClass('gray').addClass('green');
    } else if ($('.recipients span.no_pgp').length) {
      show_message_password_ui_and_color_button();
    } else if ($('.recipients span.failed, .recipients span.wrong').length) {
      S.now('send_btn_span').text(BTN_WRONG_ENTRY);
      S.cached('send_btn').attr('title', 'Notice the recipients marked in red: please remove them and try to enter them egain.');
      S.cached('send_btn').removeClass('green').addClass('gray');
    } else {
      hide_message_password_ui();
      S.cached('send_btn').removeClass('gray').addClass('green');
    }
    if (is_reply_box) {
      if (!was_previously_visible && S.cached('password_or_pubkey').css('display') === 'table-row') {
        resize_reply_box((S.cached('password_or_pubkey').first().height() || 66) + 20);
      } else {
        resize_reply_box();
      }
    }
    set_input_text_height_manually_if_needed();
  }

  function respond_to_input_hotkeys(input_to_keydown_event: KeyboardEvent) {
    let value = S.cached('input_to').val();
    const keys = tool.env.key_codes();
    if (!value && input_to_keydown_event.which === keys.backspace) {
      $('.recipients span').last().remove();
    } else if (value && (input_to_keydown_event.which === keys.enter || input_to_keydown_event.which === keys.tab)) {
      S.cached('input_to').blur();
      if (S.cached('contacts').css('display') === 'block') {
        if (S.cached('contacts').find('.select_contact.hover').length) {
          S.cached('contacts').find('.select_contact.hover').click();
        } else {
          S.cached('contacts').find('.select_contact').first().click();
        }
      }
      S.cached('input_to').focus().blur();
      return false;
    }
  }

  function resize_reply_box(add_extra:number=0) {
    if (is_reply_box) {
      S.cached('input_text').css('max-width', (S.cached('body').width()! - 20) + 'px'); // body should always be present
      let min_height = 0;
      let current_height = 0;
      if (S.cached('compose_table').is(':visible')) {
        current_height = S.cached('compose_table').outerHeight() || 0;
        min_height = 260;
      } else if (S.cached('reply_message_successful').is(':visible')) {
        current_height = S.cached('reply_message_successful').outerHeight() || 0;
      } else {
        current_height = S.cached('reply_message_prompt').outerHeight() || 0;
      }
      if (current_height !== last_reply_box_table_height && Math.abs(current_height - last_reply_box_table_height) > 2) { // more then two pixel difference compared to last time
        last_reply_box_table_height = current_height;
        app.send_message_to_main_window('set_css', {
          selector: 'iframe#' + frame_id,
          css: {height: (Math.max(min_height, current_height) + add_extra) + 'px'}
        });
      }
    }
  }

  function append_forwarded_message(text: string) {
    S.cached('input_text').append('<br/><br/>Forwarded message:<br/><br/>> ' + text.replace(/(?:\r\n|\r|\n)/g, '\> '));
    resize_reply_box();
  }

  function retrieve_decrypt_and_add_forwarded_message(message_id: string) {
    app.email_provider_extract_armored_block(message_id, function (armored_message: string) {
      tool.crypto.message.decrypt(account_email, armored_message, null, function (result) {
        if (result.success) {
          if (!tool.mime.resembles_message(result.content.data)) {
            append_forwarded_message(tool.mime.format_content_to_display(result.content.data as string, armored_message));
          } else {
            tool.mime.decode(result.content.data as string, (success, mime_parse_result) => {
              append_forwarded_message(tool.mime.format_content_to_display(mime_parse_result.text || mime_parse_result.html || result.content.data as string, armored_message));
            });
          }
        } else {
          S.cached('input_text').append('<br/>\n<br/>\n<br/>\n' + armored_message.replace(/\n/g, '<br/>\n'));
        }
      });
    }, function (error_type: any, url_formatted_data_block: string) {
      if (url_formatted_data_block) {
        S.cached('input_text').append('<br/>\n<br/>\n<br/>\n' + url_formatted_data_block);
      }
    });
  }

  function render_reply_message_compose_table(method:"forward"|"reply"="reply") {
    S.cached('reply_message_prompt').css('display', 'none');
    S.cached('compose_table').css('display', 'table');
    S.cached('input_to').val(supplied_to + (supplied_to ? ',' : '')); // the comma causes the last email to be get evaluated
    render_compose_table();
    if (can_read_emails) {
      app.email_provider_determine_reply_message_header_variables((last_message_id: string, headers: FlatHeaders) => {
        if(last_message_id && headers) {
          for(let name in headers) {
            additional_message_headers[name] = headers[name];
          }
          if(method === 'forward') {
            supplied_subject = 'Fwd: ' + supplied_subject;
            retrieve_decrypt_and_add_forwarded_message(last_message_id);
          }
        }
      });
    } else {
      S.cached('reply_message_prompt').html('FlowCrypt has limited functionality. Your browser needs to access this conversation to reply.<br/><br/><br/><div class="button green auth_settings">Add missing permission</div><br/><br/>Alternatively, <a href="#" class="new_message_button">compose a new secure message</a> to respond.<br/><br/>');
      S.cached('reply_message_prompt').attr('style', 'border:none !important');
      $('.auth_settings').click(() => app.send_message_to_background_script('settings', { account_email: account_email, page: '/chrome/settings/modules/auth_denied.htm'}));
      $('.new_message_button').click(() => app.send_message_to_main_window('open_new_message'));
    }
    resize_reply_box();
  }

  function render_receivers() {
    const input_to = (S.cached('input_to').val() as string).toLowerCase();
    if (tool.value(',').in(input_to)) {
      const emails = input_to.split(',');
      for (let i = 0; i < emails.length - 1; i++) {
        S.cached('input_to').siblings('.recipients').append('<span>' + emails[i] + tool.ui.spinner('green') + '</span>');
      }
    } else if (!S.cached('input_to').is(':focus') && input_to) {
      S.cached('input_to').siblings('.recipients').append('<span>' + input_to + tool.ui.spinner('green') + '</span>');
    } else {
      return;
    }
    S.cached('input_to').val('');
    resize_input_to();
    evaluate_receivers();
    set_input_text_height_manually_if_needed();
  }

  function select_contact(email: string, from_query: ProviderContactsQuery) {
    const possibly_bogus_recipient = $('.recipients span.wrong').last();
    const possibly_bogus_address = tool.str.parse_email(possibly_bogus_recipient.text()).email;
    const q = tool.str.parse_email(from_query.substring).email;
    if (possibly_bogus_address === q || tool.value(q).in(possibly_bogus_address)) {
      possibly_bogus_recipient.remove();
    }
    setTimeout(function () {
      if (!tool.value(email).in(get_recipients_from_dom())) {
        S.cached('input_to').val(tool.str.parse_email(email).email);
        render_receivers();
        S.cached('input_to').focus();
      }
    }, tool.int.random(20, 100)); // desperate amount to remove duplicates. Better solution advisable.
    hide_contacts();
  }

  function resize_input_to() { // below both present in template
    S.cached('input_to').css('width', (Math.max(150, S.cached('input_to').parent().width()! - S.cached('input_to').siblings('.recipients').width()! - 50)) + 'px');
  }

  function remove_receiver() {
    recipients_missing_my_key = tool.arr.without_value(recipients_missing_my_key, $(this).parent().text());
    $(this).parent().remove();
    resize_input_to();
    show_hide_password_or_pubkey_container_and_color_send_button();
    update_pubkey_icon();
  }

  function auth_contacts(account_email: string) {
    S.cached('input_to').val($('.recipients span').last().text());
    $('.recipients span').last().remove();
    tool.api.google.auth({account_email: account_email, scopes: tool.api.gmail.scope(['read'])} as AuthRequest, function (google_auth_response: any) {
      if (google_auth_response.success === true) {
        can_read_emails = true;
        search_contacts();
      } else if (google_auth_response.success === false && google_auth_response.result === 'denied' && google_auth_response.error === 'access_denied') {
        alert('FlowCrypt needs this permission to search your contacts on Gmail. Without it, FlowCrypt will keep a separate contact list.');
      } else {
        console.log(google_auth_response);
        alert(Lang.general.something_went_wrong_try_again);
      }
    });
  }

  function render_search_results_loading_done() {
    S.cached('contacts').find('ul li.loading').remove();
    if (!S.cached('contacts').find('ul li').length) {
      hide_contacts();
    }
  }

  function render_search_results(contacts: Contact[], query: ProviderContactsQuery) {
    const renderable_contacts = contacts.slice();
    renderable_contacts.sort((a, b) => (10 * (b.has_pgp - a.has_pgp)) + ((b.last_use || 0) - (a.last_use || 0) > 0 ? 1 : -1)); // have pgp on top, no pgp bottom. Sort each groups by last used
    renderable_contacts.splice(8);
    if (renderable_contacts.length > 0 || contact_search_in_progress) {
      let ul_html = '';
      for(let contact of renderable_contacts) {
        ul_html += '<li class="select_contact" data-test="action-select-contact" email="' + contact.email.replace(/<\/?b>/g, '') + '">';
        if (contact.has_pgp) {
          ul_html += '<img src="/img/svgs/locked-icon-green.svg" />';
        } else {
          ul_html += '<img src="/img/svgs/locked-icon-gray.svg" />';
        }
        let display_email;
        if (contact.email.length < 40) {
          display_email = contact.email;
        } else {
          const parts = contact.email.split('@');
          display_email = parts[0].replace(/<\/?b>/g, '').substr(0, 10) + '...@' + parts[1];
        }
        if (contact.name) {
          ul_html += (contact.name + ' &lt;' + display_email + '&gt;');
        } else {
          ul_html += display_email;
        }
        ul_html += '</li>';
      }
      if (contact_search_in_progress) {
        ul_html += '<li class="loading">loading...</li>';
      }
      S.cached('contacts').find('ul').html(ul_html);
      S.cached('contacts').find('ul li.select_contact').click(tool.ui.event.prevent(tool.ui.event.double(), function (self: HTMLElement) {
        let email = $(self).attr('email');
        if (email) { // make ts happy
          select_contact(tool.str.parse_email(email).email, query);
        }
      }));
      S.cached('contacts').find('ul li.select_contact').hover(function () {
        $(this).addClass('hover');
      }, function () {
        $(this).removeClass('hover');
      });
      S.cached('contacts').find('ul li.auth_contacts').click(function () {
        auth_contacts(account_email);
      });
      S.cached('contacts').css({
        display: 'block',
        top: ($('#compose > tbody > tr:first').height()! + $('#input_addresses_container > div:first').height()! + 10) + 'px', // both are in the template
      });
    } else {
      hide_contacts();
    }
  }

  async function search_contacts(db_only=false) {
    const query = {substring: tool.str.parse_email(S.cached('input_to').val() as string).email};
    if (query.substring !== '') {
      let contacts = await app.storage_contact_search(query);
      if (db_only || !can_read_emails) {
        render_search_results(contacts, query);
      } else {
        contact_search_in_progress = true;
        render_search_results(contacts, query);
        app.email_provider_search_contacts(query.substring, contacts, async (search_contacts_results: {new: Contact[], all: Contact[]}) => {
          if (search_contacts_results.new.length) {
            for(let contact of search_contacts_results.new) {
              let in_db = await app.storage_contact_get(contact.email) as Contact;
              if (!in_db) {
                await app.storage_contact_save(app.storage_contact_object(contact.email, contact.name, null, null, null, true, contact.date ? new Date(contact.date).getTime() : null));
              } else if (!in_db.name && contact.name) {
                const to_update = {name: contact.name};
                await app.storage_contact_update(contact.email, to_update);
              }
            }
            await search_contacts(true);
          } else {
            render_search_results_loading_done();
            contact_search_in_progress = false;
          }
        });
      }
    } else {
      hide_contacts(); //todo - show suggestions of most contacted ppl etc
    }
  }

  function hide_contacts() {
    S.cached('contacts').css('display', 'none');
  }

  function update_pubkey_icon(include:boolean|null=null) {
    if (include === null) { // decide if pubkey should be included
      if (!include_pubkey_toggled_manually) { // leave it as is if toggled manually before
        update_pubkey_icon(Boolean(recipients_missing_my_key.length) && !tool.value(supplied_from || get_sender_from_dom()).in(my_addresses_on_pks));
      }
    } else { // set icon to specific state
      if (include) {
        S.cached('icon_pubkey').addClass('active').attr('title', Lang.compose.include_pubkey_icon_title_active);
      } else {
        S.cached('icon_pubkey').removeClass('active').attr('title', Lang.compose.include_pubkey_icon_title);
      }
    }
  }

  function update_footer_icon(include:boolean|null=null) {
    if (include === null) { // decide if pubkey should be included
      update_footer_icon(!!app.storage_get_email_footer());
    } else { // set icon to specific state
      if (include) {
        S.cached('icon_footer').addClass('active');
      } else {
        S.cached('icon_footer').removeClass('active');
      }
    }
  }

  function toggle_sign_icon() {
    if (!S.cached('icon_sign').is('.active')) {
      S.cached('icon_sign').addClass('active');
      S.cached('compose_table').addClass('sign');
      S.cached('title').text(Lang.compose.header_title_compose_sign);
      S.cached('input_password').val('');
    } else {
      S.cached('icon_sign').removeClass('active');
      S.cached('compose_table').removeClass('sign');
      S.cached('title').text(Lang.compose.header_title_compose_encrypt);
    }
    if (tool.value(S.now('send_btn_span').text()).in([BTN_SIGN_AND_SEND, BTN_ENCRYPT_AND_SEND])) {
      reset_send_btn();
    }
    show_hide_password_or_pubkey_container_and_color_send_button();
  }

  function recipient_key_id_text(contact: Contact) {
    if (contact.client === 'cryptup' && contact.keywords) {
      return '\n\n' + 'Public KeyWords:\n' + contact.keywords;
    } else if (contact.fingerprint) {
      return '\n\n' + 'Key fingerprint:\n' + contact.fingerprint;
    } else {
      return '';
    }
  }

  function render_pubkey_result(email_element: HTMLElement, email: string, contact: Contact|"fail"|"wrong") {
    if ($('body#new_message').length) {
      if (typeof contact === 'object' && contact.has_pgp) {
        let sending_address_on_pks = tool.value(supplied_from || get_sender_from_dom()).in(my_addresses_on_pks);
        let sending_address_on_keyserver = tool.value(supplied_from || get_sender_from_dom()).in(my_addresses_on_keyserver);
        if ((contact.client === 'cryptup' && !sending_address_on_keyserver) || (contact.client !== 'cryptup' && !sending_address_on_pks)) {
          // new message, and my key is not uploaded where the recipient would look for it
          app.does_recipient_have_my_pubkey(email, function (already_has: boolean) {
            if (!already_has) { // either don't know if they need pubkey (can_read_emails false), or they do need pubkey
              recipients_missing_my_key.push(email);
            }
            update_pubkey_icon();
          });
        } else {
          update_pubkey_icon();
        }
      } else {
        update_pubkey_icon();
      }
    }
    $(email_element).children('img, i').remove();
    $(email_element).append('<img src="/img/svgs/close-icon.svg" alt="close" class="close-icon svg" /><img src="/img/svgs/close-icon-black.svg" alt="close" class="close-icon svg display_when_sign" />').find('img.close-icon').click(remove_receiver);
    if (contact === PUBKEY_LOOKUP_RESULT_FAIL) {
      $(email_element).attr('title', 'Loading contact information failed, please try to add their email again.');
      $(email_element).addClass("failed");
      $(email_element).children('img:visible').replaceWith('<img src="/img/svgs/repeat-icon.svg" class="repeat-icon action_retry_pubkey_fetch">');
      $(email_element).find('.action_retry_pubkey_fetch').click(remove_receiver); // todo - actual refresh
    } else if (contact === PUBKEY_LOOKUP_RESULT_WRONG) {
      $(email_element).attr('title', 'This email address looks misspelled. Please try again.');
      $(email_element).addClass("wrong");
    } else if (contact.has_pgp && tool.crypto.key.expired_for_encryption(openpgp.key.readArmored(contact.pubkey).keys[0])) {
      $(email_element).addClass("expired");
      $(email_element).prepend('<img src="/img/svgs/expired-timer.svg" class="expired-time">');
      $(email_element).attr('title', 'Does use encryption but their public key is expired. You should ask them to send you an updated public key.' + recipient_key_id_text(contact));
    } else if (contact.has_pgp && contact.attested) {
      $(email_element).addClass("attested");
      $(email_element).prepend('<img src="/img/svgs/locked-icon.svg" />');
      $(email_element).attr('title', 'Does use encryption, attested by CRYPTUP' + recipient_key_id_text(contact));
    } else if (contact.has_pgp) {
      $(email_element).addClass("has_pgp");
      $(email_element).prepend('<img src="/img/svgs/locked-icon.svg" />');
      $(email_element).attr('title', 'Does use encryption' + recipient_key_id_text(contact));
    } else {
      $(email_element).addClass("no_pgp");
      $(email_element).prepend('<img src="/img/svgs/locked-icon.svg" />');
      $(email_element).attr('title', 'Could not verify their encryption setup. You can encrypt the message with a password below. Alternatively, add their pubkey.');
    }
    show_hide_password_or_pubkey_container_and_color_send_button();
  }

  function get_recipients_from_dom(filter:"no_pgp"|null=null): string[] {
    let selector;
    if (filter === 'no_pgp') {
      selector = '.recipients span.no_pgp';
    } else {
      selector = '.recipients span';
    }
    const recipients: string[] = [];
    $(selector).each(function () {
      recipients.push($(this).text().trim());
    });
    return recipients;
  }

  function get_sender_from_dom(): string {
    if (S.now('input_from').length) {
      return String(S.now('input_from').val());
    } else {
      return account_email;
    }
  }

  $('.delete_draft').click(function () {
    draft_delete(app.close_message);
  });

  function render_reply_success(message: SendableMessage, plaintext: string, message_id: string) {
    let is_signed = S.cached('icon_sign').is('.active');
    app.render_reinsert_reply_box(message_id, message.headers.To.split(',').map(a => tool.str.parse_email(a).email));
    if(is_signed) {
      S.cached('replied_body').addClass('pgp_neutral').removeClass('pgp_secure');
    }
    S.cached('replied_body').css('width', ($('table#compose').width() || 500) - 30);
    S.cached('compose_table').css('display', 'none');
    S.cached('reply_message_successful').find('div.replied_from').text(supplied_from);
    S.cached('reply_message_successful').find('div.replied_to span').text(supplied_to);
    S.cached('reply_message_successful').find('div.replied_body').html(plaintext.replace(/\n/g, '<br>'));
    const email_footer = app.storage_get_email_footer();
    if (email_footer) {
      if(is_signed) {
        S.cached('replied_body').append('<br><br>' + email_footer.replace(/\n/g, '<br>'));
      } else {
        S.cached('reply_message_successful').find('.email_footer').html('<br>' + email_footer.replace(/\n/g, '<br>'));
      }
    }
    let t = new Date();
    let time = ((t.getHours() !== 12) ? (t.getHours() % 12) : 12) + ':' + (t.getMinutes() < 10 ? '0' : '') + t.getMinutes() + ((t.getHours() >= 12) ? ' PM ' : ' AM ') + '(0 minutes ago)';
    S.cached('reply_message_successful').find('div.replied_time').text(time);
    S.cached('reply_message_successful').css('display', 'block');
    if (message.attachments.length) {
      S.cached('replied_attachments').html(message.attachments.map(a => {a.message_id = message_id; return app.factory_attachment(a)}).join('')).css('display', 'block');
    }
    resize_reply_box();
  }

  function simulate_ctrl_v(to_paste: string) {
    const r = window.getSelection().getRangeAt(0);
    r.insertNode(r.createContextualFragment(to_paste));
  }

  function render_compose_table() {
    if (tool.env.browser().name === 'firefox') { // the padding cause issues in firefox where user cannot click on the message password
      S.cached('input_text').css({'padding-top': 0, 'padding-bottom': 0});
    }
    // @ts-ignore
    $('#send_btn').click(tool.ui.event.prevent(tool.ui.event.double(), extract_process_encrypt_and_send_message)).keypress(tool.ui.enter(extract_process_encrypt_and_send_message));
    S.cached('input_to').keydown((ke: any) => respond_to_input_hotkeys(ke));
    S.cached('input_to').keyup(tool.ui.event.prevent(tool.ui.event.spree('veryslow'), () => search_contacts()));
    S.cached('input_to').blur(tool.ui.event.prevent(tool.ui.event.double(), render_receivers));
    S.cached('input_text').keyup(function () {
      S.cached('send_btn_note').text('');
    });
    S.cached('compose_table').click(hide_contacts);
    $('#input_addresses_container > div').click(function () {
      if (!S.cached('input_to').is(':focus')) {
        S.cached('input_to').focus();
      }
    }).children().click(function () {
      return false;
    });
    resize_input_to();
    tool.time.wait(() => {
      if (attach) {
        return true;
      }
    }).then(function () {
      attach.initialize_attach_dialog('fineuploader', 'fineuploader_button');
    });
    S.cached('input_to').focus();
    if(is_reply_box) {
      if (supplied_to) {
        S.cached('input_text').focus();
        document.getElementById('input_text')!.focus(); // #input_text is in the template
        evaluate_receivers();
      }
      setTimeout(() => { // delay automatic resizing until a second later
        $(window).resize(tool.ui.event.prevent(tool.ui.event.spree('veryslow'), () => resize_reply_box()));
        S.cached('input_text').keyup(() => resize_reply_box());
      }, 1000);
    } else {
      $('.close_new_message').click(app.close_message);
      let addresses = app.storage_get_addresses() as string[];
      if(addresses.length > 1) {
        let input_addr_container = $('#input_addresses_container');
        input_addr_container.addClass('show_send_from').append('<select id="input_from" tabindex="-1" data-test="input-from"></select><img id="input_from_settings" src="/img/svgs/settings-icon.svg" data-test="action-open-sending-address-settings" title="Settings">');
        input_addr_container.find('#input_from_settings').click(() => app.render_sending_address_dialog());
        input_addr_container.find('#input_from').append(addresses.map(a => '<option value="' + a + '">' + a + '</option>').join('')).change(() => update_pubkey_icon());
        if(tool.env.browser().name === 'firefox') {
          input_addr_container.find('#input_from_settings').css('margin-top', '20px');
        }
      }
      set_input_text_height_manually_if_needed();
    }
  }

  function should_save_draft(message_body: string) {
    if (message_body && message_body !== last_draft) {
      last_draft = message_body;
      return true;
    } else {
      return false;
    }
  }

  function format_password_protected_email(short_id: string, original_body: SendableMessageBody, armored_pubkeys: string[]) {
    const decrypt_url = CRYPTUP_WEB_URL + '/' + short_id;
    const a = '<a href="' + tool.str.html_escape(decrypt_url) + '" style="padding: 2px 6px; background: #2199e8; color: #fff; display: inline-block; text-decoration: none;">' + Lang.compose.open_message + '</a>';
    const intro = S.cached('input_intro').length ? S.cached('input_intro').get(0).innerText.trim() : '';
    const text = [];
    const html = [];
    if (intro) {
      text.push(intro + '\n');
      html.push(intro.replace(/\n/, '<br>') + '<br><br>');
    }
    text.push(Lang.compose.message_encrypted_text + decrypt_url + '\n');
    html.push('<div class="cryptup_encrypted_message_replaceable">');
    html.push('<div style="opacity: 0;">' + tool.crypto.armor.headers('null').begin + '</div>');
    html.push(Lang.compose.message_encrypted_html + a + '<br><br>');
    html.push(Lang.compose.alternatively_copy_paste + tool.str.html_escape(decrypt_url) + '<br><br><br>');
    const html_cryptup_web_url_link = '<a href="' + tool.str.html_escape(CRYPTUP_WEB_URL) + '" style="color: #999;">' + tool.str.html_escape(CRYPTUP_WEB_URL) + '</a>';
    if (armored_pubkeys.length > 1) { // only include the message in email if a pubkey-holding person is receiving it as well
      const html_pgp_message = original_body['text/html'] ? original_body['text/html'] : (original_body['text/plain'] || '').replace(CRYPTUP_WEB_URL, html_cryptup_web_url_link).replace(/\n/g, '<br>\n');
      html.push('<div style="color: #999;">' + html_pgp_message + '</div>');
      text.push(original_body['text/plain']);
    }
    html.push('</div>');
    return {'text/plain': text.join('\n'), 'text/html': html.join('\n')};
  }

  function format_email_text_footer(original_body: SendableMessageBody): SendableMessageBody {
    const email_footer = app.storage_get_email_footer();
    const body = {'text/plain': original_body['text/plain'] + (email_footer ? '\n' + email_footer : '')} as SendableMessageBody;
    if (typeof original_body['text/html'] !== 'undefined') {
      body['text/html'] = original_body['text/html'] + (email_footer ? '<br>\n' + email_footer.replace(/\n/g, '<br>\n') : '');
    }
    return body;
  }

  S.cached('input_password').keyup(tool.ui.event.prevent(tool.ui.event.spree(), show_hide_password_or_pubkey_container_and_color_send_button));
  S.cached('input_password').focus(show_hide_password_or_pubkey_container_and_color_send_button);
  S.cached('input_password').blur(show_hide_password_or_pubkey_container_and_color_send_button);

  S.cached('add_their_pubkey').click(function () {
    let no_pgp_emails = get_recipients_from_dom('no_pgp');
    app.render_add_pubkey_dialog(no_pgp_emails);
    clearInterval(added_pubkey_db_lookup_interval); // todo - get rid of setInterval. just supply tab_id and wait for direct callback
    added_pubkey_db_lookup_interval = window.setInterval(async() => {
      for(let email of no_pgp_emails) {
        let contact = await app.storage_contact_get(email);
        if (contact && (contact as Contact).has_pgp) {
          $("span.recipients span.no_pgp:contains('" + email + "') i").remove();
          $("span.recipients span.no_pgp:contains('" + email + "')").removeClass('no_pgp');
          clearInterval(added_pubkey_db_lookup_interval);
          evaluate_receivers();
        }
      }
    }, 1000);
  });

  S.cached('add_intro').click(function () {
    $(this).css('display', 'none');
    S.cached('intro_container').css('display', 'table-row');
    S.cached('input_intro').focus();
    set_input_text_height_manually_if_needed();
  });

  S.cached('icon_help').click(function () {
    app.render_help_dialog();
  });

  S.now('input_from').change(function () {
    // when I change input_from, I should completely re-evaluate: update_pubkey_icon() and render_pubkey_result()
    // because they might not have a pubkey for the alternative address, and might get confused
  });

  S.cached('input_text').get(0).onpaste = function (e) {
    if(e.clipboardData.getData('text/html')) {
      tool.str.html_as_text(e.clipboardData.getData('text/html'), (text: string) => {
        simulate_ctrl_v(text.replace(/\n/g, '<br>'));
      });
      return false;
    }
  };

  S.cached('icon_pubkey').click(function () {
    include_pubkey_toggled_manually = true;
    update_pubkey_icon(!$(this).is('.active'));
  });

  S.cached('icon_footer').click(function () {
    if(!$(this).is('.active')) {
      app.render_footer_dialog();
    } else {
      update_footer_icon(!$(this).is('.active'));
    }
  });

  // @ts-ignore
  S.cached('body').bind({drop: tool.ui.event.stop(), dragover: tool.ui.event.stop()}); // prevents files dropped out of the intended drop area to screw up the page

  S.cached('icon_sign').click(toggle_sign_icon);

})();