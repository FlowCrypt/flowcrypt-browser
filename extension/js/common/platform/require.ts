/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

/**
 * If you are here to add a dependency to the project, you may be at a wrong place. But since you are here..
 *
 * This file is here because we reuse common/core in different environments: the web, chrome extension and Node.js
 *
 * External libraries in JS tend to have a thousand ways to import them, and they may expect to be imported differently in each environment.
 *
 * _IF_ you are adding a dependency that we use across environments, _AND_ such dependency expects to be imported differently in each, _THEN_ this may be the right place to put it.
 *
 * In such case you should ping @tomholub for guidance.
 *
 * For all other imports:
 *  - see tsconfig.json and mimic the style, including the COMMENT flag
 *  - add type definitions from node_modules/xxx/xxx.d.ts to extension/types/ and check it into git
 *  - add dest js dep file into extension/lib and check it into git
 *  - import in .ts files by using: import { Dep } from 'depname'; // this is only used in ts, import will be commented out during build, and that's why you must:
 *  - add < script > tags to appropriate .htm files pointing to the js using ABSOLUTE path, unless this dep can be imported as es6 module tag, in which case use RELATIVE path
 */

import { MimeParser } from '../core/types/emailjs.js';
import type * as OpenPGP from 'openpgp';
import { Catch } from './catch.js';

type Codec = {
  encode: (text: string, mode: 'fatal' | 'html') => string;
  decode: (text: string) => string;
  labels: string[];
  version: string;
};

export const requireOpenpgp = (): typeof OpenPGP => {
  if (window !== globalThis && Catch.browser().name === 'firefox') {
    // fix Firefox sandbox permission issues as per convo https://github.com/FlowCrypt/flowcrypt-browser/pull/5013#discussion_r1148343995
    window.Uint8Array.prototype.subarray = function (...args) {
      return new Uint8Array(this).subarray(...args);
    };
    window.Uint8Array.prototype.slice = function (...args) {
      return new Uint8Array(this).slice(...args);
    };
  }
  return (globalThis as unknown as { openpgp: typeof OpenPGP }).openpgp;
};

export const requireMimeParser = (): typeof MimeParser => {
  return (globalThis as any)['emailjs-mime-parser']; // eslint-disable-line
};

export const requireMimeBuilder = () => {
  return (globalThis as any)['emailjs-mime-builder']; // eslint-disable-line
};

export const requireIso88592 = (): Codec => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (globalThis as any).iso88592 as Codec;
};
