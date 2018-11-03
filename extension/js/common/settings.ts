/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store, KeyInfo } from './store.js';
import { Value, Str, Env, UnreportableError, Catch, UrlParams, JQS, Dict } from './common.js';
import { Xss, Ui } from './browser.js';
import { BrowserMsg } from './extension.js';

import { Lang } from './lang.js';
import { Rules } from './rules.js';
import { Api } from './api.js';
import { Pgp } from './pgp.js';

declare const openpgp: typeof OpenPGP;
declare const zxcvbn: Function; // tslint:disable-line:ban-types

export class Settings {

  private static is_embedded = Boolean(Env.urlParams(['embedded']).embedded);
  private static ignore_email_aliases = ['nobody@google.com'];

  static fetch_account_aliases_from_gmail = async (account_email: string) => {
    let query = 'newer_than:1y in:sent -from:"calendar-notification@google.com" -from:"drive-shares-noreply@google.com"';
    let results = [];
    while (true) {
      let headers = await Api.gmail.fetchMsgsBasedOnQueryAndExtractFirstAvailableHeader(account_email, query, ['from']);
      if (!headers.from) {
        return results.filter(email => !Value.is(email).in(Settings.ignore_email_aliases));
      }
      results.push(Str.parseEmail(headers.from).email);
      query += ' -from:"' + Str.parseEmail(headers.from).email + '"';
    }
  }

  static evaluate_password_strength = (pass_phrase: string) => {
    return Pgp.password.estimate_strength(zxcvbn(pass_phrase, Pgp.password.weak_words()).guesses);
  }

  static render_password_strength = (parent_selector: string, input_selector: string, button_selector: string) => {
    parent_selector += ' ';
    let password = $(parent_selector + input_selector).val();
    if (typeof password !== 'string') {
      Catch.report('render_password_strength: Selected password is not a string', typeof password);
      return;
    }
    let result = Settings.evaluate_password_strength(password);
    $(parent_selector + '.password_feedback').css('display', 'block');
    $(parent_selector + '.password_bar > div').css('width', result.word.bar + '%');
    $(parent_selector + '.password_bar > div').css('background-color', result.word.color);
    $(parent_selector + '.password_result, .password_time').css('color', result.word.color);
    $(parent_selector + '.password_result').text(result.word.word);
    $(parent_selector + '.password_time').text(result.time);
    if (result.word.pass) {
      $(parent_selector + button_selector).removeClass('gray');
      $(parent_selector + button_selector).addClass('green');
    } else {
      $(parent_selector + button_selector).removeClass('green');
      $(parent_selector + button_selector).addClass('gray');
    }
  }

  static save_attest_request = async (account_email: string, attester: string) => {
    let storage = await Store.getAccount(account_email, ['attests_requested', 'attests_processed']);
    if (typeof storage.attests_requested === 'undefined') {
      storage.attests_requested = [attester];
    } else if (!Value.is(attester).in(storage.attests_requested)) {
      storage.attests_requested.push(attester); // insert into requests if not already there
    }
    if (typeof storage.attests_processed === 'undefined') {
      storage.attests_processed = [];
    }
    await Store.set(account_email, storage);
    return await BrowserMsg.sendAwait(null, 'attest_requested', {account_email});
  }

  static mark_as_attested = async (account_email: string, attester: string) => {
    let storage = await Store.getAccount(account_email, ['attests_requested', 'attests_processed']);
    if (typeof storage.attests_requested === 'undefined') {
      storage.attests_requested = [];
    } else if (Value.is(attester).in(storage.attests_requested)) {
      storage.attests_requested.splice(storage.attests_requested.indexOf(attester), 1); // remove attester from requested
    }
    if (typeof storage.attests_processed === 'undefined') {
      storage.attests_processed = [attester];
    } else if (!Value.is(attester).in(storage.attests_processed)) {
      storage.attests_processed.push(attester); // add attester as processed if not already there
    }
    await Store.set(account_email, storage);
  }

  static submit_pubkeys = async (account_email: string, addresses: string[], pubkey: string) => {
    let attest_response = await Api.attester.initialLegacySubmit(account_email, pubkey, true);
    if (!attest_response.attested) {
      await Settings.save_attest_request(account_email, 'CRYPTUP');
    } else { // Attester claims it was previously successfully attested
      await Settings.mark_as_attested(account_email, 'CRYPTUP');
    }
    let aliases = addresses.filter(a => a !== account_email);
    if (aliases.length) {
      await Promise.all(aliases.map(a => Api.attester.initialLegacySubmit(a, pubkey, false)));
    }
  }

  static openpgp_key_encrypt = async (key: OpenPGP.key.Key, passphrase: string) => {
    if (!passphrase) {
      throw new Error("Encryption passphrase should not be empty");
    }
    await key.encrypt(passphrase);
  }

  private static prepare_new_settings_location_url = (account_email: string|null, parent_tab_id: string, page: string, add_url_text_or_params: string|UrlParams|null=null): string => {
    let page_params: UrlParams = {placement: 'settings', parent_tab_id};
    if (account_email) {
      page_params.account_email = account_email;
    }
    if (typeof add_url_text_or_params === 'object' && add_url_text_or_params) { // it's a list of params - add them. It could also be a text - then it will be added the end of url below
      for (let k of Object.keys(add_url_text_or_params)) {
        page_params[k] = add_url_text_or_params[k];
      }
      add_url_text_or_params = null;
    }
    return Env.urlCreate(page, page_params) + (add_url_text_or_params || '');
  }

  static renderSubPage = (account_email: string|null, tab_id: string, page: string, add_url_text_or_params:string|UrlParams|null=null) => {
    let new_location = Settings.prepare_new_settings_location_url(account_email, tab_id, page, add_url_text_or_params);
    let width, height, variant, close_on_click;
    if (page !== '/chrome/elements/compose.htm') {
      width = Math.min(800, $('body').width()! - 200);
      height = $('body').height()! - ($('body').height()! > 800 ? 150 : 75);
      variant = null;
      close_on_click = 'background';
    } else {
      width = 542;
      height = Math.min(600, $('body').height()! - 150);
      variant = 'new_message_featherlight';
      close_on_click = false;
    }
    ($ as JQS).featherlight({ closeOnClick: close_on_click, iframe: new_location, iframeWidth: width, iframeHeight: height, variant });
    Xss.sanitizePrepend('.new_message_featherlight .featherlight-content', '<div class="line">You can also send encrypted messages directly from Gmail.<br/><br/></div>');

  }

  static redirect_sub_page = (account_email: string, parent_tab_id: string, page: string, add_url_text_or_params:string|UrlParams|null=null) => {
    let new_location = Settings.prepare_new_settings_location_url(account_email, parent_tab_id, page, add_url_text_or_params);
    if (Settings.is_embedded) { // embedded on the main page
      BrowserMsg.send(parent_tab_id, 'open_page', { page, add_url_text: add_url_text_or_params });
    } else { // on a sub page/module page, inside a lightbox. Just change location.
      window.location.href = new_location;
    }
  }

  static refresh_account_aliases = async (account_email: string) => {
    let addresses = await Settings.fetch_account_aliases_from_gmail(account_email);
    let all = Value.arr.unique(addresses.concat(account_email));
    await Store.set(account_email, { addresses: all });
    return all;
  }

  static account_storage_reset = (account_email: string) => new Promise(async (resolve, reject) => {
    if (!account_email) {
      throw new Error('Missing account_email to reset');
    }
    let account_emails = await Store.accountEmailsGet();
    if (!Value.is(account_email).in(account_emails)) {
      throw new Error(`"${account_email}" is not a known account_email in "${JSON.stringify(account_emails)}"`);
    }
    let storage_indexes_to_remove: string[] = [];
    let filter = Store.index(account_email, '') as string;
    if (!filter) {
      throw new Error('Filter is empty for account_email"' + account_email + '"');
    }
    chrome.storage.local.get(async storage => {
      try {
        for (let storage_index of Object.keys(storage)) {
          if (storage_index.indexOf(filter) === 0) {
            storage_indexes_to_remove.push(storage_index.replace(filter, ''));
          }
        }
        await Store.remove(account_email, storage_indexes_to_remove);
        for (let local_storage_index of Object.keys(localStorage)) {
          if (local_storage_index.indexOf(filter) === 0) {
            localStorage.removeItem(local_storage_index);
          }
        }
        for (let session_storage_index of Object.keys(sessionStorage)) {
          if (session_storage_index.indexOf(filter) === 0) {
            sessionStorage.removeItem(session_storage_index);
          }
        }
        resolve();
      } catch(e) {
        reject(e);
      }
    });
  })

  static account_storage_change_email = (old_account_email: string, new_account_email: string) => new Promise(async (resolve, reject) => {
    if (!old_account_email || !new_account_email || !Str.isEmailValid(new_account_email)) {
      throw new Error('Missing or wrong account_email to reset');
    }
    let account_emails = await Store.accountEmailsGet();
    if (!Value.is(old_account_email).in(account_emails)) {
      throw new Error(`"${old_account_email}" is not a known account_email in "${JSON.stringify(account_emails)}"`);
    }
    let storage_indexes_to_change: string[] = [];
    let old_account_email_index_prefix = Store.index(old_account_email, '') as string;
    let new_account_email_index_prefix = Store.index(new_account_email, '') as string;
    // in case the destination email address was already set up with an account, recover keys and pass phrases before it's overwritten
    let dest_account_private_keys = await Store.keysGet(new_account_email);
    let dest_account_pass_phrases: Dict<string> = {};
    for(let ki of dest_account_private_keys) {
      let pp = await Store.passphrase_get(new_account_email, ki.longid, true);
      if(pp) {
        dest_account_pass_phrases[ki.longid] = pp;
      }
    }
    if (!old_account_email_index_prefix) {
      throw new Error(`Filter is empty for account_email "${old_account_email}"`);
    }
    await Store.account_emails_add(new_account_email);
    chrome.storage.local.get(async storage => {
      try {
        for (let key of Object.keys(storage)) {
          if (key.indexOf(old_account_email_index_prefix) === 0) {
            storage_indexes_to_change.push(key.replace(old_account_email_index_prefix, ''));
          }
        }
        let old_account_storage = await Store.getAccount(old_account_email, storage_indexes_to_change);
        await Store.set(new_account_email, old_account_storage);
        for (let local_storage_index of Object.keys(localStorage)) {
          if (local_storage_index.indexOf(old_account_email_index_prefix) === 0) {
            let v = localStorage.getItem(local_storage_index);
            localStorage.setItem(local_storage_index.replace(old_account_email_index_prefix, new_account_email_index_prefix), v!);
            localStorage.removeItem(local_storage_index);
          }
        }
        for (let session_storage_index of Object.keys(sessionStorage)) {
          if (session_storage_index.indexOf(old_account_email_index_prefix) === 0) {
            let v = sessionStorage.getItem(session_storage_index);
            sessionStorage.setItem(session_storage_index.replace(old_account_email_index_prefix, new_account_email_index_prefix), v!);
            sessionStorage.removeItem(session_storage_index);
          }
        }
        for(let ki of dest_account_private_keys) {
          await Store.keys_add(new_account_email, ki.private);
        }
        for(let longid of Object.keys(dest_account_pass_phrases)) {
          await Store.passphrase_save('local', new_account_email, longid, dest_account_pass_phrases[longid]);
        }
        await Settings.account_storage_reset(old_account_email);
        await Store.account_emails_remove(old_account_email);
        resolve();
      } catch(e) {
        reject(e);
      }
    });
  })

  static render_prv_compatibility_fix_ui_and_wait_until_submitted_by_user = (account_email: string, container: string|JQuery<HTMLElement>, orig_prv: OpenPGP.key.Key, passphrase: string, back_url: string): Promise<OpenPGP.key.Key> => {
    return new Promise((resolve, reject) => {
      let uids = orig_prv.users.map(u => u.userId).filter(u => u !== null && u.userid && Str.isEmailValid(Str.parseEmail(u.userid).email)).map(u => u!.userid) as string[];
      if (!uids.length) {
        uids.push(account_email);
      }
      container = $(container as JQuery<HTMLElement>); // due to JQuery TS quirk
      Xss.sanitizeRender(container, [
        '<div class="line">This key has minor usability issues that can be fixed. This commonly happens when importing keys from Symantec&trade; PGP Desktop or other legacy software. It may be missing User IDs, or it may be missing a self-signature. It is also possible that the key is simply expired.</div>',
        '<div class="line compatibility_fix_user_ids">' + uids.map(uid => '<div>' + Xss.htmlEscape(uid) + '</div>').join('') + '</div>',
        '<div class="line">',
        '  Choose expiration of updated key',
        '  <select class="input_fix_expire_years" data-test="input-compatibility-fix-expire-years">',
        '    <option  value="" disabled selected>please choose expiration</option>',
        '    <option value="never">no expiration</option>',
        '    <option value="1">1 year</option>',
        '    <option value="2">2 years</option>',
        '    <option value="3">3 years</option>',
        '    <option value="5">5 years</option>',
        '  </select>',
        '</div>',
        '<div class="line">FlowCrypt will attempt to update the key before importing.</div>',
        '<div class="line">',
        '  <div class="button long gray action_fix_compatibility" data-test="action-fix-and-import-key">UPDATE AND IMPORT KEY</div>',
        '</div>',
      ].join('\n'));
      container.find('select.input_fix_expire_years').change(Ui.event.handle(target => {
        if ($(target).val()) {
          (container as JQuery<HTMLElement>).find('.action_fix_compatibility').removeClass('gray').addClass('green');
        } else {
          (container as JQuery<HTMLElement>).find('.action_fix_compatibility').removeClass('green').addClass('gray');
        }
      }));
      container.find('.action_fix_compatibility').click(Ui.event.handle(async target => {
        let expire_years = $(target).parents(container as string).find('select.input_fix_expire_years').val() as string; // JQuery quirk
        if (!expire_years) {
          alert('Please select key expiration');
        } else {
          $(target).off();
          Xss.sanitizeRender(target, Ui.spinner('white'));
          let expire_seconds = (expire_years === 'never') ? 0 : Math.floor((Date.now() - orig_prv.primaryKey.created.getTime()) / 1000) + (60 * 60 * 24 * 365 * Number(expire_years));
          await Pgp.key.decrypt(orig_prv, [passphrase]);
          let reformatted;
          let userIds = uids.map(uid => Str.parseEmail(uid)).map(u => ({email: u.email, name: u.name || ''}));
          try {
            reformatted = await openpgp.reformatKey({privateKey: orig_prv, passphrase, userIds, keyExpirationTime: expire_seconds}) as {key: OpenPGP.key.Key};
          } catch (e) {
            reject(e);
            return;
          }
          if(reformatted.key.isDecrypted()) {
            await reformatted.key.encrypt(passphrase); // this is a security precaution, in case OpenPGP.js library changes in the future
          }
          if (await reformatted.key.getEncryptionKey()) {
            resolve(reformatted.key);
          } else {
            alert('Key update: Key still cannot be used for encryption. This looks like a compatibility issue.\n\nPlease write us at human@flowcrypt.com. We are VERY prompt to respond.');
            Xss.sanitizeReplace(target, Ui.e('a', {href: back_url, text: 'Go back and try something else'}));
          }
        }
      }));
    });
  }

  static abort_and_render_error_if_keyinfo_empty = (ki: KeyInfo|undefined, do_throw:boolean=true) => {
    if (!ki) {
      let msg = 'Cannot find primary key. Is FlowCrypt not set up yet?';
      Xss.sanitizeRender('#content', `${msg} ${Ui.retryLink()}`);
      if (do_throw) {
        throw new UnreportableError(msg);
      }
    }
  }

  static prompt_to_retry = async (type: 'REQUIRED', e: Error, user_msg: string, retry_callback: () => Promise<void>): Promise<void> => {
    // todo - his needs to be refactored, hard to follow, hard to use
    // |'OPTIONAL' - needs to be tested again
    if(!Api.err.isNetErr(e)) {
      Catch.handle_exception(e);
    }
    while(await Ui.renderOverlayPromptAwaitUserChoice({retry: {}}, user_msg) === 'retry') {
      try {
        return await retry_callback();
      } catch (e2) {
        if(!Api.err.isNetErr(e2)) {
          Catch.handle_exception(e2);
        }
      }
    }
    // pressing retry button causes to get stuck in while loop until success, at which point it returns, or until user closes tab
    // if it got down here, user has chosen 'skip'. This option is only available on 'OPTIONAL' type
    // if the error happens again, op will be skipped
    return await retry_callback();
  }

  static forbid_and_refresh_page_if_cannot = (action: 'CREATE_KEYS'|'BACKUP_KEYS', rules: Rules) => {
    if (action === 'CREATE_KEYS' && !rules.can_create_keys()) {
      alert(Lang.setup.creatingKeysNotAllowedPleaseImport);
      window.location.reload();
      throw Error('creating_keys_not_allowed_please_import');
    } else if (action === 'BACKUP_KEYS' && !rules.can_backup_keys()) {
      alert(Lang.setup.keyBackupsNotAllowed);
      window.location.reload();
      throw Error('key_backups_not_allowed');
    }
  }

  static new_google_account_authentication_prompt = async (tab_id: string, account_email?: string, omit_read_scope=false) => {
    let response = await Api.google.authPopup(account_email || null, tab_id, omit_read_scope);
    if (response && response.success === true && response.acctEmail) {
      await Store.account_emails_add(response.acctEmail);
      let storage = await Store.getAccount(response.acctEmail, ['setup_done']);
      if (storage.setup_done) { // this was just an additional permission
        alert('You\'re all set.');
        window.location.href = Env.urlCreate('/chrome/settings/index.htm', { account_email: response.acctEmail });
      } else {
        await Store.set(response.acctEmail, {email_provider: 'gmail'});
        window.location.href = Env.urlCreate('/chrome/settings/setup.htm', { account_email: response.acctEmail });
      }
    } else if (response && response.success === false && ((response.result === 'Denied' && response.error === 'access_denied') || response.result === 'Closed')) {
      Settings.renderSubPage(account_email || null, tab_id, '/chrome/settings/modules/auth_denied.htm');
    } else {
      Catch.log('failed to log into google', response);
      alert('Failed to connect to Gmail. Please try again. If this happens repeatedly, please write us at human@flowcrypt.com to fix it.');
      window.location.reload();
    }
  }

  static update_profile_picture_if_missing = async (account_email: string) => {
    let storage = await Store.getAccount(account_email, ['setup_done', 'picture']);
    if(storage.setup_done && !storage.picture) {
      try {
        let {image} = await Api.google.plus.peopleMe(account_email);
        await Store.set(account_email, {picture: image.url});
      } catch(e) {
        if(!Api.err.isAuthPopupNeeded(e) && !Api.err.isAuthErr(e) && !Api.err.isNetErr(e)) {
          Catch.handle_exception(e);
        }
      }
    }
  }

}
