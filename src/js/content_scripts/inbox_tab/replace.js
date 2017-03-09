/* Business Source License 1.0 © 2016 Tom James Holub (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/tomholub/cryptup-chrome/tree/master/src/LICENCE */

'use strict';

function gmail_element_replacer(factory, account_email, addresses, can_read_emails) {

  function everything() {
    replace_armored_blocks();
    replace_standard_reply_box();
    replace_attachments();
  }

  function replace_armored_blocks() {
    $("div.xJNT8d").not('.evaluated').addClass('evaluated').filter(":contains('" + tool.crypto.armor.headers().begin + "')").each(function (i, message_element) { // for each email that contains PGP block
      var message_id = dom_extract_message_id(message_element);
      var sender_email = dom_extract_sender_email(message_element);
      var is_outgoing = tool.value(sender_email).in(addresses);
      var replacement = tool.crypto.armor.replace_blocks(factory, message_element.innerText, message_id, sender_email, is_outgoing);
      if(typeof replacement !== 'undefined') {
        $(message_element).parents('.ap').addClass('pgp_message_container');
        $(message_element).html(replacement.replace(/^…|…$/g, '').trim().replace(/\n/g, '<br>'));
      }
    });
  }

  function replace_standard_reply_box(editable, force_replace_even_if_pgp_block_is_not_visible) {
    $('div.f2FE1c').not('.reply_message_iframe_container').filter(':visible').first().each(function (i, reply_box) {
      var root_element = dom_get_conversation_root_element(reply_box);
      if(root_element.find('iframe.pgp_block').filter(':visible').length || (root_element.is(':visible') && force_replace_even_if_pgp_block_is_not_visible)) {
        var iframe = factory.embedded.reply(get_conversation_params(root_element), editable);
        $(reply_box).addClass('reply_message_iframe_container').html(iframe).children(':not(iframe)').css('display', 'none'); //.addClass('remove_borders')
      }
    });
  }

  function replace_attachments() {
    $('div.OW').each(function (i, attachments_container) {
      attachments_container = $(attachments_container);
      var new_pgp_messages = attachments_container.children(['*.pgp', '*.gpg', '*.asc', 'noname', 'message'].map(get_attachment_selector).join(',')).not('.evaluated').addClass('evaluated');
      if(new_pgp_messages.length) {
        var message_root_container = attachments_container.parents('.ap');
        var message_element = message_root_container.find('div.xJNT8d');
        var message_id = dom_extract_message_id(message_element);
        if(message_id) {
          if(can_read_emails) {
            $(new_pgp_messages).prepend(factory.embedded.attachment_status('Getting file info..' + tool.ui.spinner('green')));
            tool.api.gmail.message_get(account_email, message_id, 'full', function (success, message) {
              if(success) {
                process_attachments(message_id, message_element, tool.api.gmail.find_attachments(message), attachments_container);
              } else {
                $(new_pgp_messages).find('.attachment_loader').text('Failed to load');
              }
            });
          } else {
            var status_message = 'Missing Gmail permission to decrypt attachments. <a href="#" class="auth_settings">Settings</a></div>';
            $(new_pgp_messages).prepend(factory.embedded.attachment_status(status_message)).children('a.auth_settings').click(catcher.try(function () {
              tool.browser.message.send(null, 'settings', { account_email: account_email, page: '/chrome/settings/modules/auth_denied.htm' });
            }));
          }
        } else {
          $(new_pgp_messages).prepend(factory.embedded.attachment_status('Unknown message id'));
        }
      }
    });
  }

  function process_attachments(message_id, message_element, attachment_metas, attachments_container, skip_google_drive) {
    var sender_email = dom_extract_sender_email(message_element);
    var is_outgoing = tool.value(sender_email).in(addresses);
    $.each(attachment_metas, function(i, attachment_meta) {
      if(attachment_meta.treat_as !== 'original') {
        var attachment_selector = attachments_container.find(get_attachment_selector(attachment_meta.name)).first();
        hide_attachment(attachment_selector, attachments_container);
        if(attachment_meta.treat_as === 'encrypted') { // actual encrypted attachment - show it
          attachments_container.prepend(factory.embedded.attachment(attachment_meta));
        } else if(attachment_meta.treat_as === 'message') {
          message_element.append(factory.embedded.message('', message_id, false, sender_email, false)).css('display', 'block');
        } else if (attachment_meta.treat_as === 'public_key') { // todo - pubkey should be fetched in pgp_pubkey.js
          tool.api.gmail.attachment_get(account_email, message_id, attachment_meta.id, function (success, downloaded_attachment) {
            if(success) {
              var armored_key = tool.str.base64url_decode(downloaded_attachment.data);
              if(tool.value(tool.crypto.armor.headers().begin).in(armored_key)) {
                message_element.append(factory.embedded.pubkey(armored_key, is_outgoing));
              } else {
                attachment_selector.css('display', 'block');
                attachment_selector.children('.attachment_loader').text('Unknown Public Key Format');
              }
            } else {
              attachments_container.find('.attachment_loader').text('Please reload page');
            }
          });
        } else if (attachment_meta.treat_as === 'signature') {
          var embedded_signed_message = factory.embedded.message(tool.str.normalize_spaces(message_element[0].innerText).trim(), message_id, false, sender_email, false, true);
          if(!message_element.is('.evaluated') && !tool.value(tool.crypto.armor.headers(null).begin).in(message_element.text())) {
            message_element.addClass('evaluated');
            message_element.html(embedded_signed_message).css('display', 'block');
          } else {
            message_element.append(embedded_signed_message).css('display', 'block');
          }
        }
      }
    });
    var not_processed_attachments_loaders = attachments_container.find('.attachment_loader');
    if(!skip_google_drive && not_processed_attachments_loaders.length && message_element.find('.gmail_drive_chip, a[href^="https://drive.google.com/file"]').length) {
      // replace google drive attachments - they do not get returned by Gmail API thus did not get replaced above
      var google_drive_attachments = [];
      not_processed_attachments_loaders.each(function (i, loader_element) {
        var meta = $(loader_element).parent().attr('download_url').split(':');
        google_drive_attachments.push({ message_id: message_id, name: meta[1], type: meta[0], url: meta[2] + ':' + meta[3], treat_as: 'encrypted'});
      });
      process_attachments(message_id, google_drive_attachments, attachments_container, true);
    }
  }

  function get_attachment_selector(file_name_filter) {
    if(file_name_filter.indexOf('*.') === 0) { // ends with
      return 'div[title*="' + file_name_filter.substr(1).replace(/@/g, '%40') + '"]';
    } else { // exact name
      return 'div[title="' + file_name_filter.replace(/@/g, '%40') + '"]';
    }
  }

  function hide_attachment(atachment_element, attachments_container_selector) {
    atachment_element.css('display', 'none');
    if(!atachment_element.length) {
      attachments_container_selector.children('.attachment_loader').text('Missing file info');
    }
  }

  function dom_get_conversation_root_element(base_element) {
    return $(base_element).parents('.top-level-item').first();
  }

  function dom_extract_sender_email(base_element) {
    if($(base_element).is('.top-level-item')) {
      return $(base_element).find('.ap').last().find('.fX').attr('email');
    } else {
      return $(base_element).parents('.ap').find('.fX').attr('email');
    }
  }

  function dom_extract_recipients(base_element) {
    if($(base_element).is('.top-level-item')) {
      var m = $(base_element).find('.ap').last();
    } else {
      var m = $(base_element).parents('.ap');
    }
    var recipients = [];
    m.find('.fX').siblings('span[email]').each(function(i, recipient_element) {
      recipients.push($(recipient_element).attr('email'));
    });
    return recipients;
  }

  function dom_extract_message_id(base_element) {
    var inbox_msg_id_match = ($(base_element).parents('.ap').attr('data-msg-id') || '').match(/[0-9]{18,20}/g);
    if(inbox_msg_id_match) {
      return tool.str.int_to_hex(inbox_msg_id_match[0]);
    }
  }

  function dom_extract_subject(conversation_root_element) {
    return $(conversation_root_element).find('.eo').first().text();
  }

  function dom_extract_thread_id(conversation_root_element) {
    var inbox_thread_id_match = ($(conversation_root_element).attr('data-item-id') || '').match(/[0-9]{18,20}/g);
    if(inbox_thread_id_match) {
      return tool.str.int_to_hex(inbox_thread_id_match[0]);
    }
  }

  function get_conversation_params(conversation_root_element) {
    var thread_id = dom_extract_thread_id(conversation_root_element);
    var reply_to_estimate = [dom_extract_sender_email(conversation_root_element)].concat(dom_extract_recipients(conversation_root_element));
    var reply_to = [];
    var my_email = account_email;
    $.each(reply_to_estimate, function (i, email) {
      if(tool.value(tool.str.trim_lower(email)).in(addresses)) { // my email
        my_email = email;
      } else if(!tool.value(tool.str.trim_lower(email)).in(reply_to)) { // skip duplicates
        reply_to.push(tool.str.trim_lower(email)); // reply to all except my emails
      }
    });
    if(!reply_to.length) { // happens when user sends email to itself - all reply_to_estimage contained his own emails and got removed
      reply_to = tool.arr.unique(reply_to_estimate);
    }
    return {
      subject: dom_extract_subject(conversation_root_element),
      reply_to: reply_to,
      addresses: addresses,
      my_email: my_email,
      thread_id: thread_id,
      thread_message_id: thread_id ? thread_id : dom_extract_message_id($(conversation_root_element).find('.ap').last().children().first()), // backup
    };
  }

  function reinsert_reply_box(subject, my_email, reply_to, thread_id) {
    var params = { subject: subject, reply_to: reply_to, addresses: addresses, my_email: my_email, thread_id: thread_id, thread_message_id: thread_id };
    $('.reply_message_iframe_container').append(factory.embedded.reply(params, false, true));
  }

  return {
    everything: everything,
    reinsert_reply_box: reinsert_reply_box,
  };

}
