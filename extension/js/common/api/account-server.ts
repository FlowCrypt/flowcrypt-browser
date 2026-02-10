/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { isCustomerUrlFesUsed } from '../helpers.js';
import { ExternalService, FesRes } from './account-servers/external-service.js';
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

  /**
   * Gets a reply token for password-protected messages (legacy flow).
   */
  public messageToken = async (): Promise<{ replyToken: string }> => {
    return await this.externalService.webPortalMessageNewReplyToken();
  };

  /**
   * Allocates storage for a password-protected message using pre-signed S3 URL (new flow).
   * Returns storage file name, reply token, and pre-signed upload URL.
   */
  public messageAllocation = async (): Promise<FesRes.MessageAllocation> => {
    return await this.externalService.webPortalMessageAllocation();
  };

  /**
   * Uploads encrypted content directly to S3 using a pre-signed URL (new flow).
   */
  public uploadToS3 = async (uploadUrl: string, data: Uint8Array, progressCb: ProgressCb): Promise<void> => {
    await this.externalService.uploadToS3(uploadUrl, data, progressCb);
  };

  /**
   * Creates a password-protected message record in FES after uploading content to S3 (new flow).
   */
  public messageCreate = async (
    storageFileName: string,
    associateReplyToken: string,
    from: string,
    recipients: ParsedRecipients
  ): Promise<UploadedMessageData> => {
    return await this.externalService.webPortalMessageCreate(storageFileName, associateReplyToken, from, recipients);
  };
}
