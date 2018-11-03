/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store, KeyInfo } from '../../js/common/store.js';
import { Catch, Env, Str, JQS } from '../../js/common/common.js';
import { Xss, Ui, XssSafeFactory, PassphraseDialogType } from '../../js/common/browser.js';
import { Rules } from '../../js/common/rules.js';
import { Notifications } from '../../js/common/notifications.js';
import { Settings } from './settings.js';
import { Api } from '../../js/common/api.js';
import { BrowserMsg } from '../../js/common/extension.js';

declare const openpgp: typeof OpenPGP;

Catch.try(async () => {

  let url_params = Env.url_params(['account_email', 'page', 'page_url_params', 'advanced', 'add_new_account']);
  let account_email = url_params.account_email as string|undefined;
  let page_url_params = (typeof url_params.page_url_params === 'string') ? JSON.parse(url_params.page_url_params) : null;
  let account_emails = await Store.account_emails_get();
  let add_new_account = url_params.add_new_account === true;

  // let microsoft_auth_attempt = {};

  $('#status-row #status_v').text(`v:${String(Catch.version())}`);

  let rules = new Rules(account_email);
  if (!rules.can_backup_keys()) {
    $('.show_settings_page[page="modules/backup.htm"]').parent().remove();
    $('.settings-icons-rows').css({position: 'relative', left: '64px'}); // lost a button - center it again
  }

  for (let webmail_name of await Env.webmails()) {
    $('.signin_button.' + webmail_name).css('display', 'inline-block');
  }

  let tab_id = await BrowserMsg.required_tab_id();
  let notifications = new Notifications(tab_id);

  BrowserMsg.listen({
    open_page: (data: {page: string, add_url_text: string}, sender, respond) => {
      Settings.render_sub_page(account_email || null, tab_id, data.page, data.add_url_text);
    },
    redirect: (data: {location: string}) => {
      window.location.href = data.location;
    },
    close_page: () => {
      $('.featherlight-close').click();
    },
    reload: (data) => {
      $('.featherlight-close').click();
      reload(data && data.advanced);
    },
    add_pubkey_dialog: (data: {emails: string[]}, sender, respond) => {
      // todo: use #cryptup_dialog just like passphrase_dialog does
      let factory = new XssSafeFactory(account_email!, tab_id);
      window.open(factory.src_add_pubkey_dialog(data.emails, 'settings'), '_blank', 'height=680,left=100,menubar=no,status=no,toolbar=no,top=30,width=660');
    },
    subscribe_dialog: (data) => {
      // todo: use #cryptup_dialog just like passphrase_dialog does
      let factory = new XssSafeFactory(account_email!, tab_id);
      window.open(factory.src_subscribe_dialog(null, 'settings_compose', null), '_blank', 'height=300,left=100,menubar=no,status=no,toolbar=no,top=30,width=640,scrollbars=no');
    },
    notification_show: (data: {notification: string}) => {
      notifications.show(data.notification);
      let cleared = false;
      let clear = () => {
        if(!cleared) {
          notifications.clear();
          cleared = true;
        }
      };
      Catch.set_timeout(clear, 10000);
      $('.webmail_notifications').one('click', clear);
    },
    open_google_auth_dialog: (data) => {
      $('.featherlight-close').click();
      Settings.new_google_account_authentication_prompt(tab_id, (data || {}).account_email, (data || {}).omit_read_scope).catch(Catch.handle_exception);
    },
    passphrase_dialog: (data: {longids: string[], type: PassphraseDialogType}) => {
      if (!$('#cryptup_dialog').length) {
        let factory = new XssSafeFactory(account_email!, tab_id);
        $('body').append(factory.dialog_passphrase(data.longids, data.type)); // xss-safe-factory
      }
    },
    notification_show_auth_popup_needed: (data: {account_email: string}) => {
      notifications.show_auth_popup_needed(data.account_email);
    },
    close_dialog: (data) => {
      $('#cryptup_dialog').remove();
    },
  }, tab_id);

  let display_original = (selector: string) => {
    let filterable = $(selector);
    filterable.filter('a, b, i, img, span, input, label, select').css('display', 'inline-block');
    filterable.filter('table').css('display', 'table');
    filterable.filter('tr').css('display', 'table-row');
    filterable.filter('td').css('display', 'table-cell');
    filterable.not('a, b, i, img, span, input, label, select, table, tr, td').css('display', 'block');
  };

  let initialize = async () => {
    if(add_new_account) {
      $('.show_if_setup_not_done').css('display', 'initial');
      $('.hide_if_setup_not_done').css('display', 'none');
      await Settings.new_google_account_authentication_prompt(tab_id);
    } else if (account_email) {
      $('.email-address').text(account_email);
      $('#security_module').attr('src', Env.url_create('modules/security.htm', { account_email, parent_tab_id: tab_id, embedded: true }));
      let storage = await Store.get_account(account_email, ['setup_done', 'google_token_scopes', 'email_provider', 'picture']);
      if (storage.setup_done) {
        check_google_account().catch(Catch.handle_exception);
        check_flowcrypt_account_and_subscription_and_contact_page().catch(Catch.handle_exception);
        if(storage.picture) {
          $('img.main-profile-img').attr('src', storage.picture).on('error', Ui.event.handle(self => {
            $(self).off().attr('src', '/img/svgs/profile-icon.svg');
          }));
        }
        if (!Api.gmail.has_scope(storage.google_token_scopes as string[], 'read') && (storage.email_provider || 'gmail') === 'gmail') {
          $('.auth_denied_warning').css('display', 'block');
        }
        display_original('.hide_if_setup_not_done');
        $('.show_if_setup_not_done').css('display', 'none');
        if (url_params.advanced) {
          $("#settings").toggleClass("advanced");
        }
        let private_keys = await Store.keys_get(account_email);
        if (private_keys.length > 4) {
          $('.key_list').css('overflow-y', 'scroll');
        }
        add_key_rows_html(private_keys);
      } else {
        display_original('.show_if_setup_not_done');
        $('.hide_if_setup_not_done').css('display', 'none');
      }
    } else {
      let account_emails = await Store.account_emails_get();
      if (account_emails && account_emails[0]) {
        window.location.href = Env.url_create('index.htm', { account_email: account_emails[0] });
      } else {
        $('.show_if_setup_not_done').css('display', 'initial');
        $('.hide_if_setup_not_done').css('display', 'none');
      }
    }
  };

  let check_flowcrypt_account_and_subscription_and_contact_page = async () => {
    let status_container = $('.public_profile_indicator_container');
    try {
      await render_subscription_status_header();
    } catch(e) {
      Catch.handle_exception(e);
    }
    let auth_info = await Store.auth_info();
    if (auth_info.account_email) { // have auth email set
      try {
        let response = await Api.fc.account_update();
        $('#status-row #status_flowcrypt').text(`fc:${auth_info.account_email}:ok`);
        if (response && response.result && response.result.alias) {
          status_container.find('.status-indicator-text').css('display', 'none');
          status_container.find('.status-indicator').addClass('active');
        } else {
          status_container.find('.status-indicator').addClass('inactive');
        }
      } catch (e) {
        if (Api.error.is_auth_error(e)) {
          let action_reauth = Ui.event.handle(() => Settings.render_sub_page(account_email!, tab_id, '/chrome/elements/subscribe.htm', '&source=auth_error'));
          Xss.sanitize_render(status_container, '<a class="bad" href="#">Auth Needed</a>').find('a').click(action_reauth);
          $('#status-row #status_flowcrypt').text(`fc:${auth_info.account_email}:auth`).addClass('bad').addClass('link').click(action_reauth);
        } else if (Api.error.is_network_error(e)) {
          Xss.sanitize_render(status_container, '<a href="#">Network Error - Retry</a>').find('a').one('click', Ui.event.handle(check_flowcrypt_account_and_subscription_and_contact_page));
          $('#status-row #status_flowcrypt').text(`fc:${auth_info.account_email}:offline`);
        } else {
          status_container.text('ecp error');
          $('#status-row #status_flowcrypt').text(`fc:${auth_info.account_email}:error`).attr('title', `FlowCrypt Account Error: ${Xss.html_escape(String(e))}`);
          Catch.handle_exception(e);
        }
      }
    } else { // never set up
      status_container.find('.status-indicator').addClass('inactive');
      $('#status-row #status_flowcrypt').text(`fc:none`);
    }
    status_container.css('visibility', 'visible');
  };

  let resolve_changed_google_account = async (new_account_email: string) => {
    try {
      await Settings.refresh_account_aliases(account_email!);
      await Settings.account_storage_change_email(account_email!, new_account_email);
      alert(`Email address changed to ${new_account_email}. You should now check that your public key is properly submitted.`);
      window.location.href = Env.url_create('index.htm', { account_email: new_account_email, page: '/chrome/settings/modules/keyserver.htm' });
    } catch(e) {
      Catch.handle_exception(e);
      alert('There was an error changing google account, please write human@flowcrypt.com');
    }
  };

  let check_google_account = async () => {
    try {
      let me = await Api.gmail.users_me_profile(account_email!);
      Settings.update_profile_picture_if_missing(account_email!).catch(Catch.handle_exception);
      $('#status-row #status_google').text(`g:${me.emailAddress}:ok`);
      if(me.emailAddress !== account_email) {
        $('#status-row #status_google').text(`g:${me.emailAddress}:changed`).addClass('bad').attr('title', 'Account email address has changed');
        if(me.emailAddress && account_email) {
          if(confirm(`Your Google Account address seems to have changed from ${account_email} to ${me.emailAddress}. FlowCrypt Settings need to be updated accordingly.`)) {
            await resolve_changed_google_account(me.emailAddress);
          }
        }
      }
    } catch (e) {
      if (Api.error.is_auth_popup_needed(e)) {
        $('#status-row #status_google').text(`g:?:disconnected`).addClass('bad').attr('title', 'Not connected to Google Account, click to resolve.')
          .off().click(Ui.event.handle(() => Settings.new_google_account_authentication_prompt(tab_id, account_email)));
      } else if (Api.error.is_auth_error(e)) {
        $('#status-row #status_google').text(`g:?:auth`).addClass('bad').attr('title', 'Auth error when checking Google Account, click to resolve.')
          .off().click(Ui.event.handle(() => Settings.new_google_account_authentication_prompt(tab_id, account_email)));
      } else if (Api.error.is_network_error(e)) {
        $('#status-row #status_google').text(`g:?:offline`);
      } else {
        $('#status-row #status_google').text(`g:?:err`).addClass('bad').attr('title', `Cannot determine Google account: ${Xss.html_escape(String(e))}`);
        Catch.handle_exception(e);
      }
    }
  };

  let render_subscription_status_header = async () => {
    let liveness = '';
    try {
      await Api.fc.account_check_sync();
      liveness = 'live';
    } catch (e) {
      if (!Api.error.is_network_error(e)) {
        Catch.handle_exception(e);
        liveness = 'err';
      } else {
        liveness = 'offline';
      }
    }
    let subscription = await Store.subscription();
    $('#status-row #status_subscription').text(`s:${liveness}:${subscription.active ? 'active' : 'inactive'}-${subscription.method}:${subscription.expire}`);
    if (subscription.active) {
      $('.logo-row .subscription .level').text('advanced').css('display', 'inline-block').click(Ui.event.handle(() => Settings.render_sub_page(account_email || null, tab_id, '/chrome/settings/modules/account.htm'))).css('cursor', 'pointer');
      if (subscription.method === 'trial') {
        $('.logo-row .subscription .expire').text(subscription.expire ? ('trial ' + subscription.expire.split(' ')[0]) : 'lifetime').css('display', 'inline-block');
        $('.logo-row .subscription .upgrade').css('display', 'inline-block');
      } else if (subscription.method === 'group') {
        $('#status-row #status_google').text(`s:${liveness}:active:group`);
        $('.logo-row .subscription .expire').text('group billing').css('display', 'inline-block');
      }
    } else {
      $('.logo-row .subscription .level').text('free forever').css('display', 'inline-block');
      if (subscription.level && subscription.expire && subscription.method) {
        if (subscription.method === 'trial') {
          $('.logo-row .subscription .expire').text('trial done').css('display', 'inline-block');
        } else if (subscription.method === 'group') {
          $('.logo-row .subscription .expire').text('expired').css('display', 'inline-block');
        }
        $('.logo-row .subscription .upgrade').text('renew');
      }
      $('.logo-row .subscription .upgrade').css('display', 'inline-block');
    }
  };

  let add_key_rows_html = (private_keys: KeyInfo[]) => {
    let html = '';
    for (let i = 0; i < private_keys.length; i++) {
      let ki = private_keys[i];
      let prv = openpgp.key.readArmored(ki.private).keys[0];
      let date = Str.month_name(prv.primaryKey.created.getMonth()) + ' ' + prv.primaryKey.created.getDate() + ', ' + prv.primaryKey.created.getFullYear();
      let escaped_primary_or_remove = (ki.primary) ? '(primary)' : '(<a href="#" class="action_remove_key" longid="' + Xss.html_escape(ki.longid) + '">remove</a>)';
      let escaped_email = Xss.html_escape(Str.parse_email(prv.users[0].userId ? prv.users[0].userId!.userid : '').email);
      let escaped_link = `<a href="#" data-test="action-show-key-${i}" class="action_show_key" page="modules/my_key.htm" addurltext="&longid=${Xss.html_escape(ki.longid)}">${escaped_email}</a>`;
      html += `<div class="row key-content-row key_${Xss.html_escape(ki.longid)}">`;
      html += `  <div class="col-sm-12">${escaped_link} from ${Xss.html_escape(date)}&nbsp;&nbsp;&nbsp;&nbsp;${escaped_primary_or_remove}</div>`;
      html += `  <div class="col-sm-12">KeyWords: <span class="good">${Xss.html_escape(ki.keywords)}</span></div>`;
      html += `</div>`;
    }
    Xss.sanitize_append('.key_list', html);
    $('.action_show_key').click(Ui.event.handle(target => {
      // the UI below only gets rendered when account_email is available
      Settings.render_sub_page(account_email!, tab_id, $(target).attr('page')!, $(target).attr('addurltext') || ''); // all such elements do have page attr
    }));
    $('.action_remove_key').click(Ui.event.handle(async target => {
      // the UI below only gets rendered when account_email is available
      await Store.keys_remove(account_email!, $(target).attr('longid')!);
      await Store.passphrase_save('local', account_email!, $(target).attr('longid')!, undefined);
      await Store.passphrase_save('session', account_email!, $(target).attr('longid')!, undefined);
      reload(true);
    }));
  };

  // function new_microsoft_account_authentication_prompt(account_email) {
  //   let window_id = 'popup_' + Str.random(20);
  //   let close_auth_window = Api.auth.window(Api.outlook.oauth_url(account_email, window_id, tab_id_global, false), function() {
  //     render_settings_sub_page(account_email, tab_id, '/chrome/settings/modules/auth_denied.htm', account_email ? '&email_provider=outlook' : '');
  //   });
  //   microsoft_auth_attempt = {window_id: window_id, close_auth_window: close_auth_window};
  // }

  $.get(chrome.extension.getURL('/changelog.txt'), data => ($('#status-row #status_v') as any as JQS).featherlight(data.replace(/\n/g, '<br>')), 'html');

  $('.show_settings_page').click(Ui.event.handle(target => {
    Settings.render_sub_page(account_email!, tab_id, $(target).attr('page')!, $(target).attr('addurltext') || ''); // all such elements do have page attr
  }));

  $('.action_show_encrypted_inbox').click(Ui.event.handle(target => {
    window.location.href = Env.url_create('/chrome/settings/inbox/inbox.htm', {account_email});
  }));

  $('.action_go_auth_denied').click(Ui.event.handle(() => Settings.render_sub_page(account_email!, tab_id, '/chrome/settings/modules/auth_denied.htm')));

  $('.action_add_account').click(Ui.event.prevent('double', async () => await Settings.new_google_account_authentication_prompt(tab_id)));

  $('.action_google_auth').click(Ui.event.prevent('double', async () => await Settings.new_google_account_authentication_prompt(tab_id, account_email)));

  // $('.action_microsoft_auth').click(Ui.event.prevent('double', function() {
  //   new_microsoft_account_authentication_prompt(account_email);
  // }));

  $('body').click(Ui.event.handle(() => {
    $("#alt-accounts").removeClass("active");
    $(".ion-ios-arrow-down").removeClass("up");
    $(".add-account").removeClass("hidden");
  }));

  $(".toggle-settings").click(Ui.event.handle(() => {
    $("#settings").toggleClass("advanced");
  }));

  $(".action-toggle-accounts-menu").click(Ui.event.handle((target, event) => {
    event.stopPropagation();
    $("#alt-accounts").toggleClass("active");
    $(".ion-ios-arrow-down").toggleClass("up");
    $(".add-account").toggleClass("hidden");
  }));

  $('#status-row #status_google').click(Ui.event.handle(() => Settings.render_sub_page(account_email!, tab_id, '/chrome/settings/modules/debug_api.htm', {which: 'google_account'})));
  // $('#status-row #status_flowcrypt').click(Ui.event.handle(() => Settings.render_sub_page(account_email!, tab_id, '/chrome/settings/modules/debug_api.htm', {which: 'flowcrypt_account'})));
  // $('#status-row #status_subscription').click(Ui.event.handle(() => Settings.render_sub_page(account_email!, tab_id, '/chrome/settings/modules/debug_api.htm', {which: 'flowcrypt_subscription'})));

  let reload = (advanced=false) => {
    if (advanced) {
      window.location.href = Env.url_create('/chrome/settings/index.htm', { account_email, advanced: true });
    } else {
      window.location.reload();
    }
  };

  let menu_account_html = (email: string, picture='/img/svgs/profile-icon.svg') => {
    return [
      '<div class="row alt-accounts action_select_account">',
      '  <div class="col-sm-10">',
      `    <div class="row contains_email" data-test="action-switch-to-account">${Xss.html_escape(email)}</div>`,
      '  </div>',
      `  <div><img class="profile-img" src="${Xss.html_escape(picture)}" alt=""></div>`,
      '</div>',
    ].join('');
  };

  await initialize();
  await Ui.abort_and_render_error_on_unprotected_key(account_email, tab_id);
  if (url_params.page && typeof url_params.page !== 'undefined' && url_params.page !== 'undefined') {
    if (url_params.page === '/chrome/settings/modules/auth_denied.htm') {
      Settings.render_sub_page(account_email || null, tab_id, url_params.page);
    } else {
      Settings.render_sub_page(account_email || null, tab_id, url_params.page as string, page_url_params);
    }
  }

  let account_storages = await Store.get_accounts(account_emails, ['picture']);
  for (let email of account_emails) {
    Xss.sanitize_prepend('#alt-accounts', menu_account_html(email, account_storages[email].picture));
  }
  $('#alt-accounts img.profile-img').on('error', Ui.event.handle(self => {
    $(self).off().attr('src', '/img/svgs/profile-icon.svg');
  }));
  $('.action_select_account').click(Ui.event.handle(target => {
    window.location.href = Env.url_create('index.htm', { account_email: $(target).find('.contains_email').text() });
  }));

})();
