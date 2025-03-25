/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Bm, BrowserMsg } from '../../../../js/common/browser/browser-msg.js';
import { FactoryReplyParams, XssSafeFactory } from '../../../../js/common/xss-safe-factory.js';
import { GmailParser, GmailRes } from '../../../../js/common/api/email-provider/gmail/gmail-parser.js';
import { Url, UrlParams } from '../../../../js/common/core/common.js';

import { ApiErr } from '../../../../js/common/api/shared/api-error.js';
import { BrowserMsgCommonHandlers } from '../../../../js/common/browser/browser-msg-common-handlers.js';
import { Buf } from '../../../../js/common/core/buf.js';
import { Catch } from '../../../../js/common/platform/catch.js';
import { InboxView } from '../inbox.js';
import { Lang } from '../../../../js/common/lang.js';
import { Ui } from '../../../../js/common/browser/ui.js';
import { ViewModule } from '../../../../js/common/view-module.js';
import { Xss } from '../../../../js/common/platform/xss.js';
import { Browser } from '../../../../js/common/browser/browser.js';
import { Attachment } from '../../../../js/common/core/attachment.js';
import { LoaderContextInterface } from '../../../../js/common/loader-context-interface.js';

class LoaderContext implements LoaderContextInterface {
  private renderedMessageXssSafe: string | undefined; // xss-none
  private renderedAttachmentsXssSafe: string[] = []; // xss-none

  public constructor(private readonly factory: XssSafeFactory) {}

  public renderPlainAttachment = (a: Attachment) => {
    // todo: render error argument
    this.renderedAttachmentsXssSafe.push(this.factory.embeddedAttachment(a, false)); // xss-safe-factory
  };

  public prependEncryptedAttachment = (a: Attachment) => {
    this.renderedAttachmentsXssSafe.unshift(this.factory.embeddedAttachment(a, true)); // xss-safe-factory
  };

  /* eslint-disable @typescript-eslint/naming-convention */
  /**
   * XSS WARNING
   *
   * newHtmlContent must be XSS safe
   */
  // prettier-ignore
  public setMsgBody_DANGEROUSLY = (newHtmlContent_MUST_BE_XSS_SAFE: string, method: 'set' | 'append' | 'after') => { // xss-dangerous-function
    /* eslint-enable @typescript-eslint/naming-convention */
    if (method === 'set') {
      this.renderedMessageXssSafe = newHtmlContent_MUST_BE_XSS_SAFE; // xss-safe-value
    } else {
      // todo: we may implement the difference between 'append' and 'after'
      this.renderedAttachmentsXssSafe.unshift(newHtmlContent_MUST_BE_XSS_SAFE); // xss-safe-value
    }
  };

  public getRenderedMessageXssSafe = (): string => {
    return this.renderedMessageXssSafe || '';
  };

  public getRenderedAttachmentsXssSafe = (): string => {
    return this.renderedAttachmentsXssSafe.length
      ? `<div class="attachments" data-test="container-attachments">${this.renderedAttachmentsXssSafe.join('')}</div>`
      : '';
  };

  /* eslint-disable @typescript-eslint/naming-convention */
  /**
   * XSS WARNING
   *
   * newHtmlContents must be XSS safe
   */
  // prettier-ignore
  public setRenderedAttachments_DANGEROUSLY = (newHtmlContents_MUST_BE_XSS_SAFE: string[]) => { // xss-dangerous-function
    /* eslint-enable @typescript-eslint/naming-convention */
    this.renderedAttachmentsXssSafe = newHtmlContents_MUST_BE_XSS_SAFE; // xss-safe-value
  };

  public hideAttachment = () => {
    // not applicable
  };
}

export class InboxActiveThreadModule extends ViewModule<InboxView> {
  private threadId: string | undefined;
  private debugEmails = ['flowcrypt.compatibility@gmail.com', 'ci.tests.gmail@flowcrypt.dev', 'e2e.enterprise.test@flowcrypt.com']; // adds debugging ui, useful for creating automated tests

  public render = async (threadId: string, thread?: GmailRes.GmailThread) => {
    this.threadId = threadId;
    this.view.displayBlock('thread', 'Loading..');
    try {
      thread = thread || (await this.view.gmail.threadGet(threadId, 'metadata'));
      if (!thread.messages) {
        Xss.sanitizeRender('.thread', `<br>No messages in this thread. ${Ui.retryLink()}`);
        return;
      }
      const subject = GmailParser.findHeader(thread.messages[0], 'subject') || '(no subject)';
      this.updateUrlWithoutRedirecting(`${subject} - FlowCrypt Inbox`, { acctEmail: this.view.acctEmail, threadId });
      this.view.displayBlock('thread', Xss.escape(subject));
      let threadHasPgpBlock = false;
      for (const m of thread.messages) {
        const pgpFlag = await this.renderMsg(m);
        threadHasPgpBlock ||= pgpFlag;
      }
      if (threadHasPgpBlock || this.view.showOriginal) {
        $('.action_see_original_message').css('display', 'inline-block');
        if (this.view.showOriginal) {
          $('.action_see_original_message').text('See Decrypted');
        }
        $('.action_see_original_message').on(
          'click',
          this.view.setHandler(() =>
            this.view.redirectToUrl({
              acctEmail: this.view.acctEmail,
              threadId: this.threadId,
              showOriginal: !this.view.showOriginal,
            })
          )
        );
      }
      const lastMsg = thread.messages[thread.messages.length - 1];
      if (lastMsg) {
        this.renderReplyBox(lastMsg.id);
      }
      this.setHandlers();
      await this.view.gmail.threadModify(threadId, [this.view.inboxMenuModule.LABEL.UNREAD], []);
    } catch (e) {
      if (ApiErr.isNetErr(e)) {
        Xss.sanitizeRender('.thread', `<br>Failed to load thread - network error. ${Ui.retryLink()}`);
      } else if (ApiErr.isAuthErr(e)) {
        this.view.inboxNotificationModule.renderAndHandleAuthPopupNotification();
      } else if (ApiErr.isMailOrAcctDisabledOrPolicy(e)) {
        this.view.inboxNotificationModule.showNotification(Lang.account.googleAcctDisabledOrPolicy, 'inbox');
      } else {
        Catch.reportErr(e);
        const printable = Xss.escape(e instanceof Error ? e.stack || e.message : JSON.stringify(e, undefined, 2));
        Xss.sanitizeRender('.thread', `<br>Failed to load thread due to the following error: <pre>${printable}</pre>`);
      }
    }
    this.view.messageRenderer.deleteExpired();
  };

  public setHandlers = () => {
    BrowserMsg.addListener('close_reply_message', async ({ frameId }: Bm.ComposeWindow) => {
      $(`iframe#${frameId}`).remove();
    });
    BrowserMsg.addListener('reinsert_reply_box', async ({ replyMsgId }: Bm.ReinsertReplyBox) => {
      this.renderReplyBox(replyMsgId);
    });
    BrowserMsg.addListener('scroll_to_bottom_of_conversation', async () => {
      const scrollableEl = $('.thread').get(0);
      if (scrollableEl) {
        scrollableEl.scrollTop = scrollableEl.scrollHeight; // scroll to the bottom of conversation where the reply box is
      }
    });
    BrowserMsg.addListener('render_public_keys', async ({ traverseUp, afterFrameId, publicKeys }: Bm.RenderPublicKeys) => {
      const traverseUpLevels = traverseUp || 0;
      let appendAfter = $(`iframe#${afterFrameId}`);
      for (let i = 0; i < traverseUpLevels; i++) {
        appendAfter = appendAfter.parent();
      }
      for (const armoredPubkey of publicKeys) {
        appendAfter.after(this.view.factory.embeddedPubkey(armoredPubkey, false)); // xss-safe-value
      }
    });
    BrowserMsg.addListener('reply_pubkey_mismatch', BrowserMsgCommonHandlers.replyPubkeyMismatch);
  };

  private renderMsg = async (message: GmailRes.GmailMsg): Promise<boolean> => {
    const htmlId = this.replyMsgId(message.id);
    try {
      const msg = await this.view.messageRenderer.downloader.msgGetFull(message.id);
      const { blocks, body, messageInfo, attachments } = await this.view.messageRenderer.msgGetProcessed(message.id);
      const senderEmail = messageInfo.from?.email;
      const { renderedXssSafe, blocksInFrames } = this.view.messageRenderer.renderMsg({ blocks, senderEmail }, this.view.showOriginal); // xss-safe-factory
      const loaderContext = new LoaderContext(this.view.factory);
      // not doing this in the constructor to track XSS safety
      const renderedAttachmentsXssSafe = /* xss-safe-factory */ blocks
        .filter(block => block.attachmentMeta && ['encryptedAttachment', 'plainAttachment'].includes(block.type))
        .map(block => XssSafeFactory.renderableMsgBlock(this.view.factory, block, this.view.messageRenderer.isOutgoing(senderEmail)));
      loaderContext.setRenderedAttachments_DANGEROUSLY(renderedAttachmentsXssSafe); // xss-safe-factory
      loaderContext.setMsgBody_DANGEROUSLY(renderedXssSafe, 'set'); // xss-safe-value
      for (const a of attachments) {
        await this.view.messageRenderer.processAttachment(a, body, attachments, loaderContext, undefined, message.id, messageInfo);
      }
      const exportBtn = this.debugEmails.includes(this.view.acctEmail) ? '<a href="#" class="action-export">download api export</a>' : '';
      const r =
        `<p class="message_header" data-test="container-msg-header">From: ${Xss.escape(messageInfo.from?.full || 'unknown')} <span style="float:right;">${
          GmailParser.findHeader(msg, 'Date') ?? ''
        } ${exportBtn}</p>` + // xss-direct
        loaderContext.getRenderedMessageXssSafe() +
        loaderContext.getRenderedAttachmentsXssSafe();
      $('.thread').append(this.wrapMsg(htmlId, r)); // xss-safe-value
      this.view.messageRenderer.startProcessingInlineBlocks(this.view.relayManager, this.view.factory, messageInfo, blocksInFrames);
      if (exportBtn) {
        $('.action-export').on(
          'click',
          this.view.setHandler(() => this.exportMsgForDebug(message.id))
        );
      }
      return blocks.some(block => ['encryptedMsg', 'publicKey', 'privateKey', 'signedMsg'].includes(block.type));
    } catch (e) {
      if (ApiErr.isNetErr(e)) {
        Xss.sanitizeAppend('.thread', this.wrapMsg(htmlId, `Failed to load a message (network error), skipping. ${Ui.retryLink()}`));
      } else if (ApiErr.isAuthErr(e)) {
        this.view.inboxNotificationModule.renderAndHandleAuthPopupNotification();
      } else if (ApiErr.isMailOrAcctDisabledOrPolicy(e)) {
        this.view.inboxNotificationModule.showNotification(Lang.account.googleAcctDisabledOrPolicy, 'inbox');
      } else {
        Catch.reportErr(e);
        const printable = Xss.escape(e instanceof Error ? e.stack || e.message : JSON.stringify(e, undefined, 2));
        Xss.sanitizeAppend('.thread', this.wrapMsg(htmlId, `Failed to load a message due to the following error: <pre>${printable}</pre>`));
      }
      return false;
    }
  };

  private exportMsgForDebug = async (msgId: string) => {
    const full = await this.view.gmail.msgGet(msgId, 'full');
    const raw = await this.view.gmail.msgGet(msgId, 'raw');
    const existingAttachments = GmailParser.findAttachments(full, full.id);
    await this.view.gmail.fetchAttachmentsMissingData(existingAttachments);
    this.redactExportMsgHeaders(full);
    this.redactExportMsgHeaders(raw);
    const attachments: { [id: string]: { data: string; size: number } } = {};
    for (const attachment of existingAttachments) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      attachments[attachment.id!] = { data: attachment.getData().toBase64UrlStr(), size: attachment.getData().length };
    }
    const combined = { acctEmail: this.view.acctEmail, full, attachments, raw };
    const json = JSON.stringify(combined, undefined, 2);
    Browser.saveToDownloads(new Attachment({ data: Buf.fromUtfStr(json), type: 'application/json', name: `message-export-${msgId}.json` }));
  };

  private redactExportMsgHeaders = (msg: GmailRes.GmailMsg) => {
    const exclude = [
      'received',
      'dkim',
      'authentication',
      'feedback',
      'ip',
      'mailgun',
      'unsubscribe',
      'return',
      'arc',
      'google',
      'delivered',
      'precedence',
      'message-id',
    ];
    if (msg.payload) {
      msg.payload.headers = msg.payload.headers?.filter(h => {
        const hn = h.name.toLowerCase();
        for (const excludable of exclude) {
          if (hn.includes(excludable)) {
            return false;
          }
        }
        if (hn === 'to') {
          h.value = 'flowcrypt.compatibility@gmail.com'; // you can edit this manually in the export if you need a specific value
        }
        if (hn === 'sender' || hn === 'from') {
          h.value = 'sender@domain.com'; // you can edit this manually in the export if you need a specific value
        }
        return true;
      });
    }
  };

  private replyMsgId = (msgId: string) => {
    return 'message_id_' + msgId;
  };

  private renderReplyBox = (replyMsgId: string) => {
    const params: FactoryReplyParams = { replyMsgId };
    this.view.S.cached('thread').append(Ui.e('div', { class: 'reply line', html: this.view.factory.embeddedReply(params, false, false) })); // xss-safe-factory
  };

  private updateUrlWithoutRedirecting = (title: string, params: UrlParams) => {
    const newUrlSearch = Url.create('', params);
    if (newUrlSearch !== window.location.search) {
      window.history.pushState({}, title, newUrlSearch);
    }
  };

  private wrapMsg = (id: string, html: string) => {
    return Ui.e('div', { id, class: 'message line', html, 'data-test': 'message-line' });
  };
}
