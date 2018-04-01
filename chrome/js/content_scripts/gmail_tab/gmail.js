/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

catcher.try(() => {

  const replace_pgp_elements_interval_ms = 1000;
  let replace_pgp_elements_interval;
  let replacer;

  content_script_setup_if_vacant({
    name: 'gmail',
    get_user_account_email: () => {
      let account_email_loading_match = $("#loading div.msg").text().match(/[a-z0-9._\-]+@[^…< ]+/gi);
      if(account_email_loading_match !== null) { // try parse from loading div
        return account_email_loading_match[0].replace(/^[\s.]+|[\s.]+$/gm, '').toLowerCase();
      }
      let email_from_account_dropdown = $('div.gb_Cb > div.gb_Ib').text().trim().toLowerCase();
      if(tool.str.is_email_valid(email_from_account_dropdown) && window.location.search.indexOf('&view=btop&') === -1) { // when view=btop present, FlowCrypt should not be active
        return email_from_account_dropdown;
      }
    },
    get_user_full_name: () => $("div.gb_hb div.gb_lb").text() || $("div.gb_Fb.gb_Hb").text(),
    get_replacer: () => replacer,
    start: start,
  });

  function start(account_email, inject, notifications, factory, notify_murdered) {
    hijack_gmail_hotkeys();
    window.flowcrypt_storage.get(account_email, ['addresses', 'google_token_scopes'], storage => {
      let can_read_emails = tool.api.gmail.has_scope(storage.google_token_scopes, 'read');
      inject.buttons();
      replacer = gmail_element_replacer(factory, account_email, storage.addresses || [account_email], can_read_emails, inject);
      notifications.show_initial(account_email);
      replacer.everything();
      replace_pgp_elements_interval = TrySetDestroyableInterval(() => {
        if(typeof window.$ === 'function') {
          replacer.everything();
        } else { // firefox will unload jquery when extension is restarted or updated
          clearInterval(replace_pgp_elements_interval);
          notify_murdered();
        }
      }, replace_pgp_elements_interval_ms);
    });
  }

  function hijack_gmail_hotkeys() {
    let keys = tool.env.key_codes();
    let unsecure_reply_key_shortcuts = [keys.a, keys.r, keys.A, keys.R, keys.f, keys.F];
    $(document).keypress(e => {
      catcher.try(() => {
        let causes_unsecure_reply = tool.value(e.which).in(unsecure_reply_key_shortcuts);
        if(causes_unsecure_reply && !$(document.activeElement).is('input, select, textarea, div[contenteditable="true"]') && $('iframe.reply_message').length) {
          e.stopImmediatePropagation();
          replacer.set_reply_box_editable();
        }
      })();
    });
  }

})();