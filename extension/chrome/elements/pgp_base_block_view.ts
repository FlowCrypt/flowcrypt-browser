/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { View } from '../../js/common/view.js';
import { PgpBlockViewQuoteModule } from './pgp_block_modules/pgp-block-quote-module.js';
import { PgpBlockViewRenderModule } from './pgp_block_modules/pgp-block-render-module.js';

export abstract class PgpBaseBlockView extends View {
  public readonly quoteModule: PgpBlockViewQuoteModule;
  public readonly renderModule: PgpBlockViewRenderModule;

  public constructor(public readonly parentTabId: string, public readonly frameId: string) {
    super();
    this.quoteModule = new PgpBlockViewQuoteModule(this);
    this.renderModule = new PgpBlockViewRenderModule(this);
  }
}
