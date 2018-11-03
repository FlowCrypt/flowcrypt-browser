/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store } from '../../common/storage.js';
import { Catch, Env, Value } from '../../common/common.js';
import { Injector } from '../../common/inject.js';
import { Notifications, NotificationWithHandlers } from '../../common/notifications.js';
import { ContentScriptWindow, BrowserMsg, TabIdRequiredError } from '../../common/extension.js';
import { Ui, XssSafeFactory, PassphraseDialogType, WebMailName, WebmailVariantString } from '../../common/browser.js';

export type WebmailVariantObject = {new_data_layer: null|boolean, new_ui: null|boolean, email: null|string, gmail_variant: WebmailVariantString};
type WebmailSpecificInfo = {
  name: WebMailName;
  variant: WebmailVariantString;
  get_user_account_email: () => string|undefined;
  get_user_full_name: () => string|undefined;
  get_replacer: () => WebmailElementReplacer;
  start: (account_email: string, inject: Injector, notifications: Notifications, factory: XssSafeFactory, notify_murdered: () => void) => Promise<void>;
};
export interface WebmailElementReplacer {
  everything: () => void;
  set_reply_box_editable: () => void;
  reinsert_reply_box: (subject: string, my_email: string, reply_to: string[], thread_id: string) => void;
  scroll_to_bottom_of_conversation: () => void;
}

export let content_script_setup_if_vacant = async (webmail_specific: WebmailSpecificInfo) => {

  let set_up_notification = '<a href="#" class="action_open_settings" data-test="notification-setup-action-open-settings">Set up FlowCrypt</a> to send and receive secure email on this account. <a href="#" class="notification_setup_needed_dismiss" data-test="notification-setup-action-dismiss">dismiss</a> <a href="#" class="close" data-test="notification-setup-action-close">remind me later</a>';
  let was_destroyed = false;
  class DestroyTrigger extends Error {}

  let wait_for_account_email = async (): Promise<string> => {
    let account_email_interval = 1000;
    let webmails = await Env.webmails();
    while(true) {
      let account_email = webmail_specific.get_user_account_email();
      if (typeof account_email !== 'undefined' && Catch.version()) {
        (window as ContentScriptWindow).account_email_global = account_email;
        if (Value.is(webmail_specific.name).in(webmails)) {
          console.info(`Loading FlowCrypt ${Catch.version()} for ${account_email}`);
          return account_email;
        } else {
          console.info(`FlowCrypt disabled: ${webmail_specific.name} integration currently for development only`);
          throw new DestroyTrigger();
        }
      }
      if (account_email_interval > 6000) {
        console.info(`Cannot load FlowCrypt yet. Page: ${window.location} (${document.title})`);
      }
      await Ui.time.sleep(account_email_interval, (window as ContentScriptWindow).TrySetDestroyableTimeout);
      account_email_interval += 1000;
      if(was_destroyed) {
        throw new DestroyTrigger(); // maybe not necessary, but don't want to take chances
      }
    }
  };

  let initialize_internal_variables = async (account_email: string) => {
    let tab_id = await BrowserMsg.required_tab_id();
    let notifications = new Notifications(tab_id);
    let factory = new XssSafeFactory(account_email, tab_id, (window as ContentScriptWindow).reloadable_class, (window as ContentScriptWindow).destroyable_class);
    let inject = new Injector(webmail_specific.name, webmail_specific.variant, factory);
    inject.meta();
    await Store.account_emails_add(account_email);
    save_account_email_full_name_if_needed(account_email).catch(Catch.rejection); // may take a long time, thus async
    return {tab_id, notifications, factory, inject};
  };

  let show_notifications_and_wait_until_account_set_up = async (account_email: string, notifications: Notifications) => {
    let show_setup_needed_notification_if_setup_not_done = true;
    while(true) {
      let storage = await Store.get_account(account_email, ['setup_done', 'cryptup_enabled', 'notification_setup_needed_dismissed']);
      if (storage.setup_done === true && storage.cryptup_enabled !== false) { // "not false" is due to cryptup_enabled unfedined in previous versions, which means "true"
        notifications.clear();
        return;
      } else if (!$("div.webmail_notification").length && !storage.notification_setup_needed_dismissed && show_setup_needed_notification_if_setup_not_done && storage.cryptup_enabled !== false) {
        notifications.show(set_up_notification, {
          notification_setup_needed_dismiss: () => Store.set(account_email, { notification_setup_needed_dismissed: true }).then(() => notifications.clear()).catch(Catch.rejection),
          action_open_settings: () => BrowserMsg.send_await(null, 'settings', {account_email}),
          close: () => { show_setup_needed_notification_if_setup_not_done = false; },
        });
      }
      await Ui.time.sleep(3000, (window as ContentScriptWindow).TrySetDestroyableTimeout);
      if(was_destroyed) {
        throw new DestroyTrigger(); // maybe not necessary, but don't want to take chances
      }
    }
  };

  let browser_message_listen = (account_email: string, tab_id: string, inject: Injector, factory: XssSafeFactory, notifications: Notifications) => {
    BrowserMsg.listen({
      open_new_message: () => {
        inject.open_compose_window();
      },
      close_new_message: () => {
        $('div.new_message').remove();
      },
      close_reply_message: (data: {frame_id: string}) => {
        $('iframe#' + data.frame_id).remove();
      },
      reinsert_reply_box: (data: {subject: string, my_email: string, their_email: string[], thread_id:string}) => webmail_specific.get_replacer().reinsert_reply_box(data.subject, data.my_email, data.their_email, data.thread_id),
      render_public_keys: (data: {public_keys: string[], after_frame_id: string, traverse_up?: number}) => {
        let traverse_up_levels = data.traverse_up as number || 0;
        let append_after = $('iframe#' + data.after_frame_id);
        for (let i = 0; i < traverse_up_levels; i++) {
          append_after = append_after.parent();
        }
        for (let armored_pubkey of data.public_keys) {
          append_after.after(factory.embedded_pubkey(armored_pubkey, false));
        }
      },
      close_dialog: () => {
        $('#cryptup_dialog').remove();
      },
      scroll_to_bottom_of_conversation: () => webmail_specific.get_replacer().scroll_to_bottom_of_conversation(),
      passphrase_dialog: (data: {longids: string[], type: PassphraseDialogType}) => {
        if (!$('#cryptup_dialog').length) {
          $('body').append(factory.dialog_passphrase(data.longids, data.type)); // xss-safe-factory
        }
      },
      subscribe_dialog: (data: {source: string, subscribe_result_tab_id: string}) => {
        if (!$('#cryptup_dialog').length) {
          $('body').append(factory.dialog_subscribe(null, data ? data.source : null, data ? data.subscribe_result_tab_id : null)); // xss-safe-factory
        }
      },
      add_pubkey_dialog: (data: {emails: string[]}) => {
        if (!$('#cryptup_dialog').length) {
          $('body').append(factory.dialog_add_pubkey(data.emails)); // xss-safe-factory
        }
      },
      notification_show: (data: NotificationWithHandlers) => {
        notifications.show(data.notification, data.callbacks);
        $('body').one('click', Catch.try(notifications.clear));
      },
      notification_show_auth_popup_needed: (data: {account_email: string}) => {
        notifications.show_auth_popup_needed(data.account_email);
      },
      reply_pubkey_mismatch: () => {
        let reply_iframe = $('iframe.reply_message').get(0) as HTMLIFrameElement|undefined;
        if(reply_iframe) {
          reply_iframe.src = reply_iframe.src.replace('/compose.htm?', '/reply_pubkey_mismatch.htm?');
        }
      },
    }, tab_id);
  };

  let save_account_email_full_name_if_needed = async (account_email: string) => {
    let storage = await Store.get_account(account_email, ['full_name']);
    let timeout = 1000;
    if (typeof storage.full_name === 'undefined') {
      while(true) {
        let full_name = webmail_specific.get_user_full_name();
        if(full_name) {
          await Store.set(account_email, {full_name});
          return;
        }
        await Ui.time.sleep(timeout, (window as ContentScriptWindow).TrySetDestroyableTimeout);
        timeout += 1000;
        if(was_destroyed) {
          return;
        }
      }
    }
  };

  let notify_murdered = () => {
    document.getElementsByClassName('webmail_notifications')[0].innerHTML = '<div class="webmail_notification">FlowCrypt has updated, please reload the tab.<a href="#" onclick="parentNode.remove()">close</a></div>'; // xss-direct
  };

  let entrypoint = async () => {
    try {
      let account_email = await wait_for_account_email();
      let {tab_id, notifications, factory, inject} = await initialize_internal_variables(account_email);
      await show_notifications_and_wait_until_account_set_up(account_email, notifications);
      browser_message_listen(account_email, tab_id, inject, factory, notifications);
      await BrowserMsg.send_await(null, 'migrate_account', {account_email});
      await webmail_specific.start(account_email, inject, notifications, factory, notify_murdered);
    } catch(e) {
      if(e instanceof TabIdRequiredError) {
        e.message = `FlowCrypt cannot start: ${e.message}`;
        Catch.handle_exception(e);
      } else if(e && e.message === 'Extension context invalidated.') {
        console.info(`FlowCrypt cannot start: extension context invalidated. Destroying.`);
        (window as ContentScriptWindow).destroy();
      } else if(!(e instanceof DestroyTrigger)) {
        Catch.handle_exception(e);
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

    (window as ContentScriptWindow).destruction_event = Env.runtime_id() + '_destroy';
    (window as ContentScriptWindow).destroyable_class = Env.runtime_id() + '_destroyable';
    (window as ContentScriptWindow).reloadable_class = Env.runtime_id() + '_reloadable';
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
        $('.' + (window as ContentScriptWindow).reloadable_class).each((i, reloadable_element) => {
          $(reloadable_element).replaceWith($(reloadable_element)[0].outerHTML); // xss-reinsert - inserting code that was already present should not be dangerous
        });
        was_destroyed = true;
      })();
    };

    (window as ContentScriptWindow).vacant = () => {
      return !$('.' + (window as ContentScriptWindow).destroyable_class).length;
    };

    (window as ContentScriptWindow).TrySetDestroyableInterval = (code, ms) => {
      let id = Catch.set_interval(code, ms);
      (window as ContentScriptWindow).destroyable_intervals.push(id);
      return id;
    };

    (window as ContentScriptWindow).TrySetDestroyableTimeout = (code, ms) => {
      let id = Catch.set_timeout(code, ms);
      (window as ContentScriptWindow).destroyable_timeouts.push(id);
      return id;
    };

    document.dispatchEvent(new CustomEvent((window as ContentScriptWindow).destruction_event));
    document.addEventListener((window as ContentScriptWindow).destruction_event, (window as ContentScriptWindow).destroy);

    if ((window as ContentScriptWindow).vacant()) {
      await entrypoint();
    } else if (Env.browser().name === 'firefox') {
      notify_murdered();
    }

  }

};
