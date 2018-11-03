/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Injector } from '../../common/inject.js';
import { Catch, Value, Str, Dict } from '../../common/common.js';
import { Api } from '../../common/api.js';
import { Pgp } from '../../common/pgp.js';
import { BrowserMsg } from '../../common/extension.js';
import { Xss, Ui, XssSafeFactory, WebmailVariantString } from '../../common/browser.js';
import { Att } from '../../common/att.js';
import { WebmailElementReplacer } from './setup_webmail_content_script.js';

export class InboxElementReplacer implements WebmailElementReplacer {

  private recipient_has_pgp: Dict<boolean|null|undefined> = {}; // undefined: never checked or check failed, null: checking now, true: uses, false: doesn't use
  private addresses: string[];
  private factory: XssSafeFactory;
  private account_email: string;
  private can_read_emails: boolean;
  private injector: Injector;
  private gmail_variant: WebmailVariantString;

  private msg_text_el_selector = 'div.b5.xJNT8d';

  constructor(factory: XssSafeFactory, account_email: string, addresses: string[], can_read_emails: boolean, injector: Injector, gmail_variant: WebmailVariantString) {
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
    this.replace_atts();
  }

  set_reply_box_editable = () => {
    throw Error('not implemented');
  }

  reinsert_reply_box = (subject: string, my_email: string, reply_to: string[], thread_id: string) => {
    let params = { subject, reply_to, addresses: this.addresses, my_email, thread_id, thread_message_id: thread_id };
    $('.reply_message_iframe_container').append(this.factory.embedded_reply(params, false, true)); // xss-safe-factory
  }

  scroll_to_bottom_of_conversation = () => {
    // not implemented for Google Inbox - which will be deprecated soon
  }

  private replace_armored_blocks = () => {
    let self = this;
    $(this.msg_text_el_selector).not('.evaluated').addClass('evaluated').filter(":contains('" + Pgp.armor.headers('null').begin + "')").each((i, msg_el) => { // for each email that contains PGP block
      let msg_id = self.dom_extract_msg_id(msg_el);
      let sender_email = self.dom_extract_sender_email(msg_el);
      let is_outgoing = Value.is(sender_email).in(this.addresses);
      let replacement_xss_safe = Pgp.armor.replace_blocks(self.factory, msg_el.innerText, msg_id || '', sender_email || '', is_outgoing);  // xss-safe-factory
      if (typeof replacement_xss_safe !== 'undefined') {
        $(msg_el).parents('.ap').addClass('pgp_message_container');
        $(msg_el).html(replacement_xss_safe.replace(/^…|…$/g, '').trim()); // xss-safe-factory
      }
    });
  }

  private replace_standard_reply_box = (editable=false, force_replace_even_if_pgp_block_is_not_present=false) => {
    let self = this;
    $('div.f2FE1c').not('.reply_message_iframe_container').filter(':visible').first().each((i, reply_box) => {
      let root_element = self.dom_get_conversation_root_el(reply_box);
      if (root_element.find('iframe.pgp_block').filter(':visible').length || (root_element.is(':visible') && force_replace_even_if_pgp_block_is_not_present)) {
        let iframe_xss_safe = self.factory.embedded_reply(self.get_conversation_params(root_element), editable);
        $(reply_box).addClass('reply_message_iframe_container').html(iframe_xss_safe).children(':not(iframe)').css('display', 'none'); // xss-safe-factory
      }
    });
  }

  private replace_atts = () => {

    for(let atts_container_el of $('div.OW').get()) {
      let atts_container = $(atts_container_el);
      let new_pgp_msgs = atts_container.children(Att.methods.pgp_name_patterns().map(this.get_att_sel).join(',')).not('.evaluated').addClass('evaluated');
      if (new_pgp_msgs.length) {
        let msg_root_container = atts_container.parents('.ap');
        let msg_el = msg_root_container.find(this.msg_text_el_selector);
        let msg_id = this.dom_extract_msg_id(msg_el);
        if (msg_id) {
          if (this.can_read_emails) {
            Xss.sanitize_prepend(new_pgp_msgs, this.factory.embedded_attachment_status('Getting file info..' + Ui.spinner('green')));
            Api.gmail.msgGet(this.account_email, msg_id, 'full').then(msg => {
              this.process_atts(msg_id!, msg_el, Api.gmail.findAtts(msg), atts_container); // message_id checked right above
            }, () => $(new_pgp_msgs).find('.attachment_loader').text('Failed to load'));
          } else {
            let status_msg = 'Missing Gmail permission to decrypt attachments. <a href="#" class="auth_settings">Settings</a></div>';
            $(new_pgp_msgs).prepend(this.factory.embedded_attachment_status(status_msg)).children('a.auth_settings').click(Ui.event.handle(() => { // xss-safe-factory
              BrowserMsg.send(null, 'settings', { account_email: this.account_email, page: '/chrome/settings/modules/auth_denied.htm' });
            }));
          }
        } else {
          $(new_pgp_msgs).prepend(this.factory.embedded_attachment_status('Unknown message id')); // xss-safe-factory
        }
      }
    }
  }

  // todo - mostly the same as gmail/replace.ts
  private process_atts = (msg_id: string, msg_el: JQuery<HTMLElement>, att_metas: Att[], atts_container: JQuery<HTMLElement>|HTMLElement, skip_google_drive=false) => {
    let sender_email = this.dom_extract_sender_email(msg_el);
    let is_outgoing = Value.is(sender_email).in(this.addresses);
    atts_container = $(atts_container);
    for (let a of att_metas) {
      let treat_as = a.treat_as();
      if (treat_as !== 'standard') {
        let att_sel = (atts_container as JQuery<HTMLElement>).find(this.get_att_sel(a.name)).first();
        this.hide_att(att_sel, atts_container);
        if (treat_as === 'encrypted') { // actual encrypted attachment - show it
          (atts_container as JQuery<HTMLElement>).prepend(this.factory.embedded_attachment(a)); // xss-safe-factory
        } else if (treat_as === 'message') {
          msg_el.append(this.factory.embedded_message('', msg_id, false, sender_email || '', false)).css('display', 'block'); // xss-safe-factory
        } else if (treat_as === 'public_key') { // todo - pubkey should be fetched in pgp_pubkey.js
          Api.gmail.att_get(this.account_email, msg_id, a.id!).then(downloaded_att => {
            if (Value.is(Pgp.armor.headers('null').begin).in(downloaded_att.data)) {
              msg_el.append(this.factory.embedded_pubkey(downloaded_att.data, is_outgoing)); // xss-safe-factory
            } else {
              att_sel.css('display', 'block');
              att_sel.children('.attachment_loader').text('Unknown Public Key Format');
            }
          }).catch(e => (atts_container as JQuery<HTMLElement>).find('.attachment_loader').text('Please reload page'));
        } else if (treat_as === 'signature') {
          let embedded_signed_msg_xss_safe = this.factory.embedded_message(Str.normalize_spaces(msg_el[0].innerText).trim(), msg_id, false, sender_email || '', false, true);
          if (!msg_el.is('.evaluated') && !Value.is(Pgp.armor.headers('null').begin).in(msg_el.text())) {
            msg_el.addClass('evaluated');
            msg_el.html(embedded_signed_msg_xss_safe).css('display', 'block'); // xss-safe-factory
          } else {
            msg_el.append(embedded_signed_msg_xss_safe).css('display', 'block'); // xss-safe-factory
          }
        }
      }
    }
    let not_processed_atts_loaders = atts_container.find('.attachment_loader');
    if (!skip_google_drive && not_processed_atts_loaders.length && msg_el.find('.gmail_drive_chip, a[href^="https://drive.google.com/file"]').length) {
      // replace google drive attachments - they do not get returned by Gmail API thus did not get replaced above
      let google_drive_atts: Att[] = [];
      not_processed_atts_loaders.each((i, loader_element) => {
        try {
          let meta = $(loader_element).parent().attr('download_url')!.split(':');
          google_drive_atts.push(new Att({msg_id, name: meta[1], type: meta[0], url: meta[2] + ':' + meta[3], treat_as: 'encrypted'}));
        } catch (e) {
          Catch.report(e);
        }
      });
      this.process_atts(msg_id, msg_el, google_drive_atts, atts_container, true);
    }
  }

  private get_att_sel = (file_name_filter: string) => {
    if (file_name_filter.indexOf('*.') === 0) { // ends with
      return 'div[title*="' + file_name_filter.substr(1).replace(/@/g, '%40') + '"]';
    } else { // exact name
      return 'div[title="' + file_name_filter.replace(/@/g, '%40') + '"]';
    }
  }

  private hide_att = (atachment_element: JQuery<HTMLElement>|HTMLElement, atts_container_sel: JQuery<HTMLElement>|HTMLElement) => {
    $(atachment_element).css('display', 'none');
    if (!$(atachment_element).length) {
      $(atts_container_sel).children('.attachment_loader').text('Missing file info');
    }
  }

  private dom_get_conversation_root_el = (base_el: HTMLElement) => {
    return $(base_el).parents('.top-level-item').first();
  }

  private dom_extract_sender_email = (base_element: HTMLElement|JQuery<HTMLElement>) => {
    if ($(base_element).is('.top-level-item')) {
      return $(base_element).find('.ap').last().find('.fX').attr('email');
    } else {
      return $(base_element).parents('.ap').find('.fX').attr('email');
    }
  }

  private dom_extract_recipients = (base_element: HTMLElement|JQuery<HTMLElement>) => {
    let m;
    if ($(base_element).is('.top-level-item')) {
      m = $(base_element).find('.ap').last();
    } else {
      m = $(base_element).parents('.ap');
    }
    let recipients: string[] = [];
    m.find('.fX').siblings('span[email]').each((i, recipient_element) => {
      let email = $(recipient_element).attr('email');
      if (email) {
        recipients.push(email);
      }
    });
    return recipients;
  }

  private dom_extract_msg_id = (base_element: HTMLElement|JQuery<HTMLElement>) => {
    let inbox_msg_id_match = ($(base_element).parents('.ap').attr('data-msg-id') || '').match(/[0-9]{18,20}/g);
    if (inbox_msg_id_match) {
      return Str.int_to_hex(inbox_msg_id_match[0]);
    }
  }

  private dom_extract_subject = (conversation_root_element: HTMLElement|JQuery<HTMLElement>) => {
    return $(conversation_root_element).find('.eo').first().text();
  }

  private dom_extract_thread_id = (conversation_root_element: HTMLElement|JQuery<HTMLElement>) => {
    let inbox_thread_id_match = ($(conversation_root_element).attr('data-item-id') || '').match(/[0-9]{18,20}/g);
    if (inbox_thread_id_match) {
      return Str.int_to_hex(inbox_thread_id_match[0]);
    }
  }

  private get_conversation_params = (conversation_root_element: HTMLElement|JQuery<HTMLElement>) => {
    let thread_id = this.dom_extract_thread_id(conversation_root_element);
    let headers = Api.common.replyCorrespondents(this.account_email, this.addresses, this.dom_extract_sender_email(conversation_root_element) || '', this.dom_extract_recipients(conversation_root_element));
    return {
      subject: this.dom_extract_subject(conversation_root_element),
      reply_to: headers.to,
      addresses: this.addresses,
      my_email: headers.from,
      thread_id,
      thread_message_id: thread_id ? thread_id : this.dom_extract_msg_id($(conversation_root_element).find('.ap').last().children().first()), // backup
    };
  }

}
