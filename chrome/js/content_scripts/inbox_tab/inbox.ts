/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

tool.catch.try(() => {

  const replace_pgp_elements_interval_ms = 1000;
  let replace_pgp_elements_interval: number;
  let replacer: InboxElementReplacer;
  let full_name = '';

  content_script_setup_if_vacant({
    name: 'inbox',
    variant: 'standard',
    get_user_account_email:  function () {
      let credentials = $('div > div > a[href="https://myaccount.google.com/privacypolicy"]').parent().siblings('div');
      if(credentials.length === 2 &&  credentials[0].innerText && credentials[1].innerText && tool.str.is_email_valid(credentials[1].innerText)) {
        let account_email = credentials[1].innerText.toLowerCase();
        full_name =  credentials[0].innerText;
        console.info('Loading for ' + account_email + ' (' + full_name + ')');
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

  function start(account_email: string, injector: Injector, notifications: Notifications, factory: Factory, notify_murdered: Callback) {
    Store.get_account(account_email, ['addresses', 'google_token_scopes']).then((storage: Dict<string[]>) => {
      let can_read_emails = tool.api.gmail.has_scope(storage.google_token_scopes, 'read');
      injector.buttons();
      replacer = new InboxElementReplacer(factory, account_email, storage.addresses || [account_email], can_read_emails, injector, null);
      notifications.show_initial(account_email);
      replacer.everything();
      replace_pgp_elements_interval = (window as ContentScriptWindow).TrySetDestroyableInterval(function () {
        if(typeof (window as FcWindow).$ === 'function') {
          replacer.everything();
        } else { // firefox will unload jquery when extension is restarted or updated
          clearInterval(replace_pgp_elements_interval);
          notify_murdered();
        }
      }, replace_pgp_elements_interval_ms);
    });
  }

})();