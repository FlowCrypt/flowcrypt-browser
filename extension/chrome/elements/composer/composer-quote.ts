/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { MessageToReplyOrForward } from './composer-types.js';
import { Xss } from '../../../js/common/platform/xss.js';
import { Str } from '../../../js/common/core/common.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { ProgressCb } from '../../../js/common/api/api.js';
import { Catch } from '../../../js/common/platform/catch.js';
import { ComposerComponent } from './composer-abstract-component.js';
import { Mime } from '../../../js/common/core/mime.js';
import { Buf } from '../../../js/common/core/buf.js';
import { FormatError, PgpMsg } from '../../../js/common/core/pgp-msg.js';
import { BrowserMsg, Bm } from '../../../js/common/browser/browser-msg.js';
import { Store } from '../../../js/common/platform/store.js';
import { ApiErr } from '../../../js/common/api/error/api-error.js';
import { MsgBlock } from '../../../js/common/core/msg-block.js';
import { MsgBlockParser } from '../../../js/common/core/msg-block-parser.js';

export class ComposerQuote extends ComposerComponent {
  private msgExpandingHTMLPart: string | undefined;

  private footerHTML: string | undefined;
  public messageToReplyOrForward: MessageToReplyOrForward | undefined;

  get getFooterHTML(): string | undefined {
    return this.footerHTML;
  }

  get expandingHTMLPart(): string | undefined {
    return this.msgExpandingHTMLPart;
  }

  public initActions = (): void => {
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
        ApiErr.reportIfSignificant(e);
        await Ui.modal.error(`Could not load quoted content, please try again.\n\n${ApiErr.eli5(e)}`);
      }
      this.composer.S.cached('icon_show_prev_msg').find('#loader').remove();
      this.composer.S.cached('icon_show_prev_msg').removeClass('progress');
    }
    if (!this.messageToReplyOrForward && msgId) {
      this.composer.S.cached('icon_show_prev_msg').click(this.view.setHandler(async () => {
        this.composer.S.cached('icon_show_prev_msg').unbind('click');
        await this.addTripleDotQuoteExpandBtn(msgId, method);
        if (this.messageToReplyOrForward) {
          this.composer.S.cached('icon_show_prev_msg').click();
        }
      }));
      return;
    }
    let safePreviousMsg = '';
    if (footer && !this.view.draftId) {
      this.footerHTML = this.createFooterHTML(footer);
      safePreviousMsg += this.footerHTML;
    }
    if (this.messageToReplyOrForward?.text) {
      const sentDate = new Date(String(this.messageToReplyOrForward.headers.date));
      if (this.messageToReplyOrForward.headers.from && this.messageToReplyOrForward.headers.date) {
        safePreviousMsg += `<br><br>${this.generateHtmlPreviousMsgQuote(this.messageToReplyOrForward.text, sentDate, this.messageToReplyOrForward.headers.from)}`;
      }
      if (method === 'forward' && this.messageToReplyOrForward.decryptedFiles.length) {
        for (const file of this.messageToReplyOrForward.decryptedFiles) {
          this.composer.atts.attach.addFile(file);
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

  public replaceFooter = (newFooter: string | undefined) => {
    newFooter = newFooter ? this.createFooterHTML(newFooter) : '';
    if (this.footerHTML) {
      let textHTML = this.msgExpandingHTMLPart || this.composer.input.squire.getHTML();
      const lastOccurrenceIndex = textHTML.lastIndexOf(this.footerHTML);
      if (lastOccurrenceIndex !== -1) {
        textHTML = textHTML.substr(0, lastOccurrenceIndex) + newFooter + textHTML.substr(lastOccurrenceIndex + this.footerHTML.length);
        if (this.msgExpandingHTMLPart) {
          this.msgExpandingHTMLPart = textHTML;
          if (!textHTML) {
            this.composer.S.cached('icon_show_prev_msg').hide();
          }
        } else {
          this.composer.input.squire.setHTML(textHTML); // xss-sanitized
        }
      }
    } else {
      if (this.msgExpandingHTMLPart) {
        this.msgExpandingHTMLPart = newFooter + this.msgExpandingHTMLPart;
      } else {
        this.composer.input.squire.insertHTML(newFooter); // xss-sanitized
      }
    }
    this.footerHTML = newFooter || undefined;
  }

  public getAndDecryptMessage = async (msgId: string, method: 'reply' | 'forward', progressCb?: ProgressCb): Promise<MessageToReplyOrForward | undefined> => {
    try {
      const { raw } = await this.composer.emailProvider.msgGet(msgId, 'raw', progressCb ? (progress: number) => progressCb(progress * 0.6) : undefined);
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
          const msgBlocks = await MsgBlockParser.fmtDecryptedAsSanitizedHtmlBlocks(Buf.fromUtfStr(decrypted));
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
          if (block.attMeta?.data) {
            let attMeta: { content: Buf, filename?: string } | undefined;
            if (block.type === 'encryptedAtt') {
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

  private createFooterHTML = (footer: string) => {
    const sanitizedPlainFooter = Xss.htmlSanitizeAndStripAllTags(footer, '\n');
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

  private setExpandingTextAfterClick = () => {
    this.composer.S.cached('icon_show_prev_msg')
      .click(this.view.setHandler(el => {
        el.style.display = 'none';
        Xss.sanitizeAppend(this.composer.S.cached('input_text'), this.msgExpandingHTMLPart || '');
        this.msgExpandingHTMLPart = undefined;
        this.composer.input.squire.focus();
        this.composer.size.resizeComposeBox();
      }));
  }

  private setQuoteLoaderProgress = (text: string) => {
    return this.composer.S.cached('icon_show_prev_msg').find('#loader').text(text);
  }

}
