'use strict';

var url_params = get_url_params(['account_email', 'longid']);

var keyinfo = private_keys_get(url_params.account_email, url_params.longid);

var key = openpgp.key.readArmored(keyinfo.armored).keys[0];

$('.key_dump').text(key.toPublic().armor());
$('.key_fingerprint').text(key_fingerprint(key, 'spaced'));
$('.key_words').text(mnemonic(key_longid(key)));

$('.action_show_other_type').click(function() {
  if($('.action_show_other_type').text().toLowerCase() === 'show private') {
    $('.key_dump').text(key.armor()).removeClass('good').addClass('bad');
    $('.action_show_other_type').text('show public').removeClass('bad').addClass('good');
    $('.key_type').text('Master Private Key')
  } else {
    $('.key_dump').text(key.toPublic().armor()).removeClass('bad').addClass('good');
    $('.action_show_other_type').text('show private').removeClass('good').addClass('bad');
    $('.key_type').text('Master Public Key')
  }
});
