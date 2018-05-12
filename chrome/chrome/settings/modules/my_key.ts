/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

tool.catch.try(() => {

  let url_params = tool.env.url_params(['account_email', 'longid']);

  $('.action_view_user_ids').attr('href', tool.env.url_create('my_key_user_ids.htm', url_params));
  $('.action_view_update').attr('href', tool.env.url_create('my_key_update.htm', url_params));

  Store.keys_get(url_params.account_email as string, url_params.longid as string || 'primary').then((keyinfo: KeyInfo) => {

    if(keyinfo === null) {
      return $('body').text('Key not found. Is FlowCrypt well set up? Contact us at human@flowcrypt.com for help.');
    }

    let key = openpgp.key.readArmored(keyinfo.private).keys[0];

    // @ts-ignore
    tool.api.attester.lookup_email(url_params.account_email as string).validate(r => r.pubkey && tool.crypto.key.longid(r.pubkey) === keyinfo.longid).then((response: PubkeySearchResult) => {
      let url = tool.api.cryptup.url('pubkey', url_params.account_email as string);
      $('.pubkey_link_container a').text(url.replace('https://', '')).attr('href', url).parent().css('visibility', 'visible');
    }, (error: StandardError) => {
      $('.pubkey_link_container').remove();
    });

    $('.email').text(url_params.account_email as string);
    $('.key_fingerprint').text(tool.crypto.key.fingerprint(key, 'spaced')!);
    $('.key_words').text(keyinfo.keywords);
    $('.show_when_showing_public').css('display', '');
    $('.show_when_showing_private').css('display', 'none');

    $('.action_download_pubkey').click(tool.ui.event.prevent(tool.ui.event.double(), function () {
      let file = tool.file.keyinfo_as_pubkey_attachment(keyinfo);
      tool.file.save_to_downloads(file.name, file.type, file.content!, tool.env.browser().name === 'firefox' ? $('body') : undefined);
    }));

    $('.action_view_pubkey').click(function () {
      $('.key_dump').text(key.toPublic().armor());
    });

    $('.action_show_other_type').click(function () {
      if($('.action_show_other_type').text().toLowerCase() === 'show private key') {
        $('.key_dump').text(key.armor()).removeClass('good').addClass('bad');
        $('.action_show_other_type').text('show public key').removeClass('bad').addClass('good');
        $('.key_type').text('Private Key');
        $('.show_when_showing_public').css('display', 'none');
        $('.show_when_showing_private').css('display', '');
      } else {
        $('.key_dump').text('').removeClass('bad').addClass('good');
        $('.action_show_other_type').text('show private key').removeClass('good').addClass('bad');
        $('.key_type').text('Public Key Info');
        $('.show_when_showing_public').css('display', '');
        $('.show_when_showing_private').css('display', 'none');
      }
    });

  });

})();