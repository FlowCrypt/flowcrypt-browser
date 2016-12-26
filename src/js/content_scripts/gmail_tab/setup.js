'use strict';

function init_setup_js() {

  window.save_account_email_full_name = function(account_email) {
    // will cycle until page loads and name is accessible
    // todo - create general event on_gmail_finished_loading for similar actions
    TrySetTimeout(function() {
      var full_name = $("div.gb_hb div.gb_lb").text();
      if(full_name) {
        account_storage_set(account_email, {
          full_name: full_name
        });
      } else {
        save_account_email_full_name(account_email);
      }
    }, 1000);
  };

  window.save_account_email_full_name_if_needed = function(account_email) {
    account_storage_get(account_email, 'full_name', function(value) {
      Try(function() {
        if(typeof value === 'undefined') {
          save_account_email_full_name(account_email);
        }
      })();
    });
  };

}
