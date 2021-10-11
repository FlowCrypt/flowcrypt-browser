/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Bm, BrowserMsg } from '../../../js/common/browser/browser-msg.js';
import { FormatError, MsgUtil, DecryptErrTypes } from '../../../js/common/core/crypto/pgp/msg-util.js';
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

export class ComposeQuoteModule extends ViewModule<ComposeView> {

  public tripleDotSanitizedHtmlContent: { quote: string | undefined, footer: string | undefined } | undefined;
  public messageToReplyOrForward: MessageToReplyOrForward | undefined;

  public getTripleDotSanitizedFormattedHtmlContent = (): string => { // email content order: [myMsg, myFooter, theirQuote]
    if (this.tripleDotSanitizedHtmlContent) {
      return '<br />' + (this.tripleDotSanitizedHtmlContent.footer || '') + (this.tripleDotSanitizedHtmlContent.quote || '');
    }
    return '';
  }

  public addTripleDotQuoteExpandFooterOnlyBtn = async () => {
    const textFooter = await this.view.footerModule.getFooterFromStorage(this.view.senderModule.getSender());
    if (!textFooter) {
      this.view.S.cached('triple_dot').hide();
      return;
    }
    const sanitizedFooter = textFooter && !this.view.draftModule.wasMsgLoadedFromDraft ? this.view.footerModule.createFooterHtml(textFooter) : undefined;
    this.tripleDotSanitizedHtmlContent = { footer: sanitizedFooter, quote: undefined };
    this.view.S.cached('triple_dot').click(this.view.setHandler(el => this.actionRenderTripleDotContentHandle(el)));
  }

  public addTripleDotQuoteExpandFooterAndQuoteBtn = async (msgId: string, method: 'reply' | 'forward') => {
    if (!this.messageToReplyOrForward) {
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
    let sanitizedQuote = '';
    if (this.messageToReplyOrForward?.text) {
      const sentDate = new Date(String(this.messageToReplyOrForward.headers.date));
      if (this.messageToReplyOrForward.headers.from && this.messageToReplyOrForward.headers.date) {
        sanitizedQuote += `<br><br>${this.generateHtmlPreviousMsgQuote(this.messageToReplyOrForward.text, sentDate, this.messageToReplyOrForward.headers.from)}`;
      }
      if (method === 'forward' && this.messageToReplyOrForward.decryptedFiles.length) {
        for (const file of this.messageToReplyOrForward.decryptedFiles) {
          this.view.attachmentsModule.attachment.addFile(file);
        }
      }
    }
    const textFooter = await this.view.footerModule.getFooterFromStorage(this.view.senderModule.getSender());
    const sanitizedFooter = textFooter && !this.view.draftModule.wasMsgLoadedFromDraft ? this.view.footerModule.createFooterHtml(textFooter) : undefined;
    if (!sanitizedQuote && !sanitizedFooter) {
      this.view.S.cached('triple_dot').hide();
      return;
    }
    this.tripleDotSanitizedHtmlContent = { footer: sanitizedFooter, quote: sanitizedQuote };
    if (method === 'forward') {
      this.actionRenderTripleDotContentHandle(this.view.S.cached('triple_dot')[0]);
    } else {
      this.view.S.cached('triple_dot').click(this.view.setHandler(el => this.actionRenderTripleDotContentHandle(el)));
    }
  }

  private getAndDecryptMessage = async (msgId: string, method: 'reply' | 'forward'): Promise<MessageToReplyOrForward | undefined> => {
    try {
      const { raw } = await this.view.emailProvider.msgGet(msgId, 'raw', (progress) => this.setQuoteLoaderProgress(progress));
      this.setQuoteLoaderProgress('processing...');
      const decoded = await Mime.decode(Buf.fromBase64UrlStr(raw!));
      const headers = {
        date: String(decoded.headers.date), from: decoded.from,
        references: String(decoded.headers.references || ''),
        'message-id': String(decoded.headers['message-id'] || ''),
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
          const decrypted = await this.decryptMessage(Buf.fromUtfStr(block.content.toString()));
          const msgBlocks = await MsgBlockParser.fmtDecryptedAsSanitizedHtmlBlocks(Buf.fromUtfStr(decrypted));
          readableBlocks.push(...msgBlocks.blocks.filter(b => decryptedBlockTypes.includes(b.type)));
        } else {
          readableBlocks.push(block);
        }
      }
      const decryptedAndFormatedContent: string[] = [];
      const decryptedFiles: File[] = [];
      for (const block of readableBlocks) {
        const stringContent = block.content.toString();
        if (block.type === 'decryptedHtml') {
          const htmlParsed = Xss.htmlSanitizeAndStripAllTags(block ? block.content.toString() : 'No Content', '\n');
          decryptedAndFormatedContent.push(Xss.htmlUnescape(htmlParsed));
        } else if (block.type === 'plainHtml') {
          decryptedAndFormatedContent.push(Xss.htmlUnescape(Xss.htmlSanitizeAndStripAllTags(stringContent, '\n')));
        } else if (['encryptedAttachment', 'decryptedAttachment', 'plainAttachment'].includes(block.type)) {
          if (block.attachmentMeta?.data) {
            let attachmentMeta: { content: Buf, filename?: string } | undefined;
            if (block.type === 'encryptedAttachment') {
              this.setQuoteLoaderProgress('decrypting...');
              const result = await MsgUtil.decryptMessage({ kisWithPp: await KeyStore.getAllWithOptionalPassPhrase(this.view.acctEmail), encryptedData: block.attachmentMeta.data });
              if (result.success) {
                attachmentMeta = { content: result.content, filename: result.filename };
              }
            } else {
              attachmentMeta = { content: Buf.fromUint8(block.attachmentMeta.data), filename: block.attachmentMeta.name };
            }
            if (attachmentMeta) {
              const file = new File([attachmentMeta.content], attachmentMeta.filename || '');
              decryptedFiles.push(file);
            }
          }
        } else {
          decryptedAndFormatedContent.push(stringContent);
        }
      }
      return {
        headers,
        text: decryptedAndFormatedContent.join('\n').trim(),
        isOnlySigned: !!(decoded.rawSignedContent || (message.blocks.length > 0 && message.blocks[0].type === 'signedMsg')),
        decryptedFiles
      };
    } catch (e) {
      if (e instanceof FormatError) {
        Xss.sanitizeAppend(this.view.S.cached('input_text'), `<br/>\n<br/>\n<br/>\n${Xss.escape(e.data)}`);
      } else if (ApiErr.isNetErr(e)) {
        // todo: retry
      } else if (ApiErr.isAuthErr(e)) {
        BrowserMsg.send.notificationShowAuthPopupNeeded(this.view.parentTabId, { acctEmail: this.view.acctEmail });
      } else {
        Catch.reportErr(e);
      }
      return;
    }
  }

  private decryptMessage = async (encryptedData: Buf): Promise<string> => {
    const decryptRes = await MsgUtil.decryptMessage({ kisWithPp: await KeyStore.getAllWithOptionalPassPhrase(this.view.acctEmail), encryptedData });
    if (decryptRes.success) {
      return decryptRes.content.toUtfStr();
    } else if (decryptRes.error && decryptRes.error.type === DecryptErrTypes.needPassphrase) {
      BrowserMsg.send.passphraseDialog(this.view.parentTabId, { type: 'quote', longids: decryptRes.longids.needPassphrase });
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
  }

  private quoteText = (text: string) => {
    return text.split('\n').map(line => `&gt; ${line}`.trim()).join('\n');
  }

  private generateHtmlPreviousMsgQuote = (text: string, date: Date, from: string) => {
    let onDateUserWrote = `On ${Str.fromDate(date).replace(' ', ' at ')}, ${from} wrote:\n`;
    const rtl = text.match(new RegExp('[' + Str.rtlChars + ']'));
    if (rtl) {
      onDateUserWrote = `<div dir="ltr">${onDateUserWrote}</div>`;
    }
    const sanitizedQuote = Xss.htmlSanitize(onDateUserWrote + this.quoteText(Xss.escape(text)));
    return `<blockquote${rtl ? ' dir="rtl"' : ''}>${sanitizedQuote}</blockquote>`;
  }

  private actionRenderTripleDotContentHandle = (el: HTMLElement) => {
    $(el).remove();
    Xss.sanitizeAppend(this.view.S.cached('input_text'), this.getTripleDotSanitizedFormattedHtmlContent());
    this.tripleDotSanitizedHtmlContent = undefined;
    this.view.sizeModule.resizeComposeBox();
  }

  private setQuoteLoaderProgress = (percentOrString: string | number | undefined): void => {
    if (percentOrString) {
      this.view.S.cached('triple_dot').find('#loader').text(typeof percentOrString === 'number' ? `${percentOrString}%` : percentOrString);
    }
  }

}
