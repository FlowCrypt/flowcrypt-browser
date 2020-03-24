/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

const VERSION = 'B.1.0';

export type ObjWithStack = { stack: string };

export class Catch {

  public static RUNTIME_VERSION = VERSION;
  public static RUNTIME_ENVIRONMENT = 'undetermined';

  public static handleErr = (e: any) => {
    // core errs that are not rethrown are not very interesting
  }

  public static reportErr = (err: any) => {
    // core reports are not very interesting
  }

  public static report = (name: string) => {
    // core reports are not very interesting
  }

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
  }

  public static version = () => {
    return Catch.RUNTIME_VERSION;
  }

}
