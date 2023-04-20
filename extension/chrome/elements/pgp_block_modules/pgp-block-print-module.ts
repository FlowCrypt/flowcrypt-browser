/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { PgpBlockView } from '../pgp_block.js';
import { Time } from '../../../js/common/browser/time.js';
import { Xss } from '../../../js/common/platform/xss.js';
import { AcctStore } from '../../../js/common/platform/store/acct-store.js';
import { GmailParser } from '../../../js/common/api/email-provider/gmail/gmail-parser.js';
import { Str } from '../../../js/common/core/common.js';

export class PgpBlockViewPrintModule {
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
}
