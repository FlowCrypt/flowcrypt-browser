/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { GmailParser, GmailRes } from './api/email-provider/gmail/gmail-parser.js';
import { PubLookup } from './api/pub-lookup.js';
import { ClientConfiguration } from './client-configuration.js';
import { Attachment, TransferableAttachment } from './core/attachment.js';
import { Buf } from './core/buf.js';
import { CID_PATTERN, Dict, Str, Value } from './core/common.js';
import { KeyUtil } from './core/crypto/key.js';
import { DecryptErrTypes, DecryptResult, MsgUtil, VerifyRes } from './core/crypto/pgp/msg-util.js';
import { Mime, MimeContent, MimeProccesedMsg } from './core/mime.js';
import { MsgBlockParser } from './core/msg-block-parser.js';
import { MsgBlock } from './core/msg-block.js';
import { Lang } from './lang.js';
import { Catch } from './platform/catch.js';
import { AcctStore, SendAsAlias } from './platform/store/acct-store.js';
import { ContactStore } from './platform/store/contact-store.js';
import { KeyStore } from './platform/store/key-store.js';
import { PassphraseStore } from './platform/store/passphrase-store.js';
import { Xss } from './platform/xss.js';
import { RelayManager } from './relay-manager.js';
import { RenderInterface, RenderInterfaceBase } from './render-interface.js';
import { PrintMailInfo } from './render-message';
import { saveFetchedPubkeysIfNewerThanInStorage } from './shared.js';
import { XssSafeFactory } from './xss-safe-factory.js';
import * as DOMPurify from 'dompurify';

export type JQueryEl = JQuery<HTMLElement>;

export type ProccesedMsg = MimeProccesedMsg;

export type AttachmentBlock = {
  block: MsgBlock;
  file: Attachment; // todo: only need id in MsgBlock's AttachmentMeta?
};

export class MessageRenderer {
  public constructor(private readonly acctEmail: string) {}

  /**
   * Replaces inline image CID references with base64 encoded data in sanitized HTML
   * and returns the sanitized HTML along with the inline CID attachments.
   *
   * @param html - The original HTML content.
   * @param attachments - An array of email attachments.
   * @returns An object containing sanitized HTML and an array of inline CID attachments.
   */
  public static replaceInlineImageCIDs = (html: string, attachments: Attachment[]): { sanitizedHtml: string; inlineCIDAttachments: Attachment[] } => {
    // Array to store inline CID attachments
    const inlineCIDAttachments: Attachment[] = [];

    // Define the hook function for DOMPurify to process image elements after sanitizing attributes
    const processImageElements = (node: Element | null) => {
      // Ensure the node exists and has a 'src' attribute
      if (!node || !('src' in node)) return;
      const imageSrc = node.getAttribute('src') as string;
      if (!imageSrc) return;
      const matches = imageSrc.match(CID_PATTERN);

      // Check if the src attribute contains a CID
      if (matches && matches[1]) {
        const contentId = matches[1];
        const contentIdAttachment = attachments.find(attachment => attachment.cid === `<${contentId}>`);

        // Replace the src attribute with a base64 encoded string
        if (contentIdAttachment) {
          inlineCIDAttachments.push(contentIdAttachment);
          node.setAttribute('src', `data:${contentIdAttachment.type};base64,${contentIdAttachment.getData().toBase64Str()}`);
        }
      }
    };

    // Add the DOMPurify hook
    DOMPurify.addHook('afterSanitizeAttributes', processImageElements);

    // Sanitize the HTML and remove the DOMPurify hooks
    const sanitizedHtml = DOMPurify.sanitize(html);
    DOMPurify.removeAllHooks();

    return { sanitizedHtml, inlineCIDAttachments };
  };

  public static getEncryptedSubjectText = (subject: string, isHtml: boolean) => {
    if (isHtml) {
      return `<div style="white-space: normal"> Encrypted Subject:
                <b> ${Xss.escape(subject)}</b>
              </div>
              <hr/>`;
    } else {
      return `Encrypted Subject: ${subject}\n----------------------------------------------------------------------------------------------------\n`;
    }
  };

  public static decideDecryptedContentFormattingAndRender = async (
    decryptedBytes: Uint8Array | string,
    isEncrypted: boolean,
    sigResult: VerifyRes | undefined,
    renderModule: RenderInterface,
    retryVerification?: () => Promise<VerifyRes | undefined>,
    plainSubject?: string
  ): Promise<{ publicKeys?: string[] }> => {
    if (isEncrypted) {
      renderModule.renderEncryptionStatus('encrypted');
      renderModule.setFrameColor('green');
    } else {
      renderModule.renderEncryptionStatus('not encrypted');
      renderModule.setFrameColor('gray');
    }
    const publicKeys: string[] = [];
    let renderableAttachments: TransferableAttachment[] = [];
    let decryptedContent: string | undefined;
    let isHtml = false;
    // todo - replace with MsgBlockParser.fmtDecryptedAsSanitizedHtmlBlocks, then the extract/strip methods could be private?
    if (!Mime.resemblesMsg(decryptedBytes)) {
      const fcAttachmentBlocks: MsgBlock[] = [];
      decryptedContent = Str.with(decryptedBytes);
      decryptedContent = MsgBlockParser.extractFcAttachments(decryptedContent, fcAttachmentBlocks);
      decryptedContent = MsgBlockParser.stripFcTeplyToken(decryptedContent);
      decryptedContent = MsgBlockParser.stripPublicKeys(decryptedContent, publicKeys);
      if (fcAttachmentBlocks.length) {
        renderableAttachments = fcAttachmentBlocks.map(
          attachmentBlock => Attachment.toTransferableAttachment(attachmentBlock.attachmentMeta!) // eslint-disable-line @typescript-eslint/no-non-null-assertion
        );
      }
    } else {
      renderModule.renderText('Formatting...');
      const decoded = await Mime.decode(decryptedBytes);
      let inlineCIDAttachments: Attachment[] = [];
      if (typeof decoded.html !== 'undefined') {
        ({ sanitizedHtml: decryptedContent, inlineCIDAttachments } = MessageRenderer.replaceInlineImageCIDs(decoded.html, decoded.attachments));
        isHtml = true;
      } else if (typeof decoded.text !== 'undefined') {
        decryptedContent = decoded.text;
      } else {
        decryptedContent = '';
      }
      if (
        decoded.subject &&
        isEncrypted &&
        (!plainSubject || !Mime.subjectWithoutPrefixes(plainSubject).includes(Mime.subjectWithoutPrefixes(decoded.subject)))
      ) {
        // there is an encrypted subject + (either there is no plain subject or the plain subject does not contain what's in the encrypted subject)
        decryptedContent = MessageRenderer.getEncryptedSubjectText(decoded.subject, isHtml) + decryptedContent; // render encrypted subject in message
      }
      for (const attachment of decoded.attachments) {
        if (attachment.isPublicKey()) {
          publicKeys.push(attachment.getData().toUtfStr());
        } else if (!inlineCIDAttachments.some(inlineAttachment => inlineAttachment.cid === attachment.cid)) {
          renderableAttachments.push(
            Attachment.toTransferableAttachment({
              name: attachment.name,
              type: attachment.type,
              length: attachment.getData().length,
              data: attachment.getData(),
              cid: attachment.cid, // todo: do we need it?
            })
          );
        }
      }
    }
    renderModule.separateQuotedContentAndRenderText(decryptedContent, isHtml); // todo: quoteModule ?
    await MessageRenderer.renderPgpSignatureCheckResult(renderModule, sigResult, retryVerification);
    if (renderableAttachments.length) {
      renderModule.renderInnerAttachments(renderableAttachments, isEncrypted);
    }
    renderModule.resizePgpBlockFrame();
    renderModule.setTestState('ready');
    return isEncrypted ? { publicKeys } : {};
  };

  public static decryptFunctionToVerifyRes = async (decrypt: () => Promise<DecryptResult>): Promise<VerifyRes | undefined> => {
    const decryptResult = await decrypt();
    if (!decryptResult.success) {
      return undefined; // note: this internal error results in a wrong "Not Signed" badge
    } else {
      return decryptResult.signature;
    }
  };

  public static processMessageFromRaw = async (raw: string) => {
    const mimeMsg = Buf.fromBase64UrlStr(raw);
    return await Mime.process(mimeMsg);
  };

  public static reconstructMimeContent = (gmailMsg: GmailRes.GmailMsg): MimeContent => {
    const bodies = GmailParser.findBodies(gmailMsg);
    const attachments = GmailParser.findAttachments(gmailMsg, gmailMsg.id);
    const text = bodies['text/plain'] ? Buf.fromBase64UrlStr(bodies['text/plain']).toUtfStr() : undefined;
    // todo: do we need to strip?
    const html = bodies['text/html'] ? Xss.htmlSanitizeAndStripAllTags(Buf.fromBase64UrlStr(bodies['text/html']).toUtfStr(), '\n') : undefined;
    // reconstructed MIME content
    return {
      text,
      html,
      attachments,
    };
  };

  public static renderMsg = (
    { from, blocks }: { blocks: MsgBlock[]; from?: string },
    factory: XssSafeFactory,
    showOriginal: boolean,
    msgId: string, // todo: will be removed
    sendAs?: Dict<SendAsAlias>
  ) => {
    const isOutgoing = Boolean(from && !!sendAs?.[from]);
    const blocksInFrames: Dict<MsgBlock> = {};
    let r = '';
    for (const block of blocks) {
      if (r) {
        r += '<br><br>';
      }
      if (showOriginal) {
        r += Xss.escape(Str.with(block.content)).replace(/\n/g, '<br>');
      } else if (['signedMsg', 'encryptedMsg'].includes(block.type)) {
        const { frameId, frameXssSafe } = factory.embeddedRenderMsg(block.type);
        r += frameXssSafe;
        blocksInFrames[frameId] = block;
      } else {
        r += XssSafeFactory.renderableMsgBlock(factory, block, msgId, from || 'unknown', isOutgoing);
      }
    }
    return { renderedXssSafe: r, isOutgoing, blocksInFrames };
  };

  public static renderPgpSignatureCheckResult = async (
    renderModule: RenderInterface,
    verifyRes: VerifyRes | undefined,
    retryVerification?: () => Promise<VerifyRes | undefined>
  ) => {
    if (verifyRes?.error) {
      /* todo: if (not raw) {
        // Sometimes the signed content is slightly modified when parsed from DOM,
        // so the message should be re-fetched straight from API to make sure we get the original signed data and verify again
        this.view.signature.parsedSignature = undefined; // force to re-parse
        await this.view.decryptModule.initialize(verificationPubs, true);
        return;
      } */
      renderModule.renderSignatureStatus(`error verifying signature: ${verifyRes.error}`);
      renderModule.setFrameColor('red');
    } else if (!verifyRes || !verifyRes.signerLongids.length) {
      renderModule.renderSignatureStatus('not signed');
    } else if (verifyRes.match) {
      renderModule.renderSignatureStatus('signed');
    } else if (retryVerification) {
      renderModule.renderVerificationInProgress();
      await MessageRenderer.renderPgpSignatureCheckResult(renderModule, await retryVerification(), undefined);
      return;
    } else {
      // todo: is this situation possible: no sender info in `from`?
      // renderModule.renderSignatureStatus('could not verify signature: missing pubkey, missing sender info');
      MessageRenderer.renderMissingPubkeyOrBadSignature(renderModule, verifyRes);
    }
    renderModule.setTestState('ready');
  };

  public static renderMissingPubkeyOrBadSignature = (renderModule: RenderInterfaceBase, verifyRes: VerifyRes): void => {
    // eslint-disable-next-line no-null/no-null
    if (verifyRes.match === null || !Value.arr.hasIntersection(verifyRes.signerLongids, verifyRes.suppliedLongids)) {
      MessageRenderer.renderMissingPubkey(renderModule, verifyRes.signerLongids[0]);
    } else {
      MessageRenderer.renderBadSignature(renderModule);
    }
  };

  public static renderMissingPubkey = (renderModule: RenderInterfaceBase, signerLongid: string) => {
    renderModule.renderSignatureStatus(`could not verify signature: missing pubkey ${signerLongid}`);
  };

  public static renderBadSignature = (renderModule: RenderInterfaceBase) => {
    renderModule.renderSignatureStatus('bad signature');
    renderModule.setFrameColor('red'); // todo: in what other cases should we set the frame red?
  };

  private static getVerificationPubs = async (signerEmail: string) => {
    const parsedPubs = (await ContactStore.getOneWithAllPubkeys(undefined, signerEmail))?.sortedPubkeys ?? [];
    // todo: we don't actually need parsed pubs here because we're going to pass them to the background page
    // maybe we can have a method in ContactStore to extract armored keys
    return parsedPubs.map(key => KeyUtil.armor(key.pubkey));
  };

  public relayAndProcess = async (
    relayManager: RelayManager,
    factory: XssSafeFactory,
    frameId: string,
    printMailInfo: PrintMailInfo,
    cb: (renderModule: RenderInterface) => Promise<{ publicKeys?: string[]; needPassphrase?: string[] }>
  ) => {
    const embeddedReference = XssSafeFactory.getEmbeddedMsg(frameId);
    if (embeddedReference) {
      const renderModule = relayManager.createRelay(frameId, embeddedReference.frameWindow);
      renderModule.setPrintMailInfo(printMailInfo);
      let result = await cb(renderModule);
      const appendAfter = $(`iframe#${frameId}`);
      // todo: how publicKeys and needPassphrase interact?
      for (const armoredPubkey of result.publicKeys ?? []) {
        appendAfter.after(factory.embeddedPubkey(armoredPubkey, false));
      }
      while (result.needPassphrase) {
        // todo: queue into a dictionary?
        await PassphraseStore.waitUntilPassphraseChanged(this.acctEmail, result.needPassphrase);
        renderModule.clearErrorStatus();
        renderModule.renderText('Decrypting...');
        result = await cb(renderModule);
      }
      // todo: wait for renderModule completion: the queue has been actually flushed,
      // and then remove the frame from relayManager.frames
      // Something like:
      // await relayManager.waitForCompletion(renderModule)
    } else {
      Catch.report('Unexpected: unable to reference a newly created message frame'); // todo:
    }
  };

  public processInlineBlocks = async (
    relayManager: RelayManager,
    factory: XssSafeFactory,
    printMailInfo: PrintMailInfo,
    blocks: Dict<MsgBlock>,
    from?: string // need to unify somehow when we accept `abc <email@address>` and when just `email@address`
  ) => {
    const signerEmail = from ? Str.parseEmail(from).email : undefined;
    await Promise.all(
      Object.entries(blocks).map(([frameId, block]) =>
        this.relayAndProcess(relayManager, factory, frameId, printMailInfo, renderModule => this.renderMsgBlock(block, renderModule, signerEmail)).catch(
          Catch.reportErr
        )
      )
    );
  };

  public renderMsgBlock = async (block: MsgBlock, renderModule: RenderInterface, signerEmail?: string) => {
    // todo: 'signedMsg' also handled here?
    return await this.renderEncryptedMessage(block.content, renderModule, true, signerEmail);
  };

  // todo: this should be moved to some other class?
  public getRetryVerification = (signerEmail: string, verify: (verificationPubs: string[]) => Promise<VerifyRes | undefined>) => async () => {
    const clientConfiguration = await ClientConfiguration.newInstance(this.acctEmail);
    const { pubkeys } = await new PubLookup(clientConfiguration).lookupEmail(signerEmail);
    if (pubkeys.length) {
      await saveFetchedPubkeysIfNewerThanInStorage({ email: signerEmail, pubkeys }); // synchronously because we don't want erratic behaviour
      return await verify(pubkeys);
    }
    return undefined;
  };

  public renderSignedMessage = async (raw: string, renderModule: RenderInterface, signerEmail: string) => {
    // ... from PgpBlockViewDecryptModule.initialize
    const mimeMsg = Buf.fromBase64UrlStr(raw);
    const parsed = await Mime.decode(mimeMsg);
    if (parsed && typeof parsed.rawSignedContent === 'string') {
      const signatureAttachment = parsed.attachments.find(a => a.treatAs(parsed.attachments) === 'signature'); // todo: more than one signature candidate?
      if (signatureAttachment) {
        const parsedSignature = signatureAttachment.getData().toUtfStr();
        // ... from PgpBlockViewDecryptModule.decryptAndRender
        const sigText = parsedSignature.replace('\n=3D', '\n=');
        const encryptedData = parsed.rawSignedContent;
        try {
          const verificationPubs = await MessageRenderer.getVerificationPubs(signerEmail);
          const verify = async (verificationPubs: string[]) => await MsgUtil.verifyDetached({ plaintext: encryptedData, sigText, verificationPubs });
          const signatureResult = await verify(verificationPubs);
          return await MessageRenderer.decideDecryptedContentFormattingAndRender(
            encryptedData,
            false,
            signatureResult,
            renderModule,
            this.getRetryVerification(signerEmail, verify)
          );
        } catch (e) {
          console.log(e);
        }
      }
    }
    /* todo: await this.view.errorModule.renderErr(
      'Error: could not properly parse signed message',
      parsed.rawSignedContent || parsed.text || parsed.html || mimeMsg.toUtfStr(),
      'parse error'
    ); */
    return {};
  };

  public renderEncryptedMessage = async (
    encryptedData: string | Uint8Array,
    renderModule: RenderInterface,
    fallbackToPlainText: boolean,
    signerEmail?: string
  ): Promise<{ publicKeys?: string[]; needPassphrase?: string[] }> => {
    const kisWithPp = await KeyStore.getAllWithOptionalPassPhrase(this.acctEmail); // todo: cache
    const verificationPubs = signerEmail ? await MessageRenderer.getVerificationPubs(signerEmail) : [];
    const decrypt = (verificationPubs: string[]) => MsgUtil.decryptMessage({ kisWithPp, encryptedData, verificationPubs });
    const result = await decrypt(verificationPubs);
    // from decryptAndRender
    if (typeof result === 'undefined') {
      // todo: renderErr(Lang.general.restartBrowserAndTryAgain(!!this.view.fesUrl), undefined);
    } else if (result.success) {
      return await MessageRenderer.decideDecryptedContentFormattingAndRender(
        result.content,
        !!result.isEncrypted,
        result.signature,
        renderModule,
        signerEmail
          ? this.getRetryVerification(signerEmail, verificationPubs => MessageRenderer.decryptFunctionToVerifyRes(() => decrypt(verificationPubs)))
          : undefined
      );
    } else if (result.error.type === DecryptErrTypes.format) {
      if (fallbackToPlainText) {
        renderModule.renderAsRegularContent(Str.with(encryptedData));
      } else {
        renderModule.renderErr(Lang.pgpBlock.badFormat + '\n\n' + result.error.message, Str.with(encryptedData));
      }
    } else if (result.longids.needPassphrase.length) {
      renderModule.renderPassphraseNeeded(result.longids.needPassphrase);
      return { needPassphrase: result.longids.needPassphrase };
      /*
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
      */
    } else {
      /*
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
      */
    }
    return {};
  };

  public getPrintViewInfo = async (metadata: GmailRes.GmailMsg): Promise<PrintMailInfo> => {
    const fullName = await AcctStore.get(this.acctEmail, ['full_name']); // todo: cache
    const sentDate = new Date(GmailParser.findHeader(metadata, 'date') ?? '');
    const sentDateStr = Str.fromDate(sentDate).replace(' ', ' at ');
    const from = Str.parseEmail(GmailParser.findHeader(metadata, 'from') ?? '');
    const fromHtml = from.name ? `<b>${Xss.htmlSanitize(from.name)}</b> &lt;${from.email}&gt;` : from.email;
    /* eslint-disable @typescript-eslint/no-non-null-assertion */
    const ccString = GmailParser.findHeader(metadata, 'cc')
      ? `Cc: <span data-test="print-cc">${Xss.escape(GmailParser.findHeader(metadata, 'cc')!)}</span><br/>`
      : '';
    const bccString = GmailParser.findHeader(metadata, 'bcc') ? `Bcc: <span>${Xss.escape(GmailParser.findHeader(metadata, 'bcc')!)}</span><br/>` : '';
    /* eslint-enable @typescript-eslint/no-non-null-assertion */
    return {
      userNameAndEmail: `<b>${fullName.full_name}</b> &lt;${this.acctEmail}&gt;`,
      html: `
      <hr>
      <p class="subject-label" data-test="print-subject">${Xss.htmlSanitize(GmailParser.findHeader(metadata, 'subject') ?? '')}</p>
      <hr>
      <br/>
      <div>
        <div class="inline-block">
          <span data-test="print-from">From: ${fromHtml}</span>
        </div>
        <div class="float-right">
          <span>${sentDateStr}</span>
        </div>
      </div>
      <span data-test="print-to">To: ${Xss.escape(GmailParser.findHeader(metadata, 'to') ?? '')}</span><br/>
      ${ccString}
      ${bccString}
      <br/><hr>
    `,
    };
  };
}
