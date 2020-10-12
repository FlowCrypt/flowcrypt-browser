/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Buf } from '../../js/common/core/buf.js';
import { KeyUtil } from '../../js/common/core/crypto/key.js';
import { AttUI } from '../../js/common/ui/att-ui.js';
import { ApiErr } from '../../js/common/api/shared/api-error.js';
import { WellKnownHostMeta } from '../../js/common/api/account-servers/well-known-host-meta.js';

/**
 * importing all libs that are tested in ci tests
 * add lib name below, let the IDE resolve the actual import
 */
const libs: any[] = [
  WellKnownHostMeta,
  ApiErr,
  AttUI,
  Buf,
  KeyUtil
];

// add them to global scope so ci can use them
for (const lib of libs) {
  (window as any)[(lib as any).name] = lib;
}
