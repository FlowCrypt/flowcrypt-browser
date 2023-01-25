/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { isCustomUrlFesUsed } from '../helpers.js';
import { ExternalService } from './account-servers/external-service.js';
import { ParsedRecipients } from './email-provider/email-provider-api.js';
import { Api, ProgressCb } from './shared/api.js';
import { ClientConfigurationJson } from '../client-configuration.js';

export type UploadedMessageData = {
  url: string; // both FES and FlowCryptComApi
  externalId?: string; // legacy FES
  emailToExternalIdAndUrl?: { [email: string]: { url: string; externalId: string } }; // FES only
};

export type AccountGetAndUpdateResult = {
  clientConfiguration: ClientConfigurationJson;
  defaultWebPortalMessageExpire: number;
};

/**
 * This may be calling to FlowCryptComApi or Enterprise Server (FES, customer on-prem) depending on
 *   whether FES is deployed on the customer domain or not.
 */
export class AccountServer extends Api {
  private readonly potentialCustomUrlFes: ExternalService;
  private readonly sharedTenantFes: ExternalService;

  public constructor(private acctEmail: string) {
    super();
    this.potentialCustomUrlFes = new ExternalService(this.acctEmail);
    this.sharedTenantFes = new ExternalService(this.acctEmail);
    this.sharedTenantFes.url = 'https://flowcrypt.com/shared-tenant-fes/';
  }

  public accountGetAndUpdateLocalStore = async (): Promise<AccountGetAndUpdateResult> => {
    const service = await this.getExternalService();
    const fetchedClientConfiguration = await service.fetchAndSaveClientConfiguration();
    return {
      clientConfiguration: fetchedClientConfiguration,
      defaultWebPortalMessageExpire: (await this.isFesUsed()) ? 180 : 90,
    };
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

  public isFesUsed = async (): Promise<boolean> => {
    return await isCustomUrlFesUsed(this.acctEmail);
  };

  private getExternalService = async (): Promise<ExternalService> => {
    if (await this.isFesUsed()) {
      return this.potentialCustomUrlFes;
    }
    return this.sharedTenantFes;
  };
}
