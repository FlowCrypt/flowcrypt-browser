'use strict';

var url_params = get_url_params(['account_email']);

$('span#v').text(chrome.runtime.getManifest().version);

var tab_id_global = undefined;

chrome_message_get_tab_id(function(tab_id) {
  tab_id_global = tab_id;
});

chrome_message_listen({
  close_page: function(data) {
    $('.featherlight-close').click();
  },
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


function new_account_authentication_prompt(account_email) {
  account_email = account_email || '';
  chrome_message_send(null, 'google_auth', {
    account_email: account_email,
  }, function(response) {
    if(response.success === true) {
      add_account_email_to_list_of_accounts(response.account_email, function() {
        window.location = '/chrome/settings/setup.htm?account_email=' + encodeURIComponent(response.account_email);
      });
    } else if(response.success === false && response.result === 'denied' && response.error === 'access_denied') {
      alert('Why CryptUP needs this permission:\n\n - to compose messages safely\n - to retrieve and decrypt opened messages seamlessly\n - to send and open encrypted attachments\n\nNobody, CryptUP developers included, is able to access these permissions, they are stored privately in your browser.\n\n');
      window.location.reload();
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
  if($(this).attr('page') !== '/chrome/gmail_elements/new_message.htm') {
    var width = Math.min(800, $('body').width() - 200);
    var variant = null;
  } else {
    var width = 542;
    var variant = 'new_message_featherlight';
  }
  $.featherlight({
    iframe: $(this).attr('page') + '?account_email=' + encodeURIComponent(url_params.account_email) + '&placement=settings&parent_tab_id=' + encodeURIComponent(tab_id_global),
    iframeWidth: width,
    iframeHeight: $('body').height() - 150,
    variant: variant,
  });
});

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
