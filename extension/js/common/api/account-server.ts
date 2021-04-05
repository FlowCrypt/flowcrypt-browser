/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { EnterpriseServer } from './account-servers/enterprise-server.js';
import { BackendRes, FcUuidAuth, FlowCryptComApi, ProfileUpdate } from './account-servers/flowcrypt-com-api.js';
import { WellKnownHostMeta } from './account-servers/well-known-host-meta.js';
import { Api, ProgressCb } from './shared/api.js';

/**
 * This may be calling to FlowCryptComApi or Enterprise Server (FES, customer on-prem) depending on
 *   domain configuration fetched using WellKnownHostMeta.
 */
export class AccountServer extends Api {

  private wellKnownHostMeta: WellKnownHostMeta;

  constructor(private acctEmail: string) {
    super();
    this.wellKnownHostMeta = new WellKnownHostMeta(acctEmail);
  }

  public loginWithOpenid = async (acctEmail: string, uuid: string, idToken: string): Promise<void> => {
    const fesUrl = await this.wellKnownHostMeta.getFesUrlFromCache();
    if (fesUrl) {
      const fes = new EnterpriseServer(fesUrl, this.acctEmail);
      await fes.getAccessTokenAndUpdateLocalStore(idToken);
    } else {
      await FlowCryptComApi.loginWithOpenid(acctEmail, uuid, idToken);
    }
  }

  public accountGetAndUpdateLocalStore = async (fcAuth: FcUuidAuth): Promise<BackendRes.FcAccountGet> => {
    const fesUrl = await this.wellKnownHostMeta.getFesUrlFromCache();
    if (fesUrl) {
      const fes = new EnterpriseServer(fesUrl, this.acctEmail);
      return await fes.getAccountAndUpdateLocalStore();
    } else {
      return await FlowCryptComApi.accountGetAndUpdateLocalStore(fcAuth);
    }
  }

  public accountUpdate = async (fcAuth: FcUuidAuth, profileUpdate: ProfileUpdate): Promise<void> => {
    const fesUrl = await this.wellKnownHostMeta.getFesUrlFromCache();
    if (fesUrl) {
      const fes = new EnterpriseServer(fesUrl, this.acctEmail);
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

  public messageExpiration = async (fcAuth: FcUuidAuth, adminCodes: string[], addDays?: number): Promise<BackendRes.ApirFcMsgExpiration> => {
    return await FlowCryptComApi.messageExpiration(fcAuth, adminCodes, addDays);
  }

  public linkMessage = async (short: string): Promise<BackendRes.FcLinkMsg> => {
    return await FlowCryptComApi.linkMessage(short);
  }

}
