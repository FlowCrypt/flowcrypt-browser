'use strict';

var hide_gmail_new_message_in_thread_notification = '<style>.ata-asE { display: none !important; visibility: hidden !important; }</style>';

function get_logo_src(include_header) {
  return (include_header ? 'data:image/png;base64,' : '') + 'iVBORw0KGgoAAAANSUhEUgAAABMAAAAOCAYAAADNGCeJAAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH4AMdAREakDr07QAAAFFJREFUOMtjVOpWYqAWYGFgYGC4W3L3PwMDA4NyjzIjTAKfGDag3KPMyMRARcBCjiZcrqWqywbem7giYnBFAM1cRjtv4kvhhCKD6jmAkZoZHQBF3hzwjZcuRAAAAABJRU5ErkJggg==';
}

function compose_message_iframe(account_email, gmail_tab_id, draft_id) {
  var src = chrome.extension.getURL('chrome/gmail_elements/new_message.htm') +
    '?account_email=' + encodeURIComponent(account_email) +
    '&parent_tab_id=' + encodeURIComponent(gmail_tab_id) +
    '&draft_id=' + encodeURIComponent(draft_id || '');
  return '<div class="new_message" id="new_message"><iframe scrolling="no" src="' + src + '"></iframe></div>'
}

function passphrase_dialog(account_email, type, gmail_tab_id) {
  var src = chrome.extension.getURL('chrome/gmail_elements/passphrase.htm') +
    '?account_email=' + encodeURIComponent(account_email) +
    '&type=' + encodeURIComponent(type) +
    '&parent_tab_id=' + encodeURIComponent(gmail_tab_id);
  return '<div id="cryptup_dialog"><iframe scrolling="no" src="' + src + '"></iframe></div>';
}

function add_pubkey_dialog(account_email, emails, gmail_tab_id) {
  var src = chrome.extension.getURL('chrome/gmail_elements/add_pubkey.htm') +
    '?account_email=' + encodeURIComponent(account_email) +
    '&emails=' + encodeURIComponent(emails.join(',')) +
    '&parent_tab_id=' + encodeURIComponent(gmail_tab_id);
  return '<div id="cryptup_dialog"><iframe class="tall" scrolling="no" src="' + src + '"></iframe></div>';
}

function pgp_attachment_iframe(account_email, attachment_meta, container_classes, gmail_tab_id) {
  var src = chrome.extension.getURL('chrome/gmail_elements/attachment.htm') +
    '?message_id=' + encodeURIComponent(attachment_meta.message_id) +
    '&name=' + encodeURIComponent(attachment_meta.name) +
    '&type=' + encodeURIComponent(attachment_meta.type) +
    '&size=' + encodeURIComponent(attachment_meta.size) +
    '&attachment_id=' + encodeURIComponent(attachment_meta.id) +
    '&account_email=' + encodeURIComponent(account_email) +
    '&parent_tab_id=' + encodeURIComponent(gmail_tab_id);
  return '<span class="pgp_attachment ' + Array.prototype.join.call(container_classes, ' ') + '"><iframe src="' + src + '"></iframe></span>';
}

function pgp_block_iframe(pgp_block_text, question, account_email, message_id, gmail_tab_id) {
  var id = random_string();
  var src = chrome.extension.getURL('chrome/gmail_elements/pgp_block.htm') +
    '?frame_id=frame_' + id +
    '&question=' + encodeURIComponent(question) +
    '&message=' + encodeURIComponent(pgp_block_text) +
    '&account_email=' + encodeURIComponent(account_email) +
    '&message_id=' + encodeURIComponent(message_id) +
    '&parent_tab_id=' + encodeURIComponent(gmail_tab_id);
  return '<iframe class="pgp_block" id="frame_' + id + '" src="' + src + '"></iframe>' + hide_gmail_new_message_in_thread_notification;
}

function pgp_pubkey_iframe(account_email, armored_pubkey, gmail_tab_id) {
  var id = random_string();
  var src = chrome.extension.getURL('chrome/gmail_elements/pgp_pubkey.htm') +
    '?frame_id=frame_' + id +
    '&account_email=' + encodeURIComponent(account_email) +
    '&armored_pubkey=' + encodeURIComponent(armored_pubkey) +
    '&parent_tab_id=' + encodeURIComponent(gmail_tab_id);
  return '<iframe class="pgp_block" id="frame_' + id + '" src="' + src + '"></iframe>';
}

function reply_message_iframe(account_email, gmail_tab_id, my_email, their_email, secondary_emails, subject, skip_click_prompt, ignore_draft) {
  var thread_id = /\/([0-9a-f]{16})/g.exec(window.location)[1]; // could fail? Is it possible to reply on a messagee without being in a certain thread?
  var emails = resolve_from_to(secondary_emails, my_email, their_email);
  var id = random_string();
  var src = chrome.extension.getURL('chrome/gmail_elements/reply_message.htm') +
    '?frame_id=frame_' + id +
    '&to=' + encodeURIComponent(emails.to) +
    '&from=' + encodeURIComponent(emails.from) +
    '&subject=' + encodeURIComponent(subject) +
    '&thread_id=' + encodeURIComponent(thread_id) +
    '&account_email=' + encodeURIComponent(account_email) +
    '&skip_click_prompt=' + encodeURIComponent(Number(Boolean(Number(skip_click_prompt)))) + //todo - would use some rethinking, refactoring, or at least a named function
    '&ignore_draft=' + encodeURIComponent(Number(Boolean(Number(ignore_draft)))) + //these two are to make sure to pass a "1" or "0" in url
    '&parent_tab_id=' + encodeURIComponent(gmail_tab_id);
  return '<iframe class="reply_message" id="frame_' + id + '" src="' + src + '"></iframe>';
}

function resolve_from_to(secondary_emails, my_email, their_email) {
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
}
