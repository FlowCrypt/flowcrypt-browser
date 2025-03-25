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
  private readonly externalService: ExternalService;

  public constructor(private acctEmail: string) {
    super();
    this.externalService = new ExternalService(this.acctEmail);
  }

  public static async init(acctEmail: string) {
    const acctServer = new AccountServer(acctEmail);
    await acctServer.initialize();
    return acctServer;
  }

  public initialize = async () => {
    if (!(await isCustomerUrlFesUsed(this.acctEmail))) {
      this.externalService.url = SHARED_TENANT_API_HOST;
    }
  };

  public fetchAndSaveClientConfiguration = async (): Promise<ClientConfigurationJson> => {
    return await this.externalService.fetchAndSaveClientConfiguration();
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
    return await this.externalService.webPortalMessageUpload(encrypted, replyToken, from, recipients, progressCb);
  };

  public messageGatewayUpdate = async (externalId: string, emailGatewayMessageId: string) => {
    await this.externalService.messageGatewayUpdate(externalId, emailGatewayMessageId);
  };

  public messageToken = async (): Promise<{ replyToken: string }> => {
    return await this.externalService.webPortalMessageNewReplyToken();
  };
}
