'use strict';

function replace_pgp_elements(account_email, gmail_tab_id) {
  // <div id=":30" class="ii gt m15241dbd879bdfb4 adP adO"><div id=":2z" class="a3s" style="overflow: hidden;">-----BEGIN PGP MESSAGE-----<br>
  var new_pgp_block_found = replace_armored_pgp_messages(account_email, gmail_tab_id);
  replace_standard_reply_box(account_email, gmail_tab_id);
  replace_pgp_attachments(account_email, gmail_tab_id);
  replace_pgp_pubkeys(account_email, gmail_tab_id);
  replace_cryptup_tags(account_email, gmail_tab_id);
  replace_reply_buttons(account_email, gmail_tab_id);
}

function replace_reply_buttons(account_email, gmail_tab_id) {
  if($('iframe.pgp_block').length) { // if convo has pgp blocks
    if(!$('td.acX.replaced').length) { // last reply button in convo gets replaced
      var reply_button = '<div class="reply_message_button"><i class="fa fa-mail-reply"></i>&nbsp;<img src="' + get_logo_src(true) + '" /></div>';
      $('td.acX').not('.replaced').last().addClass('replaced').html(reply_button).click(function() {
        set_reply_box_editable(account_email, gmail_tab_id);
      });
    } else { // all others get removed
      $('td.acX').not('.replaced').each(function() {
        $(this).addClass('replaced').html('');
      });
    }
  }
}

function replace_cryptup_tags(account_email, gmail_tab_id) {
  $("div[contenteditable='true']:contains('[cryptup:link:')").not('.evaluated').each(function() {
    $(this).addClass('evaluated');
    // todo - extremely distastful coding, should use regex match
    var button = '';
    var button_href_id = undefined;
    $(this).html().replace(/\[cryptup:link:([a-z_]+):([0-9a-fr\-]+)\]/g, function(full_link, name, id) {
      if(name === 'draft_compose') {
        button = '<a href="#" class="open_draft">Open draft</a>';
        button_href_id = id;
      } else if(name === 'draft_reply') {
        button = '<a href="#inbox/' + id + '">Open draft</a>';
      } else {
        button = $(this).html(); // shows original pgp message
      }
    });
    $(this).replaceWith(button);
    $('a.open_draft').click(function() {
      $('div.new_message').remove();
      $('body').append(compose_message_iframe(account_email, gmail_tab_id, button_href_id));
    });
  });
}

function replace_pgp_pubkeys(account_email, gmail_tab_id) {
  $("div.adP.adO div.a3s:contains('-----BEGIN PGP PUBLIC KEY BLOCK-----'):contains('-----END PGP PUBLIC KEY BLOCK-----')").each(function() {
    var re_pubkey_blocks = /-----BEGIN PGP PUBLIC KEY BLOCK-----(.|[\r?\n])+?-----END PGP PUBLIC KEY BLOCK-----/gm;
    $(this).html($(this).html().replace(/<\/?span( class="il")>/gi, '').replace(re_pubkey_blocks, function(armored_pubkey_match) {
      return pgp_pubkey_iframe(account_email, strip_pgp_armor(armored_pubkey_match), gmail_tab_id);
    }));
  });
}

function replace_armored_pgp_messages(account_email, gmail_tab_id) {
  //todo - should be refactored with $(this).html().replace(re, function() ... ) similar as replace_pgp_pubkeys for brevity
  var conversation_has_new_pgp_message = false;
  $("div.adP.adO div.a3s:contains('-----BEGIN PGP MESSAGE-----')").each(function() {
    var message_text = $(this).html().replace(/<\/?span( class="il")>/gi, '');
    if(message_text.indexOf('-----END PGP MESSAGE-----') !== -1 || message_text.indexOf('<a class="vem"') !== -1) {
      $(this).addClass('has_known_pgp_blocks');
      var text_with_iframes = message_text;
      var re_pgp_blocks = /-----BEGIN PGP MESSAGE-----(.|[\r?\n])+?((-----END PGP MESSAGE-----)|(\[[^\[]+\]((&nbsp;)|( )|(\r?\n))+<a class="vem"[^>]+>[^<]+<\/a>))/gm;
      var re_first_pgp_block = /-----BEGIN PGP MESSAGE-----(.|[\r?\n])+?((-----END PGP MESSAGE-----)|(\[[^\[]+\]((&nbsp;)|( )|(\r?\n))+<a class="vem"[^>]+>[^<]+<\/a>))/m;
      var re_first_pgp_question = /.*<br>\r?\n<a href="(https\:\/\/cryptup\.org\/decrypt[^"]+)"[^>]+>.+<\/a>(<br>\r?\n)+/m;
      var matches;
      while((matches = re_pgp_blocks.exec(message_text)) !== null) {
        var valid_pgp_block = strip_pgp_armor(matches[0]);
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
      conversation_has_new_pgp_message = true;
    }
  });
  return conversation_has_new_pgp_message;
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

function replace_pgp_attachments(account_email, gmail_tab_id) {
  $('div.aQH').each(function() {
    var new_pgp_messages = $(this).children('span[download_url*=".pgp:https"], span[download_url*=".gpg:https"]').not('.evaluated');
    if(new_pgp_messages.length) {
      new_pgp_messages.addClass('evaluated');
      var attachment_container_classes = new_pgp_messages.get(0).classList;
      var message_id = parse_message_id_from('attachment', this);
      if(message_id) {
        $(new_pgp_messages).prepend('<div class="attachment_loader">Getting file info..' + get_spinner() + '</div>');
        chrome_message_send(null, 'list_pgp_attachments', {
          account_email: account_email,
          message_id: message_id,
        }, function(response) {
          if(response.success && response.attachments) {
            replace_pgp_attachments_in_message(account_email, message_id, attachment_container_classes, response.attachments, gmail_tab_id);
          } else {
            //todo: show button to retry
          }
        });
        $(this).addClass('message_id_' + message_id);
      }
    }
  });
}

function replace_pgp_attachments_in_message(account_email, message_id, classes, attachments, gmail_tab_id) {
  var container_selector = 'div.aQH.message_id_' + message_id;
  var pgp_attachments_selector = container_selector + ' > span[download_url*=".pgp:https"], ' + container_selector + ' > span[download_url*=".gpg:https"]';
  if($(pgp_attachments_selector).length === attachments.length) {
    // only hide original attachments if we found the same amount of them in raw email
    // can cause duplicate attachments (one original encrypted + one decryptable), but should never result in lost attachments
    $(pgp_attachments_selector).css('display', 'none');
  } else {
    $(pgp_attachments_selector).children('.attachment_loader').text('Missing file info');
  }
  $.each(attachments, function(i, attachment) {
    $(container_selector).prepend(pgp_attachment_iframe(account_email, attachment, classes, gmail_tab_id));
  });
}

function get_reply_box_params(account_email, callback) {
  var reply_to_estimate = [$('h3.iw span[email]').last().attr('email').trim()]; // add original sender
  var reply_to = [];
  $('span.hb').last().find('span.g2').each(function() {
    reply_to_estimate.push($(this).attr('email')); // add all recipients including me
  });
  var my_email = account_email;
  account_storage_get(account_email, ['addresses'], function(storage) {
    $.each(reply_to_estimate, function(i, email) {
      if(storage.addresses.indexOf(trim_lower(email)) !== -1) { // my email goes separately
        my_email = email;
      } else if(reply_to.indexOf(trim_lower(email)) === -1) { // skip duplicates
        reply_to.push(email); // reply to all except my emails
      }
    });
    if(!reply_to.length) { // happens when user sends email to itself - all reply_to_estimage contained his own emails and got removed
      reply_to = unique(reply_to_estimate);
    }
    callback({
      subject: $('h2.hP').text(),
      reply_to: reply_to,
      addresses: storage.addresses,
      my_email: my_email,
    });
  });
}

function replace_standard_reply_box(account_email, gmail_tab_id, set_editable) {
  if($('div.AO iframe.pgp_block').length && $('h2.hP').first().text() === $('h2.hP').last().text()) { // the first() and last() prevents hidden convos not to trigger replacement (when switching between convos)
    var reply_container_selector = 'div.nr.tMHS5d:not(.reply_message_iframe_container), div.gA td.I5:not(.reply_message_iframe_container)'; //todo - better to choose one of div.nr.tMHS5d parent elements, creates mess
    if($(reply_container_selector).length) {
      get_reply_box_params(account_email, function(params) {
        set_editable = set_editable || $(reply_container_selector)[0].tagName === 'TD';
        var reply_box_iframe = reply_message_iframe(account_email, gmail_tab_id, params.my_email, params.reply_to.join(','), params.addresses, params.subject, set_editable);
        $(reply_container_selector).addClass('remove_borders').addClass('reply_message_iframe_container').html(reply_box_iframe);
      });
    }
  }
}

function set_reply_box_editable(account_email, gmail_tab_id) { // for now replaces secure reply box
  var reply_container_selector = '.reply_message_iframe_container';
  if($(reply_container_selector).length) {
    get_reply_box_params(account_email, function(params) {
      $(reply_container_selector).html(reply_message_iframe(account_email, gmail_tab_id, params.my_email, params.reply_to.join(','), params.addresses, params.subject, true));
    });
  } else {
    replace_standard_reply_box(account_email, gmail_tab_id, true);
  }
}

// function reinsert_reply_box(account_email, gmail_tab_id, last_message_frame_id, last_message_frame_height, my_email, their_email) {
//   $('#' + last_message_frame_id).css('height', last_message_frame_height + 'px');
//   var subject = $('h2.hP').text();
//   account_storage_get(account_email, ['addresses'], function(storage) {
//     var secure_reply_box = reply_message_iframe(account_email, gmail_tab_id, my_email, their_email, storage.addresses, subject);
//     var wrapped_secure_reply_box = '<div class="adn ads" role="listitem" style="padding-left: 40px;">' + secure_reply_box + '</div>';
//     $('div.gA.gt.acV').removeClass('gA').removeClass('gt').removeClass('acV').addClass('adn').addClass('ads').closest('div.nH').append(wrapped_secure_reply_box);
//     // $('div.nH.hx.aHo').append();
//   });
// }
