/* Business Source License 1.0 © 2016 Tom James Holub (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/tomholub/cryptup-chrome/tree/master/src/LICENCE */

'use strict';

function outlook_element_replacer(factory, account_email, addresses) {

  function everything() {
    replace_armored_blocks();
    replace_standard_reply_box();
    // replace_attachments();
    //
  }

  function replace_armored_blocks() {
    //.not('.evaluated').addClass('evaluated');
    $("#Item\\.MessagePartBody, #Item\\.MessageUniqueBody, .BodyFragment, .PlainText").filter(":contains('" + tool.crypto.armor.headers().begin + "')").each(function (i, message_element) { // for each email that contains PGP block
      var message_id = dom_extract_selected_conversation_id(); // outlook does not give use message_id that we can parse from the dom. Using Convo id instead
      var sender_email = dom_extract_sender_email(message_element);
      var is_outgoing = tool.value(sender_email).in(addresses);
      var html = $(message_element.outerHTML);
      html.find('div[id^="LPBorder"]').replaceWith('<br>'); // this is preview of links that Outlook puts in. The link in pgp message comment will trigger it.
      html.find('a:contains("https://cryptup.org"), a:contains("https://cryptup.io")').replaceWith('https://cryptup.org'); // links inside pgp comment cause trouble
      var replacement = tool.crypto.armor.replace_blocks(factory, html[0].innerText, message_id, sender_email, is_outgoing);
      if(typeof replacement !== 'undefined') {
        $(message_element).parents('.ap').addClass('pgp_message_container');
        $(message_element).html(replacement.trim().replace(/\n/g, '<br>'));
      }
    });
  }

  function dom_extract_sender_email(element) {
    var sender = get_message_root_element(element).children('div[role=heading]').find('._rp_g1').text().trim();
    return sender ? tool.str.parse_email(sender).email : null;
  }

  function get_message_root_element(element) {
    return $(element).parents('div._rp_K4').first();
  }

  function dom_extract_selected_conversation_id() {
    return $('._lvv_11 div[data-convid][aria-selected=true]').attr('data-convid');
  }

  function replace_standard_reply_box(editable, force_replace_even_if_pgp_block_is_not_present) {
    $('div._rp_s6').not('.reply_message_iframe_container').filter(':visible').first().each(function (i, reply_box) {
      if($('iframe.pgp_block').filter(':visible').length || force_replace_even_if_pgp_block_is_not_present) {
        var iframe = factory.embedded.reply({thread_id: dom_extract_selected_conversation_id()}, editable);
        $(reply_box).addClass('reply_message_iframe_container').html(iframe).children(':not(iframe)').css('display', 'none');
      }
    });
  }

  return {
    everything: everything,
    reinsert_reply_box: function() {},
  };

}
