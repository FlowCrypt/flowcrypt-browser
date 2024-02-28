/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch } from '../platform/catch.js';

export class Time {
  public static wait = (untilThisFunctionEvalsTrue: () => boolean | undefined): Promise<void> =>
    new Promise((success, error) => {
      const interval = Catch.setHandledInterval(() => {
        const result = untilThisFunctionEvalsTrue();
        if (result === true) {
          clearInterval(interval);
          if (success) {
            success();
          }
        } else if (result === false) {
          clearInterval(interval);
          if (error) {
            error();
          }
        }
      }, 50);
    });
  public static sleep = (ms: number, setCustomTimeout: (code: () => void, t: number) => void = Catch.setHandledTimeout): Promise<void> => {
    return new Promise(resolve => setCustomTimeout(resolve, ms));
  };
}
