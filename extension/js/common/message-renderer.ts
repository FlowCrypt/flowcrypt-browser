/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { GmailParser, GmailRes } from './api/email-provider/gmail/gmail-parser.js';
import { PubLookup } from './api/pub-lookup.js';
import { ClientConfiguration } from './client-configuration.js';
import { Attachment, Attachment$treatAs, TransferableAttachment } from './core/attachment.js';
import { Buf } from './core/buf.js';
import { CID_PATTERN, Dict, Str, Value } from './core/common.js';
import { KeyUtil } from './core/crypto/key.js';
import { DecryptErrTypes, DecryptResult, FormatError, MsgUtil, VerifyRes } from './core/crypto/pgp/msg-util.js';
import { PgpArmor } from './core/crypto/pgp/pgp-armor.js';
import { Mime, MimeContent, MimeProccesedMsg } from './core/mime.js';
import { MsgBlockParser } from './core/msg-block-parser.js';
import { MsgBlock, MsgBlockType } from './core/msg-block.js';
import { Lang } from './lang.js';
import { Catch } from './platform/catch.js';
import { AcctStore, SendAsAlias } from './platform/store/acct-store.js';
import { ContactStore } from './platform/store/contact-store.js';
import { KeyStore } from './platform/store/key-store.js';
import { PassphraseStore } from './platform/store/passphrase-store.js';
import { Xss } from './platform/xss.js';
import { RelayManager } from './relay-manager.js';
import { RenderInterface, RenderInterfaceBase } from './render-interface.js';
import { PrintMailInfo } from './render-message.js';
import { saveFetchedPubkeysIfNewerThanInStorage } from './shared.js';
import { XssSafeFactory } from './xss-safe-factory.js';
import * as DOMPurify from 'dompurify';
import { Downloader, ProcessedMessage } from './downloader.js';
import { JQueryEl, LoaderContextBindInterface, LoaderContextBindNow, LoaderContextInterface } from './loader-context-interface.js';
import { Gmail } from './api/email-provider/gmail/gmail.js';
import { ApiErr, AjaxErr } from './api/shared/api-error.js';
import { isCustomerUrlFesUsed } from './helpers';

export type ProccesedMsg = MimeProccesedMsg;

export class MessageRenderer {
  private downloader: Downloader;
  public constructor(
    private readonly acctEmail: string,
    private readonly gmail: Gmail,
    private readonly relayManager: RelayManager,
    private readonly factory: XssSafeFactory,
    private sendAs: Dict<SendAsAlias>,
    private debug: boolean = false
  ) {
    this.downloader = new Downloader(gmail);
  }

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
      await MessageRenderer.renderPgpSignatureCheckResult(renderModule, (await retryVerification()) ?? verifyRes, undefined);
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

  public isOutgoing = (senderEmail: string) => {
    return !!this.sendAs[senderEmail]; // todo: remove code duplication
  };

  public processAttachment = async (
    a: Attachment,
    treatAs: Attachment$treatAs,
    loaderContext: LoaderContextInterface,
    attachmentSel: JQueryEl | undefined,
    msgId: string, // deprecated
    printMailInfo: PrintMailInfo,
    senderEmail: string
  ): Promise<'shown' | 'hidden' | 'replaced'> => {
    // todo - [same name + not processed].first() ... What if attachment metas are out of order compared to how gmail shows it? And have the same name?
    try {
      if (['needChunk', 'maybePgp', 'publicKey'].includes(treatAs)) {
        // todo: this isn't the best way to do this
        // todo: move into a handler
        // Inspect a chunk
        if (this.debug) {
          console.debug('processAttachment() try -> awaiting chunk + awaiting type');
        }
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const data = await this.downloader.queueAttachmentChunkDownload(a).result;
        const openpgpType = MsgUtil.type({ data });
        if (openpgpType && openpgpType.type === 'publicKey' && openpgpType.armored) {
          // if it looks like OpenPGP public key
          treatAs = 'publicKey';
        } else if (openpgpType && ['encryptedMsg', 'signedMsg'].includes(openpgpType.type)) {
          treatAs = 'encryptedMsg'; // todo: signedMsg ?
        } else {
          if (this.debug) {
            console.debug("processAttachment() try -> awaiting done and processed -- doesn't look like OpenPGP");
          }
          // plain attachment with a warning
          loaderContext.renderPlainAttachment(a, attachmentSel, 'Unknown OpenPGP format');
          return 'shown';
        }
        if (this.debug) {
          console.debug('processAttachment() try -> awaiting done and processed');
        }
      }
      if (treatAs !== 'plainFile') {
        loaderContext.hideAttachment(attachmentSel);
      }
      if (treatAs === 'hidden') {
        return 'hidden';
      } else if (treatAs === 'encryptedFile') {
        // actual encrypted attachment - show it
        loaderContext.prependEncryptedAttachment(a);
        return 'replaced'; // native should be hidden, custom should appear instead
      } else if (treatAs === 'encryptedMsg') {
        await this.setMsgBodyAndStartProcessing(loaderContext, treatAs, printMailInfo, renderModule =>
          this.processEncryptedMessage(a, renderModule, senderEmail)
        );
        return 'hidden'; // native attachment should be hidden, the "attachment" goes to the message container
      } else if (treatAs === 'publicKey') {
        // todo - pubkey should be fetched in pgp_pubkey.js
        return await this.renderPublicKeyFromFile(a, loaderContext, this.isOutgoing(senderEmail), attachmentSel);
      } else if (treatAs === 'privateKey') {
        return await this.renderBackupFromFile(a, loaderContext, this.isOutgoing(senderEmail));
      } else if (treatAs === 'signature') {
        await this.setMsgBodyAndStartProcessing(loaderContext, 'signedMsg', printMailInfo, renderModule =>
          this.processSignedMessage(msgId, renderModule, senderEmail)
        );
        return 'hidden'; // native attachment should be hidden, the "attachment" goes to the message container
      } else {
        // standard file
        loaderContext.renderPlainAttachment(a, attachmentSel);
        return 'shown';
      }
    } catch (e) {
      if (!ApiErr.isSignificant(e) || (e instanceof AjaxErr && e.status === 200)) {
        loaderContext.renderPlainAttachment(a, attachmentSel, 'Categorize: net err');
        return 'shown';
      } else {
        Catch.reportErr(e);
        loaderContext.renderPlainAttachment(a, attachmentSel, 'Categorize: unknown err');
        return 'shown';
      }
    }
  };

  public relayAndStartProcessing = async (
    relayManager: RelayManager,
    loaderContext: LoaderContextBindInterface,
    factory: XssSafeFactory,
    frameId: string,
    printMailInfo: PrintMailInfo,
    cb: (renderModule: RenderInterface) => Promise<{ publicKeys?: string[]; needPassphrase?: string[] }>
  ) => {
    const renderModule = relayManager.createRelay(frameId);
    loaderContext.bind(frameId, relayManager);
    renderModule.setPrintMailInfo(printMailInfo);
    cb(renderModule)
      .then(async result => {
        const appendAfter = $(`iframe#${frameId}`); // todo: late binding? won't work
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
      })
      .catch(Catch.reportErr);
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
        this.relayAndStartProcessing(relayManager, new LoaderContextBindNow(), factory, frameId, printMailInfo, renderModule =>
          this.renderMsgBlock(block, renderModule, signerEmail)
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
    } else {
      if (!result.longids.chosen && !(await KeyStore.get(this.acctEmail)).length) {
        renderModule.renderErr(Lang.pgpBlock.notProperlySetUp /* + todo: this.view.errorModule.btnHtml('FlowCrypt settings', 'green settings') */, undefined);
      } else if (result.error.type === DecryptErrTypes.keyMismatch) {
        /* todo: await this.view.errorModule.handlePrivateKeyMismatch(
          kisWithPp.map(ki => ki.public),
          encryptedData,
          this.isPwdMsgBasedOnMsgSnippet === true
        ); */
      } else if (result.error.type === DecryptErrTypes.wrongPwd || result.error.type === DecryptErrTypes.usePassword) {
        renderModule.renderErr(Lang.pgpBlock.pwdMsgAskSenderUsePubkey, undefined);
      } else if (result.error.type === DecryptErrTypes.noMdc) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        renderModule.renderErr(result.error.message, result.content!.toUtfStr()); // missing mdc - only render the result after user confirmation
      } else if (result.error) {
        renderModule.renderErr(`${Lang.pgpBlock.cantOpen}\n\n<em>${result.error.type}: ${result.error.message}</em>`, Str.with(encryptedData));
      } else {
        // should generally not happen
        renderModule.renderErr(
          Lang.pgpBlock.cantOpen +
            Lang.general.writeMeToFixIt(await isCustomerUrlFesUsed(this.acctEmail)) +
            '\n\nDiagnostic info: "' +
            JSON.stringify(result) +
            '"',
          Str.with(encryptedData)
        );
      }
    }
    return {};
  };

  public getPrintViewInfo = async (metadata: GmailRes.GmailMsg): Promise<PrintMailInfo> => {
    const fullName = await AcctStore.get(this.acctEmail, ['full_name']); // todo: cache
    const sentDate = GmailParser.findHeader(metadata, 'date');
    const sentDateStr = sentDate ? Str.fromDate(new Date(sentDate)).replace(' ', ' at ') : '';
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

  public msgGetProcessed = async (msgId: string): Promise<ProcessedMessage> => {
    // todo: retries? exceptions?
    const msgDownload = this.downloader.msgGetCached(msgId);
    if (msgDownload.processedFull) {
      return msgDownload.processedFull;
    }
    const fullOrRawMsg = await Promise.race(Object.values(msgDownload.download).filter(Boolean));
    // todo: what should we do if we received 'raw'?
    const mimeContent = MessageRenderer.reconstructMimeContent(fullOrRawMsg);
    const blocks = Mime.processBody(mimeContent);
    // todo: only start `signature` download?
    // start download of all attachments that are not plainFile, for 'needChunk' -- chunked download
    for (const a of mimeContent.attachments.filter(a => !a.hasData())) {
      const treatAs = a.treatAs(mimeContent.attachments); // todo: isBodyEmpty
      if (treatAs === 'plainFile') continue;
      if (treatAs === 'needChunk') {
        this.downloader.queueAttachmentChunkDownload(a);
      } else if (treatAs === 'publicKey') {
        // we also want a chunk before we replace the attachment in the UI
        // todo: or simply download in full?
        this.downloader.queueAttachmentChunkDownload(a);
      } else {
        // todo: this.downloader.queueAttachmentDownload(a);
      }
    }
    let renderedXssSafe: string | undefined;
    let blocksInFrames: Dict<MsgBlock> = {};
    const from = GmailParser.findHeader(fullOrRawMsg, 'from');
    if (blocks.length === 0 || (blocks.length === 1 && ['plainText', 'plainHtml'].includes(blocks[0].type))) {
      // only has single block which is plain text
    } else {
      ({ renderedXssSafe, blocksInFrames } = MessageRenderer.renderMsg({ blocks, from }, this.factory, false, msgId, this.sendAs));
    }
    msgDownload.processedFull = {
      renderedXssSafe,
      blocksInFrames,
      printMailInfo: await this.getPrintViewInfo(fullOrRawMsg),
      from,
      attachments: mimeContent.attachments,
    };
    return msgDownload.processedFull;
  };

  private setMsgBodyAndStartProcessing = async (
    loaderContext: LoaderContextInterface,
    type: MsgBlockType, // for diagnostics
    printMailInfo: PrintMailInfo,
    cb: (renderModule: RenderInterface) => Promise<{ publicKeys?: string[] }>
  ) => {
    const { frameId, frameXssSafe } = loaderContext.factory.embeddedRenderMsg(type);
    loaderContext.setMsgBody(frameXssSafe, 'set');
    await this.relayAndStartProcessing(this.relayManager, loaderContext, loaderContext.factory, frameId, printMailInfo, cb);
  };

  private processSignedMessage = async (msgId: string, renderModule: RenderInterface, senderEmail: string) => {
    try {
      renderModule.renderText('Loading signed message...');
      const raw = await this.msgGetRaw(msgId);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return await this.renderSignedMessage(raw!, renderModule, senderEmail);
    } catch {
      // todo: render error via renderModule
    }
    return {};
  };

  private processEncryptedMessage = async (attachment: Attachment, renderModule: RenderInterface, senderEmail: string) => {
    try {
      if (!attachment.hasData()) {
        // todo: common cache, load control?
        renderModule.renderText('Retrieving message...');
        await this.gmail.fetchAttachments([attachment]); // todo: render progressCb
      }
      // todo: probaby subject isn't relevant in attachment-based decryption?
      // const subject = gmailMsg.payload ? GmailParser.findHeader(gmailMsg.payload, 'subject') : undefined;
      const armoredMsg = PgpArmor.clip(attachment.getData().toUtfStr());
      if (!armoredMsg) {
        // todo:
        throw new FormatError('Problem extracting armored message', attachment.getData().toUtfStr());
      }
      renderModule.renderText('Decrypting...');
      return await this.renderEncryptedMessage(armoredMsg, renderModule, false, senderEmail);
    } catch {
      // todo: render error via renderModule
    }
    return {};
  };

  private renderPublicKeyFromFile = async (
    attachmentMeta: Attachment,
    loaderContext: LoaderContextInterface,
    isOutgoing: boolean,
    attachmentSel: JQueryEl | undefined
  ): Promise<'shown' | 'hidden'> => {
    // let downloadedAttachment: GmailRes.GmailAttachment;
    try {
      // todo: how is different -- downloader.attachmentGet(attachmentMeta.msgId!, attachmentMeta.id!); // .id! is present when fetched from api
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      await this.gmail.fetchAttachments([attachmentMeta]);
    } catch (e) {
      loaderContext.renderPlainAttachment(attachmentMeta, undefined, 'Please reload page');
      return 'shown';
    }
    const openpgpType = MsgUtil.type({ data: attachmentMeta.getData().subarray(0, 1000) });
    if (openpgpType?.type === 'publicKey') {
      loaderContext.setMsgBody(this.factory.embeddedPubkey(attachmentMeta.getData().toUtfStr(), isOutgoing), 'after');
      return 'hidden';
    } else if (openpgpType?.type !== 'encryptedAttachment') {
      loaderContext.renderPlainAttachment(attachmentMeta, attachmentSel, 'Unknown Public Key Format');
      return 'shown';
    } else {
      // todo: renderEncryptedAttachment
      return 'hidden'; // todo: return 'shown'
    }
  };

  private renderBackupFromFile = async (
    attachmentMeta: Attachment,
    loaderContext: LoaderContextInterface,
    isOutgoing: boolean
  ): Promise<'shown' | 'hidden'> => {
    // let downloadedAttachment: GmailRes.GmailAttachment;
    try {
      // todo: fetch from queue
      // todo: how is different -- downloader.attachmentGet(attachmentMeta.msgId!, attachmentMeta.id!); // .id! is present when fetched from api
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      await this.gmail.fetchAttachments([attachmentMeta]);
      loaderContext.setMsgBody(this.factory.embeddedPubkey(attachmentMeta.getData().toUtfStr(), isOutgoing), 'append');
      return 'hidden';
    } catch (e) {
      loaderContext.renderPlainAttachment(attachmentMeta, undefined, 'Please reload page');
      return 'shown';
    }
  };

  private msgGetRaw = async (msgId: string): Promise<string> => {
    const msgDownload = this.downloader.msgGetCached(msgId).download;
    if (!msgDownload.raw) {
      msgDownload.raw = this.gmail.msgGet(msgId, 'raw');
    }
    return (await msgDownload.raw).raw || '';
  };
}
