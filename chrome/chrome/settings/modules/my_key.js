/* Business Source License 1.0 © 2016 FlowCrypt Limited (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/CryptUp/cryptup-browser/tree/master/src/LICENCE */

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

tool.api.attester.lookup_email(url_params.account_email, function (success, response) {
  if(success && response && response.pubkey && tool.crypto.key.longid(response.pubkey) === keyinfo.longid) {
    var url = tool.api.cryptup.url('pubkey', url_params.account_email);
    $('.pubkey_link_container a').text(url.replace('https://', '')).attr('href', url).parent().css('visibility', 'visible');
  } else {
    $('.pubkey_link_container').remove();
  }
});

$('.email').text(url_params.account_email);
$('.key_fingerprint').text(tool.crypto.key.fingerprint(key, 'spaced'));
$('.key_words').text(mnemonic(keyinfo.longid));
$('.show_when_showing_public').css('display', '');
$('.show_when_showing_private').css('display', 'none');

$('.action_download_pubkey').click(tool.ui.event.prevent(tool.ui.event.double(), function () {
  var file = tool.file.keyinfo_as_pubkey_attachment(keyinfo);
  tool.file.save_to_downloads(file.name, file.type, file.content);
}));

$('.action_view_pubkey').click(function () {
  $('.key_dump').text(key.toPublic().armor());
});

$('.action_show_other_type').click(function () {
  if($('.action_show_other_type').text().toLowerCase() === 'show private') {
    $('.key_dump').text(key.armor()).removeClass('good').addClass('bad');
    $('.action_show_other_type').text('show public').removeClass('bad').addClass('good');
    $('.key_type').text('Master Private Key');
    $('.show_when_showing_public').css('display', 'none');
    $('.show_when_showing_private').css('display', '');
  } else {
    $('.key_dump').text('').removeClass('bad').addClass('good');
    $('.action_show_other_type').text('show private').removeClass('good').addClass('bad');
    $('.key_type').text('Master Public Key Info');
    $('.show_when_showing_public').css('display', '');
    $('.show_when_showing_private').css('display', 'none');
  }
});
