/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Bm, BrowserMsg } from '../../../js/common/browser/browser-msg.js';
import { FormatError, PgpMsg } from '../../../js/common/core/pgp-msg.js';

import { ApiErr } from '../../../js/common/api/error/api-error.js';
import { Buf } from '../../../js/common/core/buf.js';
import { Catch } from '../../../js/common/platform/catch.js';
import { ComposerComponent } from './composer-abstract-component.js';
import { MessageToReplyOrForward } from './composer-types.js';
import { Mime } from '../../../js/common/core/mime.js';
import { MsgBlock } from '../../../js/common/core/msg-block.js';
import { MsgBlockParser } from '../../../js/common/core/msg-block-parser.js';
import { Store } from '../../../js/common/platform/store.js';
import { Str } from '../../../js/common/core/common.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { Xss } from '../../../js/common/platform/xss.js';

export class ComposerQuote extends ComposerComponent {

  public tripleDotSanitizedHtmlContent: { quote: string | undefined, footer: string | undefined } | undefined;
  public messageToReplyOrForward: MessageToReplyOrForward | undefined;

  public initActions = (): void => {
    // No need
  }

  public getTripleDotSanitizedFormattedHtmlContent = (): string => { // email content order: [myMsg, myFooter, theirQuote]
    if (this.tripleDotSanitizedHtmlContent) {
      return '<br />' + (this.tripleDotSanitizedHtmlContent.footer || '') + (this.tripleDotSanitizedHtmlContent.quote || '');
    }
    return '';
  }

  public addTripleDotQuoteExpandFooterOnlyBtn = async () => {
    const textFooter = await this.composer.footer.getFooterFromStorage(this.composer.sender.getSender());
    if (!textFooter) {
      this.composer.S.cached('triple_dot').hide();
      return;
    }
    const sanitizedFooter = textFooter && !this.composer.draft.wasMsgLoadedFromDraft ? this.composer.footer.createFooterHtml(textFooter) : undefined;
    this.tripleDotSanitizedHtmlContent = { footer: sanitizedFooter, quote: undefined };
    this.composer.S.cached('triple_dot').click(this.view.setHandler(el => this.actionRenderTripleDotContentHandle(el)));
  }

  public addTripleDotQuoteExpandFooterAndQuoteBtn = async (msgId: string, method: 'reply' | 'forward') => {
    if (!this.messageToReplyOrForward) {
      this.composer.S.cached('triple_dot').addClass('progress');
      Xss.sanitizeAppend(this.composer.S.cached('triple_dot'), '<div id="loader">0%</div>');
      this.composer.size.resizeComposeBox();
      try {
        this.messageToReplyOrForward = await this.getAndDecryptMessage(msgId, method);
      } catch (e) {
        ApiErr.reportIfSignificant(e);
        await Ui.modal.error(`Could not load quoted content, please try again.\n\n${ApiErr.eli5(e)}`);
      }
      this.composer.S.cached('triple_dot').find('#loader').remove();
      this.composer.S.cached('triple_dot').removeClass('progress');
    }
    let sanitizedQuote = '';
    if (this.messageToReplyOrForward?.text) {
      const sentDate = new Date(String(this.messageToReplyOrForward.headers.date));
      if (this.messageToReplyOrForward.headers.from && this.messageToReplyOrForward.headers.date) {
        sanitizedQuote += `<br><br>${this.generateHtmlPreviousMsgQuote(this.messageToReplyOrForward.text, sentDate, this.messageToReplyOrForward.headers.from)}`;
      }
      if (method === 'forward' && this.messageToReplyOrForward.decryptedFiles.length) {
        for (const file of this.messageToReplyOrForward.decryptedFiles) {
          this.composer.atts.attach.addFile(file);
        }
      }
    }
    const textFooter = await this.composer.footer.getFooterFromStorage(this.composer.sender.getSender());
    const sanitizedFooter = textFooter && !this.composer.draft.wasMsgLoadedFromDraft ? this.composer.footer.createFooterHtml(textFooter) : undefined;
    if (!sanitizedQuote && !sanitizedFooter) {
      this.composer.S.cached('triple_dot').hide();
      return;
    }
    this.tripleDotSanitizedHtmlContent = { footer: sanitizedFooter, quote: sanitizedQuote };
    if (method === 'forward') {
      this.actionRenderTripleDotContentHandle(this.composer.S.cached('triple_dot')[0]);
    } else {
      this.composer.S.cached('triple_dot').click(this.view.setHandler(el => this.actionRenderTripleDotContentHandle(el)));
    }
  }

  private getAndDecryptMessage = async (msgId: string, method: 'reply' | 'forward'): Promise<MessageToReplyOrForward | undefined> => {
    try {
      const { raw } = await this.composer.emailProvider.msgGet(msgId, 'raw', (progress) => this.setQuoteLoaderProgress(progress));
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
        readableBlockTypes.push(...['encryptedAtt', 'plainAtt']);
        decryptedBlockTypes.push('decryptedAtt');
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
        } else if (['encryptedAtt', 'decryptedAtt', 'plainAtt'].includes(block.type)) {
          if (block.attMeta?.data) {
            let attMeta: { content: Buf, filename?: string } | undefined;
            if (block.type === 'encryptedAtt') {
              this.setQuoteLoaderProgress('decrypting...');
              const result = await PgpMsg.decrypt({ kisWithPp: await Store.keysGetAllWithPp(this.view.acctEmail), encryptedData: block.attMeta.data });
              if (result.success) {
                attMeta = { content: result.content, filename: result.filename };
              }
            } else {
              attMeta = { content: Buf.fromUint8(block.attMeta.data), filename: block.attMeta.name };
            }
            if (attMeta) {
              const file = new File([attMeta.content], attMeta.filename || '');
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
        Xss.sanitizeAppend(this.composer.S.cached('input_text'), `<br/>\n<br/>\n<br/>\n${Xss.escape(e.data)}`);
      } else if (ApiErr.isNetErr(e)) {
        // todo: retry
      } else if (ApiErr.isAuthPopupNeeded(e)) {
        BrowserMsg.send.notificationShowAuthPopupNeeded(this.view.parentTabId, { acctEmail: this.view.acctEmail });
      } else {
        Catch.reportErr(e);
      }
      return;
    }
  }

  private decryptMessage = async (encryptedData: Buf): Promise<string> => {
    const decryptRes = await PgpMsg.decrypt({ kisWithPp: await Store.keysGetAllWithPp(this.view.acctEmail), encryptedData });
    if (decryptRes.success) {
      return decryptRes.content.toUtfStr();
    } else if (decryptRes.error && decryptRes.error.type === 'need_passphrase') {
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
    return text.split('\n').map(l => '<br>&gt; ' + l).join('\n');
  }

  private generateHtmlPreviousMsgQuote = (text: string, date: Date, from: string) => {
    const sanitizedQuote = Xss.htmlSanitize(`On ${Str.fromDate(date).replace(' ', ' at ')}, ${from} wrote:${this.quoteText(Xss.escape(text))}`);
    return `<blockquote>${sanitizedQuote}</blockquote>`;
  }

  private actionRenderTripleDotContentHandle = (el: HTMLElement) => {
    $(el).remove();
    Xss.sanitizeAppend(this.composer.S.cached('input_text'), this.getTripleDotSanitizedFormattedHtmlContent());
    this.tripleDotSanitizedHtmlContent = undefined;
    this.composer.input.squire.focus();
    this.composer.size.resizeComposeBox();
  }

  private setQuoteLoaderProgress = (percentOrString: string | number | undefined): void => {
    if (percentOrString) {
      this.composer.S.cached('triple_dot').find('#loader').text(typeof percentOrString === 'number' ? `${percentOrString}%` : percentOrString);
    }
  }

}
