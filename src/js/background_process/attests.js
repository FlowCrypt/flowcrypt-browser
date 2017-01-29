/* Business Source License 1.0 © 2016 Tom James Holub (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/tomholub/cryptup-chrome/tree/master/src/LICENCE */

'use strict';

var GMAIL_READ_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
var CHECK_TIMEOUT = 5 * 1000; // first check in 5 seconds
var CHECK_INTERVAL = 5 * 60 * 1000; // subsequent checks every five minutes. Progressive increments would be better
var ATTESTERS = {
  CRYPTUP: {
    email: 'attest@cryptup.org',
    api: undefined,
    pubkey: undefined,
  }
};

var currently_watching = {};
var can_read_emails = {};

refresh_attest_requests_and_privileges(function(account_email, attests_requested) {
  if(attests_requested && attests_requested.length && can_read_emails[account_email]) {
    watch_for_attest_email(account_email);
  }
});

function attest_requested_handler(message, sender, respond) {
  respond();
  refresh_attest_requests_and_privileges(null, function() {
    watch_for_attest_email(message.account_email);
  });
}

function attest_packet_received_handler(message, sender, respond) {
  process_attest_packet_text(message.account_email, message.packet);
}

function watch_for_attest_email(account_email) {
  clearInterval(currently_watching[account_email]);
  setTimeout(function() {
    check_email_for_attests_and_respond(account_email);
  }, CHECK_TIMEOUT);
  currently_watching[account_email] = setInterval(function() {
    check_email_for_attests_and_respond(account_email);
  }, CHECK_INTERVAL);
}

function stop_watching(account_email) {
  clearInterval(currently_watching[account_email]);
  delete currently_watching[account_email];
}

function check_email_for_attests_and_respond(account_email) {
  account_storage_get(account_email, ['attests_requested'], function(storage) {
    if(get_passphrase(account_email)) {
      if(storage.attests_requested && storage.attests_requested.length && can_read_emails[account_email]) {
        fetch_attest_emails(account_email, function(success, messages) {
          if(success && messages) {
            $.each(messages, function(id, message) {
              process_attest_email(account_email, message);
            });
          }
        });
      } else {
        console.log('cannot fetch attest emails for ' + account_email);
        stop_watching(account_email);
      }
    } else {
      console.log('cannot get passphrase for signing - skip fetching attest emails for ' + account_email);
    }
  });
}

function process_attest_packet_text(account_email, attest_packet_text) {
  var attest = attest_packet_parse(attest_packet_text);
  var key = openpgp.key.readArmored(private_storage_get('local', account_email, 'master_private_key')).keys[0];
  var decrypted = decrypt_key(key, get_passphrase(account_email));
  if(decrypted) {
    var expected_fingerprint = key.primaryKey.fingerprint.toUpperCase();
    var expected_email_hash = double_sha1_upper(trim_lower(account_email));
    if(attest && attest.success && attest.content.attester in ATTESTERS && attest.content.fingerprint === expected_fingerprint && attest.content.email_hash === expected_email_hash) {
      is_already_attested(account_email, attest.attester, function(is_attested) {
        if(!is_attested) {
          sign(key, attest.text, true, function(signed_attest_packet) {
            if(attest.content.action !== 'CONFIRM_REPLACEMENT') {
              var keyserver_api_endpoint = keyserver_keys_attest;
            } else {
              var keyserver_api_endpoint = keyserver_replace_confirm;
            }
            keyserver_api_endpoint(signed_attest_packet.data, function(success, response) {
              if(success && response && response.attested) {
                account_storage_mark_as_attested(account_email, attest.content.attester, function() {
                  console.log('successfully attested ' + account_email);
                });
              } else {
                console.log('error attesting ' + account_email);
                console.log(response);
              }
            });
          });
        } else {
          console.log(attest.content.attester + ' already attested ' + account_email);
          stop_watching(account_email);
        }
      });
    } else {
      console.log('ignored incorrect (malicious?) attest message for ' + account_email);
      console.log(attest);
      // todo - ignore that message and stop pulling it - it's a fake attest message
    }
  }
}

function process_attest_email(account_email, gmail_message_object) {
  if(gmail_message_object.payload.mimeType === 'text/plain' && gmail_message_object.payload.body.size > 0) {
    process_attest_packet_text(account_email, base64url_decode(gmail_message_object.payload.body.data));
  }
}

function fetch_attest_emails(account_email, callback) {
  var q = [
    '(from:"' + get_attester_emails().join('" OR from: "') + '")',
    'to:' + account_email, // for now limited to account email only. Alternative addresses won't work.
    'in:anywhere',
    '"-----BEGIN ATTEST PACKET-----"',
    '"-----END ATTEST PACKET-----"',
  ];
  gmail_api_message_list(account_email, q.join(' '), true, function(success, response) {
    if(success) {
      if(response.messages) {
        var message_ids = [];
        $.each(response.messages, function(i, message) {
          message_ids.push(message.id);
        });
        gmail_api_message_get(account_email, message_ids, 'full', callback);
      } else {
        callback(true, null);
      }
    } else {
      callback(false, 'Connection dropped while checking attests.');
    }
  });
}

function refresh_attest_requests_and_privileges(process_account_email_callback, refresh_done_callback) {
  get_account_emails(function(account_emails) {
    account_storage_get(account_emails, ['attests_requested', 'google_token_scopes'], function(multi_storage) {
      $.each(multi_storage, function(account_email, storage) {
        can_read_emails[account_email] = (storage.google_token_scopes && storage.google_token_scopes.indexOf(GMAIL_READ_SCOPE) !== -1);
        if(process_account_email_callback) {
          process_account_email_callback(account_email, storage.attests_requested);
        }
      });
      if(refresh_done_callback) {
        refresh_done_callback();
      }
    });
  });
}

function get_attester_emails() {
  var emails = [];
  $.each(ATTESTERS, function(id, attester) {
    emails.push(attester.email);
  });
  return emails;
}

function is_already_attested(account_email, attester, callback) {
  account_storage_get(account_email, ['attests_processed'], function(storage) {
    callback(storage.attests_processed && storage.attests_processed.length && storage.attests_processed.indexOf(attester) !== -1);
  });
}

function account_storage_mark_as_attested(account_email, attester, callback) {
  stop_watching(account_email);
  account_storage_get(account_email, ['attests_requested', 'attests_processed'], function(storage) {
    if(storage.attests_requested && storage.attests_requested.length && storage.attests_requested.indexOf(attester) !== -1) {
      storage.attests_requested.splice(storage.attests_requested.indexOf(attester), 1); //remove attester from requested
      if(typeof storage.attests_processed === 'undefined') {
        storage.attests_processed = [];
      }
      if(storage.attests_processed.indexOf(attester) === -1) {
        storage.attests_processed.push(attester); //add attester as processed if not already there
      }
      account_storage_set(account_email, storage, callback);
    }
  });
}
