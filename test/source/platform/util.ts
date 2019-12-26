/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { randomBytes } from 'crypto';
import { Buf } from '../core/buf';

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
  if (!TextDecoder) {
    throw new Error('iso2022jpToUtf not implemented on node.');
  }
  const decoder = new TextDecoder();
  return decoder.decode(content);
};
