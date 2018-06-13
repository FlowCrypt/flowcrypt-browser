/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

class InboxElementReplacer implements WebmailElementReplacer {

  private recipient_has_pgp: Dict<boolean|null|undefined> = {}; // undefined: never checked or check failed, null: checking now, true: uses, false: doesn't use
  private addresses: string[];
  private factory: Factory;
  private account_email: string;
  private can_read_emails: boolean;
  private injector: Injector;
  private gmail_variant: WebmailVariantString;

  private message_text_element_selector = 'div.b5.xJNT8d';

  constructor(factory: Factory, account_email: string, addresses: string[], can_read_emails: boolean, injector: Injector, gmail_variant: WebmailVariantString) {
    this.factory = factory;
    this.account_email = account_email;
    this.addresses = addresses;
    this.can_read_emails = can_read_emails;
    this.injector = injector;
    this.gmail_variant = gmail_variant;
  }

  everything = () => {
    this.replace_armored_blocks();
    this.replace_standard_reply_box();
    this.replace_attachments();
  };

  set_reply_box_editable = () => {
    throw Error('not implemented');
  };

  reinsert_reply_box = (subject: string, my_email: string, reply_to: string[], thread_id: string) => {
    let params = { subject: subject, reply_to: reply_to, addresses: this.addresses, my_email: my_email, thread_id: thread_id, thread_message_id: thread_id };
    $('.reply_message_iframe_container').append(this.factory.embedded_reply(params, false, true));
  };

  private replace_armored_blocks = () => {
    let self = this;
    $(this.message_text_element_selector).not('.evaluated').addClass('evaluated').filter(":contains('" + tool.crypto.armor.headers('null').begin + "')").each((i, message_element) => { // for each email that contains PGP block
      let message_id = self.dom_extract_message_id(message_element);
      let sender_email = self.dom_extract_sender_email(message_element);
      let is_outgoing = tool.value(sender_email).in(this.addresses);
      let replacement = tool.crypto.armor.replace_blocks(self.factory, message_element.innerText, message_id || '', sender_email || '', is_outgoing);
      if(typeof replacement !== 'undefined') {
        $(message_element).parents('.ap').addClass('pgp_message_container');
        $(message_element).html(replacement.replace(/^…|…$/g, '').trim().replace(/\n/g, '<br>'));
      }
    });
  };

  private replace_standard_reply_box = (editable=false, force_replace_even_if_pgp_block_is_not_present=false) => {
    let self = this;
    $('div.f2FE1c').not('.reply_message_iframe_container').filter(':visible').first().each((i, reply_box) => {
      let root_element = self.dom_get_conversation_root_element(reply_box);
      if(root_element.find('iframe.pgp_block').filter(':visible').length || (root_element.is(':visible') && force_replace_even_if_pgp_block_is_not_present)) {
        let iframe = self.factory.embedded_reply(self.get_conversation_params(root_element), editable);
        $(reply_box).addClass('reply_message_iframe_container').html(iframe).children(':not(iframe)').css('display', 'none'); //.addClass('remove_borders')
      }
    });
  };

  private replace_attachments = () => {
    let self = this;
    $('div.OW').each((i, attachments_container: JQuery<HTMLElement>|HTMLElement) => {
      attachments_container = $(attachments_container);
      let new_pgp_messages = attachments_container.children(tool.file.pgp_name_patterns().map(self.get_attachment_selector).join(',')).not('.evaluated').addClass('evaluated');
      if(new_pgp_messages.length) {
        let message_root_container = attachments_container.parents('.ap');
        let message_element = message_root_container.find(self.message_text_element_selector);
        let message_id = self.dom_extract_message_id(message_element);
        if(message_id) {
          if(self.can_read_emails) {
            $(new_pgp_messages).prepend(self.factory.embedded_attachment_status('Getting file info..' + tool.ui.spinner('green')));
            tool.api.gmail.message_get(self.account_email, message_id, 'full').then(message => {
              self.process_attachments(message_id!, message_element, tool.api.gmail.find_attachments(message), attachments_container); // message_id checked right above
            }, () => $(new_pgp_messages).find('.attachment_loader').text('Failed to load'));
          } else {
            let status_message = 'Missing Gmail permission to decrypt attachments. <a href="#" class="auth_settings">Settings</a></div>';
            $(new_pgp_messages).prepend(self.factory.embedded_attachment_status(status_message)).children('a.auth_settings').click(tool.catch.try(() => {
              tool.browser.message.send(null, 'settings', { account_email: self.account_email, page: '/chrome/settings/modules/auth_denied.htm' });
            }));
          }
        } else {
          $(new_pgp_messages).prepend(self.factory.embedded_attachment_status('Unknown message id'));
        }
      }
    });
  };

  // todo - mostly the same as gmail/replace.ts
  private process_attachments = (message_id: string, message_element: JQuery<HTMLElement>, attachment_metas: Attachment[], attachments_container: JQuery<HTMLElement>|HTMLElement, skip_google_drive=false) => {
    let sender_email = this.dom_extract_sender_email(message_element);
    let is_outgoing = tool.value(sender_email).in(this.addresses);
    attachments_container = $(attachments_container);
    for(let attachment_meta of attachment_metas) {
      if(attachment_meta.treat_as !== 'standard') {
        let attachment_selector = (attachments_container as JQuery<HTMLElement>).find(this.get_attachment_selector(attachment_meta.name)).first();
        this.hide_attachment(attachment_selector, attachments_container);
        if(attachment_meta.treat_as === 'encrypted') { // actual encrypted attachment - show it
          (attachments_container as JQuery<HTMLElement>).prepend(this.factory.embedded_attachment(attachment_meta));
        } else if(attachment_meta.treat_as === 'message') {
          message_element.append(this.factory.embedded_message('', message_id, false, sender_email || '', false)).css('display', 'block');
        } else if (attachment_meta.treat_as === 'public_key') { // todo - pubkey should be fetched in pgp_pubkey.js
          // todo - make sure attachment_meta.id present
          tool.api.gmail.attachment_get(this.account_email, message_id, attachment_meta.id!).then(downloaded_attachment => {
            let armored_key = tool.str.base64url_decode(downloaded_attachment.data!);
            if(tool.value(tool.crypto.armor.headers('null').begin).in(armored_key)) {
              message_element.append(this.factory.embedded_pubkey(armored_key, is_outgoing));
            } else {
              attachment_selector.css('display', 'block');
              attachment_selector.children('.attachment_loader').text('Unknown Public Key Format');
            }
          }).catch(e => (attachments_container as JQuery<HTMLElement>).find('.attachment_loader').text('Please reload page'));
        } else if (attachment_meta.treat_as === 'signature') {
          let embedded_signed_message = this.factory.embedded_message(tool.str.normalize_spaces(message_element[0].innerText).trim(), message_id, false, sender_email || '', false, true);
          if(!message_element.is('.evaluated') && !tool.value(tool.crypto.armor.headers('null').begin).in(message_element.text())) {
            message_element.addClass('evaluated');
            message_element.html(embedded_signed_message).css('display', 'block');
          } else {
            message_element.append(embedded_signed_message).css('display', 'block');
          }
        }
      }
    }
    let not_processed_attachments_loaders = attachments_container.find('.attachment_loader');
    if(!skip_google_drive && not_processed_attachments_loaders.length && message_element.find('.gmail_drive_chip, a[href^="https://drive.google.com/file"]').length) {
      // replace google drive attachments - they do not get returned by Gmail API thus did not get replaced above
      let google_drive_attachments: Attachment[] = [];
      not_processed_attachments_loaders.each((i, loader_element) => {
        try {
          let meta = $(loader_element).parent().attr('download_url')!.split(':');
          google_drive_attachments.push({ message_id: message_id, name: meta[1], type: meta[0], url: meta[2] + ':' + meta[3], treat_as: 'encrypted', size: 0});  
        } catch (e) {
          tool.catch.report(e);
        }
      });
      this.process_attachments(message_id, message_element, google_drive_attachments, attachments_container, true);
    }
  };

  private get_attachment_selector = (file_name_filter: string) => {
    if(file_name_filter.indexOf('*.') === 0) { // ends with
      return 'div[title*="' + file_name_filter.substr(1).replace(/@/g, '%40') + '"]';
    } else { // exact name
      return 'div[title="' + file_name_filter.replace(/@/g, '%40') + '"]';
    }
  };

  private hide_attachment = (atachment_element: JQuery<HTMLElement>|HTMLElement, attachments_container_selector: JQuery<HTMLElement>|HTMLElement) => {
    $(atachment_element).css('display', 'none');
    if(!$(atachment_element).length) {
      $(attachments_container_selector).children('.attachment_loader').text('Missing file info');
    }
  };

  private dom_get_conversation_root_element = (base_element: HTMLElement) => {
    return $(base_element).parents('.top-level-item').first();
  };

  private dom_extract_sender_email = (base_element: HTMLElement|JQuery<HTMLElement>) => {
    if($(base_element).is('.top-level-item')) {
      return $(base_element).find('.ap').last().find('.fX').attr('email');
    } else {
      return $(base_element).parents('.ap').find('.fX').attr('email');
    }
  };

  private dom_extract_recipients = (base_element: HTMLElement|JQuery<HTMLElement>) => {
    let m;
    if($(base_element).is('.top-level-item')) {
      m = $(base_element).find('.ap').last();
    } else {
      m = $(base_element).parents('.ap');
    }
    let recipients: string[] = [];
    m.find('.fX').siblings('span[email]').each((i, recipient_element) => {
      let email = $(recipient_element).attr('email');
      if(email) {
        recipients.push(email);
      }
    });
    return recipients;
  };

  private dom_extract_message_id = (base_element: HTMLElement|JQuery<HTMLElement>) => {
    let inbox_msg_id_match = ($(base_element).parents('.ap').attr('data-msg-id') || '').match(/[0-9]{18,20}/g);
    if(inbox_msg_id_match) {
      return tool.str.int_to_hex(inbox_msg_id_match[0]);
    }
  };

  private dom_extract_subject = (conversation_root_element: HTMLElement|JQuery<HTMLElement>) => {
    return $(conversation_root_element).find('.eo').first().text();
  };

  private dom_extract_thread_id = (conversation_root_element: HTMLElement|JQuery<HTMLElement>) => {
    let inbox_thread_id_match = ($(conversation_root_element).attr('data-item-id') || '').match(/[0-9]{18,20}/g);
    if(inbox_thread_id_match) {
      return tool.str.int_to_hex(inbox_thread_id_match[0]);
    }
  };

  private get_conversation_params = (conversation_root_element: HTMLElement|JQuery<HTMLElement>) => {
    let thread_id = this.dom_extract_thread_id(conversation_root_element);
    let headers = tool.api.common.reply_correspondents(this.account_email, this.addresses, this.dom_extract_sender_email(conversation_root_element) || '', this.dom_extract_recipients(conversation_root_element));
    return {
      subject: this.dom_extract_subject(conversation_root_element),
      reply_to: headers.to,
      addresses: this.addresses,
      my_email: headers.from,
      thread_id: thread_id,
      thread_message_id: thread_id ? thread_id : this.dom_extract_message_id($(conversation_root_element).find('.ap').last().children().first()), // backup
    };
  };

}

