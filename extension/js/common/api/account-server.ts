/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import {InMemoryStoreKeys} from '../core/const.js';
import {isCustomUrlFesUsed} from '../helpers.js';
import {InMemoryStore} from '../platform/store/in-memory-store.js';
import {ExternalService} from './account-servers/external-service';
import {ParsedRecipients} from './email-provider/email-provider-api.js';
import {BackendAuthErr} from './shared/api-error.js';
import {Api, ProgressCb} from './shared/api.js';

export type UploadedMessageData = {
  url: string; // both FES and FlowCryptComApi
  externalId?: string; // legacy FES
  emailToExternalIdAndUrl?: { [email: string]: { url: string; externalId: string } }; // FES only
};

/**
 * This may be calling to FlowCryptComApi or Enterprise Server (FES, customer on-prem) depending on
 *   whether FES is deployed on the customer domain or not.
 */
export class AccountServer extends Api {
  private potentialCustomUrlFes: ExternalService;
  private sharedTenantFes: ExternalService;

  public constructor(private acctEmail: string) {
    super();
    this.potentialCustomUrlFes = new ExternalService(this.acctEmail);
    this.sharedTenantFes = new ExternalService(this.acctEmail);
    this.sharedTenantFes.url = 'https://flowcrypt.com/shared-tenant-fes/';
  }

  public accountGetAndUpdateLocalStore = async (): Promise<BackendRes.FcAccountGet> => {
    if (await this.isFesUsed()) {
      const fes = new ExternalService(this.acctEmail);
      const fetchedClientConfiguration = await fes.fetchAndSaveClientConfiguration();
      /* eslint-disable @typescript-eslint/naming-convention */
      return {
        domain_org_rules: fetchedClientConfiguration,
        // todo - rethink this. On FES, expiration is handled with S3 bucket policy regardless of this number
        //  which is set to 180 days on buckets we manage. This number below may still be rendered somewhere
        //  when composing, which should be evaluated.
        account: { default_message_expire: 180 },
      };
      /* eslint-enable @typescript-eslint/naming-convention */
    } else {
      return await FlowCryptComApi.accountGetAndUpdateLocalStore(await this.getIdToken());
    }
  };

  public messageUpload = async (
    encrypted: Uint8Array,
    replyToken: string,
    from: string,
    recipients: ParsedRecipients,
    progressCb: ProgressCb
  ): Promise<UploadedMessageData> => {
    if (await this.isFesUsed()) {
      const fes = new ExternalService(this.acctEmail);
      // Recipients are used to later cross-check replies from the web
      //   The message is not actually sent to them now.
      //   Message is uploaded and a link is retrieved which is sent through Gmail.
      return await fes.webPortalMessageUpload(encrypted, replyToken, from, recipients, progressCb);
    } else {
      return await FlowCryptComApi.messageUpload(await this.getIdToken(), encrypted, progressCb);
    }
  };

  public messageGatewayUpdate = async (externalId: string, emailGatewayMessageId: string) => {
    if (await this.isFesUsed()) {
      const fes = new ExternalService(this.acctEmail);
      await fes.messageGatewayUpdate(externalId, emailGatewayMessageId);
    }
  };

  public messageToken = async (): Promise<{ replyToken: string }> => {
    if (await this.isFesUsed()) {
      const fes = new ExternalService(this.acctEmail);
      return await fes.webPortalMessageNewReplyToken();
    } else {
      const res = await FlowCryptComApi.messageToken(await this.getIdToken());
      return { replyToken: res.token };
    }
  };

  public isFesUsed = async (): Promise<boolean> => {
    return await isCustomUrlFesUsed(this.acctEmail);
  };

  private getIdToken = async (): Promise<string> => {
    const idToken = await InMemoryStore.get(this.acctEmail, InMemoryStoreKeys.ID_TOKEN);
    if (!idToken) {
      // user will not actually see this message, they'll see a generic login prompt
      throw new BackendAuthErr('Missing id token, please re-authenticate');
    }
    return idToken;
  };
}
