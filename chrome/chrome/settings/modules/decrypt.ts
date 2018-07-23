/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

tool.catch.try(async () => {

  let url_params = tool.env.url_params(['account_email', 'parent_tab_id']);
  let account_email = tool.env.url_param_require.string(url_params, 'account_email');
  let parent_tab_id = tool.env.url_param_require.string(url_params, 'parent_tab_id');

  let tab_id = await tool.browser.message.required_tab_id();

  let original_content: string;
  let missing_passprase_longids: string[] = [];

  let attach_js = new Attach(() => ({count: 1, size: 100 * 1024 * 1024, size_mb: 100}));
  attach_js.initialize_attach_dialog('fineuploader', 'fineuploader_button');
  let factory = new Factory(account_email, tab_id);

  tool.browser.message.listen({
    close_dialog: () => {
      $('.passphrase_dialog').html('');
      Promise.all(missing_passprase_longids.map(longid => Store.passphrase_get(account_email, longid))).then(passphrases => {
        if (passphrases.filter(passphrase => passphrase !== null).length) {
          // todo - copy/pasted - unify
          // further - this approach is outdated and will not properly deal with WRONG passphrases that changed (as opposed to missing)
          // see pgp_block.js for proper common implmenetation
          missing_passprase_longids = [];
          $('.action_decrypt_and_download').click();
        }
      });
    },
  }, tab_id);

  $('.action_decrypt_and_download').click(tool.ui.event.prevent(tool.ui.event.double(), function(self) {
    let ids = attach_js.get_attachment_ids();
    if (ids.length === 1) {
      original_content = $(self).html();
      $(self).html('Decrypting.. ' + tool.ui.spinner('white'));
      attach_js.collect_attachment(ids[0]).then(decrypt_and_download);
    } else {
      alert('Please add a file to decrypt');
    }
  }));

  function decrypt_and_download(attachment: Attachment) { // todo - this is more or less copy-pasted from attachment.js, should use common function
    tool.crypto.message.decrypt(account_email, tool.str.from_uint8(attachment.content as Uint8Array), null, function(result) { // todo - don't convert to str once decrypt() can handle uint8
      if (result.success) {
        tool.file.save_to_downloads(attachment.name.replace(/\.(pgp|gpg|asc)$/i, ''), attachment.type, result.content.data);
      } else if ((result.missing_passphrases || []).length) {
        missing_passprase_longids = result.missing_passphrases as string[];
        $('.passphrase_dialog').html(factory.embedded_passphrase(missing_passprase_longids));
      } else {
        delete result.message;
        console.info(result);
        alert('These was a problem decrypting this file, details are in the console.');
      }
      $('.action_decrypt_and_download').html(original_content);
    }, 'binary');
  }

})();
