/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { VERSION } from '../../const.js';
import { requireOpenpgp } from '../../../platform/require.js';

export const openpgp = requireOpenpgp();

if (typeof openpgp !== 'undefined') {
  // in certain environments, eg pgp_block.htm or web content script, openpgp is not included
  openpgp.config.versionString = `FlowCrypt Email Encryption ${VERSION}`;
  openpgp.config.showVersion = true;
  openpgp.config.commentString = 'Seamlessly send and receive encrypted email';
  openpgp.config.showComment = true;
  openpgp.config.allowUnauthenticatedMessages = true; // we manually check for missing MDC and show loud warning to user (no auto-decrypt)
  openpgp.config.allowInsecureDecryptionWithSigningKeys = false; // may get later over-written using ClientConfiguration for some clients
  // openpgp.config.require_uid_self_cert = false;
}
