/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { base64encode, secureRandomBytes } from '../platform/util.js';

import { openpgp } from './pgp.js';

interface PwdStrengthResult {
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

  // (10k pc)*(2 core p/pc)*(4k guess p/core) httpshttps://www.abuse.ch/?p=3294://threatpost.com/how-much-does-botnet-cost-022813/77573/ https://www.abuse.ch/?p=3294
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

  public static estimateStrength = (zxcvbnResultGuesses: number, type: 'passphrase' | 'pwd' = 'passphrase'): PwdStrengthResult => {
    const timeToCrack = zxcvbnResultGuesses / PgpPwd.CRACK_GUESSES_PER_SECOND;
    for (const word of type === 'pwd' ? PgpPwd.CRACK_TIME_WORDS_PWD : PgpPwd.CRACK_TIME_WORDS_PASS_PHRASE) {
      const readableTime = PgpPwd.readableCrackTime(timeToCrack);
      if (readableTime.includes(word.match)) { // looks for a word match from readable_crack_time, defaults on "weak"
        return { word, seconds: Math.round(timeToCrack), time: readableTime };
      }
    }
    throw Error('(thrown) estimate_strength: got to end without any result');
  }

  public static weakWords = () => {
    return [
      'crypt', 'up', 'cryptup', 'flow', 'flowcrypt', 'encryption', 'pgp', 'email', 'set', 'backup', 'passphrase', 'best', 'pass', 'phrases', 'are', 'long', 'and', 'have', 'several',
      'words', 'in', 'them', 'Best pass phrases are long', 'have several words', 'in them', 'bestpassphrasesarelong', 'haveseveralwords', 'inthem',
      'Loss of this pass phrase', 'cannot be recovered', 'Note it down', 'on a paper', 'lossofthispassphrase', 'cannotberecovered', 'noteitdown', 'onapaper',
      'setpassword', 'set password', 'set pass word', 'setpassphrase', 'set pass phrase', 'set passphrase'
    ];
  }

  public static random = () => { // eg TDW6-DU5M-TANI-LJXY
    return base64encode(openpgp.util.Uint8Array_to_str(secureRandomBytes(128))).toUpperCase().replace(/[^A-Z0-9]|0|O|1/g, '').replace(/(.{4})/g, '$1-').substr(0, 19);
  }

  private static readableCrackTime = (totalSeconds: number) => { // http://stackoverflow.com/questions/8211744/convert-time-interval-given-in-seconds-into-more-human-readable-form
    const numberWordEnding = (n: number) => (n > 1) ? 's' : '';
    totalSeconds = Math.round(totalSeconds);
    const millennia = Math.round(totalSeconds / (86400 * 30 * 12 * 100 * 1000));
    if (millennia) {
      return millennia === 1 ? 'a millennium' : 'millennia';
    }
    const centuries = Math.round(totalSeconds / (86400 * 30 * 12 * 100));
    if (centuries) {
      return centuries === 1 ? 'a century' : 'centuries';
    }
    const years = Math.round(totalSeconds / (86400 * 30 * 12));
    if (years) {
      return years + ' year' + numberWordEnding(years);
    }
    const months = Math.round(totalSeconds / (86400 * 30));
    if (months) {
      return months + ' month' + numberWordEnding(months);
    }
    const weeks = Math.round(totalSeconds / (86400 * 7));
    if (weeks) {
      return weeks + ' week' + numberWordEnding(weeks);
    }
    const days = Math.round(totalSeconds / 86400);
    if (days) {
      return days + ' day' + numberWordEnding(days);
    }
    const hours = Math.round(totalSeconds / 3600);
    if (hours) {
      return hours + ' hour' + numberWordEnding(hours);
    }
    const minutes = Math.round(totalSeconds / 60);
    if (minutes) {
      return minutes + ' minute' + numberWordEnding(minutes);
    }
    const seconds = totalSeconds % 60;
    if (seconds) {
      return seconds + ' second' + numberWordEnding(seconds);
    }
    return 'less than a second';
  }
}
