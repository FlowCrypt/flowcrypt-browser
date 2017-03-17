/* Business Source License 1.0 © 2016 Tom James Holub (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/tomholub/cryptup-chrome/tree/master/src/LICENCE */

'use strict';

var url_params = tool.env.url_params(['account_email', 'parent_tab_id', 'draft_id', 'placement', 'frame_id']);

storage_cryptup_subscription(function(subscription_level, subscription_expire, subscription_active) {
  var subscription = { level: subscription_level, expire: subscription_expire, active: subscription_active };
  db_open(function (db) {

    if(db === db_denied) {
      notify_about_storage_access_error(url_params.account_email, url_params.parent_tab_id);
      setTimeout(new_message_close, 300);
      return;
    }

    var compose = init_shared_compose_js(url_params, db, subscription, new_message_close);

    function order_addresses(account_email, addresses) {
      return [account_email].concat(tool.arr.without_value(addresses, account_email)); //places main account email as first
    }

    if(url_params.placement === 'popup') {
      $('body').addClass('popup');
    }

    $('.delete_draft').click(function () {
      compose.draft_delete(url_params.account_email, new_message_close);
    });

    if(url_params.draft_id) {
      // todo - this is mostly copy/pasted from reply_message, would deserve a common function
      tool.api.gmail.draft_get(url_params.account_email, url_params.draft_id, 'raw', function (success, response) {
        if(success) {
          compose.draft_set_id(url_params.draft_id);
          tool.mime.decode(tool.str.base64url_decode(response.message.raw), function (mime_success, parsed_message) {
            if(success) {
              var draft_headers = tool.mime.headers_to_from(parsed_message);
              if(tool.value(tool.crypto.armor.headers('message').end).in(parsed_message.text || tool.crypto.armor.strip(parsed_message.html))) {
                var stripped_text = parsed_message.text || tool.crypto.armor.strip(parsed_message.html);
                $('#input_subject').val(parsed_message.headers.subject || '');
                compose.decrypt_and_render_draft(url_params.account_email, stripped_text.substr(stripped_text.indexOf(tool.crypto.armor.headers('message').begin)), undefined, draft_headers);
              } else {
                console.log('tool.api.gmail.draft_get tool.mime.decode else {}');
              }
            } else {
              console.log('tool.api.gmail.draft_get tool.mime.decode success===false');
              console.log(parsed_message);
            }
          });
        } else {
          console.log('tool.api.gmail.draft_get success===false');
          console.log(response);
        }
      });
    }

    function new_message_close() {
      if(url_params.placement === 'settings') {
        tool.browser.message.send(url_params.parent_tab_id, 'close_page');
      } else if(url_params.placement === 'popup') {
        window.close();
      } else {
        tool.browser.message.send(url_params.parent_tab_id, 'close_new_message');
      }
    }

    compose.on_render();
    $('#input_to').focus();
    $('.close_new_message').click(new_message_close);
    account_storage_get(url_params.account_email, ['addresses'], function (storage) { // add send-from addresses
      if(typeof storage.addresses !== 'undefined' && storage.addresses.length > 1) {
        var addresses = order_addresses(url_params.account_email, storage.addresses);
        $('#input_addresses_container').addClass('show_send_from').append('<select id="input_from" tabindex="-1"></select>');
        $('#input_from').change(compose.update_pubkey_icon);
        $.each(addresses, function (i, address) {
          $('#input_from').append('<option value="' + address + '">' + address + '</option>');
        });
      }
    });

  });
});