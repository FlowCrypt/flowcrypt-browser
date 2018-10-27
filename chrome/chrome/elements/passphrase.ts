/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

tool.catch.try(async () => {

  Ui.event.protect();

  let url_params = Env.url_params(['account_email', 'parent_tab_id', 'longids', 'type']);
  let account_email = Env.url_param_require.string(url_params, 'account_email');
  let parent_tab_id = Env.url_param_require.string(url_params, 'parent_tab_id');
  let longids = Env.url_param_require.string(url_params, 'longids').split(',');
  let type = Env.url_param_require.oneof(url_params, 'type', ['embedded', 'sign', 'attest', 'message', 'draft', 'attachment']);

  if (type === 'embedded') {
    $('h1').parent().css('display', 'none');
    $('div.separator').css('display', 'none');
    $('body#settings > div#content.dialog').css({ width: 'inherit', background: '#fafafa', });
    $('.line.which_key').css({ display: 'none', position: 'absolute', visibility: 'hidden', left: '5000px', });
  } else if (type === 'sign') {
    $('h1').text('Enter your pass phrase to sign email');
  } else if (type === 'draft') {
    $('h1').text('Enter your pass phrase to load a draft');
  } else if (type === 'attest') {
    $('h1').text('Enter your pass phrase to confirm attestation');
  } else if (type === 'attachment') {
    $('h1').text('Enter your pass phrase to decrypt a file');
  }
  await Ui.passphrase_toggle(['passphrase']);
  $('#passphrase').focus();

  let all_private_keys = await Store.keys_get(account_email);
  let selected_private_keys = all_private_keys.filter(ki => tool.value(ki.longid).in(longids) || (ki.primary && tool.value('primary').in(longids)));

  if (all_private_keys.length > 1) {
    let html: string;
    if (selected_private_keys.length === 1) {
      html = `For key: <span class="good">${Xss.html_escape(mnemonic(selected_private_keys[0].longid))}</span> (KeyWords)`;
    } else {
      html = 'Pass phrase needed for any of the following keys:';
      for (let i of selected_private_keys.keys()) {
        html += `KeyWords ${String(i + 1)}: <div class="good">${Xss.html_escape(mnemonic(selected_private_keys[i].longid))}</div>`;
      }
    }
    Ui.sanitize_render('.which_key', html);
    $('.which_key').css('display', 'block');
  }

  let render_error = () => {
    $('#passphrase').val('');
    $('#passphrase').css('border-color', 'red');
    $('#passphrase').css('color', 'red');
    $('#passphrase').attr('placeholder', 'Please try again');
  };

  let render_normal = () => {
    $('#passphrase').css('border-color', '');
    $('#passphrase').css('color', 'black');
    $('#passphrase').focus();
  };

  $('.action_close').click(Ui.event.handle(() => {
    BrowserMsg.send('broadcast', 'passphrase_entry', {entered: false});
    BrowserMsg.send(parent_tab_id, 'close_dialog');
  }));

  $('.action_ok').click(Ui.event.handle(async () => {
    let pass = $('#passphrase').val() as string; // it's a text input
    let storage_type: StorageType = $('.forget').prop('checked') ? 'session' : 'local';
    let at_least_one_matched = false;
    for (let keyinfo of selected_private_keys) { // if passphrase matches more keys, it will save them all
      let prv = openpgp.key.readArmored(keyinfo.private).keys[0];
      try {
        if (await Pgp.key.decrypt(prv, [pass]) === true) {
          await Store.passphrase_save(storage_type, account_email, keyinfo.longid, pass);
          at_least_one_matched = true;
        }
      } catch(e) {
        if(e.message === 'Unknown s2k type.') {
          alert(`One of your keys ${keyinfo.longid} is not well supported yet (${e.message}).\n\nPlease write human@flowcrypt.com with details about how was this key created so that we can add support soon.`);
        } else {
          throw e;
        }
      }
    }
    if (at_least_one_matched) {
      BrowserMsg.send('broadcast', 'passphrase_entry', {entered: true});
      BrowserMsg.send(parent_tab_id, 'close_dialog');
    } else {
      render_error();
      setTimeout(render_normal, 1500);
    }
  }));

  $('#passphrase').keyup(render_normal);

})();
