'use strict';

function save_account_email_full_name(account_email) {
  // will cycle until page loads and name is accessible
  // todo - create general event on_gmail_finished_loading for similar actions
  setTimeout(function() {
    var full_name = $("div.gb_hb div.gb_lb").text();
    if(full_name) {
      account_storage_set(account_email, {
        full_name: full_name
      });
    } else {
      save_account_email_full_name(account_email);
    }
  }, 1000);
}

function save_account_email_full_name_if_needed(account_email) {
  account_storage_get(account_email, 'full_name', function(value) {
    if(typeof value === 'undefined') {
      save_account_email_full_name(account_email);
    }
  });
}
