/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Att } from '../../../js/common/core/att.js';
import { PgpBlockView } from '../pgp_block';
import { Store } from '../../../js/common/platform/store.js';
import { BrowserMsg } from '../../../js/common/browser/browser-msg.js';
import { Browser } from '../../../js/common/browser/browser.js';
import { Xss } from '../../../js/common/platform/xss.js';
import { Str } from '../../../js/common/core/common.js';
import { Api } from '../../../js/common/api/api.js';
import { Ui } from '../../../js/common/browser/ui.js';

export class PgpBlockViewAttachmentsModule {

  public includedAtts: Att[] = [];

  constructor(private view: PgpBlockView) {
  }

  public renderInnerAtts = (atts: Att[]) => {
    Xss.sanitizeAppend('#pgp_block', '<div id="attachments"></div>');
    this.includedAtts = atts;
    for (const i of atts.keys()) {
      const name = (atts[i].name ? Xss.escape(atts[i].name) : 'noname').replace(/\.(pgp|gpg)$/, '');
      const size = Str.numberFormat(Math.ceil(atts[i].length / 1024)) + 'KB';
      const htmlContent = `<b>${Xss.escape(name)}</b>&nbsp;&nbsp;&nbsp;${size}<span class="progress"><span class="percent"></span></span>`;
      Xss.sanitizeAppend('#attachments', `<div class="attachment" index="${Number(i)}">${htmlContent}</div>`);
    }
    this.view.renderModule.resizePgpBlockFrame();
    $('div.attachment').click(this.view.setHandlerPrevent('double', async target => {
      const att = this.includedAtts[Number($(target).attr('index'))];
      if (att.hasData()) {
        Browser.saveToDownloads(att, $(target));
        this.view.renderModule.resizePgpBlockFrame();
      } else {
        Xss.sanitizePrepend($(target).find('.progress'), Ui.spinner('green'));
        att.setData(await Api.download(att.url!, (perc, load, total) => this.renderProgress($(target).find('.progress .percent'), perc, load, total || att.length)));
        await Ui.delay(100); // give browser time to render
        $(target).find('.progress').text('');
        await this.decryptAndSaveAttToDownloads(att, $(target));
      }
    }));
  }

  private decryptAndSaveAttToDownloads = async (encrypted: Att, renderIn: JQuery<HTMLElement>) => {
    const kisWithPp = await Store.keysGetAllWithPp(this.view.acctEmail);
    const decrypted = await BrowserMsg.send.bg.await.pgpMsgDecrypt({ kisWithPp, encryptedData: encrypted.getData(), msgPwd: await this.view.pwdEncryptedMsgModule.getDecryptPwd() });
    if (decrypted.success) {
      const att = new Att({ name: encrypted.name.replace(/\.(pgp|gpg)$/, ''), type: encrypted.type, data: decrypted.content });
      Browser.saveToDownloads(att, renderIn);
      this.view.renderModule.resizePgpBlockFrame();
    } else {
      delete decrypted.message;
      console.info(decrypted);
      await Ui.modal.error(`There was a problem decrypting this file (${decrypted.error.type}: ${decrypted.error.message}). Downloading encrypted original.`);
      Browser.saveToDownloads(encrypted, renderIn);
      this.view.renderModule.resizePgpBlockFrame();
    }
  }

  private renderProgress = (element: JQuery<HTMLElement>, percent: number | undefined, received: number | undefined, size: number) => {
    if (percent) {
      element.text(percent + '%');
    } else if (size && received) {
      element.text(Math.floor(((received * 0.75) / size) * 100) + '%');
    }
  }

}
