/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

declare var require: any;

interface ComposerAppFunctionsInterface {
    can_read_email: () => boolean,
    does_recipient_have_my_pubkey: (email: string, cb: (has_pubkey: boolean|undefined) => void) => void,
    storage_get_addresses: () => string[],
    storage_get_addresses_pks: () => string[],
    storage_get_addresses_keyserver: () => string[],
    storage_get_email_footer: () => string|null,
    storage_set_email_footer: (footer: string|null) => Promise<void>,
    storage_get_hide_message_password: () => boolean,
    storage_get_subscription: () => Promise<Subscription>,
    storage_get_key: (sender_email: string) => Promise<KeyInfo>,
    storage_set_draft_meta: (store_if_true: boolean, draft_id: string, thread_id: string, recipients: string[]|null, subject: string|null) => Promise<void>,
    storage_passphrase_get: () => Promise<string|null>,
    storage_add_admin_codes: (short_id: string, message_admin_code: string, attachment_admin_codes: string[]) => Promise<void>,
    storage_contact_get: (email: string[]) => Promise<(Contact|null)[]>,
    storage_contact_update: (email: string|string[], update: ContactUpdate) => Promise<void>,
    storage_contact_save:  (contact: Contact) =>  Promise<void>,
    storage_contact_search: (query: ProviderContactsQuery) => Promise<Contact[]>,
    storage_contact_object: (email: string, name: string|null, client: string|null, pubkey: string|null, attested: boolean|null, pending_lookup:boolean|number, last_use: number|null) => Contact,
    email_provider_draft_get: (draft_id: string) => Promise<any>,
    email_provider_draft_create: (mime_message: string) => Promise<{id: string}>,
    email_provider_draft_update: (draft_id: string, mime_message: string) => Promise<void>,
    email_provider_draft_delete: (draft_id: string) => Promise<void>,
    email_provider_message_send: (message: SendableMessage, render_upload_progress: ApiCallProgressCallback) => Promise<{id: string}>,
    email_provider_search_contacts: (query: string, known_contacts: Contact[], multi_cb: (r: {new: Contact[], all: Contact[]}) => void) => void,
    email_provider_determine_reply_message_header_variables: (cb: (last_message_id: string, headers: FlatHeaders) => void) => void,
    email_provider_extract_armored_block: (message_id: string, success_cb: (armored_msg: string) => void, error_cb: (error_type: any, url_formatted_data_block: string) => void) => void,
    send_message_to_main_window: (channel: string, data?: Object) => void,
    send_message_to_background_script: (channel: string, data?: Object) => void,
    render_footer_dialog: () => void,
    render_add_pubkey_dialog: (emails: string[]) => void,
    render_reinsert_reply_box: (last_message_id: string, recipients: string[]) => void,
    render_help_dialog: () => void,
    render_sending_address_dialog: () => void,
    factory_attachment: (attachment: Attachment) => string,
    close_message: () => void,
}

class ComposerUserError extends Error {}
class ComposerNotReadyError extends ComposerUserError {}
class ComposerNetworkError extends Error {}
class ComposerResetBtnTrigger extends Error {}

class Composer {

  S = tool.ui.build_jquery_selectors({
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

  private attach: Attach;
  private app: ComposerAppFunctionsInterface;

  private SAVE_DRAFT_FREQUENCY = 3000;
  private PUBKEY_LOOKUP_RESULT_WRONG: 'wrong' = 'wrong';
  private PUBKEY_LOOKUP_RESULT_FAIL: 'fail' = 'fail';
  private BTN_ENCRYPT_AND_SEND = 'Encrypt and Send';
  private BTN_SIGN_AND_SEND = 'Sign and Send';
  private BTN_WRONG_ENTRY = 'Re-enter recipient..';
  private BTN_LOADING = 'Loading..';
  private BTN_SENDING = 'Sending..';
  private CRYPTUP_WEB_URL = 'https://flowcrypt.com'; // todo - should use tool.api.url()

  private last_draft = '';
  private can_read_emails: boolean;
  private last_reply_box_table_height = 0;
  private contact_search_in_progress = false;
  private added_pubkey_db_lookup_interval: number;
  private save_draft_interval: number;
  private draft_save_in_progress = false;
  private passphrase_interval: number;
  private include_pubkey_toggled_manually = false;
  private my_addresses_on_pks: string[] = [];
  private my_addresses_on_keyserver: string[] = [];
  private recipients_missing_my_key: string[] = [];
  private ks_lookups_by_email: {[key: string]: PubkeySearchResult|Contact} = {};
  private subscribe_result_listener: ((subscription_active: boolean) => void)|undefined;
  private additional_message_headers: {[key: string]: string} = {};
  private button_update_timeout: number|null = null;
  private is_reply_box: boolean;
  private tab_id: string;
  private account_email: string;
  private thread_id: string;
  private draft_id:string;
  private supplied_subject:string;
  private supplied_from: string;
  private supplied_to: string;
  private frame_id: string;
  private reference_body_height: number;

  constructor(app_functions: ComposerAppFunctionsInterface, variables: UrlParams, subscription: Subscription) {
    this.attach = new Attach(() => this.get_max_attachment_size_and_oversize_notice(subscription));
    this.app = app_functions;
    this.save_draft_interval = setInterval(() => this.draft_save(), this.SAVE_DRAFT_FREQUENCY);

    this.account_email = variables.account_email as string;
    this.draft_id = variables.draft_id as string;
    this.thread_id = variables.thread_id as string;
    this.supplied_subject = variables.subject as string;
    this.supplied_from = variables.from as string;
    this.supplied_to = variables.to as string;
    this.frame_id = variables.frame_id as string;
    this.tab_id = variables.tab_id as string;
    this.is_reply_box = variables.is_reply_box as boolean;
    this.my_addresses_on_pks = this.app.storage_get_addresses_pks() || [];
    this.my_addresses_on_keyserver = this.app.storage_get_addresses_keyserver() || [];
    this.can_read_emails = this.app.can_read_email();
    if (subscription.active) {
      this.update_footer_icon();
    } else if (this.app.storage_get_email_footer()) { // footer set but subscription not active - subscription expired
      this.app.storage_set_email_footer(null).catch(tool.catch.handle_exception);
      this.app.send_message_to_main_window('notification_show', {
        notification: 'Your FlowCrypt ' + (subscription.method === 'trial' ? 'trial' : 'subscription') + ' has ended. Custom email signature (email footer) will no longer be used. <a href="#" class="subscribe">renew</a> <a href="#" class="close">close</a>',
      });
    }
    if (this.app.storage_get_hide_message_password()) {
      this.S.cached('input_password').attr('type', 'password');
    }
    // noinspection JSIgnoredPromiseFromCall
    this.initialize_compose_box(variables);
    this.initialize_actions();
  }

  private get_max_attachment_size_and_oversize_notice = (subscription: Subscription) => {
    if (!subscription.active) {
      return {
        size_mb: 5,
        size: 5 * 1024 * 1024,
        count: 10,
        oversize: () => {
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
              this.show_subscribe_dialog_and_wait_for_response(null, {}, (new_subscription_active) => {
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
      let size_mb = (subscription.method !== 'trial' && tool.value(tool.crypto.hash.sha1(this.account_email)).in(allow_huge_attachments)) ? 200 : 25;
      return {
        size_mb: size_mb,
        size: size_mb * 1024 * 1024,
        count: 10,
        oversize: (combined_size: number) => {
          alert('Combined attachment size is limited to 25 MB. The last file brings it to ' + Math.ceil(combined_size / (1024 * 1024)) + ' MB.');
        },
      };
    }
  };

  private initialize_actions = () => {
    let S = this.S;
    let that = this;
    S.cached('icon_pubkey').attr('title', Lang.compose.include_pubkey_icon_title);
    S.cached('input_password').keyup(tool.ui.event.prevent(tool.ui.event.spree(), () => this.show_hide_password_or_pubkey_container_and_color_send_button()));
    S.cached('input_password').focus(() => this.show_hide_password_or_pubkey_container_and_color_send_button());
    S.cached('input_password').blur(() => this.show_hide_password_or_pubkey_container_and_color_send_button());
    S.cached('add_their_pubkey').click(() => {
      let no_pgp_emails = this.get_recipients_from_dom('no_pgp');
      this.app.render_add_pubkey_dialog(no_pgp_emails);
      clearInterval(this.added_pubkey_db_lookup_interval); // todo - get rid of setInterval. just supply tab_id and wait for direct callback
      this.added_pubkey_db_lookup_interval = window.setInterval(async() => {
        for(let email of no_pgp_emails) {
          let [contact] = await this.app.storage_contact_get([email]);
          if (contact && contact.has_pgp) {
            $("span.recipients span.no_pgp:contains('" + email + "') i").remove();
            $("span.recipients span.no_pgp:contains('" + email + "')").removeClass('no_pgp');
            clearInterval(this.added_pubkey_db_lookup_interval);
            this.evaluate_rendered_recipients();
          }
        }
      }, 1000);
    });
    S.cached('add_intro').click(function () {
      $(this).css('display', 'none');
      S.cached('intro_container').css('display', 'table-row');
      S.cached('input_intro').focus();
      that.set_input_text_height_manually_if_needed();
    });
    S.cached('icon_help').click(() => this.app.render_help_dialog());
    S.now('input_from').change(() => {
      // when I change input_from, I should completely re-evaluate: update_pubkey_icon() and render_pubkey_result()
      // because they might not have a pubkey for the alternative address, and might get confused
    });
    S.cached('input_text').get(0).onpaste = function (e) {
      if(e.clipboardData.getData('text/html')) {
        tool.str.html_as_text(e.clipboardData.getData('text/html'), (text: string) => {
          that.simulate_ctrl_v(text.replace(/\n/g, '<br>'));
        });
        return false;
      }
    };
    S.cached('icon_pubkey').click(function () {
      that.include_pubkey_toggled_manually = true;
      that.update_pubkey_icon(!$(this).is('.active'));
    });
    S.cached('icon_footer').click(function () {
      if(!$(this).is('.active')) {
        that.app.render_footer_dialog();
      } else {
        that.update_footer_icon(!$(this).is('.active'));
      }
    });
    $('.delete_draft').click(async () => {
      await this.draft_delete();
      this.app.close_message();
    });
    S.cached('body').bind({drop: tool.ui.event.stop(), dragover: tool.ui.event.stop()}); // prevents files dropped out of the intended drop area to screw up the page
    S.cached('icon_sign').click(() => this.toggle_sign_icon());
  };

  show_subscribe_dialog_and_wait_for_response = (_data: any, _sender: chrome.runtime.MessageSender | "background", respond: (subscribed: boolean) => void) => {
    this.subscribe_result_listener = respond;
    this.app.send_message_to_main_window('subscribe_dialog', {subscribe_result_tab_id: this.tab_id});
  };

  private initialize_compose_box = async (variables: UrlParams) => {
    let that = this;
    if(this.draft_id) {
      await this.initial_draft_load();
    } else {
      if(this.is_reply_box) {
        if(variables.skip_click_prompt) {
          this.render_reply_message_compose_table();
        } else {
          $('#reply_click_area,#a_reply,#a_reply_all,#a_forward').click(function () {
            if ($(this).attr('id') === 'a_reply') {
              that.supplied_to = that.supplied_to.split(',')[0];
            } else if ($(this).attr('id') === 'a_forward') {
              that.supplied_to = '';
            }
            that.render_reply_message_compose_table((($(this).attr('id') || '').replace('a_', '') || 'reply') as 'reply'|'forward');
          });
        }
      }
    }
    if(this.is_reply_box) {
      if(!variables.skip_click_prompt) {
        this.S.cached('reply_message_prompt').css('display', 'block');
      }
      this.S.cached('header').remove();
      this.S.cached('subject').remove();
      this.S.cached('contacts').css('top', '39px');
      this.S.cached('compose_table').css({'border-bottom': '1px solid #cfcfcf', 'border-top': '1px solid #cfcfcf'});
      this.S.cached('input_text').css('overflow-y', 'hidden');
      $(document).ready(() => this.resize_reply_box());
    } else {
      this.S.cached('body').css('overflow', 'hidden'); // do not enable this for replies or automatic resize won't work
      this.S.cached('compose_table').css('display', 'table');
      this.render_compose_table();
    }
    $('body').attr('data-test-state', 'ready');  //set as ready so that automated tests can evaluate results
  };

  private initial_draft_load = async ()  =>{
    if(this.is_reply_box) {
      this.S.cached('reply_message_prompt').html('Loading draft.. ' + tool.ui.spinner('green'));
    }
    try {
      let draft_get_response: any = await this.app.email_provider_draft_get(this.draft_id);
      tool.mime.decode(tool.str.base64url_decode(draft_get_response.message.raw), async (mime_success, parsed_message) => {
        let armored = tool.crypto.armor.clip(parsed_message.text || tool.crypto.armor.strip(parsed_message.html || '') || '');
        if(armored) {
          this.S.cached('input_subject').val(parsed_message.headers.subject || '');
          await this.decrypt_and_render_draft(armored, this.is_reply_box ? this.render_reply_message_compose_table : null, tool.mime.headers_to_from(parsed_message));
        } else {
          console.info('tool.api.gmail.draft_get tool.mime.decode else {}');
          if(this.is_reply_box) {
            this.render_reply_message_compose_table();
          }
        }
      });
    } catch(error) {
      if (this.is_reply_box && error.status === 404) {
        tool.catch.log('about to reload reply_message automatically: get draft 404', this.account_email);
        setTimeout(async() => {
          await this.app.storage_set_draft_meta(false, this.draft_id, this.thread_id, null, null);
          console.info('Above red message means that there used to be a draft, but was since deleted. (not an error)');
          window.location.reload();
        }, 500);
      } else {
        console.info('tool.api.gmail.draft_get success===false');
        console.info(error);
        if(this.is_reply_box) {
          this.render_reply_message_compose_table();
        }
      }
    }
  };

  process_subscribe_result = (new_subscription: Subscription)  =>{
    if (typeof this.subscribe_result_listener === 'function') {
      this.subscribe_result_listener(new_subscription.active || false);
      this.subscribe_result_listener = undefined;
    }
  };

  private reset_send_btn = (delay:number|null=null) => {
    const do_reset = () => this.S.cached('send_btn').html('<i class=""></i><span tabindex="4">' + (this.S.cached('icon_sign').is('.active') ? this.BTN_SIGN_AND_SEND : this.BTN_ENCRYPT_AND_SEND) + '</span>');
    if(this.button_update_timeout !== null) {
      clearTimeout(this.button_update_timeout);
    }
    if (!delay) {
      do_reset();
    } else {
      setTimeout(do_reset, delay);
    }
  };

  passphrase_entry = (entered: boolean) => {
    if(!entered) {
      this.reset_send_btn();
      clearInterval(this.passphrase_interval);
    }
  };

  private draft_save = async (force_save:boolean=false) => {
    if (this.should_save_draft(this.S.cached('input_text').text()) || force_save) {
      this.draft_save_in_progress = true;
      this.S.cached('send_btn_note').text('Saving');
      let primary_ki = await this.app.storage_get_key(this.account_email);
      let encrypted = await tool.crypto.message.encrypt([primary_ki.public], null, null, this.S.cached('input_text')[0].innerText, null, true);
      let body;
      if (this.thread_id) { // replied message
        body = '[cryptup:link:draft_reply:' + this.thread_id + ']\n\n' + encrypted.data;
      } else if (this.draft_id) {
        body = '[cryptup:link:draft_compose:' + this.draft_id + ']\n\n' + encrypted.data;
      } else {
        body = encrypted.data;
      }
      let subject = String(this.S.cached('input_subject').val() || this.supplied_subject || 'FlowCrypt draft');
      tool.mime.encode(body as string, {To: this.get_recipients_from_dom(), From: this.supplied_from || this.get_sender_from_dom(), Subject: subject} as RichHeaders, [], async (mime_message) => {
        try {
          if (!this.draft_id) {
            let new_draft = await this.app.email_provider_draft_create(mime_message);
            this.S.cached('send_btn_note').text('Saved');
            this.draft_id = new_draft.id;
            await this.app.storage_set_draft_meta(true, new_draft.id, this.thread_id, this.get_recipients_from_dom(), this.S.cached('input_subject').val() as string); // text input
              // recursing one more time, because we need the draft_id we get from this reply in the message itself
              // essentially everytime we save draft for the first time, we have to save it twice
              // save_draft_in_process will remain true because well.. it's still in process
            await this.draft_save(true); // force_save = true  
          } else {
            await this.app.email_provider_draft_update(this.draft_id, mime_message);
            this.S.cached('send_btn_note').text('Saved');
          }
        } catch(error) {
          console.log(error);
          this.S.cached('send_btn_note').text('Not saved');
        }
        this.draft_save_in_progress = false;
      });
    }
  };

  private draft_delete = async () => {
    clearInterval(this.save_draft_interval);
    await tool.time.wait(() => !this.draft_save_in_progress ? true : undefined);
    if (this.draft_id) {
      await this.app.storage_set_draft_meta(false, this.draft_id, this.thread_id, null, null);
      await this.app.email_provider_draft_delete(this.draft_id);
    }
  };

  private decrypt_and_render_draft = async (encrypted_draft: string, render_function: (() => void)|null, headers: FromToHeaders) => {
    let passphrase = this.app.storage_passphrase_get();
    if (passphrase !== null) {
      tool.crypto.message.decrypt(this.account_email, encrypted_draft, null, (result) => {
        if(result.success) {
          tool.str.as_safe_html((result.content.data as string).replace(/\n/g, '<br>\n'), (safe_html_draft: string) => {
            this.S.cached('input_text').html(safe_html_draft);
            if (headers && headers.to && headers.to.length) {
              this.S.cached('input_to').focus();
              this.S.cached('input_to').val(headers.to.join(','));
              this.S.cached('input_text').focus();
            }
            if (headers && headers.from) {
              this.S.now('input_from').val(headers.from);
            }
            this.set_input_text_height_manually_if_needed();
            if (render_function) {
              render_function();
            }
          });
        } else {
          this.set_input_text_height_manually_if_needed();
          if (render_function) {
            render_function();
          }
        }
      }, 'utf8');
    } else {
      if (this.is_reply_box) {
        this.S.cached('reply_message_prompt').html(tool.ui.spinner('green') + ' Waiting for pass phrase to open previous draft..');
        await this.when_master_passphrase_entered();
        await this.decrypt_and_render_draft(encrypted_draft, render_function, headers);
      }
    }
  };

  private when_master_passphrase_entered = (seconds_timeout:number|null=null): Promise<string|null> => {
    return new Promise(resolve => {
    clearInterval(this.passphrase_interval);
    const timeout_at = seconds_timeout ? Date.now() + seconds_timeout * 1000 : null;
      this.passphrase_interval = window.setInterval(async () => {
        let passphrase = await this.app.storage_passphrase_get();
        if (passphrase !== null) {
          clearInterval(this.passphrase_interval);
          resolve(passphrase);
        } else if (timeout_at && Date.now() > timeout_at) {
          clearInterval(this.passphrase_interval);
          resolve(null);
        }
      }, 1000);
    });
  };

  private collect_all_available_public_keys = async(account_email: string, recipients: string[]): Promise<{armored_pubkeys: string[], emails_without_pubkeys: string[]}> => {
    let contacts = await this.app.storage_contact_get(recipients);
    let {public: armored_public_key} = await this.app.storage_get_key(account_email);
    const armored_pubkeys = [armored_public_key];
    const emails_without_pubkeys = [];
    for(let i in contacts) {
      let contact = contacts[i];
      if (contact && contact.has_pgp && contact.pubkey) {
        armored_pubkeys.push(contact.pubkey);
      } else if (contact && this.ks_lookups_by_email[contact.email] && this.ks_lookups_by_email[contact.email].has_pgp && this.ks_lookups_by_email[contact.email].pubkey) {
        armored_pubkeys.push(this.ks_lookups_by_email[contact.email].pubkey!); // checked !null right above. Null evaluates to false.
      } else {
        emails_without_pubkeys.push(recipients[i]);
      }
    }
    return {armored_pubkeys, emails_without_pubkeys};
  };

  private throw_if_form_not_ready = (recipients: string[]): void => {
    if(tool.value(this.S.now('send_btn_span').text().trim()).in([this.BTN_ENCRYPT_AND_SEND, this.BTN_SIGN_AND_SEND]) && recipients && recipients.length) {
      return; // all good
    }
    if(this.S.now('send_btn_span').text().trim() === this.BTN_WRONG_ENTRY) {
      throw new ComposerUserError('Please re-enter recipients marked in red color.');
    }
    if(!recipients || !recipients.length) {
      throw new ComposerUserError('Please add a recipient first');
    }
    throw new ComposerNotReadyError('Still working, please wait.');
  };

  private throw_if_form_values_invalid = (recipients: string[], emails_without_pubkeys: string[], subject: string, plaintext: string, challenge: Challenge|null) => {
    const is_encrypt = !this.S.cached('icon_sign').is('.active');
    if(!recipients.length) {
      throw new ComposerUserError('Please add receiving email address.');
    }
    if(is_encrypt && emails_without_pubkeys.length && (!challenge || !challenge.answer)) {
      this.S.cached('input_password').focus();
      throw new ComposerUserError('Some recipients don\'t have encryption set up. Please add a password.');
    }
    if(!((plaintext !== '' || window.confirm('Send empty message?')) && (subject !== '' || window.confirm('Send without a subject?')))) {
      throw new ComposerResetBtnTrigger();
    }
  };

  private handle_send_error(error: Error|StandardError) {
    if(typeof error === 'object' && error.hasOwnProperty('internal')) {
      if((error as StandardError).internal === 'auth') {
        if (confirm('Your FlowCrypt account information is outdated, please review your account settings.')) {
          this.app.send_message_to_main_window('subscribe_dialog', {source: 'auth_error'});
        }
      } else {
        tool.catch.report('StandardError | failed to send message', error);
        alert((error as StandardError).internal || error.message);
      }
    } else {
      if(!((error instanceof ComposerUserError) || ((error instanceof ComposerResetBtnTrigger)))) {
        tool.catch.report('Error/Exception | failed to send message', error);
      }
      if(!((error instanceof ComposerResetBtnTrigger) || (error instanceof ComposerNotReadyError))) {
        alert(String(error));
      }
    }
    if(!(error instanceof ComposerNotReadyError)) {
      this.reset_send_btn(100);
    }
  }

  private extract_process_send_message = async() => {
    try {
      const recipients = this.get_recipients_from_dom();
      const subject = this.supplied_subject || String($('#input_subject').val()); // replies have subject in url params
      const plaintext = $('#input_text').get(0).innerText;
      this.throw_if_form_not_ready(recipients);
      this.S.now('send_btn_span').text('Loading');
      this.S.now('send_btn_i').replaceWith(tool.ui.spinner('white'));
      this.S.cached('send_btn_note').text('');
      let subscription = await this.app.storage_get_subscription();
      let {armored_pubkeys, emails_without_pubkeys} = await this.collect_all_available_public_keys(this.account_email, recipients);
      const challenge = emails_without_pubkeys.length ? {answer: String(this.S.cached('input_password').val())} : null;
      this.throw_if_form_values_invalid(recipients, emails_without_pubkeys, subject, plaintext, challenge);
      if(this.S.cached('icon_sign').is('.active')) {
        await this.sign_and_send(recipients, armored_pubkeys, subject, plaintext, challenge, subscription);
      } else {
        await this.encrypt_and_send(recipients, armored_pubkeys, subject, plaintext, challenge, subscription);
      }
    } catch(e) {
      this.handle_send_error(e);
    }
  };

  private encrypt_and_send = async (recipients: string[], armored_pubkeys: string[], subject: string, plaintext: string, challenge: Challenge|null, subscription: Subscription) => {
    this.S.now('send_btn_span').text('Encrypting');
    plaintext = await this.add_reply_token_to_message_body_if_needed(recipients, subject, plaintext, challenge, subscription);
    let attachments = await this.attach.collect_and_encrypt_attachments(armored_pubkeys, challenge);
    if (attachments.length && challenge) { // these will be password encrypted attachments
      this.button_update_timeout = window.setTimeout(() => this.S.now('send_btn_span').text(this.BTN_SENDING), 500);
      let attachment_admin_codes = await this.upload_attachments_to_cryptup(attachments, subscription);
      plaintext = this.add_uploaded_file_links_to_message_body(plaintext, attachments);
      await this.do_encrypt_format_and_send(armored_pubkeys, challenge, plaintext, [], recipients, subject, subscription, attachment_admin_codes);
    } else {
      await this.do_encrypt_format_and_send(armored_pubkeys, challenge, plaintext, attachments, recipients, subject, subscription);
    }
  };

  private sign_and_send = async (recipients: string[], armored_pubkeys: string[], subject: string, plaintext: string, challenge: Challenge|null, subscription: Subscription) => {
    this.S.now('send_btn_span').text('Signing');
    let [primary_k] = await Store.keys_get(this.account_email, ['primary']);
    if (primary_k) {
      const prv = openpgp.key.readArmored(primary_k.private).keys[0];
      let passphrase = await this.app.storage_passphrase_get();
      if (passphrase === null) {
        this.app.send_message_to_main_window('passphrase_dialog', {type: 'sign', longids: 'primary'});
        if ((await this.when_master_passphrase_entered(60)) !== null) { // pass phrase entered
          await this.sign_and_send(recipients, armored_pubkeys, subject, plaintext, challenge, subscription);
        } else { // timeout - reset - no passphrase entered
          clearInterval(this.passphrase_interval);
          this.reset_send_btn();
        }
      } else {
        let MimeCodec = await tool.env.require('emailjs-mime-codec');
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

        tool.crypto.key.decrypt(prv, passphrase!); // checked !== null above
        let signed_data = await tool.crypto.message.sign(prv, this.format_email_text_footer({'text/plain': plaintext})['text/plain'] || '', true) as string; // todo - confirm
        let attachments = await this.attach.collect_attachments(); // todo - not signing attachments
        // noinspection JSIgnoredPromiseFromCall
        this.app.storage_contact_update(recipients, {last_use: Date.now()});
        this.S.now('send_btn_span').text(this.BTN_SENDING);
        const body = {'text/plain': signed_data};
        await this.do_send_message(tool.api.common.message(this.account_email, this.supplied_from || this.get_sender_from_dom(), recipients, subject, body, attachments, this.thread_id), plaintext);
      }
    } else {
      alert('Cannot sign the message because your plugin is not correctly set up. Write me at human@flowcrypt.com if this persists.');
      this.reset_send_btn();
    }
  };

  private upload_attachments_to_cryptup = async (attachments: Attachment[], subscription: Subscription): Promise<string[]> => {
    try {
      let pf_response: ApirFcMessagePresignFiles = await tool.api.cryptup.message_presign_files(attachments, subscription.active ? 'uuid' : null);
      const items: any[] = [];
      for(let i in pf_response.approvals) {
        items.push({base_url: pf_response.approvals[i].base_url, fields: pf_response.approvals[i].fields, attachment: attachments[i]});
      }
      await tool.api.aws.s3_upload(items, this.render_upload_progress);
      let {admin_codes} = await tool.api.cryptup.message_confirm_files(items.map((item) => item.fields.key)).validate(r => r.confirmed && r.confirmed.length === items.length);
      for(let i in attachments) {
        attachments[i].url = pf_response.approvals[i].base_url + pf_response.approvals[i].fields.key;
      }
      return admin_codes;
    } catch(error) {
      if (error && typeof error === 'object' && error.internal === 'auth') {
        throw error;
      } else {
        throw new ComposerNetworkError(error && typeof error === 'object' && error.message ? error.message : 'Some files failed to upload, please try again');
      }
    }
  };

  private render_upload_progress = (progress: number) => {
    if (this.attach.has_attachment()) {
      progress = Math.floor(progress);
      this.S.now('send_btn_span').text(`${this.BTN_SENDING} ${progress < 100 ?  `${progress}%` : ''}`);
    }
  };

  private add_uploaded_file_links_to_message_body = (plaintext: string, attachments: Attachment[]) => {
    plaintext += '\n\n';
    for(let i in attachments) {
      const size_mb = attachments[i].size / (1024 * 1024);
      const size_text = size_mb < 0.1 ? '' : ' ' + (Math.round(size_mb * 10) / 10) + 'MB';
      const link_text = 'Attachment: ' + attachments[i].name + ' (' + attachments[i].type + ')' + size_text;
      const cryptup_data = tool.str.html_attribute_encode({size: attachments[i].size, type: attachments[i].type, name: attachments[i].name});
      plaintext += '<a href="' + attachments[i].url + '" class="cryptup_file" cryptup-data="' + cryptup_data + '">' + link_text + '</a>\n';
    }
    return plaintext;
  };

  private add_reply_token_to_message_body_if_needed = async (recipients: string[], subject: string, plaintext: string, challenge: Challenge|null, subscription: Subscription): Promise<string> => {
    if (!challenge || !subscription.active) {
      return plaintext;
    }
    let response;
    try {
      response = await tool.api.cryptup.message_token().validate(r => r.token);
    } catch (message_token_error) {
      if (message_token_error.internal === 'auth') {
        if (confirm('Your FlowCrypt account information is outdated, please review your account settings.')) {
          this.app.send_message_to_main_window('subscribe_dialog', {source: 'auth_error'});
        }
        throw new ComposerResetBtnTrigger();
      } else if (message_token_error.internal === 'subscription') {
        return plaintext;
      } else {
        throw new Error('There was an error sending this message. Please try again. Let me know at human@flowcrypt.com if this happens repeatedly.\n\nmessage/token: ' + message_token_error.message);
      }
    }
    return plaintext + '\n\n' + tool.e('div', {'style': 'display: none;', 'class': 'cryptup_reply', 'cryptup-data': tool.str.html_attribute_encode({
      sender: this.supplied_from || this.get_sender_from_dom(),
      recipient: tool.arr.without_value(tool.arr.without_value(recipients, this.supplied_from || this.get_sender_from_dom()), this.account_email),
      subject: subject,
      token: response.token,
    })});
  };

  private do_encrypt_format_and_send = async (armored_pubkeys: string[], challenge: Challenge|null, plaintext: string, attachments: Attachment[], recipients: string[], subject: string, subscription: Subscription, attachment_admin_codes:string[]=[]) => {
    let encrypted = await tool.crypto.message.encrypt(armored_pubkeys, null, challenge, plaintext, null, true);
    let body = {'text/plain': encrypted.data} as SendableMessageBody;
    await this.app.storage_contact_update(recipients, {last_use: Date.now()});
    this.S.now('send_btn_span').text(this.BTN_SENDING);
    if (challenge) {
      // this is used when sending encrypted messages to people without encryption plugin, the encrypted data goes through FlowCrypt and recipients get a link
      // admin_code stays locally and helps the sender extend life of the message or delete it
      let {short, admin_code} = await tool.api.cryptup.message_upload(body['text/plain']!, subscription.active ? 'uuid' : null).validate(r => r.short && r.admin_code); // just set it above
      body = this.format_password_protected_email(short, body, armored_pubkeys);
      body = this.format_email_text_footer(body);
      await this.app.storage_add_admin_codes(short, admin_code, attachment_admin_codes);
      await this.do_send_message(tool.api.common.message(this.account_email, this.supplied_from || this.get_sender_from_dom(), recipients, subject, body, attachments, this.thread_id), plaintext);
    } else {
      body = this.format_email_text_footer(body);
      await this.do_send_message(tool.api.common.message(this.account_email, this.supplied_from || this.get_sender_from_dom(), recipients, subject, body, attachments, this.thread_id), plaintext);
    }
  };

  private do_send_message = async (message: SendableMessage, plaintext: string) => {
    for(let k in this.additional_message_headers) {
      message.headers[k] = this.additional_message_headers[k];
    }
    for(let a of message.attachments) {
      a.type = 'application/octet-stream'; // so that Enigmail+Thunderbird does not attempt to display without decrypting
    }
    if (this.S.cached('icon_pubkey').is('.active')) {
      message.attachments.push(tool.file.keyinfo_as_pubkey_attachment(await this.app.storage_get_key(this.account_email)));
    }
    let message_sent_response = await this.app.email_provider_message_send(message, this.render_upload_progress);
    const is_signed = this.S.cached('icon_sign').is('.active');
    this.app.send_message_to_main_window('notification_show', {notification: 'Your ' + (is_signed ? 'signed' : 'encrypted') + ' ' + (this.is_reply_box ? 'reply' : 'message') + ' has been sent.'});
    await this.draft_delete();
    if(this.is_reply_box) {
      this.render_reply_success(message, plaintext, message_sent_response.id);
    } else {
      this.app.close_message();
    }
  };

  private lookup_pubkey_from_db_or_keyserver_and_update_db_if_needed = async(email: string): Promise<Contact|"fail"> => {
    let [db_contact] = await this.app.storage_contact_get([email]);
    if (db_contact && db_contact.has_pgp && db_contact.pubkey) {
      return db_contact;
    } else {
      try {
        let response = await tool.api.attester.lookup_email(email) as PubkeySearchResult;
        if (response && response.email) {
          if (response.pubkey) {
            const parsed = openpgp.key.readArmored(response.pubkey);
            if (!parsed.keys[0]) {
              tool.catch.log('Dropping found but incompatible public key', {
                for: response.email,
                err: parsed.err ? ' * ' + parsed.err.join('\n * ') : null
              });
              response.pubkey = null;
            } else if (parsed.keys[0].getEncryptionKeyPacket() === null) {
              tool.catch.log('Dropping found+parsed key because getEncryptionKeyPacket===null', {
                for: response.email,
                fingerprint: tool.crypto.key.fingerprint(parsed.keys[0])
              });
              response.pubkey = null;
            }
          }
          let ks_contact = this.app.storage_contact_object(response.email, db_contact && db_contact.name ? db_contact.name : null, response.has_cryptup ? 'cryptup' : 'pgp', response.pubkey, response.attested, false, Date.now());
          this.ks_lookups_by_email[response.email] = ks_contact;
          await this.app.storage_contact_save(ks_contact);
          return ks_contact;
        } else  {
          return this.PUBKEY_LOOKUP_RESULT_FAIL;
        }
      } catch (e) {
        console.log(e);
        return this.PUBKEY_LOOKUP_RESULT_FAIL;
      }
    }
  };

  private evaluate_rendered_recipients = () => {
    let that = this;
    $('.recipients span').not('.working, .has_pgp, .no_pgp, .wrong, .attested, .failed, .expired').each(function () {
      const email_element = this;
      const email = tool.str.parse_email($(email_element).text()).email;
      if (tool.str.is_email_valid(email)) {
        that.S.now('send_btn_span').text(that.BTN_LOADING);
        that.set_input_text_height_manually_if_needed();
        that.lookup_pubkey_from_db_or_keyserver_and_update_db_if_needed(email).then(pubkey_lookup_result => {
          that.render_pubkey_result(email_element, email, pubkey_lookup_result);
        });
      } else {
        that.render_pubkey_result(email_element, email, that.PUBKEY_LOOKUP_RESULT_WRONG);
      }
    });
    this.set_input_text_height_manually_if_needed()
  };

  private get_password_validation_warning = () => {
    if (!this.S.cached('input_password').val()) {
      return 'No password entered';
    }
  };

  private show_message_password_ui_and_color_button = () => {
    this.S.cached('password_or_pubkey').css('display', 'table-row');
    this.S.cached('password_or_pubkey').css('display', 'table-row');
    if (this.S.cached('input_password').val() || this.S.cached('input_password').is(':focus')) {
      this.S.cached('password_label').css('display', 'inline-block');
      this.S.cached('input_password').attr('placeholder', '');
    } else {
      this.S.cached('password_label').css('display', 'none');
      this.S.cached('input_password').attr('placeholder', 'one time password');
    }
    if (this.get_password_validation_warning()) {
      this.S.cached('send_btn').removeClass('green').addClass('gray');
    } else {
      this.S.cached('send_btn').removeClass('gray').addClass('green');
    }
    if (this.S.cached('input_intro').is(':visible')) {
      this.S.cached('add_intro').css('display', 'none');
    } else {
      this.S.cached('add_intro').css('display', 'block');
    }
    this.set_input_text_height_manually_if_needed();
  };

  /**
   * On Firefox, we have to manage textbox height manually. Only applies to composing new messages
   * (else ff will keep expanding body element beyond frame view)
   * A decade old firefox bug is the culprit: https://bugzilla.mozilla.org/show_bug.cgi?id=202081
   *
   * @param update_reference_body_height - set to true to take a new snapshot of intended html body height
   */
  private set_input_text_height_manually_if_needed = (update_reference_body_height:boolean=false) => {
    if(!this.is_reply_box && tool.env.browser().name === 'firefox') {
      let cell_height_except_text = 0;
      this.S.cached('all_cells_except_text').each(function() {
        let cell = $(this);
        cell_height_except_text += cell.is(':visible') ? (cell.parent('tr').height() || 0) + 1 : 0; // add a 1px border height for each table row
      });
      if(update_reference_body_height || !this.reference_body_height) {
        this.reference_body_height = this.S.cached('body').height() || 605;
      }
      this.S.cached('input_text').css('height', this.reference_body_height - cell_height_except_text);
    }
  };

  private hide_message_password_ui = () => {
    this.S.cached('password_or_pubkey').css('display', 'none');
    this.S.cached('input_password').val('');
    this.S.cached('add_intro').css('display', 'none');
    this.S.cached('input_intro').text('');
    this.S.cached('intro_container').css('display', 'none');
    this.set_input_text_height_manually_if_needed();
  };

  private show_hide_password_or_pubkey_container_and_color_send_button = () => {
    this.reset_send_btn();
    this.S.cached('send_btn_note').text('');
    this.S.cached('send_btn').removeAttr('title');
    let was_previously_visible = this.S.cached('password_or_pubkey').css('display') === 'table-row';
    if (!$('.recipients span').length) {
      this.hide_message_password_ui();
      this.S.cached('send_btn').removeClass('gray').addClass('green');
    } else if (this.S.cached('icon_sign').is('.active')) {
      this.S.cached('send_btn').removeClass('gray').addClass('green');
    } else if ($('.recipients span.no_pgp').length) {
      this.show_message_password_ui_and_color_button();
    } else if ($('.recipients span.failed, .recipients span.wrong').length) {
      this.S.now('send_btn_span').text(this.BTN_WRONG_ENTRY);
      this.S.cached('send_btn').attr('title', 'Notice the recipients marked in red: please remove them and try to enter them egain.');
      this.S.cached('send_btn').removeClass('green').addClass('gray');
    } else {
      this.hide_message_password_ui();
      this.S.cached('send_btn').removeClass('gray').addClass('green');
    }
    if (this.is_reply_box) {
      if (!was_previously_visible && this.S.cached('password_or_pubkey').css('display') === 'table-row') {
        this.resize_reply_box((this.S.cached('password_or_pubkey').first().height() || 66) + 20);
      } else {
        this.resize_reply_box();
      }
    }
    this.set_input_text_height_manually_if_needed();
  };

  private respond_to_input_hotkeys = (input_to_keydown_event: KeyboardEvent) => {
    let value = this.S.cached('input_to').val();
    const keys = tool.env.key_codes();
    if (!value && input_to_keydown_event.which === keys.backspace) {
      $('.recipients span').last().remove();
    } else if (value && (input_to_keydown_event.which === keys.enter || input_to_keydown_event.which === keys.tab)) {
      this.S.cached('input_to').blur();
      if (this.S.cached('contacts').css('display') === 'block') {
        if (this.S.cached('contacts').find('.select_contact.hover').length) {
          this.S.cached('contacts').find('.select_contact.hover').click();
        } else {
          this.S.cached('contacts').find('.select_contact').first().click();
        }
      }
      this.S.cached('input_to').focus().blur();
      return false;
    }
  };

  resize_reply_box = (add_extra:number=0) => {
    if (this.is_reply_box) {
      this.S.cached('input_text').css('max-width', (this.S.cached('body').width()! - 20) + 'px'); // body should always be present
      let min_height = 0;
      let current_height = 0;
      if (this.S.cached('compose_table').is(':visible')) {
        current_height = this.S.cached('compose_table').outerHeight() || 0;
        min_height = 260;
      } else if (this.S.cached('reply_message_successful').is(':visible')) {
        current_height = this.S.cached('reply_message_successful').outerHeight() || 0;
      } else {
        current_height = this.S.cached('reply_message_prompt').outerHeight() || 0;
      }
      if (current_height !== this.last_reply_box_table_height && Math.abs(current_height - this.last_reply_box_table_height) > 2) { // more then two pixel difference compared to last time
        this.last_reply_box_table_height = current_height;
        this.app.send_message_to_main_window('set_css', {
          selector: 'iframe#' + this.frame_id,
          css: {height: (Math.max(min_height, current_height) + add_extra) + 'px'}
        });
      }
    }
  };

  private append_forwarded_message = (text: string) => {
    this.S.cached('input_text').append('<br/><br/>Forwarded message:<br/><br/>> ' + text.replace(/(?:\r\n|\r|\n)/g, '\> '));
    this.resize_reply_box();
  };

  private retrieve_decrypt_and_add_forwarded_message = (message_id: string) => {
    this.app.email_provider_extract_armored_block(message_id, (armored_message: string) => {
      tool.crypto.message.decrypt(this.account_email, armored_message, null, (result) => {
        if (result.success) {
          if (!tool.mime.resembles_message(result.content.data)) {
            this.append_forwarded_message(tool.mime.format_content_to_display(result.content.data as string, armored_message));
          } else {
            tool.mime.decode(result.content.data as string, (success, mime_parse_result) => {
              this.append_forwarded_message(tool.mime.format_content_to_display(mime_parse_result.text || mime_parse_result.html || result.content.data as string, armored_message));
            });
          }
        } else {
          this.S.cached('input_text').append('<br/>\n<br/>\n<br/>\n' + armored_message.replace(/\n/g, '<br/>\n'));
        }
      });
    }, (error_type: any, url_formatted_data_block: string) => {
      if (url_formatted_data_block) {
        this.S.cached('input_text').append('<br/>\n<br/>\n<br/>\n' + url_formatted_data_block);
      }
    });
  };

  private render_reply_message_compose_table = (method:"forward"|"reply"="reply") => {
    this.S.cached('reply_message_prompt').css('display', 'none');
    this.S.cached('compose_table').css('display', 'table');
    this.S.cached('input_to').val(this.supplied_to + (this.supplied_to ? ',' : '')); // the comma causes the last email to be get evaluated
    this.render_compose_table();
    if (this.can_read_emails) {
      this.app.email_provider_determine_reply_message_header_variables((last_message_id: string, headers: FlatHeaders) => {
        if(last_message_id && headers) {
          for(let name of Object.keys(headers)) {
            this.additional_message_headers[name] = headers[name];
          }
          if(method === 'forward') {
            this.supplied_subject = 'Fwd: ' + this.supplied_subject;
            this.retrieve_decrypt_and_add_forwarded_message(last_message_id);
          }
        }
      });
    } else {
      this.S.cached('reply_message_prompt').html('FlowCrypt has limited functionality. Your browser needs to access this conversation to reply.<br/><br/><br/><div class="button green auth_settings">Add missing permission</div><br/><br/>Alternatively, <a href="#" class="new_message_button">compose a new secure message</a> to respond.<br/><br/>');
      this.S.cached('reply_message_prompt').attr('style', 'border:none !important');
      $('.auth_settings').click(() => this.app.send_message_to_background_script('settings', { account_email: this.account_email, page: '/chrome/settings/modules/auth_denied.htm'}));
      $('.new_message_button').click(() => this.app.send_message_to_main_window('open_new_message'));
    }
    this.resize_reply_box();
  };

  private parse_and_render_recipients = () => {
    const input_to = (this.S.cached('input_to').val() as string).toLowerCase();
    if (tool.value(',').in(input_to)) {
      const emails = input_to.split(',');
      for (let i = 0; i < emails.length - 1; i++) {
        this.S.cached('input_to').siblings('.recipients').append('<span>' + emails[i] + tool.ui.spinner('green') + '</span>');
      }
    } else if (!this.S.cached('input_to').is(':focus') && input_to) {
      this.S.cached('input_to').siblings('.recipients').append('<span>' + input_to + tool.ui.spinner('green') + '</span>');
    } else {
      return;
    }
    this.S.cached('input_to').val('');
    this.resize_input_to();
    this.evaluate_rendered_recipients();
    this.set_input_text_height_manually_if_needed();
  };

  private select_contact = (email: string, from_query: ProviderContactsQuery) => {
    const possibly_bogus_recipient = $('.recipients span.wrong').last();
    const possibly_bogus_address = tool.str.parse_email(possibly_bogus_recipient.text()).email;
    const q = tool.str.parse_email(from_query.substring).email;
    if (possibly_bogus_address === q || tool.value(q).in(possibly_bogus_address)) {
      possibly_bogus_recipient.remove();
    }
    setTimeout(() => {
      if (!tool.value(email).in(this.get_recipients_from_dom())) {
        this.S.cached('input_to').val(tool.str.parse_email(email).email);
        this.parse_and_render_recipients();
        this.S.cached('input_to').focus();
      }
    }, tool.int.random(20, 100)); // desperate amount to remove duplicates. Better solution advisable.
    this.hide_contacts();
  };

  private resize_input_to = () => { // below both present in template
    this.S.cached('input_to').css('width', (Math.max(150, this.S.cached('input_to').parent().width()! - this.S.cached('input_to').siblings('.recipients').width()! - 50)) + 'px');
  };

  private remove_receiver = (element: HTMLElement) => {
    this.recipients_missing_my_key = tool.arr.without_value(this.recipients_missing_my_key, $(this).parent().text());
    $(element).parent().remove();
    this.resize_input_to();
    this.show_hide_password_or_pubkey_container_and_color_send_button();
    this.update_pubkey_icon();
  };

  private auth_contacts = (account_email: string) => {
    let last_recipient = $('.recipients span').last();
    this.S.cached('input_to').val(last_recipient.text());
    last_recipient.last().remove();
    tool.api.google.auth({account_email: account_email, scopes: tool.api.gmail.scope(['read'])} as AuthRequest, async (google_auth_response: any) => {
      if (google_auth_response.success === true) {
        this.can_read_emails = true;
        await this.search_contacts();
      } else if (google_auth_response.success === false && google_auth_response.result === 'denied' && google_auth_response.error === 'access_denied') {
        alert('FlowCrypt needs this permission to search your contacts on Gmail. Without it, FlowCrypt will keep a separate contact list.');
      } else {
        alert(Lang.general.something_went_wrong_try_again);
      }
    });
  };

  private render_search_results_loading_done = () => {
    this.S.cached('contacts').find('ul li.loading').remove();
    if (!this.S.cached('contacts').find('ul li').length) {
      this.hide_contacts();
    }
  };

  private render_search_results = (contacts: Contact[], query: ProviderContactsQuery) => {
    let that = this;
    const renderable_contacts = contacts.slice();
    renderable_contacts.sort((a, b) => (10 * (b.has_pgp - a.has_pgp)) + ((b.last_use || 0) - (a.last_use || 0) > 0 ? 1 : -1)); // have pgp on top, no pgp bottom. Sort each groups by last used
    renderable_contacts.splice(8);
    if (renderable_contacts.length > 0 || this.contact_search_in_progress) {
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
      if (this.contact_search_in_progress) {
        ul_html += '<li class="loading">loading...</li>';
      }
      this.S.cached('contacts').find('ul').html(ul_html);
      this.S.cached('contacts').find('ul li.select_contact').click(tool.ui.event.prevent(tool.ui.event.double(), function (self: HTMLElement) {
        let email = $(self).attr('email');
        if (email) {
          that.select_contact(tool.str.parse_email(email).email, query);
        }
      }));
      this.S.cached('contacts').find('ul li.select_contact').hover(function () { $(this).addClass('hover'); }, function () { $(this).removeClass('hover'); });
      this.S.cached('contacts').find('ul li.auth_contacts').click(() => this.auth_contacts(this.account_email));
      this.S.cached('contacts').css({
        display: 'block',
        top: ($('#compose > tbody > tr:first').height()! + $('#input_addresses_container > div:first').height()! + 10) + 'px', // both are in the template
      });
    } else {
      this.hide_contacts();
    }
  };

  private search_contacts = async(db_only=false) => {
    const query = {substring: tool.str.parse_email(this.S.cached('input_to').val() as string).email};
    if (query.substring !== '') {
      let contacts = await this.app.storage_contact_search(query);
      if (db_only || !this.can_read_emails) {
        this.render_search_results(contacts, query);
      } else {
        this.contact_search_in_progress = true;
        this.render_search_results(contacts, query);
        this.app.email_provider_search_contacts(query.substring, contacts, async (search_contacts_results: {new: Contact[], all: Contact[]}) => {
          if (search_contacts_results.new.length) {
            for(let contact of search_contacts_results.new) {
              let [in_db] = await this.app.storage_contact_get([contact.email]);
              if (!in_db) {
                await this.app.storage_contact_save(this.app.storage_contact_object(contact.email, contact.name, null, null, null, true, contact.date ? new Date(contact.date).getTime() : null));
              } else if (!in_db.name && contact.name) {
                const to_update = {name: contact.name};
                await this.app.storage_contact_update(contact.email, to_update);
              }
            }
            await this.search_contacts(true);
          } else {
            this.render_search_results_loading_done();
            this.contact_search_in_progress = false;
          }
        });
      }
    } else {
      this.hide_contacts(); //todo - show suggestions of most contacted ppl etc
    }
  };

  private hide_contacts = () => {
    this.S.cached('contacts').css('display', 'none');
  };

  private update_pubkey_icon = (include:boolean|null=null) => {
    if (include === null) { // decide if pubkey should be included
      if (!this.include_pubkey_toggled_manually) { // leave it as is if toggled manually before
        this.update_pubkey_icon(Boolean(this.recipients_missing_my_key.length) && !tool.value(this.supplied_from || this.get_sender_from_dom()).in(this.my_addresses_on_pks));
      }
    } else { // set icon to specific state
      if (include) {
        this.S.cached('icon_pubkey').addClass('active').attr('title', Lang.compose.include_pubkey_icon_title_active);
      } else {
        this.S.cached('icon_pubkey').removeClass('active').attr('title', Lang.compose.include_pubkey_icon_title);
      }
    }
  };

  update_footer_icon = (include:boolean|null=null) => {
    if (include === null) { // decide if pubkey should be included
      this.update_footer_icon(!!this.app.storage_get_email_footer());
    } else { // set icon to specific state
      if (include) {
        this.S.cached('icon_footer').addClass('active');
      } else {
        this.S.cached('icon_footer').removeClass('active');
      }
    }
  };

  private toggle_sign_icon = () => {
    if (!this.S.cached('icon_sign').is('.active')) {
      this.S.cached('icon_sign').addClass('active');
      this.S.cached('compose_table').addClass('sign');
      this.S.cached('title').text(Lang.compose.header_title_compose_sign);
      this.S.cached('input_password').val('');
    } else {
      this.S.cached('icon_sign').removeClass('active');
      this.S.cached('compose_table').removeClass('sign');
      this.S.cached('title').text(Lang.compose.header_title_compose_encrypt);
    }
    if (tool.value(this.S.now('send_btn_span').text()).in([this.BTN_SIGN_AND_SEND, this.BTN_ENCRYPT_AND_SEND])) {
      this.reset_send_btn();
    }
    this.show_hide_password_or_pubkey_container_and_color_send_button();
  };

  private recipient_key_id_text = (contact: Contact) => {
    if (contact.client === 'cryptup' && contact.keywords) {
      return '\n\n' + 'Public KeyWords:\n' + contact.keywords;
    } else if (contact.fingerprint) {
      return '\n\n' + 'Key fingerprint:\n' + contact.fingerprint;
    } else {
      return '';
    }
  };

  private render_pubkey_result = (email_element: HTMLElement, email: string, contact: Contact|"fail"|"wrong") => {
    if ($('body#new_message').length) {
      if (typeof contact === 'object' && contact.has_pgp) {
        let sending_address_on_pks = tool.value(this.supplied_from || this.get_sender_from_dom()).in(this.my_addresses_on_pks);
        let sending_address_on_keyserver = tool.value(this.supplied_from || this.get_sender_from_dom()).in(this.my_addresses_on_keyserver);
        if ((contact.client === 'cryptup' && !sending_address_on_keyserver) || (contact.client !== 'cryptup' && !sending_address_on_pks)) {
          // new message, and my key is not uploaded where the recipient would look for it
          this.app.does_recipient_have_my_pubkey(email, already_has => {
            if (!already_has) { // either don't know if they need pubkey (can_read_emails false), or they do need pubkey
              this.recipients_missing_my_key.push(email);
            }
            this.update_pubkey_icon();
          });
        } else {
          this.update_pubkey_icon();
        }
      } else {
        this.update_pubkey_icon();
      }
    }
    $(email_element).children('img, i').remove();
    $(email_element).append('<img src="/img/svgs/close-icon.svg" alt="close" class="close-icon svg" /><img src="/img/svgs/close-icon-black.svg" alt="close" class="close-icon svg display_when_sign" />').find('img.close-icon').click((e) => this.remove_receiver(e.target));
    if (contact === this.PUBKEY_LOOKUP_RESULT_FAIL) {
      $(email_element).attr('title', 'Loading contact information failed, please try to add their email again.');
      $(email_element).addClass("failed");
      $(email_element).children('img:visible').replaceWith('<img src="/img/svgs/repeat-icon.svg" class="repeat-icon action_retry_pubkey_fetch">');
      $(email_element).find('.action_retry_pubkey_fetch').click((e) => this.remove_receiver(e.target)); // todo - actual refresh
    } else if (contact === this.PUBKEY_LOOKUP_RESULT_WRONG) {
      $(email_element).attr('title', 'This email address looks misspelled. Please try again.');
      $(email_element).addClass("wrong");
    } else if (contact.has_pgp && tool.crypto.key.expired_for_encryption(openpgp.key.readArmored(contact.pubkey).keys[0])) {
      $(email_element).addClass("expired");
      $(email_element).prepend('<img src="/img/svgs/expired-timer.svg" class="expired-time">');
      $(email_element).attr('title', 'Does use encryption but their public key is expired. You should ask them to send you an updated public key.' + this.recipient_key_id_text(contact));
    } else if (contact.has_pgp && contact.attested) {
      $(email_element).addClass("attested");
      $(email_element).prepend('<img src="/img/svgs/locked-icon.svg" />');
      $(email_element).attr('title', 'Does use encryption, attested by CRYPTUP' + this.recipient_key_id_text(contact));
    } else if (contact.has_pgp) {
      $(email_element).addClass("has_pgp");
      $(email_element).prepend('<img src="/img/svgs/locked-icon.svg" />');
      $(email_element).attr('title', 'Does use encryption' + this.recipient_key_id_text(contact));
    } else {
      $(email_element).addClass("no_pgp");
      $(email_element).prepend('<img src="/img/svgs/locked-icon.svg" />');
      $(email_element).attr('title', 'Could not verify their encryption setup. You can encrypt the message with a password below. Alternatively, add their pubkey.');
    }
    this.show_hide_password_or_pubkey_container_and_color_send_button();
  };

  private get_recipients_from_dom = (filter:"no_pgp"|null=null): string[] => {
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
  };

  private get_sender_from_dom = (): string => {
    if (this.S.now('input_from').length) {
      return String(this.S.now('input_from').val());
    } else {
      return this.account_email;
    }
  };

  private render_reply_success = (message: SendableMessage, plaintext: string, message_id: string) => {
    let is_signed = this.S.cached('icon_sign').is('.active');
    this.app.render_reinsert_reply_box(message_id, message.headers.To.split(',').map(a => tool.str.parse_email(a).email));
    if(is_signed) {
      this.S.cached('replied_body').addClass('pgp_neutral').removeClass('pgp_secure');
    }
    this.S.cached('replied_body').css('width', ($('table#compose').width() || 500) - 30);
    this.S.cached('compose_table').css('display', 'none');
    this.S.cached('reply_message_successful').find('div.replied_from').text(this.supplied_from);
    this.S.cached('reply_message_successful').find('div.replied_to span').text(this.supplied_to);
    this.S.cached('reply_message_successful').find('div.replied_body').html(plaintext.replace(/\n/g, '<br>'));
    const email_footer = this.app.storage_get_email_footer();
    if (email_footer) {
      if(is_signed) {
        this.S.cached('replied_body').append('<br><br>' + email_footer.replace(/\n/g, '<br>'));
      } else {
        this.S.cached('reply_message_successful').find('.email_footer').html('<br>' + email_footer.replace(/\n/g, '<br>'));
      }
    }
    let t = new Date();
    let time = ((t.getHours() !== 12) ? (t.getHours() % 12) : 12) + ':' + (t.getMinutes() < 10 ? '0' : '') + t.getMinutes() + ((t.getHours() >= 12) ? ' PM ' : ' AM ') + '(0 minutes ago)';
    this.S.cached('reply_message_successful').find('div.replied_time').text(time);
    this.S.cached('reply_message_successful').css('display', 'block');
    if (message.attachments.length) {
      this.S.cached('replied_attachments').html(message.attachments.map(a => {a.message_id = message_id; return this.app.factory_attachment(a)}).join('')).css('display', 'block');
    }
    this.resize_reply_box();
  };

  private simulate_ctrl_v = (to_paste: string) => {
    const r = window.getSelection().getRangeAt(0);
    r.insertNode(r.createContextualFragment(to_paste));
  };

  private render_compose_table = () => {
    if (tool.env.browser().name === 'firefox') { // the padding cause issues in firefox where user cannot click on the message password
      this.S.cached('input_text').css({'padding-top': 0, 'padding-bottom': 0});
    }
    $('#send_btn').click(tool.ui.event.prevent(tool.ui.event.double(), () => this.extract_process_send_message()))
      .keypress(tool.ui.enter(() => this.extract_process_send_message()));
    this.S.cached('input_to').keydown((ke: any) => this.respond_to_input_hotkeys(ke));
    this.S.cached('input_to').keyup(tool.ui.event.prevent(tool.ui.event.spree('veryslow'), () => this.search_contacts()));
    this.S.cached('input_to').blur(tool.ui.event.prevent(tool.ui.event.double(), () => this.parse_and_render_recipients()));
    this.S.cached('input_text').keyup(() => this.S.cached('send_btn_note').text(''));
    this.S.cached('compose_table').click(() => this.hide_contacts());
    $('#input_addresses_container > div').click(() => {
      if (!this.S.cached('input_to').is(':focus')) {
        this.S.cached('input_to').focus();
      }
    }).children().click(() => false);
    this.resize_input_to();
    tool.time.wait(() => this.attach ? true : undefined).then(() => this.attach.initialize_attach_dialog('fineuploader', 'fineuploader_button'));
    this.S.cached('input_to').focus();
    if(this.is_reply_box) {
      if (this.supplied_to) {
        this.S.cached('input_text').focus();
        document.getElementById('input_text')!.focus(); // #input_text is in the template
        // Firefox will not always respond to initial automatic $input_text.blur()
        // Recipients may be left unrendered, as standard text, with a trailing comma
        this.parse_and_render_recipients(); // this will force firefox to render them on load
      }
      setTimeout(() => { // delay automatic resizing until a second later
        $(window).resize(tool.ui.event.prevent(tool.ui.event.spree('veryslow'), () => this.resize_reply_box()));
        this.S.cached('input_text').keyup(() => this.resize_reply_box());
      }, 1000);
    } else {
      $('.close_new_message').click(() => this.app.close_message());
      let addresses = this.app.storage_get_addresses() as string[];
      if(addresses.length > 1) {
        let input_addr_container = $('#input_addresses_container');
        input_addr_container.addClass('show_send_from').append('<select id="input_from" tabindex="-1" data-test="input-from"></select><img id="input_from_settings" src="/img/svgs/settings-icon.svg" data-test="action-open-sending-address-settings" title="Settings">');
        input_addr_container.find('#input_from_settings').click(() => this.app.render_sending_address_dialog());
        input_addr_container.find('#input_from').append(addresses.map(a => '<option value="' + a + '">' + a + '</option>').join('')).change(() => this.update_pubkey_icon());
        if(tool.env.browser().name === 'firefox') {
          input_addr_container.find('#input_from_settings').css('margin-top', '20px');
        }
      }
      this.set_input_text_height_manually_if_needed();
    }
  };

  private should_save_draft = (message_body: string) => {
    if (message_body && message_body !== this.last_draft) {
      this.last_draft = message_body;
      return true;
    } else {
      return false;
    }
  };

  private format_password_protected_email = (short_id: string, original_body: SendableMessageBody, armored_pubkeys: string[]) => {
    const decrypt_url = this.CRYPTUP_WEB_URL + '/' + short_id;
    const a = '<a href="' + tool.str.html_escape(decrypt_url) + '" style="padding: 2px 6px; background: #2199e8; color: #fff; display: inline-block; text-decoration: none;">' + Lang.compose.open_message + '</a>';
    const intro = this.S.cached('input_intro').length ? this.S.cached('input_intro').get(0).innerText.trim() : '';
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
    const html_cryptup_web_url_link = '<a href="' + tool.str.html_escape(this.CRYPTUP_WEB_URL) + '" style="color: #999;">' + tool.str.html_escape(this.CRYPTUP_WEB_URL) + '</a>';
    if (armored_pubkeys.length > 1) { // only include the message in email if a pubkey-holding person is receiving it as well
      const html_pgp_message = original_body['text/html'] ? original_body['text/html'] : (original_body['text/plain'] || '').replace(this.CRYPTUP_WEB_URL, html_cryptup_web_url_link).replace(/\n/g, '<br>\n');
      html.push('<div style="color: #999;">' + html_pgp_message + '</div>');
      text.push(original_body['text/plain']);
    }
    html.push('</div>');
    return {'text/plain': text.join('\n'), 'text/html': html.join('\n')};
  };

  private format_email_text_footer = (original_body: SendableMessageBody): SendableMessageBody => {
    const email_footer = this.app.storage_get_email_footer();
    const body = {'text/plain': original_body['text/plain'] + (email_footer ? '\n' + email_footer : '')} as SendableMessageBody;
    if (typeof original_body['text/html'] !== 'undefined') {
      body['text/html'] = original_body['text/html'] + (email_footer ? '<br>\n' + email_footer.replace(/\n/g, '<br>\n') : '');
    }
    return body;
  };

  static default_app_functions = (): ComposerAppFunctionsInterface => {
    return {
      send_message_to_main_window: (channel: string, data: Dict<Serializable>) => null,
      can_read_email: () => false,
      does_recipient_have_my_pubkey: (their_email: string, callback: (has_my_pubkey: boolean|undefined) => void) => callback(false),
      storage_get_addresses: () => [],
      storage_get_addresses_pks: () => [],
      storage_get_addresses_keyserver: () => [],
      storage_get_email_footer: () => null,
      storage_set_email_footer: () => Promise.resolve(),
      storage_get_hide_message_password: () => false,
      storage_get_subscription: () => Promise.resolve(new Subscription(null)),
      storage_set_draft_meta: () => Promise.resolve(),
      storage_get_key: () => { throw new Error('storage_get_key not implemented'); },
      storage_passphrase_get: () => Promise.resolve(null),
      storage_add_admin_codes: (short_id: string, message_admin_code: string, attachment_admin_codes: string[]) => Promise.resolve(),
      storage_contact_get: (email: string[]) => Promise.resolve([]),
      storage_contact_update: (email: string[]|string, update: ContactUpdate) => Promise.resolve(),
      storage_contact_save: (contact: Contact) => Promise.resolve(),
      storage_contact_search: (query: DbContactFilter) => Promise.resolve([]),
      storage_contact_object: Store.db_contact_object,
      email_provider_draft_get: (draft_id: string) => Promise.resolve(),
      email_provider_draft_create: (mime_message: string) => Promise.reject(null),
      email_provider_draft_update: (draft_id: string, mime_message: string) => Promise.resolve(),
      email_provider_draft_delete: (draft_id: string) => Promise.resolve(),
      email_provider_message_send: (message: SendableMessage, render_upload_progress: ApiCallProgressCallback) => Promise.reject({message: 'not implemented'}),
      email_provider_search_contacts: (query: string, known_contacts: Contact[], multi_cb: Callback) => multi_cb({new: [], all: []}),
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
    };
  };

}
