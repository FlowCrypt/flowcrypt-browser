/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch } from '../../js/common/platform/catch.js';
import { Store } from '../../js/common/platform/store.js';
import { Str } from '../../js/common/core/common.js';
import { Xss, Ui, Env } from '../../js/common/browser.js';
import { mnemonic } from '../../js/common/core/mnemonic.js';
import { Pgp, Contact } from '../../js/common/core/pgp.js';
import { BrowserMsg } from '../../js/common/extension.js';

declare const openpgp: typeof OpenPGP;

Catch.try(async () => {

  // todo - this should use KeyImportUI for consistency. Needs general refactoring, hard to follow.

  Ui.event.protect();

  // minimized means I have to click to see details. Compact means the details take up very little space.
  const uncheckedUrlParams = Env.urlParams(['acctEmail', 'armoredPubkey', 'parentTabId', 'minimized', 'compact', 'frameId']);
  const acctEmail = Env.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
  const parentTabId = Env.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');
  const armoredPubkey = Env.urlParamRequire.string(uncheckedUrlParams, 'armoredPubkey');
  const frameId = Env.urlParamRequire.string(uncheckedUrlParams, 'frameId');
  const compact = uncheckedUrlParams.compact === true;
  const minimized = uncheckedUrlParams.minimized === true;

  const { keys: pubs } = await openpgp.key.readArmored(armoredPubkey);

  const sendResizeMsg = () => {
    const desiredHeight = $('#pgp_block').height()! + (compact ? 10 : 30); // #pgp_block is defined in template
    BrowserMsg.send.setCss(parentTabId, { selector: `iframe#${frameId}`, css: { height: `${desiredHeight}px` } });
  };

  const setBtnText = async () => {
    if (pubs.length > 1) {
      $('.action_add_contact').text('import ' + pubs.length + ' public keys');
    } else {
      const [contact] = await Store.dbContactGet(undefined, [String($('.input_email').val())]);
      $('.action_add_contact').text(contact && contact.has_pgp ? 'update contact' : 'add to contacts');
    }
  };

  const render = async () => {
    $('.pubkey').text(armoredPubkey);
    if (compact) {
      $('.hide_if_compact').remove();
      $('body').css({ border: 'none', padding: 0 });
      $('.line').removeClass('line');
    }
    $('.line.fingerprints, .line.add_contact').css('display', minimized ? 'none' : 'block');
    if (pubs.length === 1) {
      $('.line.fingerprints .fingerprint').text(await Pgp.key.fingerprint(pubs[0], 'spaced') || '(fingerprint error)');
      $('.line.fingerprints .keywords').text(mnemonic(await Pgp.key.longid(pubs[0]) || '') || '(mnemonic error)');
    } else {
      $('.line.fingerprints').css({ display: 'none' });
    }
    if (typeof pubs[0] !== 'undefined') {
      if (! await pubs[0].getEncryptionKey() && ! await pubs[0].getSigningKey()) {
        $('.line.add_contact').addClass('bad').text('This public key looks correctly formatted, but cannot be used for encryption. Email human@flowcrypt.com to get this resolved.');
        $('.line.fingerprints').css({ display: 'none', visibility: 'hidden' });
      } else {
        if (pubs.length === 1) {
          const email = pubs[0].users[0].userId ? Str.parseEmail(pubs[0].users[0].userId ? pubs[0].users[0].userId!.userid : '').email : undefined;
          if (email) {
            $('.input_email').val(email); // checked above
            $('.email').text(email);
          }
        } else {
          $('.email').text('more than one person');
          $('.input_email').css({ display: 'none' });
          const pubToEmail = (pubkey: OpenPGP.key.Key) => Str.parseEmail(pubkey.users[0].userId ? pubkey.users[0].userId!.userid : '').email;
          Xss.sanitizeAppend('.add_contact', Xss.escape(' for ' + pubs.map(pubToEmail).filter(e => Str.isEmailValid(e)).join(', ')));
        }
        setBtnText().catch(Catch.reportErr);
      }
    } else {
      let fixed = armoredPubkey;
      while (/\n> |\n>\n/.test(fixed)) {
        fixed = fixed.replace(/\n> /g, '\n').replace(/\n>\n/g, '\n\n');
      }
      if (fixed !== armoredPubkey) { // try to re-render it after un-quoting, (minimized because it is probably their own pubkey quoted by the other guy)
        window.location.href = Env.urlCreate('pgp_pubkey.htm', { armoredPubkey: fixed, minimized: true, acctEmail, parentTabId, frameId });
      } else {
        $('.line.add_contact').addClass('bad').text('This public key is invalid or has unknown format.');
        $('.line.fingerprints').css({ display: 'none', visibility: 'hidden' });
      }
    }
  };

  $('.action_add_contact').click(Ui.event.handle(async target => {
    if (pubs.length > 1) {
      const contacts: Contact[] = [];
      for (const pubkey of pubs) {
        const emailAddr = Str.parseEmail(pubkey.users[0].userId ? pubkey.users[0].userId!.userid : '').email;
        if (Str.isEmailValid(emailAddr)) {
          contacts.push(await Store.dbContactObj(emailAddr, undefined, 'pgp', pubkey.armor(), false, Date.now()));
        }
      }
      await Store.dbContactSave(undefined, contacts);
      Xss.sanitizeReplace(target, '<span class="good">added public keys</span>');
      $('.input_email').remove();
    } else if (pubs.length) {
      if (Str.isEmailValid(String($('.input_email').val()))) {
        const contact = await Store.dbContactObj(String($('.input_email').val()), undefined, 'pgp', pubs[0].armor(), false, Date.now());
        await Store.dbContactSave(undefined, contact);
        Xss.sanitizeReplace(target, `<span class="good">${Xss.escape(String($('.input_email').val()))} added</span>`);
        $('.input_email').remove();
      } else {
        await Ui.modal.error('This email is invalid, please check for typos. Not added.');
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
