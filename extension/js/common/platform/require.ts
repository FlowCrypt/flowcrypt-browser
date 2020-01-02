/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

/// <reference path="../core/types/openpgp.d.ts" />

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

declare const openpgp: typeof OpenPGP;

type Codec = { encode: (text: string, mode: 'fatal' | 'html') => string, decode: (text: string) => string, labels: string[], version: string };

export const requireOpenpgp = (): typeof OpenPGP => {
  try {
    openpgp.config.versionstring = `FlowCrypt Gmail Encryption`;
    openpgp.config.commentstring = 'Seamlessly send and receive encrypted email';
    // openpgp.config.require_uid_self_cert = false;
    return openpgp;
  } catch (e) {
    // a hack for content scripts, which do not currently need openpgp, until we come up with something better
    return undefined as any as typeof OpenPGP;
  }
};

export const requireMimeParser = (): typeof MimeParser => {
  return (window as any)['emailjs-mime-parser']; // tslint:disable-line:no-unsafe-any
};

export const requireMimeBuilder = (): any => {
  return (window as any)['emailjs-mime-builder'];
};

export const requireIso88592 = (): Codec => {
  return (window as any).iso88592 as Codec;
};
