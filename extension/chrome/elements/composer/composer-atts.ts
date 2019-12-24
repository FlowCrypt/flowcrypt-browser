/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypcom */

'use strict';

import { AttLimits, AttUI } from '../../../js/common/ui/att_ui.js';

import { BrowserMsg } from '../../../js/common/browser/browser-msg.js';
import { Composer } from './composer.js';
import { ComposerComponent } from './composer-abstract-component.js';
import { PgpHash } from '../../../js/common/core/pgp-hash.js';
import { Rules } from '../../../js/common/rules.js';
import { Store } from '../../../js/common/platform/store.js';
import { Ui } from '../../../js/common/browser/ui.js';

export class ComposerAtts extends ComposerComponent {

  public attach: AttUI;

  constructor(composer: Composer) {
    super(composer);
    this.attach = new AttUI(() => this.getMaxAttSizeAndOversizeNotice());
  }

  initActions = () => {
    // none
  }

  onComposeTableRender = () => {
    this.attach.initAttDialog('fineuploader', 'fineuploader_button', {
      uiChanged: () => {
        this.composer.size.setInputTextHeightManuallyIfNeeded();
        this.composer.size.resizeComposeBox();
      }
    });
  }

  private getMaxAttSizeAndOversizeNotice = async (): Promise<AttLimits> => {
    const subscription = await Store.subscription(this.view.acctEmail);
    if (!Rules.isPublicEmailProviderDomain(this.composer.sender.getSender()) && !subscription.active) {
      return {
        sizeMb: 5,
        size: 5 * 1024 * 1024,
        count: 10,
        oversize: async () => {
          let getAdvanced = 'The files are over 5 MB. Advanced users can send files up to 25 MB.';
          if (!subscription.method) {
            getAdvanced += '\n\nTry it free for 30 days.';
          } else if (subscription.method === 'trial') {
            getAdvanced += '\n\nYour trial has expired, please consider supporting our efforts by upgrading.';
          } else if (subscription.method === 'group') {
            getAdvanced += '\n\nGroup billing is due for renewal. Please check with your leadership.';
          } else if (subscription.method === 'stripe') {
            getAdvanced += '\n\nPlease renew your subscription to continue sending large files.';
          } else {
            getAdvanced += '\n\nClick ok to see subscribe options.';
          }
          if (subscription.method === 'group') {
            await Ui.modal.info(getAdvanced);
          } else {
            if (await Ui.modal.confirm(getAdvanced)) {
              BrowserMsg.send.subscribeDialog(this.view.parentTabId, {});
            }
          }
          return;
        },
      };
    } else {
      const allowHugeAtts = ['94658c9c332a11f20b1e45c092e6e98a1e34c953', 'b092dcecf277c9b3502e20c93b9386ec7759443a', '9fbbe6720a6e6c8fc30243dc8ff0a06cbfa4630e'];
      const sizeMb = (subscription.method !== 'trial' && allowHugeAtts.includes(await PgpHash.sha1UtfStr(this.view.acctEmail))) ? 200 : 25;
      return {
        sizeMb,
        size: sizeMb * 1024 * 1024,
        count: 10,
        oversize: async (combinedSize: number) => {
          await Ui.modal.warning('Combined attachment size is limited to 25 MB. The last file brings it to ' + Math.ceil(combinedSize / (1024 * 1024)) + ' MB.');
        },
      };
    }
  }

}
