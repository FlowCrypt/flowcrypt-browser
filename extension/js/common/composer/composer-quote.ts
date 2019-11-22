/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { MessageToReplyOrForward } from './interfaces/composer-types.js';
import { Xss } from '../platform/xss.js';
import { Str } from '../core/common.js';
import { Ui } from '../browser.js';
import { Api, ProgressCb } from '../api/api.js';
import { Catch } from '../platform/catch.js';
import { ComposerComponent } from './interfaces/composer-component.js';
import { Google } from '../api/google.js';
import { Mime, MsgBlock } from '../core/mime.js';
import { Buf } from '../core/buf.js';
import { FormatError, PgpMsg } from '../core/pgp.js';
import { BrowserMsg, Bm } from '../extension.js';
import { Store } from '../platform/store.js';

export class ComposerQuote extends ComposerComponent {
  public messageToReplyOrForward: MessageToReplyOrForward | undefined;
  private msgExpandingHTMLPart: string | undefined;

  private footerHTML: string | undefined;

  get expandingHTMLPart(): string | undefined {
    return this.msgExpandingHTMLPart;
  }

  initActions(): void {
    // No need
  }

  public addTripleDotQuoteExpandBtn = async (msgId: string | undefined, method?: ('reply' | 'forward'), footer?: string) => {
    if (!this.messageToReplyOrForward && msgId && method) {
      this.composer.S.cached('icon_show_prev_msg').addClass('progress');
      Xss.sanitizeAppend(this.composer.S.cached('icon_show_prev_msg'), '<div id="loader">0%</div>');
      this.composer.size.resizeComposeBox();
      try {
        this.messageToReplyOrForward = await this.getAndDecryptMessage(msgId, method, (progress) => this.setQuoteLoaderProgress(progress + '%'));
      } catch (e) {
        if (Api.err.isSignificant(e)) {
          Catch.reportErr(e);
        }
        await Ui.modal.error(`Could not load quoted content, please try again.\n\n${Api.err.eli5(e)}`);
      }
      this.composer.S.cached('icon_show_prev_msg').find('#loader').remove();
      this.composer.S.cached('icon_show_prev_msg').removeClass('progress');
    }
    if (!this.messageToReplyOrForward && msgId) {
      this.composer.S.cached('icon_show_prev_msg').click(Ui.event.handle(async el => {
        this.composer.S.cached('icon_show_prev_msg').unbind('click');
        await this.addTripleDotQuoteExpandBtn(msgId, method);
        if (this.messageToReplyOrForward) {
          this.composer.S.cached('icon_show_prev_msg').click();
        }
      }));
      return;
    }
    let safePreviousMsg = '';
    if (footer) {
      this.footerHTML = this.createFooterHTML(footer);
      safePreviousMsg += this.footerHTML;
    }
    if (this.messageToReplyOrForward && this.messageToReplyOrForward.text) {
      const sentDate = new Date(String(this.messageToReplyOrForward.headers.date));
      if (this.messageToReplyOrForward.headers.from && this.messageToReplyOrForward.headers.date) {
        safePreviousMsg += `<br><br>${this.generateHtmlPreviousMsgQuote(this.messageToReplyOrForward.text, sentDate, this.messageToReplyOrForward.headers.from)}`;
      }
      if (method === 'forward' && this.messageToReplyOrForward.decryptedFiles.length) {
        for (const file of this.messageToReplyOrForward.decryptedFiles) {
          await this.composer.atts.attach.addFile(file);
        }
      }
    }
    if (!safePreviousMsg) {
      this.composer.S.cached('icon_show_prev_msg').remove();
      return;
    }
    if (method === 'forward') {
      this.composer.S.cached('icon_show_prev_msg').remove();
      Xss.sanitizeAppend(this.composer.S.cached('input_text'), safePreviousMsg);
      this.composer.size.resizeComposeBox();
    } else {
      this.msgExpandingHTMLPart = safePreviousMsg;
      this.setExpandingTextAfterClick();
    }
  }

  public setFooter = (footer: string) => {
    const footerHTML = this.createFooterHTML(footer);
    if ((this.msgExpandingHTMLPart && this.msgExpandingHTMLPart.includes(footerHTML)) ||
      this.composer.S.cached('input_text').html().includes(footerHTML)) {
      this.footerHTML = footerHTML;
    }
  }

  private createFooterHTML = (footer: string) => {
    const sanitizedPlainFooter = Xss.htmlSanitizeAndStripAllTags(footer, '\n', true); // true: strip away images because not supported yet
    const sanitizedHtmlFooter = sanitizedPlainFooter.replace(/\n/g, '<br>');
    const footerFirstLine = sanitizedPlainFooter.split('\n')[0];
    if (!footerFirstLine) {
      return '';
    }
    if (/^[*-_=+#~ ]+$/.test(footerFirstLine)) {
      return `<br>${sanitizedHtmlFooter}`;  // first line of footer is already a footer separator, made of special characters
    }
    return `<br><br>--<br>${sanitizedHtmlFooter}`; // create a custom footer separator
  }

  public replaceFooter = (newFooter: string | undefined) => {
    newFooter = newFooter ? this.createFooterHTML(newFooter) : '';
    if (this.footerHTML) {
      let textHTML = this.msgExpandingHTMLPart || this.composer.S.cached('input_text').html();
      const lastOccurrenceIndex = textHTML.lastIndexOf(this.footerHTML);
      if (lastOccurrenceIndex !== -1) {
        textHTML = textHTML.substr(0, lastOccurrenceIndex) + newFooter + textHTML.substr(lastOccurrenceIndex + this.footerHTML.length);
        if (this.msgExpandingHTMLPart) {
          this.msgExpandingHTMLPart = textHTML;
          if (!textHTML) {
            this.composer.S.cached('icon_show_prev_msg').hide();
          }
        } else {
          this.composer.S.cached('input_text').html(textHTML); // xss-sanitized
        }
      }
    } else {
      if (this.msgExpandingHTMLPart) {
        this.msgExpandingHTMLPart = newFooter + this.msgExpandingHTMLPart;
      } else {
        this.composer.S.cached('input_text').append(newFooter); // xss-sanitized
      }
    }
    this.footerHTML = newFooter || undefined;
  }

  public getAndDecryptMessage = async (msgId: string, method: 'reply' | 'forward', progressCb?: ProgressCb): Promise<MessageToReplyOrForward | undefined> => {
    try {
      const { raw } = await Google.gmail.msgGet(this.urlParams.acctEmail, msgId, 'raw', progressCb ? (progress: number) => progressCb(progress * 0.6) : undefined);
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
          const stringContent = block.content.toString();
          const decrypted = await this.decryptMessage(Buf.fromUtfStr(stringContent));
          const msgBlocks = await PgpMsg.fmtDecryptedAsSanitizedHtmlBlocks(Buf.fromUtfStr(decrypted));
          readableBlocks.push(...msgBlocks.blocks.filter(b => decryptedBlockTypes.includes(b.type)));
        } else {
          readableBlocks.push(block);
        }
      }
      const decryptedAndFormatedContent: string[] = [];
      const decryptedFiles: File[] = [];
      for (const [index, block] of readableBlocks.entries()) {
        const stringContent = block.content.toString();
        if (block.type === 'decryptedHtml') {
          const htmlParsed = Xss.htmlSanitizeAndStripAllTags(block ? block.content.toString() : 'No Content', '\n');
          decryptedAndFormatedContent.push(Xss.htmlUnescape(htmlParsed));
          if (progressCb) {
            progressCb(60 + (Math.round((40 / readableBlocks.length) * (index + 1))));
          }
        } else if (block.type === 'plainHtml') {
          decryptedAndFormatedContent.push(Xss.htmlUnescape(Xss.htmlSanitizeAndStripAllTags(stringContent, '\n')));
        } else if (['encryptedAtt', 'decryptedAtt', 'plainAtt'].includes(block.type)) {
          if (block.attMeta && block.attMeta.data) {
            let attMeta: { content: Buf, filename?: string } | undefined;
            if (block.type === 'encryptedAtt') {
              const result = await PgpMsg.decrypt({ kisWithPp: await Store.keysGetAllWithPp(this.urlParams.acctEmail), encryptedData: block.attMeta.data });
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
            if (progressCb) {
              progressCb(60 + (Math.round((40 / readableBlocks.length) * (index + 1))));
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
      } else if (Api.err.isNetErr(e)) {
        // todo: retry
      } else if (Api.err.isAuthPopupNeeded(e)) {
        BrowserMsg.send.notificationShowAuthPopupNeeded(this.urlParams.parentTabId, { acctEmail: this.urlParams.acctEmail });
      } else {
        Catch.reportErr(e);
      }
      return;
    }
  }

  private decryptMessage = async (encryptedData: Buf): Promise<string> => {
    const decryptRes = await PgpMsg.decrypt({ kisWithPp: await Store.keysGetAllWithPp(this.urlParams.acctEmail), encryptedData });
    if (decryptRes.success) {
      return decryptRes.content.toUtfStr();
    } else if (decryptRes.error && decryptRes.error.type === 'need_passphrase') {
      BrowserMsg.send.passphraseDialog(this.urlParams.parentTabId, { type: 'quote', longids: decryptRes.longids.needPassphrase });
      const wasPpEntered: boolean = await new Promise(resolve => {
        BrowserMsg.addListener('passphrase_entry', async (response: Bm.PassphraseEntry) => resolve(response.entered));
        BrowserMsg.listen(this.urlParams.parentTabId);
      });
      if (wasPpEntered) {
        return await this.decryptMessage(encryptedData); // retry with pp
      }
      return `\n(Skipping previous message quote)\n`;
    } else {
      return `\n(Failed to decrypt quote from previous message because: ${decryptRes.error.type}: ${decryptRes.error.message})\n`;
    }
  }

  private quoteText(text: string) {
    return text.split('\n').map(l => '<br>&gt; ' + l).join('\n');
  }

  private generateHtmlPreviousMsgQuote = (text: string, date: Date, from: string) => {
    const sanitizedQuote = Xss.htmlSanitize(`On ${Str.fromDate(date).replace(' ', ' at ')}, ${from} wrote:${this.quoteText(Xss.escape(text))}`);
    return `<blockquote>${sanitizedQuote}</blockquote>`;
  }

  private setExpandingTextAfterClick = () => {
    this.composer.S.cached('icon_show_prev_msg')
      .click(Ui.event.handle(el => {
        el.style.display = 'none';
        Xss.sanitizeAppend(this.composer.S.cached('input_text'), this.msgExpandingHTMLPart || '');
        this.msgExpandingHTMLPart = undefined;
        this.composer.S.cached('input_text').focus();
        this.composer.size.resizeComposeBox();
      }));
  }

  private setQuoteLoaderProgress = (text: string) => this.composer.S.cached('icon_show_prev_msg').find('#loader').text(text);
}
