/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import type OpenPGP from 'openpgp';
import type * as Streams from '@openpgp/web-stream-tools';

export const requireOpenpgp = (): typeof OpenPGP => {
  return require('openpgp') as unknown as typeof OpenPGP;
};

export const requireStreams = (): typeof Streams => {
  return require('@openpgp/web-stream-tools');
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const requireMimeParser = (): any => {
  // const MimeParser = (window as any)['emailjs-mime-parser'](); // tslint:disable-line:no-unsafe-any
  // return require('../../../../../extension/lib/emailjs/emailjs-mime-parser'); // todo
  return undefined; // the above does not work, would have to import directly from npm, but we have made custom edits to the lib so not feasible now
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const requireMimeBuilder = (): any => {
  // const MimeBuilder = (window as any)['emailjs-mime-builder']; // tslint:disable-line:variable-name
  return undefined; // todo
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const requireIso88592 = (): any => {
  // (window as any).iso88592
  return undefined; // todo
};
