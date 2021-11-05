/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Bm, BrowserMsg } from '../../js/common/browser/browser-msg.js';
import { Ui } from '../../js/common/browser/ui.js';
import { KeyUtil, TypedKeyInfo } from '../../js/common/core/crypto/key.js';
import { Str, Url, UrlParams } from '../../js/common/core/common.js';
import { ApiErr } from '../../js/common/api/shared/api-error.js';
import { Assert } from '../../js/common/assert.js';

import { Catch } from '../../js/common/platform/catch.js';
import { Env } from '../../js/common/browser/env.js';
import { Gmail } from '../../js/common/api/email-provider/gmail/gmail.js';
import { Lang } from '../../js/common/lang.js';
import { Notifications } from '../../js/common/notifications.js';
import { OrgRules } from '../../js/common/org-rules.js';
import { Settings } from '../../js/common/settings.js';
import { VERSION } from '../../js/common/core/const.js';
import { View } from '../../js/common/view.js';
import { Xss } from '../../js/common/platform/xss.js';
import { XssSafeFactory } from '../../js/common/xss-safe-factory.js';
import { AcctStore, EmailProvider } from '../../js/common/platform/store/acct-store.js';
import { KeyStore } from '../../js/common/platform/store/key-store.js';
import { GlobalStore } from '../../js/common/platform/store/global-store.js';
import { PassphraseStore } from '../../js/common/platform/store/passphrase-store.js';
import Swal from 'sweetalert2';
import { FlowCryptWebsite } from '../../js/common/api/flowcrypt-website.js';
import { AccountServer } from '../../js/common/api/account-server.js';
import { SubscriptionInfo } from '../../js/common/api/account-servers/flowcrypt-com-api.js';

View.run(class SettingsView extends View {

  private readonly acctEmail: string | undefined;
  private readonly page: string | undefined;
  private readonly pageUrlParams: UrlParams | undefined;
  private readonly addNewAcct: boolean;
  private readonly advanced: boolean;

  private readonly gmail: Gmail | undefined;
  private tabId!: string;
  private notifications!: Notifications;
  private orgRules: OrgRules | undefined;
  private acctServer: AccountServer | undefined;

  private altAccounts: JQuery<HTMLElement>;

  constructor() {
    super();
    const uncheckedUrlParams = Url.parse(['acctEmail', 'page', 'pageUrlParams', 'advanced', 'addNewAcct']);
    this.acctEmail = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'acctEmail');
    this.page = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'page');
    if (this.page && !/^(\/chrome|modules)/.test!(this.page as string)) {
      Ui.modal.error('An unexpected value was found for the page parameter')
        .catch(err => console.log(err));
      this.page = undefined;
    }
    this.page = (this.page === 'undefined') ? undefined : this.page; // in case an "undefined" string slipped in
    this.pageUrlParams = (typeof uncheckedUrlParams.pageUrlParams === 'string') ? JSON.parse(uncheckedUrlParams.pageUrlParams) as UrlParams : undefined;
    this.addNewAcct = uncheckedUrlParams.addNewAcct === true;
    this.advanced = uncheckedUrlParams.advanced === true;
    if (this.acctEmail) {
      this.acctEmail = this.acctEmail.toLowerCase().trim();
      this.gmail = new Gmail(this.acctEmail);
      this.acctServer = new AccountServer(this.acctEmail);
    }
    this.altAccounts = $('#alt-accounts');
  }

  public render = async () => {
    $('#status-row #status_version').text(`v:${VERSION}`);
    for (const webmailLName of await Env.webmails()) {
      $('.signin_button.' + webmailLName).css('display', 'inline-block');
    }
    this.tabId = await BrowserMsg.requiredTabId();
    this.notifications = new Notifications();
    if (this.acctEmail) {
      this.orgRules = await OrgRules.newInstance(this.acctEmail);
    }
    if (this.orgRules && !this.orgRules.canSubmitPubToAttester()) {
      $('.public_profile_indicator_container').hide(); // contact page is useless if user cannot submit to attester
    }
    if (this.orgRules && this.orgRules.usesKeyManager()) {
      $(".add_key").hide(); // users which a key manager should not be adding keys manually
    }
    $('#status-row #status_version').click(this.setHandler(async () => {
      await Ui.modal.page('/changelog.txt', true);
    }));
    await this.initialize();
    await Assert.abortAndRenderErrOnUnprotectedKey(this.acctEmail, this.tabId);
    if (this.page) {
      Settings.renderSubPage(this.acctEmail, this.tabId, this.page, this.pageUrlParams).catch(Catch.reportErr);
    }
    await Settings.populateAccountsMenu('index.htm');
    Ui.setTestState('ready');
  }

  public setHandlers = () => {
    BrowserMsg.addListener('open_page', async ({ page, addUrlText }: Bm.OpenPage) => {
      await Settings.renderSubPage(this.acctEmail, this.tabId, page, addUrlText);
    });
    BrowserMsg.addListener('redirect', async ({ location }: Bm.Redirect) => {
      window.location.href = location;
    });
    BrowserMsg.addListener('close_page', async () => {
      Swal.close();
    });
    BrowserMsg.addListener('reload', async ({ advanced }: Bm.Reload) => {
      Swal.close();
      this.reload(advanced);
    });
    BrowserMsg.addListener('add_pubkey_dialog', async ({ emails }: Bm.AddPubkeyDialog) => {
      // todo: use Ui.modal.iframe just like passphrase_dialog does
      const factory = new XssSafeFactory(this.acctEmail!, this.tabId);
      window.open(factory.srcAddPubkeyDialog(emails, 'settings'), '_blank', 'height=680,left=100,menubar=no,status=no,toolbar=no,top=30,width=660');
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
      await Settings.newGoogleAcctAuthPromptThenAlertOrForward(this.tabId, acctEmail, scopes);
    });
    BrowserMsg.addListener('passphrase_dialog', async ({ longids, type, initiatorFrameId }: Bm.PassphraseDialog) => {
      const factory = new XssSafeFactory(this.acctEmail!, this.tabId);
      await factory.showPassphraseDialog(longids, type, initiatorFrameId);
    });
    BrowserMsg.addListener('notification_show_auth_popup_needed', async ({ acctEmail }: Bm.NotificationShowAuthPopupNeeded) => {
      this.notifications!.showAuthPopupNeeded(acctEmail);
    });
    BrowserMsg.addListener('close_dialog', async () => {
      Swal.close();
    });
    BrowserMsg.listen(this.tabId);
    $('.show_settings_page').click(this.setHandler(async target => {
      const page = $(target).attr('page');
      if (page) {
        await Settings.renderSubPage(this.acctEmail!, this.tabId, page, $(target).attr('addurltext') || '');
      } else {
        Catch.report(`Unknown target page in element: ${target.outerHTML}`);
      }
    }));
    $('.action_open_public_key_page').click(this.setHandler(async () => {
      const ki = await KeyStore.getFirstRequired(this.acctEmail!);
      const escapedFp = Xss.escape(ki.fingerprints[0]);
      await Settings.renderSubPage(this.acctEmail!, this.tabId, 'modules/my_key.htm', `&fingerprint=${escapedFp}`);
    }));
    $('.action_show_encrypted_inbox').click(this.setHandler(() => {
      window.location.href = Url.create('/chrome/settings/inbox/inbox.htm', { acctEmail: this.acctEmail! });
    }));
    $('.action_add_account').click(this.setHandlerPrevent('double', async () => await Settings.newGoogleAcctAuthPromptThenAlertOrForward(this.tabId)));
    $('.action_google_auth').click(this.setHandlerPrevent('double', async () => await Settings.newGoogleAcctAuthPromptThenAlertOrForward(this.tabId, this.acctEmail)));
    // $('.action_microsoft_auth').click(this.setHandlerPrevent('double', function() {
    //   new_microsoft_account_authentication_prompt(account_email);
    // }));
    $('body').click(this.setHandler(() => {
      this.altAccounts.removeClass('visible');
      $(".ion-ios-arrow-down").removeClass("up");
      $(".add-account").removeClass("hidden");
    }));
    $(".toggle-settings").click(this.setHandler(() => {
      $("#settings").toggleClass("advanced");
    }));
    let preventAccountsMenuMouseenter = false;
    $(".action-toggle-accounts-menu").click(this.setHandler((target, event) => {
      event.stopPropagation();
      if (this.altAccounts.hasClass('visible')) {
        this.altAccounts.removeClass('visible');
      } else {
        this.altAccounts.addClass('visible');
        this.altAccounts.find('a').first().focus();
      }
      $(".ion-ios-arrow-down").toggleClass("up");
      $(".add-account").toggleClass("hidden");
      preventAccountsMenuMouseenter = true; // prevent mouse events when menu is animated with fadeInDown
      Catch.setHandledTimeout(() => {
        preventAccountsMenuMouseenter = false;
      }, 500);
    }));
    this.altAccounts.keydown(this.setHandler((el, ev) => this.accountsMenuKeydownHandler(ev)));
    this.altAccounts.find('a').on('mouseenter', Ui.event.handle((target) => {
      if (!preventAccountsMenuMouseenter) {
        $(target).focus();
      }
    }));
    $('#status-row #status_google').click(this.setHandler(async () => await Settings.renderSubPage(this.acctEmail!, this.tabId, 'modules/debug_api.htm', { which: 'google_account' })));
    $('#status-row #status_local_store').click(this.setHandler(async () => await Settings.renderSubPage(this.acctEmail!, this.tabId, 'modules/debug_api.htm', { which: 'local_store' })));
    Ui.activateModalPageLinkTags();
  }

  private accountsMenuKeydownHandler = (e: JQuery.Event<HTMLElement, null>): void => {
    const currentActive = this.altAccounts.find(':focus');
    const accounts = this.altAccounts.find('a');
    if (e.key === 'Escape') {
      e.stopPropagation();
      this.altAccounts.removeClass('visible');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      let prev = currentActive.prev();
      if (!prev.length) {
        prev = accounts.last();
      }
      prev.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      let next = currentActive.next();
      if (!next.length) {
        next = accounts.first();
      }
      next.focus();
    }
  }

  private displayOrig = (selector: string) => {
    const filterable = $(selector);
    filterable.filter('a, b, i, img, span, input, label, select').css('display', 'inline-block');
    filterable.filter('table').css('display', 'table');
    filterable.filter('tr').css('display', 'table-row');
    filterable.filter('td').css('display', 'table-cell');
    filterable.filter('.row').css('display', 'flex');
    filterable.not('a, b, i, img, span, input, label, select, table, tr, td, .row').css('display', 'block');
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
        const rules = await OrgRules.newInstance(this.acctEmail);
        if (!rules.canBackupKeys()) {
          $('.show_settings_page[page="modules/backup.htm"]').parent().remove();
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
        const privateKeys = await KeyStore.getTypedKeyInfos(this.acctEmail);
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
    $('body').addClass('initialized');
    FlowCryptWebsite.retrieveBlogPosts().then(posts => { // do not await because may take a while
      for (const post of posts) {
        const html = `<div class="line"><a href="https://flowcrypt.com${Xss.escape(post.url)}" target="_blank">${Xss.escape(post.title.trim())}</a> ${Xss.escape(post.date.trim())}</div>`;
        Xss.sanitizeAppend('.blog_post_list', html);
      }
    }).catch(ApiErr.reportIfSignificant);
  }

  private renderNotificationBanners = async (emailProvider: EmailProvider, rules: OrgRules) => {
    if (!this.acctEmail) {
      return;
    }
    const globalStorage = await GlobalStore.get(['install_mobile_app_notification_dismissed']);
    if (!globalStorage.install_mobile_app_notification_dismissed && rules.canBackupKeys() && rules.canCreateKeys() && !rules.usesKeyManager()) {
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
    const authInfo = await AcctStore.authInfo(this.acctEmail!);
    if (authInfo.uuid) { // have auth email set
      try {
        const acctRes = await this.acctServer!.accountGetAndUpdateLocalStore(authInfo);
        $('#status-row #status_flowcrypt').text(`fc:ok`);
        if (acctRes?.account?.alias) {
          statusContainer.find('.status-indicator-text').css('display', 'none');
          statusContainer.find('.status-indicator').addClass('active');
        } else {
          statusContainer.find('.status-indicator').addClass('inactive');
        }
        this.renderSubscriptionStatusHeader(acctRes.subscription);
      } catch (e) {
        if (ApiErr.isAuthErr(e)) {
          const authNeededLink = $('<a class="bad" href="#">Auth Needed</a>');
          authNeededLink.click(this.setHandler(async () => {
            await Settings.loginWithPopupShowModalOnErr(this.acctEmail!, () => window.location.reload());
          }));
          statusContainer.empty().append(authNeededLink); // xss-direct
          $('#status-row #status_flowcrypt').text(`fc:auth`).addClass('bad');
          Settings.offerToLoginWithPopupShowModalOnErr(this.acctEmail!, () => window.location.reload());
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
      } else if (ApiErr.isAuthErr(e)) {
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
      if (ApiErr.isAuthErr(e)) {
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

  private renderSubscriptionStatusHeader = (subscription: SubscriptionInfo) => {
    const isActive = subscription.level && !subscription.expired;
    const activeOrNotStr = isActive ? 'active' : 'inactive';
    $('#status-row #status_subscription').text(`s:${activeOrNotStr}`);
    if (isActive) {
      $('.logo-row .subscription .level').text('pro').css('display', 'inline-block');
    } else {
      $('.logo-row .subscription .level').text('free forever').css('display', 'inline-block');
      if (subscription.level && subscription.expired) {
        $('.logo-row .subscription .expire').text('expired').css('display', 'inline-block');
      }
    }
  }

  private addKeyRowsHtml = async (privateKeys: TypedKeyInfo[]) => {
    let html = '';
    const canRemoveKey = !this.orgRules || !this.orgRules.usesKeyManager();
    for (let i = 0; i < privateKeys.length; i++) {
      const ki = privateKeys[i];
      const prv = await KeyUtil.parse(ki.private);
      const created = new Date(prv.created);
      const date = Str.monthName(created.getMonth()) + ' ' + created.getDate() + ', ' + created.getFullYear();
      let removeKeyBtn = '';
      if (canRemoveKey && privateKeys.length > 1) {
        removeKeyBtn = `(<a href="#" class="action_remove_key" data-test="action-remove-key" data-type="${ki.type}" data-id="${ki.id}" data-longid="${ki.longid}">remove</a>)`;
      }
      const escapedEmail = Xss.escape(prv.emails[0] || '');
      const escapedLink = `<a href="#" data-test="action-show-key-${i}" class="action_show_key" page="modules/my_key.htm" addurltext="&fingerprint=${ki.id}">${escapedEmail}</a>`;
      const fpHtml = `fingerprint:&nbsp;<span class="good">${Str.spaced(Xss.escape(ki.fingerprints[0]))}</span>`;
      const space = `&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`;
      html += `<div class="row key-content-row">`;
      html += `  <div class="col-12">${escapedLink} from ${Xss.escape(date)}${space}${fpHtml}${space}${removeKeyBtn}</div>`;
      html += `</div>`;
    }
    Xss.sanitizeAppend('.key_list', html);
    $('.action_show_key').click(this.setHandler(async target => {
      // the UI below only gets rendered when account_email is available
      await Settings.renderSubPage(this.acctEmail!, this.tabId, $(target).attr('page')!, $(target).attr('addurltext') || ''); // all such elements do have page attr
    }));
    if (canRemoveKey) {
      $('.action_remove_key').click(this.setHandler(async target => {
        // the UI below only gets rendered when account_email is available
        const type = $(target).data('type') as string;
        const id = $(target).data('id') as string;
        const longid = $(target).data('longid') as string;
        if (type === 'openpgp' || type === 'x509') {
          await KeyStore.remove(this.acctEmail!, { type, id });
          await PassphraseStore.set('local', this.acctEmail!, { longid }, undefined);
          await PassphraseStore.set('session', this.acctEmail!, { longid }, undefined);
          this.reload(true);
        } else {
          Catch.report(`unexpected key type: ${type}`);
        }
      }));
    }
  }

  private reload = (advanced = false) => {
    if (advanced) {
      window.location.href = Url.create('/chrome/settings/index.htm', { acctEmail: this.acctEmail, advanced: true });
    } else {
      window.location.reload();
    }
  }

});
