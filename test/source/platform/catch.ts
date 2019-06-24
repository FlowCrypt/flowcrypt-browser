/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

const VERSION = 'B.1.0';

export type ObjWithStack = { stack: string };

export class Catch {

  public static RUNTIME_VERSION = VERSION;
  public static RUNTIME_ENVIRONMENT = 'undetermined';

  public static handleErr = (e: any) => {
    // core errs that are not rethrown are not very interesting
  }

  public static report = (name: string, details?: any) => {
    // core reports are not very interesting
  }

  public static version = () => {
    return Catch.RUNTIME_VERSION;
  }

}
