/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

const VERSION = 'B.1.0';

export type ObjWithStack = { stack: string };
export class UnreportableError extends Error { }

export class Catch {

  public static RUNTIME_VERSION = VERSION;
  public static RUNTIME_ENVIRONMENT = 'undetermined';

  public static handleErr = (e: any) => { // eslint-disable-line @typescript-eslint/no-unused-vars
    // core errs that are not rethrown are not very interesting
  };

  public static reportErr = (err: any) => { // eslint-disable-line @typescript-eslint/no-unused-vars
    // core reports are not very interesting
  };

  public static report = (name: string) => { // eslint-disable-line @typescript-eslint/no-unused-vars
    // core reports are not very interesting
  };

  public static doesReject = async (p: Promise<unknown>, errNeedle?: string[]): Promise<boolean> => {
    try {
      await p;
      return false;
    } catch (e) {
      if (!errNeedle) { // no needles to check against
        return true;
      }
      return !!errNeedle.find(needle => String(e).includes(needle));
    }
  };

  public static undefinedOnException = async <T>(p: Promise<T>): Promise<T | undefined> => {
    try {
      return await p;
    } catch (e) {
      return undefined;
    }
  };

  public static version = () => {
    return Catch.RUNTIME_VERSION;
  };

}
