/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { Contact } from '../../core/crypto/key';

export class ContactStore {

  public static get = async (db: void, emailOrLongid: string[]): Promise<(Contact | undefined)[]> => {
    return [];
  }

}
