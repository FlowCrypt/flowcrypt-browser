/* Business Source License 1.0 © 2016 Tom James Holub (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/tomholub/cryptup-chrome/tree/master/src/LICENCE */

'use strict';

function gmail_element_replacer(factory, account_email, addresses, can_read_emails) {

  function everything() {
    replace_armored_blocks();
    replace_pgp_attachments();
    replace_cryptup_tags();
    replace_conversation_buttons();
    replace_standard_reply_box();
  }

  function replace_armored_blocks() { // todo - most of this could be optimized by using .indexOf instead of RegExp, but it might result in ugly code
    $("div.adP.adO div.a3s:contains('" + tool.crypto.armor.headers().begin + "')").not('.evaluated').each(function () { // for each email that contains PGP block
      $(this).addClass('evaluated');
      var message_id = determine_message_id('message', this);
      var sender_email = get_sender_email(this);
      var is_outgoing = tool.value(sender_email).in(addresses);
      var replacement = tool.crypto.armor.replace_blocks(factory, this.innerText, message_id, sender_email, is_outgoing);
      if(typeof replacement !== 'undefined') {
        $('.adI').css('display', 'none'); // hide translate prompt
        $(this).html(replacement.replace(/\n/g, '<br>'));
      }
    });
  }

  function add_cryptup_conversation_icon(container_selector, icon_html, icon_selector, on_click) {
      container_selector.addClass('appended').children('.use_secure_reply, .show_original_conversation').remove(); // remove previous cryptup buttons, if any
      container_selector.append(icon_html).children(icon_selector).off().click(tool.ui.event.prevent(tool.ui.event.double(), catcher.try(on_click)));
  }

  function replace_conversation_buttons(force) {
    var convo_upper_icons = $('div.ade:visible');
    var use_encryption_in_this_convo = $('iframe.pgp_block').filter(':visible').length || force;
    var visible_reply_buttons = $('td.acX:visible');
    // reply buttons
    if(use_encryption_in_this_convo) {
      if(visible_reply_buttons.not('.replaced').length) { // last reply button in convo gets replaced
        var conversation_reply_buttons_to_replace = visible_reply_buttons.not('.replaced');
        var has_visible_replacements = visible_reply_buttons.filter('.replaced').length > 0;
        conversation_reply_buttons_to_replace.addClass('replaced').each(function (i, reply_button) {
          if(i + 1 < conversation_reply_buttons_to_replace.length || has_visible_replacements) {
            $(reply_button).addClass('replaced').html(''); // hide all except last
          } else {
            $(reply_button).html(factory.button.reply()).click(tool.ui.event.prevent(tool.ui.event.double(), catcher.try(set_reply_box_editable))); // replace last
          }
        });
      }
    }
    // conversation top-right icon buttons
    if(convo_upper_icons.length) {
      if(use_encryption_in_this_convo) {
        if(!convo_upper_icons.is('.appended') || convo_upper_icons.find('.use_secure_reply').length) { // either not appended, or appended icon is outdated (convo switched to encrypted)
          add_cryptup_conversation_icon(convo_upper_icons, factory.button.without_cryptup(), '.show_original_conversation', function () {
            convo_upper_icons.find('.gZ').click();
          });
        }
      } else {
        if(!convo_upper_icons.is('.appended')) {
          add_cryptup_conversation_icon(convo_upper_icons, factory.button.with_cryptup(), '.use_secure_reply', function() {
            replace_conversation_buttons(true);
            replace_standard_reply_box(true, true);
          });
        }
      }
    }
  }

  function replace_cryptup_tags() {
    $("div[contenteditable='true']:contains('[cryptup:link:')").not('.evaluated').each(function () {
      $(this).addClass('evaluated');
      // todo - extremely distastful coding, should use regex match
      var button = '';
      var button_href_id = undefined;
      $(this).html().replace(/\[cryptup:link:([a-z_]+):([0-9a-fr\-]+)\]/g, function (full_link, name, id) {
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
      $('a.open_draft').click(catcher.try(function () {
        $('div.new_message').remove();
        $('body').append(factory.embedded.compose(button_href_id));
      }));
    });
  }

  function determine_message_id(base_element_type, my_element) {
    var selectors = {
      message: $(my_element).parents('div.adP.adO'),
      attachment: $(my_element).parent().siblings('div.adP.adO'),
    };
    var message_id = null; // todo: maybe need to traverse through all children elements classes of the whole message to get to /^m([0-9a-f]{16})$/ - as a backup
    var found = [selectors[base_element_type].get(0), selectors[base_element_type].find('div.a3s').get(0)];
    var classes = [].concat(found[0] ? tool.arr.from_dome_node_list(found[0].classList) : [], found[1] ? tool.arr.from_dome_node_list(found[1].classList) : []);
    $.each(classes, function (i, message_class) {
      var match = message_class.match(/^m([0-9a-f]{16})$/);
      if(match) {
        message_id = match[1];
        return false;
      }
    });
    return message_id || '';
  }

  function replace_pgp_attachments() {
    var selectors = get_attachments_selectors(null, ['*.pgp', '*.gpg', '*.asc', 'noname', 'message']);
    $(selectors.container).each(function () {
      var new_pgp_messages = $(this).children(selectors.attachments).not('.evaluated');
      if(new_pgp_messages.length) {
        new_pgp_messages.addClass('evaluated');
        var attachment_container_classes = tool.arr.from_dome_node_list(new_pgp_messages.get(0).classList);
        var message_id = determine_message_id('attachment', this);
        if(message_id) {
          if(can_read_emails) {
            $(new_pgp_messages).prepend(factory.embedded.attachment_status('Getting file info..' + tool.ui.spinner('green')));
            $(this).addClass('message_id_' + message_id);
            tool.browser.message.send(null, 'list_pgp_attachments', { account_email: account_email, message_id: message_id, }, function (response) {
              catcher.try(function () {
                if(response.success) {
                  // todo - too much clutter. All attachments should be just received in one array, each with an attribute that differentiates the type
                  if(response.attachments && response.attachments.length) {
                    replace_pgp_attachments_in_message(message_id, attachment_container_classes, response.attachments);
                  }
                  if(response.messages && response.messages.length) {
                    hide_pgp_attached_message_and_append_as_text(message_id, attachment_container_classes, response.messages);
                  }
                  if(response.hide && response.hide.length) {
                    hide_pgp_meaningless_attachments(message_id, attachment_container_classes, response.hide);
                  }
                  if(response.pubkeys && response.pubkeys.length) {
                    hide_pgp_attached_pubkey_and_append_to_text(message_id, attachment_container_classes, response.pubkeys);
                  }
                  if(response.signatures && response.signatures.length) {
                    hide_pgp_attached_signatures_and_handle(message_id, attachment_container_classes, response.signatures);
                  }
                  if($('.message_id_' + message_id + ' .attachment_loader').length && $('.m' + message_id + ' .gmail_drive_chip, .m' + message_id + ' a[href^="https://drive.google.com/file"]').length) {
                    // replace google drive attachments - they do not get returned by Gmail API thus did not get replaced above
                    var google_drive_attachments = [];
                    $('.message_id_' + message_id + ' .attachment_loader').each(function (i, loader_element) {
                      var meta = $(loader_element).parent().attr('download_url').split(':');
                      google_drive_attachments.push({ message_id: message_id, name: meta[1], type: meta[0], url: meta[2] + ':' + meta[3], });
                    });
                    replace_pgp_attachments_in_message(message_id, attachment_container_classes, google_drive_attachments);
                  }
                } else {
                  //todo: show button to retry
                }
              })();
            });
          } else {
            var status_message = 'Missing Gmail permission to decrypt attachments. <a href="#" class="auth_settings">Settings</a></div>';
            $(new_pgp_messages).prepend(factory.embedded.attachment_status(status_message)).children('a.auth_settings').click(catcher.try(function () {
              tool.browser.message.send(null, 'settings', { account_email: account_email, page: '/chrome/settings/modules/auth_denied.htm' });
            }));
          }
        }
      }
    });
  }

  function get_attachments_selectors(message_id, file_name_filters) {
    var attachments = [];
    var container_selector = 'div.aQH';
    if(message_id) {
      container_selector += '.message_id_' + message_id;
    }
    $.each(file_name_filters, function (i, file_name_filter) {
      var filter = file_name_filter.indexOf('*.') === 0 ? file_name_filter.substr(1) : ':' + file_name_filter;
      attachments.push(((message_id) ? (container_selector + ' > ') : '') + 'span[download_url*="' + filter.replace(/@/g, '%40') + ':https"]');
    });
    return { container: container_selector, attachments: attachments.join(', '), };
  }

  function hide_attachments(attachments_selector, attachments_length) {
    if($(attachments_selector).length === attachments_length) {
      // only hide original attachments if we found the same amount of them in raw email
      // can cause duplicate attachments (one original encrypted + one decryptable), but should never result in lost attachments
      $(attachments_selector).css('display', 'none');
    } else {
      $(attachments_selector).children('.attachment_loader').text('Missing file info');
    }
  }

  function replace_pgp_attachments_in_message(message_id, classes, attachments) {
    var selectors = get_attachments_selectors(message_id, ['*.pgp', '*.gpg']);
    hide_attachments(selectors.attachments, attachments.length);
    $.each(attachments, function (i, attachment) {
      $(selectors.container).prepend(factory.embedded.attachment(attachment, classes));
    });
  }

  function get_message_body_element(message_id) {
    return $('div.a3s.m' + message_id);
  }

  function get_sender_email(message_element) {
    return ($(message_element).closest('.gs').find('span.gD').attr('email') || '').toLowerCase();
  }

  function hide_pgp_attached_pubkey_and_append_to_text(message_id, classes, attachments) {
    tool.api.gmail.fetch_attachments(account_email, attachments, function (success, downloaded_attachments) {
      catcher.try(function () {
        if(success) {
          var message_element = get_message_body_element(message_id);
          var is_outgoing = tool.value(get_sender_email(message_element)).in(addresses);
          $.each(downloaded_attachments, function (i, downloaded_attachment) {
            catcher.try(function () {
              var armored_key = tool.str.base64url_decode(downloaded_attachment.data);
              var selector = get_attachments_selectors(message_id, [downloaded_attachment.name]).attachments;
              if(tool.value(tool.crypto.armor.headers().begin).in(armored_key)) {
                //todo - this approach below is what should be done in every similar function - hide them by exact names, one by one
                hide_attachments(selector, 1);
                message_element.append(factory.embedded.pubkey(armored_key, is_outgoing));
              } else {
                $(selector).children('.attachment_loader').text('Unknown encryption format');
              }
            })();
          });
        } else {
          // todo - render error + retry button
        }
      })();
    });
  }

  function hide_pgp_attached_message_and_append_as_text(message_id, classes, attachments) {
    var selectors = get_attachments_selectors(message_id, ['*.asc', 'message']);
    hide_attachments(selectors.attachments, attachments.length);
    $('span.aVW').css('display', 'none'); // no clue what this is
    var message_element = get_message_body_element(message_id);
    message_element.append(factory.embedded.message('', message_id, false, get_sender_email(message_element), false)).css('display', 'block');
  }

  function hide_pgp_attached_signatures_and_handle(message_id, classes, attachments) {
    var selectors = get_attachments_selectors(message_id, ['signature.asc']);
    hide_attachments(selectors.attachments, attachments.length);
    var message_element = get_message_body_element(message_id);
    $('span.aVW').css('display', 'none'); // no clue what this is
    var embedded = factory.embedded.message(tool.str.normalize_spaces(message_element[0].innerText).trim(), message_id, false, get_sender_email(message_element), false, true);
    if(!message_element.is('.evaluated') && !tool.value(tool.crypto.armor.headers(null).begin).in(message_element.text())) {
      message_element.addClass('evaluated');
      message_element.html(embedded).css('display', 'block');
    } else {
      message_element.append(embedded).css('display', 'block');
    }
  }

  function hide_pgp_meaningless_attachments(message_id, classes, attachments) {
    var selectors = get_attachments_selectors(message_id, ['noname']);
    hide_attachments(selectors.attachments, attachments.length);
  }

  function get_conversation_params(conversation_root_element) {
    var thread_match = /\/([0-9a-f]{16})/g.exec(window.location);
    if(thread_match !== null) {
      var thread_id = thread_match[1];
      var thread_message_id = thread_match[1];
    } else { // sometimes won't work, that's why the else
      var thread_id = '';
      var thread_message_id = determine_message_id('message', conversation_root_element.find('div.a3s.evaluated'));
    }
    var reply_to_estimate = [conversation_root_element.find('h3.iw span[email]').last().attr('email').trim().toLowerCase()]; // add original sender
    var reply_to = [];
    conversation_root_element.find('span.hb').last().find('span.g2').each(function () {
      reply_to_estimate.push($(this).attr('email').toLowerCase()); // add all recipients including me
    });
    var my_email = account_email;
    $.each(reply_to_estimate, function (i, email) {
      if(tool.value(tool.str.trim_lower(email)).in(addresses)) { // my email
        my_email = email;
      } else if(!tool.value(tool.str.trim_lower(email)).in(reply_to)) { // skip duplicates
        reply_to.push(tool.str.trim_lower(email)); // reply to all except my emails
      }
    });
    if(!reply_to.length) { // happens when user sends email to itself - all reply_to_estimage contained his own emails and got removed
      reply_to = tool.arr.unique(reply_to_estimate);
    }
    return {
      subject: $(conversation_root_element).find('h2.hP').text(),
      reply_to: reply_to,
      addresses: addresses,
      my_email: my_email,
      thread_id: thread_id,
      thread_message_id: thread_message_id,
    };
  }

  function get_conversation_root_element(any_inner_element) {
    return $(any_inner_element).closest('div.if, td.Bu').first();
  }

  function replace_standard_reply_box(editable, force) {
    $('div.nr.tMHS5d, div.gA td.I5').not('.reply_message_iframe_container').filter(':visible').first().each(function (i, reply_box) {
      var root_element = get_conversation_root_element(reply_box);
      if(root_element.find('iframe.pgp_block').filter(':visible').length || (root_element.is(':visible') && force)) {
        var iframe = factory.embedded.reply(get_conversation_params(root_element), editable);
        $(reply_box).addClass('remove_borders').addClass('reply_message_iframe_container').append(iframe).children(':not(iframe)').css('display', 'none');
      }
    });
  }

  function set_reply_box_editable() {
    var reply_container_iframe = $('.reply_message_iframe_container > iframe').first();
    if(reply_container_iframe.length) {
      var conversation_params = get_conversation_params(get_conversation_root_element(reply_container_iframe[0]));
      tool.ui.scroll(reply_container_iframe);
      reply_container_iframe.replaceWith(factory.embedded.reply(conversation_params, true));
    } else {
      replace_standard_reply_box(true);
    }
  }

  function reinsert_reply_box(subject, my_email, reply_to, thread_id) {
    var params = { subject: subject, reply_to: reply_to, addresses: addresses, my_email: my_email, thread_id: thread_id, thread_message_id: thread_id };
    $('.reply_message_iframe_container').append(factory.embedded.reply(params, false, true));
  }

  return {
    everything: everything,
    set_reply_box_editable: set_reply_box_editable,
    reinsert_reply_box: reinsert_reply_box,
  };

}
