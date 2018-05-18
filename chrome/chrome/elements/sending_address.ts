/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

tool.catch.try(() => {

  let url_params = tool.env.url_params(['account_email', 'parent_tab_id', 'placement']);
  let hash = tool.crypto.hash.sha1;
  let container = $('.emails');
  
  Store.get_account(url_params.account_email as string, ['addresses']).then((storage: {addresses: string[]}) => {
    container.html(storage.addresses.map(address_to_html_radio).join(''));
    container.find('input').first().prop('checked', true);
    container.find('input').click(function() {
      if($(this).val() !== storage.addresses[0]) {
        Store.set(url_params.account_email as string, {addresses: tool.arr.unique([$(this).val()].concat(storage.addresses))}).then(() => window.location.reload());
      }
    });
  });
  
  function address_to_html_radio(a: string) {
    return `<input type="radio" name="a" value="${tool.str.html_escape(a)}" id="${hash(a)}"> <label data-test="action-choose-address" for="${hash(a)}">${a}</label><br>`;
  }

  $('.action_fetch_aliases').click(tool.ui.event.prevent(tool.ui.event.parallel(), function(self, id) {
    $(self).html(tool.ui.spinner('green'));
    fetch_account_aliases_from_gmail(url_params.account_email as string, function(addresses) {
      Store.set(url_params.account_email as string, { addresses: tool.arr.unique(addresses.concat(url_params.account_email)) }).then(() => window.location.reload());
    });
  }));
  
  $('.action_close').click(tool.ui.event.prevent(tool.ui.event.double(), function(self) {
    tool.browser.message.send(url_params.parent_tab_id as string, 'close_dialog');
  }));

})();

