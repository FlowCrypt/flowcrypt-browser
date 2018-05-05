/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

let url_params = tool.env.url_params(['account_email', 'parent_tab_id', 'placement']);
let hash = tool.crypto.hash.sha1;
let container = $('.emails');

flowcrypt_storage.get(url_params.account_email, ['addresses'], (storage) => {
  container.html(storage.addresses.map(a => `<input type="radio" name="a" value="${tool.str.html_escape(a)}" id="${hash(a)}"> <label data-test="action-choose-address" for="${hash(a)}">${a}</label><br>`));
  container.find('input').first().prop('checked', true);
  container.find('input').click(function() {
    if($(this).val() !== storage.addresses[0]) {
      flowcrypt_storage.set(url_params.account_email, {addresses: tool.arr.unique([$(this).val()].concat(storage.addresses))}, () => window.location.reload());
    }
  });
});

$('.action_fetch_aliases').click(tool.ui.event.prevent(tool.ui.event.parallel(), function(self, id) {
  $(self).html(tool.ui.spinner('green'));
  fetch_account_aliases_from_gmail(url_params.account_email, function(addresses) {
    window.flowcrypt_storage.set(url_params.account_email, { addresses: tool.arr.unique(addresses.concat(url_params.account_email)) }, () => window.location.reload());
  });
}));

$('.action_close').click(tool.ui.event.prevent(tool.ui.event.double(), function(self) {
  tool.browser.message.send(url_params.parent_tab_id, 'close_dialog');
}));
