/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store } from 'js/common/platform/store.js';
import { Att } from 'js/common/core/att.js';
import { Ui, Env, Browser } from '../../../js/common/browser.js';
import { Pgp } from 'js/common/core/pgp.js';
import { Settings } from '../../../js/common/settings.js';
import { Api } from '../../../js/common/api/api.js';
import { Catch } from '../../../js/common/platform/catch.js';

declare const openpgp: typeof OpenPGP;
declare const ClipboardJS: any;

Catch.try(async () => {

  const uncheckedUrlParams = Env.urlParams(['acctEmail', 'longid', 'parentTabId']);
  const acctEmail = Env.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
  const longid = Env.urlParamRequire.optionalString(uncheckedUrlParams, 'longid') || 'primary';
  const myKeyUserIdsUrl = Env.urlCreate('my_key_user_ids.htm', uncheckedUrlParams);
  const myKeyUpdateUrl = Env.urlCreate('my_key_update.htm', uncheckedUrlParams);

  $('.action_view_user_ids').attr('href', myKeyUserIdsUrl);
  $('.action_view_update').attr('href', myKeyUpdateUrl);

  const [primaryKi] = await Store.keysGet(acctEmail, [longid]);
  Settings.abortAndRenderErrorIfKeyinfoEmpty(primaryKi);

  const key = openpgp.key.readArmored(primaryKi.private).keys[0];

  try {
    const { results: [result] } = await Api.attester.lookupEmail([acctEmail]);
    const url = Api.fc.url('pubkey', acctEmail);
    if (result.pubkey && Pgp.key.longid(result.pubkey) === primaryKi.longid) {
      $('.pubkey_link_container a').text(url.replace('https://', '')).attr('href', url).parent().css('visibility', 'visible');
    }
  } catch (e) {
    if (Api.err.isSignificant(e)) {
      Catch.handleErr(e);
    }
    $('.pubkey_link_container').remove();
  }

  $('.email').text(acctEmail);
  $('.key_fingerprint').text(Pgp.key.fingerprint(key, 'spaced')!);
  $('.key_words').text(primaryKi.keywords);
  $('.show_when_showing_public').css('display', '');
  $('.show_when_showing_private').css('display', 'none');

  $('.action_download_pubkey').click(Ui.event.prevent('double', () => {
    Browser.saveToDownloads(Att.keyinfoAsPubkeyAtt(primaryKi), Catch.browser().name === 'firefox' ? $('body') : undefined);
  }));

  $('.action_show_other_type').click(Ui.event.handle(() => {
    if ($('.action_show_other_type').text().toLowerCase() === 'show private key') {
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
  }));

  const clipboardOpts = { text: () => key.toPublic().armor() };
  new ClipboardJS('.action_copy_pubkey', clipboardOpts); // tslint:disable-line:no-unused-expression no-unsafe-any

})();
