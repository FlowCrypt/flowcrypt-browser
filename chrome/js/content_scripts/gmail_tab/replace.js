/* Business Source License 1.0 © 2016 FlowCrypt Limited (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/CryptUp/cryptup-browser/tree/master/src/LICENCE */

'use strict';

function gmail_element_replacer(factory, account_email, addresses, can_read_emails, injector) {

  var recipient_has_pgp = {}; // undefined: never checked or check faild, null: checking now, true: uses, false: doesn't use

  function everything() {
    replace_armored_blocks();
    replace_attachments();
    replace_cryptup_tags();
    replace_conversation_buttons();
    replace_standard_reply_box();
    evaluate_standard_compose_receivers();
  }

  function replace_armored_blocks() {
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
    tool.each(classes, function (i, message_class) {
      var match = message_class.match(/^m([0-9a-f]{16})$/);
      if(match) {
        message_id = match[1];
        return false;
      }
    });
    return message_id || '';
  }

  function replace_attachments() {
    $('div.aQH').each(function (i, attachments_container) {
      attachments_container = $(attachments_container);
      var new_pgp_attachments = filter_attachments(attachments_container.children().not('.evaluated'), tool.file.pgp_name_patterns()).addClass('evaluated');
      var new_pgp_attachments_names = tool.arr.from_dome_node_list(new_pgp_attachments.find('.aV3')).map(function (x) { return $.trim($(x).text()); });
      if(new_pgp_attachments.length) {
        var message_id = determine_message_id('attachment', attachments_container);
        if(message_id) {
          if(can_read_emails) {
            $(new_pgp_attachments).prepend(factory.embedded.attachment_status('Getting file info..' + tool.ui.spinner('green')));
            tool.api.gmail.message_get(account_email, message_id, 'full', function (success, message) {
              if(success) {
                process_attachments(message_id, tool.api.gmail.find_attachments(message), attachments_container, false, new_pgp_attachments_names);
              } else {
                $(new_pgp_attachments).find('.attachment_loader').text('Failed to load');
              }
            });
          } else {
            var status_message = 'Missing Gmail permission to decrypt attachments. <a href="#" class="auth_settings">Settings</a></div>';
            $(new_pgp_attachments).prepend(factory.embedded.attachment_status(status_message)).children('a.auth_settings').click(catcher.try(function () {
              tool.browser.message.send(null, 'settings', { account_email: account_email, page: '/chrome/settings/modules/auth_denied.htm' });
            }));
          }
        } else {
          $(new_pgp_attachments).prepend(factory.embedded.attachment_status('Unknown message id'));
        }
      }
    });
  }

  function process_attachments(message_id, attachment_metas, attachments_container, skip_google_drive, new_pgp_attachments_names) {
    var message_element = get_message_body_element(message_id);
    var sender_email = get_sender_email(message_element);
    var is_outgoing = tool.value(sender_email).in(addresses);
    attachments_container.parent().find('span.aVW').css('visibility', 'hidden'); // original gmail header showing amount of attachments
    tool.each(attachment_metas, function(i, attachment_meta) {
      if(attachment_meta.treat_as !== 'original') {
        var attachment_selector = filter_attachments(attachments_container.children(), [attachment_meta.name || 'noname']).first();
        hide_attachment(attachment_selector, attachments_container);
        if(attachment_meta.treat_as === 'encrypted') { // actual encrypted attachment - show it
          attachments_container.prepend(factory.embedded.attachment(attachment_meta));
        } else if(attachment_meta.treat_as === 'message') {
          if(!(attachment_meta.name === 'encrypted.asc' && !tool.value(attachment_meta.name).in(new_pgp_attachments_names))) { // prevent doubling of enigmail emails
            message_element.append(factory.embedded.message('', message_id, false, sender_email, false)).css('display', 'block');
          }
        } else if (attachment_meta.treat_as === 'public_key') { // todo - pubkey should be fetched in pgp_pubkey.js
          tool.api.gmail.attachment_get(account_email, message_id, attachment_meta.id, function (success, downloaded_attachment) {
            if(success) {
              var armored_key = tool.str.base64url_decode(downloaded_attachment.data);
              if(tool.value(tool.crypto.armor.headers().begin).in(armored_key)) {
                message_element.append(factory.embedded.pubkey(armored_key, is_outgoing));
              } else {
                attachment_selector.css('display', 'block');
                attachment_selector.children('.attachment_loader').text('Unknown Public Key Format');
              }
            } else {
              attachments_container.find('.attachment_loader').text('Please reload page');
            }
          });
        } else if (attachment_meta.treat_as === 'signature') {
          var signed_content = message_element[0] ? tool.str.normalize_spaces(message_element[0].innerText).trim() : '';
          var embedded_signed_message = factory.embedded.message(signed_content, message_id, false, sender_email, false, true);
          if(!message_element.is('.evaluated') && !tool.value(tool.crypto.armor.headers(null).begin).in(message_element.text())) {
            message_element.addClass('evaluated');
            message_element.html(embedded_signed_message).css('display', 'block');
          } else {
            message_element.append(embedded_signed_message).css('display', 'block');
          }
        }
      }
    });
    var not_processed_attachments_loaders = attachments_container.find('.attachment_loader');
    if(!skip_google_drive && not_processed_attachments_loaders.length && message_element.find('.gmail_drive_chip, a[href^="https://drive.google.com/file"]').length) {
      // replace google drive attachments - they do not get returned by Gmail API thus did not get replaced above
      var google_drive_attachments = [];
      not_processed_attachments_loaders.each(function (i, loader_element) {
        var download_url = $(loader_element).parent().attr('download_url');
        if(download_url) {
          var meta = download_url.split(':');
          google_drive_attachments.push({ message_id: message_id, name: meta[1], type: meta[0], url: meta[2] + ':' + meta[3], treat_as: 'encrypted'});
        } else {
          console.log('Missing Google Drive attachments download_url');
        }
      });
      process_attachments(message_id, google_drive_attachments, attachments_container, true);
    }
  }

  function filter_attachments(potential_matches, patterns) {
    return potential_matches.filter('span.aZo:visible, span.a5r:visible').find('span.aV3').filter(function() {
      var name = this.innerText.trim();
      for(var i = 0; i < patterns.length; i++) {
        if(patterns[i].indexOf('*.') === 0) { // wildcard
          if(name.endsWith(patterns[i].substr(1))) {
            return true;
          }
        } else if (name === patterns[i]){ // exact match
          return true;
        }
      }
      return false;
    }).closest('span.aZo, span.a5r');
  }

  function hide_attachment(atachment_element, attachments_container_selector) {
    atachment_element.css('display', 'none');
    if(!atachment_element.length) {
      attachments_container_selector.children('.attachment_loader').text('Missing file info');
    }
  }

  function get_message_body_element(message_id) {
    return $('div.a3s.m' + message_id);
  }

  function get_sender_email(message_element) {
    return ($(message_element).closest('.gs').find('span.gD').attr('email') || '').toLowerCase();
  }

  function get_thread_and_message_ids_for_reply(conversation_root_element) {
    var thread_match = /\/([0-9a-f]{16})/g.exec(window.location);
    if(thread_match !== null) {
      return {thread: thread_match[1], message: thread_match[1]};
    } else { // sometimes won't work, that's why the else
      return {thread: '', message: determine_message_id('message', conversation_root_element.find('div.a3s.evaluated'))};
    }
  }

  function dom_get_message_sender(conversation_root_element) {
    return conversation_root_element.find('h3.iw span[email]').last().attr('email').trim().toLowerCase();
  }

  function dom_get_message_recipients(conversation_root_element) {
    return conversation_root_element.find('span.hb').last().find('span.g2').toArray().map(function (el) {
      return $(el).attr('email').toLowerCase(); // add all recipients including me
    });
  }

  function dom_get_message_subject(conversation_root_element) {
    return $(conversation_root_element).find('h2.hP').text();
  }

  function get_conversation_params(convo_root_el) {
    var ids = get_thread_and_message_ids_for_reply(convo_root_el);
    var headers = tool.api.common.reply_correspondents(account_email, addresses, dom_get_message_sender(convo_root_el), dom_get_message_recipients(convo_root_el));
    return {
      subject: dom_get_message_subject(convo_root_el),
      reply_to: headers.to,
      addresses: addresses,
      my_email: headers.from,
      thread_id: ids.thread,
      thread_message_id: ids.message,
    };
  }

  function get_conversation_root_element(any_inner_element) {
    return $(any_inner_element).closest('div.if, td.Bu').first();
  }

  function replace_standard_reply_box(editable, force) {
    $('div.nr.tMHS5d, div.gA td.I5').not('.reply_message_iframe_container').filter(':visible').reverse().each(function (i, reply_box) {
      var root_element = get_conversation_root_element(reply_box);
      if(root_element.find('iframe.pgp_block').filter(':visible').length || (root_element.is(':visible') && force)) { // should be replaced
        var prepared_reply_box = $(reply_box).addClass('remove_borders').addClass('reply_message_iframe_container');
        if(i === 0) { // last box
          var iframe = factory.embedded.reply(get_conversation_params(root_element), editable);
          prepared_reply_box.append(iframe).children(':not(iframe)').css('display', 'none');
        } else {
          prepared_reply_box.append('<font>Draft skipped</font>').children(':not(font)').css('display', 'none');
        }
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
    $('.reply_message_iframe_container:visible').last().append(factory.embedded.reply(params, false, true));
  }

  function evaluate_standard_compose_receivers() {
    var standard_compose_selector = $('.aaZ:visible');
    if(standard_compose_selector.length) { // compose message is open
      standard_compose_selector.each(function(i, standard_compose_window) {
        standard_compose_window = $(standard_compose_window);
        var recipients = standard_compose_window.find('div.az9 span[email]');
        if(!recipients) {
          standard_compose_window.find('.recipients_use_encryption').remove();
        } else {
          var results = {has_pgp: [], no_pgp: [], loading: [], unknown: [], wrong: []};
          recipients.each(function(i, recipient) {
            var email = $(recipient).attr('email');
            var status = recipient_has_pgp[email];
            if(!tool.str.is_email_valid(email)) {
              results.wrong.push(email);
            } if(typeof status === 'undefined') {
              results.unknown.push(email);
              recipient_has_pgp[email] = null; // loading
              tool.api.attester.lookup_email(email).validate(r => r.email).then(response => {
                recipient_has_pgp[email] = !!response.pubkey; // true or false
              }, error => {
                recipient_has_pgp[email] = undefined; // unknown
              });
            } else if (status === null) {
              results.loading.push(email);
            } else if (status === true) {
              results.has_pgp.push(email);
            } else {
              results.no_pgp.push(email);
            }
          });
          if(results.has_pgp.length > 0 && results.no_pgp.length + results.loading.length + results.unknown.length + results.wrong.length === 0) {
            if(!standard_compose_window.find('.recipients_use_encryption').length) {
              recipients.first().parents('form').first().prepend(factory.button.recipients_use_encryption(results.has_pgp.length, 'gmail')).find('a').click(injector.open_compose_window);
            }
          } else { // all loaded
            standard_compose_window.find('.recipients_use_encryption').remove();
          }
        }
      });
    }
  }

  return {
    everything: everything,
    set_reply_box_editable: set_reply_box_editable,
    reinsert_reply_box: reinsert_reply_box,
  };

}
