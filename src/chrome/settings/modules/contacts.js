'use strict';

var url_params = get_url_params(['account_email']);

db_open(function(db) {

  function render() {
    db_contact_search(db, {
      has_pgp: true
    }, function(contacts) {

      $('table#emails').html('');
      $.each(contacts, function(i, contact) {
        $('table#emails').append('<tr email="' + contact.email + '"><td>' + contact.email + '</td><td><a href="#" class="action_show">show</a></td><td><a href="#" class="action_change">change</a></td><td><a href="#" class="action_remove">remove</a></td></tr>');
      });

      $('a.action_show').off().click(prevent(doubleclick(), function(self) {
        db_contact_get(db, $(self).closest('tr').attr('email'), function(contact) {
          $.featherlight('<pre>' + contact.pubkey + '</pre>');
        });
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
          if(key_fingerprint(armored_pubkey) !== null) {
            $('.featherlight-close').click();
            db_contact_save(db, db_contact_object($('#edit_pubkey.featherlight-inner .input_email').text(), null, 'pgp', armored_pubkey, null, false, Date.now()), render);
          } else {
            alert('Cannot recognize a valid pubkey, please try again.');
            $('#edit_pubkey.featherlight-inner .input_pubkey').val('').focus();
          }
        }
      }));

      $('a.action_remove').off().click(prevent(doubleclick(), function(self) {
        db_contact_save(db, db_contact_object($(self).closest('tr').attr('email'), null, null, null, null, null, null), render);
      }));

    });
  }

  render();

});
