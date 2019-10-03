/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch } from '../../../js/common/platform/catch.js';
import { Store } from '../../../js/common/platform/store.js';
import { Att } from '../../../js/common/core/att.js';
import { Ui, Env, Browser } from '../../../js/common/browser.js';
import { Pgp } from '../../../js/common/core/pgp.js';
import { Api } from '../../../js/common/api/api.js';
import { Attester } from '../../../js/common/api/attester.js';
import { Backend } from '../../../js/common/api/backend.js';
import { Assert } from '../../../js/common/assert.js';
import { Buf } from '../../../js/common/core/buf.js';

declare const openpgp: typeof OpenPGP;
declare const ClipboardJS: any;

Catch.try(async () => {

  const uncheckedUrlParams = Env.urlParams(['acctEmail', 'longid', 'parentTabId']);
  const acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
  const longid = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'longid') || 'primary';
  const myKeyUserIdsUrl = Env.urlCreate('my_key_user_ids.htm', uncheckedUrlParams);
  const myKeyUpdateUrl = Env.urlCreate('my_key_update.htm', uncheckedUrlParams);

  $('.action_view_user_ids').attr('href', myKeyUserIdsUrl);
  $('.action_view_update').attr('href', myKeyUpdateUrl);

  const [primaryKi] = await Store.keysGet(acctEmail, [longid]);
  Assert.abortAndRenderErrorIfKeyinfoEmpty(primaryKi);

  const { keys: [prv] } = await openpgp.key.readArmored(primaryKi.private);

  try {
    const result = await Attester.lookupEmail(acctEmail);
    const url = Backend.url('pubkey', acctEmail);
    if (result.pubkey && await Pgp.key.longid(result.pubkey) === primaryKi.longid) {
      $('.pubkey_link_container a').text(url.replace('https://', '')).attr('href', url).parent().css('visibility', 'visible');
    }
  } catch (e) {
    if (Api.err.isSignificant(e)) {
      Catch.reportErr(e);
    }
    $('.pubkey_link_container').remove();
  }

  $('.email').text(acctEmail);
  $('.key_fingerprint').text(await Pgp.key.fingerprint(prv, 'spaced') || '(unknown fingerprint)');
  $('.key_words').text(primaryKi.keywords);
  $('.show_when_showing_public').css('display', '');
  $('.show_when_showing_private').css('display', 'none');

  $('.action_download_pubkey').click(Ui.event.prevent('double', () => {
    Browser.saveToDownloads(Att.keyinfoAsPubkeyAtt(primaryKi), Catch.browser().name === 'firefox' ? $('body') : undefined);
  }));

  $('.action_download_prv').click(Ui.event.prevent('double', () => {
    const name = `flowcrypt-backup-${acctEmail.replace(/[^A-Za-z0-9]+/g, '')}-0x${primaryKi.longid}.asc`;
    const prvKeyAtt = new Att({ data: Buf.fromUtfStr(primaryKi.private), type: 'application/pgp-keys', name });
    Browser.saveToDownloads(prvKeyAtt, Catch.browser().name === 'firefox' ? $('body') : undefined);
  }));

  $('.action_show_other_type').click(Ui.event.handle(() => {
    if ($('.action_show_other_type').text().toLowerCase() === 'show private key') {
      $('.action_show_other_type').text('show public key').removeClass('bad').addClass('good');
      $('.key_type').text('Private Key');
      $('.show_when_showing_public').css('display', 'none');
      $('.show_when_showing_private').css('display', '');
    } else {
      $('.action_show_other_type').text('show private key').removeClass('good').addClass('bad');
      $('.key_type').text('Public Key Info');
      $('.show_when_showing_public').css('display', '');
      $('.show_when_showing_private').css('display', 'none');
    }
  }));

  const clipboardOpts = { text: () => $('.action_show_other_type').text().toLowerCase() === 'show private key' ? primaryKi.public : primaryKi.private };
  new ClipboardJS('.action_copy_pubkey, .action_copy_prv', clipboardOpts); // tslint:disable-line:no-unused-expression no-unsafe-any

})();
