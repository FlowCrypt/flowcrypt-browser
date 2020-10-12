/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { BackendRes, FcUuidAuth, FlowCryptComApi, ProfileUpdate } from './account-servers/flowcrypt-com-api.js';
import { Api, ProgressCb } from './shared/api.js';


/**
 * This may be calling to FlowCryptComApi or Enterprise Server (FES, customer on-prem) depending on
 *   domain configuration fetched using WellKnownHostMeta.
 *
 * Current implementation only calls FlowCryptComApi, FES integration is planned
 */
export class AccountServer extends Api {

  public static loginWithOpenid = async (acctEmail: string, uuid: string, idToken: string): Promise<void> => {
    return await FlowCryptComApi.loginWithOpenid(acctEmail, uuid, idToken);
  }

  public static accountUpdate = async (fcAuth: FcUuidAuth, profileUpdate: ProfileUpdate): Promise<BackendRes.FcAccountUpdate> => {
    return await FlowCryptComApi.accountUpdate(fcAuth, profileUpdate);
  }

  public static accountGetAndUpdateLocalStore = async (fcAuth: FcUuidAuth): Promise<BackendRes.FcAccountGet> => {
    return await FlowCryptComApi.accountGetAndUpdateLocalStore(fcAuth);
  }

  public static messageUpload = async (fcAuth: FcUuidAuth | undefined, encryptedDataBinary: Uint8Array, progressCb: ProgressCb): Promise<BackendRes.FcMsgUpload> => {
    return await FlowCryptComApi.messageUpload(fcAuth, encryptedDataBinary, progressCb);
  }

  public static messageToken = async (fcAuth: FcUuidAuth): Promise<BackendRes.FcMsgToken> => {
    return await FlowCryptComApi.messageToken(fcAuth);
  }

  public static messageExpiration = async (fcAuth: FcUuidAuth, adminCodes: string[], addDays?: number): Promise<BackendRes.ApirFcMsgExpiration> => {
    return await FlowCryptComApi.messageExpiration(fcAuth, adminCodes, addDays);
  }

  public static linkMessage = async (short: string): Promise<BackendRes.FcLinkMsg> => {
    return await FlowCryptComApi.linkMessage(short);
  }

}
