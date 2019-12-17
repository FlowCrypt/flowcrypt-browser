/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { InboxView } from '../inbox.js';

export abstract class InboxModule {
  protected view: InboxView;

  constructor(inboxView: InboxView) {
    this.view = inboxView;
  }
}
