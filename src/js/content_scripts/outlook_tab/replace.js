/* Business Source License 1.0 © 2016 Tom James Holub (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/tomholub/cryptup-chrome/tree/master/src/LICENCE */

'use strict';

function outlook_element_replacer(factory, account_email, addresses) {

  function everything() {
    // replace_armored_blocks();
    // replace_standard_reply_box();
    // replace_attachments();
  }

  return {
    everything: everything,
    reinsert_reply_box: function() {},
  };

}
