'use strict';

var url_params = get_url_params(['account_email']);

var key = openpgp.key.readArmored(private_storage_get('local', url_params.account_email, 'master_private_key')).keys[0];

$('.key_dump').text(key.toPublic().armor());
$('.key_fingerprint').text(key.primaryKey.fingerprint.toUpperCase().replace(/(.{4})/g,"$1 "));

console.log($('.key_type').text().toLowerCase());
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
