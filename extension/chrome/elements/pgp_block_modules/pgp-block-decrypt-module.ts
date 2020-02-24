/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Api } from '../../../js/common/api/api.js';
import { Backend } from '../../../js/common/api/backend.js';
import { BrowserMsg } from '../../../js/common/browser/browser-msg.js';
import { Buf } from '../../../js/common/core/buf.js';
import { DecryptErrTypes } from '../../../js/common/core/pgp-msg.js';
import { GmailResponseFormat } from '../../../js/common/api/email-provider/gmail/gmail.js';
import { Lang } from '../../../js/common/lang.js';
import { Mime } from '../../../js/common/core/mime.js';
import { PgpBlockView } from '../pgp_block.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { Xss } from '../../../js/common/platform/xss.js';
import { KeyStore } from '../../../js/common/platform/store/key-store.js';
import { PassphraseStore } from '../../../js/common/platform/store/passphrase-store.js';

export class PgpBlockViewDecryptModule {

  public canReadEmails: undefined | boolean;

  private msgFetchedFromApi: false | GmailResponseFormat = false;
  private isPwdMsgBasedOnMsgSnippet: boolean | undefined;

  constructor(private view: PgpBlockView) {
  }

  public initialize = async (forcePullMsgFromApi = false) => {
    try {
      if (this.canReadEmails && this.view.signature === true && this.view.msgId) {
        this.view.renderModule.renderText('Loading signed message...');
        const { raw } = await this.view.gmail.msgGet(this.view.msgId, 'raw');
        this.msgFetchedFromApi = 'raw';
        const mimeMsg = Buf.fromBase64UrlStr(raw!); // used 'raw' above
        const parsed = await Mime.decode(mimeMsg);
        if (parsed && typeof parsed.rawSignedContent === 'string' && parsed.signature) {
          this.view.signature = parsed.signature;
          await this.decryptAndRender(Buf.fromUtfStr(parsed.rawSignedContent));
        } else {
          await this.view.errorModule.renderErr('Error: could not properly parse signed message', parsed.rawSignedContent || parsed.text || parsed.html || mimeMsg.toUtfStr());
        }
      } else if (this.view.encryptedMsgUrlParam && !forcePullMsgFromApi) { // ascii armored message supplied
        this.view.renderModule.renderText(this.view.signature ? 'Verifying..' : 'Decrypting...');
        await this.decryptAndRender(this.view.encryptedMsgUrlParam);
      } else if (!this.view.encryptedMsgUrlParam && this.view.hasChallengePassword && this.view.short) { // need to fetch the message from FlowCrypt API
        // todo - remove this Apr 2020
        this.view.renderModule.renderText('Loading message...');
        await this.view.pwdEncryptedMsgModule.recoverStoredAdminCodes();
        const msgLinkRes = await Backend.linkMessage(this.view.short);
        this.view.pwdEncryptedMsgModule.passwordMsgLinkRes = msgLinkRes;
        if (msgLinkRes.url) {
          const downloaded = await Api.download(msgLinkRes.url);
          await this.decryptAndRender(downloaded);
        } else {
          await this.view.pwdEncryptedMsgModule.renderPasswordEncryptedMsgLoadFail(this.view.pwdEncryptedMsgModule.passwordMsgLinkRes);
        }
      } else {  // need to fetch the inline signed + armored or encrypted +armored message block from gmail api
        if (!this.view.msgId) {
          Xss.sanitizeRender('#pgp_block', `Missing msgId to fetch message in pgp_block. If this happens repeatedly, please report the issue to human@flowcrypt.com`);
          this.view.renderModule.resizePgpBlockFrame();
        } else if (this.canReadEmails) {
          this.view.renderModule.renderText('Retrieving message...');
          const format: GmailResponseFormat = (!this.msgFetchedFromApi) ? 'full' : 'raw';
          const { armored, subject, isPwdMsg } = await this.view.gmail.extractArmoredBlock(this.view.msgId, format, (progress) => {
            this.view.renderModule.renderText(`Retrieving message... ${progress}%`);
          });
          this.isPwdMsgBasedOnMsgSnippet = isPwdMsg;
          this.view.renderModule.renderText('Decrypting...');
          this.msgFetchedFromApi = format;
          await this.decryptAndRender(Buf.fromUtfStr(armored), undefined, subject);
        } else { // gmail message read auth not allowed
          const readAccess = `Your browser needs to access gmail it in order to decrypt and display the message.<br/><br/>
            <button class="button green auth_settings">Add missing permission</button>`;
          Xss.sanitizeRender('#pgp_block', `This encrypted message is very large (possibly containing an attachment). ${readAccess}`);
          this.view.renderModule.resizePgpBlockFrame();
          $('.auth_settings').click(this.view.setHandler(() => BrowserMsg.send.bg.settings({ acctEmail: this.view.acctEmail, page: '/chrome/settings/modules/auth_denied.htm' })));
        }
      }
    } catch (e) {
      await this.view.errorModule.handleInitializeErr(e);
    }
  }

  private decryptAndRender = async (encryptedData: Buf, optionalPwd?: string, plainSubject?: string) => {
    if (typeof this.view.signature !== 'string') {
      const kisWithPp = await KeyStore.getAllWithPp(this.view.acctEmail);
      const result = await BrowserMsg.send.bg.await.pgpMsgDecrypt({ kisWithPp, encryptedData, msgPwd: await this.view.pwdEncryptedMsgModule.getDecryptPwd(optionalPwd) });
      if (typeof result === 'undefined') {
        await this.view.errorModule.renderErr(Lang.general.restartBrowserAndTryAgain, undefined);
      } else if (result.success) {
        if (this.view.hasChallengePassword && optionalPwd) {
          this.view.pwdEncryptedMsgModule.userEnteredMsgPassword = optionalPwd;
        }
        if (result.signature?.contact && !result.signature.match && this.canReadEmails && this.msgFetchedFromApi !== 'raw') {
          console.info(`re-fetching message ${this.view.msgId} from api because failed signature check: ${!this.msgFetchedFromApi ? 'full' : 'raw'}`);
          await this.initialize(true);
        } else {
          await this.view.renderModule.decideDecryptedContentFormattingAndRender(result.content, Boolean(result.isEncrypted), result.signature, plainSubject); // text!: did not request uint8
        }
      } else if (result.error.type === DecryptErrTypes.format) {
        if (this.canReadEmails && this.msgFetchedFromApi !== 'raw') {
          console.info(`re-fetching message ${this.view.msgId} from api because looks like bad formatting: ${!this.msgFetchedFromApi ? 'full' : 'raw'}`);
          await this.initialize(true);
        } else {
          await this.view.errorModule.renderErr(Lang.pgpBlock.badFormat + '\n\n' + result.error.message, encryptedData.toUtfStr());
        }
      } else if (result.longids.needPassphrase.length) {
        const enterPp = `<a href="#" class="enter_passphrase" data-test="action-show-passphrase-dialog">${Lang.pgpBlock.enterPassphrase}</a> ${Lang.pgpBlock.toOpenMsg}`;
        await this.view.errorModule.renderErr(enterPp, undefined);
        $('.enter_passphrase').click(this.view.setHandler(() => {
          Ui.setTestState('waiting');
          BrowserMsg.send.passphraseDialog(this.view.parentTabId, { type: 'message', longids: result.longids.needPassphrase });
        }));
        await PassphraseStore.waitUntilPassphraseChanged(this.view.acctEmail, result.longids.needPassphrase);
        this.view.renderModule.renderText('Decrypting...');
        await this.decryptAndRender(encryptedData, optionalPwd);
      } else {
        const [primaryKi] = await KeyStore.get(this.view.acctEmail, ['primary']);
        if (!result.longids.chosen && !primaryKi) {
          await this.view.errorModule.renderErr(Lang.pgpBlock.notProperlySetUp + this.view.errorModule.btnHtml('FlowCrypt settings', 'green settings'), undefined);
        } else if (result.error.type === DecryptErrTypes.keyMismatch) {
          if (this.view.hasChallengePassword && !optionalPwd) {
            const pwd = await this.view.pwdEncryptedMsgModule.renderPasswordPromptAndAwaitEntry('first'); // todo - remove around Mar 2020
            await this.decryptAndRender(encryptedData, pwd);
          } else {
            await this.view.errorModule.handlePrivateKeyMismatch(encryptedData, this.isPwdMsgBasedOnMsgSnippet === true);
          }
        } else if (result.error.type === DecryptErrTypes.wrongPwd) {
          const pwd = await this.view.pwdEncryptedMsgModule.renderPasswordPromptAndAwaitEntry('retry'); // todo - remove around Mar 2020
          await this.decryptAndRender(encryptedData, pwd);
        } else if (result.error.type === DecryptErrTypes.usePassword) {
          const pwd = await this.view.pwdEncryptedMsgModule.renderPasswordPromptAndAwaitEntry('first'); // todo - remove around Mar 2020
          await this.decryptAndRender(encryptedData, pwd);
        } else if (result.error.type === DecryptErrTypes.noMdc) {
          await this.view.errorModule.renderErr(result.error.message, result.content!.toUtfStr()); // missing mdc - only render the result after user confirmation
        } else if (result.error) {
          await this.view.errorModule.renderErr(`${Lang.pgpBlock.cantOpen}\n\n<em>${result.error.type}: ${result.error.message}</em>`, encryptedData.toUtfStr());
        } else { // should generally not happen
          delete result.message;
          await this.view.errorModule.renderErr(Lang.pgpBlock.cantOpen + Lang.pgpBlock.writeMe + '\n\nDiagnostic info: "' + JSON.stringify(result) + '"', encryptedData.toUtfStr());
        }
      }
    } else {
      const signatureResult = await BrowserMsg.send.bg.await.pgpMsgVerifyDetached({ plaintext: encryptedData, sigText: Buf.fromUtfStr(this.view.signature) });
      await this.view.renderModule.decideDecryptedContentFormattingAndRender(encryptedData, false, signatureResult);
    }
  }

}
