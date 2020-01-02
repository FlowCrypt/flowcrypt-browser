/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Buf } from '../core/buf';
import { randomBytes } from 'crypto';

export const secureRandomBytes = (length: number): Uint8Array => {
  return randomBytes(length);
};

export const base64encode = (binary: string): string => {
  return Buffer.from(binary, 'binary').toString('base64');
};

export const base64decode = (b64tr: string): string => {
  return Buffer.from(b64tr, 'base64').toString('binary');
};

export const iso2022jpToUtf = (content: Buf) => {
  throw new Error('iso2022jpToUtf not implemented on node');
};
