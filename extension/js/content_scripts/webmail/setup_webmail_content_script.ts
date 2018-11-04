/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store } from '../../common/store.js';
import { Catch, Env, Value } from '../../common/common.js';
import { Injector } from '../../common/inject.js';
import { Notifications, NotificationWithHandlers } from '../../common/notifications.js';
import { ContentScriptWindow, BrowserMsg, TabIdRequiredError } from '../../common/extension.js';
import { Ui, XssSafeFactory, PassphraseDialogType, WebMailName, WebmailVariantString } from '../../common/browser.js';

export type WebmailVariantObject = { newDataLayer: null | boolean, newUi: null | boolean, email: null | string, gmailVariant: WebmailVariantString };
type WebmailSpecificInfo = {
  name: WebMailName;
  variant: WebmailVariantString;
  getUserAccountEmail: () => string | undefined;
  getUserFullName: () => string | undefined;
  getReplacer: () => WebmailElementReplacer;
  start: (acctEmail: string, inject: Injector, notifications: Notifications, factory: XssSafeFactory, notifyMurdered: () => void) => Promise<void>;
};
export interface WebmailElementReplacer {
  everything: () => void;
  setReplyBoxEditable: () => void;
  reinsertReplyBox: (subject: string, myEmail: string, replyTo: string[], threadId: string) => void;
  scrollToBottomOfConvo: () => void;
}

export let contentScriptSetupIfVacant = async (webmailSpecific: WebmailSpecificInfo) => {

  let setUpNotification = '<a href="#" class="action_open_settings" data-test="notification-setup-action-open-settings">Set up FlowCrypt</a> to send and receive secure email on this account. <a href="#" class="notification_setup_needed_dismiss" data-test="notification-setup-action-dismiss">dismiss</a> <a href="#" class="close" data-test="notification-setup-action-close">remind me later</a>';
  let wasDestroyed = false;
  class DestroyTrigger extends Error { }

  let waitForAcctEmail = async (): Promise<string> => {
    let acctEmailInterval = 1000;
    let webmails = await Env.webmails();
    while (true) {
      let acctEmail = webmailSpecific.getUserAccountEmail();
      if (typeof acctEmail !== 'undefined' && Catch.version()) {
        (window as ContentScriptWindow).account_email_global = acctEmail;
        if (Value.is(webmailSpecific.name).in(webmails)) {
          console.info(`Loading FlowCrypt ${Catch.version()} for ${acctEmail}`);
          return acctEmail;
        } else {
          console.info(`FlowCrypt disabled: ${webmailSpecific.name} integration currently for development only`);
          throw new DestroyTrigger();
        }
      }
      if (acctEmailInterval > 6000) {
        console.info(`Cannot load FlowCrypt yet. Page: ${window.location} (${document.title})`);
      }
      await Ui.time.sleep(acctEmailInterval, (window as ContentScriptWindow).TrySetDestroyableTimeout);
      acctEmailInterval += 1000;
      if (wasDestroyed) {
        throw new DestroyTrigger(); // maybe not necessary, but don't want to take chances
      }
    }
  };

  let initInternalVars = async (acctEmail: string) => {
    let tabId = await BrowserMsg.requiredTabId();
    let notifications = new Notifications(tabId);
    let factory = new XssSafeFactory(acctEmail, tabId, (window as ContentScriptWindow).reloadable_class, (window as ContentScriptWindow).destroyable_class);
    let inject = new Injector(webmailSpecific.name, webmailSpecific.variant, factory);
    inject.meta();
    await Store.acctEmailsAdd(acctEmail);
    saveAcctEmailFullNameIfNeeded(acctEmail).catch(Catch.rejection); // may take a long time, thus async
    return { tabId, notifications, factory, inject };
  };

  let showNotificationsAndWaitTilAcctSetUp = async (acctEmail: string, notifications: Notifications) => {
    let showSetupNeededNotificationIfSetupNotDone = true;
    while (true) {
      let storage = await Store.getAcct(acctEmail, ['setup_done', 'cryptup_enabled', 'notification_setup_needed_dismissed']);
      if (storage.setup_done === true && storage.cryptup_enabled !== false) { // "not false" is due to cryptup_enabled unfedined in previous versions, which means "true"
        notifications.clear();
        return;
      } else if (!$("div.webmail_notification").length && !storage.notification_setup_needed_dismissed && showSetupNeededNotificationIfSetupNotDone && storage.cryptup_enabled !== false) {
        notifications.show(setUpNotification, {
          notification_setup_needed_dismiss: () => Store.set(acctEmail, { notification_setup_needed_dismissed: true }).then(() => notifications.clear()).catch(Catch.rejection),
          action_open_settings: () => BrowserMsg.sendAwait(null, 'settings', { acctEmail }),
          close: () => { showSetupNeededNotificationIfSetupNotDone = false; },
        });
      }
      await Ui.time.sleep(3000, (window as ContentScriptWindow).TrySetDestroyableTimeout);
      if (wasDestroyed) {
        throw new DestroyTrigger(); // maybe not necessary, but don't want to take chances
      }
    }
  };

  let browserMsgListen = (acctEmail: string, tabId: string, inject: Injector, factory: XssSafeFactory, notifications: Notifications) => {
    BrowserMsg.listen({
      open_new_message: () => {
        inject.openComposeWin();
      },
      close_new_message: () => {
        $('div.new_message').remove();
      },
      close_reply_message: (data: { frameId: string }) => {
        $('iframe#' + data.frameId).remove();
      },
      reinsert_reply_box: (data: { subject: string, myEmail: string, theirEmail: string[], threadId: string }) => webmailSpecific.getReplacer().reinsertReplyBox(data.subject, data.myEmail, data.theirEmail, data.threadId),
      render_public_keys: (data: { publicKeys: string[], afterFrameId: string, traverseUp?: number }) => {
        let traverseUpLevels = data.traverseUp as number || 0;
        let appendAfter = $('iframe#' + data.afterFrameId);
        for (let i = 0; i < traverseUpLevels; i++) {
          appendAfter = appendAfter.parent();
        }
        for (let armoredPubkey of data.publicKeys) {
          appendAfter.after(factory.embeddedPubkey(armoredPubkey, false));
        }
      },
      close_dialog: () => {
        $('#cryptup_dialog').remove();
      },
      scroll_to_bottom_of_conversation: () => webmailSpecific.getReplacer().scrollToBottomOfConvo(),
      passphrase_dialog: (data: { longids: string[], type: PassphraseDialogType }) => {
        if (!$('#cryptup_dialog').length) {
          $('body').append(factory.dialogPassphrase(data.longids, data.type)); // xss-safe-factory
        }
      },
      subscribe_dialog: (data: { source: string, subscribeResultTabId: string }) => {
        if (!$('#cryptup_dialog').length) {
          $('body').append(factory.dialogSubscribe(null, data ? data.source : null, data ? data.subscribeResultTabId : null)); // xss-safe-factory
        }
      },
      add_pubkey_dialog: (data: { emails: string[] }) => {
        if (!$('#cryptup_dialog').length) {
          $('body').append(factory.dialogAddPubkey(data.emails)); // xss-safe-factory
        }
      },
      notification_show: (data: NotificationWithHandlers) => {
        notifications.show(data.notification, data.callbacks);
        $('body').one('click', Catch.try(notifications.clear));
      },
      notification_show_auth_popup_needed: (data: { acctEmail: string }) => {
        notifications.showAuthPopupNeeded(data.acctEmail);
      },
      reply_pubkey_mismatch: () => {
        let replyIframe = $('iframe.reply_message').get(0) as HTMLIFrameElement | undefined;
        if (replyIframe) {
          replyIframe.src = replyIframe.src.replace('/compose.htm?', '/reply_pubkey_mismatch.htm?');
        }
      },
    }, tabId);
  };

  let saveAcctEmailFullNameIfNeeded = async (acctEmail: string) => {
    let storage = await Store.getAcct(acctEmail, ['full_name']);
    let timeout = 1000;
    if (typeof storage.full_name === 'undefined') {
      while (true) {
        let fullName = webmailSpecific.getUserFullName();
        if (fullName) {
          await Store.set(acctEmail, { fullName });
          return;
        }
        await Ui.time.sleep(timeout, (window as ContentScriptWindow).TrySetDestroyableTimeout);
        timeout += 1000;
        if (wasDestroyed) {
          return;
        }
      }
    }
  };

  let notifyMurdered = () => {
    document.getElementsByClassName('webmail_notifications')[0].innerHTML = '<div class="webmail_notification">FlowCrypt has updated, please reload the tab.<a href="#" onclick="parentNode.remove()">close</a></div>'; // xss-direct
  };

  let entrypoint = async () => {
    try {
      let acctEmail = await waitForAcctEmail();
      let { tabId, notifications, factory, inject } = await initInternalVars(acctEmail);
      await showNotificationsAndWaitTilAcctSetUp(acctEmail, notifications);
      browserMsgListen(acctEmail, tabId, inject, factory, notifications);
      await BrowserMsg.sendAwait(null, 'migrate_account', { acctEmail });
      await webmailSpecific.start(acctEmail, inject, notifications, factory, notifyMurdered);
    } catch (e) {
      if (e instanceof TabIdRequiredError) {
        e.message = `FlowCrypt cannot start: ${e.message}`;
        Catch.handleException(e);
      } else if (e && e.message === 'Extension context invalidated.') {
        console.info(`FlowCrypt cannot start: extension context invalidated. Destroying.`);
        (window as ContentScriptWindow).destroy();
      } else if (!(e instanceof DestroyTrigger)) {
        Catch.handleException(e);
      }
    }
  };

  if (!(window as ContentScriptWindow).injected) {

    /**
     * This tries to deal with initial environment setup and plugin updtates in a running tab.
     * - vacant: no influence of previous script is apparent in the DOM
     * - destroy: script from old world will receive destroy event from new script (DOM event) and tear itself down. Should cause tab to be vacant.
     * - murdered: what Firefox does to detached scripts. Will NOT cause tab to be vacant.
     */

    (window as ContentScriptWindow).injected = true; // background script will use this to test if scripts were already injected, and inject if not
    (window as ContentScriptWindow).account_email_global = null; // used by background script
    (window as ContentScriptWindow).same_world_global = true; // used by background_script

    (window as ContentScriptWindow).destruction_event = Env.runtimeId() + '_destroy';
    (window as ContentScriptWindow).destroyable_class = Env.runtimeId() + '_destroyable';
    (window as ContentScriptWindow).reloadable_class = Env.runtimeId() + '_reloadable';
    (window as ContentScriptWindow).destroyable_intervals = [];
    (window as ContentScriptWindow).destroyable_timeouts = [];

    (window as ContentScriptWindow).destroy = () => {
      Catch.try(() => {
        console.info('Updating FlowCrypt');
        document.removeEventListener((window as ContentScriptWindow).destruction_event, (window as ContentScriptWindow).destroy);
        for (let id of (window as ContentScriptWindow).destroyable_intervals) {
          clearInterval(id);
        }
        for (let id of (window as ContentScriptWindow).destroyable_timeouts) {
          clearTimeout(id);
        }
        $('.' + (window as ContentScriptWindow).destroyable_class).remove();
        $('.' + (window as ContentScriptWindow).reloadable_class).each((i, reloadableEl) => {
          $(reloadableEl).replaceWith($(reloadableEl)[0].outerHTML); // xss-reinsert - inserting code that was already present should not be dangerous
        });
        wasDestroyed = true;
      })();
    };

    (window as ContentScriptWindow).vacant = () => {
      return !$('.' + (window as ContentScriptWindow).destroyable_class).length;
    };

    (window as ContentScriptWindow).TrySetDestroyableInterval = (code, ms) => {
      let id = Catch.setHandledInterval(code, ms);
      (window as ContentScriptWindow).destroyable_intervals.push(id);
      return id;
    };

    (window as ContentScriptWindow).TrySetDestroyableTimeout = (code, ms) => {
      let id = Catch.setHandledTimeout(code, ms);
      (window as ContentScriptWindow).destroyable_timeouts.push(id);
      return id;
    };

    document.dispatchEvent(new CustomEvent((window as ContentScriptWindow).destruction_event));
    document.addEventListener((window as ContentScriptWindow).destruction_event, (window as ContentScriptWindow).destroy);

    if ((window as ContentScriptWindow).vacant()) {
      await entrypoint();
    } else if (Env.browser().name === 'firefox') {
      notifyMurdered();
    }

  }

};
