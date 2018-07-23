/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

tool.catch.try(async () => {

  tool.ui.event.protect();

  let url_params = tool.env.url_params(['account_email', 'parent_tab_id', 'longids', 'type']);
  let account_email = tool.env.url_param_require.string(url_params, 'account_email');
  let parent_tab_id = tool.env.url_param_require.string(url_params, 'parent_tab_id');

  if (url_params.type === 'embedded') {
    $('h1').parent().css('display', 'none');
    $('div.separator').css('display', 'none');
    $('body#settings > div#content.dialog').css({ width: 'inherit', background: '#fafafa', });
    $('.line.which_key').css({ display: 'none', position: 'absolute', visibility: 'hidden', left: '5000px', });
  } else if (url_params.type === 'sign') {
    $('h1').text('Enter your pass phrase to sign email');
  } else if (url_params.type === 'attest') {
    $('h1').text('Enter your pass phrase to confirm attestation');
  }
  await tool.ui.passphrase_toggle(['passphrase']);
  $('#passphrase').focus();

  let all_private_keys = await Store.keys_get(account_email);
  let selected_private_keys = all_private_keys;
  if (url_params.longids) {
    let longids = (url_params.longids as string).split(',');
    selected_private_keys = all_private_keys.filter(ki => tool.value(ki.longid).in(longids) || (ki.primary && tool.value('primary').in(longids)));
  }
  if (all_private_keys.length > 1) {
    let html: string;
    if (selected_private_keys.length === 1) {
      html = 'For key: <span class="good">' + (window as FcWindow).mnemonic(selected_private_keys[0].longid) + '</span> (KeyWords)';
    } else {
      html = 'Pass phrase needed for any of the following keys:';
      for (let i of selected_private_keys.keys()) {
        html += 'KeyWords ' + String(i + 1) + ': <div class="good">' + (window as FcWindow).mnemonic(selected_private_keys[i].longid) + '</div>';
      }
    }
    $('.which_key').html(html);
    $('.which_key').css('display', 'block');
  }

  function render_error() {
    $('#passphrase').val('');
    $('#passphrase').css('border-color', 'red');
    $('#passphrase').css('color', 'red');
    $('#passphrase').attr('placeholder', 'Please try again');
  }

  function render_normal() {
    $('#passphrase').css('border-color', '');
    $('#passphrase').css('color', 'black');
    $('#passphrase').focus();
  }

  $('.action_close').click(tool.ui.event.prevent(tool.ui.event.double(), () => {
    tool.browser.message.send('broadcast', 'passphrase_entry', {entered: false});
    tool.browser.message.send(parent_tab_id, 'close_dialog');
  }));

  $('.action_ok').click(tool.ui.event.prevent(tool.ui.event.double(), async () => {
    let pass = $('#passphrase').val() as string; // it's a text input
    let is_correct = false;
    for (let keyinfo of selected_private_keys) { // if passphrase matches more keys, it will save them all
      let prv = openpgp.key.readArmored(keyinfo.private).keys[0];
      if (await tool.crypto.key.decrypt(prv, [pass]) !== true) {
        is_correct = true;
        let storage: StorageType = $('.forget').prop('checked') ? 'session' : 'local';
        await Store.passphrase_save(storage, account_email, keyinfo.longid, pass);
        tool.browser.message.send('broadcast', 'passphrase_entry', {entered: true});
        tool.browser.message.send(parent_tab_id, 'close_dialog');
        break;
      }
    }
    if (is_correct === false) {
      render_error();
      setTimeout(render_normal, 1500);
    }
  }));

  $('#passphrase').keyup(render_normal);

})();
