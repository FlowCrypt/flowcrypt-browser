'use strict';

function find_and_replace_pgp_messages(account_email, signal_scope) {
  // <div id=":30" class="ii gt m15241dbd879bdfb4 adP adO"><div id=":2z" class="a3s" style="overflow: hidden;">-----BEGIN PGP MESSAGE-----<br>
  var pgp_block_found = replace_armored_pgp_messages(account_email, signal_scope);
  if(pgp_block_found) {
    replace_reply_box(account_email, signal_scope);
  }
  replace_pgp_attachments(account_email, signal_scope);
}

function replace_armored_pgp_messages(account_email, signal_scope) {
  var conversation_has_pgp_message = false;
  $("div.adP.adO div.a3s:contains('-----BEGIN PGP MESSAGE-----'):contains('-----END PGP MESSAGE-----')").each(function() {
    var text = $(this).html();
    var text_with_iframes = text;
    var re_pgp_blocks = /-----BEGIN PGP MESSAGE-----(.|[\r\n])+?-----END PGP MESSAGE-----/gm;
    var re_first_pgp_block = /-----BEGIN PGP MESSAGE-----(.|[\r\n])+?-----END PGP MESSAGE-----/m;
    $(this).addClass('has_known_pgp_blocks');
    var matches;
    while((matches = re_pgp_blocks.exec(text)) != null) {
      var valid_pgp_block = strip_tags_from_pgp_message(matches[0]);
      text_with_iframes = text_with_iframes.replace(re_first_pgp_block, pgp_block_iframe(this, valid_pgp_block, account_email, signal_scope));
    }
    $(this).html(text_with_iframes);
    conversation_has_pgp_message = true;
  });
  return conversation_has_pgp_message;
}

function replace_pgp_attachments(account_email, signal_scope) {
  $('div.aQH').not('.evaluated').each(function() {
    $(this).addClass('evaluated');
    if($(this).children('span[download_url*=".pgp:https"], span[download_url*=".gpg:https"]').length) {
      var message_id = null;
      var message_classes = $(this).parent().siblings('div.adP.adO').get(0).classList;
      for(var i in message_classes) {
        var match = message_classes[i].match(/^m([0-9a-f]{16})$/);
        if(match) {
          message_id = match[1];
          break;
        }
      }
      if(message_id) {
        signal_send('background_process', 'list_pgp_attachments_request', {
          account_email: account_email,
          message_id: message_id,
          reply_to_signal_scope: signal_scope_get(),
        }, signal_scope_default_value);
        $(this).addClass('message_id_' + message_id);
      }
    }
  });
}

function list_pgp_attachments_response_handler(signal_data) {
  if(signal_data.success && signal_data.attachments) {
    var container_selector = 'div.aQH.message_id_' + signal_data.message_id;
    var pgp_attachments_selector = container_selector + ' > span[download_url*=".pgp:https"], ' + container_selector + ' > span[download_url*=".gpg:https"]';
    if($(pgp_attachments_selector).length === signal_data.attachments.length) {
      // only hide original attachments if we found the same amount of them in raw email
      // can cause duplicate attachments (one original encrypted + one decryptable), but should never result in lost attachments
      $(pgp_attachments_selector).css('display', 'none');
    }
    for(var i in signal_data.attachments) {
      $(container_selector).append(pgp_attachment_iframe(account_email, signal_data.attachments[i]));
    }
  }
}

function replace_reply_box(account_email, signal_scope) {
  var my_email = $('span.g2').last().attr('email').trim();
  var their_email = $('h3.iw span[email]').last().attr('email').trim();
  var reply_container_selector = "div.nr.tMHS5d:contains('Click here to ')"; //todo - better to choose one of it's parent elements, creates mess
  var subject = $('h2.hP').text();
  $(reply_container_selector).addClass('remove_borders');
  $(reply_container_selector).html(reply_message_iframe(account_email, signal_scope, my_email, their_email, subject));
}

function reinsert_reply_box(account_email, signal_scope, last_message_frame_id, last_message_frame_height, my_email, their_email) {
  $('#' + last_message_frame_id).css('height', last_message_frame_height + 'px');
  var subject = $('h2.hP').text();
  var secure_reply_box = reply_message_iframe(account_email, signal_scope, my_email, their_email, subject);
  var wrapped_secure_reply_box = '<div class="adn ads" role="listitem" style="padding-left: 40px;">' + secure_reply_box + '</div>';
  $('div.gA.gt.acV').removeClass('gA').removeClass('gt').removeClass('acV').addClass('adn').addClass('ads').closest('div.nH').append(wrapped_secure_reply_box);
  // $('div.nH.hx.aHo').append();
}

function strip_tags_from_pgp_message(pgp_block_text) {
  // console.log('pgp_block_1');
  // console.log(pgp_block_text);
  var newline = [/<div><br><\/div>/g, /<\/div><div>/g, /<[bB][rR]( [a-zA-Z]+="[^"]*")* ?\/? ?>/g, /<div ?\/?>/g];
  var space = [/&nbsp;/g];
  var remove = [/<wbr ?\/?>/g, /<\/?div>/g];
  for(var i = 0; i < newline.length; i++) {
    pgp_block_text = pgp_block_text.replace(newline[i], '\n');
  }
  // console.log('pgp_block_2');
  // console.log(pgp_block_text);
  for(var i = 0; i < remove.length; i++) {
    pgp_block_text = pgp_block_text.replace(remove[i], '');
  }
  // console.log('pgp_block_3');
  // console.log(pgp_block_text);
  for(var i = 0; i < space.length; i++) {
    pgp_block_text = pgp_block_text.replace(space[i], ' ');
  }
  // console.log('pgp_block_4');
  // console.log(pgp_block_text);
  pgp_block_text = pgp_block_text.replace(/\r\n/g, '\n');
  // console.log('pgp_block_5');
  // console.log(pgp_block_text);
  pgp_block_text = $('<div>' + pgp_block_text + '</div>').text();
  // console.log('pgp_block_6');
  // console.log(pgp_block_text);
  var double_newlines = pgp_block_text.match(/\n\n/g);
  if(double_newlines !== null && double_newlines.length > 2) { //a lot of newlines are doubled
    pgp_block_text = pgp_block_text.replace(/\n\n/g, '\n');
    // console.log('pgp_block_removed_doubles');
  }
  // console.log('pgp_block_final');
  // console.log(pgp_block_text);
  return pgp_block_text;
}

function resolve_from_to(account_email, my_email, their_email) {
  //when replaying to email I've sent myself, make sure to send it to the other person, and not myself
  //todo: make sure to take all of my secondary emails into account
  if(their_email !== account_email) {
    return {
      to: their_email,
      from: my_email
    }
  }
  return {
    from: their_email,
    to: my_email
  }
}

function pgp_attachment_iframe(account_email, attachment_meta) {
  var src = chrome.extension.getURL('chrome/gmail_elements/attachment.htm') +
    '?message_id=' + encodeURIComponent(attachment_meta.message_id) +
    '&name=' + encodeURIComponent(attachment_meta.name) +
    '&type=' + encodeURIComponent(attachment_meta.type) +
    '&size=' + encodeURIComponent(attachment_meta.size) +
    '&attachment_id=' + encodeURIComponent(attachment_meta.id) +
    '&account_email=' + encodeURIComponent(account_email);
  return '<iframe class="pgp_attachment" src="' + src + '"></iframe>';
}

function pgp_block_iframe(parent_container, pgp_block_text, account_email, signal_scope) {
  var id = random_string();
  var width = $(parent_container).width() - 15;
  var src = chrome.extension.getURL('chrome/gmail_elements/pgp_block.htm') +
    '?frame_id=frame_' + id +
    '&width=' + width.toString() +
    '&message=' + encodeURIComponent(pgp_block_text) +
    '&account_email=' + encodeURIComponent(account_email) +
    '&signal_scope=' + encodeURIComponent(signal_scope);
  return '<iframe class="pgp_block" id="frame_' + id + '" src="' + src + '"></iframe>';
}

function reply_message_iframe(account_email, signal_scope, my_email, their_email, subject) {
  var thread_id = /\/([0-9a-f]{16})/g.exec(window.location)[1]; // could fail? Is it possible to reply on a messagee without being in a certain thread?
  var emails = resolve_from_to(account_email, my_email, their_email);
  var id = random_string();
  var src = chrome.extension.getURL('chrome/gmail_elements/reply_message.htm') +
    '?frame_id=frame_' + id +
    '&to=' + encodeURIComponent(emails['to']) +
    '&from=' + encodeURIComponent(emails['from']) +
    '&subject=' + encodeURIComponent(subject) +
    '&thread_id=' + encodeURIComponent(thread_id) +
    '&account_email=' + encodeURIComponent(account_email) +
    '&signal_scope=' + encodeURIComponent(signal_scope);
  return '<iframe class="reply_message" id="frame_' + id + '" src="' + src + '"></iframe>';
}
