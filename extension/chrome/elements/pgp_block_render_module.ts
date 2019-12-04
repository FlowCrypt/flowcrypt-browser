/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { PgpBlockView } from './pgp_block.js';
import { Xss } from '../../js/common/platform/xss.js';
import { MsgBlock, Mime } from '../../js/common/core/mime.js';
import { Att } from '../../js/common/core/att.js';
import { Buf } from '../../js/common/core/buf.js';
import { VerifyRes, PgpMsg } from '../../js/common/core/pgp.js';
import { BrowserMsg } from '../../js/common/extension.js';
import { Ui } from '../../js/common/browser.js';
import { Lang } from '../../js/common/lang.js';
import { Str } from '../../js/common/core/common.js';
import { BackendRes } from '../../js/common/api/backend.js';
import { Store } from '../../js/common/platform/store.js';
import { Catch } from '../../js/common/platform/catch.js';

export class PgpBlockViewRenderModule {

  private heightHist: number[] = [];
  public doNotSetStateAsReadyYet = false;

  constructor(private view: PgpBlockView) {
  }

  public renderText(text: string) {
    document.getElementById('pgp_block')!.innerText = text;
  }

  public resizePgpBlockFrame() {
    let height = Math.max($('#pgp_block').height()!, 20) + 40;
    const isInfiniteResizeLoop = () => {
      this.heightHist.push(height);
      const len = this.heightHist.length;
      if (len < 4) {
        return false;
      }
      if (this.heightHist[len - 1] === this.heightHist[len - 3] && this.heightHist[len - 2] === this.heightHist[len - 4] && this.heightHist[len - 1] !== this.heightHist[len - 2]) {
        console.info('pgp_block.js: repetitive resize loop prevented'); // got repetitive, eg [70, 80, 200, 250, 200, 250]
        height = Math.max(this.heightHist[len - 1], this.heightHist[len - 2]);
      }
      return;
    };
    if (!isInfiniteResizeLoop()) {
      BrowserMsg.send.setCss(this.view.parentTabId, { selector: `iframe#${this.view.frameId}`, css: { height: `${height}px` } });
    }
  }

  private displayImageSrcLinkAsImg(a: HTMLAnchorElement, event: JQuery.Event<HTMLAnchorElement, null>) {
    const img = document.createElement('img');
    img.setAttribute('style', a.getAttribute('style') || '');
    img.style.background = 'none';
    img.style.border = 'none';
    img.addEventListener('load', () => this.resizePgpBlockFrame());
    if (a.href.indexOf('cid:') === 0) { // image included in the email
      const contentId = a.href.replace(/^cid:/g, '');
      const content = this.view.attachmentsModule.includedAtts.filter(a => a.type.indexOf('image/') === 0 && a.cid === `<${contentId}>`)[0];
      if (content) {
        img.src = `data:${a.type};base64,${content.getData().toBase64Str()}`;
        a.outerHTML = img.outerHTML; // xss-safe-value - img.outerHTML was built using dom node api
      } else {
        a.outerHTML = Xss.escape(`[broken link: ${a.href}]`); // xss-escaped
      }
    } else if (a.href.indexOf('https://') === 0 || a.href.indexOf('http://') === 0) { // image referenced as url
      img.src = a.href;
      a.outerHTML = img.outerHTML; // xss-safe-value - img.outerHTML was built using dom node api
    } else {
      a.outerHTML = Xss.escape(`[broken link: ${a.href}]`); // xss-escaped
    }
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }

  public async renderContent(htmlContent: string, isErr: boolean) {
    if (!isErr && !this.view.isOutgoing) { // successfully opened incoming message
      await Store.setAcct(this.view.acctEmail, { successfully_received_at_leat_one_message: true });
    }
    if (!isErr) { // rendering message content
      const pgpBlock = $('#pgp_block').html(Xss.htmlSanitizeKeepBasicTags(htmlContent)); // xss-sanitized
      pgpBlock.find('a.image_src_link').one('click', this.view.setHandler(this.displayImageSrcLinkAsImg));
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
    Catch.setHandledTimeout(() => $(window).resize(this.view.setHandlerPrevent('spree', this.resizePgpBlockFrame)), 1000); // start auto-resizing the window after 1s
  }

  public setFrameColor(color: 'red' | 'green' | 'gray') {
    if (color === 'red') {
      $('#pgp_background').removeClass('pgp_secure').removeClass('pgp_neutral').addClass('pgp_insecure');
    } else if (color === 'green') {
      $('#pgp_background').removeClass('pgp_neutral').removeClass('pgp_insecure').addClass('pgp_secure');
    } else {
      $('#pgp_background').removeClass('pgp_secure').removeClass('pgp_insecure').addClass('pgp_neutral');
    }
  }

  public async decideDecryptedContentFormattingAndRender(decryptedBytes: Buf, isEncrypted: boolean, sigResult: VerifyRes | undefined, plainSubject?: string) {
    this.setFrameColor(isEncrypted ? 'green' : 'gray');
    this.view.signatureModule.renderPgpSignatureCheckResult(sigResult);
    const publicKeys: string[] = [];
    let renderableAtts: Att[] = [];
    let decryptedContent = decryptedBytes.toUtfStr();
    let isHtml: boolean = false;
    // todo - replace with PgpMsg.fmtDecrypted
    if (!Mime.resemblesMsg(decryptedBytes)) {
      const fcAttBlocks: MsgBlock[] = [];
      decryptedContent = PgpMsg.extractFcAtts(decryptedContent, fcAttBlocks);
      decryptedContent = PgpMsg.stripFcTeplyToken(decryptedContent);
      decryptedContent = PgpMsg.stripPublicKeys(decryptedContent, publicKeys);
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
    if (publicKeys.length) {
      BrowserMsg.send.renderPublicKeys(this.view.parentTabId, { afterFrameId: this.view.frameId, publicKeys });
    }
    if (renderableAtts.length) {
      this.view.attachmentsModule.renderInnerAtts(renderableAtts);
    }
    if (this.view.passwordMsgLinkRes && this.view.passwordMsgLinkRes.expire) {
      this.view.expirationModule.renderFutureExpiration(this.view.passwordMsgLinkRes.expire);
    }
    this.resizePgpBlockFrame();
    if (!this.doNotSetStateAsReadyYet) { // in case async tasks are still being worked at
      Ui.setTestState('ready');
    }
  }

  public async renderPasswordPromptAndAwaitEntry(attempt: 'first' | 'retry'): Promise<string> {
    let prompt = `<p>${attempt === 'first' ? '' : `<span style="color: red; font-weight: bold;">${Lang.pgpBlock.wrongPassword}</span>`}${Lang.pgpBlock.decryptPasswordPrompt}</p>`;
    const btn = `<div class="button green long decrypt" data-test="action-decrypt-with-password">decrypt message</div>`;
    prompt += `<p><input id="answer" placeholder="Password" data-test="input-message-password"></p><p>${btn}</p>`;
    await this.renderContent(prompt, true);
    Ui.setTestState('ready');
    await Ui.event.clicked('.button.decrypt');
    Ui.setTestState('working'); // so that test suite can wait until ready again
    $(self).text('Opening');
    await Ui.delay(50); // give browser time to render
    return String($('#answer').val());
  }

  public async renderPasswordEncryptedMsgLoadFail(linkRes: BackendRes.FcLinkMsg) {
    if (linkRes.expired) {
      let expirationMsg = Lang.pgpBlock.msgExpiredOn + Str.datetimeToDate(linkRes.expire) + '. ' + Lang.pgpBlock.msgsDontExpire + '\n\n';
      if (linkRes.deleted) {
        expirationMsg += Lang.pgpBlock.msgDestroyed;
      } else if (this.view.isOutgoing && this.view.expirationModule.adminCodes) {
        expirationMsg += '<div class="button gray2 extend_expiration">renew message</div>';
      } else if (!this.view.isOutgoing) {
        expirationMsg += Lang.pgpBlock.askSenderRenew;
      }
      expirationMsg += '\n\n<div class="button gray2 action_security">security settings</div>';
      await this.view.errorModule.renderErr(expirationMsg, undefined);
      this.setFrameColor('gray');
      $('.action_security').click(this.view.setHandler(() => BrowserMsg.send.bg.settings({ page: '/chrome/settings/modules/security.htm', acctEmail: this.view.acctEmail })));
      $('.extend_expiration').click(this.view.setHandler(this.view.expirationModule.renderMsgExpirationRenewOptions));
    } else if (!linkRes.url) {
      await this.view.errorModule.renderErr(Lang.pgpBlock.cannotLocate + Lang.pgpBlock.brokenLink, undefined);
    } else {
      await this.view.errorModule.renderErr(Lang.pgpBlock.cannotLocate + Lang.general.writeMeToFixIt + ' Details:\n\n' + Xss.escape(JSON.stringify(linkRes)), undefined);
    }
  }

  private getEncryptedSubjectText(subject: string, isHtml: boolean) {
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
