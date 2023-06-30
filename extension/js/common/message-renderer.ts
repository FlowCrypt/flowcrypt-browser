/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { GmailParser, GmailRes } from './api/email-provider/gmail/gmail-parser.js';
import { PubLookup } from './api/pub-lookup.js';
import { ClientConfiguration } from './client-configuration.js';
import { Attachment, TransferableAttachment } from './core/attachment.js';
import { Buf } from './core/buf.js';
import { CID_PATTERN, Dict, Str, Value } from './core/common.js';
import { KeyUtil } from './core/crypto/key.js';
import { DecryptErrTypes, DecryptResult, MsgUtil, PgpMsgTypeResult, VerifyRes } from './core/crypto/pgp/msg-util.js';
import { PgpArmor } from './core/crypto/pgp/pgp-armor.js';
import { Mime, MessageBody } from './core/mime.js';
import { MsgBlockParser } from './core/msg-block-parser.js';
import { MsgBlock } from './core/msg-block.js';
import { Lang } from './lang.js';
import { Catch } from './platform/catch.js';
import { AcctStore } from './platform/store/acct-store.js';
import { ContactStore } from './platform/store/contact-store.js';
import { KeyStore } from './platform/store/key-store.js';
import { PassphraseStore } from './platform/store/passphrase-store.js';
import { Xss } from './platform/xss.js';
import { RelayManager } from './relay-manager.js';
import { RenderInterface, RenderInterfaceBase } from './render-interface.js';
import { MessageInfo, PrintMailInfo } from './render-message.js';
import { saveFetchedPubkeysIfNewerThanInStorage } from './shared.js';
import { XssSafeFactory } from './xss-safe-factory.js';
import * as DOMPurify from 'dompurify';
import { Downloader } from './downloader.js';
import { JQueryEl, LoaderContextInterface } from './loader-context-interface.js';
import { Gmail } from './api/email-provider/gmail/gmail.js';
import { ApiErr } from './api/shared/api-error.js';
import { isCustomerUrlFesUsed } from './helpers.js';
import { ExpirationCache } from './core/expiration-cache.js';

type ProcessedMessage = {
  body: MessageBody;
  blocks: MsgBlock[];
  attachments: Attachment[];
  messageInfo: MessageInfo;
};

export class MessageRenderer {
  public readonly downloader: Downloader;
  private readonly processedMessages = new ExpirationCache<string, Promise<ProcessedMessage>>(24 * 60 * 60 * 1000); // 24 hours

  private constructor(
    private readonly acctEmail: string,
    private readonly gmail: Gmail,
    private readonly relayManager: RelayManager,
    private readonly factory: XssSafeFactory,
    private readonly sendAsAliases: Set<string>,
    private readonly fullName?: string,
    private debug: boolean = false
  ) {
    this.downloader = new Downloader(gmail);
  }

  public static newInstance = async (acctEmail: string, gmail: Gmail, relayManager: RelayManager, factory: XssSafeFactory, debug = false) => {
    const { sendAs, full_name: fullName } = await AcctStore.get(acctEmail, ['sendAs', 'full_name']);
    return new MessageRenderer(acctEmail, gmail, relayManager, factory, new Set(sendAs ? Object.keys(sendAs) : [acctEmail]), fullName, debug);
  };

  public static isPwdMsg = (text: string) => {
    return /https:\/\/flowcrypt\.com\/[a-zA-Z0-9]{10}$/.test(text);
  };

  /**
   * Replaces inline image CID references with base64 encoded data in sanitized HTML
   * and returns the sanitized HTML along with the inline CID attachments.
   *
   * @param html - The original HTML content.
   * @param attachments - An array of email attachments.
   * @returns An object containing sanitized HTML and an array of inline CID attachments.
   */
  private static replaceInlineImageCIDs = (html: string, attachments: Attachment[]): { sanitizedHtml: string; inlineCIDAttachments: Set<Attachment> } => {
    // Set to store inline CID attachments
    const inlineCIDAttachments = new Set<Attachment>();

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
          inlineCIDAttachments.add(contentIdAttachment);
          node.setAttribute('src', `data:${contentIdAttachment.type};base64,${contentIdAttachment.getData().toBase64Str()}`);
        }
      }
    };

    // Add the DOMPurify hook
    DOMPurify.addHook('afterSanitizeAttributes', processImageElements);

    // Sanitize the HTML and remove the DOMPurify hooks
    const sanitizedHtml = Xss.htmlSanitize(html);
    DOMPurify.removeAllHooks();

    return { sanitizedHtml, inlineCIDAttachments };
  };

  private static getEncryptedSubjectText = (subject: string, isHtml: boolean) => {
    if (isHtml) {
      return `<div style="white-space: normal"> Encrypted Subject:
                <b> ${Xss.escape(subject)}</b>
              </div>
              <hr/>`;
    } else {
      return `Encrypted Subject: ${subject}\n----------------------------------------------------------------------------------------------------\n`;
    }
  };

  private static decryptFunctionToVerifyRes = async (decrypt: () => Promise<DecryptResult>): Promise<VerifyRes | undefined> => {
    const decryptResult = await decrypt();
    if (!decryptResult.success) {
      return undefined; // note: this internal error results in a wrong "Not Signed" badge
    } else {
      return decryptResult.signature;
    }
  };

  // attachments returned by this method are missing data, so they need to be fetched
  private static getMessageBodyAndAttachments = (gmailMsg: GmailRes.GmailMsg): { body: MessageBody; attachments: Attachment[] } => {
    const bodies = GmailParser.findBodies(gmailMsg);
    const attachments = GmailParser.findAttachments(gmailMsg, gmailMsg.id);
    const text = bodies['text/plain'] ? Buf.fromBase64UrlStr(bodies['text/plain']).toUtfStr() : undefined;
    // stripping HTML tags here for safety in the way extractArmoredBlock used to do, should we?
    // note: MimeContent.html returned from Mime.decode (when processing a raw MIME-message) isn't stripped
    // so there is another stripping that takes place later when rendering in XssSafeFactory.renderableMsgBlock
    const html = bodies['text/html'] ? Xss.htmlSanitizeAndStripAllTags(Buf.fromBase64UrlStr(bodies['text/html']).toUtfStr(), '\n') : undefined;
    return {
      body: {
        text,
        html,
      },
      attachments,
    };
  };

  private static renderPgpSignatureCheckResult = async (
    renderModule: RenderInterface,
    verifyRes: VerifyRes | undefined,
    wasSignerEmailSupplied: boolean,
    retryVerification?: () => Promise<VerifyRes | undefined>
  ) => {
    if (verifyRes?.error) {
      renderModule.renderSignatureStatus(`error verifying signature: ${verifyRes.error}`);
      renderModule.setFrameColor('red');
    } else if (!verifyRes || !verifyRes.signerLongids.length) {
      renderModule.renderSignatureStatus('not signed');
    } else if (verifyRes.match) {
      renderModule.renderSignatureStatus('signed');
    } else if (retryVerification) {
      renderModule.renderVerificationInProgress();
      let retryVerificationAgain: (() => Promise<VerifyRes | undefined>) | undefined;
      try {
        verifyRes = (await retryVerification()) ?? verifyRes; // [fetch pubkeys] and verify again
      } catch (e) {
        if (ApiErr.isSignificant(e)) {
          Catch.reportErr(e);
          renderModule.renderSignatureStatus(`error verifying signature: ${e}`);
          return;
        } else {
          const continuationPromise = new Promise<void>(resolve => renderModule.renderSignatureOffline(resolve));
          // todo: we can make a helper method to await a Promise or a cancellation flag,
          // but we'd better make `cancel` a Promise as well
          const createTimeoutPromise = () =>
            new Promise<'timeout'>(resolve => {
              Catch.setHandledTimeout(() => resolve('timeout'), 1000);
            });
          while ((await Promise.race([continuationPromise, createTimeoutPromise()])) === 'timeout') {
            if (renderModule.cancellation.cancel) return;
          }
          retryVerificationAgain = retryVerification;
        }
      }
      await MessageRenderer.renderPgpSignatureCheckResult(renderModule, verifyRes, wasSignerEmailSupplied, retryVerificationAgain);
      return;
    } else if (!wasSignerEmailSupplied) {
      // todo: unit-test this case?
      renderModule.renderSignatureStatus('could not verify signature: missing pubkey, missing sender info');
    } else {
      MessageRenderer.renderMissingPubkeyOrBadSignature(renderModule, verifyRes);
    }
  };

  private static renderMissingPubkeyOrBadSignature = (renderModule: RenderInterfaceBase, verifyRes: VerifyRes): void => {
    // eslint-disable-next-line no-null/no-null
    if (verifyRes.match === null || !Value.arr.hasIntersection(verifyRes.signerLongids, verifyRes.suppliedLongids)) {
      MessageRenderer.renderMissingPubkey(renderModule, verifyRes.signerLongids[0]);
    } else {
      MessageRenderer.renderBadSignature(renderModule);
    }
  };

  private static renderMissingPubkey = (renderModule: RenderInterfaceBase, signerLongid: string) => {
    renderModule.renderSignatureStatus(`could not verify signature: missing pubkey ${signerLongid}`);
  };

  private static renderBadSignature = (renderModule: RenderInterfaceBase) => {
    renderModule.renderSignatureStatus('bad signature');
    renderModule.setFrameColor('red');
  };

  private static getVerificationPubs = async (signerEmail: string) => {
    const email = Str.parseEmail(signerEmail).email;
    if (!email) return [];
    const parsedPubs = (await ContactStore.getOneWithAllPubkeys(undefined, email))?.sortedPubkeys ?? [];
    // todo: we're armoring pubkeys here to pass them to MsgUtil. Perhaps, we can optimize this
    return parsedPubs.map(key => KeyUtil.armor(key.pubkey));
  };

  private static handlePrivateKeyMismatch = async (renderModule: RenderInterface, armoredPubs: string[], message: Uint8Array | string, isPwdMsg: boolean) => {
    // todo - make it work for multiple stored keys
    const msgDiagnosis = await MsgUtil.diagnosePubkeys({ armoredPubs, message });
    if (msgDiagnosis.found_match) {
      renderModule.renderErr(Lang.pgpBlock.cantOpen + Lang.pgpBlock.encryptedCorrectlyFileBug, undefined);
    } else if (isPwdMsg) {
      renderModule.renderErr(
        Lang.pgpBlock.pwdMsgOnlyReadableOnWeb + MessageRenderer.btnHtml('ask sender to re-send', 'gray2 short reply_pubkey_mismatch'),
        undefined
      );
    } else {
      const startText =
        msgDiagnosis.receivers === 1
          ? Lang.pgpBlock.cantOpen + Lang.pgpBlock.singleSender + Lang.pgpBlock.askResend
          : Lang.pgpBlock.yourKeyCantOpenImportIfHave;
      renderModule.renderErr(
        startText +
          MessageRenderer.btnHtml('import missing key', 'gray2 settings_add_key') +
          '&nbsp; &nbsp;' +
          MessageRenderer.btnHtml('ask sender to update', 'gray2 short reply_pubkey_mismatch') +
          '&nbsp; &nbsp;' +
          MessageRenderer.btnHtml('settings', 'gray2 settings_keyserver'),
        undefined
      );
    }
  };

  private static btnHtml = (text: string, addClasses: string) => {
    return `<button class="button long ${addClasses}" style="margin:30px 0;" target="cryptup">${text}</button>`;
  };

  public renderMsg = ({ senderEmail, blocks }: { blocks: MsgBlock[]; senderEmail?: string }, showOriginal: boolean) => {
    const isOutgoing = this.isOutgoing(senderEmail);
    const blocksInFrames: Dict<MsgBlock> = {};
    let renderedXssSafe = ''; // xss-direct
    for (const block of blocks) {
      if (renderedXssSafe) renderedXssSafe += '<br><br>'; // xss-direct
      if (showOriginal) {
        renderedXssSafe += Xss.escape(Str.with(block.content)).replace(/\n/g, '<br>'); // xss-escaped
      } else if (['signedMsg', 'encryptedMsg'].includes(block.type)) {
        const { frameId, frameXssSafe } = this.factory.embeddedMsg(block.type); // xss-safe-factory
        renderedXssSafe += frameXssSafe; // xss-safe-value
        blocksInFrames[frameId] = block;
      } else {
        renderedXssSafe += XssSafeFactory.renderableMsgBlock(this.factory, block, isOutgoing); // xss-safe-factory
      }
    }
    return { renderedXssSafe, isOutgoing, blocksInFrames }; // xss-safe-value
  };

  public isOutgoing = (senderEmail: string | undefined) => {
    return Boolean(senderEmail && this.sendAsAliases.has(senderEmail));
  };

  public processAttachment = async (
    a: Attachment,
    body: MessageBody,
    attachments: Attachment[],
    loaderContext: LoaderContextInterface,
    attachmentSel: JQueryEl | undefined,
    msgId: string, // for PGP/MIME signed messages
    messageInfo: MessageInfo,
    skipSignatureAttachment?: boolean
  ): Promise<'shown' | 'hidden' | 'replaced'> => {
    // todo - [same name + not processed].first() ... What if attachment metas are out of order compared to how gmail shows it? And have the same name?
    try {
      let treatAs = a.treatAs(attachments, !skipSignatureAttachment && Mime.isBodyEmpty(body));
      if (['needChunk', 'maybePgp', 'publicKey'].includes(treatAs)) {
        // Inspect a chunk
        if (this.debug) {
          console.debug('processAttachment() try -> awaiting chunk + awaiting type');
        }
        const data = await this.downloader.waitForAttachmentChunkDownload(a);
        const openpgpType = MsgUtil.type({ data });
        if (openpgpType && openpgpType.type === 'publicKey' && openpgpType.armored) {
          // todo: publicKey attachment can't be too big, so we could do preparePubkey() call (checking file length) right here
          treatAs = 'publicKey';
        } else if (treatAs === 'publicKey' && openpgpType?.type === 'encryptedMsg') {
          treatAs = 'encryptedFile';
        } else if (treatAs !== 'publicKey' && openpgpType && ['encryptedMsg', 'signedMsg'].includes(openpgpType.type)) {
          treatAs = 'encryptedMsg';
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
      if (treatAs === 'signature') {
        if (skipSignatureAttachment) {
          treatAs = 'plainFile';
        } else {
          // we could change 'Getting file info..' to 'Loading signed message..' in attachment_loader element
          const raw = await this.downloader.msgGetRaw(msgId);
          loaderContext.hideAttachment(attachmentSel);
          await this.setMsgBodyAndStartProcessing(loaderContext, 'signedDetached', messageInfo.printMailInfo, messageInfo.from?.email, renderModule =>
            this.processMessageWithDetachedSignatureFromRaw(raw, renderModule, messageInfo.from?.email, body)
          );
          return 'hidden'; // native attachment should be hidden, the "attachment" goes to the message container
        }
      }
      if (treatAs !== 'plainFile') {
        loaderContext.hideAttachment(attachmentSel);
      }
      if (treatAs === 'hidden') {
        return 'hidden';
      }
      if (treatAs === 'publicKey') {
        const { armoredPubkey, openpgpType } = await this.preparePubkey(a);
        if (armoredPubkey) {
          loaderContext.setMsgBody_DANGEROUSLY(this.factory.embeddedPubkey(armoredPubkey, this.isOutgoing(messageInfo.from?.email)), 'after'); // xss-safe-factory
          return 'hidden';
        } else if (openpgpType?.type === 'encryptedMsg') {
          treatAs = 'encryptedFile'; // fall back to ordinary encrypted attachment
        } else {
          loaderContext.renderPlainAttachment(a, attachmentSel, 'Unknown Public Key Format');
          return 'shown';
        }
      }
      if (treatAs === 'encryptedFile') {
        // actual encrypted attachment - show it
        loaderContext.prependEncryptedAttachment(a);
        return 'replaced'; // native should be hidden, custom should appear instead
      } else if (treatAs === 'encryptedMsg') {
        await this.setMsgBodyAndStartProcessing(loaderContext, treatAs, messageInfo.printMailInfo, messageInfo.from?.email, (renderModule, frameId) =>
          this.processCryptoMessage(a, renderModule, frameId, messageInfo.from?.email, messageInfo.isPwdMsgBasedOnMsgSnippet, messageInfo.plainSubject)
        );
        return 'hidden'; // native attachment should be hidden, the "attachment" goes to the message container
      } else if (treatAs === 'privateKey') {
        return await this.renderBackupFromFile(a, loaderContext, attachmentSel);
      } else {
        // standard file
        loaderContext.renderPlainAttachment(a, attachmentSel);
        return 'shown';
      }
    } catch (e) {
      if (ApiErr.isNetErr(e)) {
        loaderContext.renderPlainAttachment(a, attachmentSel, 'Categorize: net err');
        return 'shown';
      } else {
        Catch.reportErr(e);
        loaderContext.renderPlainAttachment(a, attachmentSel, 'Categorize: unknown err');
        return 'shown';
      }
    }
  };

  public startProcessingInlineBlocks = async (relayManager: RelayManager, factory: XssSafeFactory, messageInfo: MessageInfo, blocks: Dict<MsgBlock>) => {
    await Promise.all(
      Object.entries(blocks).map(([frameId, block]) =>
        this.relayAndStartProcessing(relayManager, factory, frameId, messageInfo.printMailInfo, messageInfo.from?.email, renderModule =>
          this.renderMsgBlock(block, renderModule, messageInfo.from?.email, messageInfo.isPwdMsgBasedOnMsgSnippet, messageInfo.plainSubject)
        )
      )
    );
  };

  public deleteExpired = (): void => {
    this.processedMessages.deleteExpired();
    this.downloader.deleteExpired();
  };

  public msgGetProcessed = async (msgId: string): Promise<ProcessedMessage> => {
    let processed = this.processedMessages.get(msgId);
    if (!processed) {
      processed = (async () => {
        return this.processFull(await this.downloader.msgGetFull(msgId));
      })();
      this.processedMessages.set(msgId, processed);
    }
    return this.processedMessages.await(msgId, processed);
  };

  private processFull = async (fullMsg: GmailRes.GmailMsg): Promise<ProcessedMessage> => {
    const { body, attachments } = MessageRenderer.getMessageBodyAndAttachments(fullMsg);
    const blocks = Mime.processBody(body);
    const isBodyEmpty = Mime.isBodyEmpty(body);
    // todo: start download of all attachments that are not plainFile, when the cache is implemented?
    // start chunk downloads for 'needChunk' attachments
    for (const a of attachments.filter(a => !a.hasData())) {
      const treatAs = a.treatAs(attachments, isBodyEmpty);
      if (treatAs === 'plainFile') continue;
      if (treatAs === 'needChunk') {
        this.downloader.queueAttachmentChunkDownload(a);
      } else if (treatAs === 'publicKey') {
        // we also want a chunk before we replace the publicKey-looking attachment in the UI
        // todo: or simply queue full attachment download?
        this.downloader.queueAttachmentChunkDownload(a);
      } else {
        // todo: queue full attachment download, when the cache is implemented?
        // note: this cache should return void or throw an exception because the data bytes are set to the Attachment object
      }
    }
    return {
      body,
      blocks,
      messageInfo: await this.getMessageInfo(fullMsg),
      attachments,
    };
  };

  private getMessageInfo = async (fullMsg: GmailRes.GmailMsg): Promise<MessageInfo> => {
    const sentDate = GmailParser.findHeader(fullMsg, 'date');
    const sentDateStr = sentDate ? Str.fromDate(new Date(sentDate)).replace(' ', ' at ') : '';
    const fromString = GmailParser.findHeader(fullMsg, 'from');
    const from = fromString ? Str.parseEmail(fromString) : undefined;
    const fromEmail = from?.email ?? '';
    const fromHtml = from?.name ? `<b>${Xss.htmlSanitize(from.name)}</b> &lt;${fromEmail}&gt;` : fromEmail;
    /* eslint-disable @typescript-eslint/no-non-null-assertion */
    const ccString = GmailParser.findHeader(fullMsg, 'cc')
      ? `Cc: <span data-test="print-cc">${Xss.escape(GmailParser.findHeader(fullMsg, 'cc')!)}</span><br/>`
      : '';
    const bccString = GmailParser.findHeader(fullMsg, 'bcc') ? `Bcc: <span>${Xss.escape(GmailParser.findHeader(fullMsg, 'bcc')!)}</span><br/>` : '';
    /* eslint-enable @typescript-eslint/no-non-null-assertion */
    const plainSubject = GmailParser.findHeader(fullMsg, 'subject');
    return {
      plainSubject,
      printMailInfo: {
        userNameAndEmail: `<b>${Xss.escape(this.fullName ?? '')}</b> &lt;${Xss.escape(this.acctEmail)}&gt;`,
        html: `
      <hr>
      <p class="subject-label" data-test="print-subject">${Xss.htmlSanitize(plainSubject ?? '')}</p>
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
      <span data-test="print-to">To: ${Xss.escape(GmailParser.findHeader(fullMsg, 'to') ?? '')}</span><br/>
      ${ccString}
      ${bccString}
      <br/><hr>
    `,
      },
      from,
      isPwdMsgBasedOnMsgSnippet: MessageRenderer.isPwdMsg(fullMsg.snippet || ''),
    };
  };

  private clipMessageIfLimitExceeds = (decryptedContent: string) => {
    const maxDecryptedContentLength = 100000;
    const base64InlineImageRegex = /<img src="data:image\/(jpeg|png|gif|bmp|tiff|webp)+;base64,[^"]+" name="(\w+\.\w+)" title="(\w+\.\w+)">/g;
    const content = decryptedContent.replace(base64InlineImageRegex, '');
    if (content.length > maxDecryptedContentLength) {
      return decryptedContent.substring(0, maxDecryptedContentLength) + ' [clipped - message too large]';
    }
    return decryptedContent;
  };

  private decideDecryptedContentFormattingAndRender = async (
    signerEmail: string | undefined,
    verificationPubs: string[],
    decryptedBytes: Uint8Array | string,
    isEncrypted: boolean,
    sigResult: VerifyRes | undefined,
    renderModule: RenderInterface,
    retryVerification: (() => Promise<VerifyRes | undefined>) | undefined,
    plainSubject: string | undefined
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
    let signedContentInDecryptedData: { rawSignedContent: string; signature: Attachment } | undefined;
    let decryptedContent: string | undefined;
    let isHtml = false;
    // todo - replace with MsgBlockParser.fmtDecryptedAsSanitizedHtmlBlocks, then the extract/strip methods could be private?
    if (!Mime.resemblesMsg(decryptedBytes)) {
      const fcAttachmentBlocks: MsgBlock[] = [];
      decryptedContent = Str.with(decryptedBytes);
      decryptedContent = MsgBlockParser.extractFcAttachments(decryptedContent, fcAttachmentBlocks);
      decryptedContent = MsgBlockParser.stripFcReplyToken(decryptedContent);
      decryptedContent = MsgBlockParser.stripPublicKeys(decryptedContent, publicKeys);
      if (fcAttachmentBlocks.length) {
        renderableAttachments = fcAttachmentBlocks.map(
          attachmentBlock => Attachment.toTransferableAttachment(attachmentBlock.attachmentMeta!) // eslint-disable-line @typescript-eslint/no-non-null-assertion
        );
      }
    } else {
      renderModule.renderText('Formatting...');
      const decoded = await Mime.decode(decryptedBytes);
      let inlineCIDAttachments = new Set<Attachment>();
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
        } else if (decoded.rawSignedContent && attachment.treatAs(decoded.attachments) === 'signature') {
          signedContentInDecryptedData = { rawSignedContent: decoded.rawSignedContent, signature: attachment };
        } else if (inlineCIDAttachments.has(attachment)) {
          // this attachment has been processed into an inline image
        } else {
          renderableAttachments.push(
            Attachment.toTransferableAttachment({
              name: attachment.name,
              type: attachment.type,
              length: attachment.getData().length,
              data: attachment.getData(),
            })
          );
        }
      }
    }
    if (!sigResult?.match && signedContentInDecryptedData) {
      const plaintext = signedContentInDecryptedData.rawSignedContent;
      const sigText = signedContentInDecryptedData.signature.getData().toUtfStr();
      const verify = (verificationPubs: string[]) => MsgUtil.verifyDetached({ plaintext, sigText, verificationPubs });
      const newSigResult = await verify(verificationPubs);
      return await this.decideDecryptedContentFormattingAndRender(
        signerEmail,
        verificationPubs,
        plaintext,
        isEncrypted,
        newSigResult,
        renderModule,
        this.getRetryVerification(signerEmail, verify),
        plainSubject
      );
    }
    decryptedContent = this.clipMessageIfLimitExceeds(decryptedContent);
    renderModule.separateQuotedContentAndRenderText(decryptedContent, isHtml);
    await MessageRenderer.renderPgpSignatureCheckResult(renderModule, sigResult, Boolean(signerEmail), retryVerification);
    if (renderableAttachments.length) {
      renderModule.renderInnerAttachments(renderableAttachments, isEncrypted);
    }
    renderModule.resizePgpBlockFrame();
    return isEncrypted ? { publicKeys } : {};
  };

  private relayAndStartProcessing = async (
    relayManager: RelayManager,
    factory: XssSafeFactory,
    frameId: string,
    printMailInfo: PrintMailInfo | undefined,
    senderEmail: string | undefined,
    cb: (renderModule: RenderInterface, frameId: string) => Promise<{ publicKeys?: string[]; needPassphrase?: string[] }>
  ): Promise<{ processor: Promise<unknown> }> => {
    const renderModule = relayManager.createRelay(frameId);
    if (printMailInfo) {
      renderModule.setPrintMailInfo(printMailInfo);
    }
    const processor = cb(renderModule, frameId)
      .then(async result => {
        const appendAfter = $(`iframe#${frameId}`); // todo: review inbox-active-thread -- may fail
        // todo: how publicKeys and needPassphrase interact?
        for (const armoredPubkey of result.publicKeys ?? []) {
          appendAfter.after(factory.embeddedPubkey(armoredPubkey, this.isOutgoing(senderEmail)));
        }
        while (result.needPassphrase && !renderModule.cancellation.cancel) {
          // if we need passphrase, we have to be able to re-try decryption indefinitely on button presses,
          // so we can only release resources when the frame is detached
          await PassphraseStore.waitUntilPassphraseChanged(this.acctEmail, result.needPassphrase, 1000, renderModule.cancellation);
          if (renderModule.cancellation.cancel) {
            if (this.debug) {
              console.debug('Destination frame was detached -- stopping processing');
            }
            return;
          }
          renderModule.clearErrorStatus();
          renderModule.renderText('Decrypting...');
          result = await cb(renderModule, frameId);
          // I guess, no additional publicKeys will appear here for display...
        }
      })
      .catch(e => {
        // normally no exceptions come to this point so let's report it
        Catch.reportErr(e);
        renderModule.renderErr(Xss.escape(String(e)), undefined);
      })
      .finally(() => relayManager.done(frameId));
    return { processor };
  };

  private renderMsgBlock = async (
    block: MsgBlock,
    renderModule: RenderInterface,
    signerEmail: string | undefined,
    isPwdMsgBasedOnMsgSnippet: boolean | undefined,
    plainSubject: string | undefined
  ) => {
    return await this.renderCryptoMessage(block.content, renderModule, true, signerEmail, isPwdMsgBasedOnMsgSnippet, plainSubject);
  };

  // todo: this should be moved to some other class?
  private getRetryVerification = (email: string | undefined, verify: (verificationPubs: string[]) => Promise<VerifyRes | undefined>) => {
    if (!email) return undefined;
    return async () => {
      const clientConfiguration = await ClientConfiguration.newInstance(this.acctEmail);
      const { pubkeys } = await new PubLookup(clientConfiguration).lookupEmail(email);
      if (pubkeys.length) {
        await saveFetchedPubkeysIfNewerThanInStorage({ email, pubkeys }); // synchronously because we don't want erratic behaviour
        return await verify(pubkeys);
      }
      return undefined;
    };
  };

  private processMessageWithDetachedSignatureFromRaw = async (
    raw: string,
    renderModule: RenderInterface,
    signerEmail: string | undefined,
    body: MessageBody
  ) => {
    // ... from PgpBlockViewDecryptModule.initialize
    const mimeMsg = Buf.fromBase64UrlStr(raw);
    const parsed = await Mime.decode(mimeMsg);
    if (!parsed || typeof parsed.rawSignedContent !== 'string') {
      renderModule.renderErr(
        'Error: could not properly parse signed message',
        parsed.rawSignedContent || parsed.text || parsed.html || mimeMsg.toUtfStr(),
        'parse error'
      );
    } else {
      const signatureAttachment = parsed.attachments.find(a => a.treatAs(parsed.attachments) === 'signature'); // todo: more than one signature candidate?
      if (signatureAttachment) {
        const parsedSignature = signatureAttachment.getData().toUtfStr();
        // ... from PgpBlockViewDecryptModule.decryptAndRender
        const sigText = parsedSignature.replace('\n=3D', '\n=');
        const plaintext = parsed.rawSignedContent;
        try {
          const verificationPubs = signerEmail ? await MessageRenderer.getVerificationPubs(signerEmail) : [];
          const verify = async (verificationPubs: string[]) => await MsgUtil.verifyDetached({ plaintext, sigText, verificationPubs });
          const signatureResult = await verify(verificationPubs);
          return await this.decideDecryptedContentFormattingAndRender(
            signerEmail,
            verificationPubs,
            plaintext,
            false,
            signatureResult,
            renderModule,
            this.getRetryVerification(signerEmail, verify),
            undefined
          );
        } catch (e) {
          // network errors shouldn't pass to this point
          // so an exception here would be an unexpected failure
          if (ApiErr.isSignificant(e)) {
            Catch.reportErr(e);
          }
          renderModule.renderErr(Xss.escape(String(e)), body.html || body.text); // instead of raw MIME, show some readable text
        }
      }
    }
    return {};
  };

  private renderCryptoMessage = async (
    encryptedData: string | Uint8Array,
    renderModule: RenderInterface,
    fallbackToPlainText: boolean,
    signerEmail: string | undefined,
    isPwdMsgBasedOnMsgSnippet: boolean | undefined,
    plainSubject: string | undefined
  ): Promise<{ publicKeys?: string[]; needPassphrase?: string[] }> => {
    const kisWithPp = await KeyStore.getAllWithOptionalPassPhrase(this.acctEmail); // todo: cache
    const verificationPubs = signerEmail ? await MessageRenderer.getVerificationPubs(signerEmail) : [];
    const decrypt = (verificationPubs: string[]) => MsgUtil.decryptMessage({ kisWithPp, encryptedData, verificationPubs });
    const result = await decrypt(verificationPubs);
    if (result.success) {
      return await this.decideDecryptedContentFormattingAndRender(
        signerEmail,
        verificationPubs,
        result.content,
        !!result.isEncrypted,
        result.signature,
        renderModule,
        this.getRetryVerification(signerEmail, verificationPubs => MessageRenderer.decryptFunctionToVerifyRes(() => decrypt(verificationPubs))),
        plainSubject
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
        renderModule.renderErr(Lang.pgpBlock.notProperlySetUp + MessageRenderer.btnHtml('FlowCrypt settings', 'green settings'), undefined);
      } else if (result.error.type === DecryptErrTypes.keyMismatch) {
        await MessageRenderer.handlePrivateKeyMismatch(
          renderModule,
          kisWithPp.map(ki => ki.public),
          encryptedData,
          isPwdMsgBasedOnMsgSnippet === true
        );
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

  private setMsgBodyAndStartProcessing = async (
    loaderContext: LoaderContextInterface,
    type: string, // for diagnostics
    printMailInfo: PrintMailInfo | undefined,
    senderEmail: string | undefined,
    cb: (renderModule: RenderInterface, frameId: string) => Promise<{ publicKeys?: string[] }>
  ): Promise<{ processor: Promise<unknown> }> => {
    const { frameId, frameXssSafe } = this.factory.embeddedMsg(type); // xss-safe-factory
    loaderContext.setMsgBody_DANGEROUSLY(frameXssSafe, 'set'); // xss-safe-value
    return await this.relayAndStartProcessing(this.relayManager, this.factory, frameId, printMailInfo, senderEmail, cb);
  };

  private processCryptoMessage = async (
    attachment: Attachment,
    renderModule: RenderInterface,
    frameId: string,
    senderEmail: string | undefined,
    isPwdMsgBasedOnMsgSnippet: boolean | undefined,
    plainSubject: string | undefined
  ) => {
    try {
      if (!attachment.hasData()) {
        // todo: implement cache similar to chunk downloads
        // note: this cache should return void or throw an exception because the data bytes are set to the Attachment object
        this.relayManager.renderProgressText(frameId, 'Retrieving message...');
        await this.gmail.fetchAttachment(attachment, expectedTransferSize => {
          return {
            frameId,
            expectedTransferSize,
            download: (percent, loaded, total) => this.relayManager.renderProgress({ frameId, percent, loaded, total, expectedTransferSize }), // shortcut
          };
        });
      }
      const armoredMsg = PgpArmor.clip(attachment.getData().toUtfStr());
      if (!armoredMsg) {
        renderModule.renderErr('Problem extracting armored message', attachment.getData().toUtfStr());
      } else {
        renderModule.renderText('Decrypting...');
        return await this.renderCryptoMessage(armoredMsg, renderModule, false, senderEmail, isPwdMsgBasedOnMsgSnippet, plainSubject);
      }
    } catch (e) {
      // todo: provide 'retry' button on isNetErr to re-fetch the attachment and continue processing?
      if (ApiErr.isSignificant(e)) Catch.reportErr(e);
      renderModule.renderErr(Xss.escape(String(e)), attachment.hasData() ? attachment.getData().toUtfStr() : undefined);
    }
    return {};
  };

  private preparePubkey = async (attachment: Attachment): Promise<{ armoredPubkey?: string; openpgpType: PgpMsgTypeResult }> => {
    await this.gmail.fetchAttachmentsMissingData([attachment]);
    const data = attachment.getData();
    const openpgpType = MsgUtil.type({ data });
    if (openpgpType?.type === 'publicKey' && openpgpType.armored) {
      // todo: do we need to armor if not openpgpType.armored?
      return { armoredPubkey: data.toUtfStr(), openpgpType };
    }
    return { openpgpType };
  };

  private renderBackupFromFile = async (
    attachment: Attachment,
    loaderContext: LoaderContextInterface,
    attachmentSel: JQueryEl | undefined
  ): Promise<'shown' | 'hidden'> => {
    try {
      await this.gmail.fetchAttachmentsMissingData([attachment]);
      loaderContext.setMsgBody_DANGEROUSLY(this.factory.embeddedBackup(attachment.getData().toUtfStr()), 'append'); // xss-safe-factory
      return 'hidden';
    } catch (e) {
      loaderContext.renderPlainAttachment(attachment, attachmentSel, 'Please reload page'); // todo: unit-test
      return 'shown';
    }
  };
}
