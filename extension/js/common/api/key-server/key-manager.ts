/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Api, ReqMethod } from './../shared/api.js';
import { Dict, Url } from '../../core/common.js';

type LoadPrvRes = { privateKeys: { decryptedPrivateKey: string }[] };

export class KeyManager extends Api {
  private url: string;

  public constructor(url: string) {
    super();
    this.url = Url.removeTrailingSlash(url);
  }

  public getPrivateKeys = async (idToken: string): Promise<LoadPrvRes> => {
    return (await this.request('GET', '/v1/keys/private', undefined, idToken)) as LoadPrvRes;
  };

  public storePrivateKey = async (idToken: string, privateKey: string): Promise<void> => {
    return await this.request('PUT', '/v1/keys/private', { privateKey }, idToken);
  };

  private request = async <RT>(method: ReqMethod, path: string, vals?: Dict<unknown> | undefined, idToken?: string): Promise<RT> => {
    return await Api.apiCall(
      this.url,
      path,
      vals,
      vals ? 'JSON' : undefined,
      undefined,
      idToken ? { Authorization: `Bearer ${idToken}` } : undefined, // eslint-disable-line @typescript-eslint/naming-convention
      undefined,
      method
    );
  };
}
