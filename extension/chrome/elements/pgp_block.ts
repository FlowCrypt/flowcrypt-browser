/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store } from '../../js/common/platform/store.js';
import { Str, Url } from '../../js/common/core/common.js';
import { Ui } from '../../js/common/browser/ui.js';
import { Lang } from '../../js/common/lang.js';
import { Buf } from '../../js/common/core/buf.js';
import { Assert } from '../../js/common/assert.js';
import { View } from '../../js/common/view.js';
import { PgpBlockViewAttachmentsModule } from './pgp_block_modules/pgp_block_attachmens_module.js';
import { PgpBlockViewSignatureModule } from './pgp_block_modules/pgp_block_signature_module.js';
import { PgpBlockViewPwdEncryptedMsgModule } from './pgp_block_modules/pgp_block_pwd_encrypted_msg_module.js';
import { PgpBlockViewQuoteModule } from './pgp_block_modules/pgp_block_quote_module.js';
import { PgpBlockViewErrorModule } from './pgp_block_modules/pgp_block_error_module.js';
import { PgpBlockViewRenderModule } from './pgp_block_modules/pgp_block_render_module.js';
import { PgpBlockViewDecryptModule } from './pgp_block_modules/pgp_block_decrypt_module.js';
import { Gmail } from '../../js/common/api/email_provider/gmail/gmail.js';

export class PgpBlockView extends View {

  public readonly acctEmail: string;
  public readonly parentTabId: string;
  public readonly frameId: string;
  public readonly hasChallengePassword: boolean;
  public readonly isOutgoing: boolean;
  public readonly short: string | undefined;
  public readonly senderEmail: string | undefined;
  public readonly msgId: string | undefined;
  public readonly encryptedMsgUrlParam: Buf | undefined;
  public signature: string | boolean | undefined; // when supplied with "true", decryptModule will replace this with actual signature data

  public gmail: Gmail;

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
    this.senderEmail = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'senderEmail');
    this.senderEmail = this.senderEmail ? Str.parseEmail(this.senderEmail).email : undefined;
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
    const storage = await Store.getAcct(this.acctEmail, ['setup_done', 'google_token_scopes']);
    const scopes = await Store.getScopes(this.acctEmail);
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
