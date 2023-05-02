/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Str, Url } from '../../js/common/core/common.js';
import { Assert } from '../../js/common/assert.js';
import { Buf } from '../../js/common/core/buf.js';
import { Gmail } from '../../js/common/api/email-provider/gmail/gmail.js';
import { Lang } from '../../js/common/lang.js';
import { PgpBlockViewDecryptModule } from './pgp_block_modules/pgp-block-decrypt-module.js';
import { PgpBlockViewSignatureModule } from './pgp_block_modules/pgp-block-signature-module.js';
import { Ui } from '../../js/common/browser/ui.js';
import { View } from '../../js/common/view.js';
import { PubLookup } from '../../js/common/api/pub-lookup.js';
import { ClientConfiguration } from '../../js/common/client-configuration.js';
import { AcctStore } from '../../js/common/platform/store/acct-store.js';
import { ContactStore } from '../../js/common/platform/store/contact-store.js';
import { KeyUtil } from '../../js/common/core/crypto/key.js';
import { PgpBaseBlockView } from './pgp_base_block_view.js';
import { GmailParser } from '../../js/common/api/email-provider/gmail/gmail-parser.js';
import { Xss } from '../../js/common/platform/xss.js';

export class PgpBlockView extends PgpBaseBlockView {
  public readonly isOutgoing: boolean;
  public readonly senderEmail: string;
  public readonly msgId: string | undefined;
  public readonly encryptedMsgUrlParam: Buf | undefined;
  public readonly signature?: {
    // when parsedSignature is undefined, decryptModule will try to fetch the message
    parsedSignature?: string;
  };

  public gmail: Gmail;
  public clientConfiguration!: ClientConfiguration;
  public pubLookup!: PubLookup;

  public readonly signatureModule: PgpBlockViewSignatureModule;
  public readonly decryptModule: PgpBlockViewDecryptModule;

  public fesUrl?: string;

  public constructor() {
    Ui.event.protect();
    const uncheckedUrlParams = Url.parse(['acctEmail', 'frameId', 'message', 'parentTabId', 'msgId', 'isOutgoing', 'senderEmail', 'signature', 'debug']);
    super(
      uncheckedUrlParams.debug === true,
      Assert.urlParamRequire.string(uncheckedUrlParams, 'parentTabId'),
      Assert.urlParamRequire.string(uncheckedUrlParams, 'frameId'),
      Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail')
    );
    this.isOutgoing = uncheckedUrlParams.isOutgoing === true;
    const senderEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'senderEmail');
    this.senderEmail = Str.parseEmail(senderEmail).email || '';
    this.msgId = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'msgId');
    if (/\.\.|\\|\//.test(decodeURI(this.msgId || ''))) {
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
    this.signatureModule = new PgpBlockViewSignatureModule(this);
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
    $('.pgp_print_button').on(
      'click',
      this.setHandler(() => this.printModule.printPGPBlock())
    );
  };

  private initPrintView = async () => {
    const fullName = await AcctStore.get(this.acctEmail, ['full_name']);
    Xss.sanitizeRender('.print_user_email', `<b>${fullName.full_name}</b> &lt;${this.acctEmail}&gt;`);
    try {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const gmailMsg = await this.gmail.msgGet(this.msgId!, 'metadata', undefined);
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
      this.printModule.printMailInfoHtml = `
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
      this.errorModule.debug(`Error while getting gmail message for ${this.msgId} message. ${e}`);
    }
  };
}

View.run(PgpBlockView);
