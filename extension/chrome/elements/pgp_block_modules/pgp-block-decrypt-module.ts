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
import { MsgBlockParser } from '../../../js/common/core/msg-block-parser.js';
import { Str } from '../../../js/common/core/common.js';

export class PgpBlockViewDecryptModule {
  private msgFetchedFromApi: false | GmailResponseFormat = false;
  private isPwdMsgBasedOnMsgSnippet: boolean | undefined;

  public constructor(private view: PgpBlockView) {}

  public initialize = async (verificationPubs: string[], forcePullMsgFromApi: boolean) => {
    try {
      if (this.view.signature && !this.view.signature.parsedSignature && this.view.msgId) {
        this.view.renderModule.renderText('Loading signed message...');
        const { raw } = await this.view.gmail.msgGet(this.view.msgId, 'raw');
        this.msgFetchedFromApi = 'raw';
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const mimeMsg = Buf.fromBase64UrlStr(raw!); // used 'raw' above
        const parsed = await Mime.decode(mimeMsg);
        if (parsed && typeof parsed.rawSignedContent === 'string') {
          const signatureAttachment = parsed.attachments.find(a => a.treatAs(parsed.attachments) === 'signature'); // todo: more than one signature candidate?
          if (signatureAttachment) {
            this.view.signature.parsedSignature = signatureAttachment.getData().toUtfStr();
            return await this.decryptAndRender(parsed.rawSignedContent, verificationPubs);
          }
        }
        await this.view.errorModule.renderErr(
          'Error: could not properly parse signed message',
          parsed.rawSignedContent || parsed.text || parsed.html || mimeMsg.toUtfStr(),
          'parse error'
        );
      } else if (this.view.encryptedMsgUrlParam && !forcePullMsgFromApi) {
        // ascii armored message supplied
        this.view.renderModule.renderText(this.view.signature ? 'Verifying...' : 'Decrypting...');
        await this.decryptAndRender(this.view.encryptedMsgUrlParam, verificationPubs);
      } else {
        // need to fetch the inline signed + armored or encrypted +armored message block from gmail api
        if (!this.view.msgId) {
          Xss.sanitizeRender('#pgp_block', 'Missing msgId to fetch message in pgp_block. ' + Lang.general.contactIfHappensAgain(!!this.view.fesUrl));
          this.view.renderModule.resizePgpBlockFrame();
        } else {
          const { armored, plaintext, subject } = await this.retrieveMessage(this.view.msgId);
          this.view.renderModule.renderText('Decrypting...');
          if (plaintext) {
            await this.view.renderModule.renderAsRegularContent(plaintext);
          } else {
            await this.decryptAndRender(armored, verificationPubs, subject);
          }
        }
      }
    } catch (e) {
      await this.view.errorModule.handleInitializeErr(e);
    }
  };

  public canAndShouldFetchFromApi = () => this.msgFetchedFromApi !== 'raw';

  private retrieveMessage = async (msgId: string) => {
    // todo: msgId === this.view.msgId
    this.view.renderModule.renderText('Retrieving message...');
    const format: GmailResponseFormat = !this.msgFetchedFromApi ? 'full' : 'raw';
    const extractionResult = await this.view.gmail.extractArmoredBlock(msgId, format, progress => {
      this.view.renderModule.renderText(`Retrieving message... ${progress}%`);
    });
    this.isPwdMsgBasedOnMsgSnippet = extractionResult.isPwdMsg;
    this.msgFetchedFromApi = format;
    return extractionResult;
  };

  // #4342 - we have some corrupted cleartext signed message, find the correct message by the base64 signature characters
  private getNeededCleartextMessage = (armoredInput: string, referenceData: string): string | undefined => {
    const { blocks } = MsgBlockParser.detectBlocks(armoredInput);
    const candidateBlocks = blocks.filter(b => b.type === 'signedMsg');
    if (candidateBlocks.length === 0) {
      return undefined;
    }
    const initialSignatureMatch = referenceData.match(/\r?\n-----BEGIN PGP SIGNATURE-----(?=[\r\n]).*?\r?\n\r?\n(.*)\r?\n-----END PGP SIGNATURE-----$/s);
    const initialSignature = initialSignatureMatch ? initialSignatureMatch[1].replace(/\s/g, '') : ' ';
    for (const candidateBlock of candidateBlocks.map(b => (typeof b.content === 'string' ? b.content : b.content.toUtfStr()))) {
      const match = candidateBlock.match(
        /^-----BEGIN PGP SIGNED MESSAGE-----\r?\n.*?\r?\n-----BEGIN PGP SIGNATURE-----(?=[\r\n]).*?\r?\n\r?\n(.*?)\r?\n-----END PGP SIGNATURE-----\r?\n?$/s
      );
      if (match && match[1].replace(/\s/g, '') === initialSignature) {
        return match[0];
      }
    }
    return undefined;
  };

  private decryptAndRender = async (encryptedData: Uint8Array | string, verificationPubs: string[], plainSubject?: string): Promise<void> => {
    if (!this.view.signature?.parsedSignature) {
      const kisWithPp = await KeyStore.getAllWithOptionalPassPhrase(this.view.acctEmail);
      const decrypt = async (verificationPubs: string[]) => await BrowserMsg.send.bg.await.pgpMsgDecrypt({ kisWithPp, encryptedData, verificationPubs });
      const result = await decrypt(verificationPubs);

      if (typeof result === 'undefined') {
        await this.view.errorModule.renderErr(Lang.general.restartBrowserAndTryAgain(!!this.view.fesUrl), undefined);
      } else if (result.success) {
        if (result.isCleartext && result.signature?.error === 'Signed digest did not match' && this.view.msgId && !this.msgFetchedFromApi) {
          // only try to re-fetch 'full'
          console.info(`re-fetching message ${this.view.msgId} from api because looks like bad formatting: full`);
          const { armored } = await this.retrieveMessage(this.view.msgId); // todo: subject?
          const fetchedContent = this.getNeededCleartextMessage(armored, Str.with(encryptedData));
          if (typeof fetchedContent !== 'undefined') {
            return await this.decryptAndRender(fetchedContent, verificationPubs);
          }
        }

        if (!result.signature?.match) {
          // try to find signature attachment in decrypted data
          const decoded = await Mime.decode(result.content);
          const signature = decoded.attachments.find(a => a.treatAs(decoded.attachments) === 'signature');

          if (signature && decoded.rawSignedContent) {
            const sigText = signature.getData().toUtfStr();
            const plaintext = decoded.rawSignedContent;
            const verify = async (verificationPubs: string[]) => await BrowserMsg.send.bg.await.pgpMsgVerifyDetached({ plaintext, sigText, verificationPubs });
            result.signature = await verify(verificationPubs);
            result.content = Buf.with(plaintext);
          }
        }

        await this.view.renderModule.decideDecryptedContentFormattingAndRender(
          result.content,
          result.isEncrypted,
          result.signature,
          verificationPubs,
          async (verificationPubs: string[]) => {
            const decryptResult = await decrypt(verificationPubs);
            if (!decryptResult.success) {
              return undefined; // note: this internal error results in a wrong "Not Signed" badge
            } else {
              return decryptResult.signature;
            }
          },
          plainSubject
        );
      } else if (result.error.type === DecryptErrTypes.format) {
        if (this.canAndShouldFetchFromApi()) {
          console.info(`re-fetching message ${this.view.msgId} from api because looks like bad formatting: ${!this.msgFetchedFromApi ? 'full' : 'raw'}`);
          await this.initialize(verificationPubs, true);
        } else {
          await this.view.errorModule.renderErr(Lang.pgpBlock.badFormat + '\n\n' + result.error.message, Str.with(encryptedData));
        }
      } else if (result.longids.needPassphrase.length) {
        const enterPp = `<a href="#" class="enter_passphrase" data-test="action-show-passphrase-dialog">${Lang.pgpBlock.enterPassphrase}</a> ${Lang.pgpBlock.toOpenMsg}`;
        await this.view.errorModule.renderErr(enterPp, undefined, 'pass phrase needed');
        $('.enter_passphrase').on(
          'click',
          this.view.setHandler(() => {
            Ui.setTestState('waiting');
            BrowserMsg.send.passphraseDialog(this.view.parentTabId, {
              type: 'message',
              longids: result.longids.needPassphrase,
            });
          })
        );
        await PassphraseStore.waitUntilPassphraseChanged(this.view.acctEmail, result.longids.needPassphrase);
        this.view.renderModule.clearErrorStatus();
        this.view.renderModule.renderText('Decrypting...');
        await this.decryptAndRender(encryptedData, verificationPubs);
      } else {
        if (!result.longids.chosen && !(await KeyStore.get(this.view.acctEmail)).length) {
          await this.view.errorModule.renderErr(
            Lang.pgpBlock.notProperlySetUp + this.view.errorModule.btnHtml('FlowCrypt settings', 'green settings'),
            undefined
          );
        } else if (result.error.type === DecryptErrTypes.keyMismatch) {
          await this.view.errorModule.handlePrivateKeyMismatch(
            kisWithPp.map(ki => ki.public),
            encryptedData,
            this.isPwdMsgBasedOnMsgSnippet === true
          );
        } else if (result.error.type === DecryptErrTypes.wrongPwd || result.error.type === DecryptErrTypes.usePassword) {
          await this.view.errorModule.renderErr(Lang.pgpBlock.pwdMsgAskSenderUsePubkey, undefined);
        } else if (result.error.type === DecryptErrTypes.noMdc) {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          await this.view.errorModule.renderErr(result.error.message, result.content!.toUtfStr()); // missing mdc - only render the result after user confirmation
        } else if (result.error) {
          await this.view.errorModule.renderErr(`${Lang.pgpBlock.cantOpen}\n\n<em>${result.error.type}: ${result.error.message}</em>`, Str.with(encryptedData));
        } else {
          // should generally not happen
          await this.view.errorModule.renderErr(
            Lang.pgpBlock.cantOpen + Lang.general.writeMeToFixIt(!!this.view.fesUrl) + '\n\nDiagnostic info: "' + JSON.stringify(result) + '"',
            Str.with(encryptedData)
          );
        }
      }
    } else {
      // this.view.signature.parsedSignature is defined
      // sometimes signatures come wrongly percent-encoded. Here we check for typical "=3Dabcd" at the end
      const sigText = this.view.signature.parsedSignature.replace('\n=3D', '\n=');
      const verify = async (verificationPubs: string[]) =>
        await BrowserMsg.send.bg.await.pgpMsgVerifyDetached({ plaintext: encryptedData, sigText, verificationPubs });
      const signatureResult = await verify(verificationPubs);
      await this.view.renderModule.decideDecryptedContentFormattingAndRender(encryptedData, false, signatureResult, verificationPubs, verify);
    }
  };
}
