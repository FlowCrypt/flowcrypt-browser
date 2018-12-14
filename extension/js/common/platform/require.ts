/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

/// <reference path="../../../types/openpgp.d.ts" />

declare const openpgp: typeof OpenPGP;

export const requireOpenpgp = (): typeof OpenPGP => {
  try {
    return openpgp;
  } catch (e) {
    // a hack for the content scripts, which may not need openpgp, until I come up with something better
    return undefined as any as typeof OpenPGP;
  }
};
