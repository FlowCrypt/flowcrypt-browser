/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch, Env, Xss, Ui, BrowserMsg, Pgp, Attachment, DecryptErrorTypes } from '../../../js/common/common.js';
import { Attach } from '../../../js/common/attach.js';
import { XssSafeFactory } from '../../../js/common/factory.js';

Catch.try(async () => {

  let url_params = Env.url_params(['account_email', 'parent_tab_id']);
  let account_email = Env.url_param_require.string(url_params, 'account_email');
  let parent_tab_id = Env.url_param_require.string(url_params, 'parent_tab_id');

  let tab_id = await BrowserMsg.required_tab_id();

  let original_content: string;

  let attach_js = new Attach(() => ({count: 1, size: 100 * 1024 * 1024, size_mb: 100}));
  attach_js.initialize_attach_dialog('fineuploader', 'fineuploader_button');
  let factory = new XssSafeFactory(account_email, tab_id);

  BrowserMsg.listen({
    close_dialog: () => {
      $('.passphrase_dialog').text('');
    },
  }, tab_id);

  $('.action_decrypt_and_download').click(Ui.event.prevent('double', async (self) => {
    let ids = attach_js.get_attachment_ids();
    if (ids.length === 1) {
      original_content = $(self).html();
      Xss.sanitize_render(self, 'Decrypting.. ' + Ui.spinner('white'));
      let collected = await attach_js.collect_attachment(ids[0]);
      await decrypt_and_download(collected);
    } else {
      alert('Please add a file to decrypt');
    }
  }));

  let decrypt_and_download = async (encrypted: Attachment) => { // todo - this is more or less copy-pasted from attachment.js, should use common function
    let result = await Pgp.message.decrypt(account_email, encrypted.as_bytes(), null, true);
    if (result.success) {
      let attachment = new Attachment({name: encrypted.name.replace(/\.(pgp|gpg|asc)$/i, ''), type: encrypted.type, data: result.content.uint8!}); // uint8!: requested uint8 above
      Attachment.methods.save_to_downloads(attachment);
    } else if (result.error.type === DecryptErrorTypes.need_passphrase) {
      $('.passphrase_dialog').html(factory.embedded_passphrase(result.longids.need_passphrase)); // xss-safe-factory
    } else {
      delete result.message;
      console.info(result);
      alert('These was a problem decrypting this file, details are in the console.');
    }
    Xss.sanitize_render('.action_decrypt_and_download', original_content);
  };

})();
