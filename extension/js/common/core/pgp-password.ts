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
  static estimateStrength = (zxcvbnResultGuesses: number, type: 'passphrase' | 'pwd' = 'passphrase'): PasswordStrengthResult => {
    const timeToCrack = zxcvbnResultGuesses / Pgp.CRACK_GUESSES_PER_SECOND;
    for (const word of type === 'pwd' ? Pgp.CRACK_TIME_WORDS_PWD : Pgp.CRACK_TIME_WORDS_PASS_PHRASE) {
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
