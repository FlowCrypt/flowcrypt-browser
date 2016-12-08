'use strict';

var url_params = get_url_params(['account_email', 'page']);

$('span#v').text(chrome.runtime.getManifest().version);

var tab_id_global = undefined;

chrome_message_get_tab_id(function(tab_id) {
  tab_id_global = tab_id;

  chrome_message_listen({
    close_page: function() {
      $('.featherlight-close').click();
    },
    add_pubkey_dialog: function(data, sender, respond) {
      var src = '/chrome/gmail_elements/add_pubkey.htm?account_email=' + encodeURIComponent(url_params.account_email) + '&emails=' + encodeURIComponent(data.emails);
      window.open(src, '_blank', 'height=680,left=100,menubar=no,status=no,toolbar=no,top=30,width=660');
    },
    notification_show: function(data) {
      alert(data.notification);
    },
    open_google_auth_dialog: function(data) {
      $('.featherlight-close').click();
      new_account_authentication_prompt(undefined, (data || {}).omit_read_scope);
    },
  }, tab_id_global); // adding tab_id_global to chrome_message_listen is necessary on cryptup-only pages because otherwise they will receive messages meant for ANY/ALL tabs

  if(url_params.page && url_params.page !== 'undefined') { // needs to be placed here, because show_settings_page needs tab_id_global for the page to work properly
    show_settings_page(url_params.page);
  }
});

if(url_params.account_email) {
  $('.email-address').text(url_params.account_email);
  $('#security_module').attr('src', 'modules/security.htm?embedded=1&account_email=' + encodeURIComponent(url_params.account_email));
  account_storage_get(url_params.account_email, ['setup_done'], function(storage) {
    if(storage.setup_done) {
      $('.hide_if_setup_not_done').css('display', 'block');
      $('.show_if_setup_not_done').css('display', 'none');
      var prv = openpgp.key.readArmored(private_storage_get(localStorage, url_params.account_email, 'master_private_key')).keys[0];
      $('.key_row_1 .key_id').text(prv.primaryKey.fingerprint.toUpperCase().substr(-8));
      $('.key_row_1 .key_date').text(month_name(prv.primaryKey.created.getMonth()) + ' ' + prv.primaryKey.created.getDate() + ', ' + prv.primaryKey.created.getFullYear());
      $('.key_row_1 .key_user').text(prv.users[0].userId.userid);
    } else {
      $('.show_if_setup_not_done').css('display', 'block');
      $('.hide_if_setup_not_done').css('display', 'none');
    }
  });
} else {
  $('.show_if_setup_not_done').css('display', 'block');
  $('.hide_if_setup_not_done').css('display', 'none');
}


function new_account_authentication_prompt(account_email, omit_read_scope) {
  account_email = account_email || '';
  chrome_message_send(null, 'google_auth', {
    account_email: account_email,
    omit_read_scope: omit_read_scope,
  }, function(response) {
    if(response.success === true) {
      add_account_email_to_list_of_accounts(response.account_email, function() {
        window.location = '/chrome/settings/setup.htm?account_email=' + encodeURIComponent(response.account_email);
      });
    } else if(response.success === false && response.result === 'denied' && response.error === 'access_denied') {
      show_settings_page('/chrome/settings/modules/auth_denied.htm');
    } else {
      console.log(response);
      alert('Something went wrong, please try again. If this happens again, please write me at tom@cryptup.org to fix it.');
      window.location.reload();
    }
  });
}

$.get('/changelog.txt', null, function(data) {
  $('.cryptup-logo-row').featherlight(data.replace(/\n/g, '<br>'));
})

$('.action_send_email').click(function() {
  window.open('https://mail.google.com');
});

$('.show_settings_page').click(function() {
  show_settings_page($(this).attr('page'));
});

function show_settings_page(page) {
  if(page !== '/chrome/gmail_elements/new_message.htm') {
    var width = Math.min(800, $('body').width() - 200);
    var variant = null;
  } else {
    var width = 542;
    var variant = 'new_message_featherlight';
  }
  $.featherlight({
    iframe: page + '?account_email=' + encodeURIComponent(url_params.account_email) + '&placement=settings&parent_tab_id=' + encodeURIComponent(tab_id_global),
    iframeWidth: width,
    iframeHeight: $('body').height() - 150,
    variant: variant,
  });
}

$('.action_add_account').click(function() {
  new_account_authentication_prompt();
});

$('.action_set_up_account').click(function() {
  new_account_authentication_prompt(url_params.account_email);
});

$('body').click(function() {
  $("#alt-accounts").removeClass("active");
  $(".ion-ios-arrow-down").removeClass("up");
  $(".add-account").removeClass("hidden");
});

$(".toggle-settings").click(function() {
  $("#settings").toggleClass("advanced");
});

$("#switch-account, #toggle-accounts-profile-img").click(function(event) {
  event.stopPropagation();
  $("#alt-accounts").toggleClass("active");
  $(".ion-ios-arrow-down").toggleClass("up");
  $(".add-account").toggleClass("hidden");
});

get_account_emails(function(account_emails) {
  $.each(account_emails, function(i, email) {
    $('#alt-accounts').prepend(menu_account_html(email));
  });
  $('.action_select_account').click(function() {
    window.location = 'index.htm?account_email=' + encodeURIComponent($(this).find('.contains_email').text());
  });
});

function menu_account_html(email, photo) {
  return [
    '<div class="row alt-accounts action_select_account">',
    '  <div class="col-sm-10 email-address">',
    '    <div class="row contains_email">' + email + '</div>',
    '  </div>',
    // '  <div class="col-sm-1 "><img class="profile-img " src="" alt=""></div>',
    '  <span class="ion-ios-checkmark"></span>',
    '</div>',
  ].join('');
}
