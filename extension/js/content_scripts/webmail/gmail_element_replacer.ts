/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch, Value, Str, Dict } from '../../common/common.js';
import { Injector } from '../../common/inject.js';
import { Notifications } from '../../common/notifications.js';
import { Api } from '../../common/api.js';
import { Pgp } from '../../common/pgp.js';
import { BrowserMsg } from '../../common/extension.js';
import { Xss, Ui, XssSafeFactory, WebmailVariantString } from '../../common/browser.js';
import { Attachment } from '../../common/attachment.js';
import { WebmailElementReplacer } from './setup_webmail_content_script.js';

export class GmailElementReplacer implements WebmailElementReplacer {

  private recipient_has_pgp_cache: Dict<boolean> = {};
  private addresses: string[];
  private factory: XssSafeFactory;
  private account_email: string;
  private can_read_emails: boolean;
  private injector: Injector;
  private notifications: Notifications;
  private gmail_variant: WebmailVariantString;
  private css_hidden = 'opacity: 0 !important; height: 1px !important; width: 1px !important; max-height: 1px !important; max-width: 1px !important; position: absolute !important; z-index: -1000 !important';
  private currently_evaluating_standard_compose_box_recipients = false;

  private selector = { // gmail_variant=standard|new
    conversation_root: 'div.if',
    conversation_root_scrollable: '.Tm.aeJ',
    subject: 'h2.hP',
    msg_outer: 'div.adn',
    msg_inner: 'div.a3s:not(.undefined), .message_inner_body',
    message_inner_containing_pgp: "div.a3s:not(.undefined):contains('" + Pgp.armor.headers('null').begin + "')",
    attachments_container_outer: 'div.hq.gt',
    attachments_container_inner: 'div.aQH',
    translate_prompt: '.adI',
    standard_compose_window: '.aaZ:visible',
  };

  constructor(factory: XssSafeFactory, account_email: string, addresses: string[], can_read_emails: boolean, injector: Injector, notifications: Notifications, gmail_variant: WebmailVariantString) {
    this.factory = factory;
    this.account_email = account_email;
    this.addresses = addresses;
    this.can_read_emails = can_read_emails;
    this.injector = injector;
    this.gmail_variant = gmail_variant;
    this.notifications = notifications;
  }

  everything = () => {
    this.replace_armored_blocks();
    this.replace_attachments().catch(Catch.handle_exception);
    this.replace_cryptup_tags();
    this.replace_conversation_buttons();
    this.replace_standard_reply_box();
    this.evaluate_standard_compose_receivers().catch(Catch.handle_exception);
  }

  set_reply_box_editable = () => {
    let reply_container_iframe = $('.reply_message_iframe_container > iframe').first();
    if (reply_container_iframe.length) {
      $(reply_container_iframe).replaceWith(this.factory.embedded_reply(this.get_conversation_params(this.get_conversation_root_element(reply_container_iframe[0])), true)); // xss-safe-value
    } else {
      this.replace_standard_reply_box(true);
    }
    this.scroll_to_bottom_of_conversation();
  }

  reinsert_reply_box = (subject: string, my_email: string, reply_to: string[], thread_id: string) => {
    let params = { subject, reply_to, addresses: this.addresses, my_email, thread_id, thread_message_id: thread_id };
    $('.reply_message_iframe_container:visible').last().append(this.factory.embedded_reply(params, false, true)); // xss-safe-value
  }

  scroll_to_bottom_of_conversation = () => {
    let scrollable_element = $(this.selector.conversation_root_scrollable).get(0);
    if(scrollable_element) {
      scrollable_element.scrollTop = scrollable_element.scrollHeight; // scroll to the bottom of conversation where the reply box is
    } else if(window.location.hash.match(/^#inbox\/[a-zA-Z]+$/)) { // is a conversation view, but no scrollable conversation element
      Catch.report(`Cannot find Gmail scrollable element: ${this.selector.conversation_root_scrollable}`);
    }
  }

  private replace_armored_blocks = () => {
    let emails_containing_pgp_block = $(this.selector.msg_outer).find(this.selector.message_inner_containing_pgp).not('.evaluated');
    for (let email_container of emails_containing_pgp_block.get()) {
      $(email_container).addClass('evaluated');
      let sender_email = this.get_sender_email(email_container);
      let is_outgoing = Value.is(sender_email).in(this.addresses);
      let replacement_xss_safe = Pgp.armor.replace_blocks(this.factory, email_container.innerText, this.determine_msg_id(email_container), sender_email, is_outgoing);
      if (typeof replacement_xss_safe !== 'undefined') {
        $(this.selector.translate_prompt).hide();
        let new_selector = this.update_msg_body_el_DANGEROUSLY(email_container, 'set', replacement_xss_safe); // xss-safe-factory: replace_blocks is XSS safe
      }
    }
  }

  private add_cryptup_conversation_icon = (container_selector: JQuery<HTMLElement>, icon_html: string, icon_selector: string, on_click: () => void) => {
    container_selector.addClass('appended').children('.use_secure_reply, .show_original_conversation').remove(); // remove previous FlowCrypt buttons, if any
    Xss.sanitize_append(container_selector, icon_html).children(icon_selector).off().click(Ui.event.prevent('double', Catch.try(on_click)));
  }

  private replace_conversation_buttons = (force:boolean=false) => {
    let convo_upper_icons = $('div.ade:visible');
    let use_encryption_in_this_convo = $('iframe.pgp_block').filter(':visible').length || force;
    // reply buttons
    if (use_encryption_in_this_convo) {
      let visible_reply_buttons = $('td.acX:visible');
      if (visible_reply_buttons.not('.replaced').length) { // last reply button in convo gets replaced
        let conversation_reply_buttons_to_replace = visible_reply_buttons.not('.replaced');
        let has_visible_replacements = visible_reply_buttons.filter('.replaced').length > 0;
        conversation_reply_buttons_to_replace.addClass('replaced').each((i, reply_button) => {
          if (i + 1 < conversation_reply_buttons_to_replace.length || has_visible_replacements) {
            $(reply_button).addClass('replaced').text(''); // hide all except last
          } else {
            $(reply_button).html(this.factory.button_reply()); // replace last,  // xss-safe-factory
            $(reply_button).click(Ui.event.prevent('double', Catch.try(this.set_reply_box_editable)));
          }
        });
      }
    }
    // conversation top-right icon buttons
    if (convo_upper_icons.length) {
      if (use_encryption_in_this_convo) {
        if (!convo_upper_icons.is('.appended') || convo_upper_icons.find('.use_secure_reply').length) { // either not appended, or appended icon is outdated (convo switched to encrypted)
          this.add_cryptup_conversation_icon(convo_upper_icons, this.factory.button_without_cryptup(), '.show_original_conversation', () => {
            convo_upper_icons.find('.gZ').click();
          });

        }
      } else {
        if (!convo_upper_icons.is('.appended')) {
          this.add_cryptup_conversation_icon(convo_upper_icons, this.factory.button_with_cryptup(), '.use_secure_reply', () => {
            this.replace_conversation_buttons(true);
            this.replace_standard_reply_box(true, true);
            this.scroll_to_bottom_of_conversation();
          });
        }
      }
    }
  }

  private replace_cryptup_tags = () => {
    let all_contenteditable_elements = $("div[contenteditable='true']").not('.evaluated').addClass('evaluated');
    for (let contenteditable_element of all_contenteditable_elements.get()) {
      let contenteditable = $(contenteditable_element);
      let found_cryptup_link = contenteditable.html().substr(0, 1000).match(/\[cryptup:link:([a-z_]+):([0-9a-fr\-]+)]/);
      if (found_cryptup_link !== null) {
        let button;
        let [full_link, name, button_href_id] = found_cryptup_link;
        if (name === 'draft_compose') {
          button = `<a href="#" class="open_draft_${Xss.html_escape(button_href_id)}">Open draft</a>`;
        } else if (name === 'draft_reply') {
          button = `<a href="#inbox/${Xss.html_escape(button_href_id)}">Open draft</a>`;
        }
        if (button) {
          Xss.sanitize_replace(contenteditable, button);
          $(`a.open_draft_${button_href_id}`).click(Ui.event.handle(() => {
            $('div.new_message').remove();
            $('body').append(this.factory.embedded_compose(button_href_id)); // xss-safe-factory
          }));
        }
      }
    }
  }

  private replace_attachments = async () => {
    for (let attachments_container_element of $(this.selector.attachments_container_inner).get()) {
      let atts_container = $(attachments_container_element);
      let new_pgp_attachments = this.filter_attachments(atts_container.children().not('.evaluated'), Attachment.methods.pgp_name_patterns()).addClass('evaluated');
      let new_pgp_atts_names = Value.arr.from_dom_node_list(new_pgp_attachments.find('.aV3')).map(x => $.trim($(x).text()));
      if (new_pgp_attachments.length) {
        let msg_id = this.determine_msg_id(atts_container);
        if (msg_id) {
          if (this.can_read_emails) {
            Xss.sanitize_prepend(new_pgp_attachments, this.factory.embedded_attachment_status('Getting file info..' + Ui.spinner('green')));
            try {
              let msg = await Api.gmail.msg_get(this.account_email, msg_id, 'full');
              await this.process_atts(msg_id, Api.gmail.find_atts(msg), atts_container, false, new_pgp_atts_names);
            } catch (e) {
              if (Api.error.is_auth_popup_needed(e)) {
                this.notifications.show_auth_popup_needed(this.account_email);
              }
              $(new_pgp_attachments).find('.attachment_loader').text('Failed to load');
            }
          } else {
            let status_msg = 'Missing Gmail permission to decrypt attachments. <a href="#" class="auth_settings">Settings</a></div>';
            $(new_pgp_attachments).prepend(this.factory.embedded_attachment_status(status_msg)).children('a.auth_settings').click(Ui.event.handle(() => { // xss-safe-factory
              BrowserMsg.send(null, 'settings', { account_email: this.account_email, page: '/chrome/settings/modules/auth_denied.htm' });
            }));
          }
        } else {
          $(new_pgp_attachments).prepend(this.factory.embedded_attachment_status('Unknown message id')); // xss-safe-factory
        }
      }
    }
  }

  private process_atts = async (msg_id: string, attachment_metas: Attachment[], attachments_container_inner: JQuery<HTMLElement>|HTMLElement, skip_google_drive:boolean, new_pgp_attachments_names:string[]=[]) => {
    let msg_el = this.get_msg_body_el(msg_id);
    let sender_email = this.get_sender_email(msg_el);
    let is_outgoing = Value.is(sender_email).in(this.addresses);
    attachments_container_inner = $(attachments_container_inner);
    attachments_container_inner.parent().find('span.aVW').hide(); // original gmail header showing amount of attachments
    let rendered_attachments_count = attachment_metas.length;
    for (let a of attachment_metas) {
      // todo - [same name + not processed].first() ... What if attachment metas are out of order compared to how gmail shows it? And have the same name?
      let treat_as = a.treat_as();
      let attachment_selector = this.filter_attachments(attachments_container_inner.children().not('.attachment_processed'), [a.name]).first();
      if (treat_as !== 'standard') {
        this.hide_attachment(attachment_selector, attachments_container_inner);
        rendered_attachments_count--;
        if (treat_as === 'encrypted') { // actual encrypted attachment - show it
          attachments_container_inner.prepend(this.factory.embedded_attachment(a)); // xss-safe-factory
          rendered_attachments_count++;
        } else if (treat_as === 'message') {
          let is_ambiguous_asc_file = a.name.substr(-4) === '.asc' && !Value.is(a.name).in(['msg.asc', 'message.asc', 'encrypted.asc', 'encrypted.eml.pgp']); // ambiguous .asc name
          let is_ambiguous_noname_file = !a.name || a.name === 'noname'; // may not even be OpenPGP related
          if (is_ambiguous_asc_file || is_ambiguous_noname_file) { // Inspect a chunk
            let file_chunk = await Api.gmail.attachment_get_chunk(this.account_email, msg_id, a.id!); // .id is present when fetched from api
            let openpgp_type = Pgp.msg.type(file_chunk);
            if (openpgp_type && openpgp_type.type === 'public_key' && openpgp_type.armored) { // if it looks like OpenPGP public key
              rendered_attachments_count = await this.render_public_key_from_file(a, attachments_container_inner, msg_el, is_outgoing, attachment_selector, rendered_attachments_count);
            } else if (openpgp_type && Value.is(openpgp_type.type).in(['message', 'signed_message'])) {
              msg_el = this.update_msg_body_el_DANGEROUSLY(msg_el, 'append', this.factory.embedded_message('', msg_id, false, sender_email, false)); // xss-safe-factory
            } else {
              attachment_selector.show().children('.attachment_loader').text('Unknown OpenPGP format');
              rendered_attachments_count++;
            }
          } else {
            msg_el = this.update_msg_body_el_DANGEROUSLY(msg_el, 'append', this.factory.embedded_message('', msg_id, false, sender_email, false)); // xss-safe-factory
          }
        } else if (treat_as === 'public_key') { // todo - pubkey should be fetched in pgp_pubkey.js
          rendered_attachments_count = await this.render_public_key_from_file(a, attachments_container_inner, msg_el, is_outgoing, attachment_selector, rendered_attachments_count);
        } else if (treat_as === 'signature') {
          let signed_content = msg_el[0] ? Str.normalize_spaces(msg_el[0].innerText).trim() : '';
          let embedded_signed_msg_xss_safe = this.factory.embedded_message(signed_content, msg_id, false, sender_email, false, true);
          let replace = !msg_el.is('.evaluated') && !Value.is(Pgp.armor.headers('null').begin).in(msg_el.text());
          msg_el = this.update_msg_body_el_DANGEROUSLY(msg_el, replace ? 'set': 'append', embedded_signed_msg_xss_safe); // xss-safe-factory
        }
      } else if(treat_as === 'standard' && a.name.substr(-4) === '.asc') { // normal looking attachment ending with .asc
        let file_chunk = await Api.gmail.attachment_get_chunk(this.account_email, msg_id, a.id!); // .id is present when fetched from api
        let openpgp_type = Pgp.msg.type(file_chunk);
        if (openpgp_type && openpgp_type.type === 'public_key' && openpgp_type.armored) { // if it looks like OpenPGP public key
          rendered_attachments_count = await this.render_public_key_from_file(a, attachments_container_inner, msg_el, is_outgoing, attachment_selector, rendered_attachments_count);
          this.hide_attachment(attachment_selector, attachments_container_inner);
          rendered_attachments_count--;
        } else {
          attachment_selector.addClass('attachment_processed').children('.attachment_loader').remove();
        }
      } else { // standard file
        attachment_selector.addClass('attachment_processed').children('.attachment_loader').remove();
      }
    }
    if (rendered_attachments_count === 0) {
      attachments_container_inner.parents(this.selector.attachments_container_outer).first().hide();
    }
    let not_processed_attachments_loaders = attachments_container_inner.find('.attachment_loader');
    if (!skip_google_drive && not_processed_attachments_loaders.length && msg_el.find('.gmail_drive_chip, a[href^="https://drive.google.com/file"]').length) {
      // replace google drive attachments - they do not get returned by Gmail API thus did not get replaced above
      let google_drive_attachments: Attachment[] = [];
      not_processed_attachments_loaders.each((i, loader_element) => {
        let download_url = $(loader_element).parent().attr('download_url');
        if (download_url) {
          let meta = download_url.split(':');
          google_drive_attachments.push(new Attachment({message_id: msg_id, name: meta[1], type: meta[0], url: `${meta[2]}:${meta[3]}`, treat_as: 'encrypted'}));
        } else {
          console.info('Missing Google Drive attachments download_url');
        }
      });
      await this.process_atts(msg_id, google_drive_attachments, attachments_container_inner, true);
    }
  }

  private render_public_key_from_file = async (attachment_meta: Attachment, attachments_container_inner: JQuery<HTMLElement>, msg_el: JQuery<HTMLElement>, is_outgoing: boolean, attachment_selector: JQuery<HTMLElement>, rendered_attachments_count: number) => {
    let downloaded_attachment;
    try {
      downloaded_attachment = await Api.gmail.attachment_get(this.account_email, attachment_meta.message_id!, attachment_meta.id!); // .id is present when fetched from api
    } catch (e) {
      attachments_container_inner.show().addClass('attachment_processed').find('.attachment_loader').text('Please reload page');
      rendered_attachments_count++;
      return rendered_attachments_count;
    }
    let openpgp_type = Pgp.msg.type(downloaded_attachment.data);
    if (openpgp_type && openpgp_type.type === 'public_key') {
      msg_el = this.update_msg_body_el_DANGEROUSLY(msg_el, 'append', this.factory.embedded_pubkey(downloaded_attachment.data, is_outgoing)); // xss-safe-factory
    } else {
      attachment_selector.show().addClass('attachment_processed').children('.attachment_loader').text('Unknown Public Key Format');
      rendered_attachments_count++;
    }
    return rendered_attachments_count;
  }

  private filter_attachments = (potential_matches: JQuery<HTMLElement>|HTMLElement, patterns: string[]) => {
    return $(potential_matches).filter('span.aZo:visible, span.a5r:visible').find('span.aV3').filter(function() {
      let name = this.innerText.trim();
      for (let pattern of patterns) {
        if (pattern.indexOf('*.') === 0) { // wildcard
          if (name.endsWith(pattern.substr(1))) {
            return true;
          }
        } else if (name === pattern) { // exact match
          return true;
        } else if ((name === 'noname' && pattern === '') || (name === '' && pattern === 'noname')) { // empty filename (sometimes represented as "noname" in Gmail)
          return true;
        }
      }
      return false;
    }).closest('span.aZo, span.a5r');
  }

  private hide_attachment = (atachment_element: JQuery<HTMLElement>|HTMLElement, attachments_container_selector: JQuery<HTMLElement>|HTMLElement) => {
    atachment_element = $(atachment_element);
    attachments_container_selector = $(attachments_container_selector);
    atachment_element.hide();
    if (!atachment_element.length) {
      attachments_container_selector.children('.attachment_loader').text('Missing file info');
    }
  }

  private determine_msg_id = (inner_msg_el: HTMLElement|JQuery<HTMLElement>) => { // todo - test and use data-message-id with Gmail API once available
    return $(inner_msg_el).parents(this.selector.msg_outer).attr('data-legacy-message-id') || '';
  }

  private determine_thread_id = (conversation_root_element: HTMLElement|JQuery<HTMLElement>) => { // todo - test and use data-thread-id with Gmail API once available
    return $(conversation_root_element).find(this.selector.subject).attr('data-legacy-thread-id') || '';
  }

  private get_msg_body_el(msg_id: string) {
    return $(this.selector.msg_outer).filter(`[data-legacy-message-id="${msg_id}"]`).find(this.selector.msg_inner);
  }

  private wrap_msg_body_el = (html_content: string) => {
    return '<div class="message_inner_body evaluated">' + html_content + '</div>';
  }

  /**
   * XSS WARNING
   *
   * new_html_content must be XSS safe
   */
  private update_msg_body_el_DANGEROUSLY = (el: HTMLElement|JQuery<HTMLElement>, method:'set'|'append', new_html_content_MUST_BE_XSS_SAFE: string) => {  // xss-dangerous-function
    // Messages in Gmail UI have to be replaced in a very particular way
    // The first time we update element, it should be completely replaced so that Gmail JS will lose reference to the original element and stop re-rendering it
    // Gmail message re-rendering causes the PGP message to flash back and forth, confusing the user and wasting cpu time
    // Subsequent times, it can be updated naturally
    let msg_body = $(el);
    let replace = !msg_body.is('.message_inner_body'); // not a previously replaced element, needs replacing
    if (method === 'set') {
      if (replace) {
        let parent = msg_body.parent();
        msg_body.replaceWith(this.wrap_msg_body_el(new_html_content_MUST_BE_XSS_SAFE)); // xss-safe-value
        return parent.find('.message_inner_body'); // need to return new selector - old element was replaced
      } else {
        return msg_body.html(new_html_content_MUST_BE_XSS_SAFE); // xss-safe-value
      }
    } else if (method === 'append') {
      if (replace) {
        let parent = msg_body.parent();
        msg_body.replaceWith(this.wrap_msg_body_el(msg_body.html() + new_html_content_MUST_BE_XSS_SAFE)); // xss-reinsert // xss-safe-value
        return parent.find('.message_inner_body'); // need to return new selector - old element was replaced
      } else {
        return msg_body.append(new_html_content_MUST_BE_XSS_SAFE); // xss-safe-value
      }
    } else {
      throw new Error('Unknown update_message_body_element method:' + method);
    }
  }

  private get_sender_email = (msg_el: HTMLElement|JQuery<HTMLElement>) => {
    return ($(msg_el).closest('.gs').find('span.gD').attr('email') || '').toLowerCase();
  }

  private dom_get_msg_sender = (conversation_root_element: JQuery<HTMLElement>) => {
    return (conversation_root_element.find('h3.iw span[email]').last().attr('email') || '').trim().toLowerCase();
  }

  private dom_get_msg_recipients = (conversation_root_element: JQuery<HTMLElement>) => {
    return conversation_root_element.find('span.hb').last().find('span.g2').toArray().map(el => ($(el).attr('email') || '').toLowerCase()); // add all recipients including me
  }

  private dom_get_msg_subject = (conversation_root_element: JQuery<HTMLElement>) => {
    return $(conversation_root_element).find(this.selector.subject).text();
  }

  private get_conversation_params = (convo_root_el: JQuery<HTMLElement>) => {
    let headers = Api.common.reply_correspondents(this.account_email, this.addresses, this.dom_get_msg_sender(convo_root_el), this.dom_get_msg_recipients(convo_root_el));
    return {
      subject: this.dom_get_msg_subject(convo_root_el),
      reply_to: headers.to,
      addresses: this.addresses,
      my_email: headers.from,
      thread_id: this.determine_thread_id(convo_root_el),
      thread_message_id: this.determine_msg_id($(convo_root_el).find(this.selector.msg_inner).last()),
    };
  }

  private get_conversation_root_element = (any_inner_element: HTMLElement) => {
    return $(any_inner_element).closest('div.if, td.Bu').first();
  }

  private replace_standard_reply_box = (editable:boolean=false, force:boolean=false) => {
    let new_reply_boxes = $('div.nr.tMHS5d, td.amr > div.nr, div.gA td.I5').not('.reply_message_evaluated').filter(':visible').get();
    if (new_reply_boxes.length) {
      // cache for subseqent loop runs
      let convo_root_el = this.get_conversation_root_element(new_reply_boxes[0]);
      let do_replace = Boolean(convo_root_el.find('iframe.pgp_block').filter(':visible').length || (convo_root_el.is(':visible') && force));
      let already_has_encrypted_reply_box = Boolean(convo_root_el.find('div.reply_message_iframe_container').filter(':visible').length);
      let mid_convo_draft = false;
      if (do_replace) {
        for (let reply_box_element of new_reply_boxes.reverse()) { // looping in reverse
          let reply_box = $(reply_box_element);
          if (mid_convo_draft || already_has_encrypted_reply_box) { // either is a draft in the middle, or the convo already had (last) box replaced: should also be useless draft
            reply_box.attr('class', 'reply_message_evaluated');
            Xss.sanitize_append(reply_box, '<font>&nbsp;&nbsp;Draft skipped</font>');
            reply_box.children(':not(font)').hide();
          } else {
            let secure_reply_box_xss_safe = `<div class="remove_borders reply_message_iframe_container">${this.factory.embedded_reply(this.get_conversation_params(convo_root_el!), editable)}</div>`;
            if (reply_box.hasClass('I5')) { // activated standard reply box: cannot remove because would cause issues / gmail freezing
              let original_children = reply_box.children();
              reply_box.addClass('reply_message_evaluated').append(secure_reply_box_xss_safe); // xss-safe-factory
              if (this.gmail_variant === 'new') { // even hiding causes issues in new gmail (encrypted -> see original -> reply -> archive)
                original_children.attr('style', this.css_hidden);
              } else { // in old gmail, we can safely hide it without causing freezes navigating away
                original_children.hide();
              }
            } else { // non-activated reply box: replaced so that originally bound events would go with it (prevents inbox freezing)
              reply_box.replaceWith(secure_reply_box_xss_safe); // xss-safe-factory
            }
          }
          mid_convo_draft = true; // last box was processed first (looping in reverse), and all the rest must be drafts
        }
      }
    }
  }

  private evaluate_standard_compose_receivers = async () => {
    if (!this.currently_evaluating_standard_compose_box_recipients) {
      this.currently_evaluating_standard_compose_box_recipients = true;
      for (let standard_compose_window_element of $(this.selector.standard_compose_window).get()) {
        let standard_compose_window = $(standard_compose_window_element);
        let recipients = standard_compose_window.find('div.az9 span[email]').get().map(e => $(e).attr('email')!).filter(e => !!e);
        if (!recipients.length) {
          standard_compose_window.find('.recipients_use_encryption').remove();
        } else {
          let everyone_uses_encryption = true;
          for (let email of recipients) {
            if (email) {
              let cache = this.recipient_has_pgp_cache[email];
              if (!Str.is_email_valid(email)) {
                everyone_uses_encryption = false;
                break;
              }
              if (typeof cache === 'undefined') {
                try {
                  let {results: [result]} = await Api.attester.lookup_email([email]);
                  this.recipient_has_pgp_cache[email] = Boolean(result.pubkey); // true or false
                  if (!this.recipient_has_pgp_cache[email]) {
                    everyone_uses_encryption = false;
                    break;
                  }
                } catch (e) {
                  // this is a low-importance request, so evaluate has_pgp as false on errors
                  // this way faulty requests wouldn't unnecessarily repeat and overwhelm Attester
                  this.recipient_has_pgp_cache[email] = false;
                  everyone_uses_encryption = false;
                  break;
                }
              } else if (cache === false) {
                everyone_uses_encryption = false;
                break;
              }
            } else {
              everyone_uses_encryption = false;
              break;
            }
          }
          if (everyone_uses_encryption) {
            if (!standard_compose_window.find('.recipients_use_encryption').length) {
              let prependable = standard_compose_window.find('div.az9 span[email]').first().parents('form').first();
              prependable.prepend(this.factory.button_recipients_use_encryption('gmail')); // xss-safe-factory
              prependable.find('a').click(Ui.event.handle(() => this.injector.open_compose_window()));
            }
          } else {
            standard_compose_window.find('.recipients_use_encryption').remove();
          }
        }
      }
      this.currently_evaluating_standard_compose_box_recipients = false;
    }
  }

}
