/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

tool.catch.try(async () => {

  let url_params = tool.env.url_params(['account_email', 'parent_tab_id']);
  let account_email = tool.env.url_param_require.string(url_params, 'account_email');
  let parent_tab_id = tool.env.url_param_require.string(url_params, 'parent_tab_id');

  openpgp.config.ignore_mdc_error = true; // will only affect OpenPGP in local frame

  let tab_id = await tool.browser.message.required_tab_id();

  let original_content: string;

  let factory = new Factory(account_email, tab_id);

  tool.browser.message.listen({
    close_dialog: () => {
      $('.passphrase_dialog').text('');
    },
  }, tab_id);

  $('.action_decrypt').click(tool.ui.event.prevent(tool.ui.event.double(), async self => {
    let encrypted = $('.input_message').val() as string;
    if (!encrypted) {
      alert('Please paste an encrypted message');
      return;
    }
    original_content = $(self).html();
    tool.ui.sanitize_render(self, 'Decrypting.. ' + tool.ui.spinner('white'));
    let result = await tool.crypto.message.decrypt(account_email, encrypted);
    if (result.success) {
      alert(`MESSAGE CONTENT BELOW\n---------------------------------------------------------\n${result.content.text!}`);
    } else if (result.error.type === DecryptErrorTypes.need_passphrase) {
      $('.passphrase_dialog').html(factory.embedded_passphrase(result.longids.need_passphrase)); // xss-safe-factory
    } else {
      delete result.message;
      console.info(result);
      alert('These was a problem decrypting this file, details are in the console.');
    }
    tool.ui.sanitize_render(self, original_content);
  }));

})();
