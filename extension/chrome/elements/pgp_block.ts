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
import { PgpBlockViewPwdEncryptedMsgModule } from './pgp_block_modules/pgp-block-pwd-encrypted-msg-module.js';
import { PgpBlockViewQuoteModule } from './pgp_block_modules/pgp-block-quote-module.js';
import { PgpBlockViewRenderModule } from './pgp_block_modules/pgp-block-render-module.js';
import { PgpBlockViewSignatureModule } from './pgp_block_modules/pgp-block-signature-module.js';
import { Ui } from '../../js/common/browser/ui.js';
import { View } from '../../js/common/view.js';
import { PubLookup } from '../../js/common/api/pub-lookup.js';
import { Rules } from '../../js/common/rules.js';
import { AcctStore } from '../../js/common/platform/store/acct-store.js';

export class PgpBlockView extends View {

  public readonly acctEmail: string;
  public readonly parentTabId: string;
  public readonly frameId: string;
  public readonly hasChallengePassword: boolean;
  public readonly isOutgoing: boolean;
  public readonly short: string | undefined;
  public readonly senderEmail: string;
  public readonly msgId: string | undefined;
  public readonly encryptedMsgUrlParam: Buf | undefined;
  public signature: string | boolean | undefined; // when supplied with "true", decryptModule will replace this with actual signature data

  public gmail: Gmail;
  public rules!: Rules;
  public pubLookup!: PubLookup;

  public readonly attachmentsModule: PgpBlockViewAttachmentsModule;
  public readonly signatureModule: PgpBlockViewSignatureModule;
  public readonly pwdEncryptedMsgModule: PgpBlockViewPwdEncryptedMsgModule;
  public readonly quoteModule: PgpBlockViewQuoteModule;
  public readonly errorModule: PgpBlockViewErrorModule;
  public readonly renderModule: PgpBlockViewRenderModule;
  public readonly decryptModule: PgpBlockViewDecryptModule;

  constructor() {
    super();
    Ui.event.protect();
    const uncheckedUrlParams = Url.parse(['acctEmail', 'frameId', 'message', 'parentTabId', 'msgId', 'isOutgoing', 'senderEmail', 'hasPassword', 'signature', 'short']);
    this.acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
    this.parentTabId = Assert.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');
    this.frameId = Assert.urlParamRequire.string(uncheckedUrlParams, 'frameId');
    this.hasChallengePassword = uncheckedUrlParams.hasPassword === true;
    this.isOutgoing = uncheckedUrlParams.isOutgoing === true;
    this.short = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'short');
    const senderEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'senderEmail');
    this.senderEmail = Str.parseEmail(senderEmail).email || '';
    this.msgId = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'msgId');
    this.encryptedMsgUrlParam = uncheckedUrlParams.message ? Buf.fromUtfStr(Assert.urlParamRequire.string(uncheckedUrlParams, 'message')) : undefined;
    this.signature = uncheckedUrlParams.signature === true ? true : (uncheckedUrlParams.signature ? String(uncheckedUrlParams.signature) : undefined);
    this.gmail = new Gmail(this.acctEmail);
    // modules
    this.attachmentsModule = new PgpBlockViewAttachmentsModule(this);
    this.signatureModule = new PgpBlockViewSignatureModule(this);
    this.pwdEncryptedMsgModule = new PgpBlockViewPwdEncryptedMsgModule(this);
    this.quoteModule = new PgpBlockViewQuoteModule(this);
    this.errorModule = new PgpBlockViewErrorModule(this);
    this.renderModule = new PgpBlockViewRenderModule(this);
    this.decryptModule = new PgpBlockViewDecryptModule(this);
  }

  public render = async () => {
    const storage = await AcctStore.get(this.acctEmail, ['setup_done', 'google_token_scopes']);
    this.rules = await Rules.newInstance(this.acctEmail);
    this.pubLookup = new PubLookup(this.rules);
    const scopes = await AcctStore.getScopes(this.acctEmail);
    this.decryptModule.canReadEmails = scopes.read || scopes.modify;
    if (storage.setup_done) {
      await this.decryptModule.initialize();
    } else {
      await this.errorModule.renderErr(Lang.pgpBlock.refreshWindow, this.encryptedMsgUrlParam ? this.encryptedMsgUrlParam.toUtfStr() : undefined);
    }
  }

  public setHandlers = () => {
    // defined as needed, depending on what rendered
  }

}

View.run(PgpBlockView);
