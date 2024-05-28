/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

// todo - a few things are duplicated here, refactor

import { Catch } from '../../common/platform/catch.js';
import { GmailWebmailStartup } from './gmail/gmail-webmail-startup.js';

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    gbar_: any;
  }
}

Catch.try(async () => {
  // when we support more webmails, there will be if/else here to figure out which one to run
  // in which case each *WebmailStartup function should go into its own file
  await new GmailWebmailStartup().asyncConstructor();
})();
