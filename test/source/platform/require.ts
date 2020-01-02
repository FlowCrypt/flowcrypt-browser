/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

/// <reference path="../../../extension/js/common/core/types/openpgp.d.ts" />

'use strict';

export const requireOpenpgp = (): typeof OpenPGP => {
  return require('openpgp') as any as typeof OpenPGP;
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
