/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { VerifyRes } from '../../../js/common/core/pgp-msg.js';

import { Att } from '../../../js/common/core/att.js';
import { BrowserMsg } from '../../../js/common/browser/browser-msg.js';
import { Buf } from '../../../js/common/core/buf.js';
import { Catch } from '../../../js/common/platform/catch.js';
import { Mime } from '../../../js/common/core/mime.js';
import { MsgBlock } from '../../../js/common/core/msg-block.js';
import { PgpBlockView } from '../pgp_block.js';
import { Str } from '../../../js/common/core/common.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { Xss } from '../../../js/common/platform/xss.js';
import { MsgBlockParser } from '../../../js/common/core/msg-block-parser.js';
import { AcctStore } from '../../../js/common/platform/store/acct-store.js';

export class PgpBlockViewRenderModule {
  public doNotSetStateAsReadyYet = false;

  private heightHist: number[] = [];

  constructor(private view: PgpBlockView) {
  }

  public renderText = (text: string) => {
    document.getElementById('pgp_block')!.innerText = text;
  }

  public resizePgpBlockFrame = () => {
    let height = Math.max($('#pgp_block').height()!, 20) + 40;
    this.heightHist.push(height);
    const len = this.heightHist.length;
    if (len >= 4 && this.heightHist[len - 1] === this.heightHist[len - 3] && this.heightHist[len - 2] === this.heightHist[len - 4] && this.heightHist[len - 1] !== this.heightHist[len - 2]) {
      console.info('pgp_block.js: repetitive resize loop prevented'); // got repetitive, eg [70, 80, 200, 250, 200, 250]
      height = Math.max(this.heightHist[len - 1], this.heightHist[len - 2]); // pick the larger number to stop if from oscillating
    }
    BrowserMsg.send.setCss(this.view.parentTabId, { selector: `iframe#${this.view.frameId}`, css: { height: `${height}px` } });
  }

  public renderContent = async (htmlContent: string, isErr: boolean) => {
    if (!isErr && !this.view.isOutgoing) { // successfully opened incoming message
      await AcctStore.set(this.view.acctEmail, { successfully_received_at_leat_one_message: true });
    }
    if (!isErr) { // rendering message content
      const pgpBlock = $('#pgp_block').html(Xss.htmlSanitizeKeepBasicTags(htmlContent, 'IMG-TO-LINK')); // xss-sanitized
      pgpBlock.find('a.image_src_link').one('click', this.view.setHandler((el, ev) => this.displayImageSrcLinkAsImg(el as HTMLAnchorElement, ev as JQuery.Event<HTMLAnchorElement, null>)));
    } else { // rendering our own ui
      Xss.sanitizeRender('#pgp_block', htmlContent);
    }
    if (isErr) {
      $('.action_show_raw_pgp_block').click(this.view.setHandler(target => {
        $('.raw_pgp_block').css('display', 'block');
        $(target).css('display', 'none');
        this.resizePgpBlockFrame();
      }));
    }
    this.resizePgpBlockFrame(); // resize window now
    Catch.setHandledTimeout(() => { $(window).resize(this.view.setHandlerPrevent('spree', () => this.resizePgpBlockFrame())); }, 1000); // start auto-resizing the window after 1s
  }

  public setFrameColor = (color: 'red' | 'green' | 'gray') => {
    if (color === 'red') {
      $('#pgp_background').removeClass('pgp_secure').removeClass('pgp_neutral').addClass('pgp_insecure');
    } else if (color === 'green') {
      $('#pgp_background').removeClass('pgp_neutral').removeClass('pgp_insecure').addClass('pgp_secure');
    } else {
      $('#pgp_background').removeClass('pgp_secure').removeClass('pgp_insecure').addClass('pgp_neutral');
    }
  }

  public decideDecryptedContentFormattingAndRender = async (decryptedBytes: Buf, isEncrypted: boolean, sigResult: VerifyRes | undefined, plainSubject?: string) => {
    this.setFrameColor(isEncrypted ? 'green' : 'gray');
    this.view.signatureModule.renderPgpSignatureCheckResult(sigResult);
    const publicKeys: string[] = [];
    let renderableAtts: Att[] = [];
    let decryptedContent = decryptedBytes.toUtfStr();
    let isHtml: boolean = false;
    // todo - replace with MsgBlockParser.fmtDecryptedAsSanitizedHtmlBlocks, then the extract/strip methods could be private?
    if (!Mime.resemblesMsg(decryptedBytes)) {
      const fcAttBlocks: MsgBlock[] = [];
      decryptedContent = MsgBlockParser.extractFcAtts(decryptedContent, fcAttBlocks);
      decryptedContent = MsgBlockParser.stripFcTeplyToken(decryptedContent);
      decryptedContent = MsgBlockParser.stripPublicKeys(decryptedContent, publicKeys);
      if (fcAttBlocks.length) {
        renderableAtts = fcAttBlocks.map(attBlock => new Att(attBlock.attMeta!));
      }
    } else {
      this.renderText('Formatting...');
      const decoded = await Mime.decode(decryptedBytes);
      if (typeof decoded.html !== 'undefined') {
        decryptedContent = decoded.html;
        isHtml = true;
      } else if (typeof decoded.text !== 'undefined') {
        decryptedContent = decoded.text;
      } else {
        decryptedContent = '';
      }
      if (decoded.subject && isEncrypted && (!plainSubject || !Mime.subjectWithoutPrefixes(plainSubject).includes(Mime.subjectWithoutPrefixes(decoded.subject)))) {
        // there is an encrypted subject + (either there is no plain subject or the plain subject does not contain what's in the encrypted subject)
        decryptedContent = this.getEncryptedSubjectText(decoded.subject, isHtml) + decryptedContent; // render encrypted subject in message
      }
      for (const att of decoded.atts) {
        if (att.treatAs() !== 'publicKey') {
          renderableAtts.push(att);
        } else {
          publicKeys.push(att.getData().toUtfStr());
        }
      }
    }
    await this.view.quoteModule.separateQuotedContentAndRenderText(decryptedContent, isHtml);
    if (decryptedContent.match(new RegExp('[' + Str.rtlChars + ']'))) {
      $('#pgp_signature').addClass('rtl');
    }
    if (publicKeys.length) {
      BrowserMsg.send.renderPublicKeys(this.view.parentTabId, { afterFrameId: this.view.frameId, publicKeys });
    }
    if (renderableAtts.length) {
      this.view.attachmentsModule.renderInnerAtts(renderableAtts);
    }
    if (this.view.pwdEncryptedMsgModule.passwordMsgLinkRes && this.view.pwdEncryptedMsgModule.passwordMsgLinkRes.expire) {
      this.view.pwdEncryptedMsgModule.renderFutureExpiration(this.view.pwdEncryptedMsgModule.passwordMsgLinkRes.expire);
    }
    this.resizePgpBlockFrame();
    if (!this.doNotSetStateAsReadyYet) { // in case async tasks are still being worked at
      Ui.setTestState('ready');
    }
  }

  private displayImageSrcLinkAsImg = (a: HTMLAnchorElement, event: JQuery.Event<HTMLAnchorElement, null>) => {
    const img = document.createElement('img');
    img.setAttribute('style', a.getAttribute('style') || '');
    img.style.background = 'none';
    img.style.border = 'none';
    img.addEventListener('load', () => this.resizePgpBlockFrame());
    if (a.href.startsWith('cid:')) { // image included in the email
      const contentId = a.href.replace(/^cid:/g, '');
      const content = this.view.attachmentsModule.includedAtts.filter(a => a.type.indexOf('image/') === 0 && a.cid === `<${contentId}>`)[0];
      if (content) {
        img.src = `data:${a.type};base64,${content.getData().toBase64Str()}`;
        a.outerHTML = img.outerHTML; // xss-safe-value - img.outerHTML was built using dom node api
      } else {
        a.outerHTML = Xss.escape(`[broken link: ${a.href}]`); // xss-escaped
      }
    } else if (a.href.startsWith('https://') || a.href.startsWith('http://')) { // image referenced as url
      img.src = a.href;
      a.outerHTML = img.outerHTML; // xss-safe-value - img.outerHTML was built using dom node api
    } else if (a.href.startsWith('data:image/')) { // image directly inlined
      img.src = a.href;
      a.outerHTML = img.outerHTML; // xss-safe-value - img.outerHTML was built using dom node api
    } else {
      a.outerHTML = Xss.escape(`[broken link: ${a.href}]`); // xss-escaped
    }
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }

  private getEncryptedSubjectText = (subject: string, isHtml: boolean) => {
    if (isHtml) {
      return `<div style="font-size: 14px; border-bottom: 1px #cacaca"> Encrypted Subject:
                <b> ${subject}</b>
              </div>
              <hr/>`;
    } else {
      return `Encrypted Subject: ${subject}\n----------------------------------------------------------------------------------------------------\n`;
    }
  }

}
