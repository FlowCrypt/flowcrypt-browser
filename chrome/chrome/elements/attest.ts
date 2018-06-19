/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

tool.catch.try(async () => {

  tool.ui.event.protect();

  let url_params = tool.env.url_params(['account_email', 'attest_packet', 'parent_tab_id']);
  
  let [primary_ki] = await Store.keys_get(url_params.account_email as string, ['primary']);
  abort_and_render_error_if_keyinfo_empty(primary_ki);

  let passphrase = await Store.passphrase_get(url_params.account_email as string, primary_ki.longid);
  if(passphrase !== null) {
    process_attest(passphrase);
  } else {
    $('.status').html('Pass phrase needed to process this attest message. <a href="#" class="action_passphrase">Enter pass phrase</a>');
    $('.action_passphrase').click(() => tool.browser.message.send(url_params.parent_tab_id as string, 'passphrase_dialog', {type: 'attest'}));
    let tab_id = await tool.browser.message.required_tab_id();
    tool.browser.message.listen({
      passphrase_entry: (message: {entered: boolean}, sender, respond) => {
        if(message.entered) {
          Store.passphrase_get(url_params.account_email as string, primary_ki.longid).then(process_attest);
        }
      },
    }, tab_id);
  }

  function process_attest(passphrase: string|null) {
    if(passphrase !== null) {
      $('.status').html('Verifying..' + tool.ui.spinner('green'));
      tool.browser.message.send(null, 'attest_packet_received', {
        account_email: url_params.account_email,
        packet: url_params.attest_packet,
        passphrase: passphrase,
      }, async attestation => {
        let text = await tool.str.html_as_text(attestation.result.replace(/\n/g, '<br>'));
        $('.status').addClass(attestation.success ? 'good' : 'bad').html(tool.str.html_escape(text).replace(/\n/g, '<br>'));
      });
    }
  }  

})();