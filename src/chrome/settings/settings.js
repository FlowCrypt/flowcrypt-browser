'use strict';

var settings_url_params = get_url_params(['account_email', 'parent_tab_id', 'embedded']);
var settings_tab_id_global = undefined;

var recovery_email_subjects = ['Your CryptUP Backup', 'All you need to know about CryptUP (contains a backup)', 'CryptUP Account Backup'];

chrome_message_get_tab_id(function(tab_id) {
  settings_tab_id_global = tab_id;
});


function fetch_all_account_addresses(account_email, callback, q, from_emails) {
  function parse_first_message_from_email_header(account_email, q, callback) {
    function parse_from_email_header(messages, m_i, from_email_callback) {
      gmail_api_message_get(account_email, messages[m_i].id, 'metadata', function(success, message_get_response) { // todo: check "success"
        var header_from = gmail_api_find_header(message_get_response, 'from');
        if(header_from) {
          from_email_callback(header_from);
          return;
        }
        if(m_i + 1 < messages.length) {
          parse_from_email_header(messages, m_i + 1, from_email_callback);
        } else {
          from_email_callback();
        }
      });
    }
    gmail_api_message_list(account_email, q, false, function(success, message_list_response) {
      // todo: test "success" and handle
      if(typeof message_list_response.messages !== 'undefined') {
        parse_from_email_header(message_list_response.messages, 0, function(from_email) {
          callback(from_email);
        });
      } else {
        callback();
      }
    });
  }
  if(!from_emails) {
    from_emails = [];
  }
  if(!q) {
    q = 'in:sent';
  }
  parse_first_message_from_email_header(account_email, q, function(from_email) {
    if(from_email) {
      if(from_email.indexOf('<') !== -1) {
        from_email = from_email.match(/^[^<]*\<?([^>]+)\>?$/)[1];
      }
      from_emails.push(from_email);
      fetch_all_account_addresses(account_email, callback, q + ' -from:"' + from_email + '"', from_emails);
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
  // $.each(result.suggestions, function(i, suggestion) {
  //   $('.password_feedback > ul').append('<li>' + suggestion + '</li>');
  // });
}

function save_attest_request(account_email, attester, callback) {
  account_storage_get(account_email, ['attests_requested', 'attests_processed'], function(storage) {
    if(typeof storage.attests_requested === 'undefined') {
      storage.attests_requested = [attester];
    } else if(storage.attests_requested.indexOf(attester) === -1) {
      storage.attests_requested.push(attester); // insert into requests if not already there
    }
    if(typeof storage.attests_processed === 'undefined') {
      storage.attests_processed = [];
    }
    account_storage_set(account_email, storage, function() {
      chrome_message_send(null, 'attest_requested', {
        account_email: account_email,
      }, callback);
    });
  });
}

function mark_as_attested(account_email, attester, callback) {
  account_storage_get(account_email, ['attests_requested', 'attests_processed'], function(storage) {
    if(typeof storage.attests_requested === 'undefined') {
      storage.attests_requested = [];
    } else if(storage.attests_requested.indexOf(attester) !== -1) {
      storage.attests_requested.splice(storage.attests_requested.indexOf(attester), 1); //remove attester from requested
    }
    if(typeof storage.attests_processed === 'undefined') {
      storage.attests_processed = [attester];
    } else if(storage.attests_processed.indexOf(attester) === -1) {
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
    var attest = (address == settings_url_params.account_email); // only request attestation of main email
    keyserver_keys_submit(address, pubkey, attest, function(key_submitted, response) {
      if(attest && key_submitted) {
        if(!response.attested) {
          save_attest_request(settings_url_params.account_email, 'CRYPTUP', function() {
            submit_pubkeys(addresses, pubkey, callback, success && key_submitted && response.saved === true);
          });
        } else { //previously successfully attested, the attester claims
          mark_as_attested(settings_url_params.account_email, 'CRYPTUP', function() {
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

function fetch_email_key_backups(account_email, callback) {
  var q = [
    'from:' + account_email,
    'to:' + account_email,
    '(subject:"' + recovery_email_subjects.join('" OR subject: "') + '")',
    '-is:spam',
  ];
  gmail_api_message_list(account_email, q.join(' '), true, function(success, response) {
    if(success) {
      if(response.messages) {
        var message_ids = [];
        $.each(response.messages, function(i, message) {
          message_ids.push(message.id);
        });
        gmail_api_message_get(account_email, message_ids, 'full', function(success, messages) {
          if(success) {
            var attachments = [];
            $.each(messages, function(i, message) {
              attachments = attachments.concat(gmail_api_find_attachments(message));
            });
            gmail_api_fetch_attachments(account_email, attachments, function(success, downloaded_attachments) {
              var keys = [];
              $.each(downloaded_attachments, function(i, downloaded_attachment) {
                try {
                  var armored_key = base64url_decode(downloaded_attachment.data);
                  var key = openpgp.key.readArmored(armored_key).keys[0];
                  if(key.isPrivate()) {
                    keys.push(key);
                  }
                } catch(err) {}
              });
              callback(success, keys);
            });
          } else {
            callback(false, 'Connection dropped while checking for backups. Please try again.');
            display_block('step_0_found_key'); //todo: better handling needed. backup messages certainly exist but cannot find them right now.
          }
        });
      } else {
        callback(true, null);
      }
    } else {
      callback(false, 'Connection dropped while checking for backups. Please try again.');
    }
  });
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
    if(readable_time.indexOf(crack_time_words[i][0]) !== -1) {
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
    $.each(keys, function(i, key) {
      key.encrypt(passphrase);
    });
  } else if(!passphrase) {
    throw new Error("Encryption passphrase should not be empty");
  } else {
    throw new Error("Nothing to decrypt in a public key");
  }
}

function show_settings_page(page, add_url_text) {
  var new_location = page + '?account_email=' + encodeURIComponent(settings_url_params.account_email) + '&placement=settings';
  new_location += '&parent_tab_id=' + encodeURIComponent(settings_url_params.parent_tab_id || settings_tab_id_global) + (add_url_text || '');
  if(settings_url_params.embedded) { //embedded on the main page
    chrome_message_send(settings_tab_id_global, 'open_page', {
      page: page,
      add_url_text: add_url_text,
    });
  } else if(!settings_url_params.parent_tab_id) { // on a main page
    if(page !== '/chrome/gmail_elements/new_message.htm') {
      var width = Math.min(800, $('body').width() - 200);
      var variant = null;
    } else {
      var width = 542;
      var variant = 'new_message_featherlight';
    }
    $.featherlight({
      iframe: new_location,
      iframeWidth: width,
      iframeHeight: $('html').height() - 150,
      variant: variant,
    });
  } else { // on a sub page/module page, inside a lightbox. Just change location.
    window.location = new_location;
  }
}
