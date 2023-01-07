/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import type OpenPGP from 'openpgp';
import type * as Streams from '@openpgp/web-stream-tools';

export const requireOpenpgp = (): typeof OpenPGP => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('openpgp') as unknown as typeof OpenPGP;
};

export const requireStreams = (): typeof Streams => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('@openpgp/web-stream-tools') as unknown as typeof Streams;
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
