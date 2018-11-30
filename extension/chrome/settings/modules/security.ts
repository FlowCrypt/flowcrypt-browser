/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store } from '../../../js/common/platform/store.js';
import { Xss, Ui, Env } from '../../../js/common/browser.js';
import { Pgp } from '../../../js/common/core/pgp.js';
import { Settings } from '../../../js/common/settings.js';
import { Api } from '../../../js/common/api/api.js';
import { Catch } from '../../../js/common/platform/catch.js';
import { Value } from '../../../js/common/core/common.js';

declare const openpgp: typeof OpenPGP;

Catch.try(async () => {

  const uncheckedUrlParams = Env.urlParams(['acctEmail', 'embedded', 'parentTabId']);
  const acctEmail = Env.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
  const parentTabId = Env.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');
  const embedded = uncheckedUrlParams.embedded === true;

  await Ui.passphraseToggle(['passphrase_entry']);

  const [primaryKi] = await Store.keysGet(acctEmail, ['primary']);
  Settings.abortAndRenderErrorIfKeyinfoEmpty(primaryKi, false);
  if (!primaryKi) {
    return; // added do_throw=false above + manually exiting here because security.htm can indeed be commonly rendered on setup page before setting acct up
  }

  const storage = await Store.getAcct(acctEmail, ['hide_message_password', 'outgoing_language']);

  if (embedded) {
    $('.change_passhrase_container, .title_container').css('display', 'none');
    $('.line').css('padding', '7px 0');
  }

  const onDefaultExpireUserChange = async () => {
    Xss.sanitizeRender('.select_loader_container', Ui.spinner('green'));
    $('.default_message_expire').css('display', 'none');
    await Api.fc.accountUpdate({ default_message_expire: Number($('.default_message_expire').val()) });
    window.location.reload();
  };

  const onMsgLanguageUserChange = async () => {
    const outgoingLanguage = String($('.password_message_language').val());
    if (Value.is(outgoingLanguage).in(['EN', 'DE'])) {
      await Store.setAcct(acctEmail, { outgoing_language: outgoingLanguage as 'DE' | 'EN' });
      window.location.reload();
    }
  };

  const storedPassphrase = await Store.passphraseGet(acctEmail, primaryKi.longid, true);
  if (typeof storedPassphrase === 'undefined') {
    $('#passphrase_to_open_email').prop('checked', true);
  }
  $('#passphrase_to_open_email').change(Ui.event.handle(() => {
    $('.passhprase_checkbox_container').css('display', 'none');
    $('.passphrase_entry_container').css('display', 'block');
  }));

  $('.action_change_passphrase').click(Ui.event.handle(() => Settings.redirectSubPage(acctEmail, parentTabId, '/chrome/settings/modules/change_passphrase.htm')));

  $('.action_test_passphrase').click(Ui.event.handle(() => Settings.redirectSubPage(acctEmail, parentTabId, '/chrome/settings/modules/test_passphrase.htm')));

  $('.confirm_passphrase_requirement_change').click(Ui.event.handle(async () => {
    if ($('#passphrase_to_open_email').is(':checked')) { // todo - forget pass all phrases, not just master
      const storedPassphrase = await Store.passphraseGet(acctEmail, primaryKi.longid);
      if ($('input#passphrase_entry').val() === storedPassphrase) {
        await Store.passphraseSave('local', acctEmail, primaryKi.longid, undefined);
        await Store.passphraseSave('session', acctEmail, primaryKi.longid, undefined);
        window.location.reload();
      } else {
        alert('Pass phrase did not match, please try again.');
        $('input#passphrase_entry').val('').focus();
      }
    } else { // save pass phrase
      const key = openpgp.key.readArmored(primaryKi.private).keys[0];
      if (await Pgp.key.decrypt(key, [String($('input#passphrase_entry').val())]) === true) {
        await Store.passphraseSave('local', acctEmail, primaryKi.longid, String($('input#passphrase_entry').val()));
        window.location.reload();
      } else {
        alert('Pass phrase did not match, please try again.');
        $('input#passphrase_entry').val('').focus();
      }
    }
  }));

  $('.cancel_passphrase_requirement_change').click(() => window.location.reload());

  $('#hide_message_password').prop('checked', storage.hide_message_password === true);
  $('.password_message_language').val(storage.outgoing_language || 'EN');
  $('#hide_message_password').change(Ui.event.handle(async target => {
    await Store.setAcct(acctEmail, { hide_message_password: $(target).is(':checked') });
    window.location.reload();
  }));

  $('.password_message_language').change(Ui.event.handle(onMsgLanguageUserChange));

  const subscription = await Store.subscription();
  if (subscription.active) {
    Xss.sanitizeRender('.select_loader_container', Ui.spinner('green'));
    try {
      const response = await Api.fc.accountUpdate();
      $('.select_loader_container').text('');
      $('.default_message_expire').val(Number(response.result.default_message_expire).toString()).prop('disabled', false).css('display', 'inline-block');
      $('.default_message_expire').change(Ui.event.handle(onDefaultExpireUserChange));
    } catch (e) {
      if (Api.err.isAuthErr(e)) {
        const showAuthErr = () => Settings.redirectSubPage(acctEmail, parentTabId, '/chrome/elements/subscribe.htm', { isAuthErr: true });
        Xss.sanitizeRender('.expiration_container', '(unknown: <a href="#">verify your device</a>)').find('a').click(Ui.event.handle(showAuthErr));
      } else if (Api.err.isNetErr(e)) {
        Xss.sanitizeRender('.expiration_container', '(network error: <a href="#">retry</a>)').find('a').click(() => window.location.reload()); // safe source
      } else {
        Catch.handleErr(e);
        Xss.sanitizeRender('.expiration_container', '(unknown error: <a href="#">retry</a>)').find('a').click(() => window.location.reload()); // safe source
      }
    }
  } else {
    $('.default_message_expire').val('3').css('display', 'inline-block');
    const showSubscribe = () => Settings.redirectSubPage(acctEmail, parentTabId, '/chrome/elements/subscribe.htm');
    Xss.sanitizeAppend($('.default_message_expire').parent(), '<a href="#">upgrade</a>').find('a').click(Ui.event.handle(showSubscribe));
  }

})();
