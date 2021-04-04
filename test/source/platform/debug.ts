/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

export class Debug {
  private static DATA: any[] = [];

  public static readDatabase = async (): Promise<any[] | undefined> => {
    const old = Debug.DATA;
    Debug.DATA = [];
    return old;
  }

  public static addMessage = async (message: any): Promise<void> => {
    Debug.DATA.push(message);
  }
}
