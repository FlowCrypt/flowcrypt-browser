/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Assert } from '../../js/common/assert.js';
import { BrowserMsg } from '../../js/common/browser/browser-msg.js';
import { Catch } from '../../js/common/platform/catch.js';
import { Key, KeyUtil } from '../../js/common/core/crypto/key.js';
import { PgpArmor } from '../../js/common/core/crypto/pgp/pgp-armor.js';
import { Str } from '../../js/common/core/common.js';
import { Ui } from '../../js/common/browser/ui.js';
import { Url } from '../../js/common/core/common.js';
import { View } from '../../js/common/view.js';
import { Xss } from '../../js/common/platform/xss.js';
import { ContactStore } from '../../js/common/platform/store/contact-store.js';

// todo - this should use KeyImportUI for consistency.
View.run(class PgpPubkeyView extends View {
  private readonly acctEmail: string;
  private readonly parentTabId: string;
  private readonly armoredPubkey: string;
  private readonly frameId: string;
  private readonly compact: boolean; // means the details take up very little space.
  private readonly minimized: boolean; // means I have to click to see details.
  private publicKeys: Key[] | undefined;
  private primaryPubKey: Key | undefined;
  private isExpired: boolean | undefined;

  constructor() {
    super();
    const uncheckedUrlParams = Url.parse(['acctEmail', 'armoredPubkey', 'parentTabId', 'minimized', 'compact', 'frameId']);
    this.acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
    this.parentTabId = Assert.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');
    this.armoredPubkey = PgpArmor.normalize(Assert.urlParamRequire.string(uncheckedUrlParams, 'armoredPubkey'), 'publicKey');
    this.frameId = Assert.urlParamRequire.string(uncheckedUrlParams, 'frameId');
    this.compact = uncheckedUrlParams.compact === true;
    this.minimized = uncheckedUrlParams.minimized === true;
  }

  public render = async () => {
    Ui.event.protect();
    try {
      const pubKey = await KeyUtil.parse(this.armoredPubkey);
      this.isExpired = KeyUtil.expired(pubKey);
      if (pubKey.revoked) {
        await ContactStore.saveRevocation(undefined, pubKey);
      }
      this.publicKeys = [pubKey];
    } catch (e) {
      console.error('Unusable key: ' + e);
      this.publicKeys = [];
    }
    this.primaryPubKey = this.publicKeys ? this.publicKeys[0] : undefined;
    $('.pubkey').text(this.armoredPubkey);
    if (this.compact) {
      $('.hide_if_compact').remove();
      $('body').css({ border: 'none', padding: 0 });
      $('.line').removeClass('line');
    }
    $('.line.fingerprints, .line.add_contact').css('display', this.minimized ? 'none' : 'block');
    if (this.publicKeys.length === 1) {
      $('.line.fingerprints .fingerprint').text(Str.spaced(this.primaryPubKey?.id || 'err'));
    } else {
      $('.line.fingerprints').css({ display: 'none' });
    }
    if (this.primaryPubKey) {
      if (!this.primaryPubKey.usableForEncryptionButExpired && !this.primaryPubKey.usableForSigningButExpired
        && !this.primaryPubKey.usableForEncryption && !this.primaryPubKey.usableForSigning) {
        this.showKeyNotUsableError();
      } else {
        if (this.compact) {
          $('.hide_if_compact_and_not_error').remove();
        }
        let emailText = '';
        if (this.publicKeys.length === 1) {
          const email = this.primaryPubKey.emails[0];
          if (email) {
            emailText = email;
            $('.input_email').val(email); // checked above
          }
        } else {
          emailText = 'more than one person';
          $('.input_email').css({ display: 'none' });
          Xss.sanitizeAppend('.add_contact', Xss.escape(' for ' + this.publicKeys.map(pub => pub.emails[0]).filter(e => !!e).join(', ')));
        }
        Xss.sanitizePrepend('#pgp_block.pgp_pubkey .result', `<span>This message includes a Public Key for <span class= "email">${Xss.escape(emailText)}</span>.</span>`);
        $('.pubkey').addClass('good');
        this.setBtnText().catch(Catch.reportErr);
      }
    } else {
      let fixed = this.armoredPubkey;
      while (/\n> |\n>\n/.test(fixed)) {
        fixed = fixed.replace(/\n> /g, '\n').replace(/\n>\n/g, '\n\n');
      }
      if (fixed !== this.armoredPubkey) { // try to re-render it after un-quoting, (minimized because it is probably their own pubkey quoted by the other guy)
        window.location.href = Url.create('pgp_pubkey.htm', {
          armoredPubkey: fixed, minimized: true,
          acctEmail: this.acctEmail, parentTabId: this.parentTabId, frameId: this.frameId
        });
      } else {
        this.showKeyNotUsableError();
      }
    }
    this.sendResizeMsg();
  };

  public setHandlers = () => {
    $('.action_add_contact').click(this.setHandler(btn => this.addContactHandler(btn)));
    $('.input_email').keyup(this.setHandler(() => this.setBtnText()));
    $('.action_show_full').click(this.setHandler(btn => this.showFullKeyHandler(btn)));
  };

  private sendResizeMsg = () => {
    const origHeight = $('#pgp_block').height();
    if (!origHeight) { // https://github.com/FlowCrypt/flowcrypt-browser/issues/3519
      // unsure why this happens. Sometimes height will come in as exactly 0 after the iframe was already properly sized
      // that then causes to default to 30px for height, hiding contents of the iframe if it in fact is taller
      return;
    }
    const desiredHeight = origHeight + (this.compact ? 10 : 30);
    BrowserMsg.send.setCss(this.parentTabId, { selector: `iframe#${this.frameId}`, css: { height: `${desiredHeight}px` } });
  };

  private setBtnText = async () => {
    if (this.publicKeys!.length > 1) {
      $('.action_add_contact').text('import ' + this.publicKeys!.length + ' public keys');
    } else {
      const contactWithPubKeys = await ContactStore.getOneWithAllPubkeys(
        undefined, String($('.input_email').val()));
      $('.action_add_contact')
        .text((contactWithPubKeys && contactWithPubKeys.sortedPubkeys && contactWithPubKeys.sortedPubkeys.length > 0)
          ? 'update key' : `import ${this.isExpired ? 'expired ' : ''}key`)
        .css('background-color', this.isExpired ? '#989898' : '');
    }
  };

  private showKeyNotUsableError = () => {
    $('.fingerprints, .add_contact, #manual_import_warning').remove();
    $('#pgp_block.pgp_pubkey .result')
      .prepend('<span class="bad">This OpenPGP key is not usable.</span>'); // xss-direct
    $('.pubkey').addClass('bad');
  };

  private addContactHandler = async (addContactBtn: HTMLElement) => {
    if (this.publicKeys!.length > 1) {
      const emails = new Set<string>();
      for (const pubkey of this.publicKeys!) {
        const email = pubkey.emails[0];
        if (email) {
          await ContactStore.update(undefined, email, { pubkey: KeyUtil.armor(pubkey) });
          emails.add(email);
        }
      }
      Xss.sanitizeReplace(addContactBtn, '<span class="good">added public keys</span>');
      BrowserMsg.send.addToContacts(this.parentTabId);
      for (const email of emails) {
        BrowserMsg.send.reRenderRecipient('broadcast', { email });
      }
      $('.input_email').remove();
    } else if (this.publicKeys!.length) {
      if (Str.isEmailValid(String($('.input_email').val()))) {
        const email = String($('.input_email').val());
        await ContactStore.update(undefined, email, { pubkey: KeyUtil.armor(this.publicKeys![0]) });
        BrowserMsg.send.addToContacts(this.parentTabId);
        Xss.sanitizeReplace(addContactBtn, `<span class="good">${Xss.escape(String($('.input_email').val()))} added</span>`);
        $('.input_email').remove();
        BrowserMsg.send.reRenderRecipient('broadcast', { email });
      } else {
        await Ui.modal.error('This email is invalid, please check for typos. Not added.');
        $('.input_email').focus();
      }
    }
  };

  private showFullKeyHandler = (showFullBtn: HTMLElement) => {
    $(showFullBtn).css('display', 'none');
    $('pre.pubkey, .line.fingerprints, .line.add_contact').css('display', 'block');
    this.sendResizeMsg();
  };
});
