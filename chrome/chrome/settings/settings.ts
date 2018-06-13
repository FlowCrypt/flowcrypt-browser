/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

/// <reference path="../../../node_modules/@types/chrome/index.d.ts" />
/// <reference path="../../../node_modules/@types/openpgp/index.d.ts" />
/// <reference path="common.d.ts" />

declare let zxcvbn: Function;

let settings_url_params = tool.env.url_params(['account_email', 'parent_tab_id', 'embedded']);
let settings_tab_id_global:string|undefined = undefined;
let ignore_email_aliases = ['nobody@google.com'];

tool.browser.message.tab_id(function (tab_id) {
  settings_tab_id_global = tab_id;
});

async function fetch_account_aliases_from_gmail(account_email: string) {
  let query = 'newer_than:1y in:sent -from:"calendar-notification@google.com" -from:"drive-shares-noreply@google.com"';
  let results = [];
  while(true) {
    let headers = await tool.api.gmail.fetch_messages_based_on_query_and_extract_first_available_header(account_email, query, ['from']);
    if(!headers.from) {
      return results.filter(email => !tool.value(email).in(ignore_email_aliases));
    }
    results.push(tool.str.parse_email(headers.from).email);
    query += ' -from:"' + tool.str.parse_email(headers.from).email + '"';
  }
}

function evaluate_password_strength(pass_phrase: string) {
  return tool.crypto.password.estimate_strength(zxcvbn(pass_phrase, tool.crypto.password.weak_words()).guesses);
}

function render_password_strength(parent_selector: string, input_selector: string, button_selector: string) {
  parent_selector += ' ';
  let password = $(parent_selector + input_selector).val();
  if(typeof password !== 'string') {
    tool.catch.report('render_password_strength: Selected password is not a string', typeof password);
    return;
  }
  let result = evaluate_password_strength(password);
  $(parent_selector + '.password_feedback').css('display', 'block');
  $(parent_selector + '.password_bar > div').css('width', result.bar + '%');
  $(parent_selector + '.password_bar > div').css('background-color', result.color);
  $(parent_selector + '.password_result, .password_time').css('color', result.color);
  $(parent_selector + '.password_result').text(result.word);
  $(parent_selector + '.password_time').text(result.time);
  if(result.pass) {
    $(parent_selector + button_selector).removeClass('gray');
    $(parent_selector + button_selector).addClass('green');
  } else {
    $(parent_selector + button_selector).removeClass('green');
    $(parent_selector + button_selector).addClass('gray');
  }
}

async function save_attest_request(account_email: string, attester: string) {
  let storage = await Store.get_account(account_email, ['attests_requested', 'attests_processed']);
  if(typeof storage.attests_requested === 'undefined') {
    storage.attests_requested = [attester];
  } else if(!tool.value(attester).in(storage.attests_requested)) {
    storage.attests_requested.push(attester); // insert into requests if not already there
  }
  if(typeof storage.attests_processed === 'undefined') {
    storage.attests_processed = [];
  }
  await Store.set(account_email, storage);
  return await new Promise(resolve => tool.browser.message.send(null, 'attest_requested', {account_email: account_email}, resolve));
}

async function mark_as_attested(account_email: string, attester: string) {
  let storage = await Store.get_account(account_email, ['attests_requested', 'attests_processed']);
  if(typeof storage.attests_requested === 'undefined') {
    storage.attests_requested = [];
  } else if(tool.value(attester).in(storage.attests_requested)) {
    storage.attests_requested.splice(storage.attests_requested.indexOf(attester), 1); //remove attester from requested
  }
  if(typeof storage.attests_processed === 'undefined') {
    storage.attests_processed = [attester];
  } else if(!tool.value(attester).in(storage.attests_processed)) {
    storage.attests_processed.push(attester); //add attester as processed if not already there
  }
  await Store.set(account_email, storage);
}

async function submit_pubkeys(addresses: string[], pubkey: string) {
  if(typeof settings_url_params.account_email !== 'string') {
    tool.catch.report('settings.js:submit_pubkeys:!settings_url_params.account_email');
    return;
  }
  let main_email = settings_url_params.account_email as string;
  let attest_response = await tool.api.attester.initial_legacy_submit(main_email, pubkey, true);
  if(!attest_response.attested) {
    await save_attest_request(settings_url_params.account_email as string, 'CRYPTUP');
  } else { // Attester claims it was previously successfully attested
    await mark_as_attested(settings_url_params.account_email as string, 'CRYPTUP');
  }
  let aliases = addresses.filter(a => a !== main_email);
  if(aliases.length) {
    await Promise.all(aliases.map(a => tool.api.attester.initial_legacy_submit(a, pubkey, false)));
  }
}

function openpgp_key_encrypt(key: OpenpgpKey, passphrase: string) {
  if(key.isPrivate() && passphrase) {
    let keys = key.getAllKeyPackets();
    for(let key of keys) {
      key.encrypt(passphrase);
    }
  } else if(!passphrase) {
    throw new Error("Encryption passphrase should not be empty");
  } else {
    throw new Error("Nothing to decrypt in a public key");
  }
}

function show_settings_page(page: string, add_url_text_or_params?: string|UrlParams|null) {
  let page_params: UrlParams = {
    account_email: settings_url_params.account_email,
    placement: 'settings',
    parent_tab_id: settings_url_params.parent_tab_id || settings_tab_id_global,
  };
  if(typeof add_url_text_or_params === 'object' && add_url_text_or_params) { // it's a list of params - add them. It could also be a text - then it will be added the end of url below
    for(let k of Object.keys(add_url_text_or_params)) {
      page_params[k] = add_url_text_or_params[k];
    }
    add_url_text_or_params = null;
  }
  let new_location = tool.env.url_create(page, page_params) + (add_url_text_or_params || '');
  if(settings_url_params.embedded) { //embedded on the main page
    tool.browser.message.send(settings_url_params.parent_tab_id as string, 'open_page', { page: page, add_url_text: add_url_text_or_params });
  } else if(!settings_url_params.parent_tab_id) { // on a main page
    let width, height, variant, close_on_click;
    if(page !== '/chrome/elements/compose.htm') {
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
    $.featherlight({ closeOnClick: close_on_click, iframe: new_location, iframeWidth: width, iframeHeight: height, variant: variant, });
    $('.new_message_featherlight .featherlight-content').prepend('<div class="line">You can also send encrypted messages directly from Gmail.<br/><br/></div>');
  } else { // on a sub page/module page, inside a lightbox. Just change location.
    window.location.href = new_location;
  }
}

function reset_cryptup_account_storages(account_email: string, callback: Callback) {
  if(!account_email) {
    throw new Error('Missing account_email to reset');
  }
  Store.account_emails_get().then((account_emails) => {
    if(!tool.value(account_email).in(account_emails)) {
      throw new Error('"' + account_email + '" is not a known account_email in "' + JSON.stringify(account_emails) + '"');
    }
    let keys_to_remove: string[] = [];
    let filter = Store.index(account_email, '') as string;
    if(!filter) {
      throw new Error('Filter is empty for account_email"' + account_email + '"');
    }
    chrome.storage.local.get(storage => {
      for(let key of Object.keys(storage)) {
        if(key.indexOf(filter) === 0) {
          keys_to_remove.push(key.replace(filter, ''));
        }
      }
      Store.remove(account_email, keys_to_remove).then(function () {
        for(let key of Object.keys(localStorage)) {
          if(key.indexOf(filter) === 0) {
            localStorage.removeItem(key);
          }
        }
        for(let key of Object.keys(sessionStorage)) {
          if(key.indexOf(filter) === 0) {
            sessionStorage.removeItem(key);
          }
        }
        callback();
      });
    });
  });
}

function initialize_private_key_import_ui() {
  let attach = new Attach(() => ({count: 100, size: 1024 * 1024, size_mb: 1}));
  attach.initialize_attach_dialog('fineuploader', 'fineuploader_button');
  attach.set_attachment_added_callback((file: Attachment) => {
    let content = tool.str.from_uint8(file.content as Uint8Array);
    let k;
    if(tool.value(tool.crypto.armor.headers('private_key').begin).in(content)) {
      let first_prv = tool.crypto.armor.detect_blocks(content).filter(b => b.type === 'private_key')[0];
      if(first_prv) {
        k = openpgp.key.readArmored(first_prv.content).keys[0];  // filter out all content except for the first encountered private key (GPGKeychain compatibility)
      }
    } else {
      k = openpgp.key.read(file.content).keys[0];
    }
    if(typeof k !== 'undefined') {
      $('.input_private_key').val(k.armor()).prop('disabled', true);
      $('.source_paste_container').css('display', 'block');
    } else {
      alert('Not able to read this key. Is it a valid PGP private key?');
      $('input[type=radio][name=source]').removeAttr('checked');
    }
  });

  $('input[type=radio][name=source]').change(function() {
    if((this as HTMLInputElement).value === 'file') {
      $('.source_paste_container').css('display', 'none');
      $('#fineuploader_button > input').click();
    } else if((this as HTMLInputElement).value === 'paste') {
      $('.input_private_key').val('').prop('disabled', false);
      $('.source_paste_container').css('display', 'block');
    } else if((this as HTMLInputElement).value === 'backup') {
      window.location.href = tool.env.url_create('../setup.htm', {account_email: settings_url_params.account_email, parent_tab_id: settings_url_params.parent_tab_id, action: 'add_key'})
    }
  });
}

function render_prv_compatibility_fix_ui_and_wait_until_submitted_by_user(container: string|JQuery<HTMLElement>, original_prv: OpenpgpKey, passphrase: string, back_url: string): Promise<OpenpgpKey> {
  return new Promise((resolve, reject) => {
    let user_ids = original_prv.users.map(u => u.userId.userid);
    if (!user_ids.length) {
      user_ids.push(settings_url_params.account_email);
    }
    container = $(container);
    container.html([
      '<div class="line">This key has minor usability issues that can be fixed. This commonly happens when importing keys from Symantec&trade; PGP Desktop or other legacy software. It may be missing User IDs, or it may be missing a self-signature. It is also possible that the key is simply expired.</div>',
      '<div class="line compatibility_fix_user_ids">' + user_ids.map(uid => '<div>' + tool.str.html_escape(uid) + '</div>').join('') + '</div>',
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
    container.find('select.input_fix_expire_years').change(function () {
      if($(this).val()) {
        (container as JQuery<HTMLElement>).find('.action_fix_compatibility').removeClass('gray').addClass('green');
      } else {
        (container as JQuery<HTMLElement>).find('.action_fix_compatibility').removeClass('green').addClass('gray');
      }
    });
    container.find('.action_fix_compatibility').click(async function () {
      // @ts-ignore - TS doesn't like $.parents($(blah)). jQuery doesn't seem to mind - investigate
      let expire_years = $(this).parents(container).find('select.input_fix_expire_years').val() as string;
      if (!expire_years) {
        alert('Please select key expiration');
      } else {
        $(this).off().html(tool.ui.spinner('white'));
        let expire_seconds = (expire_years === 'never') ? 0 : Math.floor((Date.now() - original_prv.primaryKey.created.getTime()) / 1000) + (60 * 60 * 24 * 365 * Number(expire_years));
        original_prv.decrypt(passphrase);
        let reformatted;
        try {
          reformatted = await openpgp.reformatKey({privateKey: original_prv, passphrase: passphrase, userIds: user_ids, keyExpirationTime: expire_seconds}) as {key: OpenpgpKey};
        } catch(e) {
          reject(e);
          return;
        }
        if (reformatted.key.getEncryptionKeyPacket() !== null) {
          resolve(reformatted.key);
        } else {
          alert('Key update: Key still cannot be used for encryption. This looks like a compatibility issue.\n\nPlease write us at human@flowcrypt.com. We are VERY prompt to respond.');
          $(this).replaceWith(tool.e('a', {href: back_url, text: 'Go back and try something else'}));
        }
      }
    });  
  });
}

function abort_and_render_error_if_keyinfo_empty(ki: KeyInfo|undefined) {
  if(!ki) {
    let msg = 'Cannot find primary key. Is FlowCrypt not set up yet?';
    $('#content').html(`${msg} <a href="${window.location.href}">Retry</a>`);
    throw new UnreportableError(msg);
  }
}

async function prompt_to_retry(type: 'REQUIRED'|'OPTIONAL', e: Error, user_message: string, retry_callback: (skip_error?: string) => Promise<void>): Promise<void> {
  tool.catch.handle_exception(e);
  while(await __render_retry_prompt_and_resolve_true_when_user_wants_to_retry(type, user_message)) {
    try {
      return await retry_callback();
    } catch(e2) {
      tool.catch.handle_exception(e2);
    }
  }
  // pressing retry button causes to get stuck in while loop until success, at which point it returns, or until user closes tab
  // if it got down here, user has chosen 'skip'. This option is only available on 'OPTIONAL' type
  // if the error happens again, op will be skipped
  return await retry_callback(String(e));
}

function __render_retry_prompt_and_resolve_true_when_user_wants_to_retry(type: 'REQUIRED'|'OPTIONAL', user_message: string): Promise<boolean> {
  return new Promise(resolve => {
    let skip_button = (type === 'OPTIONAL') ? ' &nbsp; &nbsp; <div class="button gray action_skip_retry">skip</div>' : '';
    $('body').append(`
      <div class="featherlight white retry_prompt" style="display: block;">
        <div class="featherlight-content" data-test="dialog">
          <div class="line">${user_message.replace(/\n/g, '<br>')}</div>
          <div class="line">
            <div class="button green action_do_retry">retry</div>
            ${skip_button}
          </div>
          <div class="line">&nbsp;</div>
          <div class="line">Please email human@flowcrypt.com if you need assistance.</div>
        </div>
      </div>
    `);
    let overlay = $('.retry_prompt');
    overlay.find('.action_do_retry').one('click', () => {
      overlay.remove();
      resolve(true);
    });
    overlay.find('.action_skip_retry').one('click', () => {
      overlay.remove();
      resolve(false);
    });  
  });
}