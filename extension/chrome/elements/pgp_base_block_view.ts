/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { View } from '../../js/common/view.js';
import { PgpBlockViewAttachmentsModule } from './pgp_block_modules/pgp-block-attachmens-module.js';
import { PgpBlockViewQuoteModule } from './pgp_block_modules/pgp-block-quote-module.js';
import { PgpBlockViewRenderModule } from './pgp_block_modules/pgp-block-render-module.js';

export abstract class PgpBaseBlockView extends View {
  public readonly quoteModule: PgpBlockViewQuoteModule;
  public readonly renderModule: PgpBlockViewRenderModule;
  public readonly attachmentsModule: PgpBlockViewAttachmentsModule;

  public constructor(
    public readonly parentTabId: string,
    public readonly frameId: string,
    public readonly acctEmail: string // needed for attachment decryption, probably should be refactored out
  ) {
    super();
    this.quoteModule = new PgpBlockViewQuoteModule(this);
    this.renderModule = new PgpBlockViewRenderModule(this);
    this.attachmentsModule = new PgpBlockViewAttachmentsModule(this);
  }
}
