/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Bm, BrowserMsg } from '../../js/common/browser/browser-msg.js';
import { Ui } from '../../js/common/browser/ui.js';
import { KeyUtil, KeyInfoWithIdentity } from '../../js/common/core/crypto/key.js';
import { Str, Url, UrlParams } from '../../js/common/core/common.js';
import { ApiErr, EnterpriseServerAuthErr } from '../../js/common/api/shared/api-error.js';
import { Assert } from '../../js/common/assert.js';

import { Catch } from '../../js/common/platform/catch.js';
import { Env } from '../../js/common/browser/env.js';
import { Gmail } from '../../js/common/api/email-provider/gmail/gmail.js';
import { Lang } from '../../js/common/lang.js';
import { Notifications } from '../../js/common/notifications.js';
import { ClientConfiguration, ClientConfigurationError } from '../../js/common/client-configuration.js';
import { Settings } from '../../js/common/settings.js';
import { VERSION } from '../../js/common/core/const.js';
import { View } from '../../js/common/view.js';
import { Xss } from '../../js/common/platform/xss.js';
import { XssSafeFactory } from '../../js/common/xss-safe-factory.js';
import { AcctStore, EmailProvider } from '../../js/common/platform/store/acct-store.js';
import { KeyStore } from '../../js/common/platform/store/key-store.js';
import { KeyStoreUtil } from '../../js/common/core/crypto/key-store-util.js';
import { GlobalStore } from '../../js/common/platform/store/global-store.js';
import { PassphraseStore } from '../../js/common/platform/store/passphrase-store.js';
import Swal from 'sweetalert2';
import { FlowCryptWebsite } from '../../js/common/api/flowcrypt-website.js';
import { AccountServer } from '../../js/common/api/account-server.js';
import { isCustomerUrlFesUsed } from '../../js/common/helpers.js';

View.run(
  class SettingsView extends View {
    private readonly acctEmail: string | undefined;
    private readonly page: string | undefined;
    private readonly pageUrlParams: UrlParams | undefined;
    private readonly addNewAcct: boolean;
    private readonly advanced: boolean;

    private readonly gmail: Gmail | undefined;
    private readonly tabId = BrowserMsg.generateTabId();
    private notifications!: Notifications;
    private clientConfiguration: ClientConfiguration | undefined;
    private acctServer: AccountServer | undefined;

    private altAccounts: JQuery;

    public constructor() {
      super();
      const uncheckedUrlParams = Url.parse(['acctEmail', 'page', 'pageUrlParams', 'advanced', 'addNewAcct']);
      this.acctEmail = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'acctEmail');
      this.page = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'page');
      if (this.page && !/^(\/chrome|modules)/.test(this.page)) {
        Ui.modal.error('An unexpected value was found for the page parameter').catch((err: unknown) => {
          console.log(err);
        });
        this.page = undefined;
      }
      this.page = this.page === 'undefined' ? undefined : this.page; // in case an "undefined" string slipped in
      this.pageUrlParams = typeof uncheckedUrlParams.pageUrlParams === 'string' ? (JSON.parse(uncheckedUrlParams.pageUrlParams) as UrlParams) : undefined;
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
      const isDevMode = !('update_url' in chrome.runtime.getManifest());
      $('#status-row #status_version').text(`v:${VERSION}${isDevMode ? '-dev' : ''}`);
      for (const webmailLName of await Env.webmails()) {
        $('.signin_button.' + webmailLName).css('display', 'inline-block');
      }
      this.notifications = new Notifications();
      await this.acctServer?.initialize();
      if (this.acctEmail) {
        this.clientConfiguration = await ClientConfiguration.newInstance(this.acctEmail);
      }
      if (this.clientConfiguration && !this.clientConfiguration.canSubmitPubToAttester()) {
        $('.public_profile_indicator_container').hide(); // contact page is useless if user cannot submit to attester
      }
      if (this.clientConfiguration?.usesKeyManager()) {
        $('.add_key').hide(); // users which a key manager should not be adding keys manually
      }
      $('#status-row #status_version').on(
        'click',
        this.setHandler(async () => {
          await Ui.modal.page('/changelog.txt', true);
        })
      );
      await this.initialize();
      await Assert.abortAndRenderErrOnUnprotectedKey(this.acctEmail, this.tabId);
      if (this.page) {
        Settings.renderSubPage(this.acctEmail, this.tabId, this.page, this.pageUrlParams).catch(Catch.reportErr);
      }
      await Settings.populateAccountsMenu('index.htm');
      Ui.setTestState('ready');
    };

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
      /* eslint-disable @typescript-eslint/no-non-null-assertion */
      BrowserMsg.addListener('add_pubkey_dialog', async ({ emails }: Bm.AddPubkeyDialog) => {
        // todo: use Ui.modal.iframe just like passphrase_dialog does
        const factory = new XssSafeFactory(this.acctEmail!, this.tabId);
        window.open(factory.srcAddPubkeyDialog(emails, 'settings'), '_blank', 'height=680,left=100,menubar=no,status=no,toolbar=no,top=30,width=660');
      });
      BrowserMsg.addListener('notification_show', async ({ notification, group }: Bm.NotificationShow) => {
        this.notifications.show(notification, {}, group);
        let cleared = false;
        const clear = () => {
          if (!cleared) {
            this.notifications.clear(group);
            cleared = true;
          }
        };
        Catch.setHandledTimeout(clear, 10000);
        $('.webmail_notifications').one('click', clear);
      });
      BrowserMsg.addListener('passphrase_dialog', async ({ longids, type, initiatorFrameId }: Bm.PassphraseDialog) => {
        const factory = new XssSafeFactory(this.acctEmail!, this.tabId);
        await factory.showPassphraseDialog(longids, type, initiatorFrameId);
      });
      BrowserMsg.addListener('notification_show_auth_popup_needed', async ({ acctEmail }: Bm.NotificationShowAuthPopupNeeded) => {
        this.notifications.showAuthPopupNeeded(acctEmail);
      });
      BrowserMsg.addListener('notification_show_custom_idp_auth_popup_needed', async ({ acctEmail }: Bm.NotificationShowAuthPopupNeeded) => {
        this.notifications.showCustomIDPAuthPopupNeeded(acctEmail);
      });
      BrowserMsg.addListener('close_dialog', async () => {
        Swal.close();
      });
      BrowserMsg.listen(this.tabId);
      $('.show_settings_page').on(
        'click',
        this.setHandler(async target => {
          const page = $(target).attr('page');
          if (page) {
            await Settings.renderSubPage(this.acctEmail, this.tabId, page, $(target).attr('addurltext') || '');
          } else {
            Catch.report(`Unknown target page in element: ${target.outerHTML}`);
          }
        })
      );
      $('.action_open_public_key_page').on(
        'click',
        this.setHandler(async () => {
          const prvs = await KeyStoreUtil.parse(await KeyStore.getRequired(this.acctEmail!));
          const mostUsefulPrv = KeyStoreUtil.chooseMostUseful(prvs, 'EVEN-IF-UNUSABLE');
          const escapedFp = Xss.escape(mostUsefulPrv!.key.id);
          await Settings.renderSubPage(this.acctEmail, this.tabId, 'modules/my_key.htm', `&fingerprint=${escapedFp}`);
        })
      );
      $('.action_show_encrypted_inbox').on(
        'click',
        this.setHandler(() => {
          window.location.href = Url.create('/chrome/settings/inbox/inbox.htm', { acctEmail: this.acctEmail! });
        })
      );
      /* eslint-enable @typescript-eslint/no-non-null-assertion */
      $('.action_add_account').on(
        'click',
        this.setHandlerPrevent('double', async () => {
          await Settings.newGoogleAcctAuthPromptThenAlertOrForward(this.tabId);
        })
      );
      $('.action_google_auth').on(
        'click',
        this.setHandlerPrevent('double', async () => {
          await Settings.newGoogleAcctAuthPromptThenAlertOrForward(this.tabId, this.acctEmail);
        })
      );
      // $('.action_microsoft_auth').on('click', this.setHandlerPrevent('double', function() {
      //   new_microsoft_account_authentication_prompt(account_email);
      // }));
      $('body').on(
        'click',
        this.setHandler(() => {
          this.altAccounts.removeClass('visible');
          $('.ion-ios-arrow-down').removeClass('up');
          $('.add-account').removeClass('hidden');
        })
      );
      $('.toggle-settings').on(
        'click',
        this.setHandler(() => {
          $('#settings').toggleClass('advanced');
        })
      );
      let preventAccountsMenuMouseenter = false;
      $('.action-toggle-accounts-menu').on(
        'click',
        this.setHandler((target, event) => {
          event.stopPropagation();
          if (this.altAccounts.hasClass('visible')) {
            this.altAccounts.removeClass('visible');
          } else {
            this.altAccounts.addClass('visible');
            this.altAccounts.find('a').first().trigger('focus');
          }
          $('.ion-ios-arrow-down').toggleClass('up');
          $('.add-account').toggleClass('hidden');
          preventAccountsMenuMouseenter = true; // prevent mouse events when menu is animated with fadeInDown
          Catch.setHandledTimeout(() => {
            preventAccountsMenuMouseenter = false;
          }, 500);
        })
      );
      this.altAccounts.on(
        'keydown',
        this.setHandler((el, ev) => {
          this.accountsMenuKeydownHandler(ev);
        })
      );
      this.altAccounts.find('a').on(
        'mouseenter',
        Ui.event.handle(target => {
          if (!preventAccountsMenuMouseenter) {
            $(target).trigger('focus');
          }
        })
      );
      $('#status-row #status_google').on(
        'click',
        this.setHandler(async () => {
          await Settings.renderSubPage(this.acctEmail, this.tabId, 'modules/debug_api.htm', {
            which: 'google_account',
          });
        })
      );
      $('#status-row #status_local_store').on(
        'click',
        this.setHandler(async () => {
          await Settings.renderSubPage(this.acctEmail, this.tabId, 'modules/debug_api.htm', { which: 'local_store' });
        })
      );
      Ui.activateModalPageLinkTags();
    };

    private accountsMenuKeydownHandler = (e: JQuery.TriggeredEvent<HTMLElement>): void => {
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
        prev.trigger('focus');
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        let next = currentActive.next();
        if (!next.length) {
          next = accounts.first();
        }
        next.trigger('focus');
      }
    };

    private displayOrig = (selector: string) => {
      const filterable = $(selector);
      filterable.filter('a, b, i, img, span, input, label, select').css('display', 'inline-block');
      filterable.filter('table').css('display', 'table');
      filterable.filter('tr').css('display', 'table-row');
      filterable.filter('td').css('display', 'table-cell');
      filterable.filter('.row').css('display', 'flex');
      filterable.not('a, b, i, img, span, input, label, select, table, tr, td, .row').css('display', 'block');
    };

    private initialize = async () => {
      if (this.addNewAcct) {
        $('.show_if_setup_not_done').css('display', 'initial');
        $('.hide_if_setup_not_done').css('display', 'none');
        await Settings.newGoogleAcctAuthPromptThenAlertOrForward(this.tabId);
      } else if (this.acctEmail) {
        $('.email-address').text(this.acctEmail);
        const storage = await AcctStore.get(this.acctEmail, ['setup_done', 'email_provider', 'picture']);
        if (storage.setup_done) {
          const rules = await ClientConfiguration.newInstance(this.acctEmail);
          if (!rules.canBackupKeys()) {
            $('.show_settings_page[page="modules/backup.htm"]').parent().remove();
          }
          this.checkGoogleAcct().catch(Catch.reportErr);
          this.checkFcAcctAndContactPage().catch(Catch.reportErr);
          if (storage.picture) {
            $('img.main-profile-img')
              .attr('src', storage.picture)
              .on(
                'error',
                this.setHandler(self => {
                  $(self).off().attr('src', '/img/svgs/profile-icon.svg');
                })
              );
          }
          await this.renderNotificationBanners(storage.email_provider || 'gmail', rules);
          this.displayOrig('.hide_if_setup_not_done');
          $('.show_if_setup_not_done').css('display', 'none');
          if (this.advanced) {
            $('#settings').toggleClass('advanced');
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
        if (acctEmails?.[0]) {
          window.location.href = Url.create('index.htm', { acctEmail: acctEmails[0] });
        } else {
          $('.show_if_setup_not_done').css('display', 'initial');
          $('.hide_if_setup_not_done').css('display', 'none');
        }
      }
      $('body').addClass('initialized');
      FlowCryptWebsite.retrieveBlogPosts()
        .then(posts => {
          // do not await because may take a while
          for (const post of posts) {
            const html = `<div class="line"><a href="${Xss.escape(post.url)}" target="_blank">${Xss.escape(post.title.trim())}</a> ${Xss.escape(
              post.date.trim()
            )}</div>`;
            Xss.sanitizeAppend('.blog_post_list', html);
          }
        })
        .catch(ApiErr.reportIfSignificant);
    };

    private renderNotificationBanners = async (emailProvider: EmailProvider, rules: ClientConfiguration) => {
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
      $('.dismiss_install_app_notification').on(
        'click',
        this.setHandler(async () => {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          await GlobalStore.set({ install_mobile_app_notification_dismissed: true });
          $('.install_app_notification').remove();
        })
      );
    };

    private checkFcAcctAndContactPage = async () => {
      const statusContainer = $('.public_profile_indicator_container');
      if (this.acctEmail) {
        // have auth email set
        try {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          await this.acctServer!.fetchAndSaveClientConfiguration();
          $('#status-row #status_flowcrypt').text(`fc:ok`);
        } catch (e) {
          if (e instanceof EnterpriseServerAuthErr) {
            Settings.offerToLoginCustomIDPWithPopupShowModalOnErr(this.acctEmail, () => {
              window.location.reload();
            });
          } else if (ApiErr.isAuthErr(e)) {
            const authNeededLink = $('<a class="bad" href="#">Auth Needed</a>');
            authNeededLink.on(
              'click',
              this.setHandler(async () => {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                await Settings.loginWithPopupShowModalOnErr(this.acctEmail!, false, () => {
                  window.location.reload();
                });
              })
            );
            statusContainer.empty().append(authNeededLink); // xss-direct
            $('#status-row #status_flowcrypt').text(`fc:auth`).addClass('bad');
            Settings.offerToLoginWithPopupShowModalOnErr(this.acctEmail, () => {
              window.location.reload();
            });
          } else if (ApiErr.isNetErr(e)) {
            Xss.sanitizeRender(statusContainer, '<a href="#">Network Error - Retry</a>')
              .find('a')
              .one(
                'click',
                this.setHandler(() => this.checkFcAcctAndContactPage())
              );
            $('#status-row #status_flowcrypt').text(`fc:offline`);
          } else if (e instanceof ClientConfigurationError) {
            Ui.toast(`Failed to update FlowCrypt Client Configuration: ${e.message}`, false, 5);
          } else {
            statusContainer.text('ecp error');
            $('#status-row #status_flowcrypt')
              .text(`fc:error`)
              .attr('title', `FlowCrypt Account Error: ${Xss.escape(String(e))}`);
            Catch.reportErr(e);
          }
        }
      } else {
        $('#status-row #status_flowcrypt').text(`fc:none`);
      }
      statusContainer.css('visibility', 'visible');
    };

    private resolveChangedGoogleAcct = async (newAcctEmail: string) => {
      try {
        /* eslint-disable @typescript-eslint/no-non-null-assertion */
        await Settings.refreshSendAs(this.acctEmail!);
        await Settings.acctStorageChangeEmail(this.acctEmail!, newAcctEmail);
        /* eslint-enable @typescript-eslint/no-non-null-assertion */
        await Ui.modal.info(`Email address changed to ${newAcctEmail}. You should now check that your public key is properly submitted.`);
        window.location.href = Url.create('index.htm', {
          acctEmail: newAcctEmail,
          page: '/chrome/settings/modules/keyserver.htm',
        });
      } catch (e) {
        if (ApiErr.isNetErr(e)) {
          await Ui.modal.error('There was a network error, please try again.');
        } else if (ApiErr.isMailOrAcctDisabledOrPolicy(e)) {
          await Ui.modal.error(Lang.account.googleAcctDisabledOrPolicy);
        } else if (ApiErr.isAuthErr(e)) {
          await Ui.modal.warning('New authorization needed. Please try Additional Settings -> Experimental -> Force Google Account email change');
        } else {
          Catch.reportErr(e);
          await Ui.modal.error(
            `There was an error changing google account, please ${Lang.general.contactMinimalSubsentence(
              this.acctServer ? await isCustomerUrlFesUsed(this.acctEmail ?? '') : false
            )}\n\n${ApiErr.eli5(e)}\n\n${String(e)}`
          );
        }
      }
    };

    private checkGoogleAcct = async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const { sendAs } = await this.gmail!.fetchAcctAliases();
        const primarySendAs = sendAs.find(addr => addr.isPrimary === true);
        if (!primarySendAs) {
          await Ui.modal.warning(`Your account sendAs does not have any primary sendAsEmail`);
          return;
        }
        const googleAcctEmailAddr = primarySendAs.sendAsEmail;
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
          $('#status-row #status_google')
            .text(`g:?:err`)
            .addClass('bad')
            .attr('title', `Cannot determine Google account: ${Xss.escape(String(e))}`);
          Catch.reportErr(e);
        }
      }
    };

    private addKeyRowsHtml = async (privateKeys: KeyInfoWithIdentity[]) => {
      let html = '';
      const canRemoveKey = !this.clientConfiguration?.usesKeyManager();
      for (let i = 0; i < privateKeys.length; i++) {
        const ki = privateKeys[i];
        const prv = await KeyUtil.parse(ki.private);
        const created = new Date(prv.created);
        const date = Str.monthName(created.getMonth()) + ' ' + created.getDate() + ', ' + created.getFullYear();
        let removeKeyBtn = '';
        if (canRemoveKey && privateKeys.length > 1) {
          removeKeyBtn = `(<a href="#" class="action_remove_key" data-test="action-remove-key-${i}" data-fingerprint=${ki.fingerprints[0]} data-type="${ki.family}" data-id="${ki.id}" data-longid="${ki.longid}">remove</a>)`;
        }
        const escapedEmail = Xss.escape(prv.emails[0] || '');
        const escapedLink = `<a href="#" data-test="action-show-key-${i}" class="action_show_key" page="modules/my_key.htm" addurltext="&fingerprint=${ki.id}">${escapedEmail}</a>`;
        const fpHtml = `fingerprint:&nbsp;<span class="good">${Str.spaced(Xss.escape(ki.fingerprints[0]))}</span>`;
        const space = `&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`;
        html += `<div class="row key-content-row">`;
        html += `  <div class="col-12">${escapedLink} from ${Xss.escape(date)}${space}${fpHtml}${space}${KeyUtil.statusHtml(ki.id, prv)}${space}${removeKeyBtn}</div>`;
        html += `</div>`;
      }
      Xss.sanitizeAppend('.key_list', html);
      $('.action_show_key').on(
        'click',
        this.setHandler(async target => {
          /* eslint-disable @typescript-eslint/no-non-null-assertion */
          // the UI below only gets rendered when account_email is available
          await Settings.renderSubPage(this.acctEmail, this.tabId, $(target).attr('page')!, $(target).attr('addurltext') || ''); // all such elements do have page attr
          /* eslint-enable @typescript-eslint/no-non-null-assertion */
        })
      );
      if (canRemoveKey) {
        $('.action_remove_key').on(
          'click',
          this.setHandler(async target => {
            const fingerprint = $(target).data('fingerprint') as string;
            if (await Ui.modal.confirm(Lang.settings.deleteKeyConfirm(Str.spaced(Xss.escape(fingerprint))))) {
              // the UI below only gets rendered when account_email is available
              const family = $(target).data('type') as string;
              const id = $(target).data('id') as string;
              const longid = $(target).data('longid') as string;
              if (family === 'openpgp' || family === 'x509') {
                /* eslint-disable @typescript-eslint/no-non-null-assertion */
                await KeyStore.remove(this.acctEmail!, { family, id });
                await PassphraseStore.set('local', this.acctEmail!, { longid }, undefined);
                await PassphraseStore.set('session', this.acctEmail!, { longid }, undefined);
                /* eslint-enable @typescript-eslint/no-non-null-assertion */
                this.reload(true);
              } else {
                Catch.report(`unexpected key family: ${family}`);
              }
            }
          })
        );
      }
    };

    private reload = (advanced = false) => {
      if (advanced) {
        window.location.href = Url.create('/chrome/settings/index.htm', { acctEmail: this.acctEmail, advanced: true });
      } else {
        window.location.reload();
      }
    };
  }
);
