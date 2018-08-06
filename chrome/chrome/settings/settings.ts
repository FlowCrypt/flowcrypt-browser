/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

class Settings {

  private static is_embedded = Boolean(tool.env.url_params(['embedded']).embedded);
  private static ignore_email_aliases = ['nobody@google.com'];

  static fetch_account_aliases_from_gmail = async (account_email: string) => {
    let query = 'newer_than:1y in:sent -from:"calendar-notification@google.com" -from:"drive-shares-noreply@google.com"';
    let results = [];
    while (true) {
      let headers = await tool.api.gmail.fetch_messages_based_on_query_and_extract_first_available_header(account_email, query, ['from']);
      if (!headers.from) {
        return results.filter(email => !tool.value(email).in(Settings.ignore_email_aliases));
      }
      results.push(tool.str.parse_email(headers.from).email);
      query += ' -from:"' + tool.str.parse_email(headers.from).email + '"';
    }
  }

  static evaluate_password_strength = (pass_phrase: string) => {
    return tool.crypto.password.estimate_strength(zxcvbn(pass_phrase, tool.crypto.password.weak_words()).guesses);
  }

  static render_password_strength = (parent_selector: string, input_selector: string, button_selector: string) => {
    parent_selector += ' ';
    let password = $(parent_selector + input_selector).val();
    if (typeof password !== 'string') {
      tool.catch.report('render_password_strength: Selected password is not a string', typeof password);
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
    let storage = await Store.get_account(account_email, ['attests_requested', 'attests_processed']);
    if (typeof storage.attests_requested === 'undefined') {
      storage.attests_requested = [attester];
    } else if (!tool.value(attester).in(storage.attests_requested)) {
      storage.attests_requested.push(attester); // insert into requests if not already there
    }
    if (typeof storage.attests_processed === 'undefined') {
      storage.attests_processed = [];
    }
    await Store.set(account_email, storage);
    return await tool.browser.message.send(null, 'attest_requested', {account_email});
  }

  static mark_as_attested = async (account_email: string, attester: string) => {
    let storage = await Store.get_account(account_email, ['attests_requested', 'attests_processed']);
    if (typeof storage.attests_requested === 'undefined') {
      storage.attests_requested = [];
    } else if (tool.value(attester).in(storage.attests_requested)) {
      storage.attests_requested.splice(storage.attests_requested.indexOf(attester), 1); // remove attester from requested
    }
    if (typeof storage.attests_processed === 'undefined') {
      storage.attests_processed = [attester];
    } else if (!tool.value(attester).in(storage.attests_processed)) {
      storage.attests_processed.push(attester); // add attester as processed if not already there
    }
    await Store.set(account_email, storage);
  }

  static submit_pubkeys = async (account_email: string, addresses: string[], pubkey: string) => {
    let attest_response = await tool.api.attester.initial_legacy_submit(account_email, pubkey, true);
    if (!attest_response.attested) {
      await Settings.save_attest_request(account_email, 'CRYPTUP');
    } else { // Attester claims it was previously successfully attested
      await Settings.mark_as_attested(account_email, 'CRYPTUP');
    }
    let aliases = addresses.filter(a => a !== account_email);
    if (aliases.length) {
      await Promise.all(aliases.map(a => tool.api.attester.initial_legacy_submit(a, pubkey, false)));
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
    return tool.env.url_create(page, page_params) + (add_url_text_or_params || '');
  }

  static render_sub_page = (account_email: string|null, tab_id: string, page: string, add_url_text_or_params:string|UrlParams|null=null) => {
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
    $.featherlight({ closeOnClick: close_on_click, iframe: new_location, iframeWidth: width, iframeHeight: height, variant });
    $('.new_message_featherlight .featherlight-content').prepend('<div class="line">You can also send encrypted messages directly from Gmail.<br/><br/></div>');

  }

  static redirect_sub_page = (account_email: string, parent_tab_id: string, page: string, add_url_text_or_params:string|UrlParams|null=null) => {
    let new_location = Settings.prepare_new_settings_location_url(account_email, parent_tab_id, page, add_url_text_or_params);
    if (Settings.is_embedded) { // embedded on the main page
      tool.browser.message.send(parent_tab_id, 'open_page', { page, add_url_text: add_url_text_or_params });
    } else { // on a sub page/module page, inside a lightbox. Just change location.
      window.location.href = new_location;
    }
  }

  static reset_cryptup_account_storages = (account_email: string) => new Promise(async resolve => {
    if (!account_email) {
      throw new Error('Missing account_email to reset');
    }
    let account_emails = await Store.account_emails_get();
    if (!tool.value(account_email).in(account_emails)) {
      throw new Error('"' + account_email + '" is not a known account_email in "' + JSON.stringify(account_emails) + '"');
    }
    let keys_to_remove: string[] = [];
    let filter = Store.index(account_email, '') as string;
    if (!filter) {
      throw new Error('Filter is empty for account_email"' + account_email + '"');
    }
    chrome.storage.local.get(async storage => {
      for (let key of Object.keys(storage)) {
        if (key.indexOf(filter) === 0) {
          keys_to_remove.push(key.replace(filter, ''));
        }
      }
      await Store.remove(account_email, keys_to_remove);
      for (let key of Object.keys(localStorage)) {
        if (key.indexOf(filter) === 0) {
          localStorage.removeItem(key);
        }
      }
      for (let key of Object.keys(sessionStorage)) {
        if (key.indexOf(filter) === 0) {
          sessionStorage.removeItem(key);
        }
      }
      resolve();
    });
  })

  static initialize_private_key_import_ui = (account_email: string, parent_tab_id: string|null) => {
    let attach = new Attach(() => ({count: 100, size: 1024 * 1024, size_mb: 1}));
    attach.initialize_attach_dialog('fineuploader', 'fineuploader_button');
    attach.set_attachment_added_callback((file: Attachment) => {
      let content = tool.str.from_uint8(file.content as Uint8Array);
      let k;
      if (tool.value(tool.crypto.armor.headers('private_key').begin).in(content)) {
        let first_prv = tool.crypto.armor.detect_blocks(content).blocks.filter(b => b.type === 'private_key')[0];
        if (first_prv) {
          k = openpgp.key.readArmored(first_prv.content).keys[0];  // filter out all content except for the first encountered private key (GPGKeychain compatibility)
        }
      } else {
        k = openpgp.key.read(file.content as Uint8Array).keys[0];
      }
      if (typeof k !== 'undefined') {
        $('.input_private_key').val(k.armor()).prop('disabled', true);
        $('.source_paste_container').css('display', 'block');
      } else {
        alert('Not able to read this key. Is it a valid PGP private key?');
        $('input[type=radio][name=source]').removeAttr('checked');
      }
    });

    $('input[type=radio][name=source]').change(function() {
      if ((this as HTMLInputElement).value === 'file') {
        $('.source_paste_container').css('display', 'none');
        $('#fineuploader_button > input').click();
      } else if ((this as HTMLInputElement).value === 'paste') {
        $('.input_private_key').val('').prop('disabled', false);
        $('.source_paste_container').css('display', 'block');
      } else if ((this as HTMLInputElement).value === 'backup') {
        window.location.href = tool.env.url_create('../setup.htm', {account_email, parent_tab_id, action: 'add_key'});
      }
    });
  }

  static render_prv_compatibility_fix_ui_and_wait_until_submitted_by_user = (account_email: string, container: string|JQuery<HTMLElement>, original_prv: OpenPGP.key.Key, passphrase: string, back_url: string): Promise<OpenPGP.key.Key> => {
    return new Promise((resolve, reject) => {
      let userIds = original_prv.users.map(u => u.userId).filter(u => u !== null).map(u => u!.userid) as string[];
      if (!userIds.length) {
        userIds.push(account_email);
      }
      container = $(container);
      container.html([
        '<div class="line">This key has minor usability issues that can be fixed. This commonly happens when importing keys from Symantec&trade; PGP Desktop or other legacy software. It may be missing User IDs, or it may be missing a self-signature. It is also possible that the key is simply expired.</div>',
        '<div class="line compatibility_fix_user_ids">' + userIds.map(uid => '<div>' + tool.str.html_escape(uid) + '</div>').join('') + '</div>',
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
      container.find('select.input_fix_expire_years').change(function() {
        if ($(this).val()) {
          (container as JQuery<HTMLElement>).find('.action_fix_compatibility').removeClass('gray').addClass('green');
        } else {
          (container as JQuery<HTMLElement>).find('.action_fix_compatibility').removeClass('green').addClass('gray');
        }
      });
      container.find('.action_fix_compatibility').click(async function() {
        // @ts-ignore - TS doesn't like $.parents($(blah)). jQuery doesn't seem to mind - investigate
        let expire_years = $(this).parents(container).find('select.input_fix_expire_years').val() as string;
        if (!expire_years) {
          alert('Please select key expiration');
        } else {
          $(this).off().html(tool.ui.spinner('white'));
          let expire_seconds = (expire_years === 'never') ? 0 : Math.floor((Date.now() - original_prv.primaryKey.created.getTime()) / 1000) + (60 * 60 * 24 * 365 * Number(expire_years));
          await tool.crypto.key.decrypt(original_prv, [passphrase]);
          let reformatted;
          try {
            reformatted = await openpgp.reformatKey({privateKey: original_prv, passphrase, userIds, keyExpirationTime: expire_seconds}) as {key: OpenPGP.key.Key};
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
            $(this).replaceWith(tool.e('a', {href: back_url, text: 'Go back and try something else'}));
          }
        }
      });
    });
  }

  static abort_and_render_error_if_keyinfo_empty = (ki: KeyInfo|undefined, do_throw:boolean=true) => {
    if (!ki) {
      let msg = 'Cannot find primary key. Is FlowCrypt not set up yet?';
      $('#content').html(`${msg} <a href="${window.location.href}">Retry</a>`);
      if (do_throw) {
        throw new UnreportableError(msg);
      }
    }
  }

  static prompt_to_retry = async (type: 'REQUIRED', e: Error, user_message: string, retry_callback: () => Promise<void>): Promise<void> => {
    // todo - his needs to be refactored, hard to follow, hard to use
    // |'OPTIONAL' - needs to be tested again
    if(!tool.api.error.is_network_error(e)) {
      tool.catch.handle_exception(e);
    }
    while(await tool.ui.render_overlay_prompt_await_user_choice({retry: {}}, user_message) === 'retry') {
      try {
        return await retry_callback();
      } catch (e2) {
        if(!tool.api.error.is_network_error(e2)) {
          tool.catch.handle_exception(e2);
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
      alert(Lang.setup.creating_keys_not_allowed_please_import);
      window.location.reload();
      throw Error('creating_keys_not_allowed_please_import');
    } else if (action === 'BACKUP_KEYS' && !rules.can_backup_keys()) {
      alert(Lang.setup.key_backups_not_allowed);
      window.location.reload();
      throw Error('key_backups_not_allowed');
    }
  }

}
