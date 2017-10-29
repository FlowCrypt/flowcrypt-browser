/* Business Source License 1.0 © 2016-2017 FlowCrypt Limited. Use limitations apply. Contact human@flowcrypt.com */

'use strict';

tool.ui.event.protect();

let url_params = tool.env.url_params(['account_email', 'parent_tab_id', 'longids', 'type']);

if(url_params.type === 'embedded') {
  $('h1').parent().css('display', 'none');
  $('div.separator').css('display', 'none');
  $('body#settings > div#content.dialog').css({ width: 'inherit', background: '#fafafa', });
  $('.line.which_key').css({ display: 'none', position: 'absolute', visibility: 'hidden', left: '5000px', });
} else if(url_params.type === 'sign') {
  $('h1').text('Enter your pass phrase to sign email');
} else if(url_params.type === 'attest') {
  $('h1').text('Enter your pass phrase to confirm attestation');
}
tool.ui.passphrase_toggle(['passphrase']);

window.flowcrypt_storage.keys_get(url_params.account_email).then(all_private_keys => {

  let private_keys = url_params.longids ? all_private_keys.filter(ki => tool.value(ki.longid).in(url_params.longids.split(','))) : all_private_keys;

  if(all_private_keys.length > 1) {
    let html;
    if(private_keys.length === 1) {
      html = 'For the following key: <span class="good">' + mnemonic(private_keys[0].longid) + '</span> (KeyWords)';
    } else {
      html = 'Pass phrase needed for any of the following keys:';
      tool.each(private_keys, function (i, keyinfo) {
        html += 'KeyWords ' + String(i + 1) + ': <div class="good">' + mnemonic(private_keys[i].longid) + '</div>';
      });
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

  $('.action_close').click(tool.ui.event.prevent(tool.ui.event.double(), function () {
    tool.browser.message.send('broadcast', 'passphrase_entry', {entered: false});
    tool.browser.message.send(url_params.parent_tab_id, 'close_dialog');
  }));

  $('.action_ok').click(tool.ui.event.prevent(tool.ui.event.double(), function () {
    let pass = $('#passphrase').val();
    let is_correct = false;
    tool.each(private_keys, function (i, keyinfo) { // if passphrase matches more keys, it will save them all
      let prv = openpgp.key.readArmored(keyinfo.private).keys[0];
      if(tool.crypto.key.decrypt(prv, pass).success) {
        is_correct = true;
        window.flowcrypt_storage.passphrase_save($('.forget').prop('checked') ? 'session' : 'local', url_params.account_email, keyinfo.longid, pass).then(() => {
          tool.browser.message.send('broadcast', 'passphrase_entry', {entered: true});
          tool.browser.message.send(url_params.parent_tab_id, 'close_dialog');
        });
        return false;
      }
    });
    if(!is_correct) {
      render_error();
      setTimeout(render_normal, 1500);
    }
  }));

  $('#passphrase').keyup(render_normal);

});