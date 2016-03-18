'use strict';

var recovery_email_subjects = ['CryptUP Account Backup'];

$.get('footer.htm', null, function(data) {
  $('body').append(data);
  $('span#v').text(chrome.runtime.getManifest().version);
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

function submit_pubkey_alternative_addresses(addresses, pubkey, callback) {
  if(addresses.length) {
    keyserver_keys_submit(addresses.pop(), pubkey, function(key_submitted, response) {
      submit_pubkey_alternative_addresses(addresses, pubkey, callback);
    });
  } else {
    callback();
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

$('.back').click(function() {
  window.location = 'index.htm';
});
