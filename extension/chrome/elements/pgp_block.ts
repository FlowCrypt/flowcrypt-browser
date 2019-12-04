/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store } from '../../js/common/platform/store.js';
import { Str } from '../../js/common/core/common.js';
import { Ui } from '../../js/common/browser.js';
import { BrowserMsg } from '../../js/common/extension.js';
import { Lang } from '../../js/common/lang.js';
import { Api } from '../../js/common/api/api.js';
import { DecryptErrTypes } from '../../js/common/core/pgp.js';
import { Mime } from '../../js/common/core/mime.js';
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
import { PgpBlockViewErrorModule } from './pgp_block_error_module.js';
import { PgpBlockViewRenderModule } from './pgp_block_render_module.js';

export class PgpBlockView extends View { // tslint:disable-line:variable-name

  public readonly acctEmail: string;
  public readonly parentTabId: string;
  public readonly frameId: string;
  public readonly hasChallengePassword: boolean;
  public readonly isOutgoing: boolean;
  public readonly short: string | undefined;
  public readonly senderEmail: string | undefined;
  public readonly msgId: string | undefined;
  public readonly encryptedMsgUrlParam: Buf | undefined;

  public signature: string | boolean | undefined;

  public msgFetchedFromApi: false | GmailResponseFormat = false;
  public canReadEmails: undefined | boolean;
  public passwordMsgLinkRes: BackendRes.FcLinkMsg | undefined;
  public userEnteredMsgPassword: string | undefined;

  public readonly attachmentsModule: PgpBlockViewAttachmentsModule;
  public readonly signatureModule: PgpBlockViewSignatureModule;
  public readonly expirationModule: PgpBlockViewExpirationModule;
  public readonly quoteModule: PgpBlockViewQuoteModule;
  public readonly errorModule: PgpBlockViewErrorModule;
  public readonly renderModule: PgpBlockViewRenderModule;

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
    this.errorModule = new PgpBlockViewErrorModule(this);
    this.renderModule = new PgpBlockViewRenderModule(this);
  }

  async render() {
    const storage = await Store.getAcct(this.acctEmail, ['setup_done', 'google_token_scopes']);
    const scopes = await Store.getScopes(this.acctEmail);
    this.canReadEmails = scopes.read || scopes.modify;
    if (storage.setup_done) {
      await this.initialize();
    } else {
      await this.errorModule.renderErr(Lang.pgpBlock.refreshWindow, this.encryptedMsgUrlParam ? this.encryptedMsgUrlParam.toUtfStr() : undefined);
    }
  }

  setHandlers() {
    // defined as needed, depending on what rendered
  }

  private async initialize(forcePullMsgFromApi = false) {
    try {
      if (this.canReadEmails && this.signature === true && this.msgId) {
        this.renderModule.renderText('Loading signed message...');
        const { raw } = await Google.gmail.msgGet(this.acctEmail, this.msgId, 'raw');
        this.msgFetchedFromApi = 'raw';
        const mimeMsg = Buf.fromBase64UrlStr(raw!); // used 'raw' above
        const parsed = await Mime.decode(mimeMsg);
        if (parsed && typeof parsed.rawSignedContent === 'string' && parsed.signature) {
          this.signature = parsed.signature;
          await this.decryptAndRender(Buf.fromUtfStr(parsed.rawSignedContent));
        } else {
          await this.errorModule.renderErr('Error: could not properly parse signed message', parsed.rawSignedContent || parsed.text || parsed.html || mimeMsg.toUtfStr());
        }
      } else if (this.encryptedMsgUrlParam && !forcePullMsgFromApi) { // ascii armored message supplied
        this.renderModule.renderText(this.signature ? 'Verifying..' : 'Decrypting...');
        await this.decryptAndRender(this.encryptedMsgUrlParam);
      } else if (!this.encryptedMsgUrlParam && this.hasChallengePassword && this.short) { // need to fetch the message from FlowCrypt API
        this.renderModule.renderText('Loading message...');
        await this.expirationModule.recoverStoredAdminCodes();
        const msgLinkRes = await Backend.linkMessage(this.short);
        this.passwordMsgLinkRes = msgLinkRes;
        if (msgLinkRes.url) {
          const downloaded = await Api.download(msgLinkRes.url);
          await this.decryptAndRender(downloaded);
        } else {
          await this.renderModule.renderPasswordEncryptedMsgLoadFail(this.passwordMsgLinkRes);
        }
      } else {  // need to fetch the inline signed + armored or encrypted +armored message block from gmail api
        if (!this.msgId) {
          Xss.sanitizeRender('#pgp_block', `Missing msgId to fetch message in pgp_block. If this happens repeatedly, please report the issue to human@flowcrypt.com`);
          this.renderModule.resizePgpBlockFrame();
        } else if (this.canReadEmails) {
          this.renderModule.renderText('Retrieving message...');
          const format: GmailResponseFormat = (!this.msgFetchedFromApi) ? 'full' : 'raw';
          const { armored, subject } = await Google.gmail.extractArmoredBlock(this.acctEmail, this.msgId, format, (progress) => {
            this.renderModule.renderText(`Retrieving message... ${progress}%`);
          });
          this.renderModule.renderText('Decrypting...');
          this.msgFetchedFromApi = format;
          await this.decryptAndRender(Buf.fromUtfStr(armored), undefined, subject);
        } else { // gmail message read auth not allowed
          // tslint:disable-next-line:max-line-length
          const readAccess = `Your browser needs to access gmail it in order to decrypt and display the message.<br/><br/><div class="button green auth_settings">Add missing permission</div>`;
          Xss.sanitizeRender('#pgp_block', `This encrypted message is very large (possibly containing an attachment). ${readAccess}`);
          this.renderModule.resizePgpBlockFrame();
          $('.auth_settings').click(this.setHandler(() => BrowserMsg.send.bg.settings({ acctEmail: this.acctEmail, page: '/chrome/settings/modules/auth_denied.htm' })));
        }
      }
    } catch (e) {
      await this.errorModule.handleInitializeErr(e);
    }
  }

  private async decryptAndRender(encryptedData: Buf, optionalPwd?: string, plainSubject?: string) {
    if (typeof this.signature !== 'string') {
      const kisWithPp = await Store.keysGetAllWithPp(this.acctEmail);
      const result = await BrowserMsg.send.bg.await.pgpMsgDecrypt({ kisWithPp, encryptedData, msgPwd: await this.getDecryptPwd(optionalPwd) });
      if (typeof result === 'undefined') {
        await this.errorModule.renderErr(Lang.general.restartBrowserAndTryAgain, undefined);
      } else if (result.success) {
        if (this.hasChallengePassword && optionalPwd) {
          this.userEnteredMsgPassword = optionalPwd;
        }
        if (result.success && result.signature && result.signature.contact && !result.signature.match && this.canReadEmails && this.msgFetchedFromApi !== 'raw') {
          console.info(`re-fetching message ${this.msgId} from api because failed signature check: ${!this.msgFetchedFromApi ? 'full' : 'raw'}`);
          await this.initialize(true);
        } else {
          await this.renderModule.decideDecryptedContentFormattingAndRender(result.content, Boolean(result.isEncrypted), result.signature, plainSubject); // text!: did not request uint8
        }
      } else if (result.error.type === DecryptErrTypes.format) {
        if (this.canReadEmails && this.msgFetchedFromApi !== 'raw') {
          console.info(`re-fetching message ${this.msgId} from api because looks like bad formatting: ${!this.msgFetchedFromApi ? 'full' : 'raw'}`);
          await this.initialize(true);
        } else {
          await this.errorModule.renderErr(Lang.pgpBlock.badFormat + '\n\n' + result.error.message, encryptedData.toUtfStr());
        }
      } else if (result.longids.needPassphrase.length) {
        await this.errorModule.renderErr(`<a href="#" class="enter_passphrase" data-test="action-show-passphrase-dialog">${Lang.pgpBlock.enterPassphrase}</a> ${Lang.pgpBlock.toOpenMsg}`,
          undefined);
        $('.enter_passphrase').click(this.setHandler(() => {
          Ui.setTestState('waiting');
          BrowserMsg.send.passphraseDialog(this.parentTabId, { type: 'message', longids: result.longids.needPassphrase });
        }));
        await Store.waitUntilPassphraseChanged(this.acctEmail, result.longids.needPassphrase);
        this.renderModule.renderText('Decrypting...');
        await this.decryptAndRender(encryptedData, optionalPwd);
      } else {
        const [primaryKi] = await Store.keysGet(this.acctEmail, ['primary']);
        if (!result.longids.chosen && !primaryKi) {
          await this.errorModule.renderErr(Lang.pgpBlock.notProperlySetUp + this.errorModule.btnHtml('FlowCrypt settings', 'green settings'), undefined);
        } else if (result.error.type === DecryptErrTypes.keyMismatch) {
          if (this.hasChallengePassword && !optionalPwd) {
            const pwd = await this.renderModule.renderPasswordPromptAndAwaitEntry('first');
            await this.decryptAndRender(encryptedData, pwd);
          } else {
            await this.errorModule.handlePrivateKeyMismatch(encryptedData);
          }
        } else if (result.error.type === DecryptErrTypes.wrongPwd) {
          const pwd = await this.renderModule.renderPasswordPromptAndAwaitEntry('retry');
          await this.decryptAndRender(encryptedData, pwd);
        } else if (result.error.type === DecryptErrTypes.usePassword) {
          const pwd = await this.renderModule.renderPasswordPromptAndAwaitEntry('first');
          await this.decryptAndRender(encryptedData, pwd);
        } else if (result.error.type === DecryptErrTypes.noMdc) {
          await this.errorModule.renderErr(result.error.message, result.content!.toUtfStr()); // missing mdc - only render the result after user confirmation
        } else if (result.error) {
          await this.errorModule.renderErr(`${Lang.pgpBlock.cantOpen}\n\n<em>${result.error.type}: ${result.error.message}</em>`, encryptedData.toUtfStr());
        } else { // should generally not happen
          delete result.message;
          await this.errorModule.renderErr(Lang.pgpBlock.cantOpen + Lang.pgpBlock.writeMe + '\n\nDiagnostic info: "' + JSON.stringify(result) + '"', encryptedData.toUtfStr());
        }
      }
    } else {
      const signatureResult = await BrowserMsg.send.bg.await.pgpMsgVerifyDetached({ plaintext: encryptedData, sigText: Buf.fromUtfStr(this.signature) });
      await this.renderModule.decideDecryptedContentFormattingAndRender(encryptedData, false, signatureResult);
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

}

View.run(PgpBlockView);
