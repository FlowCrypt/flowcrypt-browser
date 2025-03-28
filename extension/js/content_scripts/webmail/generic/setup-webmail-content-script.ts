/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import Swal from 'sweetalert2';
import { AccountServer } from '../../../common/api/account-server.js';
import { KeyManager } from '../../../common/api/key-server/key-manager.js';
import { ApiErr, EnterpriseServerAuthErr } from '../../../common/api/shared/api-error.js';
import { BrowserMsgCommonHandlers } from '../../../common/browser/browser-msg-common-handlers.js';
import { Bm, BrowserMsg, TabIdRequiredError } from '../../../common/browser/browser-msg.js';
import { ContentScriptWindow } from '../../../common/browser/browser-window.js';
import { Env, WebMailName } from '../../../common/browser/env.js';
import { Time } from '../../../common/browser/time.js';
import { CommonHandlers, Ui } from '../../../common/browser/ui.js';
import { ClientConfiguration, ClientConfigurationError } from '../../../common/client-configuration.js';
import { Str, Url } from '../../../common/core/common.js';
import { InMemoryStoreKeys, VERSION } from '../../../common/core/const.js';
import { getLocalKeyExpiration, processAndStoreKeysFromEkmLocally } from '../../../common/helpers.js';
import { Injector } from '../../../common/inject.js';
import { Lang } from '../../../common/lang.js';
import { Notifications } from '../../../common/notifications.js';
import { Catch } from '../../../common/platform/catch.js';
import { AcctStore } from '../../../common/platform/store/acct-store.js';
import { GlobalStore } from '../../../common/platform/store/global-store.js';
import { InMemoryStore } from '../../../common/platform/store/in-memory-store.js';
import { WebmailVariantString, XssSafeFactory } from '../../../common/xss-safe-factory.js';
import { RelayManager } from '../../../common/relay-manager.js';
import { WebmailElementReplacer } from './webmail-element-replacer.js';

export type WebmailVariantObject = {
  newDataLayer: undefined | boolean;
  newUi: undefined | boolean;
  email: undefined | string;
  gmailVariant: WebmailVariantString;
};

type WebmailSpecificInfo = {
  name: WebMailName;
  variant: WebmailVariantString;
  getUserAccountEmail: () => Promise<string> | string | undefined;
  getUserFullName: () => string | undefined;
  getReplacer: () => WebmailElementReplacer;
  start: (
    acctEmail: string,
    clientConfiguration: ClientConfiguration,
    inject: Injector,
    notifications: Notifications,
    factory: XssSafeFactory,
    relayManager: RelayManager
  ) => Promise<void>;
};

const win = window as unknown as ContentScriptWindow;

export const contentScriptSetupIfVacant = async (webmailSpecific: WebmailSpecificInfo) => {
  const setUpNotification = `
    Set up FlowCrypt now for encrypted email?
    <div class="webmail_notification_buttons">
      <button class="action_open_settings" data-test="notification-setup-action-open-settings">
        Yes
      </button>
      <button class="close" data-test="notification-setup-action-close">
        Remind me later
      </button>
      <button class="notification_setup_needed_dismiss" data-test="notification-setup-action-dismiss">
        Don't remind again
      </button>
    </div>
  `;
  let wasDestroyed = false;
  class DestroyTrigger extends Error {}

  const waitForAcctEmail = async (): Promise<string> => {
    let acctEmailInterval = 1000;
    const webmails = await Env.webmails();
    while (true) {
      const acctEmail = await webmailSpecific.getUserAccountEmail();
      if (typeof acctEmail !== 'undefined') {
        win.account_email_global = acctEmail;
        if (webmails.includes(webmailSpecific.name)) {
          console.info(`Loading FlowCrypt ${VERSION} for ${acctEmail}`);
          return acctEmail;
        } else {
          console.info(`FlowCrypt disabled: ${webmailSpecific.name} integration currently for development only`);
          throw new DestroyTrigger();
        }
      }
      if (acctEmailInterval > 6000) {
        console.info(`Cannot load FlowCrypt yet. Page: ${window.location} (${document.title})`);
      }
      await Time.sleep(acctEmailInterval, win.TrySetDestroyableTimeout);
      acctEmailInterval += 1000;
      if (wasDestroyed) {
        throw new DestroyTrigger(); // maybe not necessary, but don't want to take chances
      }
    }
  };

  const initInternalVars = async (acctEmail: string) => {
    const tabId = BrowserMsg.generateTabId(true);
    const notifications = new Notifications();
    const factory = new XssSafeFactory(acctEmail, tabId, win.reloadable_class, win.destroyable_class);
    const inject = new Injector(webmailSpecific.name, webmailSpecific.variant, factory);
    inject.meta();
    await GlobalStore.acctEmailsAdd(acctEmail);
    saveAcctEmailFullNameIfNeeded(acctEmail).catch(Catch.reportErr); // may take a long time, thus async
    return { tabId, notifications, factory, inject };
  };

  const showNotificationsAndWaitTilAcctSetUp = async (acctEmail: string, notifications: Notifications) => {
    let showSetupNeededNotificationIfSetupNotDone = true;
    while (true) {
      const storage = await AcctStore.get(acctEmail, ['setup_done', 'cryptup_enabled', 'notification_setup_needed_dismissed']);
      if (storage.setup_done === true && storage.cryptup_enabled !== false) {
        // "not false" is due to cryptup_enabled unfedined in previous versions, which means "true"
        notifications.clear('setup');
        return;
      } else if (
        !$('div.webmail_notification').length &&
        !storage.notification_setup_needed_dismissed &&
        showSetupNeededNotificationIfSetupNotDone &&
        storage.cryptup_enabled !== false
      ) {
        notifications.show(setUpNotification, {
          /* eslint-disable @typescript-eslint/naming-convention */
          notification_setup_needed_dismiss: () =>
            AcctStore.set(acctEmail, { notification_setup_needed_dismissed: true })
              .then(() => notifications.clear('setup'))
              .catch(Catch.reportErr),
          action_open_settings: () => BrowserMsg.send.bg.settings({ acctEmail }),
          /* eslint-enable @typescript-eslint/naming-convention */
          close: () => {
            showSetupNeededNotificationIfSetupNotDone = false;
          },
        });
      }
      await Time.sleep(3000, win.TrySetDestroyableTimeout);
      if (wasDestroyed) {
        throw new DestroyTrigger(); // maybe not necessary, but don't want to take chances
      }
    }
  };

  const browserMsgListen = (
    acctEmail: string,
    tabId: string,
    inject: Injector,
    factory: XssSafeFactory,
    notifications: Notifications,
    relayManager: RelayManager,
    ppEvent: { entered?: boolean }
  ) => {
    BrowserMsg.addListener('set_active_window', async req => {
      const { frameId } = req as Bm.ComposeWindow;
      if ($(`.secure_compose_window.active[data-frame-id="${frameId}"]`).length) {
        return; // already active
      }
      $(`.secure_compose_window`).removeClass('previous_active');
      $(`.secure_compose_window.active`).addClass('previous_active').removeClass('active');
      $(`.secure_compose_window[data-frame-id="${frameId}"]`).addClass('active');
    });
    BrowserMsg.addListener('close_compose_window', async req => {
      const { frameId } = req as Bm.ComposeWindow;
      $(`.secure_compose_window[data-frame-id="${frameId}"]`).remove();
      if ($('.secure_compose_window.previous_active:not(.minimized)').length) {
        BrowserMsg.send.focusPreviousActiveWindow(tabId, {
          frameId: $('.secure_compose_window.previous_active:not(.minimized)').data('frame-id') as string,
        });
      } else if ($('.secure_compose_window:not(.minimized)').length) {
        BrowserMsg.send.focusPreviousActiveWindow(tabId, {
          frameId: $('.secure_compose_window:not(.minimized)').data('frame-id') as string,
        });
      }
      // reposition the rest of the compose windows
      if (!$(`.secure_compose_window[data-order="1"]`).length) {
        $(`.secure_compose_window[data-order="2"]`).attr('data-order', 1);
      }
      if (!$(`.secure_compose_window[data-order="2"]`).length) {
        $(`.secure_compose_window[data-order="3"]`).attr('data-order', 2);
      }
    });
    BrowserMsg.addListener('focus_body', async () => {
      if (document.activeElement instanceof HTMLElement) {
        // iframe have to be blurred before focusing body
        document.activeElement.blur();
      }
      $('body').trigger('focus');
    });
    BrowserMsg.addListener('focus_frame', async req => {
      const { frameId } = req as Bm.ComposeWindow;
      $(`iframe#${frameId}`).trigger('focus');
    });
    BrowserMsg.addListener('close_reply_message', async req => {
      const { frameId } = req as Bm.ComposeWindow;
      $(`iframe#${frameId}`).remove();
    });
    BrowserMsg.addListener('reinsert_reply_box', async req => {
      const { replyMsgId } = req as Bm.ReinsertReplyBox;
      webmailSpecific.getReplacer().reinsertReplyBox(replyMsgId);
    });
    BrowserMsg.addListener('close_dialog', async () => {
      Swal.close();
    });
    BrowserMsg.addListener('scroll_to_reply_box', async req => {
      const { replyMsgId } = req as Bm.ScrollToReplyBox;
      webmailSpecific.getReplacer().scrollToReplyBox(replyMsgId);
    });
    BrowserMsg.addListener('scroll_to_cursor_in_reply_box', async req => {
      const { replyMsgId, cursorOffsetTop } = req as Bm.ScrollToCursorInReplyBox;
      webmailSpecific.getReplacer().scrollToCursorInReplyBox(replyMsgId, cursorOffsetTop);
    });
    BrowserMsg.addListener('passphrase_dialog', async req => {
      const args = req as Bm.PassphraseDialog;
      await showPassphraseDialog(factory, args);
    });
    BrowserMsg.addListener('passphrase_entry', async req => {
      const { entered } = req as Bm.PassphraseEntry;
      ppEvent.entered = entered;
    });
    BrowserMsg.addListener('confirmation_show', CommonHandlers.showConfirmationHandler);
    BrowserMsg.addListener('add_pubkey_dialog', async req => {
      const { emails } = req as Bm.AddPubkeyDialog;
      await factory.showAddPubkeyDialog(emails);
    });
    BrowserMsg.addListener('pgp_block_ready', async req => {
      const { frameId, messageSender } = req as Bm.PgpBlockReady;
      relayManager.associate(frameId, messageSender);
    });
    BrowserMsg.addListener('pgp_block_retry', async req => {
      const { frameId, messageSender } = req as Bm.PgpBlockRetry;
      relayManager.retry(frameId, messageSender);
    });
    BrowserMsg.addListener('notification_show', async req => {
      const { notification, callbacks, group } = req as Bm.NotificationShow;
      notifications.show(notification, callbacks, group);
      $('body').one(
        'click',
        Catch.try(() => notifications.clear(group))
      );
    });
    BrowserMsg.addListener('notification_show_auth_popup_needed', async req => {
      const { acctEmail } = req as Bm.NotificationShowAuthPopupNeeded;
      notifications.showAuthPopupNeeded(acctEmail);
    });
    BrowserMsg.addListener('notification_show_custom_idp_auth_popup_needed', async req => {
      const { acctEmail } = req as Bm.NotificationShowAuthPopupNeeded;
      notifications.showCustomIDPAuthPopupNeeded(acctEmail);
    });
    BrowserMsg.addListener('reply_pubkey_mismatch', BrowserMsgCommonHandlers.replyPubkeyMismatch);
    BrowserMsg.addListener('add_end_session_btn', () => inject.insertEndSessionBtn(acctEmail));
    BrowserMsg.addListener('show_attachment_preview', async req => {
      const { iframeUrl } = req as Bm.ShowAttachmentPreview;
      await Ui.modal.attachmentPreview(iframeUrl);
    });
    BrowserMsg.addListener('ajax_progress', async req => {
      const progress = req as Bm.AjaxProgress;
      relayManager.renderProgress(progress);
    });
    BrowserMsg.addListener('render_public_keys', async req => {
      const { traverseUp, afterFrameId, publicKeys } = req as Bm.RenderPublicKeys;
      const traverseUpLevels = traverseUp || 0;
      let appendAfter = $(`iframe#${afterFrameId}`);
      for (let i = 0; i < traverseUpLevels; i++) {
        appendAfter = appendAfter.parent();
      }
      for (const armoredPubkey of publicKeys) {
        appendAfter.after(factory.embeddedPubkey(armoredPubkey, false)); // xss-safe-value
      }
    });
    BrowserMsg.listen(tabId);
    BrowserMsg.send.setHandlerReadyForPGPBlock('broadcast');
  };

  const saveAcctEmailFullNameIfNeeded = async (acctEmail: string) => {
    const storage = await AcctStore.get(acctEmail, ['full_name']);
    let timeout = 1000;
    if (typeof storage.full_name === 'undefined') {
      while (true) {
        const fullName = webmailSpecific.getUserFullName();
        if (fullName) {
          await AcctStore.set(acctEmail, { full_name: fullName }); // eslint-disable-line @typescript-eslint/naming-convention
          return;
        }
        await Time.sleep(timeout, win.TrySetDestroyableTimeout);
        timeout += 1000;
        if (wasDestroyed) {
          return;
        }
      }
    }
  };

  const showPassphraseDialog = async (factory: XssSafeFactory, { longids, type, initiatorFrameId }: Bm.PassphraseDialog) => {
    await factory.showPassphraseDialog(longids, type, initiatorFrameId);
  };

  const processKeysFromEkm = async (
    acctEmail: string,
    decryptedPrivateKeys: string[],
    clientConfiguration: ClientConfiguration,
    factory: XssSafeFactory,
    idToken: string,
    ppEvent: { entered?: boolean }
  ) => {
    try {
      const { needPassphrase, updateCount, noKeysSetup } = await processAndStoreKeysFromEkmLocally({
        acctEmail,
        decryptedPrivateKeys,
      });
      if (noKeysSetup) {
        if (!needPassphrase && !clientConfiguration.canCreateKeys()) {
          await Ui.modal.error(Lang.setup.noKeys);
          BrowserMsg.send.bg.settings({ acctEmail, path: 'index.htm' });
        } else {
          BrowserMsg.send.bg.settings({
            acctEmail,
            path: Url.create('setup.htm', { idToken, action: 'update_from_ekm' }),
          });
        }
        return;
      }
      if (needPassphrase) {
        ppEvent.entered = undefined;
        await showPassphraseDialog(factory, { longids: [], type: 'update_key' });
        while (ppEvent.entered === undefined) {
          await Time.sleep(100);
        }
        if (ppEvent.entered) {
          await processKeysFromEkm(acctEmail, decryptedPrivateKeys, clientConfiguration, factory, idToken, ppEvent);
        } else {
          return;
        }
      } else if (updateCount && updateCount > 0) {
        Ui.toast('Account keys updated');
      }
    } catch (e) {
      Catch.reportErr(e);
      Ui.toast(`Could not update keys from EKM due to error: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const startPullingKeysFromEkm = async (
    acctEmail: string,
    clientConfiguration: ClientConfiguration,
    factory: XssSafeFactory,
    ppEvent: { entered?: boolean },
    notifications: Notifications,
    completion: () => void
  ) => {
    if (clientConfiguration.usesKeyManager()) {
      const idToken = await InMemoryStore.get(acctEmail, InMemoryStoreKeys.ID_TOKEN);
      if (idToken) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const keyManager = new KeyManager(clientConfiguration.getKeyManagerUrlForPrivateKeys()!);
        Catch.setHandledTimeout(async () => {
          try {
            const { privateKeys } = await keyManager.getPrivateKeys(acctEmail);
            await processKeysFromEkm(
              acctEmail,
              privateKeys.map(entry => entry.decryptedPrivateKey),
              clientConfiguration,
              factory,
              idToken,
              ppEvent
            );
          } catch (e) {
            if (e instanceof EnterpriseServerAuthErr) {
              notifications.showCustomIDPAuthPopupNeeded(acctEmail);
              return;
            }
            throw e;
          } finally {
            completion();
          }
        }, 0);
      } else {
        completion();
      }
    } else {
      completion();
    }
  };

  const updateClientConfiguration = async (acctEmail: string) => {
    try {
      await (await AccountServer.init(acctEmail)).fetchAndSaveClientConfiguration();
    } catch (e) {
      if (e instanceof EnterpriseServerAuthErr) {
        // user will see a prompt to log in during some other actions that involve backend
        // at which point the update will happen next time user loads the page
      } else if (ApiErr.isNetErr(e)) {
        // ignore
      } else if (e instanceof ClientConfigurationError) {
        Ui.toast(`Failed to update FlowCrypt Client Configuration: ${e.message}`, false, 5);
      } else {
        Catch.reportErr(e);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const errType = e.constructor?.name || 'Error';
        Ui.toast(`Failed to update FlowCrypt Client Configuration: ${e instanceof Error ? e.message : String(e)} (${errType})`);
      }
    }
  };

  const notifyExpiringKeys = async (acctEmail: string, clientConfiguration: ClientConfiguration, notifications: Notifications) => {
    const expiration = await getLocalKeyExpiration(acctEmail);
    if (expiration === undefined) {
      return;
    }
    const expireInDays = Math.ceil((expiration - Date.now()) / 1000 / 60 / 60 / 24);
    if (expireInDays > 30) {
      return;
    }
    let warningMsg: string;
    if (clientConfiguration.usesKeyManager()) {
      let expirationText: string;
      if (expireInDays > 0) {
        expirationText = `Your local keys expire in ${Str.pluralize(expireInDays, 'day')}.<br/>`;
      } else {
        expirationText = `Your local keys are expired.<br/>`;
      }
      warningMsg =
        expirationText +
        `To receive the latest keys, please ensure that you are connected to your corporate network (or through VPN) and have entered your FlowCrypt passphrase. Then reload Gmail.<br/>` +
        `If this notification still shows after that, please contact your Help Desk.`;
    } else {
      let expirationText: string;
      if (expireInDays > 0) {
        expirationText = `Your keys are expiring in ${Str.pluralize(expireInDays, 'day')}.`;
      } else {
        expirationText = `Your keys are expired.`;
      }
      warningMsg = `${expirationText} Please import a newer set of keys to use.`;
    }
    warningMsg += `<a href="#" class="close" data-test="notification-close-expiration-popup">close</a>`;
    notifications.show(warningMsg, {}, 'notify_expiring_keys');
  };

  const entrypoint = async () => {
    try {
      // Do not try to show decrypted content for original message content view
      if (location.href.includes('/popout') || location.href.includes('view=om')) {
        console.info('Showing original message');
        return;
      }
      const acctEmail = await waitForAcctEmail();
      const { tabId, notifications, factory, inject } = await initInternalVars(acctEmail);
      const ppEvent: { entered?: boolean } = {};
      const relayManager = new RelayManager();
      const clientConfiguration = await ClientConfiguration.newInstance(acctEmail);
      if (webmailSpecific.name === 'gmail') {
        Catch.setHandledTimeout(() => updateClientConfiguration(acctEmail), 0);
        await showNotificationsAndWaitTilAcctSetUp(acctEmail, notifications);
        browserMsgListen(acctEmail, tabId, inject, factory, notifications, relayManager, ppEvent);
        await startPullingKeysFromEkm(
          acctEmail,
          clientConfiguration,
          factory,
          ppEvent,
          notifications,
          Catch.try(() => notifyExpiringKeys(acctEmail, clientConfiguration, notifications))
        );
      }
      await webmailSpecific.start(acctEmail, clientConfiguration, inject, notifications, factory, relayManager);
    } catch (e) {
      if (e instanceof TabIdRequiredError) {
        console.error(`FlowCrypt cannot start: ${String(e.message)}`);
      } else if (e instanceof Error && e.message === 'Extension context invalidated.') {
        console.info(`FlowCrypt cannot start: extension context invalidated. Destroying.`);
        win.destroy();
      } else if (!(e instanceof DestroyTrigger)) {
        Catch.reportErr(e);
      }
    }
  };

  if (!win.injected) {
    /**
     * This tries to deal with initial environment setup and plugin updtates in a running tab.
     * - vacant: no influence of previous script is apparent in the DOM
     * - destroy: script from old world will receive destroy event from new script (DOM event) and tear itself down. Should cause tab to be vacant.
     * - murdered: what Firefox does to detached scripts. Will NOT cause tab to be vacant.
     */

    win.injected = true; // background script will use this to test if scripts were already injected, and inject if not
    win.account_email_global = undefined; // used by background script
    win.same_world_global = true; // used by background_script

    win.destruction_event = Env.runtimeId() + '_destroy';
    win.destroyable_class = Env.runtimeId() + '_destroyable';
    win.reloadable_class = Env.runtimeId() + '_reloadable';
    win.destroyable_intervals = [];
    win.destroyable_timeouts = [];

    win.destroy = () => {
      Catch.try(() => {
        console.info('Updating FlowCrypt');
        document.removeEventListener(win.destruction_event, win.destroy);
        for (const id of win.destroyable_intervals) {
          clearInterval(id);
        }
        for (const id of win.destroyable_timeouts) {
          clearTimeout(id);
        }
        $('.' + win.destroyable_class).remove();
        // eslint-disable-next-line local-rules/standard-loops
        $('.' + win.reloadable_class).each((i, reloadableEl) => {
          $(reloadableEl).replaceWith($(reloadableEl)[0].outerHTML); // xss-reinsert - inserting code that was already present should not be dangerous
        });
        wasDestroyed = true;
      })();
    };

    win.vacant = () => {
      if (Catch.isThunderbirdMail()) {
        return true;
      } else {
        return !$('.' + win.destroyable_class).length;
      }
    };

    win.TrySetDestroyableInterval = (code, ms) => {
      const id = Catch.setHandledInterval(code, ms);
      win.destroyable_intervals.push(id);
      return id;
    };

    win.TrySetDestroyableTimeout = (code, ms) => {
      const id = Catch.setHandledTimeout(code, ms);
      win.destroyable_timeouts.push(id);
      return id;
    };

    document.dispatchEvent(new CustomEvent(win.destruction_event));
    document.addEventListener(win.destruction_event, win.destroy);

    if (win.vacant()) {
      await entrypoint();
    } else if (Catch.isFirefox()) {
      notifyMurdered();
    }
  }
};

/**
 * This happens when Firefox (or possibly Thunderbird) just updated FlowCrypt.
 *
 * Previous (meaning this currently running) instance of FlowCrypt will no longer
 *   have access to its various classes or global variables, and is left in a
 *   semi-functioning state. The best we can do is to ask the user to reload
 *   the tab, which will load the newly updated version of the extension cleanly.
 */
export const notifyMurdered = () => {
  const notifEl = document.getElementsByClassName('webmail_notifications')[0];
  const div = document.createElement('div');
  div.innerText = 'FlowCrypt has updated, please reload the tab. ';
  div.classList.add('webmail_notification');
  const a = document.createElement('a');
  a.href = '#';
  a.onclick = function () {
    const parent = (this as HTMLAnchorElement).parentNode as HTMLElement | undefined;
    parent?.remove();
  };
  a.textContent = 'close';
  div.appendChild(a);
  notifEl.textContent = '';
  notifEl.appendChild(div);
};
