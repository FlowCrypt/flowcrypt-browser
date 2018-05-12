/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

/// <reference path="../../../node_modules/@types/chrome/index.d.ts" />
/// <reference path="../../../node_modules/@types/jquery/index.d.ts" />
/// <reference path="../../../node_modules/@types/openpgp/index.d.ts" />
/// <reference path="../common/common.d.ts" />

const CHECK_TIMEOUT = 5 * 1000; // first check in 5 seconds
const CHECK_INTERVAL = 5 * 60 * 1000; // subsequent checks every five minutes. Progressive increments would be better
const ATTESTERS = {
  CRYPTUP: { email: 'attest@cryptup.org', api: undefined as string|undefined, pubkey: undefined as string|undefined }
};

let currently_watching: Dict<number> = {};
let attest_ts_can_read_emails: Dict<boolean> = {};
let packet_headers = tool.crypto.armor.headers('attest_packet');

refresh_attest_requests_and_privileges(function (account_email, attests_requested) {
  if(attests_requested && attests_requested.length && attest_ts_can_read_emails[account_email]) {
    watch_for_attest_email(account_email);
  }
});

function attest_requested_handler(request: {account_email: string}, sender: chrome.runtime.MessageSender|'background', respond: Callback) {
  respond();
  refresh_attest_requests_and_privileges(null, () => {
    watch_for_attest_email(request.account_email);
  });
}

function attest_packet_received_handler(request: {account_email: string, packet: string, passphrase: string}, sender: chrome.runtime.MessageSender|'background', respond: Callback) {
  process_attest_packet_text(request.account_email, request.packet, request.passphrase, function(account: string, packet: string, success: boolean, result) {
    add_attest_log(account, packet, success, result, function() {
      respond({success: success, result: result});
    });
  });
}

function watch_for_attest_email(account_email: string) {
  clearInterval(currently_watching[account_email]);
  setTimeout(() => check_email_for_attests_and_respond(account_email), CHECK_TIMEOUT);
  currently_watching[account_email] = window.setInterval(() => check_email_for_attests_and_respond(account_email), CHECK_INTERVAL);
}

function stop_watching(account_email: string) {
  clearInterval(currently_watching[account_email]);
  delete currently_watching[account_email];
}

function check_email_for_attests_and_respond(account_email: string) {
  (window as FlowCryptWindow).flowcrypt_storage.get(account_email, ['attests_requested'], (S: Dict<string[]>) => {
    (window as FlowCryptWindow).flowcrypt_storage.keys_get(account_email, 'primary').then((primary_ki: KeyInfo) => {
      if(primary_ki !== null) {
        (window as FlowCryptWindow).flowcrypt_storage.passphrase_get(account_email, primary_ki.longid).then(passphrase => {
          if(passphrase !== null) {
            if(S.attests_requested && S.attests_requested.length && attest_ts_can_read_emails[account_email]) {
              fetch_attest_emails(account_email, (success, messages) => {
                if(success && messages) {
                  for(let message of messages) {
                    process_attest_email(account_email, message as {payload: Dict<any>});
                  }
                }
              });
            } else {
              add_attest_log(account_email, 'cannot fetch attest emails for ' + account_email,  false);
              stop_watching(account_email);
            }
          } else {
            console.log('cannot get pass phrase for signing - skip fetching attest emails for ' + account_email);
          }
        });
      } else {
        console.log('no primary key set yet - skip fetching attest emails for ' + account_email);
      }
    });
  });
}

function process_attest_packet_text(account_email: string, attest_packet_text: string, passphrase: string|null, callback: (email: string, ap: string, ok: boolean, msg: string) => void) {
  let attest = tool.api.attester.packet.parse(attest_packet_text);
  (window as FlowCryptWindow).flowcrypt_storage.keys_get(account_email, 'primary').then((primary_ki: KeyInfo) => {
    let key = openpgp.key.readArmored(primary_ki.private).keys[0];
    is_already_attested(account_email, attest.content.attester, is_attested => {
      if (!is_attested) {
        (window as FlowCryptWindow).flowcrypt_storage.passphrase_get(account_email, primary_ki.longid).then(stored_passphrase => {
          if (tool.crypto.key.decrypt(key, passphrase || stored_passphrase || '').success) {
            let expected_fingerprint = key.primaryKey.fingerprint.toUpperCase();
            let expected_email_hash = tool.crypto.hash.double_sha1_upper(tool.str.parse_email(account_email).email);
            if (attest && attest.success && attest.text && attest.content.attester in ATTESTERS && attest.content.fingerprint === expected_fingerprint && attest.content.email_hash === expected_email_hash) {
              tool.crypto.message.sign(key, attest.text, true, (success, result) => {
                if (success) {
                  let keyserver_api_response = (attest.content.action !== 'CONFIRM_REPLACEMENT') ? tool.api.attester.initial_confirm(result) : tool.api.attester.replace_confirm(result);
                  // @ts-ignore
                  keyserver_api_response.validate(r => r.attested).then(response => {
                    account_storage_mark_as_attested(account_email, attest.content.attester, () => {
                      callback(account_email, attest_packet_text, true, 'Successfully attested ' + account_email);
                    });
                  }, (error: StandardError) => {
                    callback(account_email, attest_packet_text, false, 'Refused by Attester. Write me at human@flowcrypt.com to find out why.\n\n' + error.message);
                  });
                } else {
                  attest.text = attest_packet_text;
                  catcher.log('Error signing ' + attest.content.action + ' attest packet: ' + result, attest);
                  callback(account_email, attest_packet_text, false, 'Error signing the attest. Write me at human@flowcrypt.com to find out why:' + result);
                }
              });
            } else {
              callback(account_email, attest_packet_text, false, 'This attest message is ignored as it does not match your settings.\n\nWrite me at human@flowcrypt.com to help.');
            }
          } else {
            callback(account_email, attest_packet_text, false, 'Missing pass phrase to process this attest message.\n\nIt will be processed automatically later.');
          }
        });
      } else {
        callback(account_email, attest_packet_text, true, attest.content.attester + ' already attested ' + account_email);
        stop_watching(account_email);
      }
    });
  });
}

function process_attest_email(account_email: string, gmail_message_object: {payload: Dict<any>}) {
  if(gmail_message_object.payload.mimeType === 'text/plain' && gmail_message_object.payload.body.size > 0) {
    process_attest_packet_text(account_email, tool.str.base64url_decode(gmail_message_object.payload.body.data), null, add_attest_log);
  }
}

function fetch_attest_emails(account_email: string, callback: (ok: boolean, messages: null|string|Dict<Serializable>[]) => void) {
  let q = [
    '(from:"' + get_attester_emails().join('" OR from: "') + '")',
    'to:' + account_email, // for now limited to account email only. Alternative addresses won't work.
    'in:anywhere',
    '"' + packet_headers.begin + '"',
    '"' + packet_headers.end + '"',
  ];
  tool.api.gmail.message_list(account_email, q.join(' '), true, (success: boolean, response: Dict<Dict<FlatTypes>[]>) => {
    if(success) {
      if(response.messages) {
        let message_ids: string[] = [];
        for (let message of response.messages) {
          message_ids.push(message.id as string);
        }
        tool.api.gmail.message_get(account_email, message_ids, 'full', callback);
      } else {
        callback(true, null);
      }
    } else {
      callback(false, 'Connection dropped while checking attests.');
    }
  });
}

function refresh_attest_requests_and_privileges(process_account_email_callback: ((e: string, a: string[]) => void)|null, refresh_done_callback:Callback|null=null) {
  (window as FlowCryptWindow).flowcrypt_storage.account_emails_get(function (account_emails) {
    (window as FlowCryptWindow).flowcrypt_storage.get(account_emails, ['attests_requested', 'google_token_scopes'], multi_storage => {
      tool.each(multi_storage, (account_email: string, storage) => {
        attest_ts_can_read_emails[account_email] = tool.api.gmail.has_scope(storage.google_token_scopes, 'read');
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
  let emails: string[] = [];
  tool.each(ATTESTERS, (id, attester) => {
    emails.push(attester.email);
  });
  return emails;
}

function is_already_attested(account_email: string, attester: string, callback: Callback) {
  (window as FlowCryptWindow).flowcrypt_storage.get(account_email, ['attests_processed'], (S: Dict<string[]>) => {
    callback(tool.value(attester).in(S.attests_processed));
  });
}

function account_storage_mark_as_attested(account_email: string, attester: string, callback: Callback) {
  stop_watching(account_email);
  (window as FlowCryptWindow).flowcrypt_storage.get(account_email, ['attests_requested', 'attests_processed'], (S: Dict<string[]>) => {
    if(tool.value(attester).in(S.attests_requested)) {
      S.attests_requested.splice(S.attests_requested.indexOf(attester), 1); //remove attester from requested
      if(typeof S.attests_processed === 'undefined') {
        S.attests_processed = [];
      }
      if(!tool.value(attester).in(S.attests_processed)) {
        S.attests_processed.push(attester); //add attester as processed if not already there
      }
      (window as FlowCryptWindow).flowcrypt_storage.set(account_email, S, callback);
    } else {
      callback();
    }
  });
}

function add_attest_log(account_email:string, packet:string, success:boolean, attestation_result_text:string='', callback:Callback|null=null) {
  console.log('attest result ' + success + ': ' + attestation_result_text);
  (window as FlowCryptWindow).flowcrypt_storage.get(account_email, ['attest_log'], (storage: Dict<Dict<FlatTypes>[]>) => {
    if(!storage.attest_log) {
      storage.attest_log = [];
    } else if(storage.attest_log.length > 100) {
      storage.attest_log = [{attempt: 100, success: false, result: 'DELETED 100 LOGS'}];
    }
    storage.attest_log.push({attempt: storage.attest_log.length + 1, packet: packet, success: success, result: attestation_result_text});
    (window as FlowCryptWindow).flowcrypt_storage.set(account_email, storage);
  });
}