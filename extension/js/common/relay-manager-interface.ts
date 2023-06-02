/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { RenderMessage } from './render-message.js';

export interface RelayManagerInterface {
  relay(frameId: string, message: RenderMessage, dontEnqueue?: boolean): void;
}
