/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Bm, BrowserMsg } from '../../../js/common/browser/browser-msg.js';
import { MsgUtil, DecryptErrTypes } from '../../../js/common/core/crypto/pgp/msg-util.js';
import { ApiErr } from '../../../js/common/api/shared/api-error.js';
import { Buf } from '../../../js/common/core/buf.js';
import { Catch } from '../../../js/common/platform/catch.js';
import { Mime } from '../../../js/common/core/mime.js';
import { MsgBlock } from '../../../js/common/core/msg-block.js';
import { MsgBlockParser } from '../../../js/common/core/msg-block-parser.js';
import { Str } from '../../../js/common/core/common.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { Xss } from '../../../js/common/platform/xss.js';
import { ViewModule } from '../../../js/common/view-module.js';
import { ComposeView } from '../compose.js';
import { MessageToReplyOrForward } from './compose-types.js';
import { KeyStore } from '../../../js/common/platform/store/key-store.js';
import { Time } from '../../../js/common/browser/time.js';

export class ComposeQuoteModule extends ViewModule<ComposeView> {
  public tripleDotSanitizedHtmlContent: { quote: string | undefined; footer: string | undefined } | undefined;
  public messageToReplyOrForward: MessageToReplyOrForward | undefined;

  public getTripleDotSanitizedFormattedHtmlContent = (): string => {
    // email content order: [myMsg, myFooter, theirQuote]
    if (this.tripleDotSanitizedHtmlContent) {
      return '<br />' + (this.tripleDotSanitizedHtmlContent.footer || '') + (this.tripleDotSanitizedHtmlContent.quote || '');
    }
    return '';
  };

  public addSignatureToInput = async () => {
    const textFooter = await this.view.footerModule.getFooterFromStorage(this.view.senderModule.getSender());
    const sanitizedFooter = textFooter && !this.view.draftModule.wasMsgLoadedFromDraft ? this.view.footerModule.createFooterHtml(textFooter) : undefined;
    this.tripleDotSanitizedHtmlContent = { footer: sanitizedFooter, quote: undefined };
    this.actionRenderTripleDotContentHandle(this.view.S.cached('triple_dot')[0]);
  };

  public addTripleDotQuoteExpandFooterAndQuoteBtn = async (msgId: string, method: 'reply' | 'forward', forceReload = false) => {
    if (!this.messageToReplyOrForward || forceReload) {
      this.view.S.cached('triple_dot').addClass('progress');
      Xss.sanitizeAppend(this.view.S.cached('triple_dot'), '<div id="loader">0%</div>');
      this.view.sizeModule.resizeComposeBox();
      try {
        this.messageToReplyOrForward = await this.getAndDecryptMessage(msgId, method);
      } catch (e) {
        ApiErr.reportIfSignificant(e);
        await Ui.modal.error(`Could not load quoted content, please try again.\n\n${ApiErr.eli5(e)}`);
      }
      this.view.S.cached('triple_dot').find('#loader').remove();
      this.view.S.cached('triple_dot').removeClass('progress');
    }
    const textFooter = await this.view.footerModule.getFooterFromStorage(this.view.senderModule.getSender());
    const sanitizedFooter = textFooter && !this.view.draftModule.wasMsgLoadedFromDraft ? this.view.footerModule.createFooterHtml(textFooter) : undefined;
    const msgQuote = this.generateHtmlPreviousMsgQuote(method);
    if (method === 'forward') {
      this.view.S.cached('triple_dot').hide();
      for (const file of this.messageToReplyOrForward?.decryptedFiles ?? []) {
        this.view.attachmentsModule.attachment.addFile(file);
      }
      let inputHtml = `<br>${msgQuote}`;
      if (sanitizedFooter) {
        inputHtml += `<br><br>${sanitizedFooter}`;
      }
      Xss.sanitizeAppend(this.view.S.cached('input_text'), inputHtml);
      this.view.draftModule.setLastDraftBody(inputHtml);
      this.view.sizeModule.resizeComposeBox();
    } else {
      const sanitizedQuote = `<br><br>${msgQuote}`;
      this.tripleDotSanitizedHtmlContent = { footer: sanitizedFooter, quote: sanitizedQuote };
      this.view.S.cached('triple_dot').on(
        'click',
        this.view.setHandler(el => this.actionRenderTripleDotContentHandle(el))
      );
    }
  };

  private getAndDecryptMessage = async (msgId: string, method: 'reply' | 'forward'): Promise<MessageToReplyOrForward | undefined> => {
    try {
      const { raw } = await this.view.emailProvider.msgGet(msgId, 'raw', progress => this.setQuoteLoaderProgress(progress));
      this.setQuoteLoaderProgress('processing...');
      if (!raw) {
        return;
      }
      const decoded = await Mime.decode(Buf.fromBase64UrlStr(raw));
      const headers = {
        subject: decoded.subject,
        date: decoded.headers.date as string,
        from: decoded.from,
        to: decoded.to,
        cc: decoded.cc,
        references: (decoded.headers.references as string) || '',
        'message-id': (decoded.headers['message-id'] as string) || '',
      };
      const message = decoded.rawSignedContent ? await Mime.process(Buf.fromUtfStr(decoded.rawSignedContent)) : Mime.processDecoded(decoded);
      const readableBlockTypes = ['encryptedMsg', 'plainText', 'plainHtml', 'signedMsg'];
      const decryptedBlockTypes = ['decryptedHtml'];
      if (method === 'forward') {
        readableBlockTypes.push(...['encryptedAttachment', 'plainAttachment']);
        decryptedBlockTypes.push('decryptedAttachment');
      }
      const readableBlocks: MsgBlock[] = [];
      for (const block of message.blocks.filter(b => readableBlockTypes.includes(b.type))) {
        if (['encryptedMsg', 'signedMsg'].includes(block.type)) {
          this.setQuoteLoaderProgress('decrypting...');
          const decrypted = await this.decryptMessage(block.content);
          const msgBlocks = await MsgBlockParser.fmtDecryptedAsSanitizedHtmlBlocks(Buf.fromUtfStr(decrypted));
          readableBlocks.push(...msgBlocks.blocks.filter(b => decryptedBlockTypes.includes(b.type)));
        } else {
          readableBlocks.push(block);
        }
      }
      const decryptedAndFormatedContent: string[] = [];
      const decryptedFiles: File[] = [];
      for (const block of readableBlocks) {
        const stringContent = Str.with(block.content);
        if (block.type === 'decryptedHtml') {
          const htmlParsed = Xss.htmlSanitizeAndStripAllTags(stringContent || 'No Content', '\n', false);
          decryptedAndFormatedContent.push(Xss.htmlUnescape(htmlParsed));
        } else if (block.type === 'plainHtml') {
          decryptedAndFormatedContent.push(Xss.htmlUnescape(Xss.htmlSanitizeAndStripAllTags(stringContent, '\n', false)));
        } else if (
          block.attachmentMeta &&
          'data' in block.attachmentMeta &&
          ['encryptedAttachment', 'decryptedAttachment', 'plainAttachment'].includes(block.type)
        ) {
          let attachmentMeta: { content: Buf; filename?: string } | undefined;
          if (block.type === 'encryptedAttachment') {
            this.setQuoteLoaderProgress('decrypting...');
            const result = await MsgUtil.decryptMessage({
              kisWithPp: await KeyStore.getAllWithOptionalPassPhrase(this.view.acctEmail),
              encryptedData: block.attachmentMeta.data,
              verificationPubs: [], // todo: #4158 signature verification of attachments
            });
            if (result.success) {
              attachmentMeta = { content: result.content, filename: result.filename };
            }
          } else {
            attachmentMeta = {
              content: Buf.fromUint8(block.attachmentMeta.data),
              filename: block.attachmentMeta.name,
            };
          }
          if (attachmentMeta) {
            const file = new File([attachmentMeta.content], attachmentMeta.filename || '');
            decryptedFiles.push(file);
          }
        } else {
          decryptedAndFormatedContent.push(stringContent);
        }
      }
      return {
        headers,
        text: decryptedAndFormatedContent.join('\n'),
        isOnlySigned: !!(decoded.rawSignedContent || (message.blocks.length > 0 && message.blocks[0].type === 'signedMsg')),
        decryptedFiles,
      };
    } catch (e) {
      if (ApiErr.isNetErr(e)) {
        // todo: retry
      } else if (ApiErr.isAuthErr(e)) {
        BrowserMsg.send.notificationShowAuthPopupNeeded(this.view.parentTabId, { acctEmail: this.view.acctEmail });
      } else {
        Catch.reportErr(e);
      }
      return;
    }
  };

  private decryptMessage = async (encryptedData: Uint8Array | string): Promise<string> => {
    const decryptRes = await MsgUtil.decryptMessage({
      kisWithPp: await KeyStore.getAllWithOptionalPassPhrase(this.view.acctEmail),
      encryptedData,
      verificationPubs: [],
    });
    if (decryptRes.success) {
      return decryptRes.content.toUtfStr();
    } else if (decryptRes.error && decryptRes.error.type === DecryptErrTypes.needPassphrase) {
      if (Catch.isThunderbirdMail() && this.view.useFullScreenSecureCompose) {
        await Time.sleep(2300);
      }
      BrowserMsg.send.passphraseDialog(this.view.parentTabId, {
        type: 'quote',
        longids: decryptRes.longids.needPassphrase,
      });
      const wasPpEntered: boolean = await new Promise(resolve => {
        BrowserMsg.addListener('passphrase_entry', async (response: Bm.PassphraseEntry) => resolve(response.entered));
        BrowserMsg.listen(this.view.parentTabId);
      });
      if (wasPpEntered) {
        return await this.decryptMessage(encryptedData); // retry with pp
      }
      return `\n(Skipping previous message quote)\n`;
    } else {
      return `\n(Failed to decrypt quote from previous message because: ${decryptRes.error.type}: ${decryptRes.error.message})\n`;
    }
  };

  private convertLineBreakToBr = (text: string, shouldQuote: boolean) => {
    return text
      .split('\n')
      .map(line => `<br>${shouldQuote ? '&gt; ' : ''}${line}`.trim())
      .join('');
  };

  private generateHtmlPreviousMsgQuote = (method: 'reply' | 'forward') => {
    if (!this.messageToReplyOrForward?.text || !this.messageToReplyOrForward.headers.date) {
      return;
    }
    const text = this.messageToReplyOrForward.text;
    const from = Str.parseEmail(this.messageToReplyOrForward.headers.from || '').email;
    const date = new Date(String(this.messageToReplyOrForward.headers.date));
    const dateStr = Str.fromDate(date).replace(' ', ' at ');
    const rtl = new RegExp('[' + Str.rtlChars + ']').exec(text);
    const dirAttr = `dir="${rtl ? 'rtl' : 'ltr'}"`;
    const escapedText = this.convertLineBreakToBr(Xss.escape(text), method === 'reply');
    if (method === 'reply') {
      const header = `<div ${dirAttr}>On ${dateStr}, ${from ?? ''} wrote:</div>`;
      const sanitizedQuote = Xss.htmlSanitize(header + escapedText);
      const thunderbirdClass = this.view.useFullScreenSecureCompose ? 'class="height-0"' : ''; // fix long quoted email UI issue happens in fullscreen
      return `<blockquote ${thunderbirdClass} ${dirAttr}>${sanitizedQuote}</blockquote>`;
    } else {
      const header =
        `<div ${dirAttr}>` +
        `---------- Forwarded message ---------<br/>` +
        `From: ${from}<br>` +
        `Date: ${dateStr}<br>` +
        `Subject: ${this.messageToReplyOrForward.headers.subject}<br>` +
        `To: ${this.messageToReplyOrForward.headers.to.join(', ')}<br>` +
        (this.messageToReplyOrForward.headers.cc?.length ? `Cc: ${this.messageToReplyOrForward.headers.cc?.join(', ')}` : '') +
        `</div>`;
      return `${header}<br><br>${escapedText}`;
    }
  };

  private actionRenderTripleDotContentHandle = (el: HTMLElement) => {
    $(el).remove();
    const inputEl = this.view.S.cached('input_text');
    Xss.sanitizeAppend(inputEl, this.getTripleDotSanitizedFormattedHtmlContent());
    this.view.draftModule.setLastDraftBody(inputEl.html());
    this.tripleDotSanitizedHtmlContent = undefined;
    this.view.sizeModule.resizeComposeBox();
  };

  private setQuoteLoaderProgress = (percentOrString: string | number | undefined): void => {
    if (percentOrString) {
      this.view.S.cached('triple_dot')
        .find('#loader')
        .text(typeof percentOrString === 'number' ? `${percentOrString}%` : percentOrString);
    }
  };
}
