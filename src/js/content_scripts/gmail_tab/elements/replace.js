'use strict';

function replace_pgp_elements(account_email, gmail_tab_id) {
  // <div id=":30" class="ii gt m15241dbd879bdfb4 adP adO"><div id=":2z" class="a3s" style="overflow: hidden;">-----BEGIN PGP MESSAGE-----<br>
  var pgp_block_found = replace_armored_pgp_messages(account_email, gmail_tab_id);
  if(pgp_block_found) {
    replace_reply_box(account_email, gmail_tab_id);
  }
  replace_pgp_attachments(account_email, gmail_tab_id);
}

function replace_armored_pgp_messages(account_email, gmail_tab_id) {
  var conversation_has_pgp_message = false;
  var selectors = [
    "div.adP.adO div.a3s:contains('-----BEGIN PGP MESSAGE-----'):contains('-----END PGP MESSAGE-----')",
    "div.adP.adO div.a3s:contains('-----BEGIN PGP MESSAGE-----'):contains('[Message clipped]'):contains('View entire message')"
  ];
  $(selectors.join(', ')).each(function() {
    $(this).addClass('has_known_pgp_blocks');
    var message_text = $(this).html();
    var text_with_iframes = message_text;
    var re_pgp_blocks = /-----BEGIN PGP MESSAGE-----(.|[\r?\n])+?((-----END PGP MESSAGE-----)|(View entire message\<\/a\>))/gm;
    var re_first_pgp_block = /-----BEGIN PGP MESSAGE-----(.|[\r?\n])+?((-----END PGP MESSAGE-----)|(View entire message\<\/a\>))/m;
    var re_first_pgp_question = /.*<br>\r?\n<a href="(https\:\/\/cryptup\.org\/decrypt[^"]+)"[^>]+>.+<\/a>(<br>\r?\n)+/m;
    var matches;
    while((matches = re_pgp_blocks.exec(message_text)) !== null) {
      var valid_pgp_block = strip_tags_from_pgp_message(matches[0]);
      var question_match = re_first_pgp_question.exec(text_with_iframes);
      var question = '';
      if(question_match !== null) {
        var question = window.striptags(get_url_params(['question'], question_match[1].split('?', 2)[1]).question);
        text_with_iframes = text_with_iframes.replace(re_first_pgp_question, '');
      }
      if(valid_pgp_block.indexOf('-----END PGP MESSAGE-----') !== -1) { // complete pgp block
        text_with_iframes = text_with_iframes.replace(re_first_pgp_block, pgp_block_iframe(valid_pgp_block, question, account_email, '', gmail_tab_id));
      } else { // clipped pgp block
        var message_id = parse_message_id_from('message', this);
        text_with_iframes = text_with_iframes.replace(re_first_pgp_block, pgp_block_iframe('', question, account_email, message_id, gmail_tab_id));
      }
    }
    $(this).html(text_with_iframes);
    conversation_has_pgp_message = true;
  });
  return conversation_has_pgp_message;
}

function parse_message_id_from(element_type, my_element) {
  var selectors = {
    'message': $(my_element).parents('div.adP.adO'),
    'attachment': $(my_element).parent().siblings('div.adP.adO')
  };
  var message_id = null;
  $.each(selectors[element_type].get(0).classList, function(i, message_class) {
    var match = message_class.match(/^m([0-9a-f]{16})$/);
    if(match) {
      message_id = match[1];
      return false;
    }
  });
  return message_id;
}

function replace_pgp_attachments(account_email) {
  $('div.aQH').each(function() {
    var new_pgp_messages = $(this).children('span[download_url*=".pgp:https"], span[download_url*=".gpg:https"]').not('.evaluated');
    if(new_pgp_messages.length) {
      new_pgp_messages.addClass('evaluated');
      var attachment_container_classes = new_pgp_messages.get(0).classList;
      var message_id = parse_message_id_from('attachment', this);
      if(message_id) {
        chrome_message_send(null, 'list_pgp_attachments', {
          account_email: account_email,
          message_id: message_id,
        }, function(response) {
          if(response.success && response.attachments) {
            replace_pgp_attachments_in_message(account_email, message_id, attachment_container_classes, response.attachments);
          } else {
            //todo: show button to retry
          }
        });
        $(this).addClass('message_id_' + message_id);
      }
    }
  });
}

function replace_pgp_attachments_in_message(account_email, message_id, classes, attachments) {
  var container_selector = 'div.aQH.message_id_' + message_id;
  var pgp_attachments_selector = container_selector + ' > span[download_url*=".pgp:https"], ' + container_selector + ' > span[download_url*=".gpg:https"]';
  if($(pgp_attachments_selector).length === attachments.length) {
    // only hide original attachments if we found the same amount of them in raw email
    // can cause duplicate attachments (one original encrypted + one decryptable), but should never result in lost attachments
    $(pgp_attachments_selector).css('display', 'none');
  }
  $.each(attachments, function(i, attachment) {
    $(container_selector).prepend(pgp_attachment_iframe(account_email, attachment, classes));
  });
}

function replace_reply_box(account_email, gmail_tab_id) {
  var my_email = $('span.g2').last().attr('email').trim();
  var their_email = $('h3.iw span[email]').last().attr('email').trim();
  var reply_container_selector = "div.nr.tMHS5d:contains('Click here to ')"; //todo - better to choose one of it's parent elements, creates mess
  var subject = $('h2.hP').text();
  $(reply_container_selector).addClass('remove_borders');
  $(reply_container_selector).html(reply_message_iframe(account_email, gmail_tab_id, my_email, their_email, subject));
}

function reinsert_reply_box(account_email, gmail_tab_id, last_message_frame_id, last_message_frame_height, my_email, their_email) {
  $('#' + last_message_frame_id).css('height', last_message_frame_height + 'px');
  var subject = $('h2.hP').text();
  var secure_reply_box = reply_message_iframe(account_email, gmail_tab_id, my_email, their_email, subject);
  var wrapped_secure_reply_box = '<div class="adn ads" role="listitem" style="padding-left: 40px;">' + secure_reply_box + '</div>';
  $('div.gA.gt.acV').removeClass('gA').removeClass('gt').removeClass('acV').addClass('adn').addClass('ads').closest('div.nH').append(wrapped_secure_reply_box);
  // $('div.nH.hx.aHo').append();
}

function strip_tags_from_pgp_message(pgp_block_text) {
  var debug = false;
  if(debug) {
    console.log('pgp_block_1');
    console.log(pgp_block_text);
  }
  var newlines = [/<div><br><\/div>/g, /<\/div><div>/g, /<[bB][rR]( [a-zA-Z]+="[^"]*")* ?\/? ?>/g, /<div ?\/?>/g];
  var spaces = [/&nbsp;/g];
  var removes = [/<wbr ?\/?>/g, /<\/?div>/g];
  $.each(newlines, function(i, newline) {
    pgp_block_text = pgp_block_text.replace(newline, '\n');
  });
  if(debug) {
    console.log('pgp_block_2');
    console.log(pgp_block_text);
  }
  $.each(removes, function(i, remove) {
    pgp_block_text = pgp_block_text.replace(remove, '');
  });
  if(debug) {
    console.log('pgp_block_3');
    console.log(pgp_block_text);
  }
  $.each(spaces, function(i, space) {
    pgp_block_text = pgp_block_text.replace(space, ' ');
  });
  if(debug) {
    console.log('pgp_block_4');
    console.log(pgp_block_text);
  }
  pgp_block_text = pgp_block_text.replace(/\r\n/g, '\n');
  if(debug) {
    console.log('pgp_block_5');
    console.log(pgp_block_text);
  }
  pgp_block_text = $('<div>' + pgp_block_text + '</div>').text();
  if(debug) {
    console.log('pgp_block_6');
    console.log(pgp_block_text);
  }
  var double_newlines = pgp_block_text.match(/\n\n/g);
  if(double_newlines !== null && double_newlines.length > 2) { //a lot of newlines are doubled
    pgp_block_text = pgp_block_text.replace(/\n\n/g, '\n');
    if(debug) {
      console.log('pgp_block_removed_doubles');
    }
  }
  if(debug) {
    console.log('pgp_block_7');
    console.log(pgp_block_text);
  }
  pgp_block_text = pgp_block_text.replace(/^ +/gm, '');
  if(debug) {
    console.log('pgp_block_final');
    console.log(pgp_block_text);
  }
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
