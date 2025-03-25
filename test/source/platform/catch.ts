/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

const VERSION = 'B.1.0';

export type ObjWithStack = { stack: string };
export class UnreportableError extends Error {}

export class Catch {
  public static RUNTIME_VERSION = VERSION;
  public static RUNTIME_ENVIRONMENT = 'undetermined';

  /* eslint-disable @typescript-eslint/no-unused-vars*/
  public static handleErr = (e: unknown) => {
    // core errs that are not rethrown are not very interesting
  };

  public static reportErr = (err: unknown) => {
    // core reports are not very interesting
  };

  public static report = (name: string) => {
    // core reports are not very interesting
  };
  /* eslint-enable @typescript-eslint/no-unused-vars*/

  public static doesReject = async (p: Promise<unknown>, errNeedle?: string[]): Promise<boolean> => {
    try {
      await p;
      return false;
    } catch (e) {
      if (!errNeedle) {
        // no needles to check against
        return true;
      }
      return !!errNeedle.find(needle => String(e).includes(needle));
    }
  };

  public static undefinedOnException = async <T>(p: Promise<T>): Promise<T | undefined> => {
    try {
      return await p;
    } catch {
      return undefined;
    }
  };

  public static version = () => {
    return Catch.RUNTIME_VERSION;
  };

  public static browser = (): { name: string } | undefined => {
    return undefined;
  };
}
