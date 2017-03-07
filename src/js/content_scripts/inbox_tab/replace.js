/* Business Source License 1.0 © 2016 Tom James Holub (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/tomholub/cryptup-chrome/tree/master/src/LICENCE */

'use strict';

function gmail_element_replacer(factory, account_email, addresses, can_read_emails) {

  function everything() {
    replace_armored_blocks();
  }

  function replace_armored_blocks() {
    $("div.F3hlO").not('.evaluated').addClass('evaluated').filter(":contains('" + tool.crypto.armor.headers().begin + "')").each(function () { // for each email that contains PGP block
      // todo - below
      var message_id = null; //determine_message_id('message', this);
      var sender_email = null; //get_sender_email(this);
      var is_outgoing = false; //tool.value(sender_email).in(addresses);
      var replacement = tool.crypto.armor.replace_blocks(factory, this.innerText, message_id, sender_email, is_outgoing);
      if(typeof replacement !== 'undefined') {
        $(this).html(replacement.replace(/\n/g, '<br>'));
      }
    });
  }

  return {
    everything: everything,
  };

}
