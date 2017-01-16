'use strict';


function init_elements_replace_js() {

  var GMAIL_READ_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

  window.replace_pgp_elements = function(account_email, addresses, can_read_emails, gmail_tab_id) {
    if(replace_armored_blocks(account_email, addresses, gmail_tab_id)) {
      $('.adI').css('display', 'none'); //todo - this should be moved elsehwere. (hides translate prompt)
    }
    replace_pgp_attachments(account_email, can_read_emails, gmail_tab_id);
    replace_cryptup_tags(account_email, gmail_tab_id);
    replace_reply_buttons(account_email, gmail_tab_id);
    replace_standard_reply_box(account_email, gmail_tab_id);
  };

  window.replace_armored_blocks = function(account_email, addresses, gmail_tab_id) { // todo - most of this could be optimized by using .indexOf instead of RegExp, but it might result in ugly code
    var conversation_has_new_pgp_message = false;
    $("div.adP.adO div.a3s:contains('-----BEGIN')").not('.evaluated').each(function() { // for each email that contains PGP block
      $(this).addClass('evaluated');
      var html = $(this).html();
      var text = this.innerText.replace(RegExp(String.fromCharCode(160), 'g'), String.fromCharCode(32)).replace(/\n /g, '\n');
      var message_id = parse_message_id_from('message', this);
      var sender_email = $(this).closest('.gs').find('span.gD').attr('email');
      var is_outgoing = addresses.indexOf(sender_email) !== -1;
      var blocks = [];
      if(text.indexOf('-----BEGIN PGP PUBLIC KEY BLOCK-----') !== -1) {
        var has_pubkey_end = (text.indexOf('-----END PGP PUBLIC KEY BLOCK-----') !== -1);
        $.each(text.match(RegExp('-----BEGIN PGP PUBLIC KEY BLOCK-----[^]+' + ((has_pubkey_end) ? '?-----END PGP PUBLIC KEY BLOCK-----' : ''), 'mg')), function(i, armored) {
          blocks.push(pgp_pubkey_iframe(account_email, armored, is_outgoing, gmail_tab_id));
        });
      }
      if(text.indexOf('-----BEGIN ATTEST PACKET-----') !== -1 && text.indexOf('-----END ATTEST PACKET-----') !== -1) {
        $.each(text.match(/-----BEGIN ATTEST PACKET-----[^]+?-----END ATTEST PACKET-----/mg), function(i, armored) {
          chrome_message_send(null, 'attest_packet_received', {
            account_email: account_email,
            packet: armored,
          });
          //todo - can show result of attestation iframe
          blocks.push('You received this attest message to confirm your email eddress. Attest message processed, no further action needed.');
        });
      }
      if(text.indexOf('-----BEGIN PGP SIGNED MESSAGE-----') !== -1 && text.indexOf('-----END PGP SIGNATURE-----') !== -1) { //todo - what if the end was clipped by gmail
        $.each(text.match(/-----BEGIN PGP SIGNED MESSAGE-----[^]+?-----BEGIN PGP SIGNATURE-----[^]+-----END PGP SIGNATURE-----/mg), function(i, armored) {
          blocks.push(pgp_block_iframe(armored, '', account_email, message_id, is_outgoing, sender_email, gmail_tab_id));
        });
      }
      var has_pgp_end = text.indexOf('-----END PGP MESSAGE-----') !== -1;
      var has_gmail_crop = html.indexOf('<a class="vem"') !== -1;
      if(text.indexOf('-----BEGIN PGP MESSAGE-----') !== -1 && (has_pgp_end || has_gmail_crop)) {
        var question = extract_pgp_question(html);
        $.each(text.match(RegExp('-----BEGIN PGP MESSAGE-----[^]+' + ((has_pgp_end) ? '?-----END PGP MESSAGE-----' : ''), 'mg')), function(i, armored) {
          blocks.push(pgp_block_iframe((armored.indexOf('-----END PGP MESSAGE-----') !== -1) ? armored : '', question, account_email, message_id, is_outgoing, sender_email, gmail_tab_id));
        });
        conversation_has_new_pgp_message = true;
      }
      if(blocks.length) {
        $(this).html(blocks.join('<br/><br/><br/>'));
      }
    });
    return conversation_has_new_pgp_message;
  }

  window.replace_reply_buttons = function(account_email, gmail_tab_id, force) {
    if($('iframe.pgp_block').filter(':visible').length || force) { // if convo has pgp blocks
      if(!$('td.acX.replaced').length) { // last reply button in convo gets replaced
        //todo - button below should be in factory.js
        var reply_button = '<div class="' + destroyable_class + ' reply_message_button"><i class="fa fa-mail-reply"></i></div>';
        $('td.acX').not('.replaced').last().addClass('replaced').html(reply_button).click(Try(function() {
          set_reply_box_editable(account_email, gmail_tab_id);
        }));
      } else { // all others get removed
        $('td.acX').not('.replaced').each(function() {
          $(this).addClass('replaced').html('');
        });
      }
    } else if(!$('div.ade:visible').is('.appended')) {
      //todo - button below should be in factory.js
      $('div.ade').not('.appended').addClass('appended').append('<span class="hk J-J5-Ji use_secure_reply ' + destroyable_class + '" data-tooltip="Use Secure Reply"><img src="' + get_logo_src(true, 16) + '"/></span>');
      $('div.ade.appended span.use_secure_reply').click(Try(function() {
        replace_reply_buttons(account_email, gmail_tab_id, true);
        replace_standard_reply_box(account_email, gmail_tab_id, true, true);
      }));
    }
  };

  window.replace_cryptup_tags = function(account_email, gmail_tab_id) {
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
      $('a.open_draft').click(Try(function() {
        $('div.new_message').remove();
        $('body').append(compose_message_iframe(account_email, gmail_tab_id, button_href_id));
      }));
    });
  };

  window.extract_pgp_question = function(message_html) {
    var re_pgp_question = /<a href="(https\:\/\/cryptup\.org\/decrypt[^"]+)"[^>]+>.+<\/a>/m;
    var question_match = message_html.match(re_pgp_question);
    if(question_match !== null) {
      return inner_text(get_url_params(['question'], question_match[1].split('?', 2)[1]).question);
    }
  };

  window.parse_message_id_from = function(element_type, my_element) {
    var selectors = {
      'message': $(my_element).parents('div.adP.adO'),
      'attachment': $(my_element).parent().siblings('div.adP.adO'),
    };
    var message_id = null; // todo: maybe need to traverse through all children elements classes of the whole message to get to /^m([0-9a-f]{16})$/ - as a backup
    var found = [selectors[element_type].get(0), selectors[element_type].find('div.a3s').get(0)];
    var classes = [].concat(found[0] ? to_array(found[0].classList) : [], found[1] ? to_array(found[1].classList) : []);
    $.each(classes, function(i, message_class) {
      var match = message_class.match(/^m([0-9a-f]{16})$/);
      if(match) {
        message_id = match[1];
        return false;
      }
    });
    return message_id || '';
  };

  window.replace_pgp_attachments = function(account_email, can_read_emails, gmail_tab_id) {
    var selectors = get_attachments_selectors(null, ['.pgp', '.gpg', '.asc', 'noname']);
    $(selectors.container).each(function() {
      var new_pgp_messages = $(this).children(selectors.attachments).not('.evaluated');
      if(new_pgp_messages.length) {
        new_pgp_messages.addClass('evaluated');
        var attachment_container_classes = new_pgp_messages.get(0).classList;
        var message_id = parse_message_id_from('attachment', this);
        if(message_id) {
          if(can_read_emails) {
            $(new_pgp_messages).prepend('<div class="attachment_loader">Getting file info..' + get_spinner() + '</div>');
            $(this).addClass('message_id_' + message_id);
            chrome_message_send(null, 'list_pgp_attachments', {
              account_email: account_email,
              message_id: message_id,
            }, function(response) {
              Try(function() {
                if(response.success) {
                  if(response.attachments && response.attachments.length) {
                    replace_pgp_attachments_in_message(account_email, message_id, attachment_container_classes, response.attachments, gmail_tab_id);
                  }
                  if(response.messages && response.messages.length) {
                    hide_pgp_attached_message_and_show_as_text(account_email, message_id, attachment_container_classes, response.messages, gmail_tab_id);
                  }
                  if(response.hide && response.hide.length) {
                    hide_pgp_meaningless_attachments(account_email, message_id, attachment_container_classes, response.hide, gmail_tab_id);
                  }
                  if(response.signatures && response.signatures.length) {
                    hide_pgp_attached_signatures_and_handle(account_email, message_id, attachment_container_classes, response.signatures, gmail_tab_id);
                  }
                } else {
                  //todo: show button to retry
                }
              })();
            });
          } else {
            $(new_pgp_messages).prepend('<div class="attachment_loader">Missing Gmail permission to decrypt attachments. <a href="#" class="auth_settings">Settings</a></div>');
            $('.auth_settings').click(Try(function() {
              chrome_message_send(null, 'settings', {
                account_email: account_email,
                page: '/chrome/settings/modules/auth_denied.htm',
              });
            }));
          }
        }
      }
    });
  };

  window.get_attachments_selectors = function(message_id, file_name_ends_array) {
    var attachments = [];
    var container_selector = 'div.aQH';
    if(message_id) {
      container_selector += '.message_id_' + message_id;
    }
    $.each(file_name_ends_array, function(i, file_name_end) {
      attachments.push(((message_id) ? (container_selector + ' > ') : '') + 'span[download_url*="' + file_name_end + ':https"]');
    });
    return {
      container: container_selector,
      attachments: attachments.join(', '),
    };
  };

  window.hide_attachments = function(attachments_selector, attachments_length) {
    if($(attachments_selector).length === attachments_length) {
      // only hide original attachments if we found the same amount of them in raw email
      // can cause duplicate attachments (one original encrypted + one decryptable), but should never result in lost attachments
      $(attachments_selector).css('display', 'none');
    } else {
      $(attachments_selector).children('.attachment_loader').text('Missing file info');
    }
  };

  window.replace_pgp_attachments_in_message = function(account_email, message_id, classes, attachments, gmail_tab_id) {
    var selectors = get_attachments_selectors(message_id, ['.pgp', '.gpg']);
    hide_attachments(selectors.attachments, attachments.length);
    $.each(attachments, function(i, attachment) {
      $(selectors.container).prepend(pgp_attachment_iframe(account_email, attachment, classes, gmail_tab_id));
    });
  };

  window.hide_pgp_attached_message_and_show_as_text = function(account_email, message_id, classes, attachments, gmail_tab_id) {
    var selectors = get_attachments_selectors(message_id, ['.asc']);
    hide_attachments(selectors.attachments, attachments.length);
    if($('div.a3s.m' + message_id + ' iframe').length === 0) {
      $('span.aVW').css('display', 'none');
      $('div.a3s.m' + message_id).css('display', 'block');
      var sender_email = $('div.a3s.m' + message_id).closest('.gs').find('span.gD').attr('email');
      $('div.a3s.m' + message_id).html(pgp_block_iframe('', null, account_email, message_id, false, sender_email, gmail_tab_id));
    }
  };

  window.hide_pgp_attached_signatures_and_handle = function(account_email, message_id, classes, attachments, gmail_tab_id) {
    var selectors = get_attachments_selectors(message_id, ['signature.asc']);
    hide_attachments(selectors.attachments, attachments.length);
    // todo - transfer signature into existing pgp_block, or create a new pgp_block
  };

  window.hide_pgp_meaningless_attachments = function(account_email, message_id, classes, attachments, gmail_tab_id) {
    var selectors = get_attachments_selectors(message_id, ['noname']);
    hide_attachments(selectors.attachments, attachments.length);
  };

  window.get_conversation_params = function(account_email, conversation_root_element, callback) {
    var thread_match = /\/([0-9a-f]{16})/g.exec(window.location);
    if(thread_match !== null) {
      var thread_id = thread_match[1];
      var thread_message_id = thread_match[1];
    } else { // sometimes won't work, that's why the else
      var thread_id = '';
      var thread_message_id = parse_message_id_from('message', conversation_root_element.find('div.a3s.evaluated'));
    }
    var reply_to_estimate = [conversation_root_element.find('h3.iw span[email]').last().attr('email').trim()]; // add original sender
    var reply_to = [];
    conversation_root_element.find('span.hb').last().find('span.g2').each(function() {
      reply_to_estimate.push($(this).attr('email')); // add all recipients including me
    });
    var my_email = account_email;
    account_storage_get(account_email, ['addresses'], function(storage) {
      $.each(reply_to_estimate, function(i, email) {
        storage.addresses = storage.addresses || [account_email];
        if(storage.addresses.indexOf(trim_lower(email)) !== -1) { // my email
          my_email = email;
        } else if(reply_to.indexOf(trim_lower(email)) === -1) { // skip duplicates
          reply_to.push(email); // reply to all except my emails
        }
      });
      if(!reply_to.length) { // happens when user sends email to itself - all reply_to_estimage contained his own emails and got removed
        reply_to = unique(reply_to_estimate);
      }
      callback({
        subject: $(conversation_root_element).find('h2.hP').text(),
        reply_to: reply_to,
        addresses: storage.addresses,
        my_email: my_email,
        thread_id: thread_id,
        thread_message_id: thread_message_id,
      });
    });
  };

  window.get_conversation_root_element = function(any_inner_element) {
    return $(any_inner_element).closest('div.if, td.Bu').first();
  }

  window.replace_standard_reply_box = function(account_email, gmail_tab_id, editable, force) {
    var reply_box = $('div.nr.tMHS5d, div.gA td.I5').not('.reply_message_iframe_container').filter(':visible').first().each(function(i, reply_box) {
      var root_element = get_conversation_root_element(reply_box);
      if(root_element.find('iframe.pgp_block').filter(':visible').length || (root_element.is(':visible') && force)) {
        get_conversation_params(account_email, root_element, function(params) {
          var iframe = reply_message_iframe(account_email, gmail_tab_id, params, editable);
          $(reply_box).addClass('remove_borders').addClass('reply_message_iframe_container').append(iframe).children(':not(iframe)').css('display', 'none');
        });
      }
    });
  };

  window.set_reply_box_editable = function(account_email, gmail_tab_id) {
    var reply_container_iframe_selector = '.reply_message_iframe_container > iframe';
    if($(reply_container_iframe_selector).length) {
      get_conversation_params(account_email, get_conversation_root_element($(reply_container_iframe_selector).get(0)), function(params) {
        $(reply_container_iframe_selector).replaceWith(reply_message_iframe(account_email, gmail_tab_id, params, true));
      });
    } else {
      replace_standard_reply_box(account_email, gmail_tab_id, true);
    }
  }

  window.reinsert_reply_box = function(account_email, gmail_tab_id, subject, my_email, reply_to, thread_id) {
    account_storage_get(account_email, ['addresses'], function(storage) {
      var conversation_params = {
        subject: subject,
        reply_to: reply_to,
        addresses: storage.addresses,
        my_email: my_email,
        thread_id: thread_id,
        thread_message_id: thread_id,
      };
      $('.reply_message_iframe_container').append(reply_message_iframe(account_email, gmail_tab_id, conversation_params, false, true));
    });
  };

}
