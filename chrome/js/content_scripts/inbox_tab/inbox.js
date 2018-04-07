/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

catcher.try(() => {

  const replace_pgp_elements_interval_ms = 1000;
  let replace_pgp_elements_interval;
  let replacer;
  let full_name = '';

  content_script_setup_if_vacant({
    name: 'inbox',
    get_user_account_email:  function () {
      let credentials = $('div > div > a[href="https://myaccount.google.com/privacypolicy"]').parent().siblings('div');
      if(credentials.length === 2 &&  credentials[0].innerText && credentials[1].innerText && tool.str.is_email_valid(credentials[1].innerText)) {
        let account_email = credentials[1].innerText.toLowerCase();
        full_name =  credentials[0].innerText;
        console.log('Loading for ' + account_email + ' (' + full_name + ')');
        return account_email;
      }
    },
    get_user_full_name: function () {
      return full_name;
    },
    get_replacer: function () {
      return replacer;
    },
    start: start,
  });

  function start(account_email, inject, notifications, factory, notify_murdered) {
    window.flowcrypt_storage.get(account_email, ['addresses', 'google_token_scopes'], storage => {
      let can_read_emails = tool.api.gmail.has_scope(storage.google_token_scopes, 'read');
      inject.buttons();
      replacer = inbox_element_replacer(factory, account_email, storage.addresses || [account_email], can_read_emails);
      notifications.show_initial(account_email);
      replacer.everything();
      replace_pgp_elements_interval = TrySetDestroyableInterval(function () {
        if(typeof window.$ === 'function') {
          replacer.everything();
        } else { // firefox will unload jquery when extension is restarted or updated
          clearInterval(replace_pgp_elements_interval);
          notify_murdered();
        }
      }, replace_pgp_elements_interval_ms);
    });
  }

})();