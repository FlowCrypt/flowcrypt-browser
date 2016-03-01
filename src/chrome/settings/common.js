'use strict';

var v = 'v' + chrome.runtime.getManifest().version;
$('body').append('<div id="footer"><div><div><div>' + v + '</div><img src="/img/cryptup-logo-146-30-dark.png" /></div></div></div>');

function fetch_all_account_addresses(account_email, callback, q, from_emails) {
  function parse_first_message_from_email_header(account_email, q, callback) {
    function parse_from_email_header(messages, m_i, from_email_callback) {
      gmail_api_message_get(account_email, messages[m_i].id, 'metadata', function(success, message_get_response) {
        // todo: check "success"
        var headers = message_get_response.payload.headers;
        for(var i in headers) {
          if(headers[i].name.toLowerCase() === 'from') {
            from_email_callback(headers[i].value);
            return;
          }
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

function submit_pubkey_alternative_addresses(addresses, pubkey, callback) {
  if(addresses.length) {
    keyserver_keys_submit(addresses.pop(), pubkey, function(key_submitted, response) {
      submit_pubkey_alternative_addresses(addresses, pubkey, callback);
    });
  } else {
    callback();
  }
}
