/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

interface ComposerAppFunctionsInterface {
    can_read_email: () => boolean;
    does_recipient_have_my_pubkey: (email: string) => Promise<boolean|undefined>;
    storage_get_addresses: () => string[];
    storage_get_addresses_pks: () => string[];
    storage_get_addresses_keyserver: () => string[];
    storage_get_email_footer: () => string|null;
    storage_set_email_footer: (footer: string|null) => Promise<void>;
    storage_get_hide_message_password: () => boolean;
    storage_get_subscription: () => Promise<Subscription>;
    storage_get_key: (sender_email: string) => Promise<KeyInfo>;
    storage_set_draft_meta: (store_if_true: boolean, draft_id: string, thread_id: string, recipients: string[]|null, subject: string|null) => Promise<void>;
    storage_passphrase_get: () => Promise<string|null>;
    storage_add_admin_codes: (short_id: string, message_admin_code: string, attachment_admin_codes: string[]) => Promise<void>;
    storage_contact_get: (email: string[]) => Promise<(Contact|null)[]>;
    storage_contact_update: (email: string|string[], update: ContactUpdate) => Promise<void>;
    storage_contact_save:  (contact: Contact) =>  Promise<void>;
    storage_contact_search: (query: ProviderContactsQuery) => Promise<Contact[]>;
    storage_contact_object: (email: string, name: string|null, client: string|null, pubkey: string|null, attested: boolean|null, pending_lookup:boolean|number, last_use: number|null) => Contact;
    email_provider_draft_get: (draft_id: string) => Promise<ApirGmailDraftGet>;
    email_provider_draft_create: (mime_message: string) => Promise<ApirGmailDraftCreate>;
    email_provider_draft_update: (draft_id: string, mime_message: string) => Promise<ApirGmailDraftUpdate>;
    email_provider_draft_delete: (draft_id: string) => Promise<ApirGmailDraftDelete>;
    email_provider_message_send: (message: SendableMessage, render_upload_progress: ApiCallProgressCallback) => Promise<ApirGmailMessageSend>;
    email_provider_search_contacts: (query: string, known_contacts: Contact[], multi_cb: (r: {new: Contact[], all: Contact[]}) => void) => void;
    email_provider_determine_reply_message_header_variables: () => Promise<undefined|{last_message_id: string, headers: {'In-Reply-To': string, 'References': string}}>;
    email_provider_extract_armored_block: (message_id: string) => Promise<string>;
    send_message_to_main_window: (channel: string, data?: object) => void;
    send_message_to_background_script: (channel: string, data?: object) => void;
    render_footer_dialog: () => void;
    render_add_pubkey_dialog: (emails: string[]) => void;
    render_reinsert_reply_box: (last_message_id: string, recipients: string[]) => void;
    render_help_dialog: () => void;
    render_sending_address_dialog: () => void;
    factory_attachment: (attachment: Attachment) => string;
    close_message: () => void;
}

class ComposerUserError extends Error {}
class ComposerNotReadyError extends ComposerUserError {}
class ComposerNetworkError extends Error {}
class ComposerResetBtnTrigger extends Error {}

class Composer {

  private S = Ui.build_jquery_selectors({
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
    prompt: 'div#initial_prompt',
    reply_message_successful: '#reply_message_successful_container',
    replied_body: '.replied_body',
    replied_attachments: '#attachments',
    contacts: '#contacts',
    input_addresses_container_outer: '#input_addresses_container',
    input_addresses_container_inner: '#input_addresses_container > div:first',
  });

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
  private FC_WEB_URL = 'https://flowcrypt.com'; // todo - should use Api.url()

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
    this.save_draft_interval = window.setInterval(() => this.draft_save(), this.SAVE_DRAFT_FREQUENCY);

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
    this.initialize_compose_box(variables).catch(tool.catch.rejection);
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
            get_advanced += '\n\nClick ok to see subscribe options.';
          }
          if (subscription.method === 'group') {
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
        size_mb,
        size: size_mb * 1024 * 1024,
        count: 10,
        oversize: (combined_size: number) => {
          alert('Combined attachment size is limited to 25 MB. The last file brings it to ' + Math.ceil(combined_size / (1024 * 1024)) + ' MB.');
        },
      };
    }
  }

  private handle_errors = (could_not_do_what: string): BrowserEventErrorHandler => {
    return {
      network: () => alert(`Could not ${could_not_do_what} (network error). Please try again.`),
      auth_popup: () => this.app.send_message_to_main_window('notification_show_auth_popup_needed', {account_email: this.account_email}),
      auth: () => {
        if (confirm(`Could not ${could_not_do_what}.\nYour FlowCrypt account information is outdated, please review your account settings.`)) {
          this.app.send_message_to_main_window('subscribe_dialog', {source: 'auth_error'});
        }
      },
      other: (e: any) => {
        // todo - add an alert that action could not be finished
        // alert(`Could not ${could_not_do_what} (unknown error). If this repeats, please contact human@flowcrypt.com.\n\n(${String(e)})`);
        if(e instanceof Error) {
          e.stack = (e.stack || '') + `\n\n[compose action: ${could_not_do_what}]`;
        } else if (typeof e === 'object' && e && typeof e.stack === 'undefined') {
          try {
            e.stack = `[compose action: ${could_not_do_what}]`;
          } catch (e) {
            // no need
          }
        }
        tool.catch.handle_exception(e);
      },
    };
  }

  private initialize_actions = () => {
    this.S.cached('icon_pubkey').attr('title', Lang.compose.include_pubkey_icon_title);
    this.S.cached('input_password').keyup(Ui.event.prevent(Ui.event.spree(), () => this.show_hide_password_or_pubkey_container_and_color_send_button()));
    this.S.cached('input_password').focus(() => this.show_hide_password_or_pubkey_container_and_color_send_button());
    this.S.cached('input_password').blur(() => this.show_hide_password_or_pubkey_container_and_color_send_button());
    this.S.cached('add_their_pubkey').click(Ui.event.handle(() => {
      let no_pgp_emails = this.get_recipients_from_dom('no_pgp');
      this.app.render_add_pubkey_dialog(no_pgp_emails);
      clearInterval(this.added_pubkey_db_lookup_interval); // todo - get rid of setInterval. just supply tab_id and wait for direct callback
      this.added_pubkey_db_lookup_interval = window.setInterval(async () => {
        for (let email of no_pgp_emails) {
          let [contact] = await this.app.storage_contact_get([email]);
          if (contact && contact.has_pgp) {
            $("span.recipients span.no_pgp:contains('" + email + "') i").remove();
            $("span.recipients span.no_pgp:contains('" + email + "')").removeClass('no_pgp');
            clearInterval(this.added_pubkey_db_lookup_interval);
            await this.evaluate_rendered_recipients();
          }
        }
      }, 1000);
    }, this.handle_errors('add recipient public key')));
    this.S.cached('add_intro').click(Ui.event.handle(target => {
      $(target).css('display', 'none');
      this.S.cached('intro_container').css('display', 'table-row');
      this.S.cached('input_intro').focus();
      this.set_input_text_height_manually_if_needed();
    }, this.handle_errors(`add intro`)));
    this.S.cached('icon_help').click(Ui.event.handle(() => this.app.render_help_dialog(), this.handle_errors(`render help dialog`)));
    this.S.now('input_from').change(() => {
      // when I change input_from, I should completely re-evaluate: update_pubkey_icon() and render_pubkey_result()
      // because they might not have a pubkey for the alternative address, and might get confused
    });
    this.S.cached('input_text').get(0).onpaste = async e => {
      let clipboard_html_data = e.clipboardData.getData('text/html');
      if (clipboard_html_data) {
        e.preventDefault();
        e.stopPropagation();
        let sanitized = Xss.html_sanitize_and_strip_all_tags(clipboard_html_data, '<br>');
        this.simulate_ctrl_v(sanitized);
      }
    };
    this.S.cached('icon_pubkey').click(Ui.event.handle(target => {
      this.include_pubkey_toggled_manually = true;
      this.update_pubkey_icon(!$(target).is('.active'));
    }, this.handle_errors(`set/unset pubkey attachment`)));
    this.S.cached('icon_footer').click(Ui.event.handle(target => {
      if (!$(target).is('.active')) {
        this.app.render_footer_dialog();
      } else {
        this.update_footer_icon(!$(target).is('.active'));
      }
    }, this.handle_errors(`change footer`)));
    $('.delete_draft').click(Ui.event.handle(async () => {
      await this.draft_delete();
      this.app.close_message();
    }, this.handle_errors('delete draft')));
    this.S.cached('body').bind({drop: Ui.event.stop(), dragover: Ui.event.stop()}); // prevents files dropped out of the intended drop area to screw up the page
    this.S.cached('icon_sign').click(Ui.event.handle(() => this.toggle_sign_icon(), this.handle_errors(`enable/disable signing`)));
  }

  show_subscribe_dialog_and_wait_for_response: BrowserMessageHandler = (data, sender, respond: (subscribed: boolean) => void) => {
    this.subscribe_result_listener = respond;
    this.app.send_message_to_main_window('subscribe_dialog', {subscribe_result_tab_id: this.tab_id});
  }

  private initialize_compose_box = async (variables: UrlParams) => {
    if(this.is_reply_box) {
      this.S.cached('header').remove();
      this.S.cached('subject').remove();
      this.S.cached('contacts').css('top', '39px');
      this.S.cached('compose_table').css({'border-bottom': '1px solid #cfcfcf', 'border-top': '1px solid #cfcfcf'});
      this.S.cached('input_text').css('overflow-y', 'hidden');
    }
    if (this.draft_id) {
      await this.initial_draft_load();
    } else {
      if (this.is_reply_box) {
        if (variables.skip_click_prompt) {
          await this.render_reply_message_compose_table();
        } else {
          $('#reply_click_area,#a_reply,#a_reply_all,#a_forward').click(Ui.event.handle(async target => {
            if ($(target).attr('id') === 'a_reply') {
              this.supplied_to = this.supplied_to.split(',')[0];
            } else if ($(target).attr('id') === 'a_forward') {
              this.supplied_to = '';
            }
            await this.render_reply_message_compose_table((($(target).attr('id') || '').replace('a_', '') || 'reply') as 'reply'|'forward');
          }, this.handle_errors(`activate repply box`)));
        }
      }
    }
    if (this.is_reply_box) {
      if (!variables.skip_click_prompt && !this.draft_id) {
        this.S.cached('prompt').css('display', 'block');
      }
      $(document).ready(() => this.resize_reply_box());
    } else {
      this.S.cached('body').css('overflow', 'hidden'); // do not enable this for replies or automatic resize won't work
      await this.render_compose_table();
    }
    $('body').attr('data-test-state', 'ready');  // set as ready so that automated tests can evaluate results
  }

  private initial_draft_load = async () => {
    if (this.is_reply_box) {
      Ui.sanitize_render(this.S.cached('prompt'), `Loading draft.. ${Ui.spinner('green')}`);
    }
    try {
      let draft_get_response = await this.app.email_provider_draft_get(this.draft_id);
      let parsed_message = await Mime.decode(Str.base64url_decode(draft_get_response.message.raw!));
      let armored = tool.crypto.armor.clip(parsed_message.text || tool.crypto.armor.strip(parsed_message.html || '') || '');
      if (armored) {
        this.S.cached('input_subject').val(parsed_message.headers.subject || '');
        await this.decrypt_and_render_draft(armored, Mime.headers_to_from(parsed_message));
      } else {
        console.info('Api.gmail.draft_get Mime.decode else {}');
        if (this.is_reply_box) {
          await this.render_reply_message_compose_table();
        }
      }
    } catch (e) {
      if(Api.error.is_network_error(e)) {
        Ui.sanitize_render('body', `Failed to load draft. ${Ui.retry_link()}`);
      } else if (Api.error.is_auth_popup_needed(e)) {
        this.app.send_message_to_main_window('notification_show_auth_popup_needed', {account_email: this.account_email});
        Ui.sanitize_render('body', `Failed to load draft - FlowCrypt needs to be re-connected to Gmail. ${Ui.retry_link()}`);
      } else if (this.is_reply_box && Api.error.is_not_found(e)) {
        tool.catch.log('about to reload reply_message automatically: get draft 404', this.account_email);
        await tool.time.sleep(500);
        await this.app.storage_set_draft_meta(false, this.draft_id, this.thread_id, null, null);
        console.info('Above red message means that there used to be a draft, but was since deleted. (not an error)');
        window.location.reload();
      } else {
        console.info('Api.gmail.draft_get success===false');
        tool.catch.handle_exception(e);
        if (this.is_reply_box) {
          await this.render_reply_message_compose_table();
        }
      }
    }
  }

  process_subscribe_result = (new_subscription: Subscription) => {
    if (typeof this.subscribe_result_listener === 'function') {
      this.subscribe_result_listener(new_subscription.active || false);
      this.subscribe_result_listener = undefined;
    }
  }

  private reset_send_btn = (delay:number|null=null) => {
    const do_reset = () => Ui.sanitize_render(this.S.cached('send_btn'), '<i class=""></i><span tabindex="4">' + (this.S.cached('icon_sign').is('.active') ? this.BTN_SIGN_AND_SEND : this.BTN_ENCRYPT_AND_SEND) + '</span>');
    if (this.button_update_timeout !== null) {
      clearTimeout(this.button_update_timeout);
    }
    if (!delay) {
      do_reset();
    } else {
      setTimeout(do_reset, delay);
    }
  }

  passphrase_entry = (entered: boolean) => {
    if (!entered) {
      this.reset_send_btn();
      clearInterval(this.passphrase_interval);
    }
  }

  private draft_save = async (force_save:boolean=false) => {
    if (this.should_save_draft(this.S.cached('input_text').text()) || force_save) {
      this.draft_save_in_progress = true;
      this.S.cached('send_btn_note').text('Saving');
      let primary_ki = await this.app.storage_get_key(this.account_email);
      let encrypted = await tool.crypto.message.encrypt([primary_ki.public], null, null, this.extract_as_text('input_text'), null, true) as OpenPGP.EncryptArmorResult;
      let body;
      if (this.thread_id) { // replied message
        body = '[cryptup:link:draft_reply:' + this.thread_id + ']\n\n' + encrypted.data;
      } else if (this.draft_id) {
        body = '[cryptup:link:draft_compose:' + this.draft_id + ']\n\n' + encrypted.data;
      } else {
        body = encrypted.data;
      }
      let subject = String(this.S.cached('input_subject').val() || this.supplied_subject || 'FlowCrypt draft');
      let mime_message = await Mime.encode(body as string, {To: this.get_recipients_from_dom(), From: this.supplied_from || this.get_sender_from_dom(), Subject: subject} as RichHeaders, []);
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
      } catch (e) {
        if(Api.error.is_network_error(e)) {
          this.S.cached('send_btn_note').text('Not saved (network)');
        } else if (Api.error.is_auth_popup_needed(e)) {
          this.app.send_message_to_main_window('notification_show_auth_popup_needed', {account_email: this.account_email});
          this.S.cached('send_btn_note').text('Not saved (reconnect)');
        } else {
          tool.catch.handle_exception(e);
          this.S.cached('send_btn_note').text('Not saved');
        }
      }
      this.draft_save_in_progress = false;
    }
  }

  private draft_delete = async () => {
    clearInterval(this.save_draft_interval);
    await tool.time.wait(() => !this.draft_save_in_progress ? true : undefined);
    if (this.draft_id) {
      await this.app.storage_set_draft_meta(false, this.draft_id, this.thread_id, null, null);
      try {
        await this.app.email_provider_draft_delete(this.draft_id);
      } catch(e) {
        if (Api.error.is_auth_popup_needed(e)) {
          this.app.send_message_to_main_window('notification_show_auth_popup_needed', {account_email: this.account_email});
        } else if(!Api.error.is_network_error(e)) {
          tool.catch.handle_exception(e);
        }
      }
    }
  }

  private decrypt_and_render_draft = async (encrypted_draft: string, headers: FromToHeaders) => {
    let passphrase = await this.app.storage_passphrase_get();
    if (passphrase !== null) {
      let result = await tool.crypto.message.decrypt(this.account_email, encrypted_draft);
      if (result.success) {
        this.S.cached('prompt').css({display: 'none'});
        Ui.sanitize_render(this.S.cached('input_text'), await Xss.html_sanitize_keep_basic_tags(result.content.text!));
        if (headers && headers.to && headers.to.length) {
          this.S.cached('input_to').focus();
          this.S.cached('input_to').val(headers.to.join(','));
          this.S.cached('input_text').focus();
        }
        if (headers && headers.from) {
          this.S.now('input_from').val(headers.from);
        }
        this.set_input_text_height_manually_if_needed();
      } else {
        this.set_input_text_height_manually_if_needed();
      }
      if(this.is_reply_box) {
        await this.render_reply_message_compose_table();
      }
    } else {
      let prompt_text = `Waiting for <a href="#" class="action_open_passphrase_dialog">pass phrase</a> to open draft..`;
      if(this.is_reply_box) {
        Ui.sanitize_render(this.S.cached('prompt'), prompt_text).css({display: 'block'});
        this.resize_reply_box();
      } else {
        Ui.sanitize_render(this.S.cached('prompt'), `${prompt_text}<br><br><a href="#" class="action_close">close</a>`).css({display: 'block', height: '100%'});
      }
      this.S.cached('prompt').find('a.action_open_passphrase_dialog').click(Ui.event.handle(target => this.app.send_message_to_main_window('passphrase_dialog', {type: 'draft', longids: 'primary'})));
      this.S.cached('prompt').find('a.action_close').click(Ui.event.handle(target => this.app.close_message()));
      await this.when_master_passphrase_entered();
      await this.decrypt_and_render_draft(encrypted_draft, headers);
    }
  }

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
  }

  private collect_all_available_public_keys = async (account_email: string, recipients: string[]): Promise<{armored_pubkeys: string[], emails_without_pubkeys: string[]}> => {
    let contacts = await this.app.storage_contact_get(recipients);
    let {public: armored_public_key} = await this.app.storage_get_key(account_email);
    const armored_pubkeys = [armored_public_key];
    const emails_without_pubkeys = [];
    for (let i of contacts.keys()) {
      let contact = contacts[i];
      if (contact && contact.has_pgp && contact.pubkey) {
        armored_pubkeys.push(contact.pubkey);
      } else if (contact && this.ks_lookups_by_email[contact.email] && this.ks_lookups_by_email[contact.email].pubkey) {
        armored_pubkeys.push(this.ks_lookups_by_email[contact.email].pubkey!); // checked !null right above. Null evaluates to false.
      } else {
        emails_without_pubkeys.push(recipients[i]);
      }
    }
    return {armored_pubkeys, emails_without_pubkeys};
  }

  private throw_if_form_not_ready = (recipients: string[]): void => {
    if (tool.value(this.S.now('send_btn_span').text().trim()).in([this.BTN_ENCRYPT_AND_SEND, this.BTN_SIGN_AND_SEND]) && recipients && recipients.length) {
      return; // all good
    }
    if (this.S.now('send_btn_span').text().trim() === this.BTN_WRONG_ENTRY) {
      throw new ComposerUserError('Please re-enter recipients marked in red color.');
    }
    if (!recipients || !recipients.length) {
      throw new ComposerUserError('Please add a recipient first');
    }
    throw new ComposerNotReadyError('Still working, please wait.');
  }

  private throw_if_form_values_invalid = (recipients: string[], emails_without_pubkeys: string[], subject: string, plaintext: string, challenge: Challenge|null) => {
    const is_encrypt = !this.S.cached('icon_sign').is('.active');
    if (!recipients.length) {
      throw new ComposerUserError('Please add receiving email address.');
    }
    if (is_encrypt && emails_without_pubkeys.length && (!challenge || !challenge.answer)) {
      this.S.cached('input_password').focus();
      throw new ComposerUserError('Some recipients don\'t have encryption set up. Please add a password.');
    }
    if (!((plaintext !== '' || window.confirm('Send empty message?')) && (subject !== '' || window.confirm('Send without a subject?')))) {
      throw new ComposerResetBtnTrigger();
    }
  }

  private handle_send_error(e: Error|StandardError) {
    if(Api.error.is_network_error(e)) {
      alert('Could not send message due to network error. Please check your internet connection and try again.');
    } else if(Api.error.is_auth_popup_needed(e)) {
      this.app.send_message_to_main_window('notification_show_auth_popup_needed', {account_email: this.account_email});
      alert('Could not send message because FlowCrypt needs to be re-connected to google account.');
    } else if (Api.error.is_auth_error(e)) {
      if (confirm('Your FlowCrypt account information is outdated, please review your account settings.')) {
        this.app.send_message_to_main_window('subscribe_dialog', {source: 'auth_error'});
      }
    } else if(Api.error.is_bad_request(e)) {
      if(confirm(`Google returned an error when sending message. Please help us improve FlowCrypt by reporting the error to us.`)) {
        let page = '/chrome/settings/modules/help.htm';
        let page_url_params = {bug_report: Extension.prepare_bug_report('composer: send: bad request', {}, e)};
        this.app.send_message_to_background_script('settings', {account_email: this.account_email, page, page_url_params});
      }
    } else if (typeof e === 'object' && e.hasOwnProperty('internal')) {
      tool.catch.report('StandardError | failed to send message', e);
      alert(`Failed to send message: [${(e as StandardError).internal}] ${e.message}`);
    } else if(e instanceof ComposerUserError) {
      alert(`Could not send message: ${e.message}`);
    } else {
      if(!(e instanceof ComposerResetBtnTrigger || e instanceof UnreportableError || e instanceof ComposerNotReadyError)) {
        if(e instanceof Error) {
          tool.catch.handle_exception(e);
        } else {
          tool.catch.report('Thrown object | failed to send message', e);
        }
        alert(`Failed to send message due to: ${e.message}`);
      }
    }
    if (!(e instanceof ComposerNotReadyError)) {
      this.reset_send_btn(100);
    }
  }

  private extract_as_text = (element_selector: 'input_text'|'input_intro') => {
    return Xss.html_unescape(Xss.html_sanitize_and_strip_all_tags(this.S.cached(element_selector)[0].innerHTML, '\n'));
  }

  private extract_process_send_message = async () => {
    try {
      const recipients = this.get_recipients_from_dom();
      const subject = this.supplied_subject || String($('#input_subject').val()); // replies have subject in url params
      const plaintext = this.extract_as_text('input_text');
      this.throw_if_form_not_ready(recipients);
      this.S.now('send_btn_span').text('Loading');
      Ui.sanitize_render(this.S.now('send_btn_i'), Ui.spinner('white'));
      this.S.cached('send_btn_note').text('');
      let subscription = await this.app.storage_get_subscription();
      let {armored_pubkeys, emails_without_pubkeys} = await this.collect_all_available_public_keys(this.account_email, recipients);
      const challenge = emails_without_pubkeys.length ? {answer: String(this.S.cached('input_password').val())} : null;
      this.throw_if_form_values_invalid(recipients, emails_without_pubkeys, subject, plaintext, challenge);
      if (this.S.cached('icon_sign').is('.active')) {
        await this.sign_and_send(recipients, armored_pubkeys, subject, plaintext, challenge, subscription);
      } else {
        await this.encrypt_and_send(recipients, armored_pubkeys, subject, plaintext, challenge, subscription);
      }
    } catch (e) {
      this.handle_send_error(e);
    }
  }

  private encrypt_and_send = async (recipients: string[], armored_pubkeys: string[], subject: string, plaintext: string, challenge: Challenge|null, subscription: Subscription) => {
    this.S.now('send_btn_span').text('Encrypting');
    plaintext = await this.add_reply_token_to_message_body_if_needed(recipients, subject, plaintext, challenge, subscription);
    let attachments = await this.attach.collect_and_encrypt_attachments(armored_pubkeys, challenge);
    if (attachments.length && challenge) { // these will be password encrypted attachments
      this.button_update_timeout = window.setTimeout(() => this.S.now('send_btn_span').text(this.BTN_SENDING), 500);
      let attachment_admin_codes = await this.upload_attachments_to_fc(attachments, subscription);
      plaintext = this.add_uploaded_file_links_to_message_body(plaintext, attachments);
      await this.do_encrypt_format_and_send(armored_pubkeys, challenge, plaintext, [], recipients, subject, subscription, attachment_admin_codes);
    } else {
      await this.do_encrypt_format_and_send(armored_pubkeys, challenge, plaintext, attachments, recipients, subject, subscription);
    }
  }

  private sign_and_send = async (recipients: string[], armored_pubkeys: string[], subject: string, plaintext: string, challenge: Challenge|null, subscription: Subscription) => {
    this.S.now('send_btn_span').text('Signing');
    let [primary_k] = await Store.keys_get(this.account_email, ['primary']);
    if (primary_k) {
      const prv = openpgp.key.readArmored(primary_k.private).keys[0];
      let passphrase = await this.app.storage_passphrase_get();
      if (passphrase === null && !prv.isDecrypted()) {
        this.app.send_message_to_main_window('passphrase_dialog', {type: 'sign', longids: 'primary'});
        if ((await this.when_master_passphrase_entered(60)) !== null) { // pass phrase entered
          await this.sign_and_send(recipients, armored_pubkeys, subject, plaintext, challenge, subscription);
        } else { // timeout - reset - no passphrase entered
          clearInterval(this.passphrase_interval);
          this.reset_send_btn();
        }
      } else {
        let MimeCodec = (window as BrowserWidnow)['emailjs-mime-codec'];
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

        if(!prv.isDecrypted()) {
          await tool.crypto.key.decrypt(prv, [passphrase!]); // checked !== null above
        }
        let signed_data = await tool.crypto.message.sign(prv, this.format_email_text_footer({'text/plain': plaintext})['text/plain'] || '');
        let attachments = await this.attach.collect_attachments(); // todo - not signing attachments
        this.app.storage_contact_update(recipients, {last_use: Date.now()}).catch(tool.catch.rejection);
        this.S.now('send_btn_span').text(this.BTN_SENDING);
        const body = {'text/plain': signed_data};
        await this.do_send_message(await Api.common.message(this.account_email, this.supplied_from || this.get_sender_from_dom(), recipients, subject, body, attachments, this.thread_id), plaintext);
      }
    } else {
      alert('Cannot sign the message because your plugin is not correctly set up. Email human@flowcrypt.com if this persists.');
      this.reset_send_btn();
    }
  }

  private upload_attachments_to_fc = async (attachments: Attachment[], subscription: Subscription): Promise<string[]> => {
    try {
      let pf_response: ApirFcMessagePresignFiles = await Api.fc.message_presign_files(attachments, subscription.active ? 'uuid' : null);
      const items: any[] = [];
      for (let i of pf_response.approvals.keys()) {
        items.push({base_url: pf_response.approvals[i].base_url, fields: pf_response.approvals[i].fields, attachment: attachments[i]});
      }
      await Api.aws.s3_upload(items, this.render_upload_progress);
      let {admin_codes, confirmed} = await Api.fc.message_confirm_files(items.map((item) => item.fields.key));
      if(!confirmed || confirmed.length !== items.length) {
        throw new Error('Attachments did not upload properly, please try again');
      }
      for (let i of attachments.keys()) {
        attachments[i].url = pf_response.approvals[i].base_url + pf_response.approvals[i].fields.key;
      }
      return admin_codes;
    } catch (e) {
      if (Api.error.is_auth_error(e)) {
        throw e;
      } else {
        throw new ComposerNetworkError(e && typeof e === 'object' && e.message ? e.message : 'Some files failed to upload, please try again');
      }
    }
  }

  private render_upload_progress = (progress: number) => {
    if (this.attach.has_attachment()) {
      progress = Math.floor(progress);
      this.S.now('send_btn_span').text(`${this.BTN_SENDING} ${progress < 100 ?  `${progress}%` : ''}`);
    }
  }

  private add_uploaded_file_links_to_message_body = (plaintext: string, attachments: Attachment[]) => {
    plaintext += '\n\n';
    for (let a of attachments) {
      const size_mb = a.length / (1024 * 1024);
      const size_text = size_mb < 0.1 ? '' : ` ${(Math.round(size_mb * 10) / 10)}MB`;
      const link_text = `Attachment: ${a.name} (${a.type})${size_text}`;
      const cryptup_data = Str.html_attribute_encode({size: a.length, type: a.type, name: a.name});
      plaintext += `<a href="${a.url}" class="cryptup_file" cryptup-data="${cryptup_data}">${link_text}</a>\n`;
    }
    return plaintext;
  }

  private add_reply_token_to_message_body_if_needed = async (recipients: string[], subject: string, plaintext: string, challenge: Challenge|null, subscription: Subscription): Promise<string> => {
    if (!challenge || !subscription.active) {
      return plaintext;
    }
    let response;
    try {
      response = await Api.fc.message_token();
    } catch (message_token_error) {
      if (Api.error.is_auth_error(message_token_error)) {
        if (confirm('Your FlowCrypt account information is outdated, please review your account settings.')) {
          this.app.send_message_to_main_window('subscribe_dialog', {source: 'auth_error'});
        }
        throw new ComposerResetBtnTrigger();
      } else if (Api.error.is_standard_error(message_token_error, 'subscription')) {
        return plaintext;
      } else {
        throw new Error('There was an error sending this message. Please try again. Let me know at human@flowcrypt.com if this happens repeatedly.\n\nmessage/token: ' + message_token_error.message);
      }
    }
    return plaintext + '\n\n' + tool.e('div', {'style': 'display: none;', 'class': 'cryptup_reply', 'cryptup-data': Str.html_attribute_encode({
      sender: this.supplied_from || this.get_sender_from_dom(),
      recipient: tool.arr.without_value(tool.arr.without_value(recipients, this.supplied_from || this.get_sender_from_dom()), this.account_email),
      subject,
      token: response.token,
    })});
  }

  private encrypt_message_as_of_date_if_some_are_expired = async (armored_pubkeys: string[]): Promise<Date|null> => {
    let usable_until: number[] = [];
    let usable_from: number[] = [];
    for(let armored_pubkey of armored_pubkeys) {
      let k = openpgp.key.readArmored(armored_pubkey).keys[0];
      let one_second_before_expiration = await tool.crypto.key.date_before_expiration(k);
      usable_from.push(k.getCreationTime().getTime());
      if(one_second_before_expiration !== null) { // key does expire
        usable_until.push(one_second_before_expiration.getTime());
      }
    }
    if(!usable_until.length) { // none of the keys expire
      return null;
    }
    if(Math.max(...usable_until) > Date.now()) { // all keys either don't expire or expire in the future
      return null;
    }
    let usable_time_from = Math.max(...usable_from);
    let usable_time_until = Math.min(...usable_until);
    if(usable_time_from > usable_time_until) { // used public keys have no intersection of usable dates
      alert('The public key of one of your recipients has been expired for too long.\n\nPlease ask the recipient to send you an updated Public Key.');
      throw new ComposerResetBtnTrigger();
    }
    if(!confirm('The public key of one of your recipients is expired.\n\nThe right thing to do is to ask the recipient to send you an updated Public Key.\n\nAre you sure you want to encrypt this message for an expired public key? (NOT RECOMMENDED)')) {
      throw new ComposerResetBtnTrigger();
    }
    return new Date(usable_time_until); // latest date none of the keys were expired
  }

  private do_encrypt_format_and_send = async (armored_pubkeys: string[], challenge: Challenge|null, plaintext: string, attachments: Attachment[], recipients: string[], subject: string, subscription: Subscription, attachment_admin_codes:string[]=[]) => {
    let encrypt_as_of_date = await this.encrypt_message_as_of_date_if_some_are_expired(armored_pubkeys);
    let encrypted = await tool.crypto.message.encrypt(armored_pubkeys, null, challenge, plaintext, null, true, encrypt_as_of_date) as OpenPGP.EncryptArmorResult;
    let body = {'text/plain': encrypted.data} as SendableMessageBody;
    await this.app.storage_contact_update(recipients, {last_use: Date.now()});
    this.S.now('send_btn_span').text(this.BTN_SENDING);
    if (challenge) {
      // this is used when sending encrypted messages to people without encryption plugin, the encrypted data goes through FlowCrypt and recipients get a link
      // admin_code stays locally and helps the sender extend life of the message or delete it
      let {short, admin_code} = await Api.fc.message_upload(body['text/plain']!, subscription.active ? 'uuid' : null);
      body = this.format_password_protected_email(short, body, armored_pubkeys);
      body = this.format_email_text_footer(body);
      await this.app.storage_add_admin_codes(short, admin_code, attachment_admin_codes);
      await this.do_send_message(await Api.common.message(this.account_email, this.supplied_from || this.get_sender_from_dom(), recipients, subject, body, attachments, this.thread_id), plaintext);
    } else {
      body = this.format_email_text_footer(body);
      await this.do_send_message(await Api.common.message(this.account_email, this.supplied_from || this.get_sender_from_dom(), recipients, subject, body, attachments, this.thread_id), plaintext);
    }
  }

  private do_send_message = async (message: SendableMessage, plaintext: string) => {
    for (let k of Object.keys(this.additional_message_headers)) {
      message.headers[k] = this.additional_message_headers[k];
    }
    for (let a of message.attachments) {
      a.type = 'application/octet-stream'; // so that Enigmail+Thunderbird does not attempt to display without decrypting
    }
    if (this.S.cached('icon_pubkey').is('.active')) {
      message.attachments.push(tool.file.keyinfo_as_pubkey_attachment(await this.app.storage_get_key(this.account_email)));
    }
    let message_sent_response = await this.app.email_provider_message_send(message, this.render_upload_progress);
    const is_signed = this.S.cached('icon_sign').is('.active');
    this.app.send_message_to_main_window('notification_show', {notification: 'Your ' + (is_signed ? 'signed' : 'encrypted') + ' ' + (this.is_reply_box ? 'reply' : 'message') + ' has been sent.'});
    await this.draft_delete();
    if (this.is_reply_box) {
      this.render_reply_success(message, plaintext, message_sent_response.id);
    } else {
      this.app.close_message();
    }
  }

  private lookup_pubkey_from_db_or_keyserver_and_update_db_if_needed = async (email: string): Promise<Contact|"fail"> => {
    let [db_contact] = await this.app.storage_contact_get([email]);
    if (db_contact && db_contact.has_pgp && db_contact.pubkey) {
      return db_contact;
    } else {
      try {
        let {results: [lookup_result]} = await Api.attester.lookup_email([email]);
        if (lookup_result && lookup_result.email) {
          if (lookup_result.pubkey) {
            const parsed = openpgp.key.readArmored(lookup_result.pubkey);
            if (!parsed.keys[0]) {
              tool.catch.log('Dropping found but incompatible public key', {for: lookup_result.email, err: parsed.err ? ' * ' + parsed.err.join('\n * ') : null});
              lookup_result.pubkey = null;
            } else if ((await parsed.keys[0].getEncryptionKey()) === null) {
              tool.catch.log('Dropping found+parsed key because getEncryptionKeyPacket===null', {for: lookup_result.email, fingerprint: tool.crypto.key.fingerprint(parsed.keys[0])});
              lookup_result.pubkey = null;
            }
          }
          let ks_contact = this.app.storage_contact_object(lookup_result.email, db_contact && db_contact.name ? db_contact.name : null, lookup_result.has_cryptup ? 'cryptup' : 'pgp', lookup_result.pubkey, lookup_result.attested, false, Date.now());
          this.ks_lookups_by_email[lookup_result.email] = ks_contact;
          await this.app.storage_contact_save(ks_contact);
          return ks_contact;
        } else  {
          return this.PUBKEY_LOOKUP_RESULT_FAIL;
        }
      } catch (e) {
        if(!Api.error.is_network_error(e) && !Api.error.is_server_error(e)) {
          tool.catch.handle_exception(e);
        }
        return this.PUBKEY_LOOKUP_RESULT_FAIL;
      }
    }
  }

  private evaluate_rendered_recipients = async () => {
    for (let email_element of $('.recipients span').not('.working, .has_pgp, .no_pgp, .wrong, .attested, .failed, .expired').get()) {
      const email = Str.parse_email($(email_element).text()).email;
      if (Str.is_email_valid(email)) {
        this.S.now('send_btn_span').text(this.BTN_LOADING);
        this.set_input_text_height_manually_if_needed();
        let pubkey_lookup_result = await this.lookup_pubkey_from_db_or_keyserver_and_update_db_if_needed(email);
        await this.render_pubkey_result(email_element, email, pubkey_lookup_result);
      } else {
        await this.render_pubkey_result(email_element, email, this.PUBKEY_LOOKUP_RESULT_WRONG);
      }
    }
    this.set_input_text_height_manually_if_needed();
  }

  private get_password_validation_warning = () => {
    if (!this.S.cached('input_password').val()) {
      return 'No password entered';
    }
  }

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
  }

  /**
   * On Firefox, we have to manage textbox height manually. Only applies to composing new messages
   * (else ff will keep expanding body element beyond frame view)
   * A decade old firefox bug is the culprit: https://bugzilla.mozilla.org/show_bug.cgi?id=202081
   *
   * @param update_reference_body_height - set to true to take a new snapshot of intended html body height
   */
  private set_input_text_height_manually_if_needed = (update_reference_body_height:boolean=false) => {
    if (!this.is_reply_box && Env.browser().name === 'firefox') {
      let cell_height_except_text = 0;
      this.S.cached('all_cells_except_text').each(function() {
        let cell = $(this);
        cell_height_except_text += cell.is(':visible') ? (cell.parent('tr').height() || 0) + 1 : 0; // add a 1px border height for each table row
      });
      if (update_reference_body_height || !this.reference_body_height) {
        this.reference_body_height = this.S.cached('body').height() || 605;
      }
      this.S.cached('input_text').css('height', this.reference_body_height - cell_height_except_text);
    }
  }

  private hide_message_password_ui = () => {
    this.S.cached('password_or_pubkey').css('display', 'none');
    this.S.cached('input_password').val('');
    this.S.cached('add_intro').css('display', 'none');
    this.S.cached('input_intro').text('');
    this.S.cached('intro_container').css('display', 'none');
    this.set_input_text_height_manually_if_needed();
  }

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
  }

  private respond_to_input_hotkeys = (input_to_keydown_event: KeyboardEvent) => {
    let value = this.S.cached('input_to').val();
    const keys = Env.key_codes();
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
  }

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
        current_height = this.S.cached('prompt').outerHeight() || 0;
      }
      if (current_height !== this.last_reply_box_table_height && Math.abs(current_height - this.last_reply_box_table_height) > 2) { // more then two pixel difference compared to last time
        this.last_reply_box_table_height = current_height;
        this.app.send_message_to_main_window('set_css', {selector: `iframe#${this.frame_id}`, css: {height: `${(Math.max(min_height, current_height) + add_extra)}px`}});
      }
    }
  }

  private append_forwarded_message = (text: string) => {
    Ui.sanitize_append(this.S.cached('input_text'), `<br/><br/>Forwarded message:<br/><br/>&gt; ${text.replace(/(?:\r\n|\r|\n)/g, '&gt; ')}`);
    this.resize_reply_box();
  }

  private retrieve_decrypt_and_add_forwarded_message = async (message_id: string) => {
    let armored_message: string;
    try {
      armored_message = await this.app.email_provider_extract_armored_block(message_id);
    } catch (e) {
      if (e.data) {
        Ui.sanitize_append(this.S.cached('input_text'), `<br/>\n<br/>\n<br/>\n${Xss.html_escape(e.data)}`);
      } else if(Api.error.is_network_error(e)) {
        // todo: retry
      } else if(Api.error.is_auth_popup_needed(e)) {
        this.app.send_message_to_main_window('notification_show_auth_popup_needed', {account_email: this.account_email});
      } else {
        tool.catch.handle_exception(e);
      }
      return;
    }
    let result = await tool.crypto.message.decrypt(this.account_email, armored_message);
    if (result.success) {
      if (!Mime.resembles_message(result.content.text!)) {
        this.append_forwarded_message(result.content.text!.replace(/\n/g, '<br>'));
      } else {
        let mime_parse_result = await Mime.decode(result.content.text!);
        if(typeof mime_parse_result.text !== 'undefined') {
          this.append_forwarded_message(mime_parse_result.text.replace(/\n/g, '<br>'));
        } else if (typeof mime_parse_result.html !== 'undefined') {
          this.append_forwarded_message(Xss.html_sanitize_and_strip_all_tags(mime_parse_result.html!, '<br>'));
        } else {
          this.append_forwarded_message((result.content.text! || '').replace(/\n/g, '<br>')); // not sure about the replace, time will tell
        }
      }
    } else {
      Ui.sanitize_append(this.S.cached('input_text'), `<br/>\n<br/>\n<br/>\n${armored_message.replace(/\n/g, '<br/>\n')}`);
    }
  }

  private render_reply_message_compose_table = async (method:"forward"|"reply"="reply") => {
    this.S.cached('prompt').css({display: 'none'});
    this.S.cached('input_to').val(this.supplied_to + (this.supplied_to ? ',' : '')); // the comma causes the last email to be get evaluated
    await this.render_compose_table();
    if (this.can_read_emails) {
      let determined = await this.app.email_provider_determine_reply_message_header_variables();
      if (determined && determined.last_message_id && determined.headers) {
        this.additional_message_headers['In-Reply-To'] = determined.headers['In-Reply-To'];
        this.additional_message_headers.References = determined.headers.References;
        if (method === 'forward') {
          this.supplied_subject = 'Fwd: ' + this.supplied_subject;
          await this.retrieve_decrypt_and_add_forwarded_message(determined.last_message_id);
        }
      }
    } else {
      Ui.sanitize_render(this.S.cached('prompt'), 'FlowCrypt has limited functionality. Your browser needs to access this conversation to reply.<br/><br/><br/><div class="button green auth_settings">Add missing permission</div><br/><br/>Alternatively, <a href="#" class="new_message_button">compose a new secure message</a> to respond.<br/><br/>');
      this.S.cached('prompt').attr('style', 'border:none !important');
      $('.auth_settings').click(() => this.app.send_message_to_background_script('settings', { account_email: this.account_email, page: '/chrome/settings/modules/auth_denied.htm'}));
      $('.new_message_button').click(() => this.app.send_message_to_main_window('open_new_message'));
    }
    this.resize_reply_box();
    setTimeout(() => this.app.send_message_to_main_window('scroll_to_bottom_of_conversation'), 300);
  }

  private parse_and_render_recipients = async () => {
    const input_to = (this.S.cached('input_to').val() as string).toLowerCase();
    if (tool.value(',').in(input_to)) {
      const emails = input_to.split(',');
      for (let i = 0; i < emails.length - 1; i++) {
        Ui.sanitize_append(this.S.cached('input_to').siblings('.recipients'), `<span>${Xss.html_escape(emails[i])} ${Ui.spinner('green')}</span>`);
      }
    } else if (!this.S.cached('input_to').is(':focus') && input_to) {
      Ui.sanitize_append(this.S.cached('input_to').siblings('.recipients'), `<span>${Xss.html_escape(input_to)} ${Ui.spinner('green')}</span>`);
    } else {
      return;
    }
    this.S.cached('input_to').val('');
    this.resize_input_to();
    await this.evaluate_rendered_recipients();
    this.set_input_text_height_manually_if_needed();
  }

  private select_contact = (email: string, from_query: ProviderContactsQuery) => {
    const possibly_bogus_recipient = $('.recipients span.wrong').last();
    const possibly_bogus_address = Str.parse_email(possibly_bogus_recipient.text()).email;
    const q = Str.parse_email(from_query.substring).email;
    if (possibly_bogus_address === q || tool.value(q).in(possibly_bogus_address)) {
      possibly_bogus_recipient.remove();
    }
    setTimeout(async () => {
      if (!tool.value(email).in(this.get_recipients_from_dom())) {
        this.S.cached('input_to').val(Str.parse_email(email).email);
        await this.parse_and_render_recipients();
        this.S.cached('input_to').focus();
      }
    }, tool.int.random(20, 100)); // desperate amount to remove duplicates. Better solution advisable.
    this.hide_contacts();
  }

  private resize_input_to = () => { // below both present in template
    this.S.cached('input_to').css('width', (Math.max(150, this.S.cached('input_to').parent().width()! - this.S.cached('input_to').siblings('.recipients').width()! - 50)) + 'px');
  }

  private remove_receiver = (element: HTMLElement) => {
    this.recipients_missing_my_key = tool.arr.without_value(this.recipients_missing_my_key, $(element).parent().text());
    $(element).parent().remove();
    this.resize_input_to();
    this.show_hide_password_or_pubkey_container_and_color_send_button();
    this.update_pubkey_icon();
  }

  private auth_contacts = async (account_email: string) => {
    let last_recipient = $('.recipients span').last();
    this.S.cached('input_to').val(last_recipient.text());
    last_recipient.last().remove();
    let auth_result = await Api.google.auth_popup(account_email, this.tab_id, false, Api.gmail.scope(['read']));
    if (auth_result && auth_result.success === true) {
      this.can_read_emails = true;
      await this.search_contacts();
    } else if (auth_result && auth_result.success === false && auth_result.result === 'Denied' && auth_result.error === 'access_denied') {
      alert('FlowCrypt needs this permission to search your contacts on Gmail. Without it, FlowCrypt will keep a separate contact list.');
    } else {
      alert(Lang.general.something_went_wrong_try_again);
    }
  }

  private render_search_results_loading_done = () => {
    this.S.cached('contacts').find('ul li.loading').remove();
    if (!this.S.cached('contacts').find('ul li').length) {
      this.hide_contacts();
    }
  }

  private render_search_results = (contacts: Contact[], query: ProviderContactsQuery) => {
    const renderable_contacts = contacts.slice();
    renderable_contacts.sort((a, b) => (10 * (b.has_pgp - a.has_pgp)) + ((b.last_use || 0) - (a.last_use || 0) > 0 ? 1 : -1)); // have pgp on top, no pgp bottom. Sort each groups by last used
    renderable_contacts.splice(8);
    if (renderable_contacts.length > 0 || this.contact_search_in_progress) {
      let ul_html = '';
      for (let contact of renderable_contacts) {
        ul_html += `<li class="select_contact" data-test="action-select-contact" email="${Xss.html_escape(contact.email.replace(/<\/?b>/g, ''))}">`;
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
          ul_html += (Xss.html_escape(contact.name) + ' &lt;' + Xss.html_escape(display_email) + '&gt;');
        } else {
          ul_html += Xss.html_escape(display_email);
        }
        ul_html += '</li>';
      }
      if (this.contact_search_in_progress) {
        ul_html += '<li class="loading">loading...</li>';
      }
      Ui.sanitize_render(this.S.cached('contacts').find('ul'), ul_html);
      this.S.cached('contacts').find('ul li.select_contact').click(Ui.event.prevent(Ui.event.double(), (target: HTMLElement) => {
        let email = $(target).attr('email');
        if (email) {
          this.select_contact(Str.parse_email(email).email, query);
        }
      }, this.handle_errors(`select contact`)));
      this.S.cached('contacts').find('ul li.select_contact').hover(function() { $(this).addClass('hover'); }, function() { $(this).removeClass('hover'); });
      this.S.cached('contacts').find('ul li.auth_contacts').click(Ui.event.handle(() => this.auth_contacts(this.account_email), this.handle_errors(`authorize contact search`)));
      this.S.cached('contacts').css({
        display: 'block',
        top: `${$('#compose > tbody > tr:first').height()! + this.S.cached('input_addresses_container_inner').height()! + 10}px`, // both are in the template
      });
    } else {
      this.hide_contacts();
    }
  }

  private search_contacts = async (db_only=false) => {
    const query = {substring: Str.parse_email(this.S.cached('input_to').val() as string).email};
    if (query.substring !== '') {
      let contacts = await this.app.storage_contact_search(query);
      if (db_only || !this.can_read_emails) {
        this.render_search_results(contacts, query);
      } else {
        this.contact_search_in_progress = true;
        this.render_search_results(contacts, query);
        this.app.email_provider_search_contacts(query.substring, contacts, async search_contacts_results => {
          if (search_contacts_results.new.length) {
            for (let contact of search_contacts_results.new) {
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
      this.hide_contacts(); // todo - show suggestions of most contacted ppl etc
    }
  }

  private hide_contacts = () => {
    this.S.cached('contacts').css('display', 'none');
  }

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
  }

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
  }

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
  }

  private recipient_key_id_text = (contact: Contact) => {
    if (contact.client === 'cryptup' && contact.keywords) {
      return '\n\n' + 'Public KeyWords:\n' + contact.keywords;
    } else if (contact.fingerprint) {
      return '\n\n' + 'Key fingerprint:\n' + contact.fingerprint;
    } else {
      return '';
    }
  }

  private render_pubkey_result = async (email_element: HTMLElement, email: string, contact: Contact|"fail"|"wrong") => {
    if ($('body#new_message').length) {
      if (typeof contact === 'object' && contact.has_pgp) {
        let sending_address_on_pks = tool.value(this.supplied_from || this.get_sender_from_dom()).in(this.my_addresses_on_pks);
        let sending_address_on_keyserver = tool.value(this.supplied_from || this.get_sender_from_dom()).in(this.my_addresses_on_keyserver);
        if ((contact.client === 'cryptup' && !sending_address_on_keyserver) || (contact.client !== 'cryptup' && !sending_address_on_pks)) {
          // new message, and my key is not uploaded where the recipient would look for it
          if (await this.app.does_recipient_have_my_pubkey(email) !== true) { // either don't know if they need pubkey (can_read_emails false), or they do need pubkey
            this.recipients_missing_my_key.push(email);
          }
          this.update_pubkey_icon();
        } else {
          this.update_pubkey_icon();
        }
      } else {
        this.update_pubkey_icon();
      }
    }
    $(email_element).children('img, i').remove();
    let content_html = '<img src="/img/svgs/close-icon.svg" alt="close" class="close-icon svg" /><img src="/img/svgs/close-icon-black.svg" alt="close" class="close-icon svg display_when_sign" />';
    Ui.sanitize_append(email_element, content_html).find('img.close-icon').click(Ui.event.handle(target => this.remove_receiver(target), this.handle_errors('remove recipient')));
    if (contact === this.PUBKEY_LOOKUP_RESULT_FAIL) {
      $(email_element).attr('title', 'Loading contact information failed, please try to add their email again.');
      $(email_element).addClass("failed");
      Ui.sanitize_replace($(email_element).children('img:visible'), '<img src="/img/svgs/repeat-icon.svg" class="repeat-icon action_retry_pubkey_fetch">');
      $(email_element).find('.action_retry_pubkey_fetch').click(Ui.event.handle(target => this.remove_receiver(target), this.handle_errors('remove recipient')));
    } else if (contact === this.PUBKEY_LOOKUP_RESULT_WRONG) {
      $(email_element).attr('title', 'This email address looks misspelled. Please try again.');
      $(email_element).addClass("wrong");
    } else if (contact.pubkey && await tool.crypto.key.usable_but_expired(openpgp.key.readArmored(contact.pubkey).keys[0])) {
      $(email_element).addClass("expired");
      Ui.sanitize_prepend(email_element, '<img src="/img/svgs/expired-timer.svg" class="expired-time">');
      $(email_element).attr('title', 'Does use encryption but their public key is expired. You should ask them to send you an updated public key.' + this.recipient_key_id_text(contact));
    } else if (contact.pubkey && contact.attested) {
      $(email_element).addClass("attested");
      Ui.sanitize_prepend(email_element, '<img src="/img/svgs/locked-icon.svg" />');
      $(email_element).attr('title', 'Does use encryption, attested by CRYPTUP' + this.recipient_key_id_text(contact));
    } else if (contact.pubkey) {
      $(email_element).addClass("has_pgp");
      Ui.sanitize_prepend(email_element, '<img src="/img/svgs/locked-icon.svg" />');
      $(email_element).attr('title', 'Does use encryption' + this.recipient_key_id_text(contact));
    } else {
      $(email_element).addClass("no_pgp");
      Ui.sanitize_prepend(email_element, '<img src="/img/svgs/locked-icon.svg" />');
      $(email_element).attr('title', 'Could not verify their encryption setup. You can encrypt the message with a password below. Alternatively, add their pubkey.');
    }
    this.show_hide_password_or_pubkey_container_and_color_send_button();
  }

  private get_recipients_from_dom = (filter:"no_pgp"|null=null): string[] => {
    let selector;
    if (filter === 'no_pgp') {
      selector = '.recipients span.no_pgp';
    } else {
      selector = '.recipients span';
    }
    const recipients: string[] = [];
    $(selector).each(function() {
      recipients.push($(this).text().trim());
    });
    return recipients;
  }

  private get_sender_from_dom = (): string => {
    if (this.S.now('input_from').length) {
      return String(this.S.now('input_from').val());
    } else {
      return this.account_email;
    }
  }

  private render_reply_success = (message: SendableMessage, plaintext: string, message_id: string) => {
    let is_signed = this.S.cached('icon_sign').is('.active');
    this.app.render_reinsert_reply_box(message_id, message.headers.To.split(',').map(a => Str.parse_email(a).email));
    if (is_signed) {
      this.S.cached('replied_body').addClass('pgp_neutral').removeClass('pgp_secure');
    }
    this.S.cached('replied_body').css('width', ($('table#compose').width() || 500) - 30);
    this.S.cached('compose_table').css('display', 'none');
    this.S.cached('reply_message_successful').find('div.replied_from').text(this.supplied_from);
    this.S.cached('reply_message_successful').find('div.replied_to span').text(this.supplied_to);
    Ui.sanitize_render(this.S.cached('reply_message_successful').find('div.replied_body'), Xss.html_escape(plaintext).replace(/\n/g, '<br>'));
    const email_footer = this.app.storage_get_email_footer();
    if (email_footer) {
      const renderable_escaped_email_footer = Xss.html_escape(email_footer).replace(/\n/g, '<br>');
      if (is_signed) {
        Ui.sanitize_append(this.S.cached('replied_body'), `<br><br>${renderable_escaped_email_footer}`);
      } else {
        Ui.sanitize_render(this.S.cached('reply_message_successful').find('.email_footer'), `<br> ${renderable_escaped_email_footer}`);
      }
    }
    let t = new Date();
    let time = ((t.getHours() !== 12) ? (t.getHours() % 12) : 12) + ':' + (t.getMinutes() < 10 ? '0' : '') + t.getMinutes() + ((t.getHours() >= 12) ? ' PM ' : ' AM ') + '(0 minutes ago)';
    this.S.cached('reply_message_successful').find('div.replied_time').text(time);
    this.S.cached('reply_message_successful').css('display', 'block');
    if (message.attachments.length) {
      this.S.cached('replied_attachments').html(message.attachments.map(a => { // xss-safe-factory
        a.message_id = message_id;
        return this.app.factory_attachment(a);
      }).join('')).css('display', 'block');
    }
    this.resize_reply_box();
  }

  private simulate_ctrl_v = (to_paste: string) => {
    const r = window.getSelection().getRangeAt(0);
    r.insertNode(r.createContextualFragment(to_paste));
  }

  private render_compose_table = async () => {
    this.S.cached('compose_table').css('display', 'table');
    if (Env.browser().name === 'firefox') { // the padding cause issues in firefox where user cannot click on the message password
      this.S.cached('input_text').css({'padding-top': 0, 'padding-bottom': 0});
    }
    this.S.cached('send_btn').click(Ui.event.prevent(Ui.event.double(), () => this.extract_process_send_message()));
    this.S.cached('send_btn').keypress(Ui.enter(() => this.extract_process_send_message()));
    this.S.cached('input_to').keydown((ke: any) => this.respond_to_input_hotkeys(ke));
    this.S.cached('input_to').keyup(Ui.event.prevent(Ui.event.spree('veryslow'), () => this.search_contacts()));
    this.S.cached('input_to').blur(Ui.event.prevent(Ui.event.double(), () => this.parse_and_render_recipients().catch(tool.catch.rejection)));
    this.S.cached('input_text').keyup(() => this.S.cached('send_btn_note').text(''));
    this.S.cached('compose_table').click(Ui.event.handle(() => this.hide_contacts(), this.handle_errors(`hide contact box`)));
    this.S.cached('input_addresses_container_inner').click(Ui.event.handle(() => {
      if (!this.S.cached('input_to').is(':focus')) {
        this.S.cached('input_to').focus();
      }
    }, this.handle_errors(`focus on recipient field`))).children().click(() => false);
    this.resize_input_to();
    this.attach.initialize_attach_dialog('fineuploader', 'fineuploader_button');
    this.S.cached('input_to').focus();
    if (this.is_reply_box) {
      if (this.supplied_to) {
        this.S.cached('input_text').focus();
        document.getElementById('input_text')!.focus(); // #input_text is in the template
        // Firefox will not always respond to initial automatic $input_text.blur()
        // Recipients may be left unrendered, as standard text, with a trailing comma
        await this.parse_and_render_recipients(); // this will force firefox to render them on load
      }
      setTimeout(() => { // delay automatic resizing until a second later
        $(window).resize(Ui.event.prevent(Ui.event.spree('veryslow'), () => this.resize_reply_box()));
        this.S.cached('input_text').keyup(() => this.resize_reply_box());
      }, 1000);
    } else {
      $('.close_new_message').click(Ui.event.handle(() => this.app.close_message(), this.handle_errors(`close message`)));
      let addresses = this.app.storage_get_addresses() as string[];
      if (addresses.length > 1) {
        let input_addr_container = $('#input_addresses_container');
        input_addr_container.addClass('show_send_from');
        Ui.sanitize_append(input_addr_container, '<select id="input_from" tabindex="-1" data-test="input-from"></select><img id="input_from_settings" src="/img/svgs/settings-icon.svg" data-test="action-open-sending-address-settings" title="Settings">');
        input_addr_container.find('#input_from_settings').click(Ui.event.handle(() => this.app.render_sending_address_dialog(), this.handle_errors(`open sending address dialog`)));
        Ui.sanitize_append(input_addr_container.find('#input_from'), addresses.map(a => `<option value="${Xss.html_escape(a)}">${Xss.html_escape(a)}</option>`).join('')).change(() => this.update_pubkey_icon());
        if (Env.browser().name === 'firefox') {
          input_addr_container.find('#input_from_settings').css('margin-top', '20px');
        }
      }
      this.set_input_text_height_manually_if_needed();
    }
  }

  private should_save_draft = (message_body: string) => {
    if (message_body && message_body !== this.last_draft) {
      this.last_draft = message_body;
      return true;
    } else {
      return false;
    }
  }

  private format_password_protected_email = (short_id: string, original_body: SendableMessageBody, armored_pubkeys: string[]) => {
    const decrypt_url = this.FC_WEB_URL + '/' + short_id;
    const a = '<a href="' + Xss.html_escape(decrypt_url) + '" style="padding: 2px 6px; background: #2199e8; color: #fff; display: inline-block; text-decoration: none;">' + Lang.compose.open_message + '</a>';
    const intro = this.S.cached('input_intro').length ? this.extract_as_text('input_intro') : '';
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
    html.push(Lang.compose.alternatively_copy_paste + Xss.html_escape(decrypt_url) + '<br><br><br>');
    const html_fc_web_url_link = '<a href="' + Xss.html_escape(this.FC_WEB_URL) + '" style="color: #999;">' + Xss.html_escape(this.FC_WEB_URL) + '</a>';
    if (armored_pubkeys.length > 1) { // only include the message in email if a pubkey-holding person is receiving it as well
      const html_pgp_message = original_body['text/html'] ? original_body['text/html'] : (original_body['text/plain'] || '').replace(this.FC_WEB_URL, html_fc_web_url_link).replace(/\n/g, '<br>\n');
      html.push('<div style="color: #999;">' + html_pgp_message + '</div>');
      text.push(original_body['text/plain']);
    }
    html.push('</div>');
    return {'text/plain': text.join('\n'), 'text/html': html.join('\n')};
  }

  private format_email_text_footer = (original_body: SendableMessageBody): SendableMessageBody => {
    const email_footer = this.app.storage_get_email_footer();
    const body = {'text/plain': original_body['text/plain'] + (email_footer ? '\n' + email_footer : '')} as SendableMessageBody;
    if (typeof original_body['text/html'] !== 'undefined') {
      body['text/html'] = original_body['text/html'] + (email_footer ? '<br>\n' + email_footer.replace(/\n/g, '<br>\n') : '');
    }
    return body;
  }

  static default_app_functions = (): ComposerAppFunctionsInterface => {
    return {
      send_message_to_main_window: (channel: string, data: Dict<Serializable>) => null,
      can_read_email: () => false,
      does_recipient_have_my_pubkey: (their_email: string): Promise<boolean|undefined> => Promise.resolve(false),
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
      email_provider_draft_get: (draft_id: string) => Promise.resolve({id: null as any as string, message: null as any as ApirGmailMessage}),
      email_provider_draft_create: (mime_message: string) => Promise.reject(null),
      email_provider_draft_update: (draft_id: string, mime_message: string) => Promise.resolve({}),
      email_provider_draft_delete: (draft_id: string) => Promise.resolve({}),
      email_provider_message_send: (message: SendableMessage, render_upload_progress: ApiCallProgressCallback) => Promise.reject({message: 'not implemented'}),
      email_provider_search_contacts: (query: string, known_contacts: Contact[], multi_cb: Callback) => multi_cb({new: [], all: []}),
      email_provider_determine_reply_message_header_variables: () => Promise.resolve(undefined),
      email_provider_extract_armored_block: (message_id) => Promise.resolve(''),
      send_message_to_background_script: (channel: string, data: Dict<Serializable>) => BrowserMsg.send(null, channel, data),
      render_reinsert_reply_box: (last_message_id: string, recipients: string[]) => Promise.resolve(),
      render_footer_dialog: () => null,
      render_add_pubkey_dialog: (emails: string[]) => null,
      render_help_dialog: () => null,
      render_sending_address_dialog: () => null,
      close_message: () => null,
      factory_attachment: (attachment: Attachment) => `<div>${attachment.name}</div>`,
    };
  }

}
