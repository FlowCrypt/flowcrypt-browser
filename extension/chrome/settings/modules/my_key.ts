/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { ApiErr } from '../../../js/common/api/error/api-error.js';
import { Assert } from '../../../js/common/assert.js';
import { Att } from '../../../js/common/core/att.js';
import { Backend } from '../../../js/common/api/backend.js';
import { Browser } from '../../../js/common/browser/browser.js';
import { Buf } from '../../../js/common/core/buf.js';
import { KeyInfo } from '../../../js/common/core/pgp-key.js';
import { PgpKey } from '../../../js/common/core/pgp-key.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { Url, Str } from '../../../js/common/core/common.js';
import { View } from '../../../js/common/view.js';
import { initPassphraseToggle } from '../../../js/common/ui/passphrase-ui.js';
import { PubLookup } from '../../../js/common/api/pub-lookup.js';
import { Rules } from '../../../js/common/rules.js';
import { PassphraseStore } from '../../../js/common/platform/store/passphrase-store.js';
import { KeyStore } from '../../../js/common/platform/store/key-store.js';

declare const ClipboardJS: any;

View.run(class MyKeyView extends View {

  private readonly acctEmail: string;
  private readonly longid: string;
  private readonly myKeyUserIdsUrl: string;
  private readonly myKeyUpdateUrl: string;
  private keyInfo!: KeyInfo;
  private rules!: Rules;
  private pubLookup!: PubLookup;

  constructor() {
    super();
    const uncheckedUrlParams = Url.parse(['acctEmail', 'longid', 'parentTabId']);
    this.acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
    this.longid = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'longid') || 'primary';
    this.myKeyUserIdsUrl = Url.create('my_key_user_ids.htm', uncheckedUrlParams);
    this.myKeyUpdateUrl = Url.create('my_key_update.htm', uncheckedUrlParams);
  }

  public render = async () => {
    this.rules = await Rules.newInstance(this.acctEmail);
    this.pubLookup = new PubLookup(this.rules);
    [this.keyInfo] = await KeyStore.get(this.acctEmail, [this.longid]);
    Assert.abortAndRenderErrorIfKeyinfoEmpty(this.keyInfo);
    $('.action_view_user_ids').attr('href', this.myKeyUserIdsUrl);
    $('.action_view_update').attr('href', this.myKeyUpdateUrl);
    $('.fingerprint').text(Str.spaced(this.keyInfo.fingerprint));
    $('.email').text(this.acctEmail);
    await this.setPubkeyContainer();
    await initPassphraseToggle(['input_passphrase']);
  }

  public setHandlers = () => {
    $('.action_download_pubkey').click(this.setHandlerPrevent('double', () => this.downloadPubKeyHandler()));
    $('.action_download_prv').click(this.setHandlerPrevent('double', () => this.downloadPrvKeyHandler()));
    $('.action_download_revocation_cert').click(this.setHandlerPrevent('double', () => this.downloadRevocationCert()));
    $('.action_continue_download').click(this.setHandlerPrevent('double', () => this.downloadRevocationCert(String($('#input_passphrase').val()))));
    $('#input_passphrase').on('keydown', this.setEnterHandlerThatClicks('.action_continue_download'));
    $('.action_cancel_download_cert').click(this.setHandler(() => { $('.enter_pp').hide(); }));
    const clipboardOpts = { text: (trigger: HTMLElement) => trigger.className.includes('action_copy_pubkey') ? this.keyInfo.public : this.keyInfo.private };
    new ClipboardJS('.action_copy_pubkey, .action_copy_prv', clipboardOpts); // tslint:disable-line:no-unused-expression no-unsafe-any
  }

  private setPubkeyContainer = async () => {
    try {
      const result = await this.pubLookup.attester.lookupEmail(this.acctEmail);
      const url = Backend.url('pubkey', this.acctEmail);
      if (result.pubkey && await PgpKey.fingerprint(result.pubkey) === this.keyInfo.fingerprint) {
        $('.pubkey_link_container a').text(url.replace('https://', '')).attr('href', url).parent().css('display', '');
      } else {
        $('.pubkey_link_container').remove();
      }
    } catch (e) {
      ApiErr.reportIfSignificant(e);
      $('.pubkey_link_container').remove();
    }
  }

  private downloadRevocationCert = async (enteredPP?: string) => {
    const prv = await PgpKey.read(this.keyInfo.private);
    if (!prv.isFullyDecrypted()) {
      const passphrase = await PassphraseStore.get(this.acctEmail, this.keyInfo.longid) || enteredPP;
      if (passphrase) {
        if (! await PgpKey.decrypt(prv, passphrase) && enteredPP) {
          await Ui.modal.error('Pass phrase did not match, please try again.');
          return;
        }
      } else {
        $('.enter_pp').show();
        return;
      }
    }
    $('.enter_pp').hide();
    $('#input_passphrase').val('');
    let revokeConfirmMsg = `Revocation cert is used when you want to revoke your Public Key (meaning you are asking others to stop using it).\n\n`;
    revokeConfirmMsg += `You can save it do your hard drive, and use it later in case you ever need it.\n\n`;
    revokeConfirmMsg += `Would you like to generate and save a revocation cert now?`;
    if (! await Ui.modal.confirm(revokeConfirmMsg)) {
      return;
    }
    const revokedArmored = await PgpKey.revoke(prv);
    if (!revokedArmored) {
      await Ui.modal.error(`Could not produce revocation cert (empty)`);
      return;
    }
    const name = `${this.acctEmail.replace(/[^a-z0-9]+/g, '')}-0x${this.keyInfo.longid}.revocation-cert.asc`;
    const prvKeyAtt = new Att({ data: Buf.fromUtfStr(revokedArmored), type: 'application/pgp-keys', name });
    Browser.saveToDownloads(prvKeyAtt);
  }

  private downloadPubKeyHandler = () => {
    Browser.saveToDownloads(Att.keyinfoAsPubkeyAtt(this.keyInfo));
  }

  private downloadPrvKeyHandler = () => {
    const name = `flowcrypt-backup-${this.acctEmail.replace(/[^A-Za-z0-9]+/g, '')}-0x${this.keyInfo.longid}.asc`;
    const prvKeyAtt = new Att({ data: Buf.fromUtfStr(this.keyInfo.private), type: 'application/pgp-keys', name });
    Browser.saveToDownloads(prvKeyAtt);
  }

});
