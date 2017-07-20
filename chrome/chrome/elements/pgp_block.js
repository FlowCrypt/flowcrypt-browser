/* Business Source License 1.0 © 2016 FlowCrypt Limited (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/CryptUp/cryptup-browser/tree/master/src/LICENCE */

'use strict';

tool.ui.event.protect();

let url_params = tool.env.url_params(['account_email', 'frame_id', 'message', 'parent_tab_id', 'message_id', 'is_outgoing', 'sender_email', 'has_password', 'signature', 'short']);

window.flowcrypt_storage.db_open(function (db) {

  let included_attachments = [];
  let height_history = [];
  let message_fetched_from_api = false;
  let passphrase_interval = undefined;
  let missing_or_wrong_passprases = {};
  let can_read_emails = undefined;
  let unsecure_mdc_ignored = false;
  let password_message_link_result;
  let admin_codes;

  if(db === window.flowcrypt_storage.db_denied) {
    window.flowcrypt_storage.notify_error(url_params.account_email, url_params.parent_tab_id);
    render_error(window.lang.pgp_block.update_chrome_settings + '<a href="#" class="review_settings">Review Settings</a>', null, function () {
      $('.review_settings').click(function () {
        tool.browser.message.send(null, 'settings', { account_email: url_params.account_email, page: '/chrome/texts/chrome_content_settings.htm' });
      });
    });
    return;
  }

  tool.env.increment('view');

  function send_resize_message() {
    let new_height = $('#pgp_block').height() + 40;

    function is_infinite_resize_loop() {
      height_history.push(new_height);
      let len = height_history.length;
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
        css: { height: new_height },
      });
    }
  }

  function render_content(content, is_error, callback) {
    window.flowcrypt_storage.get(url_params.account_email, ['successfully_received_at_leat_one_message'], storage => {
      if(!is_error && !url_params.is_outgoing) { //successfully opened incoming message
        window.flowcrypt_storage.set(url_params.account_email, { successfully_received_at_leat_one_message: true });
      }
      tool.str.as_safe_html(content, function(safe_html) {
        $('#pgp_block').html(is_error ? content : anchorme(safe_html, { emails: false, attributes: [{ name: 'target', value: '_blank' }] }));
        if(unsecure_mdc_ignored && !is_error) {
          set_frame_color('red');
          $('#pgp_block').prepend('<div style="border: 4px solid #d14836;color:#d14836;padding: 5px;">' + window.lang.pgp_block.mdc_warning.replace(/\n/g, '<br>') + '</div><br>');
        }
        if(is_error) {
          $('.action_show_raw_pgp_block').click(function () {
            $('.raw_pgp_block').css('display', 'block');
            $(this).css('display', 'none');
            send_resize_message();
          });
        }
        if(callback) {
          callback();
        }
        setTimeout(function () {
          $(window).resize(tool.ui.event.prevent(tool.ui.event.spree(), send_resize_message));
        }, 1000);
        send_resize_message();
      });
    });
  }

  function button_html(text, add_classes) {
    return '<div class="button long ' + add_classes + '" style="margin:30px 0;" target="cryptup">' + text + '</div>';
  }

  function armored_message_as_html(raw_message_substitute) {
    if(raw_message_substitute || url_params.message) {
      return '<div class="raw_pgp_block" style="display: none;">' + (raw_message_substitute || url_params.message).replace(/\n/g, '<br>') + '</div><a href="#" class="action_show_raw_pgp_block">show original message</a>';
    }
    return '';
  }

  function set_frame_color(c) {
    if(c === 'red') {
      $('#pgp_background').removeClass('pgp_secure').removeClass('pgp_neutral').addClass('pgp_insecure');
    } else if(c === 'green') {
      $('#pgp_background').removeClass('pgp_neutral').removeClass('pgp_insecure').addClass('pgp_secure');
    } else {
      $('#pgp_background').removeClass('pgp_secure').removeClass('pgp_insecure').addClass('pgp_neutral');
    }
  }

  function render_error(error_box_content, raw_message_substitute, callback) {
    set_frame_color('red');
    render_content('<div class="error">' + error_box_content.replace(/\n/g, '<br>') + '</div>' + armored_message_as_html(raw_message_substitute), true, function () {
      $('.button.settings_keyserver').click(function () {
        tool.browser.message.send(null, 'settings', {account_email: url_params.account_email, page: '/chrome/settings/modules/keyserver.htm'});
      });
      $('.button.settings').click(function () {
        tool.browser.message.send(null, 'settings', {account_email: url_params.account_email});
      });
      $('.button.settings_add_key').click(function () {
        tool.browser.message.send(null, 'settings', {account_email: url_params.account_email, page: '/chrome/settings/modules/add_key.htm'});
      });
      $('.button.reply_pubkey_mismatch').click(function () {
        alert('You should tell the sender to update their settings and send a new message.');
        tool.browser.message.send('broadcast', 'reply_pubkey_mismatch');
      });
      if(callback) {
        callback();
      }
    });
  }

  function handle_private_key_mismatch(account_email, message) { //todo - make it work for multiple stored keys
    let msg_diagnosis = tool.diagnose.message_pubkeys(account_email, message);
    if(msg_diagnosis.found_match) {
      render_error(window.lang.pgp_block.cant_open + window.lang.pgp_block.encrypted_correctly_file_bug);
    } else {
      if(msg_diagnosis.receivers === 1) {
        render_error(window.lang.pgp_block.cant_open + window.lang.pgp_block.single_sender + window.lang.pgp_block.ask_resend + button_html('account settings', 'gray2 settings_keyserver'));
      } else {
        render_error(window.lang.pgp_block.your_key_cant_open_import_if_have + button_html('import missing key', 'gray2 settings_add_key') + '&nbsp;&nbsp;&nbsp;&nbsp;' + button_html('I don\'t have any other key', 'gray2 short reply_pubkey_mismatch') + '&nbsp;&nbsp;&nbsp;&nbsp;' + button_html('settings', 'gray2 settings_keyserver'));
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
    size = size || url_params.size;
    if(percent) {
      element.text(percent + '%');
    } else if(size) {
      element.text(Math.floor(((received * 0.75) / size) * 100) + '%');
    }
  }

  function render_inner_attachments(attachments) {
    $('#pgp_block').append('<div id="attachments"></div>');
    included_attachments = attachments;
    tool.each(attachments, function (i, attachment) {
      let name = (attachment.name ? tool.str.html_escape(attachment.name) : 'noname').replace(/(\.pgp)|(\.gpg)$/, '');
      let size = tool.str.number_format(Math.ceil(attachment.size / 1024)) + 'KB';
      $('#attachments').append('<div class="attachment" index="' + i + '"><b>' + name + '</b>&nbsp;&nbsp;&nbsp;' + size + '<span class="progress"><span class="percent"></span></span></div>');
    });
    send_resize_message();
    $('div.attachment').click(tool.ui.event.prevent(tool.ui.event.double(), function (self) {
      let attachment = included_attachments[$(self).attr('index')];
      if(tool.env.browser().name !== 'firefox') { // non-firefox: download directly
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
      } else { // firefox: open in another tab
        let p = {account_email: url_params.account_email, parent_tab_id: url_params.parent_tab_id, download: true, name: attachment.name, type: attachment.type, size: attachment.size};
        if(attachment.url) {
          p.url = attachment.url;
        } else {
          p.content = tool.str.base64url_encode((typeof attachment.content === 'string') ? attachment.content : tool.str.from_uint8(attachment.content));
        }
        window.open(tool.env.url_create('/chrome/elements/attachment.htm',  p), '_blank');
      }
    }));
  }

  function render_pgp_signature_check_result(signature) {
    if(signature) {
      let signer_email = signature.contact ? signature.contact.name || url_params.sender_email : url_params.sender_email;
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

  function render_future_expiration(date) {
    let btns = '';
    if(admin_codes && admin_codes.length) {
      btns += ' <a href="#" class="extend_expiration">extend</a>';
    }
    if(url_params.is_outgoing) {
      btns += ' <a href="#" class="expire_settings">settings</a>';
    }
    $('#pgp_block').append(tool.e('div', {class: 'future_expiration', html: 'This message will expire on ' + tool.time.expiration_format(date) + '. ' + btns}));
    $('.expire_settings').click(function() {
      tool.browser.message.send(null, 'settings', {account_email: url_params.account_email, page: '/chrome/settings/modules/security.htm'});
    });
    $('.extend_expiration').click(render_message_expiration_renew_options);
  }

  function recover_stored_admin_codes() {
    window.flowcrypt_storage.get(null, ['admin_codes'], storage => {
      if(url_params.short && storage.admin_codes && storage.admin_codes[url_params.short] && storage.admin_codes[url_params.short].codes) {
        admin_codes = storage.admin_codes[url_params.short].codes;
      }
    });
  }

  function render_message_expiration_renew_options() {
    let parent = $(this).parent();
    window.flowcrypt_storage.subscription(function (level, expire, active, method) {
      if(level && !expired) {
        parent.html('<div style="font-family: monospace;">Extend message expiration: <a href="#7" class="do_extend">+7 days</a> <a href="#30" class="do_extend">+1 month</a> <a href="#365" class="do_extend">+1 year</a></div>');
        $('.do_extend').click(tool.ui.event.prevent(tool.ui.event.double(), handle_extend_message_expiration_clicked));
      } else {
        if (level && !active && method === 'trial') {
          alert('Your trial has ended. Please renew your subscription to proceed.');
        } else {
          alert('CryptUp Advanced users can choose expiration of password encrypted messages. Try it free.');
        }
        tool.browser.message.send(url_params.parent_tab_id, 'subscribe_dialog');
      }
    });
  }

  function handle_extend_message_expiration_clicked(self) {
    let n_days = Number($(self).attr('href').replace('#', ''));
    $(self).parent().html('Updating..' + tool.ui.spinner('green'));
    tool.api.cryptup.message_expiration(admin_codes, n_days).validate(r => r.updated).then(response => window.location.reload(), error => {
      if(error.internal === 'auth') {
        alert('Your CryptUp account information is outdated, please review your account settings.');
        tool.browser.message.send(url_params.parent_tab_id, 'subscribe_dialog', { source: 'auth_error' });
      } else {
        catcher.report('error when extending message expiration', error);
        $(self).parent().text('Error updating expiration, please try again').addClass('bad');
      }
    });
  }

  function decide_decrypted_content_formatting_and_render(decrypted_content, is_encrypted, signature_result) {
    set_frame_color(is_encrypted ? 'green' : 'gray');
    render_pgp_signature_check_result(signature_result);
    let public_keys = [];
    if(!tool.mime.resembles_message(decrypted_content)) {
      let cryptup_attachments = [];
      decrypted_content = tool.str.extract_cryptup_attachments(decrypted_content, cryptup_attachments);
      decrypted_content = tool.str.strip_cryptup_reply_token(decrypted_content);
      decrypted_content = tool.str.strip_public_keys(decrypted_content, public_keys);
      if(public_keys.length) {
        tool.browser.message.send(url_params.parent_tab_id, 'render_public_keys', {after_frame_id: url_params.frame_id, public_keys: public_keys});
      }
      render_content(tool.mime.format_content_to_display(decrypted_content, url_params.message), false, function () {
        if(cryptup_attachments.length) {
          render_inner_attachments(cryptup_attachments);
        }
        if(password_message_link_result && password_message_link_result.expire) {
          render_future_expiration(password_message_link_result.expire);
        }
      });
    } else {
      $('#pgp_block').text('Formatting...');
      tool.mime.decode(decrypted_content, function (success, result) {
        render_content(tool.mime.format_content_to_display(result.text || result.html || decrypted_content, url_params.message), false, function () {
          let renderable_attachments = [];
          tool.each(result.attachments, function(i, attachment) {
            if(tool.file.treat_as(attachment) !== 'public_key') {
              renderable_attachments.push(attachment);
            } else {
              public_keys.push(attachment.content);
            }
          });
          if(renderable_attachments.length) {
            render_inner_attachments(result.attachments);
          }
          if(public_keys.length) {
            tool.browser.message.send(url_params.parent_tab_id, 'render_public_keys', {after_frame_id: url_params.frame_id, public_keys: public_keys});
          }
        });
      });
    }
  }

  function decrypt_and_render(optional_password) {
    if(typeof url_params.signature !== 'string') {
      tool.crypto.message.decrypt(db, url_params.account_email, url_params.message, optional_password, function (result) {
        if(result.success) {
          if(result.success && result.signature && result.signature.contact && !result.signature.match && can_read_emails && message_fetched_from_api !== 'raw') {
            console.log('re-fetching message ' + url_params.message_id + ' from api because failed signature check: ' + ((!message_fetched_from_api) ? 'full' : 'raw'));
            initialize(true);
          } else {
            decide_decrypted_content_formatting_and_render(result.content.data, result.encrypted, result.signature);
          }
        } else if(result.format_error) {
          if(can_read_emails && message_fetched_from_api !== 'raw') {
            console.log('re-fetching message ' + url_params.message_id + ' from api because looks like bad formatting: ' + ((!message_fetched_from_api) ? 'full' : 'raw'));
            initialize(true);
          } else {
            render_error(window.lang.pgp_block.bad_format + '\n\n' + result.format_error);
          }
        } else if(result.missing_passphrases.length) {
          render_passphrase_prompt(result.missing_passphrases);
        } else if(!result.counts.potentially_matching_keys && !window.flowcrypt_storage.keys_get(url_params.account_email, 'primary')) {
          render_error(window.lang.pgp_block.not_properly_set_up + button_html('cryptup settings', 'green settings'));
        } else if(result.counts.potentially_matching_keys === result.counts.attempts && result.counts.key_mismatch === result.counts.attempts) {
          if(url_params.has_password && !optional_password) {
            render_password_prompt();
          } else {
            handle_private_key_mismatch(url_params.account_email, result.message);
          }
        } else if(result.counts.wrong_password) {
          alert('Incorrect answer, please try again');
          render_password_prompt();
        } else if(result.counts.unsecure_mdc && !unsecure_mdc_ignored) {
          openpgp.config.ignore_mdc_error = true;
          unsecure_mdc_ignored = true;
          initialize(); // try again with mdc missing error ignored
        } else if(result.counts.errors) {
          render_error(window.lang.pgp_block.cant_open + window.lang.pgp_block.bad_format + '\n\n' + '<em>' + result.errors.join('<br>') + '</em>');
        } else {
          delete result.message;
          render_error(window.lang.pgp_block.cant_open + window.lang.pgp_block.write_me + '\n\nDiagnostic info: "' + JSON.stringify(result) + '"');
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
    tool.each(missing_or_wrong_passphrase_key_longids, function (i, longid) {
      missing_or_wrong_passprases[longid] = window.flowcrypt_storage.passphrase_get(url_params.account_email, longid);
    });
    render_error('<a href="#" class="enter_passphrase">' + window.lang.pgp_block.enter_passphrase + '</a> ' + window.lang.pgp_block.to_open_message, undefined, function () {
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
    let prompt = '<p>' + window.lang.pgp_block.question_decryt_prompt + '</p>';
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
    tool.each(missing_or_wrong_passprases, function (i, longid) {
      if((missing_or_wrong_passprases[longid] || null) !== window.flowcrypt_storage.passphrase_get(url_params.account_email, longid)) {
        missing_or_wrong_passprases = {};
        clearInterval(passphrase_interval);
        decrypt_and_render();
        return false;
      }
    });
  }

  function render_password_encrypted_message_load_fail(link_result) {
    if(link_result.expired) {
      let expiration_m = window.lang.pgp_block.message_expired_on + tool.time.expiration_format(link_result.expire) + '. ' + window.lang.pgp_block.messages_dont_expire + '\n\n';
      if(link_result.deleted) {
        expiration_m += window.lang.pgp_block.message_destroyed;
      } else if(url_params.is_outgoing && admin_codes) {
        expiration_m += '<div class="button gray2 extend_expiration">renew message</div>';
      } else if(!url_params.is_outgoing) {
        expiration_m += window.lang.pgp_block.ask_sender_renew;
      }
      expiration_m += '\n\n<div class="button gray2 action_security">security settings</div>';
      render_error(expiration_m, null, function() {
        set_frame_color('gray');
        $('.action_security').click(function() {
          tool.browser.message.send(null, 'settings', {page: '/chrome/settings/modules/security.htm'});
        });
        $('.extend_expiration').click(render_message_expiration_renew_options);
      });
    } else if (!link_result.url) {
      render_error(window.lang.pgp_block.cannot_locate + window.lang.pgp_block.broken_link);
    } else {
      render_error(window.lang.pgp_block.cannot_locate + window.lang.general.write_me_to_fix_it + ' Details:\n\n' + tool.str.html_escape(JSON.stringify(link_result)));
    }
  }

  function initialize(force_pull_message_from_api) {
    if(can_read_emails && url_params.message && url_params.signature === true) {
      $('#pgp_block').text('Loading signature...');
      tool.api.gmail.message_get(url_params.account_email, url_params.message_id, 'raw', function(success, result) {
        message_fetched_from_api = 'raw';
        if(success && result.raw) {
          let mime_message = tool.str.base64url_decode(result.raw);
          let parsed = tool.mime.signed(mime_message);
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
    } else if (!url_params.message && url_params.has_password && url_params.short) { // need to fetch the message from CryptUp API
      $('#pgp_block').text('Loading message...');
      recover_stored_admin_codes();
      tool.api.cryptup.link_message(url_params.short).validate(r => typeof r.url !== 'undefined').then(response => {
        password_message_link_result = response;
        if (response.url) {
          tool.file.download_as_uint8(response.url, null, function (success, result) {
            if(success) {
              url_params.message = tool.str.from_uint8(result);
              decrypt_and_render();
            } else {
              $('#pgp_block').text('Could not load message (network issue). Please try again.');
            }
          });
        } else {
          render_password_encrypted_message_load_fail(password_message_link_result);
        }
      }, error => {
        $('#pgp_block').text('Failed to load message info (network issue). Please try again.');
      });
    } else {  // need to fetch the inline signed + armored or encrypted +armored message block from gmail api
      if(can_read_emails) {
        $('#pgp_block').text('Retrieving message...');
        let format = (!message_fetched_from_api) ? 'full' : 'raw';
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
              render_error(window.lang.pgp_block.cant_open + window.lang.pgp_block.dont_know_how_open, url_formatted_data_block);
            }
          } else if(error_type === 'connection') {
            render_error(window.lang.pgp_block.connection_error, url_formatted_data_block);
          } else {
            alert('Unknown error type: ' + error_type);
          }
        });
      } else { // gmail message read auth not allowed
        $('#pgp_block').html('This encrypted message is very large (possibly containing an attachment). Your browser needs to access gmail it in order to decrypt and display the message.<br/><br/><br/><div class="button green auth_settings">Add missing permission</div>');
        $('.auth_settings').click(function () {
          tool.browser.message.send(null, 'settings', { account_email: url_params.account_email, page: '/chrome/settings/modules/auth_denied.htm' });
        });
      }
    }
  }

  window.flowcrypt_storage.get(url_params.account_email, ['setup_done', 'google_token_scopes'], storage => {
    can_read_emails = tool.api.gmail.has_scope(storage.google_token_scopes, 'read');
    if(storage.setup_done) {
      initialize();
    } else {
      render_error(window.lang.pgp_block.refresh_window, url_params.message || '');
    }
  });
});
