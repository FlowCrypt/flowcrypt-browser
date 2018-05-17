/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

declare var anchorme: (input: string, opts: {emails?: boolean, attributes?: {name: string, value: string}[]}) => string;

tool.catch.try(() => {

  tool.ui.event.protect();

  let url_params = tool.env.url_params(['account_email', 'frame_id', 'message', 'parent_tab_id', 'message_id', 'is_outgoing', 'sender_email', 'has_password', 'signature', 'short']);
  
  let included_attachments: Attachment[] = [];
  let height_history: number[] = [];
  let message_fetched_from_api: false|GmailApiResponseFormat = false;
  let passphrase_interval: number|undefined = undefined;
  let missing_or_wrong_passprases: Dict<string|null> = {};
  let can_read_emails: undefined|boolean = undefined;
  let password_message_link_result: ApirFcMessageLink;
  let admin_codes: string[];
  
  function render_text(text: string) {
    document.getElementById('pgp_block')!.innerText = text; // pgp_block.htm
  }
  
  function render_html(html: string) {
    document.getElementById('pgp_block')!.innerHTML = html; // pgp_block.htm
  }
  
  function send_resize_message() {
    let new_height = $('#pgp_block').height()! + 40; // pgp_block.htm
  
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
      tool.browser.message.send(url_params.parent_tab_id as string, 'set_css', {
        selector: 'iframe#' + url_params.frame_id,
        css: { height: new_height },
      });
    }
  }
  
  function render_content(content: string, is_error: boolean, callback: VoidCallback) {
    if(!is_error && !url_params.is_outgoing) { //successfully opened incoming message
      // noinspection JSIgnoredPromiseFromCall
      Store.set(url_params.account_email as string, { successfully_received_at_leat_one_message: true });
    }
    tool.str.as_safe_html(content, function(safe_html) {
      render_html(is_error ? content : anchorme(safe_html, { emails: false, attributes: [{ name: 'target', value: '_blank' }] }));
      // if(unsecure_mdc_ignored && !is_error) {
      //   set_frame_color('red');
      //   $('#pgp_block').prepend('<div style="border: 4px solid #d14836;color:#d14836;padding: 5px;">' + Lang.pgp_block.mdc_warning.replace(/\n/g, '<br>') + '</div><br>');
      // }
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
      $('body').attr('data-test-state', 'ready');  //set as ready so that automated tests can evaluate results
    });
  }
  
  function button_html(text: string, add_classes: string) {
    return `<div class="button long ${add_classes}" style="margin:30px 0;" target="cryptup">${text}</div>`;
  }
  
  function armored_message_as_html(raw_message_substitute:string|null=null) {
    if(raw_message_substitute || url_params.message) {
      return '<div class="raw_pgp_block" style="display: none;">' + (raw_message_substitute || url_params.message as string).replace(/\n/g, '<br>') + '</div><a href="#" class="action_show_raw_pgp_block">show original message</a>';
    }
    return '';
  }
  
  function set_frame_color(color: 'red'|'green'|'gray') {
    if(color === 'red') {
      $('#pgp_background').removeClass('pgp_secure').removeClass('pgp_neutral').addClass('pgp_insecure');
    } else if(color === 'green') {
      $('#pgp_background').removeClass('pgp_neutral').removeClass('pgp_insecure').addClass('pgp_secure');
    } else {
      $('#pgp_background').removeClass('pgp_secure').removeClass('pgp_insecure').addClass('pgp_neutral');
    }
  }
  
  function render_error(error_box_content: string, raw_message_substitute:string|null=null, callback?: VoidCallback) {
    set_frame_color('red');
    render_content('<div class="error">' + error_box_content.replace(/\n/g, '<br>') + '</div>' + armored_message_as_html(raw_message_substitute), true, function () {
      $('.button.settings_keyserver').click(function () {
        tool.browser.message.send(null, 'settings', {account_email: url_params.account_email as string, page: '/chrome/settings/modules/keyserver.htm'});
      });
      $('.button.settings').click(function () {
        tool.browser.message.send(null, 'settings', {account_email: url_params.account_email as string});
      });
      $('.button.settings_add_key').click(function () {
        tool.browser.message.send(null, 'settings', {account_email: url_params.account_email as string, page: '/chrome/settings/modules/add_key.htm'});
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
  
  function handle_private_key_mismatch(account_email: string, message: string) { //todo - make it work for multiple stored keys
    tool.browser.message.bg_exec('tool.diagnose.message_pubkeys', [account_email, message], function (msg_diagnosis) {
      if(msg_diagnosis.found_match) {
        render_error(Lang.pgp_block.cant_open + Lang.pgp_block.encrypted_correctly_file_bug);
      } else {
        if(msg_diagnosis.receivers === 1) {
          render_error(Lang.pgp_block.cant_open + Lang.pgp_block.single_sender + Lang.pgp_block.ask_resend + button_html('account settings', 'gray2 settings_keyserver'));
        } else {
          render_error(Lang.pgp_block.your_key_cant_open_import_if_have + button_html('import missing key', 'gray2 settings_add_key') + '&nbsp;&nbsp;&nbsp;&nbsp;' + button_html('I don\'t have any other key', 'gray2 short reply_pubkey_mismatch') + '&nbsp;&nbsp;&nbsp;&nbsp;' + button_html('settings', 'gray2 settings_keyserver'));
        }
      }
    });
  }
  
  function decrypt_and_save_attachment_to_downloads(success: boolean, encrypted_data: Uint8Array|ErrorEvent, name: string, type: string, render_in: JQuery<HTMLElement>) {
    if(success && encrypted_data instanceof Uint8Array) {
      tool.browser.message.bg_exec('tool.crypto.message.decrypt', [url_params.account_email as string, encrypted_data, undefined, tool.browser.message.cb], function (result) {
        if(result.success) {
          tool.file.save_to_downloads(name.replace(/(\.pgp)|(\.gpg)$/, ''), type, result.content.data, render_in);
          send_resize_message();
        } else {
          delete result.message;
          console.log(result);
          alert('There was a problem decrypting this file. Downloading encrypted original. Write me at human@flowcrypt.com if this happens repeatedly.');
          tool.file.save_to_downloads(name, type, encrypted_data, render_in);
          send_resize_message();
        }
      });
    } else {
      alert('Could not download file, please try again.');
    }
  }
  
  function render_progress(element: JQuery<HTMLElement>, percent: number|null, received: number|null, size: number) {
    size = size || Number(url_params.size);
    if(percent) {
      element.text(percent + '%');
    } else if(size && received) {
      element.text(Math.floor(((received * 0.75) / size) * 100) + '%');
    }
  }
  
  function render_inner_attachments(attachments: Attachment[]) {
    $('#pgp_block').append('<div id="attachments"></div>');
    included_attachments = attachments;
    for(let i in attachments) {
      let name = (attachments[i].name ? tool.str.html_escape(attachments[i].name) : 'noname').replace(/(\.pgp)|(\.gpg)$/, '');
      let size = tool.str.number_format(Math.ceil(attachments[i].size / 1024)) + 'KB';
      $('#attachments').append('<div class="attachment" index="' + i + '"><b>' + name + '</b>&nbsp;&nbsp;&nbsp;' + size + '<span class="progress"><span class="percent"></span></span></div>');
    }
    send_resize_message();
    $('div.attachment').click(tool.ui.event.prevent(tool.ui.event.double(), function (self) {
      let attachment = included_attachments[Number($(self).attr('index') as string)];
      if(attachment.content) {
        tool.file.save_to_downloads(attachment.name, attachment.type, (typeof attachment.content === 'string') ? tool.str.to_uint8(attachment.content) : attachment.content, $(self));
        send_resize_message();
      } else {
        $(self).find('.progress').prepend(tool.ui.spinner('green'));
        tool.file.download_as_uint8(attachment.url as string, function(percent, load, total) {
          render_progress($(self).find('.progress .percent'), percent, load, total || attachment.size);
        }, function (success, downloaded) {
          setTimeout(function() {
            $(self).find('.progress').html('');
          }, 200);
          decrypt_and_save_attachment_to_downloads(success, downloaded, attachment.name, attachment.type, $(self));
        });
      }
    }));
  }
  
  function render_pgp_signature_check_result(signature: MessageVerifyResult) {
    if(signature) {
      let signer_email = signature.contact ? signature.contact.name || url_params.sender_email : url_params.sender_email;
      $('#pgp_signature > .cursive > span').text(String(signer_email) || 'Unknown Signer');
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
  
  function render_future_expiration(date: string) {
    let btns = '';
    if(admin_codes && admin_codes.length) {
      btns += ' <a href="#" class="extend_expiration">extend</a>';
    }
    if(url_params.is_outgoing) {
      btns += ' <a href="#" class="expire_settings">settings</a>';
    }
    $('#pgp_block').append(tool.e('div', {class: 'future_expiration', html: 'This message will expire on ' + tool.time.expiration_format(date) + '. ' + btns}));
    $('.expire_settings').click(function() {
      tool.browser.message.send(null, 'settings', {account_email: url_params.account_email as string, page: '/chrome/settings/modules/security.htm'});
    });
    $('.extend_expiration').click(render_message_expiration_renew_options);
  }
  
  function recover_stored_admin_codes() {
    Store.get(null, ['admin_codes']).then(storage => {
      if(url_params.short && storage.admin_codes && storage.admin_codes[url_params.short as string] && storage.admin_codes[url_params.short as string].codes) {
        admin_codes = storage.admin_codes[url_params.short as string].codes;
      }
    });
  }
  
  function render_message_expiration_renew_options() {
    let parent = $(this).parent();
    Store.subscription().then(subscription => {
      if(subscription.level && subscription.active) {
        parent.html('<div style="font-family: monospace;">Extend message expiration: <a href="#7" class="do_extend">+7 days</a> <a href="#30" class="do_extend">+1 month</a> <a href="#365" class="do_extend">+1 year</a></div>');
        $('.do_extend').click(tool.ui.event.prevent(tool.ui.event.double(), handle_extend_message_expiration_clicked));
      } else {
        if (subscription.level && !subscription.active && subscription.method === 'trial') {
          alert('Your trial has ended. Please renew your subscription to proceed.');
        } else {
          alert('FlowCrypt Advanced users can choose expiration of password encrypted messages. Try it free.');
        }
        tool.browser.message.send(url_params.parent_tab_id as string, 'subscribe_dialog');
      }
    });
  }
  
  function handle_extend_message_expiration_clicked(self: HTMLAnchorElement) {
    let n_days = Number($(self).attr('href')!.replace('#', ''));
    $(self).parent().html('Updating..' + tool.ui.spinner('green'));
    tool.api.cryptup.message_expiration(admin_codes, n_days).validate(r => r.updated).then((response) => window.location.reload(), (error: StandardError) => {
      if(error.internal === 'auth') {
        alert('Your FlowCrypt account information is outdated, please review your account settings.');
        tool.browser.message.send(url_params.parent_tab_id as string, 'subscribe_dialog', { source: 'auth_error' });
      } else {
        catcher.report('error when extending message expiration', error);
        $(self).parent().text('Error updating expiration, please try again').addClass('bad');
      }
    });
  }
  
  function decide_decrypted_content_formatting_and_render(decrypted_content: Uint8Array|string, is_encrypted: boolean, signature_result: MessageVerifyResult) {
    set_frame_color(is_encrypted ? 'green' : 'gray');
    render_pgp_signature_check_result(signature_result);
    let public_keys: string[] = [];
    if(decrypted_content instanceof Uint8Array) {
      decrypted_content = tool.str.from_uint8(decrypted_content); // functions below rely on this: resembles_message, extract_cryptup_attachments, strip_cryptup_reply_token, strip_public_keys
    }
    if(!tool.mime.resembles_message(decrypted_content)) {
      let cryptup_attachments: Attachment[] = [];
      decrypted_content = tool.str.extract_cryptup_attachments(decrypted_content as string, cryptup_attachments) as string;
      decrypted_content = tool.str.strip_cryptup_reply_token(decrypted_content as string) as string;
      decrypted_content = tool.str.strip_public_keys(decrypted_content as string, public_keys) as string;
      if(public_keys.length) {
        tool.browser.message.send(url_params.parent_tab_id as string, 'render_public_keys', {after_frame_id: url_params.frame_id, public_keys: public_keys});
      }
      render_content(tool.mime.format_content_to_display(decrypted_content, url_params.message as string), false, function () {
        if(cryptup_attachments.length) {
          render_inner_attachments(cryptup_attachments);
        }
        if(password_message_link_result && password_message_link_result.expire) {
          render_future_expiration(password_message_link_result.expire);
        }
      });
    } else {
      render_text('Formatting...');
      tool.mime.decode(decrypted_content, function (success, result) {
        render_content(tool.mime.format_content_to_display(result.text || result.html || decrypted_content as string, url_params.message as string), false, function () {
          let renderable_attachments: Attachment[] = [];
          for(let attachment of result.attachments) {
            if(tool.file.treat_as(attachment) !== 'public_key') {
              renderable_attachments.push(attachment);
            } else {
              public_keys.push(attachment.content as string); // todo - verify that this is indeed a string
            }
          }
          if(renderable_attachments.length) {
            render_inner_attachments(result.attachments);
          }
          if(public_keys.length) {
            tool.browser.message.send(url_params.parent_tab_id as string, 'render_public_keys', {after_frame_id: url_params.frame_id, public_keys: public_keys});
          }
        });
      });
    }
  }
  
  function decrypt_and_render(optional_password:string|null=null) {
    if(typeof url_params.signature !== 'string') {
      tool.browser.message.bg_exec('tool.crypto.message.decrypt', [url_params.account_email as string, url_params.message, optional_password, tool.browser.message.cb], function (result) {
        if(typeof result === 'undefined') {
          render_error(Lang.general.restart_browser_and_try_again);
        } else if(result.success) {
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
            render_error(Lang.pgp_block.bad_format + '\n\n' + result.format_error);
          }
        } else if(result.missing_passphrases.length) {
          render_passphrase_prompt(result.missing_passphrases);
        } else {
          Store.keys_get(url_params.account_email as string, ['primary']).then(([primary_k]) => {
            if(!result.counts.potentially_matching_keys && !primary_k) {
              render_error(Lang.pgp_block.not_properly_set_up + button_html('FlowCrypt settings', 'green settings'));
            } else if(result.counts.potentially_matching_keys === result.counts.attempts && result.counts.key_mismatch === result.counts.attempts) {
              if(url_params.has_password && !optional_password) {
                render_password_prompt();
              } else {
                handle_private_key_mismatch(url_params.account_email as string, url_params.message as string);
              }
            } else if(result.counts.wrong_password) {
              alert('Incorrect answer, please try again');
              render_password_prompt();
            } else if(result.counts.errors) {
              render_error(Lang.pgp_block.cant_open + Lang.pgp_block.bad_format + '\n\n' + '<em>' + result.errors.join('<br>') + '</em>');
            } else {
              delete result.message;
              render_error(Lang.pgp_block.cant_open + Lang.pgp_block.write_me + '\n\nDiagnostic info: "' + JSON.stringify(result) + '"');
            }
          });
        }
      });
    } else {
      tool.browser.message.bg_exec('tool.crypto.message.verify_detached', [url_params.account_email as string, url_params.message, url_params.signature, tool.browser.message.cb], function (signature_result) {
        decide_decrypted_content_formatting_and_render(url_params.message as string, false, signature_result);
      });
    }
  }
  
  function render_passphrase_prompt(missing_or_wrong_passphrase_key_longids: string[]) {
    missing_or_wrong_passprases = {};
    Promise.all(missing_or_wrong_passphrase_key_longids.map(longid => Store.passphrase_get(url_params.account_email as string, longid))).then(passphrases => {
      for(let i in missing_or_wrong_passphrase_key_longids) {
        missing_or_wrong_passprases[missing_or_wrong_passphrase_key_longids[i]] = passphrases[i];
        render_error('<a href="#" class="enter_passphrase">' + Lang.pgp_block.enter_passphrase + '</a> ' + Lang.pgp_block.to_open_message, undefined, function () {
          clearInterval(passphrase_interval);
          passphrase_interval = window.setInterval(check_passphrase_changed, 1000);
          $('.enter_passphrase').click(tool.ui.event.prevent(tool.ui.event.double(), function () {
            tool.browser.message.send(url_params.parent_tab_id as string, 'passphrase_dialog', { type: 'message', longids: missing_or_wrong_passphrase_key_longids });
            clearInterval(passphrase_interval);
            passphrase_interval = window.setInterval(check_passphrase_changed, 250);
          }));
        });
      }
    });
  }
  
  function render_password_prompt() {
    let prompt = '<p>' + Lang.pgp_block.question_decryt_prompt + '</p>';
    prompt += '<p><input id="answer" placeholder="Password"></p><p><div class="button green long decrypt">decrypt message</div></p>';
    prompt += armored_message_as_html();
    render_content(prompt, true, function () {
      $('.button.decrypt').click(tool.ui.event.prevent(tool.ui.event.double(), function (self) {
        $(self).html('Opening');
        setTimeout(function () {
          decrypt_and_render($('#answer').val() as string); // text input
        }, 50);
      }));
    });
  }
  
  function check_passphrase_changed() {
    let longids = Object.keys(missing_or_wrong_passprases);
    Promise.all(longids.map(longid => Store.passphrase_get(url_params.account_email as string, longid))).then(updated_passphrases => {
      for(let longid of longids) {
        if((missing_or_wrong_passprases[longid] || null) !== updated_passphrases[longids.indexOf(longid)]) {
          missing_or_wrong_passprases = {};
          clearInterval(passphrase_interval);
          decrypt_and_render();
          break;
        }
      }
    });
  }
  
  function render_password_encrypted_message_load_fail(link_result: ApirFcMessageLink) {
    if(link_result.expired) {
      let expiration_m = Lang.pgp_block.message_expired_on + tool.time.expiration_format(link_result.expire) + '. ' + Lang.pgp_block.messages_dont_expire + '\n\n';
      if(link_result.deleted) {
        expiration_m += Lang.pgp_block.message_destroyed;
      } else if(url_params.is_outgoing && admin_codes) {
        expiration_m += '<div class="button gray2 extend_expiration">renew message</div>';
      } else if(!url_params.is_outgoing) {
        expiration_m += Lang.pgp_block.ask_sender_renew;
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
      render_error(Lang.pgp_block.cannot_locate + Lang.pgp_block.broken_link);
    } else {
      render_error(Lang.pgp_block.cannot_locate + Lang.general.write_me_to_fix_it + ' Details:\n\n' + tool.str.html_escape(JSON.stringify(link_result)));
    }
  }
  
  function initialize(force_pull_message_from_api=false) {
    if(can_read_emails && url_params.message && url_params.signature === true) {
      render_text('Loading signature...');
      tool.api.gmail.message_get(url_params.account_email as string, url_params.message_id as string, 'raw', function(success: boolean, result: any) {
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
      render_text(url_params.signature ? 'Verifying..' : 'Decrypting...');
      decrypt_and_render();
    } else if (!url_params.message && url_params.has_password && url_params.short) { // need to fetch the message from FlowCrypt API
      render_text('Loading message...');
      recover_stored_admin_codes();
      tool.api.cryptup.link_message(url_params.short as string).validate(r => typeof r.url !== 'undefined').then(m_link_result => {
        password_message_link_result = m_link_result;
        if (m_link_result.url) {
          tool.file.download_as_uint8(m_link_result.url, null, function (success, download_uint_result) {
            if(success && download_uint_result instanceof Uint8Array) {
              url_params.message = tool.str.from_uint8(download_uint_result);
              decrypt_and_render();
            } else {
              render_text('Could not load message (network issue). Please try again.');
            }
          });
        } else {
          render_password_encrypted_message_load_fail(password_message_link_result);
        }
      }, (error: StandardError) => {
        render_text('Failed to load message info (network issue). Please try again.');
      });
    } else {  // need to fetch the inline signed + armored or encrypted +armored message block from gmail api
      if(can_read_emails) {
        render_text('Retrieving message...');
        let format: GmailApiResponseFormat = (!message_fetched_from_api) ? 'full' : 'raw';
        tool.api.gmail.extract_armored_block(url_params.account_email as string, url_params.message_id as string, format, function (message_raw: string) {
          render_text('Decrypting...');
          url_params.message = message_raw;
          message_fetched_from_api = format;
          decrypt_and_render();
        }, function (error_type: string, url_formatted_data_block: string) {
          if(error_type === 'format') {
            if(tool.value(tool.crypto.armor.headers('public_key').end).in(url_formatted_data_block)) {
              window.location.href = tool.env.url_create('pgp_pubkey.htm', { armored_pubkey: url_formatted_data_block, minimized: Boolean(url_params.is_outgoing), account_email: url_params.account_email as string, parent_tab_id: url_params.parent_tab_id as string, frame_id: url_params.frame_id });
            } else {
              render_error(Lang.pgp_block.cant_open + Lang.pgp_block.dont_know_how_open, url_formatted_data_block);
            }
          } else if(error_type === 'connection') {
            render_error(Lang.pgp_block.connection_error, url_formatted_data_block);
          } else {
            alert('Unknown error type: ' + error_type);
          }
        });
      } else { // gmail message read auth not allowed
        render_html('This encrypted message is very large (possibly containing an attachment). Your browser needs to access gmail it in order to decrypt and display the message.<br/><br/><br/><div class="button green auth_settings">Add missing permission</div>');
        $('.auth_settings').click(function () {
          tool.browser.message.send(null, 'settings', { account_email: url_params.account_email as string, page: '/chrome/settings/modules/auth_denied.htm' });
        });
      }
    }
  }
  
  Store.get(url_params.account_email as string, ['setup_done', 'google_token_scopes']).then(storage => {
    can_read_emails = tool.api.gmail.has_scope(storage.google_token_scopes || [], 'read');
    if(storage.setup_done) {
      initialize();
    } else {
      render_error(Lang.pgp_block.refresh_window, url_params.message as string || '');
    }
  });  

})();