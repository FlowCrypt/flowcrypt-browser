/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { PgpBlockView } from '../pgp_block.js';
import { Str } from '../../../js/common/core/common.js';
import { Xss } from '../../../js/common/platform/xss.js';

export class PgpBlockViewQuoteModule {
  public constructor(private view: PgpBlockView) {}

  public separateQuotedContentAndRenderText = (decryptedContent: string, isHtml: boolean) => {
    if (isHtml) {
      const message = $('<div>').html(Xss.htmlSanitizeKeepBasicTags(decryptedContent)); // xss-sanitized
      let htmlBlockQuoteExists = false;
      const shouldBeQuoted: Array<Element> = [];
      for (let i = message[0].children.length - 1; i >= 0; i--) {
        if (['BLOCKQUOTE', 'BR', 'PRE'].includes(message[0].children[i].nodeName)) {
          shouldBeQuoted.push(message[0].children[i]);
          if (message[0].children[i].nodeName === 'BLOCKQUOTE') {
            htmlBlockQuoteExists = true;
            break;
          }
          continue;
        } else {
          break;
        }
      }
      if (htmlBlockQuoteExists) {
        let quotedHtml = '';
        for (let i = shouldBeQuoted.length - 1; i >= 0; i--) {
          message[0].removeChild(shouldBeQuoted[i]);
          quotedHtml += shouldBeQuoted[i].outerHTML;
        }
        this.view.renderModule.renderContent(message.html(), false);
        this.appendCollapsedQuotedContentButton(quotedHtml, true);
      } else {
        this.view.renderModule.renderContent(decryptedContent, false);
      }
    } else {
      const lines = decryptedContent.split(/\r?\n/);
      const linesQuotedPart: string[] = [];
      while (lines.length) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const lastLine = lines.pop()!; // lines.length above ensures there is a line
        if (lastLine[0] === '>' || !lastLine.length) {
          // look for lines starting with '>' or empty lines, from last line up (sometimes quoted content may have empty lines in it)
          linesQuotedPart.unshift(lastLine);
        } else {
          // found first non-quoted part from the bottom
          if (lastLine.startsWith('On ') && lastLine.endsWith(' wrote:')) {
            // on the very top of quoted content, looks like qote header
            linesQuotedPart.unshift(lastLine);
          } else {
            // no quote header, just regular content from here onwards
            lines.push(lastLine);
          }
          break;
        }
      }
      if (linesQuotedPart.length && !lines.length) {
        // only got quoted part, no real text -> show everything as real text, without quoting
        lines.push(...linesQuotedPart.splice(0, linesQuotedPart.length));
      }
      this.view.renderModule.renderContent(Str.escapeTextAsRenderableHtml(lines.join('\n')), false);
      if (linesQuotedPart.join('').trim()) {
        this.appendCollapsedQuotedContentButton(linesQuotedPart.join('\n'));
      }
    }
  };

  private appendCollapsedQuotedContentButton = (message: string, isHtml = false) => {
    const pgpBlk = $('#pgp_block');
    pgpBlk.append(
      '<div id="action_show_quoted_content" data-test="action-show-quoted-content" class="three_dots"><img src="/img/svgs/three-dots.svg" /></div>'
    ); // xss-direct
    const messageHtml = isHtml ? message : Str.escapeTextAsRenderableHtml(message);
    pgpBlk.append(`<div class="quoted_content">${Xss.htmlSanitizeKeepBasicTags(messageHtml)}</div>`); // xss-sanitized
    pgpBlk.find('#action_show_quoted_content').on(
      'click',
      this.view.setHandler(() => {
        $('.quoted_content').css('display', $('.quoted_content').css('display') === 'none' ? 'block' : 'none');
        this.view.renderModule.resizePgpBlockFrame();
      })
    );
  };
}
