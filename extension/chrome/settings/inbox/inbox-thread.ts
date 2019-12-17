import { View } from '../../../js/common/view.js';
import { GmailRes, GmailParser } from '../../../js/common/api/email_provider/gmail/gmail-parser.js';
import { ApiErr } from '../../../js/common/api/error/api-error.js';
import { Xss } from '../../../js/common/platform/xss.js';
import { Catch } from '../../../js/common/platform/catch.js';
import { Lang } from '../../../js/common/lang.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { Url, UrlParams } from '../../../js/common/core/common.js';
import { Buf } from '../../../js/common/core/buf.js';
import { Mime } from '../../../js/common/core/mime.js';
import { XssSafeFactory, FactoryReplyParams } from '../../../js/common/xss_safe_factory.js';
import { InboxView } from './inbox.js';

export class InboxThreadView extends View {
  private readonly inboxView: InboxView;
  private readonly threadId: string;
  private readonly showOriginal: boolean;
  private thread: GmailRes.GmailThread | undefined;
  private threadHasPgpBlock: boolean = false;

  constructor(inboxView: InboxView, threadId: string, thread?: GmailRes.GmailThread) {
    super();
    const uncheckedUrlParams = Url.parse(['showOriginal']);
    this.showOriginal = uncheckedUrlParams.showOriginal === true;
    this.inboxView = inboxView;
    this.threadId = threadId;
    this.thread = thread;
  }

  async init() {
    await super.init();
    this.inboxView.displayBlock('thread', 'Loading..');
    try {
      this.thread = this.thread || await this.inboxView.gmail.threadGet(this.threadId, 'metadata');
    } catch (e) {
      if (ApiErr.isNetErr(e)) {
        Xss.sanitizeRender('.thread', `<br>Failed to load thread - network error. ${Ui.retryLink()}`);
      } else if (ApiErr.isAuthPopupNeeded(e)) {
        this.inboxView.renderAndHandleAuthPopupNotification();
      } else if (ApiErr.isMailOrAcctDisabledOrPolicy(e)) {
        this.inboxView.showNotification(Lang.account.googleAcctDisabledOrPolicy);
      } else {
        Catch.reportErr(e);
        const printable = Xss.escape(e instanceof Error ? e.stack || e.message : JSON.stringify(e, undefined, 2));
        Xss.sanitizeRender('.thread', `<br>Failed to load thread due to the following error: <pre>${printable}</pre>`);
      }
    }
  }

  async render() {
    if (!this.thread) {
      return;
    }
    const subject = GmailParser.findHeader(this.thread.messages[0], 'subject') || '(no subject)';
    this.updateUrlWithoutRedirecting(`${subject} - FlowCrypt Inbox`, { acctEmail: this.inboxView.acctEmail, threadId: this.threadId });
    this.inboxView.displayBlock('thread', subject);
    for (const m of this.thread.messages) {
      await this.renderMsg(m);
    }
    if (this.threadHasPgpBlock) {
      $(".action_see_original_message").css('display', 'inline-block');
      $(".action_see_original_message").click(Ui.event.handle(() => this.inboxView.redirectToUrl({
        acctEmail: this.inboxView.acctEmail, threadId: this.threadId, showOriginal: !this.showOriginal
      })));
      if (this.showOriginal) {
        $(".action_see_original_message").text('See Decrypted');
      }
    }
    const lastMsg = this.thread.messages[this.thread.messages.length - 1];
    if (lastMsg) {
      this.renderReplyBox(lastMsg.id);
    }
    // await gmail.threadModify(acctEmail, threadId, [LABEL.UNREAD], []); // missing permission https://github.com/FlowCrypt/flowcrypt-browser/issues/1304
  }

  setHandlers() {
    // Noneed
  }

  private renderMsg = async (message: GmailRes.GmailMsg) => {
    const htmlId = this.replyMsgId(message.id);
    const from = GmailParser.findHeader(message, 'from') || 'unknown';
    try {
      const { raw } = await this.inboxView.gmail.msgGet(message.id, 'raw');
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
        if (block.type === 'encryptedAtt') {
          renderedAtts += XssSafeFactory.renderableMsgBlock(this.inboxView.factory!, block,
            message.id, from, this.inboxView.storage!.sendAs && !!this.inboxView.storage!.sendAs[from]);
        } else if (this.showOriginal) {
          r += Xss.escape(block.content.toString()).replace(/\n/g, '<br>');
        } else {
          r += XssSafeFactory.renderableMsgBlock(this.inboxView.factory!, block,
            message.id, from, this.inboxView.storage!.sendAs && !!this.inboxView.storage!.sendAs[from]);
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
        this.inboxView.renderAndHandleAuthPopupNotification();
      } else if (ApiErr.isMailOrAcctDisabledOrPolicy(e)) {
        this.inboxView.showNotification(Lang.account.googleAcctDisabledOrPolicy);
      } else {
        Catch.reportErr(e);
        const printable = Xss.escape(e instanceof Error ? e.stack || e.message : JSON.stringify(e, undefined, 2));
        Xss.sanitizeAppend('.thread', this.wrapMsg(htmlId, `Failed to load a message due to the following error: <pre>${printable}</pre>`));
      }
    }
  }

  private renderReplyBox = (replyMsgId: string) => {
    const params: FactoryReplyParams = { replyMsgId };
    this.inboxView.S.cached('thread').append(Ui.e('div', { class: 'reply line', html: this.inboxView.factory!.embeddedReply(params, false, false) })); // xss-safe-factory
  }

  private updateUrlWithoutRedirecting = (title: string, params: UrlParams) => {
    const newUrlSearch = Url.create('', params);
    if (newUrlSearch !== window.location.search) {
      window.history.pushState({}, title, newUrlSearch);
    }
  }

  private replyMsgId = (msgId: string) => {
    return 'message_id_' + msgId;
  }

  private wrapMsg = (id: string, html: string) => {
    return Ui.e('div', { id, class: 'message line', html });
  }
}
