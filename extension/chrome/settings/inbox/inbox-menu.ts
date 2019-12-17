import { View } from '../../../js/common/view.js';
import { Injector } from '../../../js/common/inject.js';
import { GmailRes } from '../../../js/common/api/email_provider/gmail/gmail-parser.js';
import { Xss } from '../../../js/common/platform/xss.js';
import { Dict } from '../../../js/common/core/common.js';
import { ApiErr } from '../../../js/common/api/error/api-error.js';
import { Catch } from '../../../js/common/platform/catch.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { Lang } from '../../../js/common/lang.js';
import { BrowserMsg } from '../../../js/common/browser/browser-msg.js';
import { InboxView } from './inbox.js';

export class InboxMenuView extends View {
  private readonly inboxView: InboxView;
  private readonly FOLDERS = ['INBOX', 'STARRED', 'SENT', 'DRAFT', 'TRASH']; // 'UNREAD', 'SPAM'

  private injector: Injector | undefined;

  public readonly LABEL: Dict<GmailRes.GmailMsg$labelId> = {
    INBOX: 'INBOX', UNREAD: 'UNREAD', CATEGORY_PERSONAL: 'CATEGORY_PERSONAL', IMPORTANT: 'IMPORTANT',
    SENT: 'SENT', CATEGORY_UPDATES: 'CATEGORY_UPDATES'
  };

  public allLabels: GmailRes.GmailLabels$label[] = [];

  constructor(inboxView: InboxView) {
    super();
    this.inboxView = inboxView;
  }

  async init() {
    await super.init();
    this.allLabels = (await this.inboxView.gmail.labelsGet()).labels;
    this.injector = new Injector('settings', undefined, this.inboxView.factory!);
  }

  async render() {
    try {
      this.addLabelStyles();
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
    } catch (e) {
      if (ApiErr.isNetErr(e)) {
        this.inboxView.showNotification(`Connection error trying to get list of folders ${Ui.retryLink()}`);
      } else if (ApiErr.isAuthPopupNeeded(e)) {
        this.inboxView.renderAndHandleAuthPopupNotification();
      } else if (ApiErr.isMailOrAcctDisabledOrPolicy(e)) {
        this.inboxView.showNotification(Lang.account.googleAcctDisabledOrPolicy);
      } else if (ApiErr.isInsufficientPermission(e)) {
        this.inboxView.renderAndHandleAuthPopupNotification(true);
      } else {
        Catch.reportErr(e);
        await Ui.modal.error(`Error trying to get list of folders: ${ApiErr.eli5(e)}\n\n${String(e)}`);
        window.location.reload();
      }
    }
  }

  setHandlers() {
    $('.action_open_secure_compose_window').click(this.setHandler(this.injector!.openComposeWin));
    $('.menu > .label').click(this.setHandler(this.renderFolder));
    BrowserMsg.addListener('close_new_message', async () => {
      $('div.new_message').remove();
    });
  }

  getLabelName = (labelId: string) => {
    if (labelId === 'ALL') {
      return 'all folders';
    }
    const label = (this.allLabels || []).find(l => l.id === labelId);
    if (label) {
      return label.name;
    }
    return `UNKNOWN LABEL: ${labelId}`;
  }

  private renderableLabel = (labelId: string, placement: 'messages' | 'menu' | 'labels') => {
    const label = (this.allLabels || []).find(l => l.id === labelId);
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

  renderableLabels = (labelIds: (GmailRes.GmailMsg$labelId | string)[], placement: 'messages' | 'menu' | 'labels') => {
    return labelIds.map(id => this.renderableLabel(id, placement)).join('');
  }

  private addLabelStyles = () => {
    let style = '';
    for (const label of this.allLabels) {
      if (label.color) {
        const id = Xss.escape(label.id);
        const bg = Xss.escape(label.color.backgroundColor);
        const fg = Xss.escape(label.color.textColor);
        style += `.label.label_${id} {color: ${fg}; background-color: ${bg};} `;
      }
    }
    $('body').append(`<style>${style}</style>`); // xss-escaped
  }

  private renderFolder = (labelEl: HTMLSpanElement) => {
    for (const cls of labelEl.classList) {
      const labelId = (cls.match(/^label_([a-zA-Z0-9_]+)$/) || [])[1];
      if (labelId) {
        this.inboxView.redirectToUrl({ acctEmail: this.inboxView.acctEmail, labelId });
        return;
      }
    }
    this.inboxView.redirectToUrl({ acctEmail: this.inboxView.acctEmail });
  }

}
