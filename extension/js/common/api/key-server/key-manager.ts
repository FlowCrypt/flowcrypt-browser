/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

// tslint:disable:oneliner-object-literal
// tslint:disable:no-null-keyword

'use strict';

import { Api, ReqMethod } from './../shared/api.js';
import { Dict } from '../../core/common.js';

type LoadPrvRes = { privateKeys: { decryptedPrivateKey: string }[] };

export class KeyManager extends Api {

  private url: string;

  constructor(
    url: string
  ) {
    super();
    this.url = url.replace(/\/$/, ''); // remove trailing space
  }

  public getPrivateKeys = async (idToken: string): Promise<LoadPrvRes> => {
    return await this.request('GET', '/keys/private', undefined, idToken) as LoadPrvRes;
  };

  public storePrivateKey = async (idToken: string, decryptedPrivateKey: string, publicKey: string): Promise<void> => {
    return await this.request('PUT', '/keys/private', { decryptedPrivateKey, publicKey }, idToken);
  };

  private request = async <RT>(method: ReqMethod, path: string, vals?: Dict<any> | undefined, idToken?: string): Promise<RT> => {
    return await Api.apiCall(this.url, path, vals, vals ? 'JSON' : undefined, undefined, idToken ? { Authorization: `Bearer ${idToken}` } : undefined, undefined, method);
  };

}