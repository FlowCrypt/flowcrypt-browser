/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Api, ProgressCb, ProgressCbs, ReqFmt } from '../shared/api.js';
import { Dict } from '../../core/common.js';
import { Attachment } from '../../core/attachment.js';
import { ClientConfigurationError, ClientConfigurationJson } from '../../client-configuration.js';
import { AcctStore } from '../../platform/store/acct-store.js';
import { FlowCryptWebsite } from '../flowcrypt-website.js';
import { GoogleAuth } from '../email-provider/gmail/google-auth.js';

export type ProfileUpdate = {
  alias?: string;
  name?: string;
  photo?: string;
  intro?: string;
  web?: string;
  phone?: string;
  default_message_expire?: number; // eslint-disable-line @typescript-eslint/naming-convention
};

export namespace BackendRes {
  export type FcAccountLogin = { registered: boolean; verified: boolean };
  export type FcAccount$info = { alias?: string | null; default_message_expire: number }; // eslint-disable-line @typescript-eslint/naming-convention
  export type FcAccountGet = { account: FcAccount$info; domain_org_rules: ClientConfigurationJson }; // eslint-disable-line @typescript-eslint/naming-convention
  export type FcAccountUpdate = { result: FcAccount$info; updated: boolean };
  export type FcAccountCheck = { email: string | null };
  export type FcMsgToken = { token: string };
  export type FcMsgUpload = { url: string };
  export type FcLinkMsg = { expire: string; deleted: boolean; url: string; expired: boolean };
  export type FcLinkMe$profile = {
    alias: string | null;
    name: string | null;
    photo: string | null;
    intro: string | null;
    web: string | null;
    phone: string | null;
    token: string | null;
    email: string | null;
  };
  export type ApirFcMsgExpiration = { updated: boolean };
}

export class FlowCryptComApi extends Api {
  public static accountUpdate = async (idToken: string, profileUpdate: ProfileUpdate): Promise<BackendRes.FcAccountUpdate> => {
    return await FlowCryptComApi.request<BackendRes.FcAccountUpdate>(
      'account/update',
      {
        ...profileUpdate,
      },
      undefined,
      this.getAuthorizationHeader(idToken)
    );
  };

  public static accountGetAndUpdateLocalStore = async (idToken: string): Promise<BackendRes.FcAccountGet> => {
    const r = await FlowCryptComApi.request<BackendRes.FcAccountGet>('account/get', {}, undefined, FlowCryptComApi.getAuthorizationHeader(idToken));
    const { email } = GoogleAuth.parseIdToken(idToken);
    if (!email) {
      throw new Error('Id token is invalid');
    }
    if (r.domain_org_rules && !r.domain_org_rules.flags) {
      throw new ClientConfigurationError('missing_flags');
    }
    await AcctStore.set(email, { rules: r.domain_org_rules });
    return r;
  };

  public static messageUpload = async (idToken: string, encryptedDataBinary: Uint8Array, progressCb: ProgressCb): Promise<BackendRes.FcMsgUpload> => {
    const content = new Attachment({
      name: 'cryptup_encrypted_message.asc',
      type: 'text/plain',
      data: encryptedDataBinary,
    });
    const rawResponse = await FlowCryptComApi.request<{ short: string }>(
      'message/upload',
      { content },
      'FORM',
      FlowCryptComApi.getAuthorizationHeader(idToken),
      {
        upload: progressCb,
      }
    );
    if (!rawResponse.short) {
      throw new Error('Unexpectedly missing message upload short id');
    }
    // careful - this API request returns `url` as well, but that is URL of the S3 object, not of web portal page
    // therefore we are constructing URL ourselves to point to web portal
    return { url: `https://flowcrypt.com/${rawResponse.short}` };
  };

  public static messageToken = async (idToken: string): Promise<BackendRes.FcMsgToken> => {
    return await FlowCryptComApi.request<BackendRes.FcMsgToken>('message/token', {}, undefined, FlowCryptComApi.getAuthorizationHeader(idToken));
  };

  private static request = async <RT>(
    path: string,
    vals: Dict<unknown>,
    fmt: ReqFmt = 'JSON',
    addHeaders: Dict<string> = {},
    progressCbs?: ProgressCbs
  ): Promise<RT> => {
    return await FlowCryptComApi.apiCall(FlowCryptWebsite.url('api'), path, vals, fmt, progressCbs, {
      'api-version': '3',
      ...addHeaders,
    });
  };

  private static getAuthorizationHeader = (idToken: string) => {
    return { Authorization: `Bearer ${idToken}` }; // eslint-disable-line @typescript-eslint/naming-convention
  };
}
