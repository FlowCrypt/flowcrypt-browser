/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { BrowserMsg } from '../../../js/common/browser/browser-msg.js';
import { Buf } from '../../../js/common/core/buf.js';
import { DecryptErrTypes } from '../../../js/common/core/crypto/pgp/msg-util.js';
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
      } else {  // need to fetch the inline signed + armored or encrypted +armored message block from gmail api
        if (!this.view.msgId) {
          Xss.sanitizeRender('#pgp_block', `Missing msgId to fetch message in pgp_block. If this happens repeatedly, please report the issue to human@flowcrypt.com`);
          this.view.renderModule.resizePgpBlockFrame();
        } else {
          this.view.renderModule.renderText('Retrieving message...');
          const format: GmailResponseFormat = (!this.msgFetchedFromApi) ? 'full' : 'raw';
          const { armored, subject, isPwdMsg } = await this.view.gmail.extractArmoredBlock(this.view.msgId, format, (progress) => {
            this.view.renderModule.renderText(`Retrieving message... ${progress}%`);
          });
          this.isPwdMsgBasedOnMsgSnippet = isPwdMsg;
          this.view.renderModule.renderText('Decrypting...');
          this.msgFetchedFromApi = format;
          await this.decryptAndRender(Buf.fromUtfStr(armored), undefined, subject);
        }
      }
    } catch (e) {
      await this.view.errorModule.handleInitializeErr(e);
    }
  }

  private decryptAndRender = async (encryptedData: Buf, optionalPwd?: string, plainSubject?: string) => {
    if (typeof this.view.signature !== 'string') {
      const kisWithPp = await KeyStore.getAllWithOptionalPassPhrase(this.view.acctEmail);
      const result = await BrowserMsg.send.bg.await.pgpMsgDecrypt({ kisWithPp, encryptedData });
      if (typeof result === 'undefined') {
        await this.view.errorModule.renderErr(Lang.general.restartBrowserAndTryAgain, undefined);
      } else if (result.success) {
        if (result.signature?.contact && !result.signature.match && this.canReadEmails && this.msgFetchedFromApi !== 'raw' && !result.signature.isErrFatal) {
          console.info(`re-fetching message ${this.view.msgId} from api because failed signature check: ${!this.msgFetchedFromApi ? 'full' : 'raw'}`);
          await this.initialize(true);
        } else {
          await this.view.renderModule.decideDecryptedContentFormattingAndRender(result.content, Boolean(result.isEncrypted), result.signature, plainSubject);
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
        const primaryKi = await KeyStore.getFirstOptional(this.view.acctEmail);
        if (!result.longids.chosen && !primaryKi) {
          await this.view.errorModule.renderErr(Lang.pgpBlock.notProperlySetUp + this.view.errorModule.btnHtml('FlowCrypt settings', 'green settings'), undefined);
        } else if (result.error.type === DecryptErrTypes.keyMismatch) {
          await this.view.errorModule.handlePrivateKeyMismatch(kisWithPp.map(ki => ki.public), encryptedData, this.isPwdMsgBasedOnMsgSnippet === true);
        } else if (result.error.type === DecryptErrTypes.wrongPwd || result.error.type === DecryptErrTypes.usePassword) {
          await this.view.errorModule.renderErr(Lang.pgpBlock.pwdMsgAskSenderUsePubkey, undefined);
        } else if (result.error.type === DecryptErrTypes.noMdc) {
          await this.view.errorModule.renderErr(result.error.message, result.content!.toUtfStr()); // missing mdc - only render the result after user confirmation
        } else if (result.error) {
          await this.view.errorModule.renderErr(`${Lang.pgpBlock.cantOpen}\n\n<em>${result.error.type}: ${result.error.message}</em>`, encryptedData.toUtfStr());
        } else { // should generally not happen
          await this.view.errorModule.renderErr(Lang.pgpBlock.cantOpen + Lang.pgpBlock.writeMe + '\n\nDiagnostic info: "' + JSON.stringify(result) + '"', encryptedData.toUtfStr());
        }
      }
    } else { // this.view.signature is string
      // sometimes signatures come wrongly percent-encoded. Here we check for typical "=3Dabcd" at the end
      const sigText = Buf.fromUtfStr(this.view.signature.replace('\n=3D', '\n='));
      const signatureResult = await BrowserMsg.send.bg.await.pgpMsgVerifyDetached({ plaintext: encryptedData, sigText });
      await this.view.renderModule.decideDecryptedContentFormattingAndRender(encryptedData, false, signatureResult);
    }
  }

}
