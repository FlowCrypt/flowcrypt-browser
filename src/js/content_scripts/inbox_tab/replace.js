/* Business Source License 1.0 © 2016 Tom James Holub (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/tomholub/cryptup-chrome/tree/master/src/LICENCE */

'use strict';

function gmail_element_replacer(factory, account_email, addresses, can_read_emails) {

  function everything() {
    replace_armored_blocks();
    replace_standard_reply_box();
  }

  function replace_armored_blocks() {
    $("div.xJNT8d").not('.evaluated').addClass('evaluated').filter(":contains('" + tool.crypto.armor.headers().begin + "')").each(function (i, message_element) { // for each email that contains PGP block
      var message_id = dom_extract_message_id(message_element);
      var sender_email = dom_extract_sender_email(message_element);
      var is_outgoing = tool.value(sender_email).in(addresses);
      var replacement = tool.crypto.armor.replace_blocks(factory, message_element.innerText, message_id, sender_email, is_outgoing);
      if(typeof replacement !== 'undefined') {
        $(this).html(replacement.replace(/^…|…$/g, '').trim().replace(/\n/g, '<br>'));
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
    var inbox_msg_id_match = ($(base_element).parents('.ap').attr('data-msg-id') || '').match(/[0-9]{19}/);
    if(inbox_msg_id_match) {
      return tool.str.int_to_hex(inbox_msg_id_match[0]);
    }
  }

  function dom_extract_subject(conversation_root_element) {
    return $(conversation_root_element).find('.eo').first().text();
  }

  function dom_extract_thread_id(conversation_root_element) {
    var inbox_thread_id_match = ($(conversation_root_element).attr('data-item-id') || '').match(/[0-9]{19}/);
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
      thread_message_id: thread_id ? thread_id : dom_extract_message_id($(base_element).find('.ap').last().children().first()), // backup
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
