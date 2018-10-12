/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

declare var anchorme: (input: string, opts: {emails?: boolean, attributes?: {name: string, value: string}[]}) => string;

tool.catch.try(async () => {

  tool.ui.event.protect();

  let url_params = tool.env.url_params(['account_email', 'frame_id', 'message', 'parent_tab_id', 'message_id', 'is_outgoing', 'sender_email', 'has_password', 'signature', 'short']);
  let account_email = tool.env.url_param_require.string(url_params, 'account_email');
  let parent_tab_id = tool.env.url_param_require.string(url_params, 'parent_tab_id');

  let included_attachments: Attachment[] = [];
  let height_history: number[] = [];
  let message_fetched_from_api: false|GmailApiResponseFormat = false;
  let passphrase_interval: number|undefined;
  let missing_or_wrong_passprases: Dict<string|null> = {};
  let can_read_emails: undefined|boolean;
  let password_message_link_result: ApirFcLinkMessage;
  let admin_codes: string[];
  let user_entered_message_password: string|undefined;

  let render_text = (text: string) => {
    document.getElementById('pgp_block')!.innerText = text; // pgp_block.htm
  };

  let sanitize_and_render_html = (html: string) => {
    $('#pgp_block').html(tool.str.html_sanitize_keep_basic_tags(html)); // xss-sanitized - content was sanitized before rendering
  };

  let send_resize_message = () => {
    let height = $('#pgp_block').height()! + 40; // pgp_block.htm

    let is_infinite_resize_loop = () => {
      height_history.push(height);
      let len = height_history.length;
      if (len < 4) {
        return false;
      }
      if (height_history[len - 1] === height_history[len - 3] && height_history[len - 2] === height_history[len - 4] && height_history[len - 1] !== height_history[len - 2]) {
        console.info('pgp_block.js: repetitive resize loop prevented'); // got repetitive, eg [70, 80, 200, 250, 200, 250]
        height = Math.max(height_history[len - 1], height_history[len - 2]);
      }
    };

    if (!is_infinite_resize_loop()) {
      tool.browser.message.send(parent_tab_id, 'set_css', {selector: `iframe#${url_params.frame_id}`, css: {height}});
    }
  };

  let render_content = async (content: string, is_error: boolean) => {
    if (!is_error && !url_params.is_outgoing) { // successfully opened incoming message
      await Store.set(account_email, { successfully_received_at_leat_one_message: true });
    }
    sanitize_and_render_html(is_error ? content : anchorme(content, { emails: false, attributes: [{ name: 'target', value: '_blank' }] }));
    // if (unsecure_mdc_ignored && !is_error) {
    //   set_frame_color('red');
    //   tool.ui.sanitize_prepend('#pgp_block', '<div style="border: 4px solid #d14836;color:#d14836;padding: 5px;">' + Lang.pgp_block.mdc_warning.replace(/\n/g, '<br>') + '</div><br>');
    // }
    if (is_error) {
      $('.action_show_raw_pgp_block').click(tool.ui.event.handle(target => {
        $('.raw_pgp_block').css('display', 'block');
        $(target).css('display', 'none');
        send_resize_message();
      }));
    }
    send_resize_message();
    $('body').attr('data-test-state', 'ready'); // set as ready so that automated tests can evaluate results
    await tool.ui.delay(1000);
    $(window).resize(tool.ui.event.prevent(tool.ui.event.spree(), send_resize_message));
  };

  let button_html = (text: string, add_classes: string) => {
    return `<div class="button long ${add_classes}" style="margin:30px 0;" target="cryptup">${text}</div>`;
  };

  let armored_message_as_html = (raw_message_substitute:string|null=null) => {
    let m = raw_message_substitute || url_params.message;
    if (m && typeof m === 'string') {
      return `<div class="raw_pgp_block" style="display: none;">${m.replace(/\n/g, '<br>')}</div><a href="#" class="action_show_raw_pgp_block">show original message</a>`;
    }
    return '';
  };

  let set_frame_color = (color: 'red'|'green'|'gray') => {
    if (color === 'red') {
      $('#pgp_background').removeClass('pgp_secure').removeClass('pgp_neutral').addClass('pgp_insecure');
    } else if (color === 'green') {
      $('#pgp_background').removeClass('pgp_neutral').removeClass('pgp_insecure').addClass('pgp_secure');
    } else {
      $('#pgp_background').removeClass('pgp_secure').removeClass('pgp_insecure').addClass('pgp_neutral');
    }
  };

  let render_error = async (error_box_content: string, raw_message_substitute:string|null=null) => {
    set_frame_color('red');
    await render_content('<div class="error">' + error_box_content.replace(/\n/g, '<br>') + '</div>' + armored_message_as_html(raw_message_substitute), true);
    $('.button.settings_keyserver').click(tool.ui.event.handle(() => tool.browser.message.send(null, 'settings', {account_email, page: '/chrome/settings/modules/keyserver.htm'})));
    $('.button.settings').click(tool.ui.event.handle(() => tool.browser.message.send(null, 'settings', {account_email})));
    $('.button.settings_add_key').click(tool.ui.event.handle(() => tool.browser.message.send(null, 'settings', {account_email, page: '/chrome/settings/modules/add_key.htm'})));
    $('.button.reply_pubkey_mismatch').click(tool.ui.event.handle(() => {
      alert('You should tell the sender to update their settings and send a new message.');
      tool.browser.message.send('broadcast', 'reply_pubkey_mismatch');
    }));
  };

  let handle_private_key_mismatch = async (account_email: string, message: string) => { // todo - make it work for multiple stored keys
    let msg_diagnosis = await BgExec.diagnose_message_pubkeys(account_email, message);
    if (msg_diagnosis.found_match) {
      await render_error(Lang.pgp_block.cant_open + Lang.pgp_block.encrypted_correctly_file_bug);
    } else if (msg_diagnosis.receivers === 1) {
      await render_error(Lang.pgp_block.cant_open + Lang.pgp_block.single_sender + Lang.pgp_block.ask_resend + button_html('account settings', 'gray2 settings_keyserver'));
    } else {
      await render_error(Lang.pgp_block.your_key_cant_open_import_if_have + button_html('import missing key', 'gray2 settings_add_key') + '&nbsp;&nbsp;&nbsp;&nbsp;' + button_html('I don\'t have any other key', 'gray2 short reply_pubkey_mismatch') + '&nbsp;&nbsp;&nbsp;&nbsp;' + button_html('settings', 'gray2 settings_keyserver'));
    }
  };

  let decrypt_pwd = (supplied_password?: string|null): string|null => {
    let pwd = supplied_password || user_entered_message_password || null;
    if(pwd && url_params.use_password) {
      return tool.crypto.hash.challenge_answer(pwd);
    }
    return pwd;
  };

  let decrypt_and_save_attachment_to_downloads = async (encrypted: Attachment, render_in: JQuery<HTMLElement>) => {
    let decrypted = await BgExec.crypto_message_decrypt(account_email, encrypted.data(), decrypt_pwd(), true);
    if (decrypted.success) {
      let attachment = new Attachment({name: encrypted.name.replace(/(\.pgp)|(\.gpg)$/, ''), type: encrypted.type, data: decrypted.content.uint8!});
      tool.file.save_to_downloads(attachment, render_in);
      send_resize_message();
    } else {
      delete decrypted.message;
      console.info(decrypted);
      alert('There was a problem decrypting this file. Downloading encrypted original. Email human@flowcrypt.com if this happens repeatedly.');
      tool.file.save_to_downloads(encrypted, render_in);
      send_resize_message();
    }
  };

  let render_progress = (element: JQuery<HTMLElement>, percent: number|null, received: number|null, size: number) => {
    size = size || Number(url_params.size);
    if (percent) {
      element.text(percent + '%');
    } else if (size && received) {
      element.text(Math.floor(((received * 0.75) / size) * 100) + '%');
    }
  };

  let render_inner_attachments = (attachments: Attachment[]) => {
    tool.ui.sanitize_append('#pgp_block', '<div id="attachments"></div>');
    included_attachments = attachments;
    for (let i of attachments.keys()) {
      let name = (attachments[i].name ? tool.str.html_escape(attachments[i].name) : 'noname').replace(/(\.pgp)|(\.gpg)$/, '');
      let size = tool.str.number_format(Math.ceil(attachments[i].length / 1024)) + 'KB';
      tool.ui.sanitize_append('#attachments', `<div class="attachment" index="${Number(i)}"><b>${tool.str.html_escape(name)}</b>&nbsp;&nbsp;&nbsp;${size}<span class="progress"><span class="percent"></span></span></div>`);
    }
    send_resize_message();
    $('div.attachment').click(tool.ui.event.prevent(tool.ui.event.double(), async target => {
      let attachment = included_attachments[Number($(target).attr('index') as string)];
      if (attachment.has_data()) {
        tool.file.save_to_downloads(attachment, $(target));
        send_resize_message();
      } else {
        tool.ui.sanitize_prepend($(target).find('.progress'), tool.ui.spinner('green'));
        attachment.set_data(await tool.file.download_as_uint8(attachment.url!, (perc, load, total) => render_progress($(target).find('.progress .percent'), perc, load, total || attachment.length)));
        await tool.ui.delay(100); // give browser time to render
        $(target).find('.progress').text('');
        await decrypt_and_save_attachment_to_downloads(attachment, $(target));
      }
    }));
  };

  let render_pgp_signature_check_result = (signature: MessageVerifyResult|null) => {
    if (signature) {
      let signer_email = signature.contact ? signature.contact.name || url_params.sender_email : url_params.sender_email;
      $('#pgp_signature > .cursive > span').text(String(signer_email) || 'Unknown Signer');
      if (signature.signer && !signature.contact) {
        $('#pgp_signature').addClass('neutral');
        $('#pgp_signature > .result').text('cannot verify signature');
      } else if (signature.match && signature.signer && signature.contact) {
        $('#pgp_signature').addClass('good');
        $('#pgp_signature > .result').text('matching signature');
      } else {
        $('#pgp_signature').addClass('bad');
        $('#pgp_signature > .result').text('signature does not match');
        set_frame_color('red');
      }
      $('#pgp_signature').css('block');
    }
  };

  let render_future_expiration = (date: string) => {
    let btns = '';
    if (admin_codes && admin_codes.length) {
      btns += ' <a href="#" class="extend_expiration">extend</a>';
    }
    if (url_params.is_outgoing) {
      btns += ' <a href="#" class="expire_settings">settings</a>';
    }
    tool.ui.sanitize_append('#pgp_block', tool.e('div', {class: 'future_expiration', html: `This message will expire on ${tool.time.expiration_format(date)}. ${btns}`}));
    $('.expire_settings').click(tool.ui.event.handle(() => tool.browser.message.send(null, 'settings', {account_email, page: '/chrome/settings/modules/security.htm'})));
    $('.extend_expiration').click(tool.ui.event.handle(target => render_message_expiration_renew_options(target)));
  };

  let recover_stored_admin_codes = async () => {
    let storage = await Store.get_global(['admin_codes']);
    if (url_params.short && storage.admin_codes && storage.admin_codes[url_params.short as string] && storage.admin_codes[url_params.short as string].codes) {
      admin_codes = storage.admin_codes[url_params.short as string].codes;
    }
  };

  let render_message_expiration_renew_options = async (target: HTMLElement) => {
    let parent = $(target).parent();
    let subscription = await Store.subscription();
    if (subscription.level && subscription.active) {
      tool.ui.sanitize_render(parent, '<div style="font-family: monospace;">Extend message expiration: <a href="#7" class="do_extend">+7 days</a> <a href="#30" class="do_extend">+1 month</a> <a href="#365" class="do_extend">+1 year</a></div>');
      let element = await tool.ui.event.clicked('.do_extend');
      await handle_extend_message_expiration_clicked(element);
    } else {
      if (subscription.level && !subscription.active && subscription.method === 'trial') {
        alert('Your trial has ended. Please renew your subscription to proceed.');
      } else {
        alert('FlowCrypt Advanced users can choose expiration of password encrypted messages. Try it free.');
      }
      tool.browser.message.send(parent_tab_id, 'subscribe_dialog');
    }
  };

  let handle_extend_message_expiration_clicked = async (self: HTMLElement) => {
    let n_days = Number($(self).attr('href')!.replace('#', ''));
    tool.ui.sanitize_render($(self).parent(), 'Updating..' + tool.ui.spinner('green'));
    try {
      let r = await tool.api.cryptup.message_expiration(admin_codes, n_days);
      if (r.updated) {
        window.location.reload();
      } else {
        throw r;
      }
    } catch (e) {
      if (tool.api.error.is_auth_error(e)) {
        alert('Your FlowCrypt account information is outdated, please review your account settings.');
        tool.browser.message.send(parent_tab_id, 'subscribe_dialog', { source: 'auth_error' });
      }
      tool.catch.report('error when extending message expiration', e);
      tool.ui.sanitize_render($(self).parent(), 'Error updating expiration. <a href="#" class="retry_expiration_change">Click here to try again</a>').addClass('bad');
      let el = await tool.ui.event.clicked('.retry_expiration_change');
      await handle_extend_message_expiration_clicked(el);
    }
  };

  let decide_decrypted_content_formatting_and_render = async (decrypted_content: Uint8Array|string, is_encrypted: boolean, signature_result: MessageVerifyResult|null) => {
    set_frame_color(is_encrypted ? 'green' : 'gray');
    render_pgp_signature_check_result(signature_result);
    let public_keys: string[] = [];
    if (decrypted_content instanceof Uint8Array) {
      decrypted_content = tool.str.from_uint8(decrypted_content); // functions below rely on this: resembles_message, extract_cryptup_attachments, strip_cryptup_reply_token, strip_public_keys
    }
    if (!tool.mime.resembles_message(decrypted_content)) {
      let cryptup_attachments: Attachment[] = [];
      decrypted_content = tool.str.extract_cryptup_attachments(decrypted_content, cryptup_attachments);
      decrypted_content = tool.str.strip_cryptup_reply_token(decrypted_content);
      decrypted_content = tool.str.strip_public_keys(decrypted_content, public_keys);
      if (public_keys.length) {
        tool.browser.message.send(parent_tab_id, 'render_public_keys', {after_frame_id: url_params.frame_id, public_keys});
      }
      decrypted_content = tool.str.html_escape(decrypted_content);
      await render_content(tool.mime.format_content_to_display(decrypted_content, url_params.message as string), false);
      if (cryptup_attachments.length) {
        render_inner_attachments(cryptup_attachments);
      }
      if (password_message_link_result && password_message_link_result.expire) {
        render_future_expiration(password_message_link_result.expire);
      }
    } else {
      render_text('Formatting...');
      let decoded = await tool.mime.decode(decrypted_content);
      await render_content(tool.mime.format_content_to_display(decoded.text || decoded.html || decrypted_content as string, url_params.message as string), false);
      let renderable_attachments: Attachment[] = [];
      for (let attachment of decoded.attachments) {
        if (attachment.treat_as() !== 'public_key') {
          renderable_attachments.push(attachment);
        } else {
          public_keys.push(attachment.as_text());
        }
      }
      if (renderable_attachments.length) {
        render_inner_attachments(decoded.attachments);
      }
      if (public_keys.length) {
        tool.browser.message.send(parent_tab_id, 'render_public_keys', {after_frame_id: url_params.frame_id, public_keys});
      }
    }
  };

  let decrypt_and_render = async (optional_password:string|null=null) => {
    if (typeof url_params.signature !== 'string') {
      let result = await BgExec.crypto_message_decrypt(account_email, url_params.message as string|Uint8Array, decrypt_pwd(optional_password));
      if (typeof result === 'undefined') {
        await render_error(Lang.general.restart_browser_and_try_again);
      } else if (result.success) {
        if (url_params.has_password && optional_password) {
          user_entered_message_password = optional_password;
        }
        if (result.success && result.signature && result.signature.contact && !result.signature.match && can_read_emails && message_fetched_from_api !== 'raw') {
          console.info('re-fetching message ' + url_params.message_id + ' from api because failed signature check: ' + ((!message_fetched_from_api) ? 'full' : 'raw'));
          await initialize(true);
        } else {
          await decide_decrypted_content_formatting_and_render(result.content.text!, Boolean(result.is_encrypted), result.signature); // text!: did not request uint8
        }
      } else if (result.error.type === DecryptErrorTypes.format) {
        if (can_read_emails && message_fetched_from_api !== 'raw') {
          console.info('re-fetching message ' + url_params.message_id + ' from api because looks like bad formatting: ' + ((!message_fetched_from_api) ? 'full' : 'raw'));
          await initialize(true);
        } else {
          await render_error(Lang.pgp_block.bad_format + '\n\n' + result.error.error);
        }
      } else if (result.longids.need_passphrase.length) {
        await render_passphrase_prompt(result.longids.need_passphrase);
      } else {
        let [primary_k] = await Store.keys_get(account_email, ['primary']);
        if (!result.longids.chosen && !primary_k) {
          await render_error(Lang.pgp_block.not_properly_set_up + button_html('FlowCrypt settings', 'green settings'));
        } else if (result.error.type === DecryptErrorTypes.key_mismatch) {
          if (url_params.has_password && !optional_password) {
            await render_password_prompt();
          } else {
            await handle_private_key_mismatch(account_email, url_params.message as string);
          }
        } else if (result.error.type === DecryptErrorTypes.wrong_password) {
          alert('Incorrect answer, please try again');
          await render_password_prompt();
        } else if (result.error.type === DecryptErrorTypes.use_password) {
          await render_password_prompt();
        } else if (result.error.type === DecryptErrorTypes.no_mdc) {
          await render_error('This message may not be safe to open: missing MDC. To open this message, please go to FlowCrypt Settings -> Additional Settings -> Exprimental -> Decrypt message without MDC');
        } else if (result.error) {
          await render_error(`${Lang.pgp_block.cant_open}\n\n<em>${result.error.type}: ${result.error.error}</em>`);
        } else { // should generally not happen
          delete result.message;
          await render_error(Lang.pgp_block.cant_open + Lang.pgp_block.write_me + '\n\nDiagnostic info: "' + JSON.stringify(result) + '"');
        }
      }
    } else {
      let signature_result = await BgExec.crypto_message_verify_detached(account_email, url_params.message as string|Uint8Array, url_params.signature);
      await decide_decrypted_content_formatting_and_render(url_params.message as string, false, signature_result);
    }
  };

  let render_passphrase_prompt = async (missing_or_wrong_pp_k_longids: string[]) => {
    missing_or_wrong_passprases = {};
    let passphrases = await Promise.all(missing_or_wrong_pp_k_longids.map(longid => Store.passphrase_get(account_email, longid)));
    for (let i of missing_or_wrong_pp_k_longids.keys()) {
      missing_or_wrong_passprases[missing_or_wrong_pp_k_longids[i]] = passphrases[i];
      await render_error('<a href="#" class="enter_passphrase">' + Lang.pgp_block.enter_passphrase + '</a> ' + Lang.pgp_block.to_open_message, undefined);
      clearInterval(passphrase_interval);
      passphrase_interval = window.setInterval(check_passphrase_changed, 1000);
      $('.enter_passphrase').click(tool.ui.event.handle(() => {
        tool.browser.message.send(parent_tab_id, 'passphrase_dialog', { type: 'message', longids: missing_or_wrong_pp_k_longids });
        clearInterval(passphrase_interval);
        passphrase_interval = window.setInterval(check_passphrase_changed, 250);
      }));
    }
  };

  let render_password_prompt = async () => {
    let prompt = '<p>' + Lang.pgp_block.decrypt_password_prompt + '</p>';
    prompt += '<p><input id="answer" placeholder="Password"></p><p><div class="button green long decrypt">decrypt message</div></p>';
    prompt += armored_message_as_html();
    await render_content(prompt, true);
    await tool.ui.event.clicked('.button.decrypt');
    $(self).text('Opening');
    await tool.ui.delay(50); // give browser time to render
    await decrypt_and_render($('#answer').val() as string); // text input
  };

  let check_passphrase_changed = async () => {
    let longids = Object.keys(missing_or_wrong_passprases);
    let updated_passphrases = await Promise.all(longids.map(longid => Store.passphrase_get(account_email, longid)));
    for (let longid of longids) {
      if ((missing_or_wrong_passprases[longid] || null) !== updated_passphrases[longids.indexOf(longid)]) {
        missing_or_wrong_passprases = {};
        clearInterval(passphrase_interval);
        await decrypt_and_render();
        return;
      }
    }
  };

  let render_password_encrypted_message_load_fail = async (link_result: ApirFcLinkMessage) => {
    if (link_result.expired) {
      let expiration_m = Lang.pgp_block.message_expired_on + tool.time.expiration_format(link_result.expire) + '. ' + Lang.pgp_block.messages_dont_expire + '\n\n';
      if (link_result.deleted) {
        expiration_m += Lang.pgp_block.message_destroyed;
      } else if (url_params.is_outgoing && admin_codes) {
        expiration_m += '<div class="button gray2 extend_expiration">renew message</div>';
      } else if (!url_params.is_outgoing) {
        expiration_m += Lang.pgp_block.ask_sender_renew;
      }
      expiration_m += '\n\n<div class="button gray2 action_security">security settings</div>';
      await render_error(expiration_m, null);
      set_frame_color('gray');
      $('.action_security').click(tool.ui.event.handle(() => tool.browser.message.send(null, 'settings', {page: '/chrome/settings/modules/security.htm'})));
      $('.extend_expiration').click(tool.ui.event.handle(render_message_expiration_renew_options));
    } else if (!link_result.url) {
      await render_error(Lang.pgp_block.cannot_locate + Lang.pgp_block.broken_link);
    } else {
      await render_error(Lang.pgp_block.cannot_locate + Lang.general.write_me_to_fix_it + ' Details:\n\n' + tool.str.html_escape(JSON.stringify(link_result)));
    }
  };

  let initialize = async (force_pull_message_from_api=false) => {
    try {
      if (can_read_emails && url_params.message && url_params.signature === true) {
        render_text('Loading signature...');
        let result = await tool.api.gmail.message_get(account_email, url_params.message_id as string, 'raw');
        if (!result.raw) {
          await decrypt_and_render();
        } else {
          message_fetched_from_api = 'raw';
          let mime_message = tool.str.base64url_decode(result.raw);
          let parsed = tool.mime.signed(mime_message);
          if (parsed) {
            url_params.signature = parsed.signature;
            url_params.message = parsed.signed;
            await decrypt_and_render();
          } else {
            let decoded = await tool.mime.decode(mime_message);
            url_params.signature = decoded.signature;
            console.info('%c[___START___ PROBLEM PARSING THIS MESSSAGE WITH DETACHED SIGNATURE]', 'color: red; font-weight: bold;');
            console.info(mime_message);
            console.info('%c[___END___ PROBLEM PARSING THIS MESSSAGE WITH DETACHED SIGNATURE]', 'color: red; font-weight: bold;');
            await decrypt_and_render();
          }
        }
      } else if (url_params.message && !force_pull_message_from_api) { // ascii armored message supplied
        render_text(url_params.signature ? 'Verifying..' : 'Decrypting...');
        await decrypt_and_render();
      } else if (!url_params.message && url_params.has_password && url_params.short) { // need to fetch the message from FlowCrypt API
        render_text('Loading message...');
        await recover_stored_admin_codes();
        let m_link_result = await tool.api.cryptup.link_message(url_params.short as string);
        password_message_link_result = m_link_result;
        if (m_link_result.url) {
          let download_uint_result = await tool.file.download_as_uint8(m_link_result.url, null);
          url_params.message = tool.str.from_uint8(download_uint_result);
          await decrypt_and_render();
        } else {
          await render_password_encrypted_message_load_fail(password_message_link_result);
        }
      } else {  // need to fetch the inline signed + armored or encrypted +armored message block from gmail api
        if (can_read_emails) {
          render_text('Retrieving message...');
          let format: GmailApiResponseFormat = (!message_fetched_from_api) ? 'full' : 'raw';
          url_params.message = await tool.api.gmail.extract_armored_block(account_email, url_params.message_id as string, format);
          render_text('Decrypting...');
          message_fetched_from_api = format;
          await decrypt_and_render();
        } else { // gmail message read auth not allowed
          sanitize_and_render_html('This encrypted message is very large (possibly containing an attachment). Your browser needs to access gmail it in order to decrypt and display the message.<br/><br/><br/><div class="button green auth_settings">Add missing permission</div>');
          $('.auth_settings').click(tool.ui.event.handle(() => tool.browser.message.send(null, 'settings', { account_email, page: '/chrome/settings/modules/auth_denied.htm' })));
        }
      }
    } catch (e) {
      if (tool.api.error.is_network_error(e)) {
        await render_error(`Could not load message due to network error. ${tool.ui.retry_link()}`);
      } else if(tool.api.error.is_auth_popup_needed(e)) {
        tool.browser.message.send(parent_tab_id, 'notification_show_auth_popup_needed', {account_email});
        await render_error(`Could not load message due to missing auth. ${tool.ui.retry_link()}`);
      } else if (tool.value(tool.crypto.armor.headers('public_key').end as string).in(e.data)) { // public key .end is always string
        window.location.href = tool.env.url_create('pgp_pubkey.htm', { armored_pubkey: e.data, minimized: Boolean(url_params.is_outgoing), account_email, parent_tab_id, frame_id: url_params.frame_id });
      } else if (typeof e === 'object' && e.internal === 'format') {
        await render_error(Lang.pgp_block.cant_open + Lang.pgp_block.dont_know_how_open + '\n\n' + String(e), e.data);
      } else {
        tool.catch.handle_exception(e);
        await render_error(String(e));
      }
    }
  };

  let storage = await Store.get_account(account_email, ['setup_done', 'google_token_scopes']);
  can_read_emails = tool.api.gmail.has_scope(storage.google_token_scopes || [], 'read');
  if (storage.setup_done) {
    await initialize();
  } else {
    await render_error(Lang.pgp_block.refresh_window, url_params.message as string || '');
  }

})();
