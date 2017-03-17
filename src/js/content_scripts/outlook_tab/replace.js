/* Business Source License 1.0 © 2016 Tom James Holub (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/tomholub/cryptup-chrome/tree/master/src/LICENCE */

'use strict';

function outlook_element_replacer(factory, account_email, addresses) {

  function everything() {
    replace_armored_blocks();
    // replace_standard_reply_box();
    // replace_attachments();
    //
  }

  function replace_armored_blocks() {
    $("#Item\\.MessagePartBody, #Item\\.MessageUniqueBody, .BodyFragment, .PlainText").not('.evaluated').addClass('evaluated').filter(":contains('" + tool.crypto.armor.headers().begin + "')").each(function (i, message_element) { // for each email that contains PGP block
      var message_id = null; //dom_extract_message_id(message_element);
      var sender_email = null; //dom_extract_sender_email(message_element);
      var is_outgoing = null; //tool.value(sender_email).in(addresses);
      var replacement = tool.crypto.armor.replace_blocks(factory, message_element.innerText, message_id, sender_email, is_outgoing);
      if(typeof replacement !== 'undefined') {
        $(message_element).parents('.ap').addClass('pgp_message_container');
        $(message_element).html(replacement.trim().replace(/\n/g, '<br>'));
      }
    });
  }


  return {
    everything: everything,
    reinsert_reply_box: function() {},
  };

}
