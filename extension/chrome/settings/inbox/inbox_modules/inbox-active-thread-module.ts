/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Bm, BrowserMsg } from '../../../../js/common/browser/browser-msg.js';
import { FactoryReplyParams, XssSafeFactory } from '../../../../js/common/xss_safe_factory.js';
import { GmailParser, GmailRes } from '../../../../js/common/api/email_provider/gmail/gmail-parser.js';
import { Url, UrlParams } from '../../../../js/common/core/common.js';

import { ApiErr } from '../../../../js/common/api/error/api-error.js';
import { BrowserMsgCommonHandlers } from '../../../../js/common/browser/browser-msg-common-handlers.js';
import { Buf } from '../../../../js/common/core/buf.js';
import { Catch } from '../../../../js/common/platform/catch.js';
import { InboxView } from '../inbox.js';
import { Lang } from '../../../../js/common/lang.js';
import { Mime } from '../../../../js/common/core/mime.js';
import { Ui } from '../../../../js/common/browser/ui.js';
import { ViewModule } from '../../../../js/common/view_module.js';
import { Xss } from '../../../../js/common/platform/xss.js';

export class InboxActiveThreadModule extends ViewModule<InboxView> {

  private threadId: string | undefined;
  private threadHasPgpBlock: boolean = false;

  public render = async (threadId: string, thread?: GmailRes.GmailThread) => {
    this.threadId = threadId;
    this.view.displayBlock('thread', 'Loading..');
    try {
      thread = thread || await this.view.gmail.threadGet(threadId, 'metadata');
      const subject = GmailParser.findHeader(thread.messages[0], 'subject') || '(no subject)';
      this.updateUrlWithoutRedirecting(`${subject} - FlowCrypt Inbox`, { acctEmail: this.view.acctEmail, threadId });
      this.view.displayBlock('thread', subject);
      for (const m of thread.messages) {
        await this.renderMsg(m);
      }
      if (this.threadHasPgpBlock) {
        $(".action_see_original_message").css('display', 'inline-block');
        if (this.view.showOriginal) {
          $(".action_see_original_message").text('See Decrypted');
        }
      }
      const lastMsg = thread.messages[thread.messages.length - 1];
      if (lastMsg) {
        this.renderReplyBox(lastMsg.id);
      }
      this.setHandlers();
      // await gmail.threadModify(acctEmail, threadId, [LABEL.UNREAD], []); // missing permission https://github.com/FlowCrypt/flowcrypt-browser/issues/1304
    } catch (e) {
      if (ApiErr.isNetErr(e)) {
        Xss.sanitizeRender('.thread', `<br>Failed to load thread - network error. ${Ui.retryLink()}`);
      } else if (ApiErr.isAuthPopupNeeded(e)) {
        this.view.inboxNotificationModule.renderAndHandleAuthPopupNotification();
      } else if (ApiErr.isMailOrAcctDisabledOrPolicy(e)) {
        this.view.inboxNotificationModule.showNotification(Lang.account.googleAcctDisabledOrPolicy);
      } else {
        Catch.reportErr(e);
        const printable = Xss.escape(e instanceof Error ? e.stack || e.message : JSON.stringify(e, undefined, 2));
        Xss.sanitizeRender('.thread', `<br>Failed to load thread due to the following error: <pre>${printable}</pre>`);
      }
    }
  }

  public setHandlers = () => {
    if (this.threadHasPgpBlock) {
      $(".action_see_original_message").click(this.view.setHandler(() => this.view.redirectToUrl({
        acctEmail: this.view.acctEmail, threadId: this.threadId, showOriginal: !this.view.showOriginal
      })));
    }
    BrowserMsg.addListener('close_reply_message', async ({ frameId }: Bm.CloseReplyMessage) => {
      $(`iframe#${frameId}`).remove();
    });
    BrowserMsg.addListener('reinsert_reply_box', async ({ replyMsgId }: Bm.ReinsertReplyBox) => {
      this.renderReplyBox(replyMsgId);
    });
    BrowserMsg.addListener('scroll_to_bottom_of_conversation', async () => {
      const scrollableEl = $('.thread').get(0);
      scrollableEl.scrollTop = scrollableEl.scrollHeight; // scroll to the bottom of conversation where the reply box is
    });
    BrowserMsg.addListener('render_public_keys', async ({ traverseUp, afterFrameId, publicKeys }: Bm.RenderPublicKeys) => {
      const traverseUpLevels = traverseUp || 0;
      let appendAfter = $(`iframe#${afterFrameId}`);
      for (let i = 0; i < traverseUpLevels; i++) {
        appendAfter = appendAfter.parent();
      }
      for (const armoredPubkey of publicKeys) {
        appendAfter.after(this.view.factory.embeddedPubkey(armoredPubkey, false));
      }
    });
    BrowserMsg.addListener('reply_pubkey_mismatch', BrowserMsgCommonHandlers.replyPubkeyMismatch);
  }

  private renderMsg = async (message: GmailRes.GmailMsg) => {
    const htmlId = this.replyMsgId(message.id);
    const from = GmailParser.findHeader(message, 'from') || 'unknown';
    try {
      const { raw } = await this.view.gmail.msgGet(message.id, 'raw');
      const mimeMsg = Buf.fromBase64UrlStr(raw!);
      const { blocks, headers } = await Mime.process(mimeMsg);
      let r = '';
      let renderedAtts = '';
      for (const block of blocks) {
        if (block.type === 'encryptedMsg' || block.type === 'publicKey' || block.type === 'privateKey' || block.type === 'signedMsg' || block.type === 'encryptedMsgLink') {
          this.threadHasPgpBlock = true;
        }
        if (r) {
          r += '<br><br>';
        }
        if (['encryptedAtt', 'plainAtt'].includes(block.type)) {
          renderedAtts += XssSafeFactory.renderableMsgBlock(this.view.factory, block, message.id, from,
            this.view.storage.sendAs && !!this.view.storage.sendAs[from]);
        } else if (this.view.showOriginal) {
          r += Xss.escape(block.content.toString()).replace(/\n/g, '<br>');
        } else {
          r += XssSafeFactory.renderableMsgBlock(this.view.factory, block, message.id, from,
            this.view.storage.sendAs && !!this.view.storage.sendAs[from]);
        }
      }
      if (renderedAtts) {
        r += `<div class="attachments">${renderedAtts}</div>`;
      }
      r = `<p class="message_header" data-test="container-msg-header">From: ${Xss.escape(from)} <span style="float:right;">${headers.date}</p>` + r;
      $('.thread').append(this.wrapMsg(htmlId, r)); // xss-safe-factory
    } catch (e) {
      if (ApiErr.isNetErr(e)) {
        Xss.sanitizeAppend('.thread', this.wrapMsg(htmlId, `Failed to load a message (network error), skipping. ${Ui.retryLink()}`));
      } else if (ApiErr.isAuthPopupNeeded(e)) {
        this.view.inboxNotificationModule.renderAndHandleAuthPopupNotification();
      } else if (ApiErr.isMailOrAcctDisabledOrPolicy(e)) {
        this.view.inboxNotificationModule.showNotification(Lang.account.googleAcctDisabledOrPolicy);
      } else {
        Catch.reportErr(e);
        const printable = Xss.escape(e instanceof Error ? e.stack || e.message : JSON.stringify(e, undefined, 2));
        Xss.sanitizeAppend('.thread', this.wrapMsg(htmlId, `Failed to load a message due to the following error: <pre>${printable}</pre>`));
      }
    }
  }

  private replyMsgId = (msgId: string) => {
    return 'message_id_' + msgId;
  }

  private renderReplyBox = (replyMsgId: string) => {
    const params: FactoryReplyParams = { replyMsgId };
    this.view.S.cached('thread').append(Ui.e('div', { class: 'reply line', html: this.view.factory.embeddedReply(params, false, false) })); // xss-safe-factory
  }

  private updateUrlWithoutRedirecting = (title: string, params: UrlParams) => {
    const newUrlSearch = Url.create('', params);
    if (newUrlSearch !== window.location.search) {
      window.history.pushState({}, title, newUrlSearch);
    }
  }

  private wrapMsg = (id: string, html: string) => {
    return Ui.e('div', { id, class: 'message line', html });
  }

}
