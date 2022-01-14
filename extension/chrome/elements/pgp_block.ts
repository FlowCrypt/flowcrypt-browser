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
import { OrgRules } from '../../js/common/org-rules.js';
import { AcctStore } from '../../js/common/platform/store/acct-store.js';
import { ContactStore } from '../../js/common/platform/store/contact-store.js';
import { KeyUtil } from '../../js/common/core/crypto/key.js';

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
  public orgRules!: OrgRules;
  public pubLookup!: PubLookup;

  public readonly attachmentsModule: PgpBlockViewAttachmentsModule;
  public readonly signatureModule: PgpBlockViewSignatureModule;
  public readonly quoteModule: PgpBlockViewQuoteModule;
  public readonly errorModule: PgpBlockViewErrorModule;
  public readonly renderModule: PgpBlockViewRenderModule;
  public readonly decryptModule: PgpBlockViewDecryptModule;

  public fesUrl?: string;

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
    //     That way, signature spoofing attacks are prevented: if Joe manages to spoof a sending address
    //     of Jane (send an email from Jane address), then we expect Jane to be this signer: we look up
    //     keys recorded for Jane and the signature either succeeds or fails to verify. If it fails (that pubkey
    //     which Joe used is not recorded for Jane), it will show an error.
    return this.senderEmail;
  };

  public render = async () => {
    const storage = await AcctStore.get(this.acctEmail, ['setup_done', 'fesUrl']);
    this.fesUrl = storage.fesUrl;
    this.orgRules = await OrgRules.newInstance(this.acctEmail);
    this.pubLookup = new PubLookup(this.orgRules);
    const scopes = await AcctStore.getScopes(this.acctEmail);
    this.decryptModule.canReadEmails = scopes.read || scopes.modify;
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
    // defined as needed, depending on what rendered
  };

}

View.run(PgpBlockView);
