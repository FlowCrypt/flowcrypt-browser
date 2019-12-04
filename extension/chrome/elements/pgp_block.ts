/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch } from '../../js/common/platform/catch.js';
import { Store } from '../../js/common/platform/store.js';
import { Str } from '../../js/common/core/common.js';
import { Att } from '../../js/common/core/att.js';
import { Ui, Browser } from '../../js/common/browser.js';
import { BrowserMsg } from '../../js/common/extension.js';
import { Lang } from '../../js/common/lang.js';
import { Api, AuthError } from '../../js/common/api/api.js';
import { VerifyRes, DecryptErrTypes, FormatError, PgpMsg, Pgp } from '../../js/common/core/pgp.js';
import { Mime, MsgBlock } from '../../js/common/core/mime.js';
import { Google, GmailResponseFormat } from '../../js/common/api/google.js';
import { Buf } from '../../js/common/core/buf.js';
import { BackendRes, Backend } from '../../js/common/api/backend.js';
import { Assert } from '../../js/common/assert.js';
import { Xss } from '../../js/common/platform/xss.js';
import { Keyserver } from '../../js/common/api/keyserver.js';
import { Settings } from '../../js/common/settings.js';
import { Url } from '../../js/common/core/common.js';
import { View } from '../../js/common/view.js';

View.run(class PgpBlockView extends View {

  private readonly acctEmail: string;
  private readonly parentTabId: string;
  private readonly frameId: string;
  private readonly hasChallengePassword: boolean;
  private readonly isOutgoing: boolean;
  private readonly short: string | undefined;
  private readonly senderEmail: string | undefined;
  private readonly msgId: string | undefined;
  private readonly encryptedMsgUrlParam: Buf | undefined;

  private signature: string | boolean | undefined;

  private heightHist: number[] = [];
  private msgFetchedFromApi: false | GmailResponseFormat = false;
  private includedAtts: Att[] = [];
  private canReadEmails: undefined | boolean;
  private passwordMsgLinkRes: BackendRes.FcLinkMsg | undefined;
  private adminCodes: string[] | undefined;
  private userEnteredMsgPassword: string | undefined;
  private doNotSetStateAsReadyYet = false;

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

  private resizePgpBlockFrame() {
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

  private async renderContent(htmlContent: string, isErr: boolean) {
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

  private setFrameColor(color: 'red' | 'green' | 'gray') {
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

  private async getDecryptPwd(suppliedPwd?: string | undefined): Promise<string | undefined> {
    const pwd = suppliedPwd || this.userEnteredMsgPassword;
    if (pwd && this.hasChallengePassword) {
      const { hashed } = await BrowserMsg.send.bg.await.pgpHashChallengeAnswer({ answer: pwd });
      return hashed;
    }
    return pwd;
  }

  private async decryptAndSaveAttToDownloads(encrypted: Att, renderIn: JQuery<HTMLElement>) {
    const kisWithPp = await Store.keysGetAllWithPp(this.acctEmail);
    const decrypted = await BrowserMsg.send.bg.await.pgpMsgDecrypt({ kisWithPp, encryptedData: encrypted.getData(), msgPwd: await this.getDecryptPwd() });
    if (decrypted.success) {
      const att = new Att({ name: encrypted.name.replace(/\.(pgp|gpg)$/, ''), type: encrypted.type, data: decrypted.content });
      Browser.saveToDownloads(att, renderIn);
      this.resizePgpBlockFrame();
    } else {
      delete decrypted.message;
      console.info(decrypted);
      await Ui.modal.error(`There was a problem decrypting this file (${decrypted.error.type}: ${decrypted.error.message}). Downloading encrypted original.`);
      Browser.saveToDownloads(encrypted, renderIn);
      this.resizePgpBlockFrame();
    }
  }

  private renderProgress(element: JQuery<HTMLElement>, percent: number | undefined, received: number | undefined, size: number) {
    if (percent) {
      element.text(percent + '%');
    } else if (size && received) {
      element.text(Math.floor(((received * 0.75) / size) * 100) + '%');
    }
  }

  private renderInnerAtts(atts: Att[]) {
    Xss.sanitizeAppend('#pgp_block', '<div id="attachments"></div>');
    this.includedAtts = atts;
    for (const i of atts.keys()) {
      const name = (atts[i].name ? Xss.escape(atts[i].name) : 'noname').replace(/\.(pgp|gpg)$/, '');
      const size = Str.numberFormat(Math.ceil(atts[i].length / 1024)) + 'KB';
      const htmlContent = `<b>${Xss.escape(name)}</b>&nbsp;&nbsp;&nbsp;${size}<span class="progress"><span class="percent"></span></span>`;
      Xss.sanitizeAppend('#attachments', `<div class="attachment" index="${Number(i)}">${htmlContent}</div>`);
    }
    this.resizePgpBlockFrame();
    $('div.attachment').click(this.setHandlerPrevent('double', async target => {
      const att = this.includedAtts[Number($(target).attr('index'))];
      if (att.hasData()) {
        Browser.saveToDownloads(att, $(target));
        this.resizePgpBlockFrame();
      } else {
        Xss.sanitizePrepend($(target).find('.progress'), Ui.spinner('green'));
        att.setData(await Api.download(att.url!, (perc, load, total) => this.renderProgress($(target).find('.progress .percent'), perc, load, total || att.length)));
        await Ui.delay(100); // give browser time to render
        $(target).find('.progress').text('');
        await this.decryptAndSaveAttToDownloads(att, $(target));
      }
    }));
  }

  private async renderPgpSignatureCheckMissingPubkeyOptions(signerLongid: string, senderEmail: string | undefined): Promise<void> { // don't have appropriate pubkey by longid in contacts
    const render = (note: string, action: () => void) => $('#pgp_signature').addClass('neutral').find('.result').text(note).click(this.setHandler(action));
    try {
      if (senderEmail) { // we know who sent it
        const [senderContactByEmail] = await Store.dbContactGet(undefined, [senderEmail]);
        if (senderContactByEmail && senderContactByEmail.pubkey) {
          render(`Fetched the right pubkey ${signerLongid} from keyserver, but will not use it because you have conflicting pubkey ${senderContactByEmail.longid} loaded.`, () => undefined);
          return;
        } // ---> and user doesn't have pubkey for that email addr
        const { pubkey, pgpClient } = await Keyserver.lookupEmail(this.acctEmail, senderEmail);
        if (!pubkey) {
          render(`Missing pubkey ${signerLongid}`, () => undefined);
          return;
        } // ---> and pubkey found on keyserver by sender email
        const { keys: [keyDetails] } = await BrowserMsg.send.bg.await.pgpKeyDetails({ pubkey });
        if (!keyDetails || !keyDetails.ids.map(ids => ids.longid).includes(signerLongid)) {
          render(`Fetched sender's pubkey ${keyDetails.ids[0].longid} but message was signed with a different key: ${signerLongid}, will not verify.`, () => undefined);
          return;
        } // ---> and longid it matches signature
        await Store.dbContactSave(undefined, await Store.dbContactObj({
          email: senderEmail, pubkey, client: pgpClient, expiresOn: await Pgp.key.dateBeforeExpiration(pubkey)
        })); // <= TOFU auto-import
        render('Fetched pubkey, click to verify', () => window.location.reload());
      } else { // don't know who sent it
        const { pubkey, pgpClient } = await Keyserver.lookupLongid(this.acctEmail, signerLongid);
        if (!pubkey) { // but can find matching pubkey by longid on keyserver
          render(`Could not find sender's pubkey anywhere: ${signerLongid}`, () => undefined);
          return;
        }
        const { keys: [keyDetails] } = await BrowserMsg.send.bg.await.pgpKeyDetails({ pubkey });
        const pubkeyEmail = Str.parseEmail(keyDetails.users[0] || '').email!;
        if (!pubkeyEmail) {
          render(`Fetched matching pubkey ${signerLongid} but no valid email address is listed in it.`, () => undefined);
          return;
        }
        const [conflictingContact] = await Store.dbContactGet(undefined, [pubkeyEmail]);
        if (conflictingContact && conflictingContact.pubkey) {
          render(`Fetched matching pubkey ${signerLongid} but conflicting key is in local contacts ${conflictingContact.longid} for email ${pubkeyEmail}, cannot verify.`, () => undefined);
          return;
        }
        render(`Fetched matching pubkey ${signerLongid}. Click to load and use it.`, async () => {
          await Store.dbContactSave(undefined, await Store.dbContactObj({
            email: pubkeyEmail, pubkey, client: pgpClient, expiresOn: await Pgp.key.dateBeforeExpiration(pubkey)
          })); // TOFU manual import
          window.location.reload();
        });
      }
    } catch (e) {
      if (Api.err.isSignificant(e)) {
        Catch.reportErr(e);
        render(`Could not load sender pubkey ${signerLongid} due to an error.`, () => undefined);
      } else {
        render(`Could not look up sender's pubkey due to network error, click to retry.`, () => window.location.reload());
      }
    }
  }

  private renderPgpSignatureCheckResult(signature: VerifyRes | undefined) {
    if (signature) {
      const signerEmail = signature.contact ? signature.contact.name || this.senderEmail : this.senderEmail;
      $('#pgp_signature > .cursive > span').text(signerEmail || 'Unknown Signer');
      if (signature.signer && !signature.contact) {
        this.doNotSetStateAsReadyYet = true; // so that body state is not marked as ready too soon - automated tests need to know when to check results
        this.renderPgpSignatureCheckMissingPubkeyOptions(signature.signer, this.senderEmail).then(() => { // async so that it doesn't block rendering
          this.doNotSetStateAsReadyYet = false;
          Ui.setTestState('ready');
          $('#pgp_block').css('min-height', '100px'); // signature fail can have a lot of text in it to render
          this.resizePgpBlockFrame();
        }).catch(Catch.reportErr);
      } else if (signature.match && signature.signer && signature.contact) {
        $('#pgp_signature').addClass('good');
        $('#pgp_signature > .result').text('matching signature');
      } else {
        $('#pgp_signature').addClass('bad');
        $('#pgp_signature > .result').text('signature does not match');
        this.setFrameColor('red');
      }
      $('#pgp_signature').css('block');
    }
  }

  private renderFutureExpiration(date: string) {
    let btns = '';
    if (this.adminCodes && this.adminCodes.length) {
      btns += ' <a href="#" class="extend_expiration">extend</a>';
    }
    if (this.isOutgoing) {
      btns += ' <a href="#" class="expire_settings">settings</a>';
    }
    Xss.sanitizeAppend('#pgp_block', Ui.e('div', { class: 'future_expiration', html: `This message will expire on ${Str.datetimeToDate(date)}. ${btns}` }));
    $('.expire_settings').click(this.setHandler(() => BrowserMsg.send.bg.settings({ acctEmail: this.acctEmail, page: '/chrome/settings/modules/security.htm' })));
    $('.extend_expiration').click(this.setHandler(target => this.renderMsgExpirationRenewOptions(target)));
  }

  private async recoverStoredAdminCodes() {
    const storage = await Store.getGlobal(['admin_codes']);
    if (this.short && storage.admin_codes && storage.admin_codes[this.short] && storage.admin_codes[this.short].codes) {
      this.adminCodes = storage.admin_codes[this.short].codes;
    }
  }

  private async renderMsgExpirationRenewOptions(target: HTMLElement) {
    const parent = $(target).parent();
    const subscription = await Store.subscription(this.acctEmail);
    if (subscription.level && subscription.active) {
      const btns = `<a href="#7" class="do_extend">+7 days</a> <a href="#30" class="do_extend">+1 month</a> <a href="#365" class="do_extend">+1 year</a>`;
      Xss.sanitizeRender(parent, `<div style="font-family: monospace;">Extend message expiration: ${btns}</div>`);
      const element = await Ui.event.clicked('.do_extend');
      await this.handleExtendMsgExpirationClicked(element);
    } else {
      if (subscription.level && !subscription.active && subscription.method === 'trial') {
        await Ui.modal.warning('Your trial has ended. Please renew your subscription to proceed.');
      } else {
        await Ui.modal.info('FlowCrypt Advanced users can choose expiration of password encrypted messages. Try it free.');
      }
      BrowserMsg.send.subscribeDialog(this.parentTabId, {});
    }
  }

  private async handleExtendMsgExpirationClicked(self: HTMLElement) {
    const nDays = Number($(self).attr('href')!.replace('#', ''));
    Xss.sanitizeRender($(self).parent(), `Updating..${Ui.spinner('green')}`);
    try {
      const fcAuth = await Store.authInfo(this.acctEmail);
      if (!fcAuth) {
        throw new AuthError();
      }
      const r = await Backend.messageExpiration(fcAuth, this.adminCodes || [], nDays);
      if (r.updated) { // todo - make backend return http error code when not updated, and skip this if/else
        window.location.reload();
      } else {
        throw r;
      }
    } catch (e) {
      if (Api.err.isAuthErr(e)) {
        Settings.offerToLoginWithPopupShowModalOnErr(this.acctEmail);
      } else {
        Catch.report('error when extending message expiration', e);
      }
      Xss.sanitizeRender($(self).parent(), 'Error updating expiration. <a href="#" class="retry_expiration_change">Click here to try again</a>').addClass('bad');
      const el = await Ui.event.clicked('.retry_expiration_change');
      await this.handleExtendMsgExpirationClicked(el);
    }
  }

  private async decideDecryptedContentFormattingAndRender(decryptedBytes: Buf, isEncrypted: boolean, sigResult: VerifyRes | undefined, plainSubject?: string) {
    this.setFrameColor(isEncrypted ? 'green' : 'gray');
    this.renderPgpSignatureCheckResult(sigResult);
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
    await this.separateQuotedContentAndRenderText(decryptedContent, isHtml);
    if (publicKeys.length) {
      BrowserMsg.send.renderPublicKeys(this.parentTabId, { afterFrameId: this.frameId, publicKeys });
    }
    if (renderableAtts.length) {
      this.renderInnerAtts(renderableAtts);
    }
    if (this.passwordMsgLinkRes && this.passwordMsgLinkRes.expire) {
      this.renderFutureExpiration(this.passwordMsgLinkRes.expire);
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
      } else if (this.isOutgoing && this.adminCodes) {
        expirationMsg += '<div class="button gray2 extend_expiration">renew message</div>';
      } else if (!this.isOutgoing) {
        expirationMsg += Lang.pgpBlock.askSenderRenew;
      }
      expirationMsg += '\n\n<div class="button gray2 action_security">security settings</div>';
      await this.renderErr(expirationMsg, undefined);
      this.setFrameColor('gray');
      $('.action_security').click(this.setHandler(() => BrowserMsg.send.bg.settings({ page: '/chrome/settings/modules/security.htm', acctEmail: this.acctEmail })));
      $('.extend_expiration').click(this.setHandler(this.renderMsgExpirationRenewOptions));
    } else if (!linkRes.url) {
      await this.renderErr(Lang.pgpBlock.cannotLocate + Lang.pgpBlock.brokenLink, undefined);
    } else {
      await this.renderErr(Lang.pgpBlock.cannotLocate + Lang.general.writeMeToFixIt + ' Details:\n\n' + Xss.escape(JSON.stringify(linkRes)), undefined);
    }
  }

  private async separateQuotedContentAndRenderText(decryptedContent: string, isHtml: boolean) {
    if (isHtml) {
      const message = $('<div>').html(Xss.htmlSanitize(decryptedContent)); // xss-sanitized
      let htmlBlockQuoteExists: boolean = false;
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
        await this.renderContent(message.html(), false);
        this.appendCollapsedQuotedContentButton(quotedHtml, true);
      } else {
        await this.renderContent(decryptedContent, false);
      }
    } else {
      const lines = decryptedContent.trim().split(/\r?\n/);
      const linesQuotedPart: string[] = [];
      while (lines.length) {
        const lastLine = lines.pop()!; // lines.length above ensures there is a line
        if (lastLine[0] === '>' || !lastLine.length) { // look for lines starting with '>' or empty lines, from last line up (sometimes quoted content may have empty lines in it)
          linesQuotedPart.unshift(lastLine);
        } else { // found first non-quoted part from the bottom
          if (lastLine.startsWith('On ') && lastLine.endsWith(' wrote:')) { // on the very top of quoted content, looks like qote header
            linesQuotedPart.unshift(lastLine);
          } else { // no quote header, just regular content from here onwards
            lines.push(lastLine);
          }
          break;
        }
      }
      if (linesQuotedPart.length && !lines.length) { // only got quoted part, no real text -> show everything as real text, without quoting
        lines.push(...linesQuotedPart.splice(0, linesQuotedPart.length));
      }
      await this.renderContent(Xss.escapeTextAsRenderableHtml(lines.join('\n')), false);
      if (linesQuotedPart.length) {
        this.appendCollapsedQuotedContentButton(linesQuotedPart.join('\n'));
      }
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

  private appendCollapsedQuotedContentButton(message: string, isHtml: boolean = false) {
    const pgpBlk = $("#pgp_block");
    pgpBlk.append('<div id="action_show_quoted_content" data-test="action-show-quoted-content" class="three_dots"><img src="/img/svgs/three-dots.svg" /></div>'); // xss-direct
    pgpBlk.append(`<div class="quoted_content">${Xss.htmlSanitizeKeepBasicTags(isHtml ? message : Xss.escapeTextAsRenderableHtml(message))}</div>`); // xss-sanitized
    pgpBlk.find('#action_show_quoted_content').click(this.setHandler(async target => {
      $(".quoted_content").css('display', $(".quoted_content").css('display') === 'none' ? 'block' : 'none');
      this.resizePgpBlockFrame();
    }));
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
        await this.recoverStoredAdminCodes();
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

});
