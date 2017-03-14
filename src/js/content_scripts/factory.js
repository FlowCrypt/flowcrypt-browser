/* Business Source License 1.0 © 2016 Tom James Holub (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/tomholub/cryptup-chrome/tree/master/src/LICENCE */

'use strict';

function element_factory(account_email, parent_tab_id, chrome_runtime_id, reloadable_class, destroyable_class) {

  reloadable_class = reloadable_class || '';
  var hide_gmail_new_message_in_thread_notification = '<style>.ata-asE { display: none !important; visibility: hidden !important; }</style>';

  function resolve_from_to(secondary_emails, my_email, their_emails) { //when replaying to email I've sent myself, make sure to send it to the other person, and not myself
    if(their_emails.length === 1 && tool.value(their_emails[0]).in(secondary_emails)) {
      return { from: their_emails[0], to: my_email }; //replying to myself, reverse the values to actually write to them
    }
    return { to: their_emails, from: my_email };
  }

  function src_img(relative_path) {
    if(!chrome_runtime_id) {
      catcher.log('Attempting to load an image without knowing runtime_id: ' + relative_path); // which will probably not work
      return '/img/' + relative_path;
    } else {
      return 'chrome-extension://' + chrome_runtime_id + '/img/' + relative_path;
    }
  }

  function src_logo(include_header, size) {
    if(size !== 16) {
      return(include_header ? 'data:image/png;base64,' : '') + 'iVBORw0KGgoAAAANSUhEUgAAABMAAAAOCAYAAADNGCeJAAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH4AMdAREakDr07QAAAFFJREFUOMtjVOpWYqAWYGFgYGC4W3L3PwMDA4NyjzIjTAKfGDag3KPMyMRARcBCjiZcrqWqywbem7giYnBFAM1cRjtv4kvhhCKD6jmAkZoZHQBF3hzwjZcuRAAAAABJRU5ErkJggg==';
    } else {
      return(include_header ? 'data:image/png;base64,' : '') + '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';
    }
  }

  function src_compose_message(draft_id) {
    var params = { account_email: account_email, parent_tab_id: parent_tab_id, draft_id: draft_id, placement: 'gmail' };
    return tool.env.url_create(chrome.extension.getURL('chrome/elements/new_message.htm'), params);
  }

  function src_passphrase_dialog(longids, type) {
    var params = { account_email: account_email, type: type, longids: longids || [], parent_tab_id: parent_tab_id };
    return tool.env.url_create(chrome.extension.getURL('chrome/elements/passphrase.htm'), params);
  }

  function src_subscribe_dialog(verification_email_text, placement, source, subscribe_result_tab_id) {
    var params = { account_email: account_email, verification_email_text: verification_email_text, placement: placement, source: source, parent_tab_id: parent_tab_id, subscribe_result_tab_id: subscribe_result_tab_id };
    return tool.env.url_create(chrome.extension.getURL('chrome/elements/subscribe.htm'), params);
  }

  function src_attest(attest_packet) {
    var params = { account_email: account_email, attest_packet: attest_packet, parent_tab_id: parent_tab_id };
    return tool.env.url_create(chrome.extension.getURL('chrome/elements/attest.htm'), params);
  }

  function src_add_pubkey_dialog(emails, placement) {
    var params = { account_email: account_email, emails: emails, parent_tab_id: parent_tab_id, placement: placement };
    return tool.env.url_create(chrome.extension.getURL('chrome/elements/add_pubkey.htm'), params);
  }

  function src_add_footer_dialog(placement) {
    var params = { account_email: account_email, parent_tab_id: parent_tab_id, placement: placement };
    return tool.env.url_create(chrome.extension.getURL('chrome/elements/shared/footer.htm'), params);
  }

  function src_pgp_attachment_iframe(meta) {
    var params = { account_email: account_email, message_id: meta.message_id, name: meta.name, type: meta.type, size: meta.size, attachment_id: meta.id, parent_tab_id: parent_tab_id, url: meta.url };
    return tool.env.url_create(chrome.extension.getURL('chrome/elements/attachment.htm'), params);
  }

  function src_pgp_block_iframe(armored, message_id, is_outgoing, sender, has_password, signature) {
    var params = { account_email: account_email, frame_id: 'frame_' + tool.str.random(10), message: armored, has_password: has_password, message_id: message_id, sender_email: sender, is_outgoing: Boolean(is_outgoing), parent_tab_id: parent_tab_id, signature: signature };
    return tool.env.url_create(chrome.extension.getURL('chrome/elements/pgp_block.htm'), params);
  }

  function src_pgp_pubkey_iframe(armored_pubkey, is_outgoing) {
    var params = { account_email: account_email, frame_id: 'frame_' + tool.str.random(10), armored_pubkey: armored_pubkey, minimized: Boolean(is_outgoing), parent_tab_id: parent_tab_id };
    return tool.env.url_create(chrome.extension.getURL('chrome/elements/pgp_pubkey.htm'), params);
  }

  function src_reply_message_iframe(conversation_params, skip_click_prompt, ignore_draft) {
    var headers = resolve_from_to(conversation_params.addresses, conversation_params.my_email, conversation_params.reply_to);
    var params = {
      account_email: account_email,
      frame_id: 'frame_' + tool.str.random(10),
      placement: 'gmail',
      to: headers.to,
      from: headers.from,
      subject: conversation_params.subject,
      thread_id: conversation_params.thread_id,
      thread_message_id: conversation_params.thread_message_id,
      skip_click_prompt: Boolean(skip_click_prompt),
      ignore_draft: Boolean(ignore_draft),
      parent_tab_id: parent_tab_id,
    };
    return tool.env.url_create(chrome.extension.getURL('chrome/elements/reply_message.htm'), params);
  }

  function src_stripe_checkout() {
    return tool.env.url_create('https://cryptup.org/stripe.htm', { parent_tab_id: parent_tab_id });
  }

  function iframe(src, classes, additional_attributes) {
    var attributes = { id: tool.env.url_params(['frame_id'], src).frame_id, class: (classes || []).concat(reloadable_class).join(' '), src: src };
    $.each(additional_attributes, function(a, v) {
      attributes[a] = v;
    });
    return tool.e('iframe', attributes);
  }

  function dialog(content) {
    return tool.e('div', { id: 'cryptup_dialog', html: content });
  }

  return {
    src: {
      img: src_img,
      logo: src_logo,
      compose_message: src_compose_message,
      passphrase_dialog: src_passphrase_dialog,
      subscribe_dialog: src_subscribe_dialog,
      add_pubkey_dialog: src_add_pubkey_dialog,
      add_footer_dialog: src_add_footer_dialog,
      pgp_attachment_iframe: src_pgp_attachment_iframe,
      pgp_block_iframe: src_pgp_block_iframe,
      pgp_pubkey_iframe: src_pgp_pubkey_iframe,
      reply_message_iframe: src_reply_message_iframe,
    },
    meta: {
      notification_container: function() {
        return '<center class="' + destroyable_class + ' webmail_notifications"></center>';
      },
      stylesheet: function(file) {
        return '<link class="' + destroyable_class + '" rel="stylesheet" href="' + chrome.extension.getURL('css/' + file + '.css') + '" />';
      },
    },
    dialog: {
      passphrase: function(longids, type) {
        return dialog(iframe(src_passphrase_dialog(longids, type), ['medium'], {scrolling: 'no'}))
      },
      subscribe: function(verification_email_text, source, subscribe_result_tab_id) {
        return dialog(iframe(src_subscribe_dialog(verification_email_text, 'dialog', source, subscribe_result_tab_id), ['mediumtall'], {scrolling: 'no'}));
      },
      add_pubkey: function(emails) {
        return dialog(iframe(src_add_pubkey_dialog(emails, 'gmail'), ['tall'], {scrolling: 'no'}));
      }
    },
    embedded: {
      compose: function(draft_id) {
        return tool.e('div', {id: 'new_message', class: 'new_message', html: iframe(src_compose_message(draft_id), [], {scrolling: 'no'})});
      },
      subscribe: function(verification_email_text, source) {
        return iframe(src_subscribe_dialog(verification_email_text, 'embedded', source), ['short', 'embedded'], {scrolling: 'no'});
      },
      attachment: function(meta) {
        return tool.e('span', {class: 'pgp_attachment', html: iframe(src_pgp_attachment_iframe(meta))});
      },
      message: function(armored, message_id, is_outgoing, sender, has_password, signature) {
        return iframe(src_pgp_block_iframe(armored, message_id, is_outgoing, sender, has_password, signature), ['pgp_block']) + hide_gmail_new_message_in_thread_notification;
      },
      pubkey: function(armored_pubkey, is_outgoing) {
        return iframe(src_pgp_pubkey_iframe(armored_pubkey, is_outgoing), ['pgp_block']);
      },
      reply: function(conversation_params, skip_click_prompt, ignore_draft) {
        return iframe(src_reply_message_iframe(conversation_params, skip_click_prompt, ignore_draft), ['reply_message']);
      },
      passphrase: function(longids) {
        return dialog(iframe(src_passphrase_dialog(longids, 'embedded'), ['medium'], {scrolling: 'no'}))
      },
      attachment_status: function(content) {
        return tool.e('div', {class: 'attachment_loader', html: content});
      },
      attest: function(attest_packet) {
        return iframe(src_attest(attest_packet), ['short', 'embedded'], {scrolling: 'no'});
      },
      stripe_checkout: function() {
        return iframe(src_stripe_checkout(), [], {sandbox: 'allow-forms allow-scripts allow-same-origin'});
      },
    },
    button: {
      compose: function(webmail_name) {
        if(webmail_name === 'inbox') {
          return '<div class="S ' + destroyable_class + '"><div class="new_message_button y pN oX" tabindex="0"><img src="' + src_logo(true) + '"/></div><label class="bT qV" id="cryptup_compose_button_label"><div class="tv">Secure Compose</div></label></div>';
        } else if(webmail_name === 'outlook') {
          return '<div class="_fce_c ' + destroyable_class + '" role="presentation" style="display: inline;"><div class="new_message_button">secure compose</div></div>';
        } else {
          return '<div class="' + destroyable_class + ' z0"><div class="new_message_button" role="button" tabindex="0">SECURE COMPOSE</div></div>';
        }
      },
      reply: function() {
        return '<div class="' + destroyable_class + ' reply_message_button"><img src="' + src_img('svgs/reply-icon.svg') + '" /></div>';
      },
      without_cryptup: function() {
        return '<span class="hk J-J5-Ji cryptup_convo_button show_original_conversation ' + destroyable_class + '" data-tooltip="Show conversation without CryptUp"><span>see original</span></span>';
      },
      with_cryptup: function() {
        return '<span class="hk J-J5-Ji cryptup_convo_button use_secure_reply ' + destroyable_class + '" data-tooltip="Use Secure Reply"><img src="' + src_logo(true, 16) + '"/></span>';
      },
    }
  };
}
