/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { VerifyRes } from '../../../js/common/core/crypto/pgp/msg-util.js';
import { Attachment } from '../../../js/common/core/attachment.js';
import { BrowserMsg } from '../../../js/common/browser/browser-msg.js';
import { Catch } from '../../../js/common/platform/catch.js';
import { Mime } from '../../../js/common/core/mime.js';
import { MsgBlock } from '../../../js/common/core/msg-block.js';
import { PgpBlockView } from '../pgp_block.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { Xss } from '../../../js/common/platform/xss.js';
import { MsgBlockParser } from '../../../js/common/core/msg-block-parser.js';
import { AcctStore } from '../../../js/common/platform/store/acct-store.js';
import { GmailParser } from '../../../js/common/api/email-provider/gmail/gmail-parser.js';
import { CID_PATTERN, Str } from '../../../js/common/core/common.js';
import DOMPurify from 'dompurify';
import { Time } from '../../../js/common/browser/time.js';

export class PgpBlockViewRenderModule {
  public doNotSetStateAsReadyYet = false;

  private heightHist: number[] = [];
  private printMailInfoHtml!: string;

  public constructor(private view: PgpBlockView) {}

  public initPrintView = async () => {
    const fullName = await AcctStore.get(this.view.acctEmail, ['full_name']);
    Xss.sanitizeRender('.print_user_email', `<b>${fullName.full_name}</b> &lt;${this.view.acctEmail}&gt;`);
    try {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const gmailMsg = await this.view.gmail.msgGet(this.view.msgId!, 'metadata', undefined);
      const sentDate = new Date(GmailParser.findHeader(gmailMsg, 'date') ?? '');
      const sentDateStr = Str.fromDate(sentDate).replace(' ', ' at ');
      const from = Str.parseEmail(GmailParser.findHeader(gmailMsg, 'from') ?? '');
      const fromHtml = from.name ? `<b>${Xss.htmlSanitize(from.name)}</b> &lt;${from.email}&gt;` : from.email;
      /* eslint-disable @typescript-eslint/no-non-null-assertion */
      const ccString = GmailParser.findHeader(gmailMsg, 'cc')
        ? `Cc: <span data-test="print-cc">${Xss.escape(GmailParser.findHeader(gmailMsg, 'cc')!)}</span><br/>`
        : '';
      const bccString = GmailParser.findHeader(gmailMsg, 'bcc') ? `Bcc: <span>${Xss.escape(GmailParser.findHeader(gmailMsg, 'bcc')!)}</span><br/>` : '';
      /* eslint-enable @typescript-eslint/no-non-null-assertion */
      this.printMailInfoHtml = `
      <hr>
      <p class="subject-label" data-test="print-subject">${Xss.htmlSanitize(GmailParser.findHeader(gmailMsg, 'subject') ?? '')}</p>
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
      <span data-test="print-to">To: ${Xss.escape(GmailParser.findHeader(gmailMsg, 'to') ?? '')}</span><br/>
      ${ccString}
      ${bccString}
      <br/><hr>
    `;
    } catch (e) {
      this.view.errorModule.debug(`Error while getting gmail message for ${this.view.msgId} message. ${e}`);
    }
  };

  public printPGPBlock = async () => {
    const w = window.open();
    const html = `
      <!DOCTYPE html>
      <html lang="en-us">
      <head>
        <style>
          #action_show_quoted_content {
            display: none;
          }
          .print_header_info {
            color: #777777;
            font-weight: bold;
            -webkit-print-color-adjust: exact;
          }
          .print_encrypted_with_label {
            display: table-cell;
            vertical-align: middle;
            padding-right: 5px;
          }
          .subject-label {
            font-weight: bold;
            font-size: 20px;
          }
          .inline-block {
            display: inline-block;
          }
          .display-table {
            display: table;
          }
          .float-right {
            float: right;
          }
          .quoted_content {
            display: none;
          }
          #attachments a.preview-attachment {
            display: inline-flex;
            color: #333 !important;
            align-items: center;
            height: 36px;
            background: #f8f8f8;
            border: 1px solid #ccc;
            border-left: 4px solid #31a217 !important;
            font-family: inherit;
            font-size: inherit;
            margin-bottom: 8px;
            cursor: pointer;
            margin-right: 12px;
            padding: 0 8px;
            text-decoration: none;
          }
          #attachments a.preview-attachment .download-attachment {
            display: none;
          }
        </style>
      </head>
      <body data-test-view-state="loaded">
        ${$('#print-header').html()}
        <br>
        ${Xss.htmlSanitize(this.printMailInfoHtml)}
        <br>
        <div data-test="print-content">
          ${Xss.htmlSanitize($('#pgp_block').html())}
        </div>
      </body>
      </html>
    `;
    w?.document.write(html);
    // Give some time for above dom to load in print dialog
    // https://stackoverflow.com/questions/31725373/google-chrome-not-showing-image-in-print-preview
    await Time.sleep(250);
    w?.window.print();
    w?.document.close();
  };

  public renderText = (text: string) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    document.getElementById('pgp_block')!.innerText = text;
  };

  public resizePgpBlockFrame = () => {
    const origHeight = $('#pgp_block').height();
    if (!origHeight) {
      // https://github.com/FlowCrypt/flowcrypt-browser/issues/3519
      // unsure why this happens. Sometimes height will come in as exactly 0 after the iframe was already properly sized
      // that then causes to default to 20 + 40 = 60px for height, hiding contents of the message if it in fact is taller
      return;
    }
    let height = Math.max(origHeight, 20) + 40 + 17 + 3 + 13; // pgp_badge has 17px height + 3px padding + 1em (13px) bottom margin
    this.heightHist.push(height);
    const len = this.heightHist.length;
    if (
      len >= 4 &&
      this.heightHist[len - 1] === this.heightHist[len - 3] &&
      this.heightHist[len - 2] === this.heightHist[len - 4] &&
      this.heightHist[len - 1] !== this.heightHist[len - 2]
    ) {
      console.info('pgp_block.js: repetitive resize loop prevented'); // got repetitive, eg [70, 80, 200, 250, 200, 250]
      height = Math.max(this.heightHist[len - 1], this.heightHist[len - 2]); // pick the larger number to stop if from oscillating
    }
    BrowserMsg.send.setCss(this.view.parentTabId, {
      selector: `iframe#${this.view.frameId}`,
      css: { height: `${height}px` },
    });
  };

  public renderContent = async (htmlContent: string, isErr: boolean) => {
    if (!isErr && !this.view.isOutgoing) {
      // successfully opened incoming message
      // eslint-disable-next-line @typescript-eslint/naming-convention
      await AcctStore.set(this.view.acctEmail, { successfully_received_at_leat_one_message: true });
    }
    if (!isErr) {
      // rendering message content
      $('.pgp_print_button').show();
      $('#pgp_block').html(Xss.htmlSanitizeKeepBasicTags(htmlContent)); // xss-sanitized
      Xss.appendRemoteImagesToContainer();
      $('#pgp_block .remote_image_container img').on(
        'load',
        this.view.setHandler(() => this.resizePgpBlockFrame())
      );
    } else {
      // rendering our own ui
      Xss.sanitizeRender('#pgp_block', htmlContent);
    }
    if (isErr) {
      $('.action_show_raw_pgp_block').on(
        'click',
        this.view.setHandler(target => {
          $('.raw_pgp_block').css('display', 'block');
          $(target).css('display', 'none');
          this.resizePgpBlockFrame();
        })
      );
    }
    this.resizePgpBlockFrame(); // resize window now
    Catch.setHandledTimeout(() => {
      $(window).resize(this.view.setHandlerPrevent('spree', () => this.resizePgpBlockFrame()));
    }, 1000); // start auto-resizing the window after 1s
  };

  public setFrameColor = (color: 'red' | 'green' | 'gray') => {
    if (color === 'red') {
      $('#pgp_background').removeClass('pgp_secure').removeClass('pgp_neutral').addClass('pgp_insecure');
    } else if (color === 'green') {
      $('#pgp_background').removeClass('pgp_neutral').removeClass('pgp_insecure').addClass('pgp_secure');
    } else {
      $('#pgp_background').removeClass('pgp_secure').removeClass('pgp_insecure').addClass('pgp_neutral');
    }
  };

  public renderAsRegularContent = async (content: string) => {
    this.setFrameColor('gray');
    this.renderSignatureStatus('not signed');
    this.renderEncryptionStatus('not encrypted');
    await this.renderContent(content, false);
  };

  public renderErrorStatus = (status: string): JQuery<HTMLElement> => {
    return $('#pgp_error').text(status).show();
  };

  public clearErrorStatus = (): JQuery<HTMLElement> => {
    return $('#pgp_error').hide();
  };

  public renderEncryptionStatus = (status: string): JQuery<HTMLElement> => {
    return $('#pgp_encryption')
      .addClass(status === 'encrypted' ? 'green_label' : 'red_label')
      .text(status);
  };

  public renderSignatureStatus = (status: string): JQuery<HTMLElement> => {
    return $('#pgp_signature')
      .addClass(status === 'signed' ? 'green_label' : 'red_label')
      .text(status);
  };

  public decideDecryptedContentFormattingAndRender = async (
    decryptedBytes: Uint8Array | string,
    isEncrypted: boolean,
    sigResult: VerifyRes | undefined,
    verificationPubs: string[],
    retryVerification: (verificationPubs: string[]) => Promise<VerifyRes | undefined>,
    plainSubject?: string
  ) => {
    if (isEncrypted) {
      this.renderEncryptionStatus('encrypted');
      this.setFrameColor('green');
    } else {
      this.renderEncryptionStatus('not encrypted');
      this.setFrameColor('gray');
    }
    const publicKeys: string[] = [];
    let renderableAttachments: Attachment[] = [];
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
          attachmentBlock => new Attachment(attachmentBlock.attachmentMeta!) // eslint-disable-line @typescript-eslint/no-non-null-assertion
        );
      }
    } else {
      this.renderText('Formatting...');
      const decoded = await Mime.decode(decryptedBytes);
      let inlineCIDAttachments: Attachment[] = [];
      if (typeof decoded.html !== 'undefined') {
        ({ sanitizedHtml: decryptedContent, inlineCIDAttachments } = this.replaceInlineImageCIDs(decoded.html, decoded.attachments));
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
        decryptedContent = this.getEncryptedSubjectText(decoded.subject, isHtml) + decryptedContent; // render encrypted subject in message
      }
      for (const attachment of decoded.attachments) {
        if (attachment.isPublicKey()) {
          publicKeys.push(attachment.getData().toUtfStr());
        } else if (!inlineCIDAttachments.some(inlineAttachment => inlineAttachment.cid === attachment.cid)) {
          renderableAttachments.push(attachment);
        }
      }
    }
    await this.view.quoteModule.separateQuotedContentAndRenderText(decryptedContent, isHtml);
    await this.view.signatureModule.renderPgpSignatureCheckResult(sigResult, verificationPubs, retryVerification);
    if (isEncrypted && publicKeys.length) {
      BrowserMsg.send.renderPublicKeys(this.view.parentTabId, { afterFrameId: this.view.frameId, publicKeys });
    }
    if (renderableAttachments.length) {
      this.view.attachmentsModule.renderInnerAttachments(renderableAttachments, isEncrypted);
    }
    this.resizePgpBlockFrame();
    if (!this.doNotSetStateAsReadyYet) {
      // in case async tasks are still being worked at
      Ui.setTestState('ready');
    }
  };

  /**
   * Replaces inline image CID references with base64 encoded data in sanitized HTML
   * and returns the sanitized HTML along with the inline CID attachments.
   *
   * @param html - The original HTML content.
   * @param attachments - An array of email attachments.
   * @returns An object containing sanitized HTML and an array of inline CID attachments.
   */
  private replaceInlineImageCIDs = (html: string, attachments: Attachment[]): { sanitizedHtml: string; inlineCIDAttachments: Attachment[] } => {
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

  private getEncryptedSubjectText = (subject: string, isHtml: boolean) => {
    if (isHtml) {
      return `<div style="white-space: normal"> Encrypted Subject:
                <b> ${Xss.escape(subject)}</b>
              </div>
              <hr/>`;
    } else {
      return `Encrypted Subject: ${subject}\n----------------------------------------------------------------------------------------------------\n`;
    }
  };
}
