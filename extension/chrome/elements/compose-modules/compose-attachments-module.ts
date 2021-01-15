/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { AttachmentLimits, AttachmentUI } from '../../../js/common/ui/attachment-ui.js';
import { BrowserMsg } from '../../../js/common/browser/browser-msg.js';
import { OrgRules } from '../../../js/common/org-rules.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { ViewModule } from '../../../js/common/view-module.js';
import { ComposeView } from '../compose.js';
import { AcctStore } from '../../../js/common/platform/store/acct-store.js';

export class ComposeAttsModule extends ViewModule<ComposeView> {

  public attach: AttachmentUI;

  constructor(view: ComposeView) {
    super(view);
    this.attach = new AttachmentUI(() => this.getMaxAttSizeAndOversizeNotice());
  }

  public setHandlers = () => {
    this.view.S.cached('body').bind({ drop: Ui.event.stop(), dragover: Ui.event.stop() }); // prevents files dropped out of the intended drop area to interfere
    this.attach.initAttachmentDialog('fineuploader', 'fineuploader_button', {
      uiChanged: () => {
        this.view.sizeModule.setInputTextHeightManuallyIfNeeded();
        this.view.sizeModule.resizeComposeBox();
      }
    });
  }

  private getMaxAttSizeAndOversizeNotice = async (): Promise<AttachmentLimits> => {
    const subscription = await AcctStore.getSubscription(this.view.acctEmail);
    if (!subscription.active && !OrgRules.isPublicEmailProviderDomain(this.view.senderModule.getSender())) {
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
      const sizeMb = 25;
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
