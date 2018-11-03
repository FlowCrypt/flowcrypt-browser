/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch, Env, Dict } from '../../../js/common/common.js';
import { Att } from '../../../js/common/att.js';
import { Xss, Ui, XssSafeFactory, AttUI } from '../../../js/common/browser.js';
import { BrowserMsg } from '../../../js/common/extension.js';
import { Pgp, DecryptErrTypes } from '../../../js/common/pgp.js';

Catch.try(async () => {

  let url_params = Env.urlParams(['account_email', 'parent_tab_id']);
  let account_email = Env.url_param_require.string(url_params, 'account_email');
  let parent_tab_id = Env.url_param_require.string(url_params, 'parent_tab_id');

  let tab_id = await BrowserMsg.required_tab_id();

  let orig_content: string;

  let attach_js = new AttUI(() => ({count: 1, size: 100 * 1024 * 1024, size_mb: 100}));
  attach_js.initialize_attach_dialog('fineuploader', 'fineuploader_button');
  let factory = new XssSafeFactory(account_email, tab_id);

  BrowserMsg.listen({
    close_dialog: () => {
      $('.passphrase_dialog').text('');
    },
  }, tab_id);

  $('.action_decrypt_and_download').click(Ui.event.prevent('double', async (self) => {
    let ids = attach_js.get_att_ids();
    if (ids.length === 1) {
      orig_content = $(self).html();
      Xss.sanitizeRender(self, 'Decrypting.. ' + Ui.spinner('white'));
      let collected = await attach_js.collect_att(ids[0]);
      await decrypt_and_download(collected);
    } else {
      alert('Please add a file to decrypt');
    }
  }));

  let decrypt_and_download = async (encrypted: Att) => { // todo - this is more or less copy-pasted from att.js, should use common function
    let result = await Pgp.msg.decrypt(account_email, encrypted.asBytes(), null, true);
    if (result.success) {
      let attachment = new Att({name: encrypted.name.replace(/\.(pgp|gpg|asc)$/i, ''), type: encrypted.type, data: result.content.uint8!}); // uint8!: requested uint8 above
      Att.methods.saveToDownloads(attachment);
    } else if (result.error.type === DecryptErrTypes.need_passphrase) {
      $('.passphrase_dialog').html(factory.embedded_passphrase(result.longids.need_passphrase)); // xss-safe-factory
    } else {
      delete result.message;
      console.info(result);
      alert('These was a problem decrypting this file, details are in the console.');
    }
    Xss.sanitizeRender('.action_decrypt_and_download', orig_content);
  };

})();
