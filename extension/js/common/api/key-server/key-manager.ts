/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Api } from './../shared/api.js';
import { Url } from '../../core/common.js';

type LoadPrvRes = { privateKeys: { decryptedPrivateKey: string }[] };

export class KeyManager extends Api {
  private url: string;

  public constructor(url: string) {
    super();
    this.url = Url.removeTrailingSlash(url);
  }

  public getPrivateKeys = async (idToken: string): Promise<LoadPrvRes> => {
    return await Api.apiCall(this.url, '/v1/keys/private', undefined, undefined, idToken ? { authorization: `Bearer ${idToken}` } : undefined, 'json');
  };

  public storePrivateKey = async (idToken: string, privateKey: string): Promise<void> => {
    await Api.apiCall(
      this.url,
      '/v1/keys/private',
      { data: { privateKey }, fmt: 'JSON', method: 'PUT' },
      undefined,
      idToken ? { authorization: `Bearer ${idToken}` } : undefined
    );
  };
}
