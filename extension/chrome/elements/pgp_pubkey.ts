/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store, Contact } from '../../js/common/store.js';
import { Catch, Env, Str } from './../../js/common/common.js';
import { Xss, Ui } from '../../js/common/browser.js';
import { mnemonic } from './../../js/common/mnemonic.js';

import { Pgp } from '../../js/common/pgp.js';
import { BrowserMsg } from '../../js/common/extension.js';

declare let openpgp: typeof OpenPGP;

Catch.try(async () => {

  // todo - this should use KeyImportUI for consistency. Needs general refactoring, hard to follow.

  Ui.event.protect();

  let urlParams = Env.urlParams(['acctEmail', 'armoredPubkey', 'parentTabId', 'minimized', 'compact', 'frameId']);
  let acctEmail = Env.urlParamRequire.string(urlParams, 'acctEmail');
  let parentTabId = Env.urlParamRequire.string(urlParams, 'parentTabId');
  let armoredPubkey = Env.urlParamRequire.string(urlParams, 'armoredPubkey');
  let frameId = Env.urlParamRequire.string(urlParams, 'frameId');
  // minimized means I have to click to see details. Compact means the details take up very little space.

  let pubkeys: OpenPGP.key.Key[] = openpgp.key.readArmored(armoredPubkey).keys;

  let sendResizeMsg = () => {
    let desiredHeight = $('#pgp_block').height()! + (urlParams.compact ? 10 : 30); // #pgp_block is defined in template
    BrowserMsg.send(parentTabId, 'set_css', { selector: `iframe#${frameId}`, css: { height: `${desiredHeight}px` } });
  };

  let setBtnText = async () => {
    if (pubkeys.length > 1) {
      $('.action_add_contact').text('import ' + pubkeys.length + ' public keys');
    } else {
      let [contact] = await Store.dbContactGet(null, [$('.input_email').val() as string]); // text input
      $('.action_add_contact').text(contact && contact.has_pgp ? 'update contact' : 'add to contacts');
    }
  };

  let render = async () => {
    $('.pubkey').text(urlParams.armoredPubkey as string);
    if (urlParams.compact) {
      $('.hide_if_compact').remove();
      $('body').css({ border: 'none', padding: 0 });
      $('.line').removeClass('line');
    }
    $('.line.fingerprints, .line.add_contact').css('display', urlParams.minimized ? 'none' : 'block');
    if (pubkeys.length === 1) {
      $('.line.fingerprints .fingerprint').text(Pgp.key.fingerprint(pubkeys[0], 'spaced') as string);
      $('.line.fingerprints .keywords').text(mnemonic(Pgp.key.longid(pubkeys[0]) || '') || '');
    } else {
      $('.line.fingerprints').css({ display: 'none' });
    }
    if (typeof pubkeys[0] !== 'undefined') {
      if ((await pubkeys[0].getEncryptionKey() === null) && (await pubkeys[0].getSigningKey() === null)) {
        $('.line.add_contact').addClass('bad').text('This public key looks correctly formatted, but cannot be used for encryption. Email human@flowcrypt.com to get this resolved.');
        $('.line.fingerprints').css({ display: 'none', visibility: 'hidden' });
      } else {
        if (pubkeys.length === 1) {
          let email = pubkeys[0].users[0].userId ? Str.parseEmail(pubkeys[0].users[0].userId ? pubkeys[0].users[0].userId!.userid : '').email : null;
          if (email) {
            $('.input_email').val(email); // checked above
            $('.email').text(email);
          }
        } else {
          $('.email').text('more than one person');
          $('.input_email').css({ display: 'none' });
          let pubToEmail = (pubkey: OpenPGP.key.Key) => Str.parseEmail(pubkey.users[0].userId ? pubkey.users[0].userId!.userid : '').email;
          Xss.sanitizeAppend('.add_contact', Xss.escape(' for ' + pubkeys.map(pubToEmail).filter(e => Str.isEmailValid(e)).join(', ')));
        }
        setBtnText().catch(Catch.rejection);
      }
    } else {
      let fixed = urlParams.armoredPubkey as string;
      while (/\n> |\n>\n/.test(fixed)) {
        fixed = fixed.replace(/\n> /g, '\n').replace(/\n>\n/g, '\n\n');
      }
      if (fixed !== urlParams.armoredPubkey) { // try to re-render it after un-quoting, (minimized because it is probably their own pubkey quoted by the other guy)
        window.location.href = Env.urlCreate('pgp_pubkey.htm', {
          armoredPubkey: fixed, minimized: true, acctEmail: urlParams.acctEmail, parentTabId: urlParams.parentTabId, frameId: urlParams.frameId
        });
      } else {
        $('.line.add_contact').addClass('bad').text('This public key is invalid or has unknown format.');
        $('.line.fingerprints').css({ display: 'none', visibility: 'hidden' });
      }
    }
  };

  $('.action_add_contact').click(Ui.event.handle(async target => {
    if (pubkeys.length > 1) {
      let contacts: Contact[] = [];
      for (let pubkey of pubkeys) {
        let emailAddr = Str.parseEmail(pubkey.users[0].userId ? pubkey.users[0].userId!.userid : '').email;
        if (Str.isEmailValid(emailAddr)) {
          contacts.push(Store.dbContactObj(emailAddr, undefined, 'pgp', pubkey.armor(), undefined, false, Date.now()));
        }
      }
      await Store.dbContactSave(null, contacts);
      Xss.sanitizeReplace(target, '<span class="good">added public keys</span>');
      $('.input_email').remove();
    } else if (pubkeys.length) {
      if (Str.isEmailValid($('.input_email').val() as string)) { // text input
        let contact = Store.dbContactObj($('.input_email').val() as string, undefined, 'pgp', pubkeys[0].armor(), undefined, false, Date.now()); // text input
        await Store.dbContactSave(null, contact);
        Xss.sanitizeReplace(target, `<span class="good">${Xss.escape(String($('.input_email').val()))} added</span>`);
        $('.input_email').remove();
      } else {
        alert('This email is invalid, please check for typos. Not added.');
        $('.input_email').focus();
      }
    }
  }));

  $('.input_email').keyup(() => setBtnText());

  $('.action_show_full').click(Ui.event.handle(target => {
    $(target).css('display', 'none');
    $('pre.pubkey, .line.fingerprints, .line.add_contact').css('display', 'block');
    sendResizeMsg();
  }));

  await render();
  sendResizeMsg();

})();
