/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store, KeyInfo } from '../../js/common/store.js';
import { Catch, Env, Str, JQS } from '../../js/common/common.js';
import { Xss, Ui, XssSafeFactory, PassphraseDialogType } from '../../js/common/browser.js';
import { Rules } from '../../js/common/rules.js';
import { Notifications } from '../../js/common/notifications.js';
import { Settings } from '../../js/common/settings.js';
import { Api } from '../../js/common/api.js';
import { BrowserMsg } from '../../js/common/extension.js';

declare const openpgp: typeof OpenPGP;

Catch.try(async () => {

  let urlParams = Env.urlParams(['acctEmail', 'page', 'pageUrlParams', 'advanced', 'addNewAcct']);
  let acctEmail = urlParams.acctEmail as string|undefined;
  let pageUrlParams = (typeof urlParams.pageUrlParams === 'string') ? JSON.parse(urlParams.pageUrlParams) : null;
  let acctEmails = await Store.acctEmailsGet();
  let addNewAcct = urlParams.addNewAcct === true;

  $('#status-row #status_v').text(`v:${String(Catch.version())}`);

  let rules = new Rules(acctEmail);
  if (!rules.canBackupKeys()) {
    $('.show_settings_page[page="modules/backup.htm"]').parent().remove();
    $('.settings-icons-rows').css({position: 'relative', left: '64px'}); // lost a button - center it again
  }

  for (let webmailLName of await Env.webmails()) {
    $('.signin_button.' + webmailLName).css('display', 'inline-block');
  }

  let tabId = await BrowserMsg.requiredTabId();
  let notifications = new Notifications(tabId);

  BrowserMsg.listen({
    open_page: (data: {page: string, addUrlText: string}, sender, respond) => {
      Settings.renderSubPage(acctEmail || null, tabId, data.page, data.addUrlText);
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
      let factory = new XssSafeFactory(acctEmail!, tabId);
      window.open(factory.srcAddPubkeyDialog(data.emails, 'settings'), '_blank', 'height=680,left=100,menubar=no,status=no,toolbar=no,top=30,width=660');
    },
    subscribe_dialog: (data) => {
      // todo: use #cryptup_dialog just like passphrase_dialog does
      let factory = new XssSafeFactory(acctEmail!, tabId);
      window.open(factory.srcSubscribeDialog(null, 'settings_compose', null), '_blank', 'height=300,left=100,menubar=no,status=no,toolbar=no,top=30,width=640,scrollbars=no');
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
      Catch.setHandledTimeout(clear, 10000);
      $('.webmail_notifications').one('click', clear);
    },
    open_google_auth_dialog: (data) => {
      $('.featherlight-close').click();
      Settings.newGoogleAcctAuthPrompt(tabId, (data || {}).acctEmail, (data || {}).omitReadScope).catch(Catch.handleException);
    },
    passphrase_dialog: (data: {longids: string[], type: PassphraseDialogType}) => {
      if (!$('#cryptup_dialog').length) {
        let factory = new XssSafeFactory(acctEmail!, tabId);
        $('body').append(factory.dialogPassphrase(data.longids, data.type)); // xss-safe-factory
      }
    },
    notification_show_auth_popup_needed: (data: {acctEmail: string}) => {
      notifications.showAuthPopupNeeded(data.acctEmail);
    },
    close_dialog: (data) => {
      $('#cryptup_dialog').remove();
    },
  }, tabId);

  let displayOrig = (selector: string) => {
    let filterable = $(selector);
    filterable.filter('a, b, i, img, span, input, label, select').css('display', 'inline-block');
    filterable.filter('table').css('display', 'table');
    filterable.filter('tr').css('display', 'table-row');
    filterable.filter('td').css('display', 'table-cell');
    filterable.not('a, b, i, img, span, input, label, select, table, tr, td').css('display', 'block');
  };

  let initialize = async () => {
    if(addNewAcct) {
      $('.show_if_setup_not_done').css('display', 'initial');
      $('.hide_if_setup_not_done').css('display', 'none');
      await Settings.newGoogleAcctAuthPrompt(tabId);
    } else if (acctEmail) {
      $('.email-address').text(acctEmail);
      $('#security_module').attr('src', Env.urlCreate('modules/security.htm', { acctEmail, parentTabId: tabId, embedded: true }));
      let storage = await Store.getAcct(acctEmail, ['setup_done', 'google_token_scopes', 'email_provider', 'picture']);
      if (storage.setup_done) {
        checkGoogleAcct().catch(Catch.handleException);
        checkFcAcctAndSubscriptionAndContactPage().catch(Catch.handleException);
        if(storage.picture) {
          $('img.main-profile-img').attr('src', storage.picture).on('error', Ui.event.handle(self => {
            $(self).off().attr('src', '/img/svgs/profile-icon.svg');
          }));
        }
        if (!Api.gmail.hasScope(storage.google_token_scopes as string[], 'read') && (storage.email_provider || 'gmail') === 'gmail') {
          $('.auth_denied_warning').css('display', 'block');
        }
        displayOrig('.hide_if_setup_not_done');
        $('.show_if_setup_not_done').css('display', 'none');
        if (urlParams.advanced) {
          $("#settings").toggleClass("advanced");
        }
        let privateKeys = await Store.keysGet(acctEmail);
        if (privateKeys.length > 4) {
          $('.key_list').css('overflow-y', 'scroll');
        }
        addKeyRowsHtml(privateKeys);
      } else {
        displayOrig('.show_if_setup_not_done');
        $('.hide_if_setup_not_done').css('display', 'none');
      }
    } else {
      let acctEmails = await Store.acctEmailsGet();
      if (acctEmails && acctEmails[0]) {
        window.location.href = Env.urlCreate('index.htm', { acctEmail: acctEmails[0] });
      } else {
        $('.show_if_setup_not_done').css('display', 'initial');
        $('.hide_if_setup_not_done').css('display', 'none');
      }
    }
  };

  let checkFcAcctAndSubscriptionAndContactPage = async () => {
    let statusContainer = $('.public_profile_indicator_container');
    try {
      await renderSubscriptionStatusHeader();
    } catch(e) {
      Catch.handleException(e);
    }
    let authInfo = await Store.authInfo();
    if (authInfo.acctEmail) { // have auth email set
      try {
        let response = await Api.fc.accountUpdate();
        $('#status-row #status_flowcrypt').text(`fc:${authInfo.acctEmail}:ok`);
        if (response && response.result && response.result.alias) {
          statusContainer.find('.status-indicator-text').css('display', 'none');
          statusContainer.find('.status-indicator').addClass('active');
        } else {
          statusContainer.find('.status-indicator').addClass('inactive');
        }
      } catch (e) {
        if (Api.err.isAuthErr(e)) {
          let actionReauth = Ui.event.handle(() => Settings.renderSubPage(acctEmail!, tabId, '/chrome/elements/subscribe.htm', '&source=authErr'));
          Xss.sanitizeRender(statusContainer, '<a class="bad" href="#">Auth Needed</a>').find('a').click(actionReauth);
          $('#status-row #status_flowcrypt').text(`fc:${authInfo.acctEmail}:auth`).addClass('bad').addClass('link').click(actionReauth);
        } else if (Api.err.isNetErr(e)) {
          Xss.sanitizeRender(statusContainer, '<a href="#">Network Error - Retry</a>').find('a').one('click', Ui.event.handle(checkFcAcctAndSubscriptionAndContactPage));
          $('#status-row #status_flowcrypt').text(`fc:${authInfo.acctEmail}:offline`);
        } else {
          statusContainer.text('ecp error');
          $('#status-row #status_flowcrypt').text(`fc:${authInfo.acctEmail}:error`).attr('title', `FlowCrypt Account Error: ${Xss.htmlEscape(String(e))}`);
          Catch.handleException(e);
        }
      }
    } else { // never set up
      statusContainer.find('.status-indicator').addClass('inactive');
      $('#status-row #status_flowcrypt').text(`fc:none`);
    }
    statusContainer.css('visibility', 'visible');
  };

  let resolveChangedGoogleAcct = async (newAcctEmail: string) => {
    try {
      await Settings.refreshAcctAliases(acctEmail!);
      await Settings.acctStorageChangeEmail(acctEmail!, newAcctEmail);
      alert(`Email address changed to ${newAcctEmail}. You should now check that your public key is properly submitted.`);
      window.location.href = Env.urlCreate('index.htm', { acctEmail: newAcctEmail, page: '/chrome/settings/modules/keyserver.htm' });
    } catch(e) {
      Catch.handleException(e);
      alert('There was an error changing google account, please write human@flowcrypt.com');
    }
  };

  let checkGoogleAcct = async () => {
    try {
      let me = await Api.gmail.usersMeProfile(acctEmail!);
      Settings.updateProfilePicIfMissing(acctEmail!).catch(Catch.handleException);
      $('#status-row #status_google').text(`g:${me.emailAddress}:ok`);
      if(me.emailAddress !== acctEmail) {
        $('#status-row #status_google').text(`g:${me.emailAddress}:changed`).addClass('bad').attr('title', 'Account email address has changed');
        if(me.emailAddress && acctEmail) {
          if(confirm(`Your Google Account address seems to have changed from ${acctEmail} to ${me.emailAddress}. FlowCrypt Settings need to be updated accordingly.`)) {
            await resolveChangedGoogleAcct(me.emailAddress);
          }
        }
      }
    } catch (e) {
      if (Api.err.isAuthPopupNeeded(e)) {
        $('#status-row #status_google').text(`g:?:disconnected`).addClass('bad').attr('title', 'Not connected to Google Account, click to resolve.')
          .off().click(Ui.event.handle(() => Settings.newGoogleAcctAuthPrompt(tabId, acctEmail)));
      } else if (Api.err.isAuthErr(e)) {
        $('#status-row #status_google').text(`g:?:auth`).addClass('bad').attr('title', 'Auth error when checking Google Account, click to resolve.')
          .off().click(Ui.event.handle(() => Settings.newGoogleAcctAuthPrompt(tabId, acctEmail)));
      } else if (Api.err.isNetErr(e)) {
        $('#status-row #status_google').text(`g:?:offline`);
      } else {
        $('#status-row #status_google').text(`g:?:err`).addClass('bad').attr('title', `Cannot determine Google account: ${Xss.htmlEscape(String(e))}`);
        Catch.handleException(e);
      }
    }
  };

  let renderSubscriptionStatusHeader = async () => {
    let liveness = '';
    try {
      await Api.fc.accountCheckSync();
      liveness = 'live';
    } catch (e) {
      if (!Api.err.isNetErr(e)) {
        Catch.handleException(e);
        liveness = 'err';
      } else {
        liveness = 'offline';
      }
    }
    let subscription = await Store.subscription();
    $('#status-row #status_subscription').text(`s:${liveness}:${subscription.active ? 'active' : 'inactive'}-${subscription.method}:${subscription.expire}`);
    if (subscription.active) {
      $('.logo-row .subscription .level').text('advanced').css('display', 'inline-block').click(Ui.event.handle(() => Settings.renderSubPage(acctEmail || null, tabId, '/chrome/settings/modules/account.htm'))).css('cursor', 'pointer');
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

  let addKeyRowsHtml = (private_keys: KeyInfo[]) => {
    let html = '';
    for (let i = 0; i < private_keys.length; i++) {
      let ki = private_keys[i];
      let prv = openpgp.key.readArmored(ki.private).keys[0];
      let date = Str.month_name(prv.primaryKey.created.getMonth()) + ' ' + prv.primaryKey.created.getDate() + ', ' + prv.primaryKey.created.getFullYear();
      let escapedPrimaryOrRemove = (ki.primary) ? '(primary)' : '(<a href="#" class="action_remove_key" longid="' + Xss.htmlEscape(ki.longid) + '">remove</a>)';
      let escapedEmail = Xss.htmlEscape(Str.parseEmail(prv.users[0].userId ? prv.users[0].userId!.userid : '').email);
      let escapedLink = `<a href="#" data-test="action-show-key-${i}" class="action_show_key" page="modules/my_key.htm" addurltext="&longid=${Xss.htmlEscape(ki.longid)}">${escapedEmail}</a>`;
      html += `<div class="row key-content-row key_${Xss.htmlEscape(ki.longid)}">`;
      html += `  <div class="col-sm-12">${escapedLink} from ${Xss.htmlEscape(date)}&nbsp;&nbsp;&nbsp;&nbsp;${escapedPrimaryOrRemove}</div>`;
      html += `  <div class="col-sm-12">KeyWords: <span class="good">${Xss.htmlEscape(ki.keywords)}</span></div>`;
      html += `</div>`;
    }
    Xss.sanitizeAppend('.key_list', html);
    $('.action_show_key').click(Ui.event.handle(target => {
      // the UI below only gets rendered when account_email is available
      Settings.renderSubPage(acctEmail!, tabId, $(target).attr('page')!, $(target).attr('addurltext') || ''); // all such elements do have page attr
    }));
    $('.action_remove_key').click(Ui.event.handle(async target => {
      // the UI below only gets rendered when account_email is available
      await Store.keysRemove(acctEmail!, $(target).attr('longid')!);
      await Store.passphraseSave('local', acctEmail!, $(target).attr('longid')!, undefined);
      await Store.passphraseSave('session', acctEmail!, $(target).attr('longid')!, undefined);
      reload(true);
    }));
  };

  $.get(chrome.extension.getURL('/changelog.txt'), data => ($('#status-row #status_v') as any as JQS).featherlight(data.replace(/\n/g, '<br>')), 'html');

  $('.show_settings_page').click(Ui.event.handle(target => {
    Settings.renderSubPage(acctEmail!, tabId, $(target).attr('page')!, $(target).attr('addurltext') || ''); // all such elements do have page attr
  }));

  $('.action_show_encrypted_inbox').click(Ui.event.handle(target => {
    window.location.href = Env.urlCreate('/chrome/settings/inbox/inbox.htm', {acctEmail});
  }));

  $('.action_go_auth_denied').click(Ui.event.handle(() => Settings.renderSubPage(acctEmail!, tabId, '/chrome/settings/modules/auth_denied.htm')));

  $('.action_add_account').click(Ui.event.prevent('double', async () => await Settings.newGoogleAcctAuthPrompt(tabId)));

  $('.action_google_auth').click(Ui.event.prevent('double', async () => await Settings.newGoogleAcctAuthPrompt(tabId, acctEmail)));

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

  $('#status-row #status_google').click(Ui.event.handle(() => Settings.renderSubPage(acctEmail!, tabId, '/chrome/settings/modules/debug_api.htm', {which: 'google_account'})));
  // $('#status-row #status_flowcrypt').click(Ui.event.handle(() => Settings.render_sub_page(account_email!, tabId, '/chrome/settings/modules/debug_api.htm', {which: 'flowcrypt_account'})));
  // $('#status-row #status_subscription').click(Ui.event.handle(() => Settings.render_sub_page(account_email!, tabId, '/chrome/settings/modules/debug_api.htm', {which: 'flowcrypt_subscription'})));

  let reload = (advanced=false) => {
    if (advanced) {
      window.location.href = Env.urlCreate('/chrome/settings/index.htm', { acctEmail, advanced: true });
    } else {
      window.location.reload();
    }
  };

  let menuAcctHtml = (email: string, picture='/img/svgs/profile-icon.svg') => {
    return [
      '<div class="row alt-accounts action_select_account">',
      '  <div class="col-sm-10">',
      `    <div class="row contains_email" data-test="action-switch-to-account">${Xss.htmlEscape(email)}</div>`,
      '  </div>',
      `  <div><img class="profile-img" src="${Xss.htmlEscape(picture)}" alt=""></div>`,
      '</div>',
    ].join('');
  };

  await initialize();
  await Ui.abortAndRenderErrOnUnprotectedKey(acctEmail, tabId);
  if (urlParams.page && typeof urlParams.page !== 'undefined' && urlParams.page !== 'undefined') {
    if (urlParams.page === '/chrome/settings/modules/auth_denied.htm') {
      Settings.renderSubPage(acctEmail || null, tabId, urlParams.page);
    } else {
      Settings.renderSubPage(acctEmail || null, tabId, urlParams.page as string, pageUrlParams);
    }
  }

  let acctStorages = await Store.getAccounts(acctEmails, ['picture']);
  for (let email of acctEmails) {
    Xss.sanitizePrepend('#alt-accounts', menuAcctHtml(email, acctStorages[email].picture));
  }
  $('#alt-accounts img.profile-img').on('error', Ui.event.handle(self => {
    $(self).off().attr('src', '/img/svgs/profile-icon.svg');
  }));
  $('.action_select_account').click(Ui.event.handle(target => {
    window.location.href = Env.urlCreate('index.htm', { acctEmail: $(target).find('.contains_email').text() });
  }));

})();
