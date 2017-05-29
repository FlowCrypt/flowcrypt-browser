/* Business Source License 1.0 © 2016 FlowCrypt Limited (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/CryptUp/cryptup-browser/tree/master/src/LICENCE */

'use strict';

var url_params = tool.env.url_params(['account_email', 'page', 'advanced']);
var tab_id_global;
var microsoft_auth_attempt = {};
var google_token_scopes;

tool.time.wait(function() { if(typeof catcher !== 'undefined') { return true; }}).then(function() {
  $('.logo-row span#v').text(catcher.version());
});

tool.env.webmails(function(webmails) {
  $.each(webmails, function(i, webmail_name) {
    $('.signin_button.' + webmail_name).css('display', 'inline-block');
  });
});

tool.browser.message.tab_id(function (tab_id) {
  tab_id_global = tab_id;

  var factory = element_factory(url_params.account_email, tab_id);

  tool.browser.message.listen({
    open_page: function (data, sender, respond) {
      show_settings_page(data.page, data.add_url_text);
    },
    redirect: function (data) {
      window.location = data.location;
    },
    close_page: function () {
      $('.featherlight-close').click();
    },
    reload: function (data) {
      $('.featherlight-close').click();
      reload(data && data.advanced);
    },
    add_pubkey_dialog: function (data, sender, respond) {
      // todo: use #cryptup_dialog just like passphrase_dialog does
      window.open(factory.src.add_pubkey_dialog(data.emails, 'settings'), '_blank', 'height=680,left=100,menubar=no,status=no,toolbar=no,top=30,width=660');
    },
    subscribe_dialog: function (data) {
      // todo: use #cryptup_dialog just like passphrase_dialog does
      window.open(factory.src.subscribe_dialog(null, 'settings_compose', null), '_blank', 'height=300,left=100,menubar=no,status=no,toolbar=no,top=30,width=640,scrollbars=no');
    },
    notification_show: function (data) {
      alert(data.notification);
    },
    open_google_auth_dialog: function (data) {
      $('.featherlight-close').click();
      new_google_account_authentication_prompt((data || {}).account_email, (data || {}).omit_read_scope);
    },
    passphrase_dialog: function (data) {
      if(!$('#cryptup_dialog').length) {
        $('body').append(factory.dialog.passphrase(data.longids, data.type));
      }
    },
    close_dialog: function (data) {
      $('#cryptup_dialog').remove();
    },
    microsoft_access_token_result: function (message) {
      tool.api.auth.process_fragment(message.fragment, null, microsoft_auth_attempt.window_id, function (success, result, authed_email, state) {
        if(state.frame === microsoft_auth_attempt.window_id && state.tab === tab_id) {
          microsoft_auth_attempt.close_auth_window();
          account_storage_set(authed_email, {email_provider: 'outlook'}, function () {
            window.location = tool.env.url_create('/chrome/settings/setup.htm', { account_email: authed_email });
          });
        } else {
          console.log('Ignoring auth request with a wrong frame or tab id: ' + [microsoft_auth_attempt.window_id, tab_id, state.frame, state.tab].join(','));
        }
      });
    },
  }, tab_id); // adding tab_id_global to tool.browser.message.listen is necessary on cryptup-only pages because otherwise they will receive messages meant for ANY/ALL tabs

  initialize();

  if(url_params.page && typeof url_params.page !== 'undefined' && url_params.page !== 'undefined') { // needs to be placed here, because show_settings_page needs tab_id_global for the page to work properly
    if(url_params.page === '/chrome/settings/modules/auth_denied.htm') {
      show_settings_page(url_params.page, '&use_account_email=1');
    } else {
      show_settings_page(url_params.page);
    }
  }
});

function display_original(selector) {
  var filterable = $(selector);
  filterable.filter('a, b, i, img, span, input, label, select').css('display', 'inline-block');
  filterable.filter('table').css('display', 'table');
  filterable.filter('tr').css('display', 'table-row');
  filterable.filter('td').css('display', 'table-cell');
  filterable.not('a, b, i, img, span, input, label, select, table, tr, td').css('display', 'block');
}

function initialize() {
  if(url_params.account_email) {
    $('.email-address').text(url_params.account_email);
    $('#security_module').attr('src', tool.env.url_create('modules/security.htm', { account_email: url_params.account_email, parent_tab_id: tab_id_global, embedded: true }));
    account_storage_get(url_params.account_email, ['setup_done', 'google_token_scopes'], function (storage) {
      google_token_scopes = storage.google_token_scopes;
      if(storage.setup_done) {
        render_subscription_status_header();
        if(!tool.api.gmail.has_scope(storage.google_token_scopes, 'read')) {
          $('.auth_denied_warning').css('display', 'block');
        }
        display_original('.hide_if_setup_not_done');
        $('.show_if_setup_not_done').css('display', 'none');
        var private_keys = private_keys_get(url_params.account_email);
        if(!private_keys.length) {
          render_storage_inconsistency_error(url_params.account_email, 'No private key found for this account');
        } else if(private_keys.length > 4) {
          $('.key_list').css('overflow-y', 'scroll');
        }
        add_key_rows_html(private_keys);
      } else {
        display_original('.show_if_setup_not_done');
        $('.hide_if_setup_not_done').css('display', 'none');
      }
    });
  } else {
    get_account_emails(function (account_emails) {
      if(account_emails && account_emails[0]) {
        window.location = tool.env.url_create('index.htm', { account_email: account_emails[0] });
      } else {
        $('.show_if_setup_not_done').css('display', 'initial');
        $('.hide_if_setup_not_done').css('display', 'none');
      }
    });
  }
}

function render_subscription_status_header() {
  storage_cryptup_subscription(function (level, expire, active, method) {
    if(active) {
      $('.logo-row .subscription .level').text('advanced').css('display', 'inline-block').click(function () {
        show_settings_page('/chrome/settings/modules/account.htm');
      }).css('cursor', 'pointer');
      if(method === 'trial') {
        $('.logo-row .subscription .expire').text(expire ? ('trial until ' + expire.split(' ')[0]) : 'lifetime').css('display', 'inline-block');
        $('.logo-row .subscription .upgrade').css('display', 'inline-block');
      }
    } else {
      $('.logo-row .subscription .level').text('free forever').css('display', 'inline-block');
      $('.logo-row .subscription .upgrade').css('display', 'inline-block');
    }
  });
}

function render_storage_inconsistency_error(account_email, text_reason) {
  if(!account_email) {
    throw new Error('Missing account_email to render inconsistency for');
  }
  var html = '<div class="line">CryptUp is not set up correctly for ' + account_email + ':<br/><b class="bad">' + text_reason + '</b></div>';
  html += '<div class="line">This happens when users manually change values in browser extension storage or when developers (that is myself) make a mistake.</div>';
  html += '<div class="line">Email me at tom@cryptup.org if you think this one is on me.</div>';
  html += '<div class="line">&nbsp;</div>';
  html += '<div class="line"><div class="button red reset_account">Reset cryptup for ' + account_email + '</div></div>';
  $('#settings-row').html(html);
  $('.reset_account').click(tool.ui.event.prevent(tool.ui.event.double(), function () {
    if(confirm('This will reset all your encryption settings for ' + account_email + '\n\nAre you sure?')) {
      reset_cryptup_account_storages(account_email, function () {
        window.location.reload();
      });
    }
  }));
}

function add_key_rows_html(private_keys) {
  var html = '';
  $.each(private_keys, function (i, keyinfo) {
    var prv = openpgp.key.readArmored(keyinfo.armored).keys[0];
    var date = tool.str.month_name(prv.primaryKey.created.getMonth()) + ' ' + prv.primaryKey.created.getDate() + ', ' + prv.primaryKey.created.getFullYear();
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

function new_google_account_authentication_prompt(account_email, omit_read_scope) {
  tool.api.google.auth_popup({ account_email: account_email || '', omit_read_scope: omit_read_scope, tab_id: tab_id_global }, google_token_scopes, function (response) {
    if(response && response.success === true && response.account_email) {
      add_account_email_to_list_of_accounts(response.account_email, function () {
        account_storage_get(response.account_email, ['setup_done'], function (storage) {
          if(storage.setup_done) { // this was just an additional permission
            alert('You\'re all set.');
            window.location = tool.env.url_create('/chrome/settings/index.htm', { account_email: response.account_email });
          } else {
            account_storage_set(response.account_email, {email_provider: 'gmail'}, function () {
              window.location = tool.env.url_create('/chrome/settings/setup.htm', { account_email: response.account_email });
            });
          }
        });
      });
    } else if(response && response.success === false && ((response.result === 'denied' && response.error === 'access_denied') || response.result === 'closed')) {
      show_settings_page('/chrome/settings/modules/auth_denied.htm', account_email ? '&use_account_email=1&email_provider=gmail' : '');
    } else {
      catcher.info('failed to log into google', response);
      alert('Failed to connect to Gmail. Please try again. If this happens repeatedly, please write me at tom@cryptup.org to fix it.');
      window.location.reload();
    }
  });
}

function new_microsoft_account_authentication_prompt(account_email) {
  var window_id = 'popup_' + tool.str.random(20);
  var close_auth_window = tool.api.auth.window(tool.api.outlook.oauth_url(account_email, window_id, tab_id_global, false), function () {
    show_settings_page('/chrome/settings/modules/auth_denied.htm', account_email ? '&use_account_email=1&email_provider=outlook' : '');
  });
  microsoft_auth_attempt = {window_id: window_id, close_auth_window: close_auth_window};
}

$.get(chrome.extension.getURL('/changelog.txt'), null, function (data) {
  $('.cryptup-logo-row').featherlight(data.replace(/\n/g, '<br>'));
}, 'html');

$('.action_send_email').click(function () {
  window.open('https://mail.google.com');
});

$('.show_settings_page').click(function () {
  show_settings_page($(this).attr('page'), $(this).attr('addurltext') || '');
});

$('.action_go_auth_denied').click(function () {
  show_settings_page('/chrome/settings/modules/auth_denied.htm', '&use_account_email=1');
});

$('.action_add_account').click(tool.ui.event.prevent(tool.ui.event.double(), function () {
  // todo - should let them choose google or microsoft
  new_google_account_authentication_prompt();
}));

$('.action_google_auth').click(tool.ui.event.prevent(tool.ui.event.double(), function () {
  new_google_account_authentication_prompt(url_params.account_email);
}));

$('.action_microsoft_auth').click(tool.ui.event.prevent(tool.ui.event.double(), function () {
  new_microsoft_account_authentication_prompt(url_params.account_email);
}));

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
    window.location = tool.env.url_create('index.htm', { account_email: $(this).find('.contains_email').text() });
  });
});

function reload(advanced) {
  if(advanced) {
    window.location = tool.env.url_create('/chrome/settings/index.htm', { account_email: url_params.account_email, advanced: true });
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
    '</div>',
  ].join('');
}
