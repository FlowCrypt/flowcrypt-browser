/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { isCustomerUrlFesUsed } from '../helpers.js';
import { ExternalService } from './account-servers/external-service.js';
import { ParsedRecipients } from './email-provider/email-provider-api.js';
import { Api, ProgressCb } from './shared/api.js';
import { ClientConfigurationJson } from '../client-configuration.js';
import { SHARED_TENANT_API_HOST } from '../core/const.js';

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
  private readonly potentialCustomerUrlFes: ExternalService;
  private readonly sharedTenantFes: ExternalService;

  public constructor(private acctEmail: string) {
    super();
    this.potentialCustomerUrlFes = new ExternalService(this.acctEmail);
    this.sharedTenantFes = new ExternalService(this.acctEmail);
    this.sharedTenantFes.url = SHARED_TENANT_API_HOST;
  }

  public fetchAndSaveClientConfiguration = async (): Promise<ClientConfigurationJson> => {
    const service = await this.getExternalService();
    return await service.fetchAndSaveClientConfiguration();
  };

  public getWebPortalMessageExpireDays = async (): Promise<number> => {
    return (await isCustomerUrlFesUsed(this.acctEmail)) ? 180 : 90;
  };

  public messageUpload = async (
    encrypted: Uint8Array,
    replyToken: string,
    from: string,
    recipients: ParsedRecipients,
    progressCb: ProgressCb
  ): Promise<UploadedMessageData> => {
    const service = await this.getExternalService();
    return await service.webPortalMessageUpload(encrypted, replyToken, from, recipients, progressCb);
  };

  public messageGatewayUpdate = async (externalId: string, emailGatewayMessageId: string) => {
    const service = await this.getExternalService();
    return await service.messageGatewayUpdate(externalId, emailGatewayMessageId);
  };

  public messageToken = async (): Promise<{ replyToken: string }> => {
    const service = await this.getExternalService();
    return await service.webPortalMessageNewReplyToken();
  };

  private getExternalService = async (): Promise<ExternalService> => {
    if (await isCustomerUrlFesUsed(this.acctEmail)) {
      return this.potentialCustomerUrlFes;
    }
    return this.sharedTenantFes;
  };
}
