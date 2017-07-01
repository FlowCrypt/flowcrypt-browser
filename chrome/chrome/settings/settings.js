/* Business Source License 1.0 © 2016 FlowCrypt Limited (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/CryptUp/cryptup-browser/tree/master/src/LICENCE */

'use strict';

var settings_url_params = tool.env.url_params(['account_email', 'parent_tab_id', 'embedded']);
var settings_tab_id_global = undefined;

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
      callback(from_emails);
    }
  });
}

function evaluate_password_strength(parent_selector, input_selector, button_selector) {
  parent_selector += ' ';
  var result = crack_time_result(zxcvbn($(parent_selector + input_selector).val()), [
    'crypt', 'up', 'cryptup', 'encryption', 'pgp', 'email', 'set', 'backup', 'passphrase', 'best', 'pass', 'phrases', 'are', 'long', 'and', 'have', 'several',
    'words', 'in', 'them', 'Best pass phrases are long', 'have several words', 'in them', 'bestpassphrasesarelong', 'haveseveralwords', 'inthem',
    'Loss of this pass phrase', 'cannot be recovered', 'Note it down', 'on a paper', 'lossofthispassphrase', 'cannotberecovered', 'noteitdown', 'onapaper',
    'setpassword', 'set password', 'set pass word', 'setpassphrase', 'set pass phrase', 'set passphrase'
  ]);
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
  account_storage_get(account_email, ['attests_requested', 'attests_processed'], function (storage) {
    if(typeof storage.attests_requested === 'undefined') {
      storage.attests_requested = [attester];
    } else if(!tool.value(attester).in(storage.attests_requested)) {
      storage.attests_requested.push(attester); // insert into requests if not already there
    }
    if(typeof storage.attests_processed === 'undefined') {
      storage.attests_processed = [];
    }
    account_storage_set(account_email, storage, function () {
      tool.browser.message.send(null, 'attest_requested', {
        account_email: account_email,
      }, callback);
    });
  });
}

function mark_as_attested(account_email, attester, callback) {
  account_storage_get(account_email, ['attests_requested', 'attests_processed'], function (storage) {
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
    account_storage_set(account_email, storage, callback);
  });
}

function submit_pubkeys(addresses, pubkey, callback, success) {
  if(addresses.length) {
    if(typeof success === 'undefined') {
      success = true;
    }
    var address = addresses.pop();
    var attest = (address === settings_url_params.account_email); // only request attestation of main email
    tool.api.attester.initial_legacy_submit(address, pubkey, attest).done((key_submitted, response) => {
      if(attest && key_submitted) {
        if(!response.attested) {
          save_attest_request(settings_url_params.account_email, 'CRYPTUP', function () {
            submit_pubkeys(addresses, pubkey, callback, success && key_submitted && response.saved === true);
          });
        } else { //previously successfully attested, the attester claims
          mark_as_attested(settings_url_params.account_email, 'CRYPTUP', function () {
            submit_pubkeys(addresses, pubkey, callback, success && key_submitted && response.saved === true);
          });
        }
      } else {
        submit_pubkeys(addresses, pubkey, callback, success && key_submitted && response.saved === true);
      }
    });
  } else {
    callback(success);
  }
}

function readable_crack_time(total_seconds) { // http://stackoverflow.com/questions/8211744/convert-time-interval-given-in-seconds-into-more-human-readable-form
  function numberEnding(number) {
    return(number > 1) ? 's' : '';
  }
  total_seconds = Math.round(total_seconds);
  var millennia = Math.round(total_seconds / (86400 * 30 * 12 * 100 * 1000));
  if(millennia) {
    return millennia === 1 ? 'a millennium' : 'millennia';
  }
  var centuries = Math.round(total_seconds / (86400 * 30 * 12 * 100));
  if(centuries) {
    return centuries === 1 ? 'a century' : 'centuries';
  }
  var years = Math.round(total_seconds / (86400 * 30 * 12));
  if(years) {
    return years + ' year' + numberEnding(years);
  }
  var months = Math.round(total_seconds / (86400 * 30));
  if(months) {
    return months + ' month' + numberEnding(months);
  }
  var days = Math.round(total_seconds / 86400);
  if(days) {
    return days + ' day' + numberEnding(days);
  }
  var hours = Math.round(total_seconds / 3600);
  if(hours) {
    return hours + ' hour' + numberEnding(hours);
  }
  var minutes = Math.round(total_seconds / 60);
  if(minutes) {
    return minutes + ' minute' + numberEnding(minutes);
  }
  var seconds = total_seconds % 60;
  if(seconds) {
    return seconds + ' second' + numberEnding(seconds);
  }
  return 'less than a second';
}

// https://threatpost.com/how-much-does-botnet-cost-022813/77573/
// https://www.abuse.ch/?p=3294
var guesses_per_second = 10000 * 2 * 4000; //(10k ips) * (2 cores p/machine) * (4k guesses p/core)
var crack_time_words = [
  ['millenni', 'perfect', 100, 'green', true],
  ['centu', 'great', 80, 'green', true],
  ['year', 'good', 60, 'orange', true],
  ['month', 'reasonable', 40, 'darkorange', true],
  ['day', 'poor', 20, 'darkred', false],
  ['', 'weak', 10, 'red', false],
]; // word search, word rating, bar percent, color, pass

function crack_time_result(zxcvbn_result) {
  var time_to_crack = zxcvbn_result.guesses / guesses_per_second;
  for(var i = 0; i < crack_time_words.length; i++) {
    var readable_time = readable_crack_time(time_to_crack);
    if(tool.value(crack_time_words[i][0]).in(readable_time)) {
      return {
        word: crack_time_words[i][1],
        bar: crack_time_words[i][2],
        time: readable_time,
        seconds: Math.round(time_to_crack),
        pass: crack_time_words[i][4],
        color: crack_time_words[i][3],
        suggestions: zxcvbn_result.feedback.suggestions,
      };
    }
  }
}

function openpgp_key_encrypt(key, passphrase) {
  if(key.isPrivate() && passphrase) {
    var keys = key.getAllKeyPackets();
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
  var page_params = { account_email: settings_url_params.account_email, placement: 'settings', parent_tab_id: settings_url_params.parent_tab_id || settings_tab_id_global };
  if(typeof add_url_text_or_params === 'object') { // it's a list of params - add them. It could also be a text - then it will be added the end of url below
    tool.each(add_url_text_or_params, function(k, v) {
      page_params[k] = v;
    });
    add_url_text_or_params = null;
  }
  var new_location = tool.env.url_create(page, page_params) + (add_url_text_or_params || '');
  if(settings_url_params.embedded) { //embedded on the main page
    tool.browser.message.send(settings_url_params.parent_tab_id, 'open_page', { page: page, add_url_text: add_url_text_or_params });
  } else if(!settings_url_params.parent_tab_id) { // on a main page
    if(page !== '/chrome/elements/compose.htm') {
      var width = Math.min(800, $('body').width() - 200);
      var height = $('html').height() - ($('html').height() > 800 ? 150 : 75);
      var variant = null;
      var close_on_click = 'background';
    } else {
      var width = 542;
      var height = Math.min(600, $('html').height() - 150);
      var variant = 'new_message_featherlight';
      var close_on_click = false;
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
  get_account_emails(function (account_emails) {
    if(!tool.value(account_email).in(account_emails)) {
      throw new Error('"' + account_email + '" is not a known account_email in "' + JSON.stringify(account_emails) + '"');
    }
    var keys_to_remove = [];
    var filter = account_storage_key(account_email, '');
    if(!filter) {
      throw new Error('Filter is empty for account_email"' + account_email + '"');
    }
    chrome.storage.local.get(function (storage) {
      tool.each(storage, function (key, value) {
        if(key.indexOf(filter) === 0) {
          keys_to_remove.push(key.replace(filter, ''));
        }
      });
      account_storage_remove(account_email, keys_to_remove, function () {
        tool.each(localStorage, function (key, value) {
          if(key.indexOf(filter) === 0) {
            private_storage_set('local', account_email, key.replace(filter, ''), undefined);
          }
        });
        tool.each(sessionStorage, function (key, value) {
          if(key.indexOf(filter) === 0) {
            private_storage_set('session', account_email, key.replace(filter, ''), undefined);
          }
        });
        callback();
      });
    });
  });
}
