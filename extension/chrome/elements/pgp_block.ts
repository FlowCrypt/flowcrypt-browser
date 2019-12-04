/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch } from '../../js/common/platform/catch.js';
import { Store } from '../../js/common/platform/store.js';
import { Str } from '../../js/common/core/common.js';
import { Att } from '../../js/common/core/att.js';
import { Ui } from '../../js/common/browser.js';
import { BrowserMsg } from '../../js/common/extension.js';
import { Lang } from '../../js/common/lang.js';
import { Api } from '../../js/common/api/api.js';
import { VerifyRes, DecryptErrTypes, FormatError, PgpMsg } from '../../js/common/core/pgp.js';
import { Mime, MsgBlock } from '../../js/common/core/mime.js';
import { Google, GmailResponseFormat } from '../../js/common/api/google.js';
import { Buf } from '../../js/common/core/buf.js';
import { BackendRes, Backend } from '../../js/common/api/backend.js';
import { Assert } from '../../js/common/assert.js';
import { Xss } from '../../js/common/platform/xss.js';
import { Url } from '../../js/common/core/common.js';
import { View } from '../../js/common/view.js';
import { PgpBlockViewAttachmentsModule } from './pgp_block_attachmens_module.js';
import { PgpBlockViewSignatureModule } from './pgp_block_signature_module.js';
import { PgpBlockViewExpirationModule } from './pgp_block_expiration_module.js';
import { PgpBlockViewQuoteModule } from './pgp_block_quote_module.js';

export class PgpBlockView extends View { // tslint:disable-line:variable-name

  public readonly acctEmail: string;
  public readonly parentTabId: string;
  private readonly frameId: string;
  private readonly hasChallengePassword: boolean;
  public readonly isOutgoing: boolean;
  public readonly short: string | undefined;
  public readonly senderEmail: string | undefined;
  private readonly msgId: string | undefined;
  private readonly encryptedMsgUrlParam: Buf | undefined;

  private signature: string | boolean | undefined;

  private heightHist: number[] = [];
  private msgFetchedFromApi: false | GmailResponseFormat = false;
  private includedAtts: Att[] = [];
  private canReadEmails: undefined | boolean;
  private passwordMsgLinkRes: BackendRes.FcLinkMsg | undefined;
  private userEnteredMsgPassword: string | undefined;
  public doNotSetStateAsReadyYet = false;

  public readonly attachmentsModule: PgpBlockViewAttachmentsModule;
  public readonly signatureModule: PgpBlockViewSignatureModule;
  public readonly expirationModule: PgpBlockViewExpirationModule;
  public readonly quoteModule: PgpBlockViewQuoteModule;

  constructor() {
    super();
    Ui.event.protect();
    const uncheckedUrlParams = Url.parse(['acctEmail', 'frameId', 'message', 'parentTabId', 'msgId', 'isOutgoing', 'senderEmail', 'hasPassword', 'signature', 'short']);
    this.acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
    this.parentTabId = Assert.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');
    this.frameId = Assert.urlParamRequire.string(uncheckedUrlParams, 'frameId');
    this.hasChallengePassword = uncheckedUrlParams.hasPassword === true;
    this.isOutgoing = uncheckedUrlParams.isOutgoing === true;
    this.short = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'short');
    this.senderEmail = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'senderEmail');
    this.senderEmail = this.senderEmail ? Str.parseEmail(this.senderEmail).email : undefined;
    this.msgId = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'msgId');
    this.encryptedMsgUrlParam = uncheckedUrlParams.message ? Buf.fromUtfStr(Assert.urlParamRequire.string(uncheckedUrlParams, 'message')) : undefined;
    this.signature = uncheckedUrlParams.signature === true ? true : (uncheckedUrlParams.signature ? String(uncheckedUrlParams.signature) : undefined);
    // modules
    this.attachmentsModule = new PgpBlockViewAttachmentsModule(this);
    this.signatureModule = new PgpBlockViewSignatureModule(this);
    this.expirationModule = new PgpBlockViewExpirationModule(this);
    this.quoteModule = new PgpBlockViewQuoteModule(this);
  }

  async render() {
    const storage = await Store.getAcct(this.acctEmail, ['setup_done', 'google_token_scopes']);
    const scopes = await Store.getScopes(this.acctEmail);
    this.canReadEmails = scopes.read || scopes.modify;
    if (storage.setup_done) {
      await this.initialize();
    } else {
      await this.renderErr(Lang.pgpBlock.refreshWindow, this.encryptedMsgUrlParam ? this.encryptedMsgUrlParam.toUtfStr() : undefined);
    }
  }

  setHandlers() {
    // defined as needed, depending on what rendered
  }

  private renderText(text: string) {
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
      BrowserMsg.send.setCss(this.parentTabId, { selector: `iframe#${this.frameId}`, css: { height: `${height}px` } });
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
      const content = this.includedAtts.filter(a => a.type.indexOf('image/') === 0 && a.cid === `<${contentId}>`)[0];
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
    if (!isErr && !this.isOutgoing) { // successfully opened incoming message
      await Store.setAcct(this.acctEmail, { successfully_received_at_leat_one_message: true });
    }
    if (!isErr) { // rendering message content
      const pgpBlock = $('#pgp_block').html(Xss.htmlSanitizeKeepBasicTags(htmlContent)); // xss-sanitized
      pgpBlock.find('a.image_src_link').one('click', this.setHandler(this.displayImageSrcLinkAsImg));
    } else { // rendering our own ui
      Xss.sanitizeRender('#pgp_block', htmlContent);
    }
    if (isErr) {
      $('.action_show_raw_pgp_block').click(this.setHandler(target => {
        $('.raw_pgp_block').css('display', 'block');
        $(target).css('display', 'none');
        this.resizePgpBlockFrame();
      }));
    }
    this.resizePgpBlockFrame(); // resize window now
    Catch.setHandledTimeout(() => $(window).resize(this.setHandlerPrevent('spree', this.resizePgpBlockFrame)), 1000); // start auto-resizing the window after 1s
  }

  private btnHtml(text: string, addClasses: string) {
    return `<div class="button long ${addClasses}" style="margin:30px 0;" target="cryptup">${text}</div>`;
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

  private async renderErr(errBoxContent: string, renderRawMsg: string | undefined) {
    this.setFrameColor('red');
    const showRawMsgPrompt = renderRawMsg ? '<a href="#" class="action_show_raw_pgp_block">show original message</a>' : '';
    await this.renderContent(`<div class="error">${errBoxContent.replace(/\n/g, '<br>')}</div>${showRawMsgPrompt}`, true);
    $('.action_show_raw_pgp_block').click(this.setHandler(async () => { // this may contain content missing MDC
      Xss.sanitizeAppend('#pgp_block', `<div class="raw_pgp_block">${Xss.escape(renderRawMsg!)}</div>`); // therefore the .escape is crucial
    }));
    $('.button.settings_keyserver').click(this.setHandler(() => BrowserMsg.send.bg.settings({ acctEmail: this.acctEmail, page: '/chrome/settings/modules/keyserver.htm' })));
    $('.button.settings').click(this.setHandler(() => BrowserMsg.send.bg.settings({ acctEmail: this.acctEmail })));
    $('.button.settings_add_key').click(this.setHandler(() => BrowserMsg.send.bg.settings({ acctEmail: this.acctEmail, page: '/chrome/settings/modules/add_key.htm' })));
    $('.button.reply_pubkey_mismatch').click(this.setHandler(() => BrowserMsg.send.replyPubkeyMismatch(this.parentTabId)));
    Ui.setTestState('ready');
  }

  private async handlePrivateKeyMismatch(message: Uint8Array) { // todo - make it work for multiple stored keys
    const msgDiagnosis = await BrowserMsg.send.bg.await.pgpMsgDiagnosePubkeys({ privateKis: await Store.keysGet(this.acctEmail), message });
    if (msgDiagnosis.found_match) {
      await this.renderErr(Lang.pgpBlock.cantOpen + Lang.pgpBlock.encryptedCorrectlyFileBug, undefined);
    } else {
      const startText = msgDiagnosis.receivers === 1 ?
        Lang.pgpBlock.cantOpen + Lang.pgpBlock.singleSender + Lang.pgpBlock.askResend : Lang.pgpBlock.yourKeyCantOpenImportIfHave;
      await this.renderErr(startText + this.btnHtml('import missing key', 'gray2 settings_add_key') + '&nbsp; &nbsp;'
        + this.btnHtml('ask sender to update', 'gray2 short reply_pubkey_mismatch') + '&nbsp; &nbsp;' + this.btnHtml('settings', 'gray2 settings_keyserver'), undefined);
    }
  }

  public async getDecryptPwd(suppliedPwd?: string | undefined): Promise<string | undefined> {
    const pwd = suppliedPwd || this.userEnteredMsgPassword;
    if (pwd && this.hasChallengePassword) {
      const { hashed } = await BrowserMsg.send.bg.await.pgpHashChallengeAnswer({ answer: pwd });
      return hashed;
    }
    return pwd;
  }

  private async decideDecryptedContentFormattingAndRender(decryptedBytes: Buf, isEncrypted: boolean, sigResult: VerifyRes | undefined, plainSubject?: string) {
    this.setFrameColor(isEncrypted ? 'green' : 'gray');
    this.signatureModule.renderPgpSignatureCheckResult(sigResult);
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
    await this.quoteModule.separateQuotedContentAndRenderText(decryptedContent, isHtml);
    if (publicKeys.length) {
      BrowserMsg.send.renderPublicKeys(this.parentTabId, { afterFrameId: this.frameId, publicKeys });
    }
    if (renderableAtts.length) {
      this.attachmentsModule.renderInnerAtts(renderableAtts);
    }
    if (this.passwordMsgLinkRes && this.passwordMsgLinkRes.expire) {
      this.expirationModule.renderFutureExpiration(this.passwordMsgLinkRes.expire);
    }
    this.resizePgpBlockFrame();
    if (!this.doNotSetStateAsReadyYet) { // in case async tasks are still being worked at
      Ui.setTestState('ready');
    }
  }

  private async decryptAndRender(encryptedData: Buf, optionalPwd?: string, plainSubject?: string) {
    if (typeof this.signature !== 'string') {
      const kisWithPp = await Store.keysGetAllWithPp(this.acctEmail);
      const result = await BrowserMsg.send.bg.await.pgpMsgDecrypt({ kisWithPp, encryptedData, msgPwd: await this.getDecryptPwd(optionalPwd) });
      if (typeof result === 'undefined') {
        await this.renderErr(Lang.general.restartBrowserAndTryAgain, undefined);
      } else if (result.success) {
        if (this.hasChallengePassword && optionalPwd) {
          this.userEnteredMsgPassword = optionalPwd;
        }
        if (result.success && result.signature && result.signature.contact && !result.signature.match && this.canReadEmails && this.msgFetchedFromApi !== 'raw') {
          console.info(`re-fetching message ${this.msgId} from api because failed signature check: ${!this.msgFetchedFromApi ? 'full' : 'raw'}`);
          await this.initialize(true);
        } else {
          await this.decideDecryptedContentFormattingAndRender(result.content, Boolean(result.isEncrypted), result.signature, plainSubject); // text!: did not request uint8
        }
      } else if (result.error.type === DecryptErrTypes.format) {
        if (this.canReadEmails && this.msgFetchedFromApi !== 'raw') {
          console.info(`re-fetching message ${this.msgId} from api because looks like bad formatting: ${!this.msgFetchedFromApi ? 'full' : 'raw'}`);
          await this.initialize(true);
        } else {
          await this.renderErr(Lang.pgpBlock.badFormat + '\n\n' + result.error.message, encryptedData.toUtfStr());
        }
      } else if (result.longids.needPassphrase.length) {
        await this.renderErr(`<a href="#" class="enter_passphrase" data-test="action-show-passphrase-dialog">${Lang.pgpBlock.enterPassphrase}</a> ${Lang.pgpBlock.toOpenMsg}`, undefined);
        $('.enter_passphrase').click(this.setHandler(() => {
          Ui.setTestState('waiting');
          BrowserMsg.send.passphraseDialog(this.parentTabId, { type: 'message', longids: result.longids.needPassphrase });
        }));
        await Store.waitUntilPassphraseChanged(this.acctEmail, result.longids.needPassphrase);
        this.renderText('Decrypting...');
        await this.decryptAndRender(encryptedData, optionalPwd);
      } else {
        const [primaryKi] = await Store.keysGet(this.acctEmail, ['primary']);
        if (!result.longids.chosen && !primaryKi) {
          await this.renderErr(Lang.pgpBlock.notProperlySetUp + this.btnHtml('FlowCrypt settings', 'green settings'), undefined);
        } else if (result.error.type === DecryptErrTypes.keyMismatch) {
          if (this.hasChallengePassword && !optionalPwd) {
            const pwd = await this.renderPasswordPromptAndAwaitEntry('first');
            await this.decryptAndRender(encryptedData, pwd);
          } else {
            await this.handlePrivateKeyMismatch(encryptedData);
          }
        } else if (result.error.type === DecryptErrTypes.wrongPwd) {
          const pwd = await this.renderPasswordPromptAndAwaitEntry('retry');
          await this.decryptAndRender(encryptedData, pwd);
        } else if (result.error.type === DecryptErrTypes.usePassword) {
          const pwd = await this.renderPasswordPromptAndAwaitEntry('first');
          await this.decryptAndRender(encryptedData, pwd);
        } else if (result.error.type === DecryptErrTypes.noMdc) {
          await this.renderErr(result.error.message, result.content!.toUtfStr()); // missing mdc - only render the result after user confirmation
        } else if (result.error) {
          await this.renderErr(`${Lang.pgpBlock.cantOpen}\n\n<em>${result.error.type}: ${result.error.message}</em>`, encryptedData.toUtfStr());
        } else { // should generally not happen
          delete result.message;
          await this.renderErr(Lang.pgpBlock.cantOpen + Lang.pgpBlock.writeMe + '\n\nDiagnostic info: "' + JSON.stringify(result) + '"', encryptedData.toUtfStr());
        }
      }
    } else {
      const signatureResult = await BrowserMsg.send.bg.await.pgpMsgVerifyDetached({ plaintext: encryptedData, sigText: Buf.fromUtfStr(this.signature) });
      await this.decideDecryptedContentFormattingAndRender(encryptedData, false, signatureResult);
    }
  }

  private async renderPasswordPromptAndAwaitEntry(attempt: 'first' | 'retry'): Promise<string> {
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

  private async renderPasswordEncryptedMsgLoadFail(linkRes: BackendRes.FcLinkMsg) {
    if (linkRes.expired) {
      let expirationMsg = Lang.pgpBlock.msgExpiredOn + Str.datetimeToDate(linkRes.expire) + '. ' + Lang.pgpBlock.msgsDontExpire + '\n\n';
      if (linkRes.deleted) {
        expirationMsg += Lang.pgpBlock.msgDestroyed;
      } else if (this.isOutgoing && this.expirationModule.adminCodes) {
        expirationMsg += '<div class="button gray2 extend_expiration">renew message</div>';
      } else if (!this.isOutgoing) {
        expirationMsg += Lang.pgpBlock.askSenderRenew;
      }
      expirationMsg += '\n\n<div class="button gray2 action_security">security settings</div>';
      await this.renderErr(expirationMsg, undefined);
      this.setFrameColor('gray');
      $('.action_security').click(this.setHandler(() => BrowserMsg.send.bg.settings({ page: '/chrome/settings/modules/security.htm', acctEmail: this.acctEmail })));
      $('.extend_expiration').click(this.setHandler(this.expirationModule.renderMsgExpirationRenewOptions));
    } else if (!linkRes.url) {
      await this.renderErr(Lang.pgpBlock.cannotLocate + Lang.pgpBlock.brokenLink, undefined);
    } else {
      await this.renderErr(Lang.pgpBlock.cannotLocate + Lang.general.writeMeToFixIt + ' Details:\n\n' + Xss.escape(JSON.stringify(linkRes)), undefined);
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

  private async initialize(forcePullMsgFromApi = false) {
    try {
      if (this.canReadEmails && this.signature === true && this.msgId) {
        this.renderText('Loading signed message...');
        const { raw } = await Google.gmail.msgGet(this.acctEmail, this.msgId, 'raw');
        this.msgFetchedFromApi = 'raw';
        const mimeMsg = Buf.fromBase64UrlStr(raw!); // used 'raw' above
        const parsed = await Mime.decode(mimeMsg);
        if (parsed && typeof parsed.rawSignedContent === 'string' && parsed.signature) {
          this.signature = parsed.signature;
          await this.decryptAndRender(Buf.fromUtfStr(parsed.rawSignedContent));
        } else {
          await this.renderErr('Error: could not properly parse signed message', parsed.rawSignedContent || parsed.text || parsed.html || mimeMsg.toUtfStr());
        }
      } else if (this.encryptedMsgUrlParam && !forcePullMsgFromApi) { // ascii armored message supplied
        this.renderText(this.signature ? 'Verifying..' : 'Decrypting...');
        await this.decryptAndRender(this.encryptedMsgUrlParam);
      } else if (!this.encryptedMsgUrlParam && this.hasChallengePassword && this.short) { // need to fetch the message from FlowCrypt API
        this.renderText('Loading message...');
        await this.expirationModule.recoverStoredAdminCodes();
        const msgLinkRes = await Backend.linkMessage(this.short);
        this.passwordMsgLinkRes = msgLinkRes;
        if (msgLinkRes.url) {
          const downloaded = await Api.download(msgLinkRes.url);
          await this.decryptAndRender(downloaded);
        } else {
          await this.renderPasswordEncryptedMsgLoadFail(this.passwordMsgLinkRes);
        }
      } else {  // need to fetch the inline signed + armored or encrypted +armored message block from gmail api
        if (!this.msgId) {
          Xss.sanitizeRender('#pgp_block', `Missing msgId to fetch message in pgp_block. If this happens repeatedly, please report the issue to human@flowcrypt.com`);
          this.resizePgpBlockFrame();
        } else if (this.canReadEmails) {
          this.renderText('Retrieving message...');
          const format: GmailResponseFormat = (!this.msgFetchedFromApi) ? 'full' : 'raw';
          const { armored, subject } = await Google.gmail.extractArmoredBlock(this.acctEmail, this.msgId, format, (progress) => {
            this.renderText(`Retrieving message... ${progress}%`);
          });
          this.renderText('Decrypting...');
          this.msgFetchedFromApi = format;
          await this.decryptAndRender(Buf.fromUtfStr(armored), undefined, subject);
        } else { // gmail message read auth not allowed
          // tslint:disable-next-line:max-line-length
          const readAccess = `Your browser needs to access gmail it in order to decrypt and display the message.<br/><br/><div class="button green auth_settings">Add missing permission</div>`;
          Xss.sanitizeRender('#pgp_block', `This encrypted message is very large (possibly containing an attachment). ${readAccess}`);
          this.resizePgpBlockFrame();
          $('.auth_settings').click(this.setHandler(() => BrowserMsg.send.bg.settings({ acctEmail: this.acctEmail, page: '/chrome/settings/modules/auth_denied.htm' })));
        }
      }
    } catch (e) {
      if (Api.err.isNetErr(e)) {
        await this.renderErr(`Could not load message due to network error. ${Ui.retryLink()}`, undefined);
      } else if (Api.err.isAuthPopupNeeded(e)) {
        BrowserMsg.send.notificationShowAuthPopupNeeded(this.parentTabId, { acctEmail: this.acctEmail });
        await this.renderErr(`Could not load message due to missing auth. ${Ui.retryLink()}`, undefined);
      } else if (e instanceof FormatError) {
        await this.renderErr(Lang.pgpBlock.cantOpen + Lang.pgpBlock.badFormat + Lang.pgpBlock.dontKnowHowOpen, e.data);
      } else if (Api.err.isInPrivateMode(e)) {
        await this.renderErr(`FlowCrypt does not work in a Firefox Private Window (or when Firefox Containers are used). Please try in a standard window.`, undefined);
      } else {
        Catch.reportErr(e);
        await this.renderErr(String(e), this.encryptedMsgUrlParam ? this.encryptedMsgUrlParam.toUtfStr() : undefined);
      }
    }
  }

}

View.run(PgpBlockView);
