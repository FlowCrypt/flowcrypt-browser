/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { VERSION } from '../../const.js';
import { requireOpenpgp } from '../../../platform/require.js';

export const opgp = requireOpenpgp();

export type OpenPGPDataType = string | Uint8Array;

if (typeof opgp !== 'undefined') {
  // in certain environments, eg pgp_block.htm or web content script, openpgp is not included
  opgp.config.versionString = `FlowCrypt Email Encryption ${VERSION}`;
  opgp.config.showVersion = true;
  opgp.config.commentString = 'Seamlessly send and receive encrypted email';
  opgp.config.showComment = true;
  opgp.config.allowUnauthenticatedMessages = true; // we manually check for missing MDC and show loud warning to user (no auto-decrypt)
  opgp.config.allowInsecureDecryptionWithSigningKeys = false; // may get later over-written using ClientConfiguration for some clients
  // Bound decompression of literal data to prevent OpenPGP decompression bombs (CWE-409/CWE-400).
  // Default is Infinity, which lets a small ciphertext allocate an arbitrary amount of memory.
  opgp.config.maxDecompressedMessageSize = 64 * 1024 * 1024; // 64 MiB
  // openpgp.config.require_uid_self_cert = false;
}
