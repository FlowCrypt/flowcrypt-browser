/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { ApiErr } from '../../../../js/common/api/shared/api-error.js';
import { Catch } from '../../../../js/common/platform/catch.js';
import { GmailParser } from '../../../../js/common/api/email-provider/gmail/gmail-parser.js';
import { InboxView } from '../inbox.js';
import { Lang } from '../../../../js/common/lang.js';
import { Str, promiseAllWithLimit } from '../../../../js/common/core/common.js';
import { Ui } from '../../../../js/common/browser/ui.js';
import { ViewModule } from '../../../../js/common/view-module.js';
import { Xss } from '../../../../js/common/platform/xss.js';

export class InboxListThreadsModule extends ViewModule<InboxView> {
  public render = async (labelId: string) => {
    this.view.displayBlock('inbox', `Messages in ${Xss.escape(this.view.inboxMenuModule.getLabelName(labelId))}`);
    try {
      const { threads } = await this.view.gmail.threadList(labelId);
      if (threads?.length) {
        await promiseAllWithLimit(
          30,
          threads.map(t => () => this.renderInboxItem(t.id))
        );
      } else {
        Xss.sanitizeRender('.threads', `<p>No encrypted messages in ${Xss.escape(labelId)} yet. ${Ui.retryLink()}</p>`);
      }
    } catch (e) {
      if (ApiErr.isNetErr(e)) {
        this.view.inboxNotificationModule.showNotification(`Connection error trying to get list of messages ${Ui.retryLink()}`, 'inbox');
      } else if (ApiErr.isAuthErr(e)) {
        this.view.inboxNotificationModule.renderAndHandleAuthPopupNotification();
      } else if (ApiErr.isMailOrAcctDisabledOrPolicy(e)) {
        this.view.inboxNotificationModule.showNotification(Lang.account.googleAcctDisabledOrPolicy, 'inbox');
      } else if (ApiErr.isInsufficientPermission(e)) {
        this.view.inboxNotificationModule.renderAndHandleAuthPopupNotification(true);
      } else {
        Catch.reportErr(e);
        await Ui.modal.error(`Error trying to get list of folders: ${ApiErr.eli5(e)}\n\n${String(e)}`);
        window.location.reload();
      }
    }
  };

  private renderInboxItem = async (threadId: string): Promise<void> => {
    this.inboxThreadItemAdd(threadId);
    const threadItem = $('.threads #' + this.threadListItemId(threadId));
    try {
      const thread = await this.view.gmail.threadGet(threadId, 'metadata');
      if (!thread.messages?.length) {
        threadItem.find('.loading').text('Could not find item');
        return;
      }
      const firstMsg = thread.messages[0];
      const lastMsg = thread.messages[thread.messages.length - 1];
      threadItem.find('.subject').text(GmailParser.findHeader(firstMsg, 'subject') || '(no subject)');
      Xss.sanitizeAppend(threadItem.find('.subject'), this.view.inboxMenuModule.renderableLabels(firstMsg.labelIds || [], 'messages'));
      const fromHeaderVal = GmailParser.findHeader(firstMsg, 'from');
      if (fromHeaderVal) {
        const from = Str.parseEmail(fromHeaderVal);
        threadItem.find('.from').text(from.name || from.email || from.full);
      }
      threadItem.find('.loading').text('');
      threadItem.find('.date').text(this.formatDate(lastMsg.internalDate));
      threadItem.addClass('loaded').on(
        'click',
        this.view.setHandler(() => this.view.inboxActiveThreadModule.render(thread.id, thread))
      );
      if (lastMsg.labelIds?.includes(this.view.inboxMenuModule.LABEL.UNREAD)) {
        threadItem.css({ 'font-weight': 'bold', background: 'white' });
      }
      if (thread.messages.length > 1) {
        threadItem.find('.msg_count').text(`(${thread.messages.length})`);
      }
    } catch (e) {
      if (ApiErr.isNetErr(e)) {
        Xss.sanitizeRender(threadItem.find('.loading'), 'Failed to load (network) <a href="#">retry</a>')
          .find('a')
          .on(
            'click',
            this.view.setHandler(() => this.renderInboxItem(threadId))
          );
      } else if (ApiErr.isAuthErr(e)) {
        this.view.inboxNotificationModule.renderAndHandleAuthPopupNotification();
      } else if (ApiErr.isMailOrAcctDisabledOrPolicy(e)) {
        this.view.inboxNotificationModule.showNotification(Lang.account.googleAcctDisabledOrPolicy, 'inbox');
      } else {
        Catch.reportErr(e);
        threadItem.find('.loading').text('Failed to load');
      }
    }
  };

  private inboxThreadItemAdd = (threadId: string) => {
    const content = `
      <span class="from_container">
        <span class="from"></span>
        <span class="msg_count"></span></span>
      <span class="subject" data-test="container-subject"></span>
      <span class="date"></span>
    `;
    Xss.sanitizeAppend(
      this.view.S.cached('threads'),
      Ui.e('div', {
        class: 'line',
        id: this.threadListItemId(threadId),
        html: `<span class="loading">${Ui.spinner('green')}loading..</span>${content}`,
      })
    );
  };

  private threadListItemId = (threadId: string) => {
    return 'list_thread_id_' + threadId;
  };

  private formatDate = (dateFromApi: string | number | undefined): string => {
    const date = new Date(Number(dateFromApi));
    if (date.toLocaleDateString() === new Date().toLocaleDateString()) {
      return date.toLocaleTimeString();
    }
    return date.toLocaleDateString();
  };
}
