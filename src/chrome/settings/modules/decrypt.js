/* Business Source License 1.0 © 2016 Tom James Holub (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/tomholub/cryptup-chrome/tree/master/src/LICENCE */

'use strict';

var url_params = tool.env.url_params(['account_email', 'parent_tab_id']);

db_open(function (db) {
  tool.browser.message.tab_id(function (tab_id) {

    var original_content;
    var missing_passprase_longids = [];

    var attach_js = init_shared_attach_js(100, 1);
    attach_js.initialize_attach_dialog('fineuploader', 'fineuploader_button');
    var factory = init_elements_factory_js(url_params.account_email, url_params.parent_tab_id, '');

    tool.browser.message.listen({
      close_dialog: function () {
        $('.passphrase_dialog').html('');
        $.each(missing_passprase_longids, function (i, longid) {
          // todo - copy pasted from attachment.js, unify into a single function
          // further - this approach is outdated and will not properly deal with WRONG passphrases that changed (as opposed to missing)
          // see pgp_block.js for proper common implmenetation
          if(missing_passprase_longids && get_passphrase(url_params.account_email, longid) !== null) {
            missing_passprase_longids = [];
            $('.action_decrypt_and_download').click();
            return false;
          }
        });
      },
    }, tab_id);

    $('.action_decrypt_and_download').click(tool.ui.event.prevent(tool.ui.event.double(), function (self) {
      var ids = attach_js.get_attachment_ids();
      if(ids.length === 1) {
        original_content = $(self).html();
        $(self).html('Decrypting.. ' + tool.ui.spinner());
        attach_js.collect_attachment(ids[0], decrypt_and_download);
      } else {
        alert('Please add a file to decrypt');
      }
    }));

    function decrypt_and_download(attachment) { // todo - this is more or less copy-pasted from attachment.js, should use common function
      tool.crypto.message.decrypt(db, url_params.account_email, tool.str.from_uint8(attachment.content), undefined, function (result) { // todo - don't convert to str once decrypt() can handle uint8
        if(result.success) {
          tool.file.save_to_downloads(attachment.name.replace(/(\.pgp)|(\.gpg)$/, ''), attachment.type, result.content.data);
        } else if((result.missing_passphrases || []).length) {
          missing_passprase_longids = result.missing_passphrases;
          $('.passphrase_dialog').html(factory.embedded.passphrase(missing_passprase_longids));
        } else {
          delete result.message;
          console.log(result);
          alert('These was a problem decrypting this file, details are in the console.');
        }
        $('.action_decrypt_and_download').html(original_content);
      });
    }

  });
});
