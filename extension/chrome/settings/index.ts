/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Bm, BrowserMsg } from '../../js/common/browser/browser-msg.js';
import { JQS, Ui } from '../../js/common/browser/ui.js';
import { KeyInfo, PgpKey } from '../../js/common/core/pgp-key.js';
import { Str, Url, UrlParams } from '../../js/common/core/common.js';
import { ApiErr } from '../../js/common/api/error/api-error.js';
import { Assert } from '../../js/common/assert.js';
import { Backend } from '../../js/common/api/backend.js';
import { Catch } from '../../js/common/platform/catch.js';
import { Env } from '../../js/common/browser/env.js';
import { Gmail } from '../../js/common/api/email-provider/gmail/gmail.js';
import { Lang } from '../../js/common/lang.js';
import { Notifications } from '../../js/common/notifications.js';
import { Rules } from '../../js/common/rules.js';
import { Settings } from '../../js/common/settings.js';
import { VERSION } from '../../js/common/core/const.js';
import { View } from '../../js/common/view.js';
import { Xss } from '../../js/common/platform/xss.js';
import { XssSafeFactory } from '../../js/common/xss-safe-factory.js';
import { AcctStore, EmailProvider } from '../../js/common/platform/store/acct-store.js';
import { KeyStore } from '../../js/common/platform/store/key-store.js';
import { GlobalStore } from '../../js/common/platform/store/global-store.js';
import { PassphraseStore } from '../../js/common/platform/store/passphrase-store.js';

View.run(class SettingsView extends View {

  private readonly acctEmail: string | undefined;
  private readonly page: string | undefined;
  private readonly pageUrlParams: UrlParams | undefined;
  private readonly addNewAcct: boolean;
  private readonly advanced: boolean;

  private readonly gmail: Gmail | undefined;
  private tabId!: string;
  private notifications!: Notifications;
  private rules: Rules | undefined;

  constructor() {
    super();
    const uncheckedUrlParams = Url.parse(['acctEmail', 'page', 'pageUrlParams', 'advanced', 'addNewAcct']);
    this.acctEmail = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'acctEmail');
    this.page = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'page');
    this.page = (this.page === 'undefined') ? undefined : this.page; // in case an "undefined" string slipped in
    this.pageUrlParams = (typeof uncheckedUrlParams.pageUrlParams === 'string') ? JSON.parse(uncheckedUrlParams.pageUrlParams) as UrlParams : undefined;
    this.addNewAcct = uncheckedUrlParams.addNewAcct === true;
    this.advanced = uncheckedUrlParams.advanced === true;
    if (this.acctEmail) {
      this.acctEmail = this.acctEmail.toLowerCase().trim();
      this.gmail = new Gmail(this.acctEmail);
    }
  }

  public render = async () => {
    $('#status-row #status_v').text(`v:${VERSION}`);
    for (const webmailLName of await Env.webmails()) {
      $('.signin_button.' + webmailLName).css('display', 'inline-block');
    }
    this.tabId = await BrowserMsg.requiredTabId();
    this.notifications = new Notifications(this.tabId);
    if (this.acctEmail) {
      this.rules = await Rules.newInstance(this.acctEmail);
    }
    if (this.rules && !this.rules.canSubmitPubToAttester()) {
      $('.public_profile_indicator_container').hide(); // contact page is useless if user cannot submit to attester
    }
    if (this.rules && this.rules.getPrivateKeyManagerUrl()) {
      $(".add_key").hide(); // users which a key manager should not be adding keys manually
    }
    $.get('/changelog.txt', data => ($('#status-row #status_v') as any as JQS).featherlight(String(data).replace(/\n/g, '<br>')), 'html');
    await this.initialize();
    await Assert.abortAndRenderErrOnUnprotectedKey(this.acctEmail, this.tabId);
    if (this.page) {
      Settings.renderSubPage(this.acctEmail, this.tabId, this.page, this.pageUrlParams);
    }
    await Settings.populateAccountsMenu('index.htm');
    Ui.setTestState('ready');
  }

  public setHandlers = () => {
    BrowserMsg.addListener('open_page', async ({ page, addUrlText }: Bm.OpenPage) => {
      Settings.renderSubPage(this.acctEmail, this.tabId, page, addUrlText);
    });
    BrowserMsg.addListener('redirect', async ({ location }: Bm.Redirect) => {
      window.location.href = location;
    });
    BrowserMsg.addListener('close_page', async () => {
      $('.featherlight-close').click();
    });
    BrowserMsg.addListener('reload', async ({ advanced }: Bm.Reload) => {
      $('.featherlight-close').click();
      this.reload(advanced);
    });
    BrowserMsg.addListener('add_pubkey_dialog', async ({ emails }: Bm.AddPubkeyDialog) => {
      // todo: use #cryptup_dialog just like passphrase_dialog does
      const factory = new XssSafeFactory(this.acctEmail!, this.tabId);
      window.open(factory.srcAddPubkeyDialog(emails, 'settings'), '_blank', 'height=680,left=100,menubar=no,status=no,toolbar=no,top=30,width=660');
    });
    BrowserMsg.addListener('subscribe_dialog', async ({ }: Bm.SubscribeDialog) => {
      // todo: use #cryptup_dialog just like passphrase_dialog does
      const factory = new XssSafeFactory(this.acctEmail!, this.tabId);
      const subscribeDialogSrc = factory.srcSubscribeDialog('settings_compose', undefined);
      window.open(subscribeDialogSrc, '_blank', 'height=650,left=100,menubar=no,status=no,toolbar=no,top=30,width=640,scrollbars=no');
    });
    BrowserMsg.addListener('notification_show', async ({ notification }: Bm.NotificationShow) => {
      this.notifications!.show(notification);
      let cleared = false;
      const clear = () => {
        if (!cleared) {
          this.notifications!.clear();
          cleared = true;
        }
      };
      Catch.setHandledTimeout(clear, 10000);
      $('.webmail_notifications').one('click', clear);
    });
    BrowserMsg.addListener('open_google_auth_dialog', async ({ acctEmail, scopes }: Bm.OpenGoogleAuthDialog) => {
      $('.featherlight-close').click();
      await Settings.newGoogleAcctAuthPromptThenAlertOrForward(this.tabId, acctEmail, scopes);
    });
    BrowserMsg.addListener('passphrase_dialog', async ({ longids, type }: Bm.PassphraseDialog) => {
      if (!$('#cryptup_dialog').length) {
        const factory = new XssSafeFactory(this.acctEmail!, this.tabId);
        $('body').append(factory.dialogPassphrase(longids, type)); // xss-safe-factory
      }
    });
    BrowserMsg.addListener('notification_show_auth_popup_needed', async ({ acctEmail }: Bm.NotificationShowAuthPopupNeeded) => {
      this.notifications!.showAuthPopupNeeded(acctEmail);
    });
    BrowserMsg.addListener('close_dialog', async () => {
      $('#cryptup_dialog').remove();
    });
    BrowserMsg.listen(this.tabId);
    $('.show_settings_page').click(this.setHandler(async target => {
      const page = $(target).attr('page');
      if (page) {
        Settings.renderSubPage(this.acctEmail!, this.tabId, page, $(target).attr('addurltext') || '');
      } else {
        Catch.report(`Unknown target page in element: ${target.outerHTML}`);
      }
    }));
    $('.action_show_encrypted_inbox').click(this.setHandler(target => {
      window.location.href = Url.create('/chrome/settings/inbox/inbox.htm', { acctEmail: this.acctEmail! });
    }));
    $('.action_go_auth_denied').click(this.setHandler(() => Settings.renderSubPage(this.acctEmail!, this.tabId, '/chrome/settings/modules/auth_denied.htm')));
    $('.action_add_account').click(this.setHandlerPrevent('double', async () => await Settings.newGoogleAcctAuthPromptThenAlertOrForward(this.tabId)));
    $('.action_google_auth').click(this.setHandlerPrevent('double', async () => await Settings.newGoogleAcctAuthPromptThenAlertOrForward(this.tabId, this.acctEmail)));
    // $('.action_microsoft_auth').click(this.setHandlerPrevent('double', function() {
    //   new_microsoft_account_authentication_prompt(account_email);
    // }));
    $('body').click(this.setHandler(() => {
      $("#alt-accounts").removeClass("active");
      $(".ion-ios-arrow-down").removeClass("up");
      $(".add-account").removeClass("hidden");
    }));
    $(".toggle-settings").click(this.setHandler(() => {
      $("#settings").toggleClass("advanced");
    }));
    $(".action-toggle-accounts-menu").click(this.setHandler((target, event) => {
      event.stopPropagation();
      $("#alt-accounts").toggleClass("active");
      $(".ion-ios-arrow-down").toggleClass("up");
      $(".add-account").toggleClass("hidden");
    }));
    $('#status-row #status_google').click(this.setHandler(() => Settings.renderSubPage(this.acctEmail!, this.tabId, 'modules/debug_api.htm', { which: 'google_account' })));
    $('#status-row #status_local_store').click(this.setHandler(() => Settings.renderSubPage(this.acctEmail!, this.tabId, 'modules/debug_api.htm', { which: 'local_store' })));
  }

  private displayOrig = (selector: string) => {
    const filterable = $(selector);
    filterable.filter('a, b, i, img, span, input, label, select').css('display', 'inline-block');
    filterable.filter('table').css('display', 'table');
    filterable.filter('tr').css('display', 'table-row');
    filterable.filter('td').css('display', 'table-cell');
    filterable.not('a, b, i, img, span, input, label, select, table, tr, td').css('display', 'block');
  }

  private initialize = async () => {
    if (this.addNewAcct) {
      $('.show_if_setup_not_done').css('display', 'initial');
      $('.hide_if_setup_not_done').css('display', 'none');
      await Settings.newGoogleAcctAuthPromptThenAlertOrForward(this.tabId);
    } else if (this.acctEmail) {
      $('.email-address').text(this.acctEmail);
      const storage = await AcctStore.get(this.acctEmail, ['setup_done', 'email_provider', 'picture']);
      if (storage.setup_done) {
        const rules = await Rules.newInstance(this.acctEmail);
        if (!rules.canBackupKeys()) {
          $('.show_settings_page[page="modules/backup.htm"]').parent().remove();
          $('.settings-icons-rows').css({ position: 'relative', left: '64px' }); // lost a button - center it again
        }
        this.checkGoogleAcct().catch(Catch.reportErr);
        this.checkFcAcctAndSubscriptionAndContactPage().catch(Catch.reportErr);
        if (storage.picture) {
          $('img.main-profile-img').attr('src', storage.picture).on('error', this.setHandler(self => {
            $(self).off().attr('src', '/img/svgs/profile-icon.svg');
          }));
        }
        await this.renderNotificationBanners(storage.email_provider || 'gmail', rules);
        this.displayOrig('.hide_if_setup_not_done');
        $('.show_if_setup_not_done').css('display', 'none');
        if (this.advanced) {
          $("#settings").toggleClass("advanced");
        }
        const privateKeys = await KeyStore.get(this.acctEmail);
        if (privateKeys.length > 4) {
          $('.key_list').css('overflow-y', 'scroll');
        }
        await this.addKeyRowsHtml(privateKeys);
      } else {
        this.displayOrig('.show_if_setup_not_done');
        $('.hide_if_setup_not_done').css('display', 'none');
      }
    } else {
      const acctEmails = await GlobalStore.acctEmailsGet();
      if (acctEmails && acctEmails[0]) {
        window.location.href = Url.create('index.htm', { acctEmail: acctEmails[0] });
      } else {
        $('.show_if_setup_not_done').css('display', 'initial');
        $('.hide_if_setup_not_done').css('display', 'none');
      }
    }
    Backend.retrieveBlogPosts().then(posts => { // do not await because may take a while
      for (const post of posts) {
        const html = `<div class="line"><a href="https://flowcrypt.com${Xss.escape(post.url)}" target="_blank">${Xss.escape(post.title.trim())}</a> ${Xss.escape(post.date.trim())}</div>`;
        Xss.sanitizeAppend('.blog_post_list', html);
      }
    }).catch(ApiErr.reportIfSignificant);
  }

  private renderNotificationBanners = async (emailProvider: EmailProvider, rules: Rules) => {
    if (!this.acctEmail) {
      return;
    }
    const scopes = await AcctStore.getScopes(this.acctEmail);
    if (!(scopes.read || scopes.modify) && emailProvider === 'gmail') {
      $('.auth_denied_warning').removeClass('hidden');
    }
    const globalStorage = await GlobalStore.get(['install_mobile_app_notification_dismissed']);
    if (!globalStorage.install_mobile_app_notification_dismissed && rules.canBackupKeys() && rules.canCreateKeys() && !rules.getPrivateKeyManagerUrl()) {
      // only show this notification if user is allowed to:
      //   - backup keys: when not allowed, company typically has other forms of backup
      //   - create keys: when not allowed, key must have been imported from some other system that already takes care of backups
      // and doesn't use custom key manager, because backups are then taken care of
      $('.install_app_notification').removeClass('hidden');
    }
    $('.dismiss_install_app_notification').click(this.setHandler(async () => {
      await GlobalStore.set({ install_mobile_app_notification_dismissed: true });
      $('.install_app_notification').remove();
    }));
  }

  private checkFcAcctAndSubscriptionAndContactPage = async () => {
    const statusContainer = $('.public_profile_indicator_container');
    try {
      await this.renderSubscriptionStatusHeader(this.acctEmail!);
    } catch (e) {
      Catch.reportErr(e);
    }
    const authInfo = await AcctStore.authInfo(this.acctEmail!);
    if (authInfo.uuid) { // have auth email set
      try {
        const response = await Backend.accountGetAndUpdateLocalStore(authInfo);
        $('#status-row #status_flowcrypt').text(`fc:ok`);
        if (response?.account?.alias) {
          statusContainer.find('.status-indicator-text').css('display', 'none');
          statusContainer.find('.status-indicator').addClass('active');
        } else {
          statusContainer.find('.status-indicator').addClass('inactive');
        }
      } catch (e) {
        if (ApiErr.isAuthErr(e)) {
          const actionReauth = this.setHandler(() => Settings.offerToLoginWithPopupShowModalOnErr(this.acctEmail!));
          Xss.sanitizeRender(statusContainer, '<a class="bad" href="#">Auth Needed</a>').find('a').click(actionReauth);
          $('#status-row #status_flowcrypt').text(`fc:auth`).addClass('bad').addClass('link').click(actionReauth);
        } else if (ApiErr.isNetErr(e)) {
          Xss.sanitizeRender(statusContainer, '<a href="#">Network Error - Retry</a>')
            .find('a').one('click', this.setHandler(() => this.checkFcAcctAndSubscriptionAndContactPage()));
          $('#status-row #status_flowcrypt').text(`fc:offline`);
        } else {
          statusContainer.text('ecp error');
          $('#status-row #status_flowcrypt').text(`fc:error`).attr('title', `FlowCrypt Account Error: ${Xss.escape(String(e))}`);
          Catch.reportErr(e);
        }
      }
    } else { // never set up
      statusContainer.find('.status-indicator').addClass('inactive');
      $('#status-row #status_flowcrypt').text(`fc:none`);
    }
    statusContainer.css('visibility', 'visible');
  }

  private resolveChangedGoogleAcct = async (newAcctEmail: string) => {
    try {
      await Settings.refreshSendAs(this.acctEmail!);
      await Settings.acctStorageChangeEmail(this.acctEmail!, newAcctEmail);
      await Ui.modal.info(`Email address changed to ${newAcctEmail}. You should now check that your public key is properly submitted.`);
      window.location.href = Url.create('index.htm', { acctEmail: newAcctEmail, page: '/chrome/settings/modules/keyserver.htm' });
    } catch (e) {
      if (ApiErr.isNetErr(e)) {
        await Ui.modal.error('There was a network error, please try again.');
      } else if (ApiErr.isMailOrAcctDisabledOrPolicy(e)) {
        await Ui.modal.error(Lang.account.googleAcctDisabledOrPolicy);
      } else if (ApiErr.isAuthPopupNeeded(e)) {
        await Ui.modal.warning('New authorization needed. Please try Additional Settings -> Experimental -> Force Google Account email change');
      } else {
        Catch.reportErr(e);
        await Ui.modal.error(`There was an error changing google account, please write human@flowcrypt.com\n\n${ApiErr.eli5(e)}\n\n${String(e)}`);
      }
    }
  }

  private checkGoogleAcct = async () => {
    try {
      const { sendAs } = await this.gmail!.fetchAcctAliases();
      const primary = sendAs.find(addr => addr.isPrimary === true);
      if (!primary) {
        await Ui.modal.warning(`Your account sendAs does not have any primary sendAsEmail`);
        return;
      }
      const googleAcctEmailAddr = primary.sendAsEmail;
      $('#status-row #status_google').text(`g:${googleAcctEmailAddr}:ok`);
      if (googleAcctEmailAddr !== this.acctEmail) {
        $('#status-row #status_google').text(`g:${googleAcctEmailAddr}:changed`).addClass('bad').attr('title', 'Account email address has changed');
        if (googleAcctEmailAddr && this.acctEmail) {
          const acctChangedTxt = `Your Google Account address seems to have changed from ${this.acctEmail} to ${googleAcctEmailAddr}. FlowCrypt Settings need to be updated accordingly.`;
          if (await Ui.modal.confirm(acctChangedTxt)) {
            await this.resolveChangedGoogleAcct(googleAcctEmailAddr);
          }
        }
      }
    } catch (e) {
      if (ApiErr.isAuthPopupNeeded(e) || ApiErr.isAuthErr(e)) {
        $('#status-row #status_google').text(`g:?:auth`).addClass('bad');
        if (await Ui.modal.confirm(`FlowCrypt must be re-connected to your Google account.`)) {
          await Settings.newGoogleAcctAuthPromptThenAlertOrForward(this.tabId, this.acctEmail);
        }
      } else if (ApiErr.isMailOrAcctDisabledOrPolicy(e)) {
        await Ui.modal.error(Lang.account.googleAcctDisabledOrPolicy);
      } else if (ApiErr.isNetErr(e)) {
        $('#status-row #status_google').text(`g:?:offline`);
      } else {
        $('#status-row #status_google').text(`g:?:err`).addClass('bad').attr('title', `Cannot determine Google account: ${Xss.escape(String(e))}`);
        Catch.reportErr(e);
      }
    }
  }

  private renderSubscriptionStatusHeader = async (acctEmail: string) => {
    let liveness = '';
    try {
      await Backend.getSubscriptionWithoutLogin(acctEmail);
      liveness = 'live';
    } catch (e) {
      if (!ApiErr.isNetErr(e)) {
        Catch.reportErr(e);
        liveness = 'err';
      } else {
        liveness = 'offline';
      }
    }
    const subscription = await AcctStore.getSubscription(acctEmail);
    $('#status-row #status_subscription').text(`s:${liveness}:${subscription.active ? 'active' : 'inactive'}-${subscription.method}:${subscription.expire}`);
    if (subscription.active) {
      const showAcct = () => Settings.renderSubPage(acctEmail, this.tabId, '/chrome/settings/modules/account.htm');
      $('.logo-row .subscription .level').text('advanced').css('display', 'inline-block').click(this.setHandler(showAcct)).css('cursor', 'pointer');
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
  }

  private addKeyRowsHtml = async (privateKeys: KeyInfo[]) => {
    let html = '';
    for (let i = 0; i < privateKeys.length; i++) {
      const ki = privateKeys[i];
      const prv = await PgpKey.read(ki.private);
      const date = Str.monthName(prv.primaryKey.created.getMonth()) + ' ' + prv.primaryKey.created.getDate() + ', ' + prv.primaryKey.created.getFullYear();
      const escapedPrimaryOrRemove = (ki.primary) ? '(primary)' : '(<a href="#" class="action_remove_key" longid="' + Xss.escape(ki.longid) + '">remove</a>)';
      const escapedEmail = Xss.escape(Str.parseEmail(prv.users[0].userId ? prv.users[0].userId!.userid : '').email || '');
      const escapedLongid = Xss.escape(ki.longid);
      const escapedLink = `<a href="#" data-test="action-show-key-${i}" class="action_show_key" page="modules/my_key.htm" addurltext="&longid=${escapedLongid}">${escapedEmail}</a>`;
      html += `<div class="row key-content-row key_${Xss.escape(ki.longid)}">`;
      html += `  <div class="col-sm-12">${escapedLink} from ${Xss.escape(date)}&nbsp;&nbsp;&nbsp;&nbsp;${escapedPrimaryOrRemove}</div>`;
      html += `  <div class="col-sm-12">Longid: <span class="good">${Xss.escape(Str.spaced(ki.longid))}</span></div>`;
      html += `</div>`;
    }
    Xss.sanitizeAppend('.key_list', html);
    $('.action_show_key').click(this.setHandler(target => {
      // the UI below only gets rendered when account_email is available
      Settings.renderSubPage(this.acctEmail!, this.tabId, $(target).attr('page')!, $(target).attr('addurltext') || ''); // all such elements do have page attr
    }));
    $('.action_remove_key').click(this.setHandler(async target => {
      // the UI below only gets rendered when account_email is available
      await KeyStore.remove(this.acctEmail!, $(target).attr('longid')!);
      await PassphraseStore.set('local', this.acctEmail!, $(target).attr('longid')!, undefined);
      await PassphraseStore.set('session', this.acctEmail!, $(target).attr('longid')!, undefined);
      this.reload(true);
    }));
  }

  private reload = (advanced = false) => {
    if (advanced) {
      window.location.href = Url.create('/chrome/settings/index.htm', { acctEmail: this.acctEmail, advanced: true });
    } else {
      window.location.reload();
    }
  }

});
