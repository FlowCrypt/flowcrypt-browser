/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

tool.catch.try(async () => {

  tool.ui.event.protect();

  let url_params = tool.env.url_params(['account_email', 'parent_tab_id', 'emails', 'placement']);
  let account_email = tool.env.url_param_require.string(url_params, 'account_email');
  let parent_tab_id = tool.env.url_param_require.string(url_params, 'parent_tab_id');

  for (let email of (url_params.emails as string).split(',')) {
    $('select.email').append('<option value="' + email + '">' + email + '</option>');
  }

  let contacts = await Store.db_contact_search(null, {has_pgp: true});

  $('select.copy_from_email').append('<option value=""></option>');
  for (let contact of contacts) {
    $('select.copy_from_email').append('<option value="' + contact.email + '">' + contact.email + '</option>');
  }

  $('select.copy_from_email').change(async function() {
    if ($(this).val()) {
      let [contact] = await Store.db_contact_get(null, [$(this).val() as string]);
      if (contact && contact.pubkey) {
        $('.pubkey').val(contact.pubkey).prop('disabled', true);
      } else {
        alert('Contact not found.');
      }
    } else {
      $('.pubkey').val('').prop('disabled', false);
    }
  });

  $('.action_ok').click(tool.ui.event.prevent(tool.ui.event.double(), async () => {
    let armored = tool.crypto.key.normalize(tool.crypto.armor.strip($('.pubkey').val() as string)); // .pubkey is a textarea
    if (!armored || !tool.crypto.key.fingerprint(armored)) {
      alert('Could not recognize the format, please try again.');
      $('.pubkey').val('').focus();
    } else if (!await tool.crypto.key.usable(armored)) {
      alert('This public key looks correctly formatted, but cannot be used for encryption. Please write me at human@flowcrypt.com so that I can see if there is a way to fix it.');
      $('.pubkey').val('').focus();
    } else {
      await Store.db_contact_save(null, Store.db_contact_object($('select.email').val() as string, null, 'pgp', armored, null, false, Date.now()));
      close_dialog();
    }
  }));

  if (url_params.placement !== 'settings') {
    $('.action_settings').click(tool.ui.event.prevent(tool.ui.event.double(), () => tool.browser.message.send(null, 'settings', {
      path: 'index.htm',
      page: '/chrome/settings/modules/contacts.htm',
      account_email,
    })));
  } else {
    $('#content').addClass('inside_compose');
  }

  $('.action_close').click(tool.ui.event.prevent(tool.ui.event.double(), close_dialog));

  function close_dialog() {
    tool.browser.message.send(parent_tab_id, 'close_dialog');
  }

})();
