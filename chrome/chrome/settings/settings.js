/* Business Source License 1.0 © 2016-2017 FlowCrypt Limited. Use limitations apply. Contact human@flowcrypt.com */

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

function evaluate_password_strength(parent_selector, input_selector, button_selector) {
  parent_selector += ' ';
  let result = tool.crypto.password.estimate_strength(zxcvbn($(parent_selector + input_selector).val(), tool.crypto.password.weak_words()).guesses);
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