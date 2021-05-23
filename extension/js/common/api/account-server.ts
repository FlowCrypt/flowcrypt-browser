/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { AcctStore } from '../platform/store/acct-store.js';
import { EnterpriseServer } from './account-servers/enterprise-server.js';
import { BackendRes, FcUuidAuth, FlowCryptComApi, ProfileUpdate } from './account-servers/flowcrypt-com-api.js';
import { Api, ProgressCb } from './shared/api.js';

/**
 * This may be calling to FlowCryptComApi or Enterprise Server (FES, customer on-prem) depending on
 *   whether FES is deployed on the customer domain or not.
 */
export class AccountServer extends Api {

  constructor(private acctEmail: string) {
    super();
  }

  public loginWithOpenid = async (acctEmail: string, uuid: string, idToken: string): Promise<void> => {
    if (await this.isFesUsed()) {
      const fes = new EnterpriseServer(this.acctEmail);
      await fes.getAccessTokenAndUpdateLocalStore(idToken);
    } else {
      await FlowCryptComApi.loginWithOpenid(acctEmail, uuid, idToken);
    }
  }

  public accountGetAndUpdateLocalStore = async (fcAuth: FcUuidAuth): Promise<BackendRes.FcAccountGet> => {
    if (await this.isFesUsed()) {
      const fes = new EnterpriseServer(this.acctEmail);
      return await fes.getAccountAndUpdateLocalStore();
    } else {
      return await FlowCryptComApi.accountGetAndUpdateLocalStore(fcAuth);
    }
  }

  public accountUpdate = async (fcAuth: FcUuidAuth, profileUpdate: ProfileUpdate): Promise<void> => {
    if (await this.isFesUsed()) {
      const fes = new EnterpriseServer(this.acctEmail);
      await fes.accountUpdate(profileUpdate);
    } else {
      await FlowCryptComApi.accountUpdate(fcAuth, profileUpdate);
    }
  }

  public messageUpload = async (fcAuth: FcUuidAuth | undefined, encryptedDataBinary: Uint8Array, progressCb: ProgressCb): Promise<BackendRes.FcMsgUpload> => {
    return await FlowCryptComApi.messageUpload(fcAuth, encryptedDataBinary, progressCb);
  }

  public messageToken = async (fcAuth: FcUuidAuth): Promise<BackendRes.FcMsgToken> => {
    return await FlowCryptComApi.messageToken(fcAuth);
  }

  private isFesUsed = async (): Promise<boolean> => {
    const { fesUrl } = await AcctStore.get(this.acctEmail, ['fesUrl']);
    return Boolean(fesUrl);
  }
}
