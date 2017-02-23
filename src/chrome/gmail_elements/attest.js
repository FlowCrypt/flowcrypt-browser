/* Business Source License 1.0 © 2016 Tom James Holub (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/tomholub/cryptup-chrome/tree/master/src/LICENCE */

'use strict';

var url_params = tool.env.url_params(['account_email', 'attest_packet', 'parent_tab_id']);
$('.status').html('Verifying..' + tool.ui.spinner('green'));
tool.browser.message.send(null, 'attest_packet_received', { account_email: url_params.account_email, packet: url_params.attest_packet }, function(attestation) {
  $('.status').addClass(attestation.success ? 'good' : 'bad').html(tool.str.inner_text(attestation.result.replace(/\n/g, '<br>')).replace(/\n/g, '<br>'));
});