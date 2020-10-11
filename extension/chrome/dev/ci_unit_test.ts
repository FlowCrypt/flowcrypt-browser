/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { ApiErr } from '../../js/common/api/error/api-error.js';
import { WellKnownHostMeta } from '../../js/common/api/well-known-host-meta.js';

/**
 * importing all libs that are tested in ci tests
 * add lib name below, let the IDE resolve the actual import
 */
const libs: any[] = [
  WellKnownHostMeta,
  ApiErr
];

// add them to global scope so ci can use them
for (const lib of libs) {
  (window as any)[(lib as any).name] = lib;
}
