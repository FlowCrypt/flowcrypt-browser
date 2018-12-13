
/// <reference path="../../../types/openpgp.d.ts" />

declare const openpgp: typeof OpenPGP;

export const requireOpenpgp = (): typeof OpenPGP => {
  return openpgp;
};
