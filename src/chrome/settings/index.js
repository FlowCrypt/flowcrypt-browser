/* Business Source License 1.0 © 2016 Tom James Holub (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/tomholub/cryptup-chrome/tree/master/src/LICENCE */

'use strict';

var url_params = get_url_params(['account_email', 'page', 'advanced']);

$('span#v').text(chrome.runtime.getManifest().version);

var tab_id_global = undefined;
var GMAIL_READ_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

chrome_message_get_tab_id(function (tab_id) {
  tab_id_global = tab_id;

  chrome_message_listen({
    open_page: function (data, sender, respond) {
      show_settings_page(data.page, data.add_url_text);
    },
    close_page: function () {
      $('.featherlight-close').click();
    },
    reload: function (data) {
      $('.featherlight-close').click();
      reload(data.advanced);
    },
    add_pubkey_dialog: function (data, sender, respond) {
      var src = '/chrome/gmail_elements/add_pubkey.htm?account_email=' + encodeURIComponent(url_params.account_email) + '&emails=' + encodeURIComponent(data.emails);
      window.open(src, '_blank', 'height=680,left=100,menubar=no,status=no,toolbar=no,top=30,width=660');
    },
    notification_show: function (data) {
      alert(data.notification);
    },
    open_google_auth_dialog: function (data) {
      $('.featherlight-close').click();
      new_account_authentication_prompt((data || {}).account_email, (data || {}).omit_read_scope);
    },
  }, tab_id); // adding tab_id_global to chrome_message_listen is necessary on cryptup-only pages because otherwise they will receive messages meant for ANY/ALL tabs

  initialize();

  if(url_params.page && typeof url_params.page !== 'undefined' && url_params.page !== 'undefined') { // needs to be placed here, because show_settings_page needs tab_id_global for the page to work properly
    if(url_params.page === '/chrome/settings/modules/auth_denied.htm') {
      show_settings_page(url_params.page, '&use_account_email=1');
    } else {
      show_settings_page(url_params.page);
    }
  }
});

function initialize() {
  if(url_params.account_email) {
    $('.email-address').text(url_params.account_email);
    $('#security_module').attr('src', 'modules/security.htm?embedded=1&account_email=' + encodeURIComponent(url_params.account_email) + '&parent_tab_id=' + tab_id_global);
    account_storage_get(url_params.account_email, ['setup_done', 'google_token_scopes'], function (storage) {
      if(storage.setup_done) {
        if(typeof storage.google_token_scopes === 'undefined' || storage.google_token_scopes.indexOf(GMAIL_READ_SCOPE) === -1) {
          $('.auth_denied_warning').css('display', 'block');
        }
        $('.hide_if_setup_not_done').css('display', 'block');
        $('.show_if_setup_not_done').css('display', 'none');
        var private_keys = private_keys_get(url_params.account_email);
        if(!private_keys.length) {
          render_storage_inconsistency_error(url_params.account_email, 'No private key found for this account');
        } else if(private_keys.length > 1) {
          $('.add_key').css('display', 'none');
        }
        add_key_rows_html(private_keys);
      } else {
        $('.show_if_setup_not_done').css('display', 'block');
        $('.hide_if_setup_not_done').css('display', 'none');
      }
    });
  } else {
    $('.show_if_setup_not_done').css('display', 'block');
    $('.hide_if_setup_not_done').css('display', 'none');
  }
}

function render_storage_inconsistency_error(account_email, text_reason) {
  if(!account_email) {
    throw new Error('Missing account_email to render inconsistency for');
  }
  var html = '<div class="line">CryptUP is not set up correctly for ' + account_email + ':<br/><b class="bad">' + text_reason + '</b></div>';
  html += '<div class="line">This happens when users manually change values in browser extension storage or when developers (that is myself) make a mistake.</div>';
  html += '<div class="line">Email me at tom@cryptup.org if you think this one is on me.</div>'
  html += '<div class="line">&nbsp;</div>'
  html += '<div class="line"><div class="button red reset_account">Reset cryptup for ' + account_email + '</div></div>';
  $('#settings-row').html(html);
  $('.reset_account').click(prevent(doubleclick(), function () {
    if(confirm('This will reset all your encryption settings for ' + account_email + '\n\nAre you sure?')) {
      reset_cryptup_account_storages(account_email, function () {
        window.location.reload();
      });
    }
  }));
}

function reset_cryptup_account_storages(account_email, callback) {
  if(!account_email) {
    throw new Error('Missing account_email to reset');
  }
  get_account_emails(function (account_emails) {
    if(account_emails.indexOf(account_email) === -1) {
      throw new Error('"' + account_email + '" is not a known account_email in "' + JSON.stringify(account_emails) + '"');
    }
    var keys_to_remove = [];
    var filter = account_storage_key(account_email, '');
    if(!filter) {
      throw new Error('Filter is empty for account_email"' + account_email + '"');
    }
    chrome.storage.local.get(function (storage) {
      $.each(storage, function (key, value) {
        if(key.indexOf(filter) === 0) {
          keys_to_remove.push(key.replace(filter, ''));
        }
      });
      account_storage_remove(account_email, keys_to_remove, function () {
        $.each(localStorage, function (key, value) {
          if(key.indexOf(filter) === 0) {
            private_storage_set('local', account_email, key.replace(filter, ''), undefined);
          }
        });
        $.each(sessionStorage, function (key, value) {
          if(key.indexOf(filter) === 0) {
            private_storage_set('session', account_email, key.replace(filter, ''), undefined);
          }
        });
        callback();
      });
    });
  });
}

function add_key_rows_html(private_keys) {
  var html = '';
  $.each(private_keys, function (i, keyinfo) {
    var prv = openpgp.key.readArmored(keyinfo.armored).keys[0];
    var date = month_name(prv.primaryKey.created.getMonth()) + ' ' + prv.primaryKey.created.getDate() + ', ' + prv.primaryKey.created.getFullYear();
    var primary_or_remove = (keyinfo.primary) ? '(primary)' : '(<a href="#" class="action_remove_key" longid="' + keyinfo.longid + '">remove</a>)';
    html += '<div class="row key-content-row key_' + keyinfo.longid + '">';
    html += '  <div class="col-sm-12"><a href="#" class="action_show_key" page="modules/my_key.htm" addurltext="&longid=' + keyinfo.longid + '">' + tool.str.trim_lower(prv.users[0].userId.userid) + '</a> from ' + date + '&nbsp;&nbsp;&nbsp;&nbsp;' + primary_or_remove + '</div>';
    html += '  <div class="col-sm-12">KeyWords: <span class="good">' + mnemonic(keyinfo.longid) + '</span></div>';
    html += '</div>';
  });
  $('.key_list').append(html);
  $('.action_show_key').click(function () {
    show_settings_page($(this).attr('page'), $(this).attr('addurltext') || '');
  });
  $('.action_remove_key').click(function () {
    private_keys_remove(url_params.account_email, $(this).attr('longid'));
    save_passphrase('local', url_params.account_email, $(this).attr('longid'), undefined);
    save_passphrase('session', url_params.account_email, $(this).attr('longid'), undefined);
    reload(true);
  });
}

function new_account_authentication_prompt(account_email, omit_read_scope) {
  account_email = account_email || '';
  chrome_message_send(null, 'google_auth', {
    account_email: account_email,
    omit_read_scope: omit_read_scope,
  }, function (response) {
    if(response && response.success === true) {
      add_account_email_to_list_of_accounts(response.account_email, function () {
        account_storage_get(response.account_email, ['setup_done'], function (storage) {
          if(storage.setup_done) { // this was just an additional permission
            alert('You\'re all set.');
            window.location = '/chrome/settings/index.htm?account_email=' + encodeURIComponent(response.account_email);
          } else {
            window.location = '/chrome/settings/setup.htm?account_email=' + encodeURIComponent(response.account_email);
          }
        });
      });
    } else if(response && response.success === false && ((response.result === 'denied' && response.error === 'access_denied') || response.result === 'closed')) {
      if(account_email) {
        show_settings_page('/chrome/settings/modules/auth_denied.htm', '&use_account_email=1');
      } else {
        show_settings_page('/chrome/settings/modules/auth_denied.htm');
      }
    } else {
      console.log(response);
      alert('Please try again. If this happens repeatedly, please write me at tom@cryptup.org to fix it.');
      window.location.reload();
    }
  });
}

$.get('/changelog.txt', null, function (data) {
  $('.cryptup-logo-row').featherlight(data.replace(/\n/g, '<br>'));
});

$('.action_send_email').click(function () {
  window.open('https://mail.google.com');
});

$('.show_settings_page').click(function () {
  show_settings_page($(this).attr('page'), $(this).attr('addurltext') || '');
});

$('.action_go_auth_denied').click(function () {
  show_settings_page('/chrome/settings/modules/auth_denied.htm', '&use_account_email=1');
});

$('.action_add_account').click(function () {
  new_account_authentication_prompt();
});

$('.action_set_up_account').click(function () {
  new_account_authentication_prompt(url_params.account_email);
});

$('body').click(function () {
  $("#alt-accounts").removeClass("active");
  $(".ion-ios-arrow-down").removeClass("up");
  $(".add-account").removeClass("hidden");
});

$(".toggle-settings").click(function () {
  $("#settings").toggleClass("advanced");
});

if(url_params.advanced) {
  $("#settings").toggleClass("advanced");
}

$("#switch-account, #toggle-accounts-profile-img").click(function (event) {
  event.stopPropagation();
  $("#alt-accounts").toggleClass("active");
  $(".ion-ios-arrow-down").toggleClass("up");
  $(".add-account").toggleClass("hidden");
});

get_account_emails(function (account_emails) {
  $.each(account_emails, function (i, email) {
    $('#alt-accounts').prepend(menu_account_html(email));
  });
  $('.action_select_account').click(function () {
    window.location = 'index.htm?account_email=' + encodeURIComponent($(this).find('.contains_email').text());
  });
});

function reload(advanced) {
  if(advanced) {
    window.location = '/chrome/settings/index.htm?account_email=' + encodeURIComponent(url_params.account_email) + '&advanced=1';
  } else {
    window.location.reload();
  }
}

function menu_account_html(email, photo) {
  return [
    '<div class="row alt-accounts action_select_account">',
    '  <div class="col-sm-10">',
    '    <div class="row contains_email">' + email + '</div>',
    '  </div>',
    // '  <div class="col-sm-1 "><img class="profile-img " src="" alt=""></div>',
    '  <span class="ion-ios-checkmark"></span>',
    '</div>',
  ].join('');
}
