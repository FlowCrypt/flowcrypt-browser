/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Pgp, openpgp } from './pgp.js';
import { base64encode, secureRandomBytes } from '../platform/util.js';

interface PasswordStrengthResult {
  word: {
    match: string;
    word: string;
    bar: number;
    color: string;
    pass: boolean;
  };
  seconds: number;
  time: string;
}

export class PgpPwd {
  private static CRACK_GUESSES_PER_SECOND = 10000 * 2 * 4000;
  private static CRACK_TIME_WORDS_PWD = [ // the requirements for a one-time password are less strict
    { match: 'millenni', word: 'perfect', bar: 100, color: 'green', pass: true },
    { match: 'centu', word: 'perfect', bar: 95, color: 'green', pass: true },
    { match: 'year', word: 'great', bar: 80, color: 'orange', pass: true },
    { match: 'month', word: 'good', bar: 70, color: 'darkorange', pass: true },
    { match: 'week', word: 'good', bar: 30, color: 'darkred', pass: true },
    { match: 'day', word: 'reasonable', bar: 40, color: 'darkorange', pass: true },
    { match: 'hour', word: 'bare minimum', bar: 20, color: 'darkred', pass: true },
    { match: 'minute', word: 'poor', bar: 15, color: 'red', pass: false },
    { match: '', word: 'weak', bar: 10, color: 'red', pass: false },
  ];
  private static CRACK_TIME_WORDS_PASS_PHRASE = [ // the requirements for a pass phrase are meant to be strict
    { match: 'millenni', word: 'perfect', bar: 100, color: 'green', pass: true },
    { match: 'centu', word: 'great', bar: 80, color: 'green', pass: true },
    { match: 'year', word: 'good', bar: 60, color: 'orange', pass: true },
    { match: 'month', word: 'reasonable', bar: 40, color: 'darkorange', pass: true },
    { match: 'week', word: 'poor', bar: 30, color: 'darkred', pass: false },
    { match: 'day', word: 'poor', bar: 20, color: 'darkred', pass: false },
    { match: '', word: 'weak', bar: 10, color: 'red', pass: false },
  ];

  static estimateStrength = (zxcvbnResultGuesses: number, type: 'passphrase' | 'pwd' = 'passphrase'): PasswordStrengthResult => {
    const timeToCrack = zxcvbnResultGuesses / PgpPwd.CRACK_GUESSES_PER_SECOND;
    for (const word of type === 'pwd' ? PgpPwd.CRACK_TIME_WORDS_PWD : PgpPwd.CRACK_TIME_WORDS_PASS_PHRASE) {
      const readableTime = Pgp.internal.readableCrackTime(timeToCrack);
      if (readableTime.includes(word.match)) { // looks for a word match from readable_crack_time, defaults on "weak"
        return { word, seconds: Math.round(timeToCrack), time: readableTime };
      }
    }
    throw Error('(thrown) estimate_strength: got to end without any result');
  }

  static weakWords = () => [
    'crypt', 'up', 'cryptup', 'flow', 'flowcrypt', 'encryption', 'pgp', 'email', 'set', 'backup', 'passphrase', 'best', 'pass', 'phrases', 'are', 'long', 'and', 'have', 'several',
    'words', 'in', 'them', 'Best pass phrases are long', 'have several words', 'in them', 'bestpassphrasesarelong', 'haveseveralwords', 'inthem',
    'Loss of this pass phrase', 'cannot be recovered', 'Note it down', 'on a paper', 'lossofthispassphrase', 'cannotberecovered', 'noteitdown', 'onapaper',
    'setpassword', 'set password', 'set pass word', 'setpassphrase', 'set pass phrase', 'set passphrase'
  ]

  static random = () => { // eg TDW6-DU5M-TANI-LJXY
    return base64encode(openpgp.util.Uint8Array_to_str(secureRandomBytes(128))).toUpperCase().replace(/[^A-Z0-9]|0|O|1/g, '').replace(/(.{4})/g, '$1-').substr(0, 19);
  }
}
