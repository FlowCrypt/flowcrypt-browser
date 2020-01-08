/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Bm, BrowserMsg } from '../../../../js/common/browser/browser-msg.js';

import { Catch } from '../../../../js/common/platform/catch.js';
import { Dict } from '../../../../js/common/core/common.js';
import { GmailRes } from '../../../../js/common/api/email-provider/gmail/gmail-parser.js';
import { Google } from '../../../../js/common/api/google.js';
import { InboxView } from '../inbox.js';
import { Settings } from '../../../../js/common/settings.js';
import { ViewModule } from '../../../../js/common/view-module.js';
import { Xss } from '../../../../js/common/platform/xss.js';

export class InboxMenuModule extends ViewModule<InboxView> {

  public readonly LABEL: Dict<GmailRes.GmailMsg$labelId> = {
    INBOX: 'INBOX', UNREAD: 'UNREAD', CATEGORY_PERSONAL: 'CATEGORY_PERSONAL', IMPORTANT: 'IMPORTANT', SENT: 'SENT', CATEGORY_UPDATES: 'CATEGORY_UPDATES'
  };

  private readonly FOLDERS = ['INBOX', 'STARRED', 'SENT', 'DRAFT', 'TRASH']; // 'UNREAD', 'SPAM'
  private allLabels!: GmailRes.GmailLabels$label[];

  public render = async () => {
    await this.renderNavbartTop();
    this.allLabels = (await this.view.gmail.labelsGet()).labels;
    this.renderMenuAndLabelStyles();
    this.setHandlers();
  }

  public getLabelName = (labelId: string) => {
    if (labelId === 'ALL') {
      return 'all folders';
    }
    const label = this.allLabels?.find(l => l.id === labelId);
    if (label) {
      return label.name;
    }
    return `UNKNOWN LABEL: ${labelId}`;
  }

  public renderableLabels = (labelIds: (GmailRes.GmailMsg$labelId | string)[], placement: 'messages' | 'menu' | 'labels') => {
    return labelIds.map(id => this.renderableLabel(id, placement)).join('');
  }

  private setHandlers = () => {
    $('.action_open_secure_compose_window').click(this.view.setHandler(() => this.view.injector.openComposeWin()));
    $('.menu > .label').click(this.view.setHandler(this.renderFolder));
    this.addBrowserMsgListeners();
    $('.action_open_settings').click(this.view.setHandler(self => BrowserMsg.send.bg.settings({ acctEmail: this.view.acctEmail })));
    $(".action-toggle-accounts-menu").click(this.view.setHandler((target, event) => {
      event.stopPropagation();
      $("#alt-accounts").toggleClass("active");
    }));
    $('.action_add_account').click(this.view.setHandlerPrevent('double', async () => await Settings.newGoogleAcctAuthPromptThenAlertOrForward(this.view.tabId)));
  }

  private renderMenuAndLabelStyles = () => {
    this.addLabelStyles(this.allLabels);
    Xss.sanitizeAppend('.menu', `<br>${this.renderableLabels(this.FOLDERS, 'menu')}<button class="button gray2 label label_ALL">ALL MAIL</button><br>`);
    Xss.sanitizeAppend('.menu', '<br>' + this.renderableLabels(this.allLabels.sort((a, b) => {
      if (a.name > b.name) {
        return 1;
      } else if (a.name < b.name) {
        return -1;
      } else {
        return 0;
      }
    }).map(l => l.id), 'labels'));
  }

  private addLabelStyles = (labels: GmailRes.GmailLabels$label[]) => {
    let style = '';
    for (const label of labels) {
      if (label.color) {
        const id = Xss.escape(label.id);
        const bg = Xss.escape(label.color.backgroundColor);
        const fg = Xss.escape(label.color.textColor);
        style += `.label.label_${id} {color: ${fg}; background-color: ${bg};} `;
      }
    }
    $('body').append(`<style>${style}</style>`); // xss-escaped
  }

  private renderableLabel = (labelId: string, placement: 'messages' | 'menu' | 'labels') => {
    const label = this.allLabels?.find(l => l.id === labelId);
    if (!label) {
      return '';
    }
    if (placement === 'messages' && label.messageListVisibility !== 'show') {
      return '';
    }
    if (placement === 'labels' && (label.labelListVisibility !== 'labelShow' || label.id === this.LABEL.INBOX)) {
      return '';
    }
    const id = Xss.escape(labelId);
    const name = Xss.escape(label.name);
    if (placement === 'menu') {
      const unread = Number(label.messagesUnread);
      return `<button class="button gray2 label label_${id}" ${unread ? 'style="font-weight: bold;"' : ''}>${name}${unread ? ` (${unread})` : ''}</button><br>`;
    } else if (placement === 'labels') {
      return `<span class="label label_${id}">${name}</span><br>`;
    } else {
      return `<span class="label label_${id}">${name}</span>`;
    }
  }

  private renderNavbartTop = async () => {
    $('.action_open_webmail').attr('href', Google.webmailUrl(this.view.acctEmail));
    $('.action_choose_account').get(0).title = this.view.acctEmail;
    if (this.view.storage.picture) {
      $('img.main-profile-img').attr('src', this.view.storage.picture).on('error', this.view.setHandler(self => {
        $(self).off().attr('src', '/img/svgs/profile-icon.svg');
      }));
    }
    await this.view.webmailCommon.addOrRemoveEndSessionBtnIfNeeded();
    Catch.setHandledTimeout(() => { $('#banner a').css('color', 'red'); }, 500);
    Catch.setHandledTimeout(() => { $('#banner a').css('color', ''); }, 1000);
    Catch.setHandledTimeout(() => { $('#banner a').css('color', 'red'); }, 1500);
    Catch.setHandledTimeout(() => { $('#banner a').css('color', ''); }, 2000);
  }

  private renderFolder = (labelEl: HTMLSpanElement) => {
    for (const cls of labelEl.classList) {
      const labelId = (cls.match(/^label_([a-zA-Z0-9_]+)$/) || [])[1];
      if (labelId) {
        this.view.redirectToUrl({ acctEmail: this.view.acctEmail, labelId });
        return;
      }
    }
    this.view.redirectToUrl({ acctEmail: this.view.acctEmail });
  }

  private addBrowserMsgListeners = () => {
    BrowserMsg.addListener('add_end_session_btn', () => this.view.injector.insertEndSessionBtn(this.view.acctEmail));
    BrowserMsg.addListener('close_new_message', async () => {
      $('div.new_message').remove();
    });
    BrowserMsg.addListener('passphrase_dialog', async ({ longids, type }: Bm.PassphraseDialog) => {
      if (!$('#cryptup_dialog').length) {
        $('body').append(this.view.factory.dialogPassphrase(longids, type))  // xss-safe-factory;
          .click(this.view.setHandler(e => { // click on the area outside the iframe
            $('#cryptup_dialog').remove();
          }));
      }
    });
    BrowserMsg.addListener('subscribe_dialog', async ({ isAuthErr }: Bm.SubscribeDialog) => {
      if (!$('#cryptup_dialog').length) {
        $('body').append(this.view.factory.dialogSubscribe(isAuthErr)); // xss-safe-factory
      }
    });
    BrowserMsg.addListener('add_pubkey_dialog', async ({ emails }: Bm.AddPubkeyDialog) => {
      if (!$('#cryptup_dialog').length) {
        $('body').append(this.view.factory.dialogAddPubkey(emails)); // xss-safe-factory
      }
    });
    BrowserMsg.addListener('close_dialog', async () => {
      $('#cryptup_dialog').remove();
    });
  }

}
