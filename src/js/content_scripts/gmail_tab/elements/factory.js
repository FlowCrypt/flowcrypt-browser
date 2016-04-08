'use strict';

function passphrase_dialog(account_email, type, gmail_tab_id) {
  var src = chrome.extension.getURL('chrome/gmail_elements/passphrase.htm') +
    '?account_email=' + encodeURIComponent(account_email) +
    '&parent_tab_id=' + encodeURIComponent(gmail_tab_id);
  return '<div id="cryptup_dialog"><iframe scrolling="no" src="' + src + '"></iframe></div>';
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
  return '<iframe class="pgp_block" id="frame_' + id + '" src="' + src + '"></iframe>';
}

function reply_message_iframe(account_email, gmail_tab_id, my_email, their_email, secondary_emails, subject) {
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
