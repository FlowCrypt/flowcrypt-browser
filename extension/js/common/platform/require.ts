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

export const requireMimeParser = (): any => {
  // const MimeParser = (window as any)['emailjs-mime-parser'](); // tslint:disable-line:no-unsafe-any
  return undefined; // todo
};

export const requireMimeBuilder = (): any => {
  // const MimeBuilder = (window as any)['emailjs-mime-builder']; // tslint:disable-line:variable-name
  return undefined; // todo
};

export const requireIso88592 = (): any => {
  // (window as any).iso88592
  return undefined; // todo
};
