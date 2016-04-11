'use strict';

var url_params = get_url_params(['account_email']);

function render() {
  var pubkeys = pubkey_cache_retrieve();
  $('table#emails').html('');
  $.each(pubkeys, function(email, pubkey) {
    $('table#emails').append('<tr email="' + email + '"><td>' + email + '</td><td><a href="#" class="action_show">show</a></td><td><a href="#" class="action_change">change</a></td><td><a href="#" class="action_remove">remove</a></td></tr>');
  });

  $('a.action_show').off().click(prevent(doubleclick(), function(self) {
    $.featherlight('<pre>' + pubkeys[$(self).closest('tr').attr('email')] + '</pre>');
  }));

  $('a.action_change').off().click(prevent(doubleclick(), function(self) {
    var email = $(self).closest('tr').attr('email');
    $('#edit_pubkey .input_email').text(email);
    $.featherlight($('#edit_pubkey'));
  }));

  $('#edit_pubkey .action_save_edited_pubkey').off().click(prevent(doubleclick(), function(self) {
    var armored_pubkey = $('#edit_pubkey.featherlight-inner .input_pubkey').val();
    if(!armored_pubkey) {
      $('.featherlight-close').click();
    } else {
      var pubkey = openpgp.key.readArmored(armored_pubkey).keys[0];
      if(typeof pubkey !== 'undefined') {
        pubkey_cache_add($('#edit_pubkey.featherlight-inner .input_email').text(), pubkey.armor());
        render();
        $('.featherlight-close').click();
      } else {
        alert('Cannot recognize a valid pubkey, please try again.');
        $('#edit_pubkey.featherlight-inner .input_pubkey').val('').focus();
      }
    }
  }));

  $('a.action_remove').off().click(prevent(doubleclick(), function(self) {
    pubkey_cache_remove($(self).closest('tr').attr('email'));
    render();
  }));
}

render();
