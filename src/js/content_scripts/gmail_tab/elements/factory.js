/* Business Source License 1.0 © 2016 Tom James Holub (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/tomholub/cryptup-chrome/tree/master/src/LICENCE */

'use strict';

function init_elements_factory_js() {

  var hide_gmail_new_message_in_thread_notification = '<style>.ata-asE { display: none !important; visibility: hidden !important; }</style>';

  window.get_logo_src = function(include_header, size) {
    if(size !== 16) {
      return(include_header ? 'data:image/png;base64,' : '') + 'iVBORw0KGgoAAAANSUhEUgAAABMAAAAOCAYAAADNGCeJAAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH4AMdAREakDr07QAAAFFJREFUOMtjVOpWYqAWYGFgYGC4W3L3PwMDA4NyjzIjTAKfGDag3KPMyMRARcBCjiZcrqWqywbem7giYnBFAM1cRjtv4kvhhCKD6jmAkZoZHQBF3hzwjZcuRAAAAABJRU5ErkJggg==';
    } else {
      return(include_header ? 'data:image/png;base64,' : '') + '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';
    }
  };

  window.compose_message_iframe = function(account_email, gmail_tab_id, draft_id) {
    var src = chrome.extension.getURL('chrome/gmail_elements/new_message.htm') +
      '?account_email=' + encodeURIComponent(account_email) +
      '&parent_tab_id=' + encodeURIComponent(gmail_tab_id) +
      '&draft_id=' + encodeURIComponent(draft_id || '') +
      '&placement=gmail';
    return '<div class="new_message" id="new_message"><iframe class="' + reloadable_class + '" scrolling="no" src="' + src + '"></iframe></div>'
  };

  window.passphrase_dialog = function(account_email, type, longids, gmail_tab_id) {
    var src = chrome.extension.getURL('chrome/gmail_elements/passphrase.htm') +
      '?account_email=' + encodeURIComponent(account_email) +
      '&type=' + encodeURIComponent(type) +
      '&longids=' + encodeURIComponent((longids || []).join(',')) +
      '&parent_tab_id=' + encodeURIComponent(gmail_tab_id);
    return '<div id="cryptup_dialog"><iframe class="medium ' + reloadable_class + '" scrolling="no" src="' + src + '"></iframe></div>';
  };

  window.add_pubkey_dialog_src = function(account_email, emails, gmail_tab_id, placement) {
    return chrome.extension.getURL('chrome/gmail_elements/add_pubkey.htm') +
      '?account_email=' + encodeURIComponent(account_email) +
      '&emails=' + encodeURIComponent(emails.join(',')) +
      '&parent_tab_id=' + encodeURIComponent(gmail_tab_id) +
      '&placement=' + encodeURIComponent(placement);
  };

  window.add_pubkey_dialog = function(account_email, emails, gmail_tab_id) {
    var src = add_pubkey_dialog_src(account_email, emails, gmail_tab_id, 'gmail');
    return '<div id="cryptup_dialog"><iframe class="tall ' + reloadable_class + '" scrolling="no" src="' + src + '"></iframe></div>';
  };

  window.pgp_attachment_iframe = function(account_email, attachment_meta, container_classes, gmail_tab_id) {
    var src = chrome.extension.getURL('chrome/gmail_elements/attachment.htm') +
      '?message_id=' + encodeURIComponent(attachment_meta.message_id) +
      '&name=' + encodeURIComponent(attachment_meta.name) +
      '&type=' + encodeURIComponent(attachment_meta.type) +
      '&size=' + encodeURIComponent(attachment_meta.size) +
      '&attachment_id=' + encodeURIComponent(attachment_meta.id) +
      '&account_email=' + encodeURIComponent(account_email) +
      '&parent_tab_id=' + encodeURIComponent(gmail_tab_id);
    if (typeof reloadable_class === 'undefined') { // todo - needs a better solution. This is because reply_message_iframe calls this from its context
      var reloadable_class = '';
    }
    return '<span class="pgp_attachment ' + Array.prototype.join.call(container_classes, ' ') + '"><iframe class="' + reloadable_class + '" src="' + src + '"></iframe></span>';
  };

  window.pgp_block_iframe = function(pgp_block_text, question, account_email, message_id, is_outgoing, sender_email, gmail_tab_id) {
    var id = random_string();
    var src = chrome.extension.getURL('chrome/gmail_elements/pgp_block.htm') +
      '?frame_id=frame_' + id +
      '&question=' + encodeURIComponent(question || '') +
      '&message=' + encodeURIComponent(pgp_block_text) +
      '&account_email=' + encodeURIComponent(account_email) +
      '&message_id=' + encodeURIComponent(message_id) +
      '&sender_email=' + encodeURIComponent(sender_email) +
      '&is_outgoing=' + encodeURIComponent(Number(Boolean(Number(is_outgoing)))) + //todo - improve/simplify
      '&parent_tab_id=' + encodeURIComponent(gmail_tab_id);
    return '<iframe class="pgp_block ' + reloadable_class + '" id="frame_' + id + '" src="' + src + '"></iframe>' + hide_gmail_new_message_in_thread_notification;
  };

  window.pgp_pubkey_iframe = function(account_email, armored_pubkey, is_outgoing, gmail_tab_id) {
    var id = random_string();
    var src = chrome.extension.getURL('chrome/gmail_elements/pgp_pubkey.htm') +
      '?frame_id=frame_' + id +
      '&account_email=' + encodeURIComponent(account_email) +
      '&armored_pubkey=' + encodeURIComponent(armored_pubkey) +
      '&is_outgoing=' + encodeURIComponent(Number(Boolean(Number(is_outgoing)))) +
      '&parent_tab_id=' + encodeURIComponent(gmail_tab_id);
    return '<iframe class="pgp_block ' + reloadable_class + '" id="frame_' + id + '" src="' + src + '"></iframe>';
  };

  window.reply_message_iframe = function(account_email, gmail_tab_id, conversation_params, skip_click_prompt, ignore_draft) {
    var emails = resolve_from_to(conversation_params.addresses, conversation_params.my_email, conversation_params.reply_to);
    var id = random_string();
    var src = chrome.extension.getURL('chrome/gmail_elements/reply_message.htm') +
      '?frame_id=frame_' + id +
      '&placement=gmail' +
      '&to=' + encodeURIComponent(emails.to) +
      '&from=' + encodeURIComponent(emails.from) +
      '&subject=' + encodeURIComponent(conversation_params.subject) +
      '&thread_id=' + encodeURIComponent(conversation_params.thread_id || '') +
      '&thread_message_id=' + encodeURIComponent(conversation_params.thread_message_id || '') +
      '&account_email=' + encodeURIComponent(account_email) +
      '&skip_click_prompt=' + encodeURIComponent(Number(Boolean(Number(skip_click_prompt)))) + //todo - would use some rethinking, refactoring, or at least a named function
      '&ignore_draft=' + encodeURIComponent(Number(Boolean(Number(ignore_draft)))) + //these two are to make sure to pass a "1" or "0" in url
      '&parent_tab_id=' + encodeURIComponent(gmail_tab_id);
    return '<iframe class="reply_message ' + reloadable_class + '" id="frame_' + id + '" src="' + src + '"></iframe>';
  };

  window.resolve_from_to = function(secondary_emails, my_email, their_email) {
    //when replaying to email I've sent myself, make sure to send it to the other person, and not myself
    if(secondary_emails.indexOf(their_email) === -1) {
      return {
        to: their_email,
        from: my_email
      };
    } else { //replying to myself
      return {
        from: their_email,
        to: my_email
      };
    }
  };

  window.open_new_message = function(account_email, tab_id) {
    if($('div.new_message').length == 0) {
      $('body').append(compose_message_iframe(account_email, tab_id));
    }
  };

}
