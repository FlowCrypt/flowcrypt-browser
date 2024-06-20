/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch } from '../platform/catch.js';
import { KeyImportUi } from './key-import-ui.js';
import { Ui } from '../browser/ui.js';
import { Api } from '../api/shared/api.js';

export class FetchKeyUI {
  public handleOnPaste = (elem: JQuery) => {
    elem.on(
      'paste',
      Ui.event.handle(async (elem: HTMLInputElement, event) => {
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
      })
    );
  };

  private fetchPubkey = async (url: string) => {
    try {
      const result: string = await Api.ajax({ url, method: 'GET', stack: Catch.stackTrace() }, 'text');
      const keyImportUi = new KeyImportUi({ checkEncryption: true });
      return await keyImportUi.checkPub(result);
    } catch (e) {
      return;
    }
  };
}
