/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

export class Debug {
  private static DATA: unknown[] = [];

  public static readDatabase = async (): Promise<unknown[]> => {
    const old = Debug.DATA;
    Debug.DATA = [];
    return old;
  };

  public static addMessage = async (message: unknown): Promise<void> => {
    Debug.DATA.push(message);
  };
}
