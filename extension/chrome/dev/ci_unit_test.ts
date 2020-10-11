/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { WellKnownHostMeta } from '../../js/common/api/well-known-host-meta.js';

/**
 * importing all libs that are tested in ci tests
 * add lib name below, let the IDE resolve the actual import
 */
const libs: any[] = [
  WellKnownHostMeta
];

// add them to global scope so ci can use them
console.log(`imported libs:`);
for (const lib of libs) {
  window[lib.name] = lib; // tslint:disable-line:no-unsafe-any
  console.log(lib.name); // tslint:disable-line:no-unsafe-any
}

