/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

class GmailElementReplacer implements WebmailElementReplacer {

  private recipient_has_pgp_cache: Dict<boolean> = {};
  private addresses: string[];
  private factory: Factory;
  private account_email: string;
  private can_read_emails: boolean;
  private injector: Injector;
  private notifications: Notifications;
  private gmail_variant: WebmailVariantString;
  private css_hidden = 'opacity: 0 !important; height: 1px !important; width: 1px !important; max-height: 1px !important; max-width: 1px !important; position: absolute !important; z-index: -1000 !important';
  private currently_evaluating_standard_compose_box_recipients = false;

  private selector = { // gmail_variant=standard|new
    conversation_root: 'div.if',
    subject: 'h2.hP',
    message_outer: 'div.adn',
    message_inner: 'div.a3s:not(.undefined), .message_inner_body',
    message_inner_containing_pgp: "div.a3s:not(.undefined):contains('" + tool.crypto.armor.headers('null').begin + "')",
    attachments_container_outer: 'div.hq.gt',
    attachments_container_inner: 'div.aQH',
    translate_prompt: '.adI',
    standard_compose_window: '.aaZ:visible',
  };

  constructor(factory: Factory, account_email: string, addresses: string[], can_read_emails: boolean, injector: Injector, notifications: Notifications, gmail_variant: WebmailVariantString) {
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
    this.replace_attachments().catch(tool.catch.handle_exception);
    this.replace_cryptup_tags();
    this.replace_conversation_buttons();
    this.replace_standard_reply_box();
    this.evaluate_standard_compose_receivers().catch(tool.catch.handle_exception);
  }

  set_reply_box_editable = () => {
    let reply_container_iframe = $('.reply_message_iframe_container > iframe').first();
    if (reply_container_iframe.length) {
      tool.ui.scroll(reply_container_iframe);
      reply_container_iframe.replaceWith(this.factory.embedded_reply(this.get_conversation_params(this.get_conversation_root_element(reply_container_iframe[0])), true));
    } else {
      this.replace_standard_reply_box(true);
    }
  }

  reinsert_reply_box = (subject: string, my_email: string, reply_to: string[], thread_id: string) => {
    let params = { subject, reply_to, addresses: this.addresses, my_email, thread_id, thread_message_id: thread_id };
    $('.reply_message_iframe_container:visible').last().append(this.factory.embedded_reply(params, false, true));
  }

  private replace_armored_blocks = () => {
    let emails_containing_pgp_block = $(this.selector.message_outer).find(this.selector.message_inner_containing_pgp).not('.evaluated');
    for (let email_container of emails_containing_pgp_block.get()) {
      $(email_container).addClass('evaluated');
      let sender_email = this.get_sender_email(email_container);
      let is_outgoing = tool.value(sender_email).in(this.addresses);
      let replacement = tool.crypto.armor.replace_blocks(this.factory, email_container.innerText, this.determine_message_id(email_container), sender_email, is_outgoing);
      if (typeof replacement !== 'undefined') {
        $(this.selector.translate_prompt).hide();
        let new_selector = this.update_message_body_element(email_container, 'set', replacement.replace(/\n/g, '<br>'));
      }
    }
  }

  private add_cryptup_conversation_icon = (container_selector: JQuery<HTMLElement>, icon_html: string, icon_selector: string, on_click: Callback) => {
    container_selector.addClass('appended').children('.use_secure_reply, .show_original_conversation').remove(); // remove previous FlowCrypt buttons, if any
    container_selector.append(icon_html).children(icon_selector).off().click(tool.ui.event.prevent(tool.ui.event.double(), tool.catch.try(on_click)));
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
            $(reply_button).addClass('replaced').html(''); // hide all except last
          } else {
            $(reply_button).html(this.factory.button_reply()).click(tool.ui.event.prevent(tool.ui.event.double(), tool.catch.try(this.set_reply_box_editable))); // replace last
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
            tool.ui.scroll('.reply_message_iframe_container', [100, 200, 300]);
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
          button = `<a href="#" class="open_draft_${button_href_id}">Open draft</a>`;
        } else if (name === 'draft_reply') {
          button = `<a href="#inbox/${button_href_id}">Open draft</a>`;
        }
        if (button) {
          contenteditable.replaceWith(button);
          $(`a.open_draft_${button_href_id}`).click(tool.catch.try(() => {
            $('div.new_message').remove();
            $('body').append(this.factory.embedded_compose(button_href_id));
          }));
        }
      }
    }
  }

  private replace_attachments = async () => {
    for (let attachments_container_element of $(this.selector.attachments_container_inner).get()) {
      let attachments_container = $(attachments_container_element);
      let new_pgp_attachments = this.filter_attachments(attachments_container.children().not('.evaluated'), tool.file.pgp_name_patterns()).addClass('evaluated');
      let new_pgp_attachments_names = tool.arr.from_dom_node_list(new_pgp_attachments.find('.aV3')).map(x => $.trim($(x).text()));
      if (new_pgp_attachments.length) {
        let message_id = this.determine_message_id(attachments_container);
        if (message_id) {
          if (this.can_read_emails) {
            $(new_pgp_attachments).prepend(this.factory.embedded_attachment_status('Getting file info..' + tool.ui.spinner('green')));
            try {
              let message = await tool.api.gmail.message_get(this.account_email, message_id, 'full');
              await this.process_attachments(message_id, tool.api.gmail.find_attachments(message), attachments_container, false, new_pgp_attachments_names);
            } catch (e) {
              if (tool.api.error.is_auth_popup_needed(e)) {
                this.notifications.show_auth_popup_needed(this.account_email);
              }
              $(new_pgp_attachments).find('.attachment_loader').text('Failed to load');
            }
          } else {
            let status_message = 'Missing Gmail permission to decrypt attachments. <a href="#" class="auth_settings">Settings</a></div>';
            $(new_pgp_attachments).prepend(this.factory.embedded_attachment_status(status_message)).children('a.auth_settings').click(tool.catch.try(() => {
              tool.browser.message.send(null, 'settings', { account_email: this.account_email, page: '/chrome/settings/modules/auth_denied.htm' });
            }));
          }
        } else {
          $(new_pgp_attachments).prepend(this.factory.embedded_attachment_status('Unknown message id'));
        }
      }
    }
  }

  private process_attachments = async (message_id: string, attachment_metas: Attachment[], attachments_container_inner: JQuery<HTMLElement>|HTMLElement, skip_google_drive:boolean, new_pgp_attachments_names:string[]=[]) => {
    let message_element = this.get_message_body_element(message_id);
    let sender_email = this.get_sender_email(message_element);
    let is_outgoing = tool.value(sender_email).in(this.addresses);
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
          attachments_container_inner.prepend(this.factory.embedded_attachment(a));
          rendered_attachments_count++;
        } else if (treat_as === 'message') {
          if (!(a.name === 'encrypted.asc' && !tool.value(a.name).in(new_pgp_attachments_names))) { // prevent doubling of enigmail emails
            if (a.name.substr(-4) === '.asc' && !tool.value(a.name).in(['message.asc', 'encrypted.asc'])) { // .asc files can be ambiguous. Inspect a chunk
              let file_chunk = await tool.api.gmail.attachment_get_chunk(this.account_email, message_id, a.id!); // .id is present when fetched from api
              let openpgp_type = tool.crypto.message.type(file_chunk);
              if (openpgp_type && openpgp_type.type === 'public_key' && openpgp_type.armored) { // if it looks like OpenPGP public key
                rendered_attachments_count = await this.render_public_key_from_file(a, attachments_container_inner, message_element, is_outgoing, attachment_selector, rendered_attachments_count);
              } else if (openpgp_type && tool.value(openpgp_type.type).in(['message', 'signed_message'])) {
                message_element = this.update_message_body_element(message_element, 'append', this.factory.embedded_message('', message_id, false, sender_email, false));
              } else {
                attachment_selector.show().children('.attachment_loader').text('Unknown OpenPGP format');
                rendered_attachments_count++;
              }
            }
            if (a.name && a.name !== 'noname') {
              message_element = this.update_message_body_element(message_element, 'append', this.factory.embedded_message('', message_id, false, sender_email, false));
            } else { // attachments without name are ambiguous. They may or may not be OpenPGP related. Inspect a chunk of the message to see if it looks like OpenPGP format
              let file_chunk = await tool.api.gmail.attachment_get_chunk(this.account_email, message_id, a.id!); // .id is present when fetched from api
              if (tool.crypto.message.type(file_chunk)) { // if it looks like OpenPGP, render it as a message
                message_element = this.update_message_body_element(message_element, 'append', this.factory.embedded_message('', message_id, false, sender_email, false));
              } else {
                attachment_selector.show().children('.attachment_loader').text('Unknown OpenPGP format');
                rendered_attachments_count++;
              }
            }
          }
        } else if (treat_as === 'public_key') { // todo - pubkey should be fetched in pgp_pubkey.js
          rendered_attachments_count = await this.render_public_key_from_file(a, attachments_container_inner, message_element, is_outgoing, attachment_selector, rendered_attachments_count);
        } else if (treat_as === 'signature') {
          let signed_content = message_element[0] ? tool.str.normalize_spaces(message_element[0].innerText).trim() : '';
          let embedded_signed_message = this.factory.embedded_message(signed_content, message_id, false, sender_email, false, true);
          let replace = !message_element.is('.evaluated') && !tool.value(tool.crypto.armor.headers('null').begin).in(message_element.text());
          message_element = this.update_message_body_element(message_element, replace ? 'set': 'append', embedded_signed_message);
        }
      } else if(treat_as === 'standard' && a.name.substr(-4) === '.asc') { // normal looking attachment ending with .asc
        let file_chunk = await tool.api.gmail.attachment_get_chunk(this.account_email, message_id, a.id!); // .id is present when fetched from api
        let openpgp_type = tool.crypto.message.type(file_chunk);
        if (openpgp_type && openpgp_type.type === 'public_key' && openpgp_type.armored) { // if it looks like OpenPGP public key
          rendered_attachments_count = await this.render_public_key_from_file(a, attachments_container_inner, message_element, is_outgoing, attachment_selector, rendered_attachments_count);
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
    if (!skip_google_drive && not_processed_attachments_loaders.length && message_element.find('.gmail_drive_chip, a[href^="https://drive.google.com/file"]').length) {
      // replace google drive attachments - they do not get returned by Gmail API thus did not get replaced above
      let google_drive_attachments: Attachment[] = [];
      not_processed_attachments_loaders.each((i, loader_element) => {
        let download_url = $(loader_element).parent().attr('download_url');
        if (download_url) {
          let meta = download_url.split(':');
          google_drive_attachments.push(new Attachment({message_id, name: meta[1], type: meta[0], url: `${meta[2]}:${meta[3]}`, treat_as: 'encrypted'}));
        } else {
          console.info('Missing Google Drive attachments download_url');
        }
      });
      await this.process_attachments(message_id, google_drive_attachments, attachments_container_inner, true);
    }
  }

  private render_public_key_from_file = async (attachment_meta: Attachment, attachments_container_inner: JQuery<HTMLElement>, message_element: JQuery<HTMLElement>, is_outgoing: boolean, attachment_selector: JQuery<HTMLElement>, rendered_attachments_count: number) => {
    let downloaded_attachment;
    try {
      downloaded_attachment = await tool.api.gmail.attachment_get(this.account_email, attachment_meta.message_id!, attachment_meta.id!); // .id is present when fetched from api
    } catch (e) {
      attachments_container_inner.show().addClass('attachment_processed').find('.attachment_loader').text('Please reload page');
      rendered_attachments_count++;
      return rendered_attachments_count;
    }
    let openpgp_type = tool.crypto.message.type(downloaded_attachment.data);
    if (openpgp_type && openpgp_type.type === 'public_key') {
      message_element = this.update_message_body_element(message_element, 'append', this.factory.embedded_pubkey(downloaded_attachment.data, is_outgoing));
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

  private determine_message_id = (inner_message_element: HTMLElement|JQuery<HTMLElement>) => { // todo - test and use data-message-id with Gmail API once available
    return $(inner_message_element).parents(this.selector.message_outer).attr('data-legacy-message-id') || '';
  }

  private determine_thread_id = (conversation_root_element: HTMLElement|JQuery<HTMLElement>) => { // todo - test and use data-thread-id with Gmail API once available
    return $(conversation_root_element).find(this.selector.subject).attr('data-legacy-thread-id') || '';
  }

  private get_message_body_element(message_id: string) { // todo - test
    return $(this.selector.message_outer).filter('[data-legacy-message-id="' + message_id + '"]').find(this.selector.message_inner);
  }

  private wrap_message_body_element = (html_content: string) => {
    return '<div class="message_inner_body evaluated">' + html_content + '</div>';
  }

  private update_message_body_element = (element: HTMLElement|JQuery<HTMLElement>, method:'set'|'append', new_html_content: string) => {
    // Messages in Gmail UI have to be replaced in a very particular way
    // The first time we update element, it should be completely replaced so that Gmail JS will lose reference to the original element and stop re-rendering it
    // Gmail message re-rendering causes the PGP message to flash back and forth, confusing the user and wasting cpu time
    // Subsequent times, it can be updated naturally
    let message_body = $(element);
    let replace = !message_body.is('.message_inner_body'); // not a previously replaced element, needs replacing
    if (method === 'set') {
      if (replace) {
        let parent = message_body.parent();
        message_body.replaceWith(this.wrap_message_body_element(new_html_content));
        return parent.find('.message_inner_body'); // need to return new selector - old element was replaced
      } else {
        return message_body.html(new_html_content);
      }
    } else if (method === 'append') {
      if (replace) {
        let parent = message_body.parent();
        message_body.replaceWith(this.wrap_message_body_element(message_body.html() + new_html_content));
        return parent.find('.message_inner_body'); // need to return new selector - old element was replaced
      } else {
        return message_body.append(new_html_content);
      }
    } else {
      throw new Error('Unknown update_message_body_element method:' + method);
    }
  }

  private get_sender_email = (message_element: HTMLElement|JQuery<HTMLElement>) => {
    return ($(message_element).closest('.gs').find('span.gD').attr('email') || '').toLowerCase();
  }

  private dom_get_message_sender = (conversation_root_element: JQuery<HTMLElement>) => {
    return (conversation_root_element.find('h3.iw span[email]').last().attr('email') || '').trim().toLowerCase();
  }

  private dom_get_message_recipients = (conversation_root_element: JQuery<HTMLElement>) => {
    return conversation_root_element.find('span.hb').last().find('span.g2').toArray().map(el => ($(el).attr('email') || '').toLowerCase()); // add all recipients including me
  }

  private dom_get_message_subject = (conversation_root_element: JQuery<HTMLElement>) => {
    return $(conversation_root_element).find(this.selector.subject).text();
  }

  private get_conversation_params = (convo_root_el: JQuery<HTMLElement>) => {
    let headers = tool.api.common.reply_correspondents(this.account_email, this.addresses, this.dom_get_message_sender(convo_root_el), this.dom_get_message_recipients(convo_root_el));
    return {
      subject: this.dom_get_message_subject(convo_root_el),
      reply_to: headers.to,
      addresses: this.addresses,
      my_email: headers.from,
      thread_id: this.determine_thread_id(convo_root_el),
      thread_message_id: this.determine_message_id($(convo_root_el).find(this.selector.message_inner).last()),
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
            reply_box.attr('class', 'reply_message_evaluated').append('<font>&nbsp;&nbsp;Draft skipped</font>').children(':not(font)').hide();
          } else {
            let secure_reply_box = `<div class="remove_borders reply_message_iframe_container">${this.factory.embedded_reply(this.get_conversation_params(convo_root_el!), editable)}</div>`;
            if (reply_box.hasClass('I5')) { // activated standard reply box: cannot remove because would cause issues / gmail freezing
              let original_children = reply_box.children();
              reply_box.addClass('reply_message_evaluated').append(secure_reply_box);
              if (this.gmail_variant === 'new') { // even hiding causes issues in new gmail (encrypted -> see original -> reply -> archive)
                original_children.attr('style', this.css_hidden);
              } else { // in old gmail, we can safely hide it without causing freezes navigating away
                original_children.hide();
              }
            } else { // non-activated reply box: replaced so that originally bound events would go with it (prevents inbox freezing)
              reply_box.replaceWith(secure_reply_box);
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
              if (!tool.str.is_email_valid(email)) {
                everyone_uses_encryption = false;
                break;
              }
              if (typeof cache === 'undefined') {
                try {
                  let {results: [result]} = await tool.api.attester.lookup_email([email]);
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
              standard_compose_window.find('div.az9 span[email]').first().parents('form').first().prepend(this.factory.button_recipients_use_encryption('gmail')).find('a').click(this.injector.open_compose_window);
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
