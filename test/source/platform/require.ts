/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../../../extension/js/common/core/types/openpgp.d.ts" />

'use strict';

export const requireOpenpgp = (): typeof OpenPGP => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('openpgp') as unknown as typeof OpenPGP;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
export const requireMimeParser = (): any => {
  // const MimeParser = (window as any)['emailjs-mime-parser']();
  // return require('../../../../../extension/lib/emailjs/emailjs-mime-parser'); // todo
  return undefined; // the above does not work, would have to import directly from npm, but we have made custom edits to the lib so not feasible now
};

export const requireMimeBuilder = (): any => {
  // const MimeBuilder = (window as any)['emailjs-mime-builder'];
  return undefined; // todo
};

export const requireIso88592 = (): any => {
  // (window as any).iso88592
  return undefined; // todo
};
/* eslint-enable @typescript-eslint/no-explicit-any */
