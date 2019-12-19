/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store } from '../../../js/common/platform/store.js';
import { Att } from '../../../js/common/core/att.js';
import { Browser } from '../../../js/common/browser/browser.js';
import { KeyInfo } from '../../../js/common/core/pgp-key.js';
import { Attester } from '../../../js/common/api/attester.js';
import { Backend } from '../../../js/common/api/backend.js';
import { Assert } from '../../../js/common/assert.js';
import { Buf } from '../../../js/common/core/buf.js';
import { Url } from '../../../js/common/core/common.js';
import { View } from '../../../js/common/view.js';
import { ApiErr } from '../../../js/common/api/error/api-error.js';
import { PgpKey } from '../../../js/common/core/pgp-key.js';

declare const ClipboardJS: any;

View.run(class MyKeyView extends View {
  private readonly acctEmail: string;
  private readonly longid: string;
  private readonly myKeyUserIdsUrl: string;
  private readonly myKeyUpdateUrl: string;
  private primaryKi: KeyInfo | undefined;

  constructor() {
    super();
    const uncheckedUrlParams = Url.parse(['acctEmail', 'longid', 'parentTabId']);
    this.acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
    this.longid = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'longid') || 'primary';
    this.myKeyUserIdsUrl = Url.create('my_key_user_ids.htm', uncheckedUrlParams);
    this.myKeyUpdateUrl = Url.create('my_key_update.htm', uncheckedUrlParams);
  }

  render = async () => {
    [this.primaryKi] = await Store.keysGet(this.acctEmail, [this.longid]);
    Assert.abortAndRenderErrorIfKeyinfoEmpty(this.primaryKi);
    const prv = await PgpKey.read(this.primaryKi.private);
    $('.action_view_user_ids').attr('href', this.myKeyUserIdsUrl);
    $('.action_view_update').attr('href', this.myKeyUpdateUrl);
    $('.key_words').text(this.primaryKi.keywords);
    $('.email').text(this.acctEmail);
    $('.key_fingerprint').text(await PgpKey.fingerprint(prv, 'spaced') || '(unknown fingerprint)');
    await this.setPubkeyContainer();
  }

  setHandlers = () => {
    $('.action_download_pubkey').click(this.setHandlerPrevent('double', () => this.downloadPubKeyHandler()));
    $('.action_download_prv').click(this.setHandlerPrevent('double', () => this.downloadPrvKeyHandler()));
    const clipboardOpts = { text: (trigger: HTMLElement) => trigger.className.includes('action_copy_pubkey') ? this.primaryKi!.public : this.primaryKi!.private };
    new ClipboardJS('.action_copy_pubkey, .action_copy_prv', clipboardOpts); // tslint:disable-line:no-unused-expression no-unsafe-any
  }

  private setPubkeyContainer = async () => {
    try {
      const result = await Attester.lookupEmail(this.acctEmail);
      const url = Backend.url('pubkey', this.acctEmail);
      if (result.pubkey && await PgpKey.longid(result.pubkey) === this.primaryKi!.longid) {
        $('.pubkey_link_container a').text(url.replace('https://', '')).attr('href', url).parent().css('display', '');
      } else {
        $('.pubkey_link_container').remove();
      }
    } catch (e) {
      ApiErr.reportIfSignificant(e);
      $('.pubkey_link_container').remove();
    }
  }

  private downloadPubKeyHandler = () => {
    Browser.saveToDownloads(Att.keyinfoAsPubkeyAtt(this.primaryKi!));
  }

  private downloadPrvKeyHandler = () => {
    const name = `flowcrypt-backup-${this.acctEmail.replace(/[^A-Za-z0-9]+/g, '')}-0x${this.primaryKi!.longid}.asc`;
    const prvKeyAtt = new Att({ data: Buf.fromUtfStr(this.primaryKi!.private), type: 'application/pgp-keys', name });
    Browser.saveToDownloads(prvKeyAtt);
  }
});
