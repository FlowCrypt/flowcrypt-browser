/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { VERSION } from '../../const.js';
import { requireOpenpgp, requireStreams } from '../../../platform/require.js';

export const opgp = requireOpenpgp();
export const streams = requireStreams();

if (typeof opgp !== 'undefined') { // in certain environments, eg pgp_block.htm, openpgp is not included
  opgp.config.versionString = `FlowCrypt Email Encryption ${VERSION}`;
  opgp.config.commentString = 'Seamlessly send and receive encrypted email';
  // todo: opgp.config.ignore_mdc_error = true; // we manually check for missing MDC and show loud warning to user (no auto-decrypt)
  opgp.config.allowInsecureDecryptionWithSigningKeys = false; // may get later over-written using ClientConfiguration for some clients
  // openpgp.config.require_uid_self_cert = false;
}
