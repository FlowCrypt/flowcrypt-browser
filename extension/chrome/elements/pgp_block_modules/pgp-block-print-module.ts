/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Time } from '../../../js/common/browser/time.js';
import { Catch } from '../../../js/common/platform/catch.js';
import { Xss } from '../../../js/common/platform/xss.js';

export class PgpBlockViewPrintModule {
  public printMailInfoHtml: string | undefined;

  public printPGPBlock = async () => {
    if (!this.printMailInfoHtml) {
      Catch.reportErr('printMailInfoHtml not prepared!');
      return;
    }
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
