/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

let url_params = tool.env.url_params(['account_email', 'page', 'page_url_params', 'advanced']);
let tab_id_global;
let microsoft_auth_attempt = {};
let google_token_scopes;

tool.time.wait(function() { if(typeof catcher !== 'undefined') { return true; }}).then(function() {
  $('.logo-row span#v').text(catcher.version());
});

tool.env.webmails(function(webmails) {
  tool.each(webmails, function(i, webmail_name) {
    $('.signin_button.' + webmail_name).css('display', 'inline-block');
  });
});

tool.browser.message.tab_id(function (tab_id) {
  tab_id_global = tab_id;

  let factory = new Factory(url_params.account_email, tab_id);

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
      window.open(factory.src_add_pubkey_dialog(data.emails, 'settings'), '_blank', 'height=680,left=100,menubar=no,status=no,toolbar=no,top=30,width=660');
    },
    subscribe_dialog: function (data) {
      // todo: use #cryptup_dialog just like passphrase_dialog does
      window.open(factory.src_subscribe_dialog(null, 'settings_compose', null), '_blank', 'height=300,left=100,menubar=no,status=no,toolbar=no,top=30,width=640,scrollbars=no');
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
        $('body').append(factory.dialog_passphrase(data.longids, data.type));
      }
    },
    close_dialog: function (data) {
      $('#cryptup_dialog').remove();
    },
  }, tab_id); // adding tab_id_global to tool.browser.message.listen is necessary on FlowCrypt-only pages because otherwise they will receive messages meant for ANY/ALL tabs

  initialize().then(() => {
    if(url_params.page && typeof url_params.page !== 'undefined' && url_params.page !== 'undefined') { // needs to be placed here, because show_settings_page needs tab_id_global for the page to work properly
      if(url_params.page === '/chrome/settings/modules/auth_denied.htm') {
        show_settings_page(url_params.page, '&use_account_email=1');
      } else {
        show_settings_page(url_params.page, url_params.page_url_params ? JSON.parse(url_params.page_url_params) : null);
      }
    }
  });

});

function display_original(selector) {
  let filterable = $(selector);
  filterable.filter('a, b, i, img, span, input, label, select').css('display', 'inline-block');
  filterable.filter('table').css('display', 'table');
  filterable.filter('tr').css('display', 'table-row');
  filterable.filter('td').css('display', 'table-cell');
  filterable.not('a, b, i, img, span, input, label, select, table, tr, td').css('display', 'block');
}

function initialize() {
  return catcher.Promise((resolve, reject) => {
    if(url_params.account_email) {
      $('.email-address').text(url_params.account_email);
      $('#security_module').attr('src', tool.env.url_create('modules/security.htm', { account_email: url_params.account_email, parent_tab_id: tab_id_global, embedded: true }));
      window.flowcrypt_storage.get(url_params.account_email, ['setup_done', 'google_token_scopes', 'email_provider'], storage => {
        google_token_scopes = storage.google_token_scopes;
        if(storage.setup_done) {
          render_subscription_status_header();
          render_encrypted_contact_page_status();
          if(!tool.api.gmail.has_scope(storage.google_token_scopes, 'read') && (storage.email_provider || 'gmail') === 'gmail') {
            $('.auth_denied_warning').css('display', 'block');
          }
          display_original('.hide_if_setup_not_done');
          $('.show_if_setup_not_done').css('display', 'none');
          if(url_params.advanced) {
            $("#settings").toggleClass("advanced");
          }
          window.flowcrypt_storage.keys_get(url_params.account_email).then(private_keys => {
            if(private_keys.length > 4) {
              $('.key_list').css('overflow-y', 'scroll');
            }
            add_key_rows_html(private_keys);
            resolve();
          });
        } else {
          display_original('.show_if_setup_not_done');
          $('.hide_if_setup_not_done').css('display', 'none');
          resolve();
        }
      });
    } else {
      window.flowcrypt_storage.account_emails_get(function (account_emails) {
        if(account_emails && account_emails[0]) {
          window.location = tool.env.url_create('index.htm', { account_email: account_emails[0] });
        } else {
          $('.show_if_setup_not_done').css('display', 'initial');
          $('.hide_if_setup_not_done').css('display', 'none');
        }
        resolve();
      });
    }
  });
}

function render_encrypted_contact_page_status() {
  tool.api.cryptup.account_update().done((success, response) => {
    let status_container = $('.public_profile_indicator_container');
    if(success && response && response.result && response.result.alias) {
      status_container.find('.status-indicator-text').css('display', 'none');
      status_container.find('.status-indicator').addClass('active');
    } else {
      status_container.find('.status-indicator').addClass('inactive');
    }
    status_container.css('visibility', 'visible');
  });
}

function render_subscription_status_header() {
  tool.api.cryptup.account_check_sync(updated_with_new_info => {
    window.flowcrypt_storage.subscription(function (level, expire, active, method) {
      if(active) {
        $('.logo-row .subscription .level').text('advanced').css('display', 'inline-block').click(function () {
          show_settings_page('/chrome/settings/modules/account.htm');
        }).css('cursor', 'pointer');
        if(method === 'trial') {
          $('.logo-row .subscription .expire').text(expire ? ('trial until ' + expire.split(' ')[0]) : 'lifetime').css('display', 'inline-block');
          $('.logo-row .subscription .upgrade').css('display', 'inline-block');
        } else if (method === 'group') {
          $('.logo-row .subscription .expire').text('group billing').css('display', 'inline-block');
        }
      } else {
        $('.logo-row .subscription .level').text('free forever').css('display', 'inline-block');
        if(level && expire && method) {
          if(method === 'trial') {
            $('.logo-row .subscription .expire').text('trial done').css('display', 'inline-block');
          } else if(method === 'group') {
            $('.logo-row .subscription .expire').text('expired').css('display', 'inline-block');
          }
          $('.logo-row .subscription .upgrade').text('renew');
        }
        $('.logo-row .subscription .upgrade').css('display', 'inline-block');
      }
    });
  });
}

function add_key_rows_html(private_keys) {
  let html = '';
  tool.each(private_keys, function (i, keyinfo) {
    let prv = openpgp.key.readArmored(keyinfo.private).keys[0];
    let date = tool.str.month_name(prv.primaryKey.created.getMonth()) + ' ' + prv.primaryKey.created.getDate() + ', ' + prv.primaryKey.created.getFullYear();
    let primary_or_remove = (keyinfo.primary) ? '(primary)' : '(<a href="#" class="action_remove_key" longid="' + keyinfo.longid + '">remove</a>)';
    html += '<div class="row key-content-row key_' + keyinfo.longid + '">';
    html += '  <div class="col-sm-12"><a href="#" data-test="action-show-key" class="action_show_key" page="modules/my_key.htm" addurltext="&longid=' + keyinfo.longid + '">' + tool.str.parse_email(prv.users[0].userId.userid).email + '</a> from ' + date + '&nbsp;&nbsp;&nbsp;&nbsp;' + primary_or_remove + '</div>';
    html += '  <div class="col-sm-12">KeyWords: <span class="good">' + keyinfo.keywords + '</span></div>';
    html += '</div>';
  });
  $('.key_list').append(html);
  $('.action_show_key').click(function () {
    show_settings_page($(this).attr('page'), $(this).attr('addurltext') || '');
  });
  $('.action_remove_key').click(function () {
    Promise.all([
      window.flowcrypt_storage.keys_remove(url_params.account_email, $(this).attr('longid')),
      window.flowcrypt_storage.passphrase_save('local', url_params.account_email, $(this).attr('longid'), undefined),
      window.flowcrypt_storage.passphrase_save('session', url_params.account_email, $(this).attr('longid'), undefined),
    ]).then(() => reload(true));
  });
}

function new_google_account_authentication_prompt(account_email, omit_read_scope) {
  tool.api.google.auth_popup({ account_email: account_email || '', omit_read_scope: omit_read_scope, tab_id: tab_id_global }, google_token_scopes, function (response) {
    if(response && response.success === true && response.account_email) {
      window.flowcrypt_storage.account_emails_add(response.account_email, function () {
        window.flowcrypt_storage.get(response.account_email, ['setup_done'], storage => {
          if(storage.setup_done) { // this was just an additional permission
            alert('You\'re all set.');
            window.location = tool.env.url_create('/chrome/settings/index.htm', { account_email: response.account_email });
          } else {
            window.flowcrypt_storage.set(response.account_email, {email_provider: 'gmail'}, function () {
              window.location = tool.env.url_create('/chrome/settings/setup.htm', { account_email: response.account_email });
            });
          }
        });
      });
    } else if(response && response.success === false && ((response.result === 'denied' && response.error === 'access_denied') || response.result === 'closed')) {
      show_settings_page('/chrome/settings/modules/auth_denied.htm', account_email ? '&use_account_email=1&email_provider=gmail' : '');
    } else {
      catcher.log('failed to log into google', response);
      alert('Failed to connect to Gmail. Please try again. If this happens repeatedly, please write me at human@flowcrypt.com to fix it.');
      window.location.reload();
    }
  });
}

function new_microsoft_account_authentication_prompt(account_email) {
  let window_id = 'popup_' + tool.str.random(20);
  let close_auth_window = tool.api.auth.window(tool.api.outlook.oauth_url(account_email, window_id, tab_id_global, false), function () {
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

$(".action-toggle-accounts-menu").click(function (event) {
  event.stopPropagation();
  $("#alt-accounts").toggleClass("active");
  $(".ion-ios-arrow-down").toggleClass("up");
  $(".add-account").toggleClass("hidden");
});

window.flowcrypt_storage.account_emails_get(function (account_emails) {
  tool.each(account_emails, function (i, email) {
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
    '    <div class="row contains_email" data-test="action-switch-to-account">' + email + '</div>',
    '  </div>',
    // '  <div class="col-sm-1 "><img class="profile-img " src="" alt=""></div>',
    '</div>',
  ].join('');
}
