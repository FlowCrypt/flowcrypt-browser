/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Str, Url } from '../../js/common/core/common.js';
import { Assert } from '../../js/common/assert.js';
import { Buf } from '../../js/common/core/buf.js';
import { Gmail } from '../../js/common/api/email-provider/gmail/gmail.js';
import { Lang } from '../../js/common/lang.js';
import { PgpBlockViewAttachmentsModule } from './pgp_block_modules/pgp-block-attachmens-module.js';
import { PgpBlockViewDecryptModule } from './pgp_block_modules/pgp-block-decrypt-module.js';
import { PgpBlockViewErrorModule } from './pgp_block_modules/pgp-block-error-module.js';
import { PgpBlockViewQuoteModule } from './pgp_block_modules/pgp-block-quote-module.js';
import { PgpBlockViewRenderModule } from './pgp_block_modules/pgp-block-render-module.js';
import { PgpBlockViewSignatureModule } from './pgp_block_modules/pgp-block-signature-module.js';
import { Ui } from '../../js/common/browser/ui.js';
import { View } from '../../js/common/view.js';
import { PubLookup } from '../../js/common/api/pub-lookup.js';
import { ClientConfiguration } from '../../js/common/client-configuration.js';
import { AcctStore } from '../../js/common/platform/store/acct-store.js';
import { ContactStore } from '../../js/common/platform/store/contact-store.js';
import { KeyUtil } from '../../js/common/core/crypto/key.js';
import { GmailParser } from '../../js/common/api/email-provider/gmail/gmail-parser.js';
import { Xss } from '../../js/common/platform/xss.js';

export class PgpBlockView extends View {

  public readonly acctEmail: string;
  public readonly parentTabId: string;
  public readonly frameId: string;
  public readonly isOutgoing: boolean;
  public readonly senderEmail: string;
  public readonly msgId: string | undefined;
  public readonly encryptedMsgUrlParam: Buf | undefined;
  public readonly signature?: {
    // when parsedSignature is undefined, decryptModule will try to fetch the message
    parsedSignature?: string
  };

  public gmail: Gmail;
  public clientConfiguration!: ClientConfiguration;
  public pubLookup!: PubLookup;

  public readonly attachmentsModule: PgpBlockViewAttachmentsModule;
  public readonly signatureModule: PgpBlockViewSignatureModule;
  public readonly quoteModule: PgpBlockViewQuoteModule;
  public readonly errorModule: PgpBlockViewErrorModule;
  public readonly renderModule: PgpBlockViewRenderModule;
  public readonly decryptModule: PgpBlockViewDecryptModule;

  public fesUrl?: string;

  private printMailInfoHtml!: string;

  constructor() {
    super();
    Ui.event.protect();
    const uncheckedUrlParams = Url.parse(['acctEmail', 'frameId', 'message', 'parentTabId', 'msgId', 'isOutgoing', 'senderEmail', 'signature']);
    this.acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
    this.parentTabId = Assert.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');
    this.frameId = Assert.urlParamRequire.string(uncheckedUrlParams, 'frameId');
    this.isOutgoing = uncheckedUrlParams.isOutgoing === true;
    const senderEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'senderEmail');
    this.senderEmail = Str.parseEmail(senderEmail).email || '';
    this.msgId = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'msgId');
    if (/\.\.|\\|\//.test(decodeURI(this.msgId || ""))) {
      throw new Error('API path traversal forbidden');
    }
    this.encryptedMsgUrlParam = uncheckedUrlParams.message ? Buf.fromUtfStr(Assert.urlParamRequire.string(uncheckedUrlParams, 'message')) : undefined;
    if (uncheckedUrlParams.signature === true) {
      this.signature = { parsedSignature: undefined }; // decryptModule will try to fetch the message
    } else if (uncheckedUrlParams.signature) {
      this.signature = { parsedSignature: String(uncheckedUrlParams.signature) };
    }
    this.gmail = new Gmail(this.acctEmail);
    // modules
    this.attachmentsModule = new PgpBlockViewAttachmentsModule(this);
    this.signatureModule = new PgpBlockViewSignatureModule(this);
    this.quoteModule = new PgpBlockViewQuoteModule(this);
    this.errorModule = new PgpBlockViewErrorModule(this);
    this.renderModule = new PgpBlockViewRenderModule(this);
    this.decryptModule = new PgpBlockViewDecryptModule(this);
  }

  public getExpectedSignerEmail = () => {
    // We always attempt to verify all signatures as "signed by sender", with public keys of the sender.
    // That way, signature spoofing attacks are prevented: if Joe manages to spoof a sending address
    // of Jane (send an email from Jane address), then we expect Jane to be this signer: we look up
    // keys recorded for Jane and the signature either succeeds or fails to verify.
    // If it fails (that pubkey which Joe used is not recorded for Jane), it will show an error.
    return this.senderEmail;
  };

  public render = async () => {
    const storage = await AcctStore.get(this.acctEmail, ['setup_done', 'fesUrl']);
    this.fesUrl = storage.fesUrl;
    this.clientConfiguration = await ClientConfiguration.newInstance(this.acctEmail);
    this.pubLookup = new PubLookup(this.clientConfiguration);
    const scopes = await AcctStore.getScopes(this.acctEmail);
    this.decryptModule.canReadEmails = scopes.modify;
    await this.initPrintView();
    if (storage.setup_done) {
      const parsedPubs = (await ContactStore.getOneWithAllPubkeys(undefined, this.getExpectedSignerEmail()))?.sortedPubkeys ?? [];
      // todo: we don't actually need parsed pubs here because we're going to pass them to the backgorund page
      // maybe we can have a method in ContactStore to extract armored keys
      const verificationPubs = parsedPubs.map(key => KeyUtil.armor(key.pubkey));
      await this.decryptModule.initialize(verificationPubs, false);
    } else {
      await this.errorModule.renderErr(Lang.pgpBlock.refreshWindow, this.encryptedMsgUrlParam ? this.encryptedMsgUrlParam.toUtfStr() : undefined);
    }
  };

  public setHandlers = () => {
    $('.pgp_print_button').click(this.setHandler(() => this.printPGPBlock()));
  };

  private initPrintView = async () => {
    const fullName = await AcctStore.get(this.acctEmail, ['full_name']);
    $('.print_user_email').html(`<b>${fullName.full_name}</b> &lt;${this.acctEmail}&gt;`); // xss-escaped
    const gmailMsg = await this.gmail.msgGet(this.msgId!, 'full', undefined);
    const sentDate = new Date(GmailParser.findHeader(gmailMsg, 'date') ?? '');
    const sentDateStr = Str.fromDate(sentDate).replace(' ', ' at ');
    const from = Str.parseEmail(GmailParser.findHeader(gmailMsg, 'from') ?? '');
    const fromHtml = from.name ? `<b>${from.name}</b> &lt;${from.email}&gt;` : from.email;
    const ccString = GmailParser.findHeader(gmailMsg, 'cc') ? `Cc: <span>${Xss.escape(GmailParser.findHeader(gmailMsg, 'cc')!)}</span><br/>` : '';
    const bccString = GmailParser.findHeader(gmailMsg, 'bcc') ? `Bcc: <span>${Xss.escape(GmailParser.findHeader(gmailMsg, 'bcc')!)}</span><br/>` : '';
    this.printMailInfoHtml = `
      <hr>
      <p class="subject-label">${GmailParser.findHeader(gmailMsg, 'subject')}</p>
      <hr>
      <br/>
      <div>
        <div class="inline-block">
          <span>From: ${fromHtml}</span>
        </div>
        <div class="float-right">
          <span>${sentDateStr}</span>
        </div>
      </div>
      <span>To: ${Xss.escape(GmailParser.findHeader(gmailMsg, 'to') ?? '')}</span><br/>
      ${ccString}
      ${bccString}
      <br/><hr>
    `;
  };

  private printPGPBlock = async () => {
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
      <body>
        ${$('#print-header').html()}
        <br>
        ${this.printMailInfoHtml}
        <br>
        ${$("#pgp_block").html()}
      </body>
      </html>
    `;
    w!.document.write(html);
    // Give some time for above dom to load in print dialog
    // https://stackoverflow.com/questions/31725373/google-chrome-not-showing-image-in-print-preview
    setTimeout(() => {
      w!.window.print();
      w!.document.close();
    }, 250);
  };

}

View.run(PgpBlockView);
