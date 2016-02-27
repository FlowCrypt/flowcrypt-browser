'use strict';

function find_and_replace_pgp_messages(account_email, signal_scope) {
  // <div id=":30" class="ii gt m15241dbd879bdfb4 adP adO"><div id=":2z" class="a3s" style="overflow: hidden;">-----BEGIN PGP MESSAGE-----<br>
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
  if(conversation_has_pgp_message) {
    var my_email = $('span.g2').last().attr('email').trim();
    var their_email = $('h3.iw span[email]').last().attr('email').trim();
    var reply_container_selector = "div.nr.tMHS5d:contains('Click here to ')"; //todo - better to choose one of it's parent elements, creates mess
    var subject = $('h2.hP').text();
    $(reply_container_selector).addClass('remove_borders');
    $(reply_container_selector).html(reply_message_iframe(account_email, signal_scope, my_email, their_email, subject));
  }
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

function pgp_block_iframe(parent_container, pgp_block_text, account_email, signal_scope) {
  var id = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  for(var i = 0; i < 5; i++) {
    id += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  var width = $(parent_container).width() - 15;
  var src = chrome.extension.getURL('chrome/gmail_elements/pgp_block.htm') +
    '?frame_id=frame_' + id +
    '&width=' + width.toString() +
    '&message=' + encodeURIComponent(pgp_block_text) +
    '&account_email=' + encodeURIComponent(account_email) +
    '&signal_scope=' + encodeURIComponent(signal_scope);
  return '<iframe class="pgp_block" id="frame_' + id + '" src="' + src + '"></iframe>';
}

function resolve_from_to(account_email, my_email, their_email) { //when replaying to email I've sent myself, make sure to send it to the other person, and not myself
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
