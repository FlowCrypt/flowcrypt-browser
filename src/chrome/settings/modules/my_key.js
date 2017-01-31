/* Business Source License 1.0 © 2016 Tom James Holub (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/tomholub/cryptup-chrome/tree/master/src/LICENCE */

'use strict';

var url_params = tool.env.url_params(['account_email', 'longid']);
var keyinfo = undefined;

if(url_params.longid) {
  keyinfo = private_keys_get(url_params.account_email, url_params.longid);
} else {
  $.each(private_keys_get(url_params.account_email), function (i, k) {
    if(k.primary) {
      keyinfo = k;
    }
  });
}

var key = openpgp.key.readArmored(keyinfo.armored).keys[0];

$('.email').text(url_params.account_email);
$('.key_dump').text(key.toPublic().armor());
$('.key_fingerprint').text(key_fingerprint(key, 'spaced'));
$('.key_words').text(mnemonic(keyinfo.longid));
$('.show_when_showing_public').css('display', 'block');
$('.show_when_showing_private').css('display', 'none');

$('.action_show_other_type').click(function () {
  if($('.action_show_other_type').text().toLowerCase() === 'show private') {
    $('.key_dump').text(key.armor()).removeClass('good').addClass('bad');
    $('.action_show_other_type').text('show public').removeClass('bad').addClass('good');
    $('.key_type').text('Master Private Key');
    $('.show_when_showing_public').css('display', 'none');
    $('.show_when_showing_private').css('display', 'block');
  } else {
    $('.key_dump').text(key.toPublic().armor()).removeClass('bad').addClass('good');
    $('.action_show_other_type').text('show private').removeClass('good').addClass('bad');
    $('.key_type').text('Master Public Key Info');
    $('.show_when_showing_public').css('display', 'block');
    $('.show_when_showing_private').css('display', 'none');
  }
});
