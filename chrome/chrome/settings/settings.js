/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

let settings_url_params = tool.env.url_params(['account_email', 'parent_tab_id', 'embedded']);
let settings_tab_id_global = undefined;
let ignore_email_aliases = ['nobody@google.com'];

tool.browser.message.tab_id(function (tab_id) {
  settings_tab_id_global = tab_id;
});

function fetch_account_aliases_from_gmail(account_email, callback, query, from_emails) {
  from_emails = from_emails || [];
  query = query || 'newer_than:1y in:sent -from:"calendar-notification@google.com" -from:"drive-shares-noreply@google.com"';
  tool.api.gmail.fetch_messages_based_on_query_and_extract_first_available_header(account_email, query, ['from'], function (headers) {
    if(headers && headers.from) {
      fetch_account_aliases_from_gmail(account_email, callback, query + ' -from:"' + tool.str.parse_email(headers.from).email + '"', from_emails.concat(tool.str.parse_email(headers.from).email));
    } else {
      callback(from_emails.filter(email => !tool.value(email).in(ignore_email_aliases)));
    }
  });
}

function evaluate_password_strength(pass_phrase) {
  return tool.crypto.password.estimate_strength(zxcvbn(pass_phrase, tool.crypto.password.weak_words()).guesses);
}

function render_password_strength(parent_selector, input_selector, button_selector) {
  parent_selector += ' ';
  let result = evaluate_password_strength($(parent_selector + input_selector).val());
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
  // $('.password_feedback > ul').html('');
  // tool.each(result.suggestions, function(i, suggestion) {
  //   $('.password_feedback > ul').append('<li>' + suggestion + '</li>');
  // });
}

function save_attest_request(account_email, attester, callback) {
  window.flowcrypt_storage.get(account_email, ['attests_requested', 'attests_processed'], storage => {
    if(typeof storage.attests_requested === 'undefined') {
      storage.attests_requested = [attester];
    } else if(!tool.value(attester).in(storage.attests_requested)) {
      storage.attests_requested.push(attester); // insert into requests if not already there
    }
    if(typeof storage.attests_processed === 'undefined') {
      storage.attests_processed = [];
    }
    window.flowcrypt_storage.set(account_email, storage, function () {
      tool.browser.message.send(null, 'attest_requested', {
        account_email: account_email,
      }, callback);
    });
  });
}

function mark_as_attested(account_email, attester, callback) {
  window.flowcrypt_storage.get(account_email, ['attests_requested', 'attests_processed'], storage => {
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
    window.flowcrypt_storage.set(account_email, storage, callback);
  });
}

function submit_pubkeys(addresses, pubkey, callback, _success) {
  if(addresses.length) {
    if(typeof _success === 'undefined') {
      _success = true;
    }
    let address = addresses.pop();
    let attest = (address === settings_url_params.account_email); // only request attestation of main email
    tool.api.attester.initial_legacy_submit(address, pubkey, attest).done((key_submitted, response) => {
      if(attest && key_submitted) {
        if(!response.attested) {
          save_attest_request(settings_url_params.account_email, 'CRYPTUP', function () {
            submit_pubkeys(addresses, pubkey, callback, _success && key_submitted && response.saved === true);
          });
        } else { //previously successfully attested, the attester claims
          mark_as_attested(settings_url_params.account_email, 'CRYPTUP', function () {
            submit_pubkeys(addresses, pubkey, callback, _success && key_submitted && response.saved === true);
          });
        }
      } else {
        submit_pubkeys(addresses, pubkey, callback, _success && key_submitted && response.saved === true);
      }
    });
  } else {
    callback(_success);
  }
}

function openpgp_key_encrypt(key, passphrase) {
  if(key.isPrivate() && passphrase) {
    let keys = key.getAllKeyPackets();
    tool.each(keys, function (i, key) {
      key.encrypt(passphrase);
    });
  } else if(!passphrase) {
    throw new Error("Encryption passphrase should not be empty");
  } else {
    throw new Error("Nothing to decrypt in a public key");
  }
}

function show_settings_page(page, add_url_text_or_params) {
  let page_params = { account_email: settings_url_params.account_email, placement: 'settings', parent_tab_id: settings_url_params.parent_tab_id || settings_tab_id_global };
  if(typeof add_url_text_or_params === 'object') { // it's a list of params - add them. It could also be a text - then it will be added the end of url below
    tool.each(add_url_text_or_params, function(k, v) {
      page_params[k] = v;
    });
    add_url_text_or_params = null;
  }
  let new_location = tool.env.url_create(page, page_params) + (add_url_text_or_params || '');
  if(settings_url_params.embedded) { //embedded on the main page
    tool.browser.message.send(settings_url_params.parent_tab_id, 'open_page', { page: page, add_url_text: add_url_text_or_params });
  } else if(!settings_url_params.parent_tab_id) { // on a main page
    let width, height, variant, close_on_click;
    if(page !== '/chrome/elements/compose.htm') {
      width = Math.min(800, $('body').width() - 200);
      height = $('html').height() - ($('html').height() > 800 ? 150 : 75);
      variant = null;
      close_on_click = 'background';
    } else {
      width = 542;
      height = Math.min(600, $('html').height() - 150);
      variant = 'new_message_featherlight';
      close_on_click = false;
    }
    $.featherlight({ closeOnClick: close_on_click, iframe: new_location, iframeWidth: width, iframeHeight: height, variant: variant, });
    $('.new_message_featherlight .featherlight-content').prepend('<div class="line">You can also send encrypted messages directly from Gmail.<br/><br/></div>');
  } else { // on a sub page/module page, inside a lightbox. Just change location.
    window.location = new_location;
  }
}

function reset_cryptup_account_storages(account_email, callback) {
  if(!account_email) {
    throw new Error('Missing account_email to reset');
  }
  window.flowcrypt_storage.account_emails_get(function (account_emails) {
    if(!tool.value(account_email).in(account_emails)) {
      throw new Error('"' + account_email + '" is not a known account_email in "' + JSON.stringify(account_emails) + '"');
    }
    let keys_to_remove = [];
    let filter = window.flowcrypt_storage.key(account_email, '');
    if(!filter) {
      throw new Error('Filter is empty for account_email"' + account_email + '"');
    }
    chrome.storage.local.get(storage => {
      tool.each(storage, function (key, value) {
        if(key.indexOf(filter) === 0) {
          keys_to_remove.push(key.replace(filter, ''));
        }
      });
      window.flowcrypt_storage.remove(account_email, keys_to_remove, function () {
        tool.each(localStorage, function (key, value) {
          if(key.indexOf(filter) === 0) {
            localStorage.removeItem(key);
          }
        });
        tool.each(sessionStorage, function (key, value) {
          if(key.indexOf(filter) === 0) {
            sessionStorage.removeItem(key);
          }
        });
        callback();
      });
    });
  });
}

function initialize_private_key_import_ui() {
  let attach_js = window.flowcrypt_attach.init(function() { return {count: 100, size: 1024 * 1024, size_mb: 1};});
  attach_js.initialize_attach_dialog('fineuploader', 'fineuploader_button');
  attach_js.set_attachment_added_callback(function (file) {
    let content = tool.str.from_uint8(file.content);
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
    if(this.value === 'file') {
      $('.source_paste_container').css('display', 'none');
      $('#fineuploader_button > input').click();
    } else if(this.value === 'paste') {
      $('.input_private_key').val('').prop('disabled', false);
      $('.source_paste_container').css('display', 'block');
    } else if(this.value === 'backup') {
      window.location = tool.env.url_create('../setup.htm', {account_email: url_params.account_email, parent_tab_id: url_params.parent_tab_id, action: 'add_key'})
    }
  });
}

function render_prv_compatibility_fix_ui(container, original_prv, passphrase, back_url, key_fixed_callback) {
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
    '  <select class="input_fix_expire_years">',
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
    '  <div class="button long gray action_fix_compatibility">UPDATE AND IMPORT KEY</div>',
    '</div>',
  ].join('\n'));
  container.find('select.input_fix_expire_years').change(function () {
    if($(this).val()) {
      container.find('.action_fix_compatibility').removeClass('gray').addClass('green');
    } else {
      container.find('.action_fix_compatibility').removeClass('green').addClass('gray');
    }
  });
  container.find('.action_fix_compatibility').click(function () {
    let expire_years = $(this).parents(container).find('select.input_fix_expire_years').val();
    if (!expire_years) {
      alert('Please select key expiration');
    } else {
      $(this).off().html(tool.ui.spinner('white'));
      let expire_seconds = (expire_years === 'never') ? 0 : Math.floor((Date.now() - original_prv.primaryKey.created.getTime()) / 1000) + (60 * 60 * 24 * 365 * Number(expire_years));
      original_prv.decrypt(passphrase);
      setTimeout(() => {
        openpgp.reformatKey({privateKey: original_prv, passphrase: passphrase, userIds: user_ids, keyExpirationTime: expire_seconds}).then(fixed_prv_result => {
          if (fixed_prv_result.key.getEncryptionKeyPacket() !== null) {
            key_fixed_callback(fixed_prv_result.key);
          } else {
            alert('Key update: Key still cannot be used for encryption. This looks like a compatibility issue.\n\nPlease write us at human@flowcrypt.com. We are VERY prompt to respond.');
            $(this).replaceWith(tool.e('a', {href: back_url, text: 'Go back and try something else'}));
          }
        });
      }, 50);
    }
  });
}