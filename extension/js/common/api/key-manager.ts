/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

// tslint:disable:oneliner-object-literal
// tslint:disable:no-null-keyword

'use strict';

import { Api, ReqMethod } from './api.js';
import { Dict } from '../core/common.js';

type LoadPrvRes = { privateKeys: { decryptedPrivateKey: string }[] };
// type LoadPubRes = { publicKeys: { publicKey: string }[] };

export class KeyManager extends Api {

  constructor(
    private url: string,
    private idToken: string
  ) {
    super();
    this.url = this.url.replace(/\/$/, ''); // remove trailing space
  }

  public getPrivateKeys = async (): Promise<LoadPrvRes> => {
    return await this.request('GET', '/keys/private') as LoadPrvRes;
  }

  public storePrivateKey = async (decryptedPrivateKey: string, publicKey: string, longid: string): Promise<void> => {
    return await this.request('PUT', '/keys/private', { decryptedPrivateKey, publicKey, longid });
  }

  private request = async <RT>(method: ReqMethod, path: string, vals?: Dict<any>): Promise<RT> => {
    return await Api.apiCall(this.url, path, vals, vals ? 'JSON' : undefined, undefined, { Authorization: `Bearer ${this.idToken}` }, undefined, method);
  }

}
