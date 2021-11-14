/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { BrowserMsg } from '../browser/browser-msg.js';
import { Catch } from '../platform/catch.js';
import { KeyImportUi } from './key-import-ui.js';
import { Ui } from '../browser/ui.js';

export class FetchKeyUI {
  public handleOnPaste = (elem: JQuery<HTMLElement>) => {
    elem.on('paste', Ui.event.handle(async (elem: HTMLInputElement, event) => {
      const clipboardEvent = event.originalEvent as ClipboardEvent;
      if (clipboardEvent.clipboardData) {
        const possiblyURL = clipboardEvent.clipboardData.getData('text');
        const pattern = /(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#:.?+=&%@!\-\/]))?/;
        if (pattern.test(possiblyURL)) {
          const pubkey = await this.fetchPubkey(possiblyURL);
          if (pubkey) {
            elem.value = pubkey;
          }
        }
      }
    }));
  };

  private fetchPubkey = async (url: string) => {
    try {
      // tslint:disable-next-line: no-direct-ajax
      const result = (await BrowserMsg.send.bg.await.ajax({ req: { url, type: 'GET', dataType: 'text', async: true }, stack: Catch.stackTrace() })) as string;
      const keyImportUi = new KeyImportUi({ checkEncryption: true });
      return await keyImportUi.checkPub(result);
    } catch (e) {
      return;
    }
  };
}
