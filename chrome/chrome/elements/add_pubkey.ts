/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

tool.catch.try(() => {

  tool.ui.event.protect();

  let url_params = tool.env.url_params(['account_email', 'parent_tab_id', 'emails', 'placement']);
  
  for(let email of (url_params.emails as string).split(',')) {
    $('select.email').append('<option value="' + email + '">' + email + '</option>');
  }
  
  (window as FlowCryptWindow).flowcrypt_storage.db_contact_search(null, { has_pgp: true }, function (contacts) {
  
    $('select.copy_from_email').append('<option value=""></option>');
    for(let contact of contacts) {
      $('select.copy_from_email').append('<option value="' + contact.email + '">' + contact.email + '</option>');
    }
  
    $('select.copy_from_email').change(function () {
      if($(this).val()) {
        (window as FlowCryptWindow).flowcrypt_storage.db_contact_get(null, $(this).val() as string, function (contact: Contact) {
          $('.pubkey').val(contact.pubkey).prop('disabled', true);
        });
      } else {
        $('.pubkey').val('').prop('disabled', false);
      }
    });
  
    $('.action_ok').click(tool.ui.event.prevent(tool.ui.event.double(), function () {
      let armored = tool.crypto.key.normalize(tool.crypto.armor.strip($('.pubkey').val() as string)); // .pubkey is a textarea
      if(!armored || !tool.crypto.key.fingerprint(armored)) {
        alert('Could not recognize the format, please try again.');
        $('.pubkey').val('').focus();
      } else if (!tool.crypto.key.usable(armored)) {
        alert('This public key looks correctly formatted, but cannot be used for encryption. Please write me at human@flowcrypt.com so that I can see if there is a way to fix it.');
        $('.pubkey').val('').focus();
      } else {
        (window as FlowCryptWindow).flowcrypt_storage.db_contact_save(null, (window as FlowCryptWindow).flowcrypt_storage.db_contact_object($('select.email').val() as string, null, 'pgp', armored, null, false, Date.now()), close_dialog);
      }
    }));
  
  });
  
  if(url_params.placement !== 'settings') {
    $('.action_settings').click(tool.ui.event.prevent(tool.ui.event.double(), function () {
      tool.browser.message.send(null, 'settings', {
        path: 'index.htm',
        page: '/chrome/settings/modules/contacts.htm',
        account_email: url_params.account_email,
      });
    }));
  } else {
    $('#content').addClass('inside_compose');
  }
  
  $('.action_close').click(tool.ui.event.prevent(tool.ui.event.double(), close_dialog));
  
  function close_dialog() {
    if(url_params.parent_tab_id) {
      tool.browser.message.send(url_params.parent_tab_id as string, 'close_dialog');
    } else {
      window.close();
    }
  
  }  

})();
