/* Business Source License 1.0 © 2016 Tom James Holub (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/tomholub/cryptup-chrome/tree/master/src/LICENCE */

'use strict';

var url_params = tool.env.url_params(['account_email', 'frame_id', 'message', 'parent_tab_id', 'message_id', 'is_outgoing', 'sender_email', 'has_password', 'signature']);

var l = {
  cant_open: 'Could not open this message with CryptUp.\n\n',
  encrypted_correctly_file_bug: 'It\'s correctly encrypted for you. Please file a bug report if you see this on multiple messages. ',
  single_sender: 'Normally, messages are encrypted for at least two people (sender and the receiver). It seems the sender encrypted this message manually for themselves, and forgot to add you as a receiver. ',
  account_info_outdated: 'Some of your account information is incorrect. Update it to prevent future errors. ',
  wrong_pubkey_used: 'It looks like it was encrypted for someone else. ', //todo - suggest adding key?
  ask_resend: 'Please ask them to send a new message.',
  receivers_hidden: 'We cannot tell if the message was encrypted correctly for you. ',
  bad_format: 'Message is either badly formatted or not compatible with CryptUp. ',
  no_private_key: 'No private key to decrypt this message. Try reloading the page. ',
  refresh_page: 'Refresh page to see more information.',
  question_decryt_prompt: 'Please enter password to decrypt the message',
  connection_error: 'Could not connect to Gmail to open the message, please refresh the page to try again. ',
  dont_know_how_open: 'Please submit a bug report, and mention what software was used to send this message to you. We usually fix similar incompatibilities within one week. ',
  enter_passphrase: 'Enter passphrase',
  to_open_message: 'to open this message.',
  write_me: 'Please write me at tom@cryptup.org so that I can fix it. I respond very promptly. ',
  refresh_window: 'Please refresh your Gmail window to read encrypted messages. ',
  update_chrome_settings: 'Need to update chrome settings to view encrypted messages. ',
  not_properly_set_up: 'CryptUp is not properly set up to decrypt messages. ',
};

db_open(function (db) {

  var included_attachments = [];
  var height_history = [];
  var message_fetched_from_api = false;
  var passphrase_interval = undefined;
  var missing_or_wrong_passprases = {};
  var can_read_emails = undefined;

  if(db === db_denied) {
    notify_about_storage_access_error(url_params.account_email, url_params.parent_tab_id);
    render_error(l.update_chrome_settings + '<a href="#" class="review_settings">Review Settings</a>', null, function () {
      $('.review_settings').click(function () {
        tool.browser.message.send(null, 'settings', { account_email: url_params.account_email, page: '/chrome/texts/chrome_content_settings.htm' });
      });
    });
    return;
  }

  tool.env.increment('view');

  function send_resize_message() {
    var new_height = $('#pgp_block').height() + 40;

    function is_infinite_resize_loop() {
      height_history.push(new_height);
      var len = height_history.length;
      if(len < 4) {
        return false;
      }
      if(height_history[len - 1] === height_history[len - 3] && height_history[len - 2] === height_history[len - 4] && height_history[len - 1] !== height_history[len - 2]) {
        console.log('pgp_block.js: repetitive resize loop prevented'); //got repetitive, eg [70, 80, 200, 250, 200, 250]
        new_height = Math.max(height_history[len - 1], height_history[len - 2]);
      }
    }

    if(!is_infinite_resize_loop()) {
      tool.browser.message.send(url_params.parent_tab_id, 'set_css', {
        selector: 'iframe#' + url_params.frame_id,
        css: { height: new_height, }
      });
    }
  }

  function render_content(content, is_error, callback) {
    account_storage_get(url_params.account_email, ['successfully_received_at_leat_one_message'], function (storage) {
      if(!is_error && !url_params.is_outgoing) { //successfully opened incoming message
        account_storage_set(url_params.account_email, { successfully_received_at_leat_one_message: true });
      }
      $('#pgp_block').html(is_error ? content : tool.crypto.message.format_text(content));
      if(callback) {
        callback();
      }
      setTimeout(function () {
        $(window).resize(tool.ui.event.prevent(tool.ui.event.spree(), send_resize_message));
      }, 1000);
      send_resize_message();
    });
  }

  function button_html(text, add_classes) {
    return '<br><div class="button long ' + add_classes + '" style="margin:30px 0;" target="cryptup">' + text + '</div>';
  }

  function armored_message_as_html(raw_message_substitute) {
    if(raw_message_substitute || url_params.message) {
      return '<div class="raw_pgp_block">' + (raw_message_substitute || url_params.message).replace(/\n/g, '<br>') + '</div>';
    }
    return '';
  }

  function set_frame_color(c) {
    if(c === 'red') {
      $('body').removeClass('pgp_secure').removeClass('pgp_neutral').addClass('pgp_insecure');
    } else if(c === 'green') {
      $('body').removeClass('pgp_neutral').removeClass('pgp_insecure').addClass('pgp_secure');
    } else {
      $('body').removeClass('pgp_secure').removeClass('pgp_insecure').addClass('pgp_neutral');
    }
  }

  function render_error(error_box_content, raw_message_substitute, callback) {
    set_frame_color('red');
    render_content('<div class="error">' + error_box_content.replace(/\n/g, '<br>') + '</div>' + armored_message_as_html(raw_message_substitute), true, function () {
      $('.button.settings_keyserver').click(function () {
        tool.browser.message.send(null, 'settings', {
          account_email: url_params.account_email,
          page: '/chrome/settings/modules/keyserver.htm',
        });
      });
      $('.button.settings').click(function () {
        tool.browser.message.send(null, 'settings', {
          account_email: url_params.account_email,
        });
      });
      if(callback) {
        callback();
      }
    });
  }

  function handle_private_key_mismatch(account_email, message) { //todo - make it work for multiple stored keys
    var msg_diagnosis = tool.diagnose.message_pubkeys(account_email, message);
    if(msg_diagnosis.found_match) {
      render_error(l.cant_open + l.encrypted_correctly_file_bug);
    } else {
      if(msg_diagnosis.receivers === 1) {
        render_error(l.cant_open + l.single_sender + l.ask_resend + button_html('account settings', 'gray2 settings_keyserver'));
      } else {
        tool.diagnose.keyserver_pubkeys(account_email, function (ksrv_diagnosis) {
          if(!ksrv_diagnosis) {
            render_error(l.cant_open + l.refresh_page);
          } else {
            if(msg_diagnosis.receivers) {
              if(ksrv_diagnosis.has_pubkey_mismatch) {
                render_error(l.cant_open + l.account_info_outdated + button_html('review outdated information', 'green settings_keyserver'));
              } else {
                render_error(l.cant_open + l.wrong_pubkey_used + l.ask_resend + button_html('account settings', 'gray2 settings_keyserver'));
              }
            } else {
              if(ksrv_diagnosis.has_pubkey_mismatch) {
                render_error(l.cant_open + l.receivers_hidden + l.account_info_outdated + button_html('review outdated information', 'green settings_keyserver'));
              } else {
                render_error(l.cant_open + l.receivers_hidden + l.ask_resend + button_html('account settings', 'gray2 settings_keyserver'));
              }
            }
          }
        });
      }
    }
  }

  function decrypt_and_save_attachment_to_downloads(success, encrypted_data, name, type) {
    //todo - more or less copy/pasted from attachment.js, should use a common function
    //todo - or even better, stop showing attachments as inner part of messages, instead show them through attachment.htm. Test performance.
    if(success) {
      tool.crypto.message.decrypt(db, url_params.account_email, encrypted_data, undefined, function (result) {
        if(result.success) {
          tool.file.save_to_downloads(name.replace(/(\.pgp)|(\.gpg)$/, ''), type, result.content.data);
        } else {
          delete result.message;
          console.log(result);
          alert('There was a problem decrypting this file. Downloading encrypted original. Write me at tom@cryptup.org if this happens repeatedly.');
          tool.file.save_to_downloads(name, type, encrypted_data);
        }
      });
    } else {
      alert('Could not download file, please try again.');
    }
  }

  function render_progress(element, percent, received, size) {
    var size = size || url_params.size;
    if(percent) {
      element.text(percent + '%');
    } else if(size) {
      element.text(Math.floor(((received * 0.75) / size) * 100) + '%');
    }
  }

  function render_inner_attachments(attachments) {
    $('#pgp_block').append('<div id="attachments"></div>');
    included_attachments = attachments;
    $.each(attachments, function (i, attachment) {
      $('#attachments').append('<div class="attachment" index="' + i + '"><b>' + attachment.name + '</b>&nbsp;&nbsp;&nbsp;(' + tool.str.number_format(Math.ceil(attachment.size / 1024)) + 'KB, ' + attachment.type + ') <span class="progress"><span class="percent"></span></span></div>');
    });
    send_resize_message();
    $('div.attachment').click(tool.ui.event.prevent(tool.ui.event.double(), function (self) {
      var attachment = included_attachments[$(self).attr('index')];
      if(attachment.content) {
        tool.file.save_to_downloads(attachment.name, attachment.type, (typeof attachment.content === 'string') ? tool.str.to_uint8(attachment.content) : attachment.content);
      } else {
        $(self).find('.progress').prepend(tool.ui.spinner('green'));
        tool.file.download_as_uint8(attachment.url, function(percent, load, total) {
          render_progress($(self).find('.progress .percent'), percent, load, total || attachment.size);
        }, function (success, downloaded) {
          setTimeout(function() {
            $(self).find('.progress').html('');
          }, 200);
          decrypt_and_save_attachment_to_downloads(success, tool.str.from_uint8(downloaded), attachment.name, attachment.type);
        });
      }
    }));
  }

  function render_pgp_signature_check_result(signature) {
    if(signature) {
      var signer_email = signature.contact ? signature.contact.name || url_params.sender_email : url_params.sender_email;
      $('#pgp_signature > .cursive > span').text(signer_email || 'Unknown Signer');
      if(signature.signer && !signature.contact) {
        $('#pgp_signature').addClass('neutral');
        $('#pgp_signature > .result').text('cannot verify signature');
      } else if(signature.match && signature.signer && signature.contact) {
        $('#pgp_signature').addClass('good');
        $('#pgp_signature > .result').text('matching signature');
      } else {
        $('#pgp_signature').addClass('bad');
        $('#pgp_signature > .result').text('signature does not match');
        set_frame_color('red');
      }
      $('#pgp_signature').css('block');
    }
  }

  function decide_decrypted_content_formatting_and_render(decrypted_content, is_encrypted, signature_result) {
    set_frame_color(is_encrypted ? 'green' : 'gray');
    render_pgp_signature_check_result(signature_result);
    if(!tool.mime.resembles_message(decrypted_content)) {
      var cryptup_attachments = [];
      decrypted_content = tool.str.extract_cryptup_attachments(decrypted_content, cryptup_attachments);
      decrypted_content = tool.str.strip_cryptup_reply_token(decrypted_content);
      render_content(tool.mime.format_content_to_display(decrypted_content, url_params.message), false, function () {
        if(cryptup_attachments.length) {
          render_inner_attachments(cryptup_attachments);
        }
      });
    } else {
      $('#pgp_block').text('Formatting...');
      tool.mime.decode(decrypted_content, function (success, result) {
        render_content(tool.mime.format_content_to_display(result.text || result.html || decrypted_content, url_params.message), false, function () {
          if(result.attachments.length) {
            render_inner_attachments(result.attachments.map(function (mime_attachment) {
              return tool.file.attachment(mime_attachment.name, mime_attachment.type, mime_attachment.data, mime_attachment.size);
            }));
          }
        });
      });
    }
  }

  function decrypt_and_render(optional_password) {
    if(!url_params.signature) {
      tool.crypto.message.decrypt(db, url_params.account_email, url_params.message, optional_password, function (result) {
        if(result.success) {
          if(result.success && result.signature && result.signature.contact && !result.signature.match && can_read_emails && message_fetched_from_api !== 'raw') {
            console.log('re-fetching message ' + url_params.message_id + ' from api because failed signature check: ' + ((!message_fetched_from_api) ? 'full' : 'raw'));
            initialize(true);
          } else {
            decide_decrypted_content_formatting_and_render(result.content.data, result.encrypted, result.signature);
          }
        } else if(result.format_error) {
          render_error(l.bad_format + '\n\n' + result.format_error);
        } else if(result.missing_passphrases.length) {
          render_passphrase_prompt(result.missing_passphrases);
        } else if(!result.counts.potentially_matching_keys && !private_storage_get('local', url_params.account_email, 'master_private_key', url_params.parent_tab_id)) {
          render_error(l.not_properly_set_up + button_html('cryptup settings', 'green settings'));
        } else if(result.counts.potentially_matching_keys === result.counts.attempts && result.counts.key_mismatch === result.counts.attempts) {
          if(url_params.has_password && !optional_password) {
            render_password_prompt();
          } else {
            handle_private_key_mismatch(url_params.account_email, result.message);
          }
        } else if(result.counts.wrong_password) {
          alert('Incorrect answer, please try again');
          render_password_prompt();
        } else if(result.counts.errors) {
          render_error(l.cant_open + l.bad_format + '\n\n' + '<em>' + result.errors.join('<br>') + '</em>');
        } else {
          delete result.message;
          render_error(l.cant_open + l.write_me + '\n\nDiagnostic info: "' + JSON.stringify(result) + '"');
        }
      });
    } else {
      tool.crypto.message.verify_detached(db, url_params.account_email, url_params.message, url_params.signature, function (signature_result) {
        decide_decrypted_content_formatting_and_render(url_params.message, false, signature_result);
      });
    }
  }

  function render_passphrase_prompt(missing_or_wrong_passphrase_key_longids) {
    missing_or_wrong_passprases = {};
    $.each(missing_or_wrong_passphrase_key_longids, function (i, longid) {
      missing_or_wrong_passprases[longid] = get_passphrase(url_params.account_email, longid);
    });
    render_error('<a href="#" class="enter_passphrase">' + l.enter_passphrase + '</a> ' + l.to_open_message, undefined, function () {
      clearInterval(passphrase_interval);
      passphrase_interval = setInterval(check_passphrase_changed, 1000);
      $('.enter_passphrase').click(tool.ui.event.prevent(tool.ui.event.double(), function () {
        tool.browser.message.send(url_params.parent_tab_id, 'passphrase_dialog', { type: 'message', longids: missing_or_wrong_passphrase_key_longids });
        clearInterval(passphrase_interval);
        passphrase_interval = setInterval(check_passphrase_changed, 250);
      }));
    });
  }

  function render_password_prompt() {
    var prompt = '<p>' + l.question_decryt_prompt + '</p>';
    prompt += '<p><input id="answer" placeholder="Password"></p><p><div class="button green long decrypt">decrypt message</div></p>';
    prompt += armored_message_as_html();
    render_content(prompt, true, function () {
      $('.button.decrypt').click(tool.ui.event.prevent(tool.ui.event.double(), function (self) {
        $(self).html('Opening');
        setTimeout(function () {
          decrypt_and_render($('#answer').val());
        }, 50);
      }));
    });
  }

  function check_passphrase_changed() {
    $.each(missing_or_wrong_passprases, function (i, longid) {
      if(missing_or_wrong_passprases[longid] !== get_passphrase(url_params.account_email, longid)) {
        missing_or_wrong_passprases = {};
        clearInterval(passphrase_interval);
        decrypt_and_render();
        return false;
      }
    });
  }

  function initialize(force_pull_message_from_api) {
    if(can_read_emails && url_params.message && url_params.signature === true) {
      $('#pgp_block').text('Loading signature...');
      tool.api.gmail.message_get(url_params.account_email, url_params.message_id, 'raw', function(success, result) {
        message_fetched_from_api = 'raw';
        if(success && result.raw) {
          var mime_message = tool.str.base64url_decode(result.raw);
          var parsed = tool.mime.signed(mime_message);
          if(parsed) {
            url_params.signature = parsed.signature;
            url_params.message = parsed.signed;
            decrypt_and_render();
          } else {
            tool.mime.decode(mime_message, function (success, result) {
              url_params.signature = result.signature;
              console.log('%c[___START___ PROBLEM PARSING THIS MESSSAGE WITH DETACHED SIGNATURE]', 'color: red; font-weight: bold;');
              console.log(mime_message);
              console.log('%c[___END___ PROBLEM PARSING THIS MESSSAGE WITH DETACHED SIGNATURE]', 'color: red; font-weight: bold;');
              decrypt_and_render();
            });
          }
        } else {
          decrypt_and_render();
        }
      });
    } else if(url_params.message && !force_pull_message_from_api) { // ascii armored message supplied
      $('#pgp_block').text(url_params.signature ? 'Verifying..' : 'Decrypting...');
      decrypt_and_render();
    } else { // need to fetch the inline signed + armored or encrypted +armored message block from gmail api
      if(can_read_emails) {
        $('#pgp_block').text('Retrieving message...');
        var format = (!message_fetched_from_api) ? 'full' : 'raw';
        tool.api.gmail.extract_armored_block(url_params.account_email, url_params.message_id, format, function (message_raw) {
          $('#pgp_block').text('Decrypting...');
          url_params.message = message_raw;
          message_fetched_from_api = format;
          decrypt_and_render();
        }, function (error_type, url_formatted_data_block) {
          if(error_type === 'format') {
            if(tool.value(tool.crypto.armor.headers('public_key').end).in(url_formatted_data_block)) {
              window.location = tool.env.url_create('pgp_pubkey.htm', { armored_pubkey: url_formatted_data_block, minimized: Boolean(url_params.is_outgoing), account_email: url_params.account_email, parent_tab_id: url_params.parent_tab_id, frame_id: url_params.frame_id });
            } else {
              render_error(l.cant_open + l.dont_know_how_open, url_formatted_data_block);
            }
          } else if(error_type === 'connection') {
            render_error(l.connection_error, url_formatted_data_block);
          } else {
            alert('Unknown error type: ' + error_type);
          }
        });
      } else { // gmail message read auth not allowed
        $('#pgp_block').html('This encrypted message is very large (possibly containing an attachment). Your browser needs to access gmail it in order to decrypt and display the message.<br/><br/><br/><div class="button green auth_settings">Add missing permission</div>');
        $('.auth_settings').click(function () {
          tool.browser.message.send(null, 'settings', {
            account_email: url_params.account_email,
            page: '/chrome/settings/modules/auth_denied.htm',
          });
        });
      }
    }
  }

  account_storage_get(url_params.account_email, ['setup_done', 'google_token_scopes'], function (storage) {
    can_read_emails = tool.api.gmail.has_scope(storage.google_token_scopes, 'read');
    if(storage.setup_done) {
      initialize();
    } else {
      render_error(l.refresh_window, url_params.message || '');
    }
  });
});
